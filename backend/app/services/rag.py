import json
import math
import re

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import (
    Claim,
    KnowledgeChunk,
    Policy,
    PolicyDocument,
    PremiumPayment,
    User,
    Vehicle,
)
from app.services.ollama import OllamaClient, OllamaUnavailable, citation_id

DISCLAIMER = "Informational explanation only. The issued policy and the insurer's assessment govern actual coverage and claims."
OFF_TOPIC_ANSWER = (
    "I can help with your saved vehicles, motor insurance policies, payments, claims, "
    "policy documents, or related Indian motor-insurance guidance. I can't answer unrelated questions."
)
UNREGISTERED_VEHICLE_ANSWER = (
    "I couldn't match that vehicle to your garage. Add it to your garage or choose a registered "
    "vehicle before asking about its insurance."
)
MOTOR_INSURANCE_TERMS = re.compile(
    r"\b(vehicle|car|bike|motorcycle|scooter|motor|insurance|insurer|policy|cover(?:age)?|"
    r"premium|claim|accident|crash|damage|renew(?:al)?|add[- ]?on|exclusion|deductible|"
    r"third[- ]party|own[- ]damage|garage|registration|document|pdf|grievance|irdai|"
    r"roadside|depreciation|modif(?:y|ication)|payment|expiry|expire|legal)\b",
    re.IGNORECASE,
)


def is_in_scope_question(question: str) -> bool:
    return bool(MOTOR_INSURANCE_TERMS.search(question))


def unknown_vehicle_reference(db: Session, user: User, question: str) -> bool:
    """Reject explicit vehicle identifiers that do not match this user's garage."""
    vehicles = list(db.scalars(select(Vehicle).where(Vehicle.owner_id == user.id)))
    normalized = re.sub(r"[^a-z0-9]+", " ", question.casefold()).strip()
    for vehicle in vehicles:
        aliases = [vehicle.label, vehicle.registration_number, vehicle.make, vehicle.model]
        if any(
            value and re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip() in normalized
            for value in aliases
        ):
            return False
    explicit = re.search(
        r"\b(?:my|our|the)\s+([a-z0-9][a-z0-9 -]{0,50}?)\s+"
        r"(car|vehicle|bike|motorcycle|scooter)\b",
        question,
        re.IGNORECASE,
    )
    if not explicit:
        return False
    identifier = re.sub(r"[^a-z0-9]+", " ", explicit.group(1).casefold()).strip()
    return not any(
        identifier
        in re.sub(
            r"[^a-z0-9]+",
            " ",
            " ".join(
                str(value) for value in (v.label, v.registration_number, v.make, v.model) if value
            ).casefold(),
        ).strip()
        for v in vehicles
    )


def cosine(left: list[float], right: list[float]) -> float:
    if not left or len(left) != len(right):
        return 0.0
    numerator = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if not left_norm or not right_norm:
        return 0.0
    return numerator / (left_norm * right_norm)


def candidate_query(db: Session, user: User, vehicle_id: int | None, policy_id: int | None):
    query = select(KnowledgeChunk).where(
        or_(KnowledgeChunk.owner_id.is_(None), KnowledgeChunk.owner_id == user.id)
    )
    if policy_id is not None:
        policy = db.scalar(select(Policy).where(Policy.id == policy_id, Policy.owner_id == user.id))
        if policy is None:
            return None
        query = query.where(
            or_(
                KnowledgeChunk.source_id.is_not(None),
                KnowledgeChunk.document_id.in_(
                    select(PolicyDocument.id).where(
                        PolicyDocument.policy_id == policy.id, PolicyDocument.owner_id == user.id
                    )
                ),
            )
        )
    elif vehicle_id is not None:
        vehicle = db.scalar(
            select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.owner_id == user.id)
        )
        if vehicle is None:
            return None
        query = query.where(
            or_(
                KnowledgeChunk.source_id.is_not(None),
                KnowledgeChunk.document_id.in_(
                    select(PolicyDocument.id)
                    .join(Policy, Policy.id == PolicyDocument.policy_id)
                    .where(
                        Policy.vehicle_id == vehicle.id,
                        Policy.owner_id == user.id,
                        PolicyDocument.owner_id == user.id,
                    )
                ),
            )
        )
    else:
        query = query.where(
            or_(KnowledgeChunk.source_id.is_not(None), KnowledgeChunk.owner_id == user.id)
        )
    return query


