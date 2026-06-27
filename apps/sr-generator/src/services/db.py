from __future__ import annotations

from lib.db.postgres import list_apps
from lib.settings import get_database_settings


def get_db_apps() -> list[dict[str, str]]:
    settings = get_database_settings()
    if not settings.is_configured:
        raise ValueError("SR_GEN_DATABASE_URL is not configured.")
    return list_apps(settings)


def resolve_app_id(app_name: str, db_apps: list[dict[str, str]]) -> str | None:
    want = app_name.strip().lower()
    for item in db_apps:
        got = str(item.get("app_name", "")).strip().lower()
        if got == want:
            return str(item.get("app_id", "")).strip() or None
    return None
