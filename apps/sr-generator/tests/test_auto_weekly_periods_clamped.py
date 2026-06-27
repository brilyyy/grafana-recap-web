from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from pipeline.common import _auto_weekly_periods_clamped  # noqa: E402


class TestAutoWeeklyPeriodsClamped(unittest.TestCase):
    def test_generates_five_full_weeks_overlapping_range(self) -> None:
        # report_to 2026-04-28 anchors to week starting Fri 2026-04-24; periods are
        # full Fri–Thu weeks that overlap the report range (not trimmed to range).
        out = _auto_weekly_periods_clamped(
            report_from=date(2026, 4, 1),
            report_to=date(2026, 4, 28),
            count=5,
        )
        self.assertEqual(
            out,
            [
                {"from": "2026-03-27", "to": "2026-04-02"},
                {"from": "2026-04-03", "to": "2026-04-09"},
                {"from": "2026-04-10", "to": "2026-04-16"},
                {"from": "2026-04-17", "to": "2026-04-23"},
                {"from": "2026-04-24", "to": "2026-04-30"},
            ],
        )

    def test_short_range_returns_overlapping_full_week(self) -> None:
        out = _auto_weekly_periods_clamped(
            report_from=date(2026, 4, 28),
            report_to=date(2026, 4, 28),
            count=5,
        )
        self.assertEqual(out, [{"from": "2026-04-24", "to": "2026-04-30"}])

    def test_invalid_range_raises(self) -> None:
        with self.assertRaises(ValueError):
            _auto_weekly_periods_clamped(
                report_from=date(2026, 4, 29),
                report_to=date(2026, 4, 28),
                count=5,
            )


if __name__ == "__main__":
    unittest.main()
