from __future__ import annotations

import unittest
from datetime import date


class TestAutoRuntimeDateRangeForGenerateDate(unittest.TestCase):
    def test_day_one_uses_previous_full_month(self) -> None:
        from pipeline.db import (
            _auto_runtime_date_range_for_generate_date,
        )

        runtime_from, runtime_to = _auto_runtime_date_range_for_generate_date(
            generate_on=date(2026, 5, 1),
        )

        self.assertEqual(runtime_from, date(2026, 4, 1))
        self.assertEqual(runtime_to, date(2026, 4, 30))

    def test_day_less_than_six_spans_previous_month_start_to_today(self) -> None:
        from pipeline.db import (
            _auto_runtime_date_range_for_generate_date,
        )

        runtime_from, runtime_to = _auto_runtime_date_range_for_generate_date(
            generate_on=date(2026, 6, 5),
        )

        self.assertEqual(runtime_from, date(2026, 5, 1))
        self.assertEqual(runtime_to, date(2026, 6, 5))

    def test_day_six_or_more_uses_current_month_start_to_today(self) -> None:
        from pipeline.db import (
            _auto_runtime_date_range_for_generate_date,
        )

        runtime_from, runtime_to = _auto_runtime_date_range_for_generate_date(
            generate_on=date(2026, 6, 20),
        )

        self.assertEqual(runtime_from, date(2026, 6, 1))
        self.assertEqual(runtime_to, date(2026, 6, 20))


if __name__ == "__main__":
    unittest.main()
