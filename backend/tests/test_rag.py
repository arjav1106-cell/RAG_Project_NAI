import asyncio
import json
from datetime import date

from app.models import (
    Claim,
    KnowledgeChunk,
    KnowledgeSource,
    Policy,
    PremiumPayment,
    User,
    Vehicle,
)
from app.services.document_ingestion import make_chunks, suggest_policy_fields
from app.services.knowledge import seed_knowledge
from app.services.rag import answer_question, cosine


class FakeOllama:
    async def embed(self, _text):
        return [1.0] + [0.0] * 767

    async def answer(self, _question, evidence):
        return f"The source supports this explanation. [{evidence[0]['citation_id']}]"


def test_cosine_and_document_chunking():
    assert cosine([1, 0], [1, 0]) == 1
    assert cosine([1, 0], [0, 1]) == 0
    chunks = make_chunks([{"page_number": 3, "text": "A" * 2100}], size=1000, overlap=100)
    assert len(chunks) == 3
    assert all(chunk["page_number"] == 3 for chunk in chunks)


def test_policy_field_suggestions():
    text = "Policy Number: ABC-123456\nInsurer: Test Insurer\nTotal Premium: Rs 8,450"
    suggestions = suggest_policy_fields(text)
    assert suggestions["policy_number"] == "ABC-123456"
    assert suggestions["insurer"] == "Test Insurer"
    assert suggestions["premium_amount"] == 8450.0

    dates = suggest_policy_fields("Period of Insurance From: 01/01/2026 To: 31/12/2026")
    assert dates["start_date"] == "2026-01-01"
    assert dates["end_date"] == "2026-12-31"


def test_seed_knowledge_updates_changed_content_and_invalidates_embedding(
    session_factory, tmp_path, monkeypatch
):
    import app.services.knowledge as knowledge

    source_data = [
        {
            "title": "Official source",
            "publisher": "Test publisher",
            "url": "https://example.com/old",
            "effective_date": "checked 2026-11-15",
            "section": "Section 1",
            "content": "Original source text is long enough for a useful retrieval chunk.",
        }
    ]
    source_path = tmp_path / "sources.json"
    source_path.write_text(json.dumps(source_data), encoding="utf-8")
    monkeypatch.setattr(knowledge, "SOURCE_FILE", source_path)

    with session_factory() as db:
        assert seed_knowledge(db) == 1
        chunk = db.query(KnowledgeChunk).one()
        chunk.embedding = [0.5] * 768
        db.commit()

        source_data[0]["url"] = "https://example.com/current"
        source_data[0]["content"] = "Updated official source wording for retrieval."
        source_path.write_text(json.dumps(source_data), encoding="utf-8")

        assert seed_knowledge(db) == 0
        assert chunk.source.url == "https://example.com/current"
        assert chunk.content == "Updated official source wording for retrieval."
        assert chunk.embedding is None


def test_rag_returns_citations_from_retrieved_source(session_factory):
    with session_factory() as db:
        user = User(email="rag@example.com", password_hash="unused")
        source = KnowledgeSource(
            title="Motor Vehicles Act — Section 146",
            publisher="India Code",
            url="https://www.indiacode.nic.in/",
            effective_date="As amended",
            content="Third party insurance is required for use in a public place.",
        )
        db.add_all([user, source])
        db.flush()
        db.add(
            KnowledgeChunk(
                source_id=source.id,
                section="Section 146",
                content=source.content,
                embedding=[1.0] + [0.0] * 767,
            )
        )
        db.commit()
        result = asyncio.run(
            answer_question(
                db,
                user,
                "Is third party insurance required?",
                client=FakeOllama(),
            )
        )
        assert result["insufficient_evidence"] is False
        assert result["citations"][0]["title"] == source.title
        assert "[C1]" in result["answer"]


def test_rag_abstains_when_there_are_no_sources(session_factory):
    with session_factory() as db:
        user = User(email="empty@example.com", password_hash="unused")
        db.add(user)
        db.commit()
        result = asyncio.run(
            answer_question(
                db,
                user,
                "Does my policy cover an engine replacement?",
                client=FakeOllama(),
            )
        )
        assert result["insufficient_evidence"] is True
        assert result["citations"] == []


