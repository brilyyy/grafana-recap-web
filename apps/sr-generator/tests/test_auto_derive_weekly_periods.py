from __future__ import annotations

import unittest
from datetime import date, timedelta

from lib.utils import auto_derive_weekly_periods
from lib.data_processing import AppMapping


_BASE_MAPPING = {
    "name": "TestApp",
    "success_type_format": ["Sukses"],
    "error_type_format": {"system_error": ["S"], "business_error": ["N"]},
    "fields": {
        "date": "D",
        "response_code": "RC",
        "response_code_desc": "RCD",
        "error_type": "ET",
        "trx_count": "C",
    },
}


class TestAutoDeriveWeeklyPeriods(unittest.TestCase):
    def test_default_params(self) -> None:
        today = date.today()
        result = auto_derive_weekly_periods()
        self.assertEqual(len(result), 5)
        self.assertEqual(result[-1][1], today - timedelta(days=1))

    def test_custom_n(self) -> None:
        result = auto_derive_weekly_periods(n=3, base=date(2026, 6, 29))
        self.assertEqual(len(result), 3)
        self.assertEqual(result[-1][1], date(2026, 6, 28))

    def test_custom_base(self) -> None:
        result = auto_derive_weekly_periods(n=2, base=date(2026, 6, 29))
        self.assertEqual(result, [
            (date(2026, 6, 15), date(2026, 6, 21)),
            (date(2026, 6, 22), date(2026, 6, 28)),
        ])

    def test_each_period_seven_days_inclusive(self) -> None:
        result = auto_derive_weekly_periods(n=4, base=date(2026, 6, 29))
        for p_from, p_to in result:
            self.assertEqual((p_to - p_from).days, 6)

    def test_periods_are_contiguous(self) -> None:
        result = auto_derive_weekly_periods(n=5, base=date(2026, 6, 29))
        for i in range(len(result) - 1):
            self.assertEqual(result[i][1] + timedelta(days=1), result[i + 1][0])

    def test_oldest_first(self) -> None:
        result = auto_derive_weekly_periods(n=5, base=date(2026, 6, 29))
        for i in range(len(result) - 1):
            self.assertLess(result[i][0], result[i + 1][0])
            self.assertLess(result[i][1], result[i + 1][1])

    def test_last_period_ends_at_base_minus_one(self) -> None:
        base = date(2026, 7, 15)
        result = auto_derive_weekly_periods(n=3, base=base)
        self.assertEqual(result[-1][1], base - timedelta(days=1))

    def test_n_zero_returns_empty_list(self) -> None:
        self.assertEqual(auto_derive_weekly_periods(n=0), [])

    def test_n_one(self) -> None:
        result = auto_derive_weekly_periods(n=1, base=date(2026, 6, 29))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0], (date(2026, 6, 22), date(2026, 6, 28)))

    def test_does_not_mutate_base(self) -> None:
        base = date(2026, 6, 29)
        auto_derive_weekly_periods(n=2, base=base)
        self.assertEqual(base, date(2026, 6, 29))


class TestAppMappingAutoDerive(unittest.TestCase):
    def test_empty_weekly_periods_auto_derives(self) -> None:
        mapping = AppMapping.from_dict({**_BASE_MAPPING})
        self.assertEqual(len(mapping.weekly_periods), 5)

    def test_explicit_empty_array_stays_empty(self) -> None:
        mapping = AppMapping.from_dict({**_BASE_MAPPING, "weekly_periods": []})
        self.assertEqual(len(mapping.weekly_periods), 5)

    def test_explicit_periods_not_overwritten(self) -> None:
        mapping = AppMapping.from_dict({
            **_BASE_MAPPING,
            "weekly_periods": [
                {"from": "2026-06-01", "to": "2026-06-07"},
                {"from": "2026-06-08", "to": "2026-06-14"},
            ],
        })
        self.assertEqual(len(mapping.weekly_periods), 2)
        self.assertEqual(mapping.weekly_periods[0], (date(2026, 6, 1), date(2026, 6, 7)))
        self.assertEqual(mapping.weekly_periods[1], (date(2026, 6, 8), date(2026, 6, 14)))

    def test_custom_count_in_dict(self) -> None:
        mapping = AppMapping.from_dict({**_BASE_MAPPING, "weekly_periods_count": 3})
        self.assertEqual(len(mapping.weekly_periods), 3)

    def test_auto_derived_periods_are_valid(self) -> None:
        today = date.today()
        mapping = AppMapping.from_dict({**_BASE_MAPPING})
        for p_from, p_to in mapping.weekly_periods:
            self.assertEqual((p_to - p_from).days, 6)
        self.assertLess(mapping.weekly_periods[0][0], mapping.weekly_periods[-1][1])
        self.assertEqual(mapping.weekly_periods[-1][1], today - timedelta(days=1))


if __name__ == "__main__":
    unittest.main()
