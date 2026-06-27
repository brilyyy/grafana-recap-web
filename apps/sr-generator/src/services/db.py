from __future__ import annotations

from lib.db.postgres import list_apps
from lib.settings import get_database_settings


def get_db_apps() -> list[dict[str, str]]:
    settings = get_database_settings()
    if not settings.is_configured:
        raise ValueError("SR_GEN_DATABASE_URL is not configured.")
    return list_apps(settings)

