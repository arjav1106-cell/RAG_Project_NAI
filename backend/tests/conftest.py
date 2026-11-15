import pymupdf
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies import get_db
from app.db import Base
from app.main import app


@pytest.fixture
def session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def client(session_factory):
    def override_get_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def registered_client(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "driver@example.com", "password": "StrongPass-2026"},
    )
    assert response.status_code == 201
    return client


@pytest.fixture
def pdf_bytes():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text(
        (50, 60),
        "Vehicle Insurance Policy\nInsurer: Sample General Insurance\n"
        "Policy Number: SGI-2026-123456\nTotal Premium: Rs 18,500\n"
        "Period of Insurance From: 01/01/2026 To: 31/12/2026\n"
        "Own damage cover applies subject to exclusions and conditions in this policy.",
        fontsize=12,
    )
    result = pdf.tobytes()
    pdf.close()
    return result
