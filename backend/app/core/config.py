from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Vahana Policy Companion API"
    environment: str = "development"
    database_url: str = "sqlite:///./vahana.db"
    session_secret: str = ""
    session_cookie: str = "vahana_session"
    session_days: int = 7
    data_dir: Path = Path("./data/private")
    max_upload_mb: int = 25
    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "qwen3:4b-instruct"
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_timeout_seconds: float = 90.0
    tesseract_cmd: str = ""
    cors_origins: str = "http://localhost:5173"
    cookie_secure: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings
