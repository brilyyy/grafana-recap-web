from __future__ import annotations

import json
import unittest
from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile

from bptx._models import TableData
from lib.data_processing import AppMapping, TransactionRecord
from lib.report_helpers import (
    aggregate_by_period,
    aggregate_by_period_v2,
    get_distinct_colors,
    get_latest_four_weeks_period,
    get_table_pages,
    table_aggregate_error_key,
)


_WEEKLY_MAPPING_JSON = {
    "name": "Test",
    "success_type_format": ["A"],
    "error_type_format": {
        "system_error": ["S"],
        "business_error": ["N"],
    },
    "fields": {
        "date": "D",
        "response_code": "RC",
        "response_code_desc": "RCD",
        "error_type": "ET",
        "trx_count": "C",
        "trx_feature": "F",
    },
    "weekly_periods": [
        {"from": "2026-04-01", "to": "2026-04-07"},
        {"from": "2026-04-08", "to": "2026-04-14"},
        {"from": "2026-04-15", "to": "2026-04-21"},
    ],
}

_MAPPING_WITHOUT_FEATURE_JSON = {
    "name": "NoFeat",
    "success_type_format": ["A"],
    "error_type_format": {
        "system_error": ["S"],
        "business_error": ["N"],
    },
    "fields": {
        "date": "D",
        "response_code": "RC",
        "response_code_desc": "RCD",
        "error_type": "ET",
        "trx_count": "C",
    },
    "weekly_periods": [
        {"from": "2026-04-01", "to": "2026-04-07"},
        {"from": "2026-04-08", "to": "2026-04-14"},
    ],
}


def _make_mapping(data: dict) -> AppMapping:
    with NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(data, f)
        f.flush()
        m = AppMapping.from_file(f.name)
    Path(f.name).unlink(missing_ok=True)
    return m


def _record(
    d: str, rc: str, desc: str, et: str, count: int, feat: str | None = None
) -> TransactionRecord:
    return TransactionRecord(
        date=date.fromisoformat(d),
        response_code=rc,
        response_code_desc=desc,
        error_type=et,
        trx_count=count,
        trx_feature=feat,
    )


class TestGetDistinctColors(unittest.TestCase):
    def test_returns_correct_count(self) -> None:
        colors = get_distinct_colors(5)
        self.assertEqual(len(colors), 5)

    def test_all_are_valid_hex(self) -> None:
        colors = get_distinct_colors(10)
        for c in colors:
            self.assertTrue(c.startswith("#"), f"Not a hex color: {c}")
            self.assertEqual(len(c), 7)

    def test_returns_empty_for_zero(self) -> None:
        self.assertEqual(get_distinct_colors(0), [])

    def test_single_color(self) -> None:
        colors = get_distinct_colors(1)
        self.assertEqual(len(colors), 1)


class TestTableAggregateErrorKey(unittest.TestCase):
    def setUp(self) -> None:
        self.mapping = _make_mapping(_WEEKLY_MAPPING_JSON)

    def test_with_feature(self) -> None:
        r = _record("2026-04-01", "99", "Timeout", "S", 1, "TRANSFER")
        key = table_aggregate_error_key(self.mapping, r)
        self.assertIn("99", key)
        self.assertIn("TRANSFER", key)

    def test_without_feature_uses_desc(self) -> None:
        mapping = _make_mapping(_MAPPING_WITHOUT_FEATURE_JSON)
        r = _record("2026-04-01", "99", "Timeout", "S", 1, None)
        key = table_aggregate_error_key(mapping, r)
        self.assertIn("99", key)
        self.assertIn("Timeout", key)


