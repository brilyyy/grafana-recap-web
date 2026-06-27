from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path


@dataclass
class GenerateResult:
    app_name: str
    output_path: Path | None
    success: bool
    message: str


def _friday_start(d: date) -> date:
    delta = (d.weekday() - 4) % 7
    return d - timedelta(days=delta)


def _auto_weekly_periods_clamped(
    *,
    report_from: date,
    report_to: date,
    count: int = 5,
) -> list[dict[str, str]]:
    if report_from > report_to:
        raise ValueError("report_from must be on or before report_to")
    last_start = _friday_start(report_to)
    periods: list[tuple[date, date]] = []
    for i in range(count - 1, -1, -1):
        start = last_start - timedelta(days=7 * i)
        end = start + timedelta(days=6)
        if end < report_from or start > report_to:
            continue
        periods.append((start, end))
    return [{"from": p[0].isoformat(), "to": p[1].isoformat()} for p in periods]
