import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from app.api import assistant, auth, dashboard, documents, garage
from app.core.config import get_settings
from app.db import Base, SessionLocal, engine
from app.services.knowledge import seed_knowledge

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        count = seed_knowledge(db)
        logger.info("Loaded %s new curated legal source(s)", count)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
session_secret = settings.session_secret
if not session_secret:
    if settings.environment.lower() == "production":
        raise RuntimeError("SESSION_SECRET must be configured for production")
    session_secret = secrets.token_urlsafe(32)
    logger.warning(
        "SESSION_SECRET is unset; development sessions will expire when the server restarts"
    )
app.add_middleware(
    SessionMiddleware,
    secret_key=session_secret,
    session_cookie=settings.session_cookie,
    max_age=settings.session_days * 24 * 60 * 60,
    same_site="lax",
    https_only=settings.cookie_secure,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(garage.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "database": engine.dialect.name,
        "assistant": "Ollama required for generation",
    }
