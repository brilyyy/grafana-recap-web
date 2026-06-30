from __future__ import annotations

import colorsys
import random
from collections import defaultdict
from collections.abc import Callable
from datetime import date, datetime, timedelta

from bptx._models import TableData
from lib.data_processing import AppMapping, TransactionRecord
from lib.utils import format_date_range_list

_TABLE_HEADERS_SE = [
    "No",
    "Fitur/Service",
    "RC",
    "#Error",
    "% SE/BE",
    "% Trx",
    "Notes",
    "Status",
    "Target TL",
]
_TABLE_HEADERS_BE = [
    "No",
    "Fitur/Service",
    "RC",
    "#Error",
    "% SE/BE",
    "% Trx",
    "Notes",
]
_TABLE_PAGE_SIZE = 5


def get_distinct_colors(n: int) -> list[str]:
    if n <= 0:
        return []
    colors: list[str] = []
    hue_step = 1.0 / n
    for i in range(n):
        hue = i * hue_step
        lightness = 0.5
        saturation = 0.8
        rgb = colorsys.hls_to_rgb(hue, lightness, saturation)
        colors.append("#%02x%02x%02x" % tuple(int(x * 255) for x in rgb))
    random.shuffle(colors)
    return colors


def get_latest_four_weeks_period(dates: list[date]) -> list[list[date]]:
    parsed_dates = [
        datetime.strptime(d, "%Y-%m-%d").date() if isinstance(d, str) else d
        for d in dates
    ]
    latest_date = max(parsed_dates)
    current_mon = latest_date - timedelta(days=latest_date.weekday())

    all_weeks: list[list[date]] = []
    for i in range(4):
        this_mon = current_mon - timedelta(weeks=i)
        this_end = latest_date if i == 0 else this_mon + timedelta(days=6)

        week_dates: list[date] = []
        current_step = this_mon
        while current_step <= this_end:
            week_dates.append(current_step)
            current_step += timedelta(days=1)

        all_weeks.append(week_dates)
    all_weeks.reverse()
    return all_weeks


def table_aggregate_error_key(mapping: AppMapping, r: TransactionRecord) -> str:
    """Key for RC tables: ``RC | feature`` or ``RC | description`` (when no feature column)."""
    if mapping.fields.get("trx_feature"):
        return f"{r.response_code} | {r.trx_feature or '-'}"
    desc = (r.response_code_desc or "").strip()
    return f"{str(r.response_code).strip()} | {desc}"


def aggregate_by_period(
    records: list[TransactionRecord],
    mapping: AppMapping,
    predicate: Callable[[TransactionRecord, AppMapping], bool],
) -> tuple[list[str], dict[str, list[int]]]:
    period_ranges = mapping.weekly_periods
    period_date_sets = [
        {from_d + timedelta(days=i) for i in range((to_d - from_d).days + 1)}
        for from_d, to_d in period_ranges
    ]
    period_labels = [
        format_date_range_list(list(date_set)) for date_set in period_date_sets
    ]

    has_feature = bool(mapping.fields.get("trx_feature"))

    counts: dict[str, list[int]] = {}
    for r in records:
        if not predicate(r, mapping):
            continue
        if has_feature:
            key = f"{r.response_code} | {r.trx_feature or '-'}"
        else:
            key = f"{r.response_code} | {r.response_code_desc}"
        if key not in counts:
            counts[key] = [0] * len(period_ranges)
        for i, date_set in enumerate(period_date_sets):
            if r.date in date_set:
                counts[key][i] += r.trx_count
                break

    return period_labels, counts


