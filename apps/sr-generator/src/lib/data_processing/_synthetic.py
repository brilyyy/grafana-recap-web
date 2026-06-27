from __future__ import annotations

import csv
import json
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date as date_type
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..logging import get_logger
from ._excel import _is_blank
from ._mapping import _coerce_date

log = get_logger(__name__)

_COMMA_NUMBER_RE = re.compile(r"^[\d,]+$")


def is_synthetic_mapping_path(path: str | Path) -> bool:
    return Path(path).name.endswith(".synthetic.mapping.json")


@dataclass(frozen=True)
class SyntheticAppMapping:
    """Mapping for synthetic monitoring exports (per-run rows, not aggregated trx).

    ``failed_statuses``: if non-empty, only those statuses are system errors (else any
    non-success non-BE failure counts). ``skipped_statuses``: dropped via ``is_ignored``.
    ``features_durations_ms_only``: for these feature names, ``form_duration_ms`` and
    ``inquiry_duration_ms`` are forced to 0; only ``duration_ms`` is used.

    Optional ``fields`` entry ``trx_date`` maps a sheet column (e.g. business/ledger date).
    When present and parseable, :attr:`SyntheticRunRecord.date` uses it; otherwise
    ``start_time.date()`` is used.
    """

    name: str
    fields: dict[str, str]  # internal_name -> source column header
    ignore_errors: list[str] = field(default_factory=list)
    ignore_features: list[str] = field(default_factory=list)
    core_fields: list[str] = field(
        default_factory=lambda: ["run_id", "start_time", "status"]
    )
    success_statuses: list[str] = field(
        default_factory=lambda: ["success", "ok", "passed", "pass", "1", "true"]
    )
    failed_statuses: list[str] = field(default_factory=list)
    skipped_statuses: list[str] = field(default_factory=list)
    business_error_statuses: list[str] = field(default_factory=list)
    date_range: Optional[tuple[Optional[date_type], Optional[date_type]]] = None
    weekly_periods: list[tuple[date_type, date_type]] = field(default_factory=list)
    features_durations_ms_only: list[str] = field(default_factory=list)
    run_id_fallback_column: Optional[str] = None
    """If set, use this sheet column when ``run_id`` is blank (e.g. ``id``)."""

    def is_success(self, r: SyntheticRunRecord) -> bool:
        st = r.status.strip().lower()
        return st in {x.lower() for x in self.success_statuses}

    def is_business_error(self, r: SyntheticRunRecord) -> bool:
        if self.is_success(r):
            return False
        st = r.status.strip().lower()
        bus = {x.lower() for x in self.business_error_statuses}
        return bool(bus) and st in bus

    def is_system_error(self, r: SyntheticRunRecord) -> bool:
        if self.is_success(r):
            return False
        if self.is_business_error(r):
            return False
        st = r.status.strip().lower()
        failed_set = {x.lower() for x in self.failed_statuses}
        if failed_set:
            return st in failed_set
        return True

    def filter_by_date(
        self, records: list[SyntheticRunRecord]
    ) -> list[SyntheticRunRecord]:
        if not self.date_range:
            return records
        from_date, to_date = self.date_range
        return [
            r
            for r in records
            if (from_date is None or r.date >= from_date)
            and (to_date is None or r.date <= to_date)
        ]

    def is_skipped(self, r: SyntheticRunRecord) -> bool:
        if not self.skipped_statuses:
            return False
        st = r.status.strip().lower()
        return st in {x.lower() for x in self.skipped_statuses}

    @classmethod
    def from_file(cls, path: str | Path) -> SyntheticAppMapping:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        date_range: Optional[tuple[Optional[date_type], Optional[date_type]]] = None
        dr = data.get("date_range")
        if dr:
            date_range = (
                _coerce_date(dr["from"]) if "from" in dr else None,
                _coerce_date(dr["to"]) if "to" in dr else None,
            )

        weekly_periods: list[tuple[date_type, date_type]] = [
            (_coerce_date(p["from"]), _coerce_date(p["to"]))
            for p in data.get("weekly_periods", [])
        ]

        return cls(
            name=data["name"],
            fields=data["fields"],
            ignore_errors=data.get("ignore_errors", []),
            ignore_features=data.get("ignore_features", []),
            core_fields=data.get(
                "core_fields",
                ["run_id", "start_time", "status"],
            ),
            success_statuses=data.get(
                "success_statuses",
                ["success", "ok", "passed", "pass", "1", "true"],
            ),
            failed_statuses=data.get("failed_statuses", []),
            skipped_statuses=data.get("skipped_statuses", []),
            business_error_statuses=data.get("business_error_statuses", []),
            date_range=date_range,
            weekly_periods=weekly_periods,
            features_durations_ms_only=data.get("features_durations_ms_only", []),
            run_id_fallback_column=data.get("run_id_fallback_column"),
        )