def tracker_snapshot(db: Session, user: User, vehicle_id: int | None, policy_id: int | None) -> str:
    """Build private, current tracker context for the selected account scope."""
    vehicle_query = select(Vehicle).where(Vehicle.owner_id == user.id)
    if vehicle_id is not None:
        vehicle_query = vehicle_query.where(Vehicle.id == vehicle_id)
    vehicles = list(db.scalars(vehicle_query.order_by(Vehicle.label)))
    if not vehicles:
        return ""

    vehicle_by_id = {vehicle.id: vehicle for vehicle in vehicles}
    policy_query = select(Policy).where(
        Policy.owner_id == user.id, Policy.vehicle_id.in_(vehicle_by_id)
    )
    if policy_id is not None:
        policy_query = policy_query.where(Policy.id == policy_id)
    policies = list(db.scalars(policy_query.order_by(Policy.id)))
    if not policies:
        return ""

    policy_ids = [policy.id for policy in policies]
    claims = list(
        db.scalars(
            select(Claim)
            .where(Claim.owner_id == user.id, Claim.policy_id.in_(policy_ids))
            .order_by(Claim.incident_date.desc(), Claim.id.desc())
        )
    )
    payments = list(
        db.scalars(
            select(PremiumPayment)
            .where(
                PremiumPayment.owner_id == user.id,
                PremiumPayment.policy_id.in_(policy_ids),
            )
            .order_by(PremiumPayment.paid_on.desc(), PremiumPayment.id.desc())
        )
    )
    lines = ["Account tracker data (user-entered; not a substitute for policy wording):"]
    for vehicle in vehicles:
        vehicle_policies = [p for p in policies if p.vehicle_id == vehicle.id]
        if not vehicle_policies:
            continue
        lines.append(
            f"Vehicle: {vehicle.label}; type={vehicle.vehicle_type}; make={vehicle.make or 'not recorded'}; "
            f"model={vehicle.model or 'not recorded'}; year={vehicle.year or 'not recorded'}."
        )
        for policy in vehicle_policies:
            cover = []
            if policy.third_party:
                cover.append("third-party liability")
            if policy.own_damage:
                cover.append("own damage")
            if policy.personal_accident:
                cover.append("personal accident")
            lines.append(
                f"Policy: insurer={policy.insurer or 'not recorded'}; number={policy.policy_number or 'not recorded'}; "
                f"type={policy.policy_type}; covers={', '.join(cover) or 'not recorded'}; "
                f"period={policy.start_date or 'unknown'} to {policy.end_date or 'unknown'}; "
                f"own-damage expiry={policy.own_damage_end_date or policy.end_date or 'unknown'}; "
                f"third-party expiry={policy.third_party_end_date or policy.end_date or 'unknown'}; "
                f"premium={policy.premium_amount if policy.premium_amount is not None else 'unknown'} INR "
                f"({policy.payment_frequency}); add-ons={', '.join(json.loads(policy.add_ons or '[]')) or 'none recorded'}."
            )
            for payment in [p for p in payments if p.policy_id == policy.id][:5]:
                lines.append(
                    f"Premium payment: {payment.paid_on}; {payment.amount:g} INR; "
                    f"status={payment.status}; reference={payment.reference or 'not recorded'}."
                )
            for claim in [c for c in claims if c.policy_id == policy.id][:5]:
                lines.append(
                    f"Claim: incident={claim.incident_date or 'unknown'}; status={claim.status}; "
                    f"description={claim.description}; amount={claim.claim_amount if claim.claim_amount is not None else 'unknown'} INR; "
                    f"notes={claim.notes or 'none'}."
                )
    return "\n".join(lines)[:12000]


