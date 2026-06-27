from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ._mapping import AppMapping


@dataclass(frozen=True)
class TransactionRecord:
    date: date
    response_code: str
    response_code_desc: str
    error_type: str  # raw value as stored in Excel (e.g. "A", "SE", "BE")
    trx_count: int
    trx_feature: str | None

    def is_ignored(self, mapping: AppMapping) -> bool:
        """True if this record matches ignore_errors or ignore_features."""
        ignore = {v.lower() for v in mapping.ignore_errors}
        if ignore and (
            self.response_code.lower() in ignore
            or self.response_code_desc.lower() in ignore
        ):
            return True
        ignore_feat = {v.lower() for v in mapping.ignore_features}
        if ignore_feat and (self.trx_feature or "").lower() in ignore_feat:
            return True
        return False

    def is_success(self, mapping: AppMapping) -> bool:
        et = self.error_type.lower()
        return et in [v.lower() for v in mapping.success_type_format]

    def is_system_error(self, mapping: AppMapping) -> bool:
        et = self.error_type.lower()
        return et in [v.lower() for v in (mapping.error_type_format.get("system_error") or [])]

    def is_business_error(self, mapping: AppMapping) -> bool:
        et = self.error_type.lower()
        return et in [v.lower() for v in (mapping.error_type_format.get("business_error") or [])]

    def is_considered_success(self, mapping: AppMapping) -> bool:
        """True if this record counts as success (either is_success or is_business_error)."""
        return self.is_success(mapping) or self.is_business_error(mapping)

    def has_feature_name(self) -> bool:
        return self.trx_feature is not None
