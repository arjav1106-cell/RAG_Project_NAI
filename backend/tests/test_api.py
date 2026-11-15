from datetime import date, timedelta
from pathlib import Path


def add_vehicle_and_policy(client, end_date=None):
    vehicle = client.post(
        "/api/vehicles",
        json={
            "vehicle_type": "car",
            "label": "Family hatchback",
            "registration_number": "ka01ab1234",
            "make": "Tata",
            "model": "Altroz",
            "year": 2024,
        },
    )
    assert vehicle.status_code == 201
    policy = client.post(
        f"/api/vehicles/{vehicle.json()['id']}/policies",
        json={
            "insurer": "Sample Insurance",
            "policy_number": "POL-2026-001",
            "policy_type": "comprehensive",
            "own_damage": True,
            "third_party": True,
            "personal_accident": True,
            "start_date": date.today().isoformat(),
            "end_date": (end_date or date.today() + timedelta(days=12)).isoformat(),
            "own_damage_end_date": (end_date or date.today() + timedelta(days=12)).isoformat(),
            "third_party_end_date": (date.today() + timedelta(days=365)).isoformat(),
            "premium_amount": 18500,
            "payment_frequency": "annual",
            "add_ons": ["zero depreciation", "roadside assistance"],
        },
    )
    assert policy.status_code == 201
    return vehicle.json(), policy.json()


def test_registration_login_and_duplicate_account(client):
    payload = {"email": "New.Driver@example.com", "password": "StrongPass-2026"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    assert client.get("/api/auth/me").json()["email"] == "new.driver@example.com"
    assert client.post("/api/auth/register", json=payload).status_code == 409
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json=payload).status_code == 200


def test_vehicle_policy_payment_and_claim_workflows(registered_client):
    client = registered_client
    vehicle, policy = add_vehicle_and_policy(client)
    assert client.get("/api/vehicles").json()[0]["label"] == vehicle["label"]
    assert client.get("/api/policies").json()[0]["add_ons"] == [
        "zero depreciation",
        "roadside assistance",
    ]

    payment = client.post(
        f"/api/policies/{policy['id']}/payments",
        json={
            "paid_on": date.today().isoformat(),
            "amount": 18500,
            "status": "paid",
            "reference": "TXN-001",
        },
    )
    assert payment.status_code == 201
    assert client.get(f"/api/policies/{policy['id']}/payments").json()[0]["amount"] == 18500

    claim = client.post(
        f"/api/policies/{policy['id']}/claims",
        json={
            "incident_date": date.today().isoformat(),
            "description": "Front bumper damaged in a parking collision.",
        },
    )
    assert claim.status_code == 201
    assert client.get(f"/api/policies/{policy['id']}/claims").json()[0]["status"] == "reported"

    comparison = client.get("/api/coverage-comparison")
    assert comparison.status_code == 200
    assert comparison.json()[0]["add_ons"] == ["zero depreciation", "roadside assistance"]


def test_records_are_isolated_between_accounts(client):
    first = {"email": "first@example.com", "password": "StrongPass-2026"}
    second = {"email": "second@example.com", "password": "StrongPass-2026"}
    assert client.post("/api/auth/register", json=first).status_code == 201
    vehicle, policy = add_vehicle_and_policy(client)
    vehicle_id, policy_id = vehicle["id"], policy["id"]
    assert client.post("/api/auth/register", json=second).status_code == 201
    assert client.get("/api/vehicles").json() == []
    assert client.get(f"/api/policies/{policy_id}/documents").status_code == 404
    assert client.delete(f"/api/vehicles/{vehicle_id}").status_code == 404


