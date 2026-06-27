"""Fetch app_mappings from Postgres (same DB as web app)."""

from __future__ import annotations

import json
from typing import Any

from lib.db.postgres import _connect
from lib.settings import DatabaseSettings


def fetch_mapping(settings: DatabaseSettings, app_id: str) -> dict[str, Any] | None:
    """Fetch one mapping row from app_mappings + app_identifier by id_app_identifier.

    Returns dict matching the old JSON file structure:
        {"name", "id_app_identifier", "generate_from", "fields",
         "success_type_format", "error_type_format",
         "ignore_errors", "ignore_features"}
    """
    q = """
        SELECT
            ai.app_name,
            am.id_app_identifier,
            am.generate_from,
            am.fields,
            am.success_type_format,
            am.error_type_format,
            am.ignore_errors,
            am.ignore_features
        FROM app_mappings am
        JOIN app_identifier ai ON ai.id = am.id_app_identifier
        WHERE am.id_app_identifier = %s
        LIMIT 1
    """
    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(q, (app_id,))
            row = cur.fetchone()
    if not row:
        return None
    return _row_to_dict(row)


def fetch_mapping_by_name(settings: DatabaseSettings, app_name: str) -> dict[str, Any] | None:
    """Fetch mapping by app_name (case-insensitive)."""
    q = """
        SELECT
            ai.app_name,
            am.id_app_identifier,
            am.generate_from,
            am.fields,
            am.success_type_format,
            am.error_type_format,
            am.ignore_errors,
            am.ignore_features
        FROM app_mappings am
        JOIN app_identifier ai ON ai.id = am.id_app_identifier
        WHERE LOWER(ai.app_name) = LOWER(%s)
        LIMIT 1
    """
    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(q, (app_name,))
            row = cur.fetchone()
    if not row:
        return None
    return _row_to_dict(row)


def fetch_all_mappings(settings: DatabaseSettings) -> list[dict[str, Any]]:
    """List all mappings for the /apps/mappings endpoint."""
    q = """
        SELECT
            ai.app_name,
            am.id_app_identifier,
            am.generate_from,
            am.fields,
            am.success_type_format,
            am.error_type_format,
            am.ignore_errors,
            am.ignore_features
        FROM app_mappings am
        JOIN app_identifier ai ON ai.id = am.id_app_identifier
        ORDER BY ai.app_name
    """
    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(q)
            rows = cur.fetchall()
    return [_row_to_dict(r) for r in rows]


def _row_to_dict(row: tuple) -> dict[str, Any]:
    """Convert a DB row tuple to a dict matching the old JSON structure."""
    (
        app_name,
        id_app_identifier,
        generate_from,
        fields,
        success_type_format,
        error_type_format,
        ignore_errors,
        ignore_features,
    ) = row

    # psycopg returns JSON as str; parse it
    if isinstance(fields, str):
        fields = json.loads(fields)
    if isinstance(success_type_format, str):
        success_type_format = json.loads(success_type_format)
    if isinstance(error_type_format, str):
        error_type_format = json.loads(error_type_format)

    # ARRAY columns may come as Python lists or comma-separated strings
    if isinstance(ignore_errors, str):
        ignore_errors = [s.strip() for s in ignore_errors.strip('{}').split(',') if s.strip()] if ignore_errors.strip('{}') else []
    if isinstance(ignore_features, str):
        ignore_features = [s.strip() for s in ignore_features.strip('{}').split(',') if s.strip()] if ignore_features.strip('{}') else []

    return {
        "name": app_name,
        "id_app_identifier": str(id_app_identifier),
        "generate_from": generate_from or "db",
        "fields": fields or {},
        "success_type_format": success_type_format or ["Sukses"],
        "error_type_format": error_type_format or {
            "system_error": ["S", "#N/A"],
            "business_error": ["N", "B"],
        },
        "ignore_errors": ignore_errors or [],
        "ignore_features": ignore_features or [],
    }
