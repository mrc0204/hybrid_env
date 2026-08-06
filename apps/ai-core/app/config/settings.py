"""Single, validated, typed entry point for AI Core configuration — the
Python-side counterpart to the Backend's `src/config/env.ts`.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    port: int = 8000
    log_level: str = "info"
    backend_url: str = "http://localhost:4000"
    # Deployment scope — matches WorldState.scope.
    scope: str = "niat-kkh-campus"


@lru_cache
def get_settings() -> Settings:
    return Settings()