def test_dashboard_shows_renewals_and_coverage_difference(registered_client):
    vehicle, _policy = add_vehicle_and_policy(registered_client)
    response = registered_client.get("/api/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert body["vehicle_count"] == 1
    assert body["active_policy_count"] == 1
    assert any(item["kind"] == "renewal" for item in body["reminders"])
    assert any(item["kind"] == "coverage_gap" for item in body["reminders"])
    assert body["vehicles"][0]["id"] == vehicle["id"]


def test_document_upload_extracts_reviewable_fields(
    registered_client, pdf_bytes, monkeypatch, tmp_path
):
    import app.api.documents as documents_api
    import app.services.document_ingestion as ingestion
    from app.core.config import Settings
    from app.services.ollama import OllamaUnavailable

    settings = Settings(data_dir=tmp_path)
    monkeypatch.setattr(documents_api, "get_settings", lambda: settings)
    monkeypatch.setattr(ingestion, "get_settings", lambda: settings)

    class OfflineOllama:
        async def embed(self, _text):
            raise OllamaUnavailable("offline")

    monkeypatch.setattr(documents_api, "OllamaClient", OfflineOllama)
    _vehicle, policy = add_vehicle_and_policy(registered_client)
    response = registered_client.post(
        f"/api/policies/{policy['id']}/documents",
        files={"file": ("policy.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "extracted"
    assert body["suggested_fields"]["policy_number"] == "SGI-2026-123456"
    assert body["suggested_fields"]["premium_amount"] == 18500.0
    assert body["suggested_fields"]["start_date"] == "2026-01-01"
    assert body["suggested_fields"]["end_date"] == "2026-12-31"
    invalid_review = registered_client.post(
        f"/api/documents/{body['id']}/review",
        json={"start_date": "2026-12-31", "end_date": "2026-01-01"},
    )
    assert invalid_review.status_code == 422
    reviewed = registered_client.post(
        f"/api/documents/{body['id']}/review",
        json={
            "insurer": "Corrected Insurer",
            "policy_number": "CORRECTED-123",
            "start_date": body["suggested_fields"]["start_date"],
            "end_date": body["suggested_fields"]["end_date"],
        },
    )
    assert reviewed.status_code == 200
    policies = registered_client.get("/api/policies").json()
    assert policies[0]["insurer"] == "Corrected Insurer"
    assert policies[0]["start_date"] == "2026-01-01"
    assert policies[0]["end_date"] == "2026-12-31"

    downloaded = registered_client.get(f"/api/documents/{body['id']}/download")
    assert downloaded.status_code == 200
    assert downloaded.content.startswith(b"%PDF-")
    assert list(Path(tmp_path).glob("*.pdf"))


def test_invalid_upload_is_rejected(registered_client):
    _vehicle, policy = add_vehicle_and_policy(registered_client)
    response = registered_client.post(
        f"/api/policies/{policy['id']}/documents",
        files={"file": ("not-a-policy.pdf", b"not a PDF", "application/pdf")},
    )
    assert response.status_code == 415


def test_deleting_vehicle_removes_linked_policy_files(
    registered_client, pdf_bytes, monkeypatch, tmp_path
):
    import app.api.documents as documents_api
    import app.services.document_ingestion as ingestion
    from app.core.config import Settings
    from app.services.ollama import OllamaUnavailable

    settings = Settings(data_dir=tmp_path)
    monkeypatch.setattr(documents_api, "get_settings", lambda: settings)
    monkeypatch.setattr(ingestion, "get_settings", lambda: settings)

    class OfflineOllama:
        async def embed(self, _text):
            raise OllamaUnavailable("offline")

    monkeypatch.setattr(documents_api, "OllamaClient", OfflineOllama)
    vehicle, policy = add_vehicle_and_policy(registered_client)
    uploaded = registered_client.post(
        f"/api/policies/{policy['id']}/documents",
        files={"file": ("policy.pdf", pdf_bytes, "application/pdf")},
    )
    assert uploaded.status_code == 201
    stored_files = list(tmp_path.glob("*.pdf"))
    assert len(stored_files) == 1

    deleted = registered_client.delete(f"/api/vehicles/{vehicle['id']}")

    assert deleted.status_code == 204
    assert list(tmp_path.glob("*.pdf")) == []


def test_grievance_guidance_points_to_official_portal(client):
    response = client.get("/api/grievance-guidance")
    assert response.status_code == 200
    assert response.json()["official_url"].startswith("https://bimabharosa.irdai.gov.in/")


def test_assistant_api_integrates_owned_tracker_retrieval_and_citations(
    registered_client, monkeypatch
):
    import app.services.rag as rag

    class FakeOllama:
        async def embed(self, _text):
            return [1.0] + [0.0] * 767

        async def answer(self, _question, evidence):
            return f"The saved tracker is included. [{evidence[0]['citation_id']}]"

    monkeypatch.setattr(rag, "OllamaClient", FakeOllama)
    _vehicle, policy = add_vehicle_and_policy(registered_client)

    response = registered_client.post(
        "/api/assistant/ask",
        json={"question": "What premium is saved in my tracker?", "policy_id": policy["id"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["insufficient_evidence"] is False
    assert body["citations"][0]["title"] == "Your vehicle insurance tracker"
    assert "[C1]" in body["answer"]


def test_assistant_api_reports_unavailable_ollama_as_service_unavailable(
    registered_client, monkeypatch
):
    import app.services.rag as rag
    from app.services.ollama import OllamaUnavailable

    class OfflineOllama:
        async def embed(self, _text):
            raise OllamaUnavailable("offline")

        async def answer(self, _question, _evidence):
            raise OllamaUnavailable("offline")

    monkeypatch.setattr(rag, "OllamaClient", OfflineOllama)
    _vehicle, policy = add_vehicle_and_policy(registered_client)

    response = registered_client.post(
        "/api/assistant/ask",
        json={"question": "What premium is saved in my tracker?", "policy_id": policy["id"]},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "offline"
