"""Typed Postgres configuration from environment (DB-backed API)."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

_SAFE_IDENT = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _require_sql_ident(value: str, label: str) -> str:
    if not value or not _SAFE_IDENT.match(value):
        raise ValueError(f"{label} must be a single SQL identifier, got {value!r}")
    return value


@dataclass(frozen=True)
class DatabaseSettings:
    """Postgres access. Column mappings come from app_mappings.fields, not env."""

    database_url: str
    # Dimension table for listing apps (optional — falls back to DISTINCT on fact table).
    app_list_table: str | None
    app_list_id_column: str
    app_list_name_column: str

    @property
    def is_configured(self) -> bool:
        return bool(self.database_url.strip())

    @classmethod
    def from_env(cls) -> DatabaseSettings:
        list_tbl_raw = (os.environ.get("SR_GEN_DB_APP_LIST_TABLE") or "").strip()
        return cls(
            database_url=(os.environ.get("SR_GEN_DATABASE_URL") or "").strip(),
            app_list_table=(
                _require_sql_ident(list_tbl_raw, "SR_GEN_DB_APP_LIST_TABLE")
                if list_tbl_raw
                else None
            ),
            app_list_id_column=_require_sql_ident(
                os.environ.get("SR_GEN_DB_APP_LIST_ID_COLUMN") or "id",
                "SR_GEN_DB_APP_LIST_ID_COLUMN",
            ),
            app_list_name_column=_require_sql_ident(
                os.environ.get("SR_GEN_DB_APP_LIST_NAME_COLUMN") or "app_name",
                "SR_GEN_DB_APP_LIST_NAME_COLUMN",
            ),
        )


_db_settings: DatabaseSettings | None = None


def get_database_settings() -> DatabaseSettings:
    global _db_settings
    if _db_settings is None:
        _db_settings = DatabaseSettings.from_env()
    return _db_settings


def reset_database_settings_cache() -> None:
    """Test hook: clear cached settings after env changes."""
    global _db_settings
    _db_settings = None
