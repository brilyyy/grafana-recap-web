from __future__ import annotations

import io
import json
from contextlib import redirect_stdout
from datetime import datetime
from pathlib import Path
from typing import Any, cast

from bptx import template as bptx_template
from constants import TEMPLATE
from lib.logging import get_pipeline_logger
from pipeline.common import GenerateResult, _auto_weekly_periods_clamped
from lib.data_processing import AppMapping, read_excel
from lib.report_filename import sanitize_for_filename
from generators.template import process_template

log = get_pipeline_logger("generator.excel")


def generate_for_excel_mapping(
    *,
    app_name: str,
    mapping: dict[str, Any],
    excel_path: Path,
    output_root: Path,
) -> GenerateResult:
    full_log = ""
    try:
        mapping_obj = AppMapping.from_dict(mapping)
        all_records = read_excel(excel_path, mapping_obj)

        if mapping_obj.ignore_errors or mapping_obj.ignore_features:
            all_records = [r for r in all_records if not r.is_ignored(mapping_obj)]
        records = mapping_obj.filter_by_date(all_records)
        if not records:
            if mapping_obj.date_range:
                dr_from, dr_to = mapping_obj.date_range
                range_label = f"{dr_from or '-inf'}..{dr_to or '+inf'}"
                return GenerateResult(
                    app_name=app_name,
                    output_path=None,
                    success=False,
                    message=f"No data in Excel for {app_name} within date_range {range_label}.",
                )
            return GenerateResult(
                app_name=app_name,
                output_path=None,
                success=False,
                message=f"No data in Excel for {app_name}.",
            )
        data_from = min(r.date for r in records)
        data_to = max(r.date for r in records)
        if mapping_obj.date_range:
            dr_from, dr_to = mapping_obj.date_range
            report_from = dr_from or data_from
            report_to = dr_to or data_to
        else:
            report_from = data_from
            report_to = data_to
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
        base_mapping: dict[str, Any] = {
            "name": mapping.get("name", ""),
            "fields": mapping.get("fields") or {},
            "success_type_format": mapping.get("success_type_format") or ["Sukses"],
            "error_type_format": mapping.get("error_type_format") or {},
            "ignore_errors": mapping.get("ignore_errors") or [],
            "ignore_features": mapping.get("ignore_features") or [],
        }
        base_mapping["date_range"] = {
            "from": report_from.isoformat(),
            "to": report_to.isoformat(),
        }
        base_mapping["weekly_periods"] = weekly

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
            json.dumps(base_mapping, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        try:
            with bptx_template(TEMPLATE) as ppt:
                stdout_buf = io.StringIO()
                with redirect_stdout(stdout_buf):
                    process_template(
                        ppt,
                        mapping_path=tmp_mapping,
                        records_preloaded=all_records,
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

        log.info("Generated report from Excel for %s -> %s", app_name, out_path)
        if full_log:
            log.info("Full PPTX generator log for %s:\n%s", app_name, full_log)
        return GenerateResult(
            app_name=app_name,
            output_path=out_path,
            success=True,
            message=f"Generated {out_path.name}",
        )
    except Exception as exc:
        log.exception("Excel generate failed for app=%s", app_name)
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