@dataclass(frozen=True)
class SyntheticRunRecord:
    run_id: str
    status: str
    message: str
    start_time: datetime
    end_time: datetime
    duration_ms: int
    feature_name: str | None
    form_duration_ms: int | None
    inquiry_duration_ms: int | None
    action_date: date_type | None = None
    """Parsed from mapping ``fields.trx_date`` when set; see :meth:`date`."""

    @property
    def date(self) -> date_type:
        if self.action_date is not None:
            return self.action_date
        return self.start_time.date()

    def is_ignored(self, mapping: SyntheticAppMapping) -> bool:
        ignore_err = {v.lower() for v in mapping.ignore_errors}
        if ignore_err and (
            self.status.lower() in ignore_err or self.message.lower() in ignore_err
        ):
            return True
        ignore_feat = {v.lower() for v in mapping.ignore_features}
        if ignore_feat and (self.feature_name or "").lower() in ignore_feat:
            return True
        if mapping.is_skipped(self):
            return True
        return False


def _parse_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date_type):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        v = value.strip()
        if not v:
            return None
        for fmt in (
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y",
        ):
            try:
                return datetime.strptime(v, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _parse_trx_date(value: object, row_num: int) -> date_type | None:
    """Parse calendar date for optional ``trx_date`` column (date, datetime, str, Excel serial)."""
    if _is_blank(value):
        return None
    if isinstance(value, date_type):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, (int, float)):
        try:
            from openpyxl.utils.datetime import from_excel

            return from_excel(value, epoch="windows").date()
        except Exception:
            pass
    dt = _parse_datetime(value)
    if dt is not None:
        return dt.date()
    try:
        return _coerce_date(value)
    except (ValueError, TypeError):
        log.debug("Row %d — unparseable trx_date: %r", row_num, value)
        return None


def _parse_optional_ms(value: object) -> int | None:
    if _is_blank(value):
        return None
    s = str(value).strip()
    if _COMMA_NUMBER_RE.match(s) and "," in s:
        return None
    try:
        return round(float(s))
    except ValueError:
        return None


def _parse_required_ms(value: object, row_num: int, field: str) -> int | None:
    v = _parse_optional_ms(value)
    if v is None and not _is_blank(value):
        log.debug("Row %d — bad %s: %r", row_num, field, value)
    return v


def _text(value: object, *, empty_as: str = "") -> str:
    if _is_blank(value):
        return empty_as
    return str(value).strip()


def read_synthetic_table(
    source_path: str | Path,
    mapping: SyntheticAppMapping,
    *,
    sheet: str | int | None = None,
    encoding: str = "utf-8",
) -> list[SyntheticRunRecord]:
    """
    Read CSV or XLSX where each row is one synthetic run.
    Column headers must match mapping.fields values (like read_excel).
    Optional ``fields.trx_date`` supplies the calendar date used for :attr:`SyntheticRunRecord.date`;
    if omitted or blank/unparseable, ``start_time.date()`` is used.
    """
    path = Path(source_path)
    if path.suffix.lower() == ".csv":
        return _read_synthetic_csv(path, mapping, encoding=encoding)
    return _read_synthetic_xlsx(path, mapping, sheet=sheet)


def _build_col_index(
    mapping: SyntheticAppMapping, header: list[str], path: Path
) -> dict[str, int]:
    col_index: dict[str, int] = {}
    for internal, src_col in mapping.fields.items():
        if not src_col:
            continue
        try:
            col_index[internal] = header.index(src_col)
        except ValueError as e:
            raise KeyError(
                f"Column {src_col!r} (field {internal!r}) not found in {path}. "
                f"Available: {header}"
            ) from e
    if mapping.run_id_fallback_column:
        try:
            col_index["__run_id_fallback"] = header.index(
                mapping.run_id_fallback_column
            )
        except ValueError as e:
            raise KeyError(
                f"run_id_fallback_column {mapping.run_id_fallback_column!r} not in {path}. "
                f"Available: {header}"
            ) from e
    return col_index


def _effective_run_id_raw(
    row: tuple,
    col_index: dict[str, int],
    get_fn: Callable[[str], object],
) -> object:
    v = get_fn("run_id")
    if not _is_blank(v):
        return v
    fb = col_index.get("__run_id_fallback")
    if fb is not None:
        v2 = row[fb]
        if not _is_blank(v2):
            return v2
    return None


