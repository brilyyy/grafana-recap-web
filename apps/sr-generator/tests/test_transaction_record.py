from __future__ import annotations

import unittest
from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from lib.data_processing import AppMapping, TransactionRecord


_MAPPING_JSON = """
{
  "name": "TestApp",
  "success_type_format": ["Sukses", "A"],
  "error_type_format": {
    "system_error": ["S", "#N/A"],
    "business_error": ["N", "B"]
  },
  "fields": {
    "date": "Tanggal Transaksi",
    "response_code": "RC",
    "response_code_desc": "RC Description",
    "error_type": "Error Type",
    "trx_count": "Total Transaksi",
    "trx_feature": "Jenis Transaksi"
  },
  "ignore_errors": ["TIMEOUT", "REJECTED"],
  "ignore_features": ["OPENING_ACCOUNT", "EDEPOSITO_WITHDRAWAL"]
}
"""


def _make_mapping(**overrides: Any) -> AppMapping:
    import json

    data = json.loads(_MAPPING_JSON)
    data.update(overrides)
    with NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(data, f)
        f.flush()
        mapping = AppMapping.from_file(f.name)
    Path(f.name).unlink(missing_ok=True)
    return mapping


class TestTransactionRecordClassification(unittest.TestCase):
    def setUp(self) -> None:
        self.mapping = _make_mapping()
        self.record = TransactionRecord(
            date=date(2026, 5, 1),
            response_code="00",
            response_code_desc="Approved",
            error_type="A",
            trx_count=100,
            trx_feature="TRANSFER",
        )

    def test_is_success_matches_success_type(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "00", "OK", "Sukses", 10, None)
        self.assertTrue(r.is_success(self.mapping))

    def test_is_success_matches_abbreviated(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "00", "OK", "A", 10, None)
        self.assertTrue(r.is_success(self.mapping))

    def test_is_success_case_insensitive(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "00", "OK", "sukses", 10, None)
        self.assertTrue(r.is_success(self.mapping))

    def test_is_success_mismatch(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "00", "OK", "S", 10, None)
        self.assertFalse(r.is_success(self.mapping))

    def test_is_system_error_matches(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "99", "Timeout", "S", 5, None)
        self.assertTrue(r.is_system_error(self.mapping))

    def test_is_system_error_matches_na(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "99", "N/A", "#N/A", 5, None)
        self.assertTrue(r.is_system_error(self.mapping))

    def test_is_system_error_mismatch(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "99", "N/A", "N", 5, None)
        self.assertFalse(r.is_system_error(self.mapping))

    def test_is_business_error_matches(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "01", "Insufficient", "N", 5, None)
        self.assertTrue(r.is_business_error(self.mapping))

    def test_is_business_error_matches_b(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "01", "Insufficient", "B", 5, None)
        self.assertTrue(r.is_business_error(self.mapping))

    def test_is_business_error_mismatch(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "01", "Insufficient", "S", 5, None)
        self.assertFalse(r.is_business_error(self.mapping))

    def test_is_considered_success_includes_business_error(self) -> None:
        success_r = TransactionRecord(date(2026, 1, 1), "00", "OK", "A", 10, None)
        business_r = TransactionRecord(date(2026, 1, 1), "01", "N/A", "N", 5, None)
        system_r = TransactionRecord(date(2026, 1, 1), "99", "Err", "S", 5, None)
        self.assertTrue(success_r.is_considered_success(self.mapping))
        self.assertTrue(business_r.is_considered_success(self.mapping))
        self.assertFalse(system_r.is_considered_success(self.mapping))

    def test_is_ignored_by_error_code(self) -> None:
        r = TransactionRecord(
            date(2026, 1, 1), "TIMEOUT", "Connection timeout", "S", 1, None
        )
        self.assertTrue(r.is_ignored(self.mapping))

    def test_is_ignored_by_error_desc(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "99", "REJECTED", "S", 1, None)
        self.assertTrue(r.is_ignored(self.mapping))

    def test_is_ignored_by_feature(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "00", "OK", "A", 10, "OPENING_ACCOUNT")
        self.assertTrue(r.is_ignored(self.mapping))

    def test_is_not_ignored_when_no_match(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "00", "Approved", "A", 10, "TRANSFER")
        self.assertFalse(r.is_ignored(self.mapping))

    def test_has_feature_name_true(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "00", "OK", "A", 10, "TRANSFER")
        self.assertTrue(r.has_feature_name())

    def test_has_feature_name_false(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "00", "OK", "A", 10, None)
        self.assertFalse(r.has_feature_name())

    def test_no_error_type_format_still_works(self) -> None:
        mapping = _make_mapping(error_type_format={})
        r = TransactionRecord(date(2026, 1, 1), "00", "OK", "S", 10, None)
        self.assertFalse(r.is_system_error(mapping))
        self.assertFalse(r.is_business_error(mapping))

    def test_trx_count_zero(self) -> None:
        r = TransactionRecord(date(2026, 1, 1), "00", "OK", "A", 0, None)
        self.assertTrue(r.is_success(self.mapping))
        self.assertEqual(r.trx_count, 0)


if __name__ == "__main__":
    unittest.main()