async def answer_question(
    db: Session,
    user: User,
    question: str,
    vehicle_id: int | None = None,
    policy_id: int | None = None,
    client: OllamaClient | None = None,
) -> dict:
    client = client or OllamaClient()
    query = candidate_query(db, user, vehicle_id, policy_id)
    if query is None:
        return {
            "answer": "The selected vehicle or policy was not found.",
            "citations": [],
            "insufficient_evidence": True,
            "disclaimer": DISCLAIMER,
        }
    if not is_in_scope_question(question):
        return {
            "answer": OFF_TOPIC_ANSWER,
            "citations": [],
            "insufficient_evidence": True,
            "disclaimer": DISCLAIMER,
        }
    if unknown_vehicle_reference(db, user, question):
        return {
            "answer": UNREGISTERED_VEHICLE_ANSWER,
            "citations": [],
            "insufficient_evidence": True,
            "disclaimer": DISCLAIMER,
        }
    rows = list(db.scalars(query)) if query is not None else []
    snapshot = tracker_snapshot(db, user, vehicle_id, policy_id)
    if not rows and not snapshot:
        return {
            "answer": "I couldn't find an uploaded policy or relevant source for this question. Add a policy document or broaden the selected vehicle scope.",
            "citations": [],
            "insufficient_evidence": True,
            "disclaimer": DISCLAIMER,
        }
    ranked = []
    if rows:
        question_vector = await client.embed(question)
        missing = [row for row in rows if row.embedding is None]
        for row in missing:
            row.embedding = await client.embed(row.content)
        if missing:
            db.commit()
        ranked = sorted(
            rows, key=lambda row: cosine(question_vector, row.embedding or []), reverse=True
        )
        ranked = [row for row in ranked if cosine(question_vector, row.embedding or []) >= 0.16][:5]
    if not ranked and not snapshot:
        return {
            "answer": "I couldn't find enough relevant information in your uploaded policies or the curated official sources to answer confidently.",
            "citations": [],
            "insufficient_evidence": True,
            "disclaimer": DISCLAIMER,
        }
    evidence = []
    citations = []
    if snapshot:
        tracker_citation = {
            "citation_id": citation_id(len(citations)),
            "title": "Your vehicle insurance tracker",
            "publisher": "Vahana tracker",
            "url": None,
            "document_id": None,
            "location": "Saved account records",
            "excerpt": snapshot[:600],
        }
        citations.append(tracker_citation)
        evidence.append(
            {
                "citation_id": tracker_citation["citation_id"],
                "title": tracker_citation["title"],
                "location": tracker_citation["location"],
                "content": snapshot,
            }
        )
    for chunk in ranked:
        index = len(citations)
        source = chunk.source
        document = chunk.document
        policy = document.policy if document else None
        title = (
            source.title if source else (document.original_name if document else "Uploaded policy")
        )
        publisher = (
            source.publisher if source else (policy.insurer if policy else "User-uploaded policy")
        )
        url = source.url if source else None
        location = source.effective_date if source and source.effective_date else ""
        if chunk.section:
            location = f"{location} · {chunk.section}".strip(" ·")
        elif chunk.page_number:
            location = f"Page {chunk.page_number}"
        elif document:
            location = "Policy document"
        cite = citation_id(index)
        evidence.append(
            {"citation_id": cite, "title": title, "location": location, "content": chunk.content}
        )
        citations.append(
            {
                "citation_id": cite,
                "title": title,
                "publisher": publisher or "",
                "url": url,
                "document_id": document.id if document else None,
                "location": location,
                "excerpt": chunk.content[:600],
            }
        )
    try:
        answer = await client.answer(question, evidence)
    except OllamaUnavailable as exc:
        raise OllamaUnavailable(str(exc)) from exc
    valid_markers = {f"[{item['citation_id']}]" for item in citations}
    for marker in re.findall(r"\[C\d+\]", answer):
        if marker not in valid_markers:
            answer = answer.replace(marker, "")
    if not any(marker in answer for marker in valid_markers):
        answer = (
            "I found potentially relevant records, but the generated explanation did not identify "
            "which source supports it. I can't provide a reliable answer from that response. "
            "Review the sources below or ask a narrower question."
        )
        insufficient_evidence = True
    else:
        insufficient_evidence = False
    return {
        "answer": answer.strip(),
        "citations": citations,
        "insufficient_evidence": insufficient_evidence,
        "disclaimer": DISCLAIMER,
    }