def aggregate_by_period_v2(
    records: list[TransactionRecord],
    mapping: AppMapping,
    predicate: Callable[[TransactionRecord, AppMapping], bool],
    top_n: int = 5,
    *,
    error_key: Callable[[TransactionRecord], str] | None = None,
) -> dict[str, dict[str, int]]:
    """Aggregate by weekly period. Keys are ``format_date_range_list`` labels (chronological).

    Ranks **top_n** error keys by ``trx_count`` in the **latest** week only, then for those
    keys only, sums ``trx_count`` into **every** period where the transaction date falls
    (full history for the same key). Return shape:
    ``{ period_label: { error_key: count } }``.

    Default keys are **response_code only** (trimmed) for stable trend lines. Pass
    ``error_key=...`` (e.g. :func:`table_aggregate_error_key`) for table-style keys.
    """
    period_ranges = mapping.weekly_periods
    if not period_ranges:
        return {}

    period_date_sets = [
        {from_d + timedelta(days=i) for i in range((to_d - from_d).days + 1)}
        for from_d, to_d in period_ranges
    ]
    period_labels = [format_date_range_list(list(ds)) for ds in period_date_sets]

    def _error_key(r: TransactionRecord) -> str:
        if error_key is not None:
            return error_key(r)
        return str(r.response_code).strip()

    latest_dates = period_date_sets[-1]
    latest_counts: dict[str, int] = defaultdict(int)
    for r in records:
        if not predicate(r, mapping):
            continue
        if r.date in latest_dates:
            latest_counts[_error_key(r)] += r.trx_count

    top_keys = [
        k
        for k, _ in sorted(latest_counts.items(), key=lambda kv: kv[1], reverse=True)[
            :top_n
        ]
    ]
    if not top_keys:
        return {}

    out: dict[str, dict[str, int]] = {
        pl: {k: 0 for k in top_keys} for pl in period_labels
    }

    # Second pass: all periods — attribute each matching row to exactly one period bucket.
    top_set = set(top_keys)
    for r in records:
        if not predicate(r, mapping):
            continue
        key = _error_key(r)
        if key not in top_set:
            continue
        for pl, date_set in zip(period_labels, period_date_sets):
            if r.date in date_set:
                out[pl][key] += r.trx_count
                break

    return out


def get_table_pages(
    records: list[TransactionRecord], mapping: AppMapping
) -> tuple[list[TableData], TableData]:
    has_feature = bool(mapping.fields.get("trx_feature"))

    def _parse_key(key: str) -> tuple[str, str]:
        parts = key.split(" | ", 1)
        if len(parts) != 2:
            return key.strip(), ""
        rc, second = parts[0].strip(), parts[1].strip()
        if has_feature:
            return rc, "" if second == "-" else second
        return rc, second

    def _key_fn(r: TransactionRecord) -> str:
        return table_aggregate_error_key(mapping, r)

    total_trx = sum(r.trx_count for r in records)

    def _top_entries(
        predicate: Callable[[TransactionRecord, AppMapping], bool], n: int
    ) -> list[tuple[tuple[str, str], int]]:
        period_labels, agg = aggregate_by_period(
            records,
            mapping,
            predicate,
        )
        if not period_labels or not agg:
            return []
        latest_idx = len(period_labels) - 1
        out: list[tuple[tuple[str, str], int]] = []
        for k, values in sorted(
            agg.items(), key=lambda kv: kv[1][latest_idx], reverse=True
        ):
            count = values[latest_idx]
            if count < 1:
                continue
            out.append((_parse_key(k), count))
        return out[:n]

    def _make_page(
        entries: list[tuple[tuple[str, str], int]],
        offset: int,
        total_category: int,
        headers: list[str],
    ) -> TableData:
        n_extra = len(headers) - 6
        empty_row = [""] * len(headers)
        rows = [
            [
                str(offset + i + 1),
                feat,
                f"RC {rc}",
                f"{count:,}",
                f"{count / total_category * 100:.2f}%" if total_category else "0.00%",
                f"{count / total_trx * 100:.4f}%" if total_trx else "0.0000%",
                *[""] * n_extra,
            ]
            for i, ((rc, feat), count) in enumerate(entries)
        ]
        while len(rows) < _TABLE_PAGE_SIZE:
            rows.append(list(empty_row))
        return TableData(headers=headers, rows=rows)

    se_entries = _top_entries(TransactionRecord.is_system_error, 15)
    se_total = sum(c for _, c in se_entries)
    se_pages: list[TableData] = []
    for page_start in range(0, max(len(se_entries), 1), _TABLE_PAGE_SIZE):
        if len(se_pages) == 3:
            break
        se_pages.append(
            _make_page(
                se_entries[page_start : page_start + _TABLE_PAGE_SIZE],
                page_start,
                se_total,
                _TABLE_HEADERS_SE,
            )
        )

    be_entries = _top_entries(TransactionRecord.is_business_error, 5)
    be_total = sum(c for _, c in be_entries)
    be_page = _make_page(be_entries, 0, be_total, _TABLE_HEADERS_BE)

    return se_pages, be_page
