from __future__ import annotations

import json
import unittest
from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile

from lib.data_processing import AppMapping, TransactionRecord


_FULL_MAPPING = {
    "name": "Bale",
    "success_type_format": ["Sukses"],
    "fields": {
        "date": "Tanggal Transaksi",
        "response_code": "RC",
        "response_code_desc": "RC Description",
        "error_type": "Error Type",
        "trx_count": "Total Transaksi",
        "trx_feature": "Jenis Transaksi",
    },
    "error_type_format": {
        "system_error": ["S", "#N/A"],
        "business_error": ["N"],
    },
    "ignore_errors": ["TIMEOUT"],
    "ignore_features": ["OPENING_ACCOUNT"],
    "date_range": {"from": "2026-04-01", "to": "2026-04-24"},
    "weekly_periods": [
        {"from": "2026-03-27", "to": "2026-04-02"},
        {"from": "2026-04-03", "to": "2026-04-09"},
        {"from": "2026-04-10", "to": "2026-04-16"},
        {"from": "2026-04-17", "to": "2026-04-24"},
    ],
}


def _write_mapping(data: dict) -> str:
    with NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(data, f)
        f.flush()
        return f.name


class TestAppMappingFromFile(unittest.TestCase):
    def tearDown(self) -> None:
        for p in getattr(self, "_files", []):
            Path(p).unlink(missing_ok=True)

    def _mapping_path(self, data: dict) -> str:
        path = _write_mapping(data)
        self._files = getattr(self, "_files", []) + [path]
        return path

    def test_from_file_minimal(self) -> None:
        path = self._mapping_path(
            {
                "name": "Minimal",
                "success_type_format": ["A"],
                "error_type_format": {"system_error": ["S"]},
                "fields": {"date": "D", "response_code": "RC", "trx_count": "C"},
            }
        )
        m = AppMapping.from_file(path)
        self.assertEqual(m.name, "Minimal")
        self.assertEqual(m.success_type_format, ["A"])
        self.assertIsNone(m.date_range)
        self.assertEqual(m.weekly_periods, [])

    def test_from_file_full(self) -> None:
        path = self._mapping_path(_FULL_MAPPING)
        m = AppMapping.from_file(path)
        self.assertEqual(m.name, "Bale")
        self.assertEqual(m.success_type_format, ["Sukses"])
        self.assertEqual(m.ignore_errors, ["TIMEOUT"])
        self.assertEqual(m.ignore_features, ["OPENING_ACCOUNT"])
        self.assertEqual(m.date_range, (date(2026, 4, 1), date(2026, 4, 24)))
        self.assertEqual(len(m.weekly_periods), 4)

    def test_date_range_none_when_omitted(self) -> None:
        data = dict(_FULL_MAPPING)
        del data["date_range"]
        path = self._mapping_path(data)
        m = AppMapping.from_file(path)
        self.assertIsNone(m.date_range)

    def test_excel_col_lookup(self) -> None:
        path = self._mapping_path(_FULL_MAPPING)
        m = AppMapping.from_file(path)
        self.assertEqual(m.excel_col("date"), "Tanggal Transaksi")
        self.assertEqual(m.excel_col("trx_count"), "Total Transaksi")

    def test_core_fields_default(self) -> None:
        data = dict(_FULL_MAPPING)
        del data["weekly_periods"]
        path = self._mapping_path(data)
        m = AppMapping.from_file(path)
        self.assertIn("date", m.core_fields)
        self.assertIn("trx_count", m.core_fields)
        self.assertIn("error_type", m.core_fields)


class TestAppMappingFilterByDate(unittest.TestCase):
    def setUp(self) -> None:
        data = dict(_FULL_MAPPING)
        data["date_range"] = {"from": "2026-04-01", "to": "2026-04-10"}
        path = _write_mapping(data)
        self._path = path
        self.mapping = AppMapping.from_file(path)

    def tearDown(self) -> None:
        Path(self._path).unlink(missing_ok=True)

    def _record(self, d: str, rc: str = "00") -> TransactionRecord:
        return TransactionRecord(
            date=date.fromisoformat(d),
            response_code=rc,
            response_code_desc="desc",
            error_type="A",
            trx_count=1,
            trx_feature=None,
        )

    def test_filter_includes_records_in_range(self) -> None:
        records = [self._record("2026-04-05")]
        result = self.mapping.filter_by_date(records)
        self.assertEqual(len(result), 1)

    def test_filter_excludes_records_before_range(self) -> None:
        records = [self._record("2026-03-31")]
        result = self.mapping.filter_by_date(records)
        self.assertEqual(len(result), 0)

    def test_filter_excludes_records_after_range(self) -> None:
        records = [self._record("2026-04-11")]
        result = self.mapping.filter_by_date(records)
        self.assertEqual(len(result), 0)

    def test_filter_includes_boundary_dates(self) -> None:
        records = [
            self._record("2026-04-01"),
            self._record("2026-04-10"),
        ]
        result = self.mapping.filter_by_date(records)
        self.assertEqual(len(result), 2)

    def test_filter_no_date_range_returns_all(self) -> None:
        data = dict(_FULL_MAPPING)
        data.pop("date_range", None)
        del data["weekly_periods"]
        path = _write_mapping(data)
        m = AppMapping.from_file(path)
        Path(path).unlink(missing_ok=True)
        records = [self._record("2025-01-01"), self._record("2027-12-31")]
        self.assertEqual(len(m.filter_by_date(records)), 2)


if __name__ == "__main__":
    unittest.main()
