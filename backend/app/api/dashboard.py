import json
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db import get_db
from app.models import Claim, Policy, User, Vehicle
from app.schemas import CoverageComparison, DashboardRead, DashboardReminder

router = APIRouter(tags=["dashboard"])
INDIA_TZ = ZoneInfo("Asia/Kolkata")


def period(policy: Policy, kind: str) -> tuple[date | None, date | None]:
    start = getattr(policy, f"{kind}_start_date") or policy.start_date
    end = getattr(policy, f"{kind}_end_date") or policy.end_date
    return start, end


@router.get("/dashboard", response_model=DashboardRead)
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = datetime.now(INDIA_TZ).date()
    vehicles = list(
        db.scalars(
            select(Vehicle).where(Vehicle.owner_id == user.id).order_by(Vehicle.created_at.desc())
        )
    )
    policies = list(db.scalars(select(Policy).where(Policy.owner_id == user.id)))
    claims = list(db.scalars(select(Claim).where(Claim.owner_id == user.id)))
    reminders: list[DashboardReminder] = []
    active_count = 0

    for vehicle in vehicles:
        vehicle_policies = [policy for policy in policies if policy.vehicle_id == vehicle.id]
        for policy in vehicle_policies:
            expiry_candidates = []
            if policy.own_damage:
                expiry_candidates.append(("own_damage", period(policy, "own_damage")[1]))
            if policy.third_party:
                expiry_candidates.append(("third_party", period(policy, "third_party")[1]))
            if any(end and end >= today for _, end in expiry_candidates):
                active_count += 1
            for coverage, end in expiry_candidates:
                if not end:
                    continue
                days = (end - today).days
                if days < 0:
                    reminders.append(
                        DashboardReminder(
                            kind="expired",
                            severity="urgent" if coverage == "third_party" else "warning",
                            vehicle_id=vehicle.id,
                            vehicle_label=vehicle.label,
                            policy_id=policy.id,
                            due_date=end,
                            message=f"{coverage.replace('_', ' ').title()} cover expired {abs(days)} day(s) ago.",
                        )
                    )
                elif days <= 30:
                    reminders.append(
                        DashboardReminder(
                            kind="renewal",
                            severity="urgent" if days <= 7 else "warning",
                            vehicle_id=vehicle.id,
                            vehicle_label=vehicle.label,
                            policy_id=policy.id,
                            due_date=end,
                            message=f"{coverage.replace('_', ' ').title()} cover expires in {days} day(s).",
                        )
                    )
            od_end = period(policy, "own_damage")[1]
            tp_end = period(policy, "third_party")[1]
            if (
                policy.own_damage
                and policy.third_party
                and od_end
                and tp_end
                and od_end < tp_end
                and od_end >= today
            ):
                reminders.append(
                    DashboardReminder(
                        kind="coverage_gap",
                        severity="info",
                        vehicle_id=vehicle.id,
                        vehicle_label=vehicle.label,
                        policy_id=policy.id,
                        due_date=od_end,
                        message="Own-damage cover ends before third-party cover. Review what protection applies after the own-damage expiry.",
                    )
                )
            if (
                policy.own_damage
                and policy.third_party
                and od_end
                and tp_end
                and tp_end < od_end
                and tp_end >= today
            ):
                reminders.append(
                    DashboardReminder(
                        kind="coverage_gap",
                        severity="urgent",
                        vehicle_id=vehicle.id,
                        vehicle_label=vehicle.label,
                        policy_id=policy.id,
                        due_date=tp_end,
                        message="Third-party cover ends before own-damage cover. Review third-party renewal before using the vehicle.",
                    )
                )

    reminders.sort(key=lambda item: (item.due_date or date.max, item.severity != "urgent"))
    open_claims = sum(claim.status not in {"approved", "rejected", "settled"} for claim in claims)
    return DashboardRead(
        vehicle_count=len(vehicles),
        active_policy_count=active_count,
        open_claim_count=open_claims,
        reminders=reminders,
        vehicles=vehicles,
    )


@router.get("/coverage-comparison", response_model=list[CoverageComparison])
def coverage_comparison(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.execute(
        select(Policy, Vehicle)
        .join(Vehicle, Policy.vehicle_id == Vehicle.id)
        .where(Policy.owner_id == user.id, Vehicle.owner_id == user.id)
        .order_by(Vehicle.label, Policy.insurer)
    )
    return [
        CoverageComparison(
            vehicle_id=vehicle.id,
            vehicle_label=vehicle.label,
            insurer=policy.insurer,
            policy_type=policy.policy_type,
            own_damage=policy.own_damage,
            third_party=policy.third_party,
            personal_accident=policy.personal_accident,
            add_ons=json.loads(policy.add_ons or "[]"),
            start_date=policy.start_date,
            end_date=policy.end_date,
        )
        for policy, vehicle in rows
    ]


@router.get("/grievance-guidance")
def grievance_guidance():
    return {
        "steps": [
            "Write to the insurer's Grievance Redressal Officer and include supporting documents.",
            "Keep written acknowledgement and verify the current resolution timeline with the insurer.",
            "If the response is unsatisfactory or no resolution arrives within the prescribed timeline, use IRDAI's Bima Bharosa portal.",
        ],
        "official_url": "https://bimabharosa.irdai.gov.in/Home/FAQ",
        "safety_note": "IRDAI says Bima Bharosa does not ask complainants or policyholders for payments.",
        "source_checked": "2026-11-15",
    }