def _row_to_record(
    row: tuple,
    col_index: dict[str, int],
    mapping: SyntheticAppMapping,
    core: set[str],
    row_num: int,
) -> SyntheticRunRecord | None:
    def get(field: str) -> object:
        if field not in col_index:
            return None
        return row[col_index[field]]

    start = _parse_datetime(get("start_time"))
    end = _parse_datetime(get("end_time"))
    if start is None:
        log.debug(
            "Row %d skipped — unparseable start_time: %r", row_num, get("start_time")
        )
        return None
    if end is None:
        end = start

    missing: list[str] = []
    for f in core:
        if f in ("start_time", "end_time"):
            continue
        if f == "run_id":
            if _is_blank(_effective_run_id_raw(row, col_index, get)):
                missing.append("run_id")
            continue
        if f in col_index and _is_blank(get(f)):
            missing.append(f)
    if "start_time" in core and start is None:
        missing.append("start_time")

    if missing:
        log.debug(
            "Row %d skipped — missing core field(s): %s",
            row_num,
            ", ".join(missing),
        )
        return None

    duration = _parse_required_ms(get("duration_ms"), row_num, "duration_ms")
    if duration is None:
        duration = int((end - start).total_seconds() * 1000)

    raw_feat = get("feature_name")
    feature = None if _is_blank(raw_feat) else str(raw_feat).strip()

    form_ms = _parse_optional_ms(get("form_duration_ms"))
    inq_ms = _parse_optional_ms(get("inquiry_duration_ms"))
    ms_only = {
        x.lower().strip() for x in mapping.features_durations_ms_only if str(x).strip()
    }
    if feature and feature.lower() in ms_only:
        form_ms = 0
        inq_ms = 0

    trx_d: date_type | None = None
    if "trx_date" in col_index:
        trx_d = _parse_trx_date(get("trx_date"), row_num)

    return SyntheticRunRecord(
        run_id=_text(_effective_run_id_raw(row, col_index, get), empty_as="-"),
        status=_text(get("status"), empty_as="-"),
        message=_text(get("message"), empty_as="-"),
        start_time=start,
        end_time=end,
        duration_ms=duration,
        feature_name=feature,
        form_duration_ms=form_ms,
        inquiry_duration_ms=inq_ms,
        action_date=trx_d,
    )


def _read_synthetic_xlsx(
    path: Path,
    mapping: SyntheticAppMapping,
    *,
    sheet: str | int | None,
) -> list[SyntheticRunRecord]:
    import openpyxl

    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    try:
        ws = (
            wb[sheet]
            if isinstance(sheet, str)
            else (wb.worksheets[sheet] if isinstance(sheet, int) else wb.active)
        )
        assert ws is not None
        rows_iter = ws.iter_rows(values_only=True)
        header = [str(c).strip() if c is not None else "" for c in next(rows_iter)]
        col_index = _build_col_index(mapping, header, path)
        core = set(mapping.core_fields)
        out: list[SyntheticRunRecord] = []
        skipped = 0
        for row_num, row in enumerate(rows_iter, start=2):
            rec = _row_to_record(row, col_index, mapping, core, row_num)
            if rec is None:
                skipped += 1
                continue
            out.append(rec)
    finally:
        wb.close()

    if skipped:
        log.warning(
            "Skipped %d row(s) in %s — see DEBUG for details",
            skipped,
            path.name,
        )
    log.info("Read %d synthetic run(s) from %s", len(out), path.name)
    return out


def _read_synthetic_csv(
    path: Path,
    mapping: SyntheticAppMapping,
    *,
    encoding: str,
) -> list[SyntheticRunRecord]:
    with open(path, encoding=encoding, newline="") as f:
        reader = csv.reader(f)
        header = [c.strip() for c in next(reader)]
        col_index = _build_col_index(mapping, header, path)
        core = set(mapping.core_fields)
        out: list[SyntheticRunRecord] = []
        skipped = 0
        for row_num, row in enumerate(reader, start=2):
            cells = list(row)
            if len(cells) < len(header):
                cells.extend([""] * (len(header) - len(cells)))
            tup = tuple(cells[: len(header)])
            rec = _row_to_record(tup, col_index, mapping, core, row_num)
            if rec is None:
                skipped += 1
                continue
            out.append(rec)
    if skipped:
        log.warning(
            "Skipped %d row(s) in %s — see DEBUG for details",
            skipped,
            path.name,
        )
    log.info("Read %d synthetic run(s) from %s", len(out), path.name)
    return out
