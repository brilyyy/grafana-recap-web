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
    """Postgres access for `/db/*` routes. Driven by env (see `.env.db.example`)."""

    database_url: str
    table: str
    app_id_column: str
    date_column: str
    col_date: str
    col_response_code: str
    col_response_code_desc: str
    col_error_type: str
    col_trx_count: str
    col_trx_feature: str
    # When set, GET /db/app-ids reads this small dimension table instead of DISTINCT on the fact table.
    app_list_table: str | None
    app_list_id_column: str
    app_list_name_column: str
    mapping_slug: str

    @property
    def is_configured(self) -> bool:
        return bool(self.database_url.strip())

    @classmethod
    def from_env(cls) -> DatabaseSettings:
        list_tbl_raw = (os.environ.get("SR_GEN_DB_APP_LIST_TABLE") or "").strip()
        return cls(
            database_url=(os.environ.get("SR_GEN_DATABASE_URL") or "").strip(),
            table=_require_sql_ident(
                os.environ.get("SR_GEN_DB_TABLE") or "transactions",
                "SR_GEN_DB_TABLE",
            ),
            app_id_column=_require_sql_ident(
                os.environ.get("SR_GEN_DB_APP_ID_COLUMN") or "app_id",
                "SR_GEN_DB_APP_ID_COLUMN",
            ),
            date_column=_require_sql_ident(
                os.environ.get("SR_GEN_DB_DATE_COLUMN") or "txn_date",
                "SR_GEN_DB_DATE_COLUMN",
            ),
            col_date=_require_sql_ident(
                os.environ.get("SR_GEN_DB_COL_DATE") or "txn_date",
                "SR_GEN_DB_COL_DATE",
            ),
            col_response_code=_require_sql_ident(
                os.environ.get("SR_GEN_DB_COL_RESPONSE_CODE") or "response_code",
                "SR_GEN_DB_COL_RESPONSE_CODE",
            ),
            col_response_code_desc=_require_sql_ident(
                os.environ.get("SR_GEN_DB_COL_RESPONSE_CODE_DESC")
                or "response_code_desc",
                "SR_GEN_DB_COL_RESPONSE_CODE_DESC",
            ),
            col_error_type=_require_sql_ident(
                os.environ.get("SR_GEN_DB_COL_ERROR_TYPE") or "error_type",
                "SR_GEN_DB_COL_ERROR_TYPE",
            ),
            col_trx_count=_require_sql_ident(
                os.environ.get("SR_GEN_DB_COL_TRX_COUNT") or "trx_count",
                "SR_GEN_DB_COL_TRX_COUNT",
            ),
            col_trx_feature=_require_sql_ident(
                os.environ.get("SR_GEN_DB_COL_TRX_FEATURE") or "trx_feature",
                "SR_GEN_DB_COL_TRX_FEATURE",
            ),
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
            mapping_slug=(os.environ.get("SR_GEN_DB_MAPPING_SLUG") or "default").strip(),
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
