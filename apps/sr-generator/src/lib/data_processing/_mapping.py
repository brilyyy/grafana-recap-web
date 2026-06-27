from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional

from ..logger import get_logger

log = get_logger(__name__)


def _coerce_date(v: object) -> date:
    return v if isinstance(v, date) else date.fromisoformat(str(v))


@dataclass(frozen=True)
class AppMapping:
    name: str
    fields: dict[str, str]  # internal_name -> excel_column_name
    success_type_format: list[
        str
    ]  # error_type values that count as success (e.g. ["A"])
    error_type_format: dict[
        str, list[str]
    ]  # semantic_name -> excel_values (e.g. "system_error" -> ["SE"])
    core_fields: list[str] = field(
        default_factory=lambda: [
            "date",
            "error_type",
            "trx_count",
            "response_code",
            "response_code_desc",
        ]
    )  # fields that must be non-null; rows missing any are skipped
    ignore_errors: list[str] = field(
        default_factory=list
    )  # response_code or response_code_desc to exclude
    ignore_features: list[str] = field(
        default_factory=list
    )  # trx_feature values to exclude
    date_range: Optional[tuple[Optional[date], Optional[date]]] = (
        None  # (from, to) inclusive; None = no limit
    )
    weekly_periods: list[tuple[date, date]] = field(
        default_factory=list
    )  # explicit week ranges for top-RC charts; empty = auto-derive

    @classmethod
    def from_file(cls, path: str | Path) -> AppMapping:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        date_range: Optional[tuple[Optional[date], Optional[date]]] = None
        dr = data.get("date_range")
        if dr:
            date_range = (
                _coerce_date(dr["from"]) if "from" in dr else None,
                _coerce_date(dr["to"]) if "to" in dr else None,
            )

        weekly_periods: list[tuple[date, date]] = [
            (_coerce_date(p["from"]), _coerce_date(p["to"]))
            for p in data.get("weekly_periods", [])
        ]

        mapping = cls(
            name=data["name"],
            fields=data["fields"],
            success_type_format=data["success_type_format"],
            error_type_format=data["error_type_format"],
            core_fields=data.get(
                "core_fields",
                [
                    "date",
                    "error_type",
                    "trx_count",
                    "response_code",
                    "response_code_desc",
                ],
            ),
            ignore_errors=data.get("ignore_errors", []),
            ignore_features=data.get("ignore_features", []),
            date_range=date_range,
            weekly_periods=weekly_periods,
        )
        mapping._validate_weekly_periods()
        return mapping

    def _validate_weekly_periods(self) -> None:
        """Warn if any weekly_period falls outside date_range."""
        if not self.weekly_periods or not self.date_range:
            return
        dr_from, dr_to = self.date_range
        for p_from, p_to in self.weekly_periods:
            if dr_from is not None and p_to < dr_from:
                log.warning(
                    "[%s] weekly_period %s–%s is entirely before date_range start %s — will produce empty chart columns",
                    self.name,
                    p_from,
                    p_to,
                    dr_from,
                )
            elif dr_to is not None and p_from > dr_to:
                log.warning(
                    "[%s] weekly_period %s–%s is entirely after date_range end %s — will produce empty chart columns",
                    self.name,
                    p_from,
                    p_to,
                    dr_to,
                )
            elif (dr_from is not None and p_from < dr_from) or (
                dr_to is not None and p_to > dr_to
            ):
                log.warning(
                    "[%s] weekly_period %s–%s partially overlaps date_range %s–%s — some dates may have no data",
                    self.name,
                    p_from,
                    p_to,
                    dr_from,
                    dr_to,
                )

    def filter_by_date(self, records: list) -> list:
        """Return records within date_range. If date_range is None, returns all records."""
        if not self.date_range:
            return records
        from_date, to_date = self.date_range
        return [
            r
            for r in records
            if (from_date is None or r.date >= from_date)
            and (to_date is None or r.date <= to_date)
        ]

    def excel_col(self, field: str) -> str:
        """Return the Excel column name for an internal field name."""
        return self.fields[field]
