from __future__ import annotations

import unittest
from datetime import date, datetime

from lib.data_processing._excel import _is_blank, _parse_count, _parse_date


class TestIsBlank(unittest.TestCase):
    def test_none_is_blank(self) -> None:
        self.assertTrue(_is_blank(None))

    def test_empty_string_is_blank(self) -> None:
        self.assertTrue(_is_blank(""))

    def test_whitespace_string_is_blank(self) -> None:
        self.assertTrue(_is_blank("   "))

    def test_non_empty_string_is_not_blank(self) -> None:
        self.assertFalse(_is_blank("hello"))

    def test_zero_is_not_blank(self) -> None:
        self.assertFalse(_is_blank(0))

    def test_false_is_not_blank(self) -> None:
        self.assertFalse(_is_blank(False))


class TestParseDate(unittest.TestCase):
    def test_iso_format(self) -> None:
        self.assertEqual(_parse_date("2026-04-01"), date(2026, 4, 1))

    def test_dmy_slash_format(self) -> None:
        self.assertEqual(_parse_date("01/04/2026"), date(2026, 4, 1))

    def test_mdy_slash_format(self) -> None:
        self.assertEqual(_parse_date("01/13/2026"), date(2026, 1, 13))

    def test_dmy_dash_format(self) -> None:
        self.assertEqual(_parse_date("01-04-2026"), date(2026, 4, 1))

    def test_datetime_object(self) -> None:
        self.assertEqual(_parse_date(datetime(2026, 4, 1, 10, 30)), date(2026, 4, 1))

    def test_date_object(self) -> None:
        self.assertEqual(_parse_date(date(2026, 4, 1)), date(2026, 4, 1))

    def test_invalid_string_returns_none(self) -> None:
        self.assertIsNone(_parse_date("not-a-date"))

    def test_empty_string_returns_none(self) -> None:
        self.assertIsNone(_parse_date(""))

    def test_none_returns_none(self) -> None:
        self.assertIsNone(_parse_date(None))

    def test_whitespace_string_returns_none(self) -> None:
        self.assertIsNone(_parse_date("   "))


class TestParseCount(unittest.TestCase):
    def test_integer(self) -> None:
        self.assertEqual(_parse_count(100), 100)

    def test_float_string(self) -> None:
        self.assertEqual(_parse_count("100.0"), 100)

    def test_rounded(self) -> None:
        self.assertEqual(_parse_count("99.7"), 100)

    def test_blank_defaults_to_zero(self) -> None:
        self.assertEqual(_parse_count(""), 0)

    def test_none_defaults_to_zero(self) -> None:
        self.assertEqual(_parse_count(None), 0)

    def test_comma_number_returns_none(self) -> None:
        self.assertIsNone(_parse_count("1,234"))

    def test_invalid_string_returns_none(self) -> None:
        self.assertIsNone(_parse_count("abc"))

    def test_zero(self) -> None:
        self.assertEqual(_parse_count(0), 0)

    def test_whitespace_string_defaults_to_zero(self) -> None:
        self.assertEqual(_parse_count("   "), 0)


if __name__ == "__main__":
    unittest.main()
