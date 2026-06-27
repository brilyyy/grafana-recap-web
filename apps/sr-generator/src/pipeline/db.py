from __future__ import annotations

import io
import json
from contextlib import redirect_stdout
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from bptx import template as bptx_template
from constants import TEMPLATE
from lib.logging import get_pipeline_logger
from pipeline.common import GenerateResult, _auto_weekly_periods_clamped
from lib.db.postgres import fetch_transaction_records_master_window, get_app_name
from lib.settings import DatabaseSettings
from lib.report_filename import sanitize_for_filename
from generators.template import process_template

log = get_pipeline_logger("generator.db")


def _as_str_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v) for v in value]


def _as_error_type_format(value: object) -> dict[str, list[str]] | None:
    if not isinstance(value, dict):
        return None
    out: dict[str, list[str]] = {}
    for key, raw in value.items():
        if not isinstance(key, str):
            continue
        out[key] = _as_str_list(raw)
    return out or None


def _auto_runtime_date_range_for_generate_date(
    *, generate_on: date
) -> tuple[date, date]:
    """Runtime range for GUI mode, derived from generation date only.

    Rules:
    - day == 1   -> previous full month
    - day < 6    -> previous month start -> generate_on
    - otherwise  -> current month start -> generate_on
    """
    if generate_on.day == 1:
        prev_last = generate_on - timedelta(days=1)
        return prev_last.replace(day=1), prev_last
    if generate_on.day < 6:
        prev_last = generate_on.replace(day=1) - timedelta(days=1)
        return prev_last.replace(day=1), generate_on
    return generate_on.replace(day=1), generate_on


def _parse_date_range(raw: dict[str, object]) -> tuple[date, date] | None:
    value = raw.get("date_range")
    if not isinstance(value, dict):
        return None
    from_raw = value.get("from")
    to_raw = value.get("to")
    if from_raw is None or to_raw is None:
        return None
    try:
        from_date = date.fromisoformat(str(from_raw))
        to_date = date.fromisoformat(str(to_raw))
    except ValueError:
        return None
    if to_date < from_date:
        return None
    return from_date, to_date


def _build_runtime_mapping(
    mapping: dict[str, Any], *, report_from: date, report_to: date
) -> dict:
    """Build the runtime mapping dict from the DB mapping row."""
    raw: dict[str, Any] = {
        "name": mapping.get("name", ""),
        "ignore_errors": _as_str_list(mapping.get("ignore_errors")),
        "ignore_features": _as_str_list(mapping.get("ignore_features")),
        "fields": dict(mapping.get("fields") or {}),
        "success_type_format": list(mapping.get("success_type_format") or ["Sukses"]),
        "error_type_format": (
            _as_error_type_format(mapping.get("error_type_format"))
            or {
                "system_error": ["S", "#N/A"],
                "business_error": ["N", "B"],
            }
        ),
    }
    weekly_raw = mapping.get("weekly_periods")
    weekly: list[dict[str, str]]
    if isinstance(weekly_raw, list) and weekly_raw:
        weekly = []
        for item in weekly_raw:
            if not isinstance(item, dict):
                continue
            item_map = cast(dict[str, object], item)
            from_v = item_map.get("from")
            to_v = item_map.get("to")
            if from_v is None or to_v is None:
                continue
            weekly.append({"from": str(from_v), "to": str(to_v)})
        if not weekly:
            weekly = _auto_weekly_periods_clamped(
                report_from=report_from, report_to=report_to
            )
    else:
        weekly = _auto_weekly_periods_clamped(
            report_from=report_from, report_to=report_to
        )
    raw["date_range"] = {"from": report_from.isoformat(), "to": report_to.isoformat()}
    raw["weekly_periods"] = weekly
    return raw


def generate_for_db_mapping(
    *,
    app_name: str,
    mapping: dict[str, Any],
    app_id: str,
    master_date_from: date,
    master_date_to: date,
    settings: DatabaseSettings,
    output_root: Path,
) -> GenerateResult:
    full_log = ""
    try:
        app_id_override = str(mapping.get("id_app_identifier") or "").strip()
        fetch_app_id = app_id_override or app_id
        fetch_from, fetch_to = master_date_from, master_date_to
        report_range = _parse_date_range(mapping)
        if report_range is not None:
            report_from, report_to = report_range
        else:
            report_from, report_to = _auto_runtime_date_range_for_generate_date(
                generate_on=date.today(),
            )
        runtime_mapping = _build_runtime_mapping(
            mapping,
            report_from=report_from,
            report_to=report_to,
        )
        range_end_exclusive = fetch_to + timedelta(days=1)
        fields = dict(mapping.get("fields") or {})
        records = fetch_transaction_records_master_window(
            settings,
            fetch_app_id,
            fields=fields,
            range_start=fetch_from,
            range_end_exclusive=range_end_exclusive,
        )
        if not records:
            return GenerateResult(
                app_name=app_name,
                output_path=None,
                success=False,
                message=f"No DB data for {app_name} in {fetch_from}..{fetch_to}.",
            )

        now = datetime.now()
        generated_date = now.date().isoformat()
        generated_hhmmss = now.strftime("%H%M%S")
        output_dir = output_root / "generated" / generated_date
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / (
            f"SuccessRate_{sanitize_for_filename(app_name)}_{generated_date}_{generated_hhmmss}.pptx"
        )

        tmp_mapping = (
            output_dir / f".{sanitize_for_filename(app_name)}_runtime_mapping.json"
        )
        tmp_mapping.write_text(
            json.dumps(runtime_mapping, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        try:
            with bptx_template(TEMPLATE) as ppt:
                stdout_buf = io.StringIO()
                with redirect_stdout(stdout_buf):
                    process_template(
                        ppt,
                        mapping_path=tmp_mapping,
                        records_preloaded=records,
                    )
                ppt.save(out_path)
                log_parts = [stdout_buf.getvalue().rstrip()]
                for result in ppt.log():
                    status = "OK" if result.success else "ERR"
                    log_parts.append(
                        f"  {status} [{result.operation}] {result.placeholder}: {result.message}"
                    )
                full_log = "\n".join(p for p in log_parts if p).strip()
        finally:
            tmp_mapping.unlink(missing_ok=True)

        resolved = get_app_name(settings, fetch_app_id) or app_name
        log.info("Generated report for %s -> %s", resolved, out_path)
        if full_log:
            log.info("Full PPTX generator log for %s:\n%s", resolved, full_log)
        return GenerateResult(
            app_name=app_name,
            output_path=out_path,
            success=True,
            message=f"Generated {out_path.name}",
        )
    except Exception as exc:
        log.exception("Generate failed for app=%s", app_name)
        if full_log:
            log.error(
                "Partial PPTX generator log for %s before failure:\n%s",
                app_name,
                full_log,
            )
        return GenerateResult(
            app_name=app_name,
            output_path=None,
            success=False,
            message=str(exc),
        )