def test_rag_rejects_unrelated_questions_before_calling_model(session_factory):
    class UnexpectedOllama(FakeOllama):
        async def embed(self, _text):
            raise AssertionError("off-topic questions must not reach the model")

    with session_factory() as db:
        user = User(email="off-topic@example.com", password_hash="unused")
        db.add(user)
        db.commit()
        result = asyncio.run(
            answer_question(db, user, "Write a poem about baking cakes", client=UnexpectedOllama())
        )
        assert result["insufficient_evidence"] is True
        assert result["citations"] == []
        assert "can't answer unrelated" in result["answer"]


def test_rag_rejects_explicit_vehicle_not_in_garage(session_factory):
    class UnexpectedOllama(FakeOllama):
        async def embed(self, _text):
            raise AssertionError("unregistered vehicle questions must not reach the model")

    with session_factory() as db:
        user = User(email="unknown-vehicle@example.com", password_hash="unused")
        db.add(user)
        db.flush()
        db.add(Vehicle(owner_id=user.id, vehicle_type="car", label="Family Baleno"))
        db.commit()
        result = asyncio.run(
            answer_question(
                db, user, "What coverage does my Honda car have?", client=UnexpectedOllama()
            )
        )
        assert result["insufficient_evidence"] is True
        assert result["citations"] == []
        assert "couldn't match that vehicle" in result["answer"]


def test_rag_does_not_attach_unrelated_citations_to_uncited_generation(session_factory):
    class UncitedOllama(FakeOllama):
        async def answer(self, _question, _evidence):
            return "This claim is definitely covered."

    with session_factory() as db:
        user = User(email="uncited@example.com", password_hash="unused")
        source = KnowledgeSource(
            title="Motor Vehicles Act — Section 146",
            publisher="India Code",
            url="https://www.indiacode.nic.in/",
            content="Third party insurance is required for use in a public place.",
        )
        db.add_all([user, source])
        db.flush()
        db.add(
            KnowledgeChunk(
                source_id=source.id,
                section="Section 146",
                content=source.content,
                embedding=[1.0] + [0.0] * 767,
            )
        )
        db.commit()

        result = asyncio.run(
            answer_question(
                db,
                user,
                "Is third party insurance required?",
                client=UncitedOllama(),
            )
        )

        assert result["insufficient_evidence"] is True
        assert "did not identify which source" in result["answer"]


def test_rag_includes_owned_tracker_context_without_policy_pdf(session_factory):
    with session_factory() as db:
        user = User(email="tracker@example.com", password_hash="unused")
        db.add(user)
        db.flush()
        vehicle = Vehicle(
            owner_id=user.id,
            vehicle_type="car",
            label="Family car",
            make="Tata",
            model="Altroz",
        )
        db.add(vehicle)
        db.flush()
        policy = Policy(
            owner_id=user.id,
            vehicle_id=vehicle.id,
            insurer="Sample Insurance",
            policy_number="POL-TRACKER-123",
            policy_type="comprehensive",
            own_damage=True,
            third_party=True,
            premium_amount=18500,
            payment_frequency="annual",
            add_ons='["roadside assistance"]',
        )
        db.add(policy)
        db.flush()
        db.add(
            PremiumPayment(
                owner_id=user.id,
                policy_id=policy.id,
                paid_on=date(2026, 1, 1),
                amount=18500,
                status="paid",
                reference="TXN-123",
            )
        )
        db.add(
            Claim(
                owner_id=user.id,
                policy_id=policy.id,
                incident_date=date(2026, 2, 1),
                description="Rear bumper damage",
                status="in_review",
            )
        )
        other_user = User(email="other-tracker@example.com", password_hash="unused")
        db.add(other_user)
        db.flush()
        other_vehicle = Vehicle(
            owner_id=other_user.id,
            vehicle_type="bike",
            label="Private other bike",
        )
        db.add(other_vehicle)
        db.flush()
        db.add(
            Policy(
                owner_id=other_user.id,
                vehicle_id=other_vehicle.id,
                insurer="Other insurer",
                policy_number="PRIVATE-OTHER-999",
                premium_amount=99999,
            )
        )
        db.commit()

        result = asyncio.run(
            answer_question(
                db, user, "What premium and claims are in my tracker?", client=FakeOllama()
            )
        )

        assert result["insufficient_evidence"] is False
        assert result["citations"][0]["title"] == "Your vehicle insurance tracker"
        assert "18500" in result["citations"][0]["excerpt"]
        assert "Private other bike" not in result["citations"][0]["excerpt"]
        assert "PRIVATE-OTHER-999" not in result["citations"][0]["excerpt"]
