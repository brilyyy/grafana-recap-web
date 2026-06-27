"""Derive download basename for generated reports (matches CLI / API naming)."""

from __future__ import annotations

import re
from pathlib import Path

from lib.data_processing import AppMapping, TransactionRecord, read_excel
from lib.utils import format_date_range_auto


def sanitize_for_filename(text: str) -> str:
    s = text.replace(" - ", "-").replace(" ", "_")
    return re.sub(r"[^\w\-.]", "", s)


def report_pptx_basename_for_preloaded(
    mapping_path: Path, preloaded: list[TransactionRecord]
) -> str:
    """Basename after the same ignore + ``date_range`` pipeline as ``process_template``."""
    mapping = AppMapping.from_file(mapping_path)
    all_records = list(preloaded)
    if mapping.ignore_errors or mapping.ignore_features:
        all_records = [r for r in all_records if not r.is_ignored(mapping)]
    records = mapping.filter_by_date(all_records)
    if not records:
        return f"SuccessRate_{sanitize_for_filename(mapping.name)}_no_data.pptx"
    date_str = format_date_range_auto([r.date for r in records])
    return (
        f"SuccessRate_{sanitize_for_filename(mapping.name)}_"
        f"{sanitize_for_filename(date_str)}.pptx"
    )


def report_pptx_basename_for_preloaded_with_app(
    *,
    mapping_path: Path,
    preloaded: list[TransactionRecord],
    app_name: str,
) -> str:
    """DB/API filename: include both app name and mapping name."""
    mapping = AppMapping.from_file(mapping_path)
    all_records = list(preloaded)
    if mapping.ignore_errors or mapping.ignore_features:
        all_records = [r for r in all_records if not r.is_ignored(mapping)]
    records = mapping.filter_by_date(all_records)
    if not records:
        return (
            f"SuccessRate_{sanitize_for_filename(app_name)}_"
            f"{sanitize_for_filename(mapping.name)}_no_data.pptx"
        )
    date_str = format_date_range_auto([r.date for r in records])
    return (
        f"SuccessRate_{sanitize_for_filename(app_name)}_"
        f"{sanitize_for_filename(mapping.name)}_"
        f"{sanitize_for_filename(date_str)}.pptx"
    )


def report_pptx_basename(mapping_path: Path, xlsx_path: Path) -> str:
    """Return e.g. ``SuccessRate_MyApp_1-31_Mar_2026.pptx`` using filtered record dates."""
    mapping = AppMapping.from_file(mapping_path)
    all_records = read_excel(xlsx_path, mapping)
    if mapping.ignore_errors or mapping.ignore_features:
        all_records = [r for r in all_records if not r.is_ignored(mapping)]
    records = mapping.filter_by_date(all_records)
    if not records:
        return f"SuccessRate_{sanitize_for_filename(mapping.name)}_no_data.pptx"
    date_str = format_date_range_auto([r.date for r in records])
    return (
        f"SuccessRate_{sanitize_for_filename(mapping.name)}_"
        f"{sanitize_for_filename(date_str)}.pptx"
    )
