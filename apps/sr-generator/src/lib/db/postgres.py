"""Postgres reads for DB-backed API routes."""

from __future__ import annotations

import csv
import os
from collections.abc import Mapping
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

from psycopg import sql
from psycopg.rows import dict_row

from lib.data_processing import TransactionRecord
from lib.jumphost_db_settings import DatabaseSettings
from lib.utils import is_dev


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _mock_enabled() -> bool:
    return is_dev()


def _mock_app_identifier_csv() -> Path:
    return Path(
        os.environ.get("SR_GEN_MOCK_APP_IDENTIFIER_CSV")
        or (_repo_root() / "data" / "examples" / "app_identifier_202604281040.csv")
    )


def _mock_success_rate_csv() -> Path:
    return Path(
        os.environ.get("SR_GEN_MOCK_SUCCESS_RATE_CSV")
        or (_repo_root() / "data" / "examples" / "app_success_rate_202604302151.csv")
    )


@lru_cache(maxsize=1)
def _load_mock_apps() -> list[dict[str, str]]:
    path = _mock_app_identifier_csv()
    out: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            app_id = str(row.get("id") or "").strip()
            app_name = str(row.get("app_name") or "").strip()
            if app_id:
                out.append({"app_id": app_id, "app_name": app_name})
    return out


