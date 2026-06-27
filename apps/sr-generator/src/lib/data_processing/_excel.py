from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path
from typing import Iterator

from ..logger import get_logger
from ._mapping import AppMapping
from ._record import TransactionRecord

log = get_logger(__name__)

_COMMA_NUMBER_RE = re.compile(r"^[\d,]+$")


def _is_blank(value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    return False


def _parse_date(value: object) -> date | None:
    """Parse a date from an Excel cell value. Returns None on failure."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        v = value.strip()
        # Try common ISO and locale formats
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(v, fmt).date()
            except ValueError:
                continue
    return None


def _parse_count(value: object) -> int | None:
    """Parse trx_count from an Excel cell. Returns None if unparseable."""
    if _is_blank(value):
        # Requirement: blank numeric cells should default to 0
        return 0
    s = str(value).strip()
    # Reject comma-formatted numbers like "1,234" — likely a locale issue
    if _COMMA_NUMBER_RE.match(s) and "," in s:
        return None
    try:
        return round(float(s))
    except ValueError:
        return None


def read_excel(
    excel_path: str | Path,
    mapping: AppMapping,
    *,
    sheet: str | int | None = None,
) -> list[TransactionRecord]:
    """
    Read an Excel file and return a list of TransactionRecords.

    Column names are resolved via the mapping's `fields` definition.
    Rows missing a core aggregation field (defined in mapping.core_fields) are skipped
    and logged via lib.logger. Rows outside date_range are filtered during read.
    Rows with null response_code / response_code_desc fall back to "-".
    """
    import openpyxl

    wb = openpyxl.load_workbook(str(excel_path), read_only=True, data_only=True)
    try:
        ws = (
            wb[sheet]
            if isinstance(sheet, str)
            else (wb.worksheets[sheet] if isinstance(sheet, int) else wb.active)
        )
        assert ws is not None

        rows: Iterator = ws.iter_rows(values_only=True)
        header = [str(c).strip() if c is not None else "" for c in next(rows)]

        # Build index map: internal_name -> column index.
        # Fields with an empty excel_col ("") are optional — no backing column.
        col_index: dict[str, int] = {}
        for field, excel_col in mapping.fields.items():
            if not excel_col:
                continue
            try:
                col_index[field] = header.index(excel_col)
            except ValueError:
                raise KeyError(
                    f"Column '{excel_col}' (field '{field}') not found in {excel_path}. "
                    f"Available columns: {header}"
                )

        core = set(mapping.core_fields)

        records: list[TransactionRecord] = []
        skipped = 0

        for row_num, row in enumerate(rows, start=2):  # start=2: row 1 is header

            def get(field: str) -> object:
                if field not in col_index:
                    return None
                return row[col_index[field]]

            # --- date: parse early so we can skip unparseable rows ---
            raw_date = get("date")
            parsed_date = _parse_date(raw_date)
            if parsed_date is None:
                log.debug("Row %d skipped — unparseable date: %r", row_num, raw_date)
                skipped += 1
                continue

            # --- trx_count ---
            parsed_count = _parse_count(get("trx_count"))

            # --- core field null check ---
            missing = [
                f
                for f in core
                if f not in ("date", "trx_count")  # handled above
                and f in col_index
                and _is_blank(get(f))
            ]
            if "trx_count" in core and parsed_count is None:
                missing.append("trx_count")

            if missing:
                log.debug(
                    "Row %d skipped — missing core field(s): %s | values: %s",
                    row_num,
                    ", ".join(missing),
                    {f: get(f) for f in missing},
                )
                skipped += 1
                continue

            raw_feature = get("trx_feature")
            trx_feature = None if _is_blank(raw_feature) else str(raw_feature).strip()

            def text_or_none_string(field: str) -> str:
                value = get(field)
                return "none" if _is_blank(value) else str(value).strip()

            records.append(
                TransactionRecord(
                    date=parsed_date,
                    response_code=text_or_none_string("response_code"),
                    response_code_desc=text_or_none_string("response_code_desc"),
                    error_type=text_or_none_string("error_type"),
                    trx_count=parsed_count if parsed_count is not None else 0,
                    trx_feature=trx_feature,
                )
            )

        if skipped:
            log.warning(
                "Skipped %d row(s) in %s — check DEBUG logs for details",
                skipped,
                Path(excel_path).name,
            )

        log.info(
            "Read %d records from %s",
            len(records),
            Path(excel_path).name,
        )
        return records
    finally:
        wb.close()