class TestAggregateByPeriod(unittest.TestCase):
    def setUp(self) -> None:
        self.mapping = _make_mapping(_WEEKLY_MAPPING_JSON)

    def test_basic_aggregation(self) -> None:
        records = [
            _record("2026-04-01", "99", "Timeout", "S", 5, "TRANSFER"),
        ]
        labels, counts = aggregate_by_period(
            records, self.mapping, TransactionRecord.is_system_error
        )
        self.assertEqual(len(labels), 3)
        self.assertIn("99 | TRANSFER", counts)
        self.assertEqual(counts["99 | TRANSFER"][0], 5)

    def test_empty_records_returns_labels(self) -> None:
        labels, counts = aggregate_by_period(
            [], self.mapping, TransactionRecord.is_system_error
        )
        self.assertEqual(len(labels), 3)
        self.assertEqual(counts, {})

    def test_record_outside_all_periods_has_zero_counts(self) -> None:
        records = [
            _record("2025-01-01", "99", "Timeout", "S", 5, "TRANSFER"),
        ]
        labels, counts = aggregate_by_period(
            records, self.mapping, TransactionRecord.is_system_error
        )
        self.assertEqual(len(labels), 3)
        self.assertIn("99 | TRANSFER", counts)
        self.assertEqual(counts["99 | TRANSFER"], [0, 0, 0])


class TestAggregateByPeriodV2(unittest.TestCase):
    def setUp(self) -> None:
        self.mapping = _make_mapping(_WEEKLY_MAPPING_JSON)

    def test_top_n_only_for_latest_period(self) -> None:
        records = [
            _record("2026-04-01", "99", "Timeout", "S", 10, None),
            _record("2026-04-01", "98", "Other", "S", 1, None),
            _record("2026-04-15", "99", "Timeout", "S", 5, None),
            _record("2026-04-16", "98", "Other", "S", 20, None),
        ]
        result = aggregate_by_period_v2(
            records, self.mapping, TransactionRecord.is_system_error, top_n=2
        )
        # period labels present
        self.assertIn(list(result.keys())[0], result)
        # top 2: in latest period (2026-04-15 to 2026-04-21), "98" has 20, "99" has 5
        period_labels = list(result.keys())
        latest = result[period_labels[-1]]
        self.assertIn("98", latest)
        self.assertIn("99", latest)
        self.assertEqual(latest["98"], 20)
        self.assertEqual(latest["99"], 5)

    def test_empty_records(self) -> None:
        result = aggregate_by_period_v2(
            [], self.mapping, TransactionRecord.is_system_error
        )
        self.assertEqual(result, {})

    def test_no_matching_records(self) -> None:
        records = [
            _record("2026-04-01", "00", "OK", "A", 10, None),
        ]
        result = aggregate_by_period_v2(
            records, self.mapping, TransactionRecord.is_system_error
        )
        self.assertEqual(result, {})


class TestGetLatestFourWeeksPeriod(unittest.TestCase):
    def test_returns_four_weeks(self) -> None:
        dates = [date(2026, 4, 20), date(2026, 4, 21), date(2026, 4, 22)]
        weeks = get_latest_four_weeks_period(dates)
        self.assertEqual(len(weeks), 4)

    def test_each_week_has_seven_days(self) -> None:
        dates = [date(2026, 4, 22)]
        weeks = get_latest_four_weeks_period(dates)
        for w in weeks:
            self.assertLessEqual(len(w), 7)


class TestGetTablePages(unittest.TestCase):
    def setUp(self) -> None:
        self.mapping = _make_mapping(_WEEKLY_MAPPING_JSON)

    def test_se_pages_and_be_page_are_table_data(self) -> None:
        records = [
            _record("2026-04-01", "99", "Timeout", "S", 5, "TRANSFER"),
            _record("2026-04-01", "01", "Insufficient", "N", 3, "TRANSFER"),
        ]
        se_pages, be_page = get_table_pages(records, self.mapping)
        self.assertIsInstance(be_page, TableData)
        for page in se_pages:
            self.assertIsInstance(page, TableData)

    def test_empty_records_returns_empty_tables(self) -> None:
        se_pages, be_page = get_table_pages([], self.mapping)
        self.assertIsInstance(se_pages, list)
        self.assertIsInstance(be_page, TableData)

    def test_se_pages_limit_is_three(self) -> None:
        records = [
            _record(f"2026-04-{d:02d}", "99", "Timeout", "S", 5, f"FEAT{i}")
            for i, d in enumerate(range(1, 20), start=1)
        ]
        se_pages, _ = get_table_pages(records, self.mapping)
        self.assertLessEqual(len(se_pages), 3)


if __name__ == "__main__":
    unittest.main()