def _normalize_mock_fact_row(row: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = dict(row)
    # aliases so defaults also work in mock mode
    if "txn_date" not in out and "tanggal_transaksi" in out:
        out["txn_date"] = out["tanggal_transaksi"]
    if "response_code" not in out and "rc" in out:
        out["response_code"] = out["rc"]
    if "response_code_desc" not in out and "rc_description" in out:
        out["response_code_desc"] = out["rc_description"]
    if "trx_count" not in out and "total_transaksi" in out:
        out["trx_count"] = out["total_transaksi"]
    if "trx_feature" not in out and "jenis_transaksi" in out:
        out["trx_feature"] = out["jenis_transaksi"]
    return out


@lru_cache(maxsize=1)
def _load_mock_facts() -> list[dict[str, Any]]:
    path = _mock_success_rate_csv()
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(_normalize_mock_fact_row({k: str(v or "") for k, v in row.items()}))
    return rows


def _connect(settings: DatabaseSettings):
    import psycopg

    return psycopg.connect(settings.database_url, connect_timeout=30)


def list_app_ids(settings: DatabaseSettings) -> list[str]:
    """App ids as strings for JSON.

    Prefer ``SR_GEN_DB_APP_LIST_TABLE`` (e.g. ``app_identifier``) so we do not scan
    the fact table for DISTINCT. Otherwise falls back to DISTINCT on the fact table.
    """
    if _mock_enabled():
        return [a["app_id"] for a in _load_mock_apps()]
    if settings.app_list_table:
        q = sql.SQL("SELECT CAST({col} AS text) FROM {tbl} ORDER BY 1").format(
            col=sql.Identifier(settings.app_list_id_column),
            tbl=sql.Identifier(settings.app_list_table),
        )
    else:
        q = sql.SQL(
            "SELECT DISTINCT {aid} AS v FROM {tbl} ORDER BY 1"
        ).format(
            aid=sql.Identifier(settings.app_id_column),
            tbl=sql.Identifier(settings.table),
        )
    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(q)
            rows = cur.fetchall()
    return [str(r[0]) for r in rows if r[0] is not None]


def list_apps(settings: DatabaseSettings) -> list[dict[str, str]]:
    """List (app_id, app_name) pairs for UI selection.

    Requires SR_GEN_DB_APP_LIST_TABLE to be set (e.g. app_identifier).
    """
    if _mock_enabled():
        return _load_mock_apps()
    if not settings.app_list_table:
        raise ValueError("SR_GEN_DB_APP_LIST_TABLE must be set to list apps.")
    q = sql.SQL(
        "SELECT CAST({id_col} AS text) AS app_id, CAST({name_col} AS text) AS app_name "
        "FROM {tbl} ORDER BY 1"
    ).format(
        id_col=sql.Identifier(settings.app_list_id_column),
        name_col=sql.Identifier(settings.app_list_name_column),
        tbl=sql.Identifier(settings.app_list_table),
    )
    with _connect(settings) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(q)
            rows = cur.fetchall()
    out: list[dict[str, str]] = []
    for r in rows:
        app_id = r.get("app_id")
        app_name = r.get("app_name")
        if app_id is None:
            continue
        out.append({"app_id": str(app_id), "app_name": str(app_name or "")})
    return out


def get_app_name(settings: DatabaseSettings, app_id: str) -> str | None:
    """Lookup app_name by app_id from the app list (dimension) table."""
    if _mock_enabled():
        for app in _load_mock_apps():
            if app["app_id"] == str(app_id):
                return app["app_name"] or None
        return None
    if not settings.app_list_table:
        return None
    q = sql.SQL(
        "SELECT CAST({name_col} AS text) AS app_name FROM {tbl} "
        "WHERE CAST({id_col} AS text) = %s LIMIT 1"
    ).format(
        name_col=sql.Identifier(settings.app_list_name_column),
        tbl=sql.Identifier(settings.app_list_table),
        id_col=sql.Identifier(settings.app_list_id_column),
    )
    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(q, (str(app_id),))
            row = cur.fetchone()
    if not row:
        return None
    return str(row[0] or "") or None


def _row_to_record(row: Mapping[str, Any], settings: DatabaseSettings) -> TransactionRecord:
    d = row[settings.col_date]
    if hasattr(d, "date"):
        d = d.date()
    elif isinstance(d, str):
        d = date.fromisoformat(d.strip())
    feat = row.get(settings.col_trx_feature)
    return TransactionRecord(
        date=d,
        response_code=str(row[settings.col_response_code] or "none"),
        response_code_desc=str(row[settings.col_response_code_desc] or "none"),
        error_type=str(row[settings.col_error_type] or "none"),
        trx_count=int(row[settings.col_trx_count] or 0),
        trx_feature=None if feat is None or str(feat).strip() == "" else str(feat).strip(),
    )


def fetch_transaction_records_master_window(
    settings: DatabaseSettings,
    app_id: str,
    *,
    range_start: date,
    range_end_exclusive: date,
) -> list[TransactionRecord]:
    """Load rows for one app inside a half-open date window ``[range_start, range_end_exclusive)``.

    Use calendar-month or custom inclusive bounds by computing ``range_end_exclusive``
    as the day after the last inclusive day.
    """
    if _mock_enabled():
        app_id_s = str(app_id)
        out: list[TransactionRecord] = []
        for row in _load_mock_facts():
            row_app_id = str(row.get(settings.app_id_column) or row.get("id_app_identifier") or "").strip()
            if row_app_id != app_id_s:
                continue
            raw_date = str(row.get(settings.date_column) or row.get("tanggal_transaksi") or "").strip()
            if not raw_date:
                continue
            d = date.fromisoformat(raw_date)
            if d < range_start or d >= range_end_exclusive:
                continue
            out.append(_row_to_record(row, settings))
        out.sort(key=lambda r: r.date)
        return out

    cols = [
        settings.col_date,
        settings.col_response_code,
        settings.col_response_code_desc,
        settings.col_error_type,
        settings.col_trx_count,
        settings.col_trx_feature,
    ]
    select_list = sql.SQL(", ").join(sql.Identifier(c) for c in cols)
    q = sql.SQL(
        "SELECT {fields} FROM {tbl} WHERE {aid} = %s "
        "AND {dcol} >= %s AND {dcol} < %s ORDER BY {dcol}"
    ).format(
        fields=select_list,
        tbl=sql.Identifier(settings.table),
        aid=sql.Identifier(settings.app_id_column),
        dcol=sql.Identifier(settings.date_column),
    )
    with _connect(settings) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(q, (app_id, range_start, range_end_exclusive))
            rows = cur.fetchall()
    return [_row_to_record(r, settings) for r in rows]


def month_half_open(report_month: str) -> tuple[date, date]:
    """Parse ``YYYY-MM`` → ``(first_day, first_day_of_next_month)``."""
    parts = report_month.strip().split("-")
    if len(parts) != 2:
        raise ValueError("report_month must be YYYY-MM")
    y, m = int(parts[0]), int(parts[1])
    if not (1 <= m <= 12):
        raise ValueError("report_month month must be 01–12")
    start = date(y, m, 1)
    if m == 12:
        end_ex = date(y + 1, 1, 1)
    else:
        end_ex = date(y, m + 1, 1)
    return start, end_ex


def inclusive_range_half_open(fetch_from: date, fetch_to: date) -> tuple[date, date]:
    if fetch_to < fetch_from:
        raise ValueError("fetch_date_to must be >= fetch_date_from")
    return fetch_from, fetch_to + timedelta(days=1)
