"""Synthetic monitoring report generation for PowerPoint.

The main entry point is :func:`process_synthetic_template`, which fills a BPTX
presentation with synthetic run data, charts, and tables.
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from bptx import BPTX, TableData, TableStyle, TextStyle, template
from constants import DATA_DIR
from lib.chart import save_fig as save
from lib.data_processing import (
    SyntheticAppMapping,
    SyntheticRunRecord,
    read_synthetic_table,
)
from lib.report_helpers import format_date_range_auto
from lib.utils import get_year_range, reopen_in_powerpoint, sanitize_for_filename

_PROJECT_ROOT = DATA_DIR.parent
_SYNTHETIC_OUT_DIR = _PROJECT_ROOT / "generated" / "synthetic"

# Charts and KPIs bucket by ``SyntheticRunRecord.date`` (``fields.trx_date`` when mapped).
_CHART_DATE_XLABEL = "Tanggal trx"

# Match ``template_synthetic_monitoring`` image placeholders (measured from .pptx).
_FEATURE_CHART_W_IN = 12.651
_FEATURE_CHART_H_IN = 2.972
_FEATURE_CHART_DPI = 256
_DAILY_SR_CHART_DPI = 200

# ``template_synthetic_monitoring``: ``tbl_feature_breakdown`` is header + 10 data rows, 9 cols.
_ACTION_TABLE_SHAPE = "tbl_feature_breakdown"
_ACTION_TABLE_DATA_ROWS = 10
_ACTION_BREAKDOWN_SLIDE_NUMS = (12, 13)  # 1-based; two pages of per-action stats
_ACTION_TABLE_HEADERS = [
    "Feature Name",
    "Total",
    "Success",
    "Failed",
    "Skipped",
    "SR%",
    "Form Duration (ms)",
    "Execution Duration (ms)",
    "Duration (s)",
]

# Last slide: ``tbl_top_10_failed_features`` is header + 10 data rows; template has 3 cols (spare).
_TOP_FAILED_TABLE_SHAPE = "tbl_top_10_failed_features"
_TOP_FAILED_SLIDE_NUM = 14
_TOP_FAILED_DATA_ROWS = 10
_TOP_FAILED_HEADERS = ["Feature Name", "Failed", ""]

# Table text limits so rows stay inside the slide placeholder (with word wrap).
_ACTION_NAME_DISPLAY_MAX = 26
_FEATURE_NAME_DISPLAY_MAX = 28

plt.rcParams.update(
    {
        "text.antialiased": True,
        "axes.labelweight": "medium",
        "figure.facecolor": "white",
    }
)


def _ellipsis_truncate(s: str, max_chars: int) -> str:
    t = (s or "").strip()
    if len(t) <= max_chars:
        return t
    if max_chars < 2:
        return "\u2026"[:max_chars]
    return t[: max_chars - 1] + "\u2026"


def _chart_daily_sr_action(
    records: list[SyntheticRunRecord],
    mapping: SyntheticAppMapping,
) -> bytes | Path:
    """Daily run count + SR line by ``r.date`` (trx_date column when present in mapping)."""
    daily_total: dict[date, int] = defaultdict(int)
    daily_non_se: dict[date, int] = defaultdict(int)
    for r in records:
        daily_total[r.date] += 1
        if not mapping.is_system_error(r):
            daily_non_se[r.date] += 1

    dates = sorted(daily_total)
    labels = [f"{d.day} {d.strftime('%b')}" for d in dates]
    totals = [float(daily_total[d]) for d in dates]
    sr_vals = [
        round(daily_non_se[d] / daily_total[d] * 100, 2) if daily_total[d] else 0.0
        for d in dates
    ]

    dpi = _DAILY_SR_CHART_DPI
    figsize = (12.52 * 2, 3.03 * 2)
    base_fontsize = figsize[0] * 1

    df = pd.DataFrame({"labels": labels, "totals": totals, "sr_vals": sr_vals})
    fig, ax1 = plt.subplots(figsize=figsize, dpi=dpi, facecolor="white")
    sns.barplot(x="labels", y="totals", data=df, ax=ax1, color="steelblue", width=0.6)
    ax1.set_ylabel("Total Runs", color="steelblue", fontsize=base_fontsize * 0.8)
    ymax = max(totals) if totals else 1.0
    ax1.set_ylim(0, ymax * 2)
    ax1.spines["top"].set_visible(False)
    ax1.spines["left"].set_visible(False)
    ax1.grid(False)

    for i, v in enumerate(totals):
        ax1.text(
            i,
            v + ymax * 0.02,
            f"{v:,.0f}",
            color="black",
            horizontalalignment="left",
            fontsize=base_fontsize * 0.55,
            rotation=30,
        )
    ax2 = ax1.twinx()
    sns.lineplot(
        x="labels", y="sr_vals", data=df, ax=ax2, color="orangered", marker="o"
    )
    ax2.set_ylabel("Success Rate (%)", color="orangered", fontsize=base_fontsize * 0.8)
    ax2.set_ylim(min(sr_vals) - 20 if sr_vals else 0, 100 * 1.05)
    ax2.spines["top"].set_visible(False)
    ax2.grid(False)
    for i, v in enumerate(sr_vals):
        ax2.text(
            i,
            v + 1,
            f"{v:.2f}%",
            color="black",
            horizontalalignment="left",
            fontsize=base_fontsize * 0.55,
            rotation=30,
        )
    ax1.set_xticks(range(len(labels)))
    ax1.set_xticklabels(labels, ha="center", fontsize=base_fontsize * 0.55)
    ax1.tick_params(axis="y", rotation=45, labelsize=base_fontsize * 0.55)
    ax2.tick_params(axis="y", rotation=45, labelsize=base_fontsize * 0.55)
    ax1.set_title("Daily Total Runs and Success Rate", fontsize=base_fontsize, y=1.1)
    ax1.set_xlabel(_CHART_DATE_XLABEL, fontsize=base_fontsize * 0.8)
    plt.tight_layout()
    return save(fig, dpi=dpi, output=None, tight=False)


def _sorted_distinct_features(records: list[SyntheticRunRecord]) -> list[str]:
    """Case-insensitive alphabetical order, stable for slide pairing."""
    names = {r.feature_name for r in records if r.feature_name}
    return sorted(names, key=lambda s: str(s).lower())


def _format_feature_title_text(raw: str | None) -> str:
    """Split snake_case on ``_`` and capitalize each segment (for chart/slide titles)."""
    if not raw or not str(raw).strip():
        return ""
    return " ".join(part.capitalize() for part in str(raw).split("_") if part)


def _synthetic_action_breakdown_rows(
    records: list[SyntheticRunRecord],
    mapping: SyntheticAppMapping,
) -> list[list[str]]:
    """One row per action; sorted by total runs descending, then name."""
    by_action: dict[str, list[SyntheticRunRecord]] = defaultdict(list)
    for r in records:
        name = (r.feature_name or "").strip()
        key = name if name else "\u2014"
        by_action[key].append(r)

    keyed: list[tuple[int, str, list[str]]] = []
    for action, subset in by_action.items():
        n = len(subset)
        ok = sum(1 for r in subset if mapping.is_success(r))
        skip = sum(1 for r in subset if mapping.is_skipped(r))
        fail = sum(
            1 for r in subset if not mapping.is_skipped(r) and not mapping.is_success(r)
        )
        exec_n = ok + fail
        sr_pct = f"{(ok / exec_n * 100):.2f}%" if exec_n else "\u2014"
        avg_form = round(sum((r.form_duration_ms or 0) for r in subset) / n) if n else 0
        avg_inq = (
            round(sum((r.inquiry_duration_ms or 0) for r in subset) / n) if n else 0
        )
        avg_dur_s = (
            round(sum(r.duration_ms for r in subset) / n / 1000, 2) if n else 0.0
        )
        keyed.append(
            (
                n,
                action.lower(),
                [
                    _ellipsis_truncate(action, _ACTION_NAME_DISPLAY_MAX),
                    str(n),
                    str(ok),
                    str(fail),
                    str(skip),
                    sr_pct,
                    str(avg_form),
                    str(avg_inq),
                    f"{avg_dur_s:.2f}",
                ],
            )
        )
    keyed.sort(key=lambda t: (-t[0], t[1]))
    return [row for _n, _k, row in keyed]


def _paginate_action_breakdown_tables(
    data_rows: list[list[str]],
) -> list[TableData]:
    """Split into fixed-size pages (pad with empty cells) for ``tbl_feature_breakdown``."""
    pages: list[TableData] = []
    empty_row = [""] * len(_ACTION_TABLE_HEADERS)
    for start in range(0, len(data_rows), _ACTION_TABLE_DATA_ROWS):
        chunk = data_rows[start : start + _ACTION_TABLE_DATA_ROWS]
        padded = chunk + [list(empty_row)] * (_ACTION_TABLE_DATA_ROWS - len(chunk))
        pages.append(TableData(headers=list(_ACTION_TABLE_HEADERS), rows=padded))
    return pages


def _top_failed_features_table(
    records: list[SyntheticRunRecord],
    mapping: SyntheticAppMapping,
) -> TableData:
    """Top 10 actions by failure count (highest first); only failed_n > 0."""
    by_action: dict[str, list[SyntheticRunRecord]] = defaultdict(list)
    for r in records:
        name = (r.feature_name or "").strip()
        key = name if name else "\u2014"
        by_action[key].append(r)

    scored: list[tuple[str, int]] = []
    for action, subset in by_action.items():
        failed_n = sum(
            1 for r in subset if not mapping.is_skipped(r) and not mapping.is_success(r)
        )
        if failed_n > 0:
            scored.append((action, failed_n))

    scored.sort(key=lambda x: (-x[1], x[0].lower()))
    top = scored[:_TOP_FAILED_DATA_ROWS]
    rows = [
        [_ellipsis_truncate(action, _FEATURE_NAME_DISPLAY_MAX), str(failed_n), ""]
        for action, failed_n in top
    ]
    pad = [""] * len(_TOP_FAILED_HEADERS)
    while len(rows) < _TOP_FAILED_DATA_ROWS:
        rows.append(list(pad))
    return TableData(headers=list(_TOP_FAILED_HEADERS), rows=rows)


def _empty_feature_chart() -> bytes | Path:
    fig, ax = plt.subplots(
        figsize=(_FEATURE_CHART_W_IN, _FEATURE_CHART_H_IN),
        dpi=_FEATURE_CHART_DPI,
    )
    ax.text(
        0.5,
        0.5,
        "No data",
        ha="center",
        va="center",
        transform=ax.transAxes,
        fontsize=20,
        color="#aaaaaa",
    )
    ax.axis("off")
    plt.tight_layout()
    return save(fig, dpi=_FEATURE_CHART_DPI, output=None, tight=False)


def _feature_timing_summary_line(
    subset: list[SyntheticRunRecord],
    mapping: SyntheticAppMapping,
    feature_name: str,
) -> tuple[int, int, str]:
    """Total runs, failed count, and timing line for chart footer."""
    total = len(subset)
    if total == 0:
        return 0, 0, ""
    failed = sum(1 for r in subset if not mapping.is_success(r))
    ms_only = feature_name.lower() in {
        x.lower().strip() for x in mapping.features_durations_ms_only if str(x).strip()
    }
    if ms_only:
        avg_d = sum(r.duration_ms for r in subset) / total / 1000
        return total, failed, f"Avg duration: {avg_d:.2f} s"

    sum_f = sum((r.form_duration_ms or 0) for r in subset)
    sum_i = sum((r.inquiry_duration_ms or 0) for r in subset)
    if sum_f == 0 and sum_i == 0:
        avg_d = sum(r.duration_ms for r in subset) / total / 1000
        return total, failed, f"Avg duration: {avg_d:.2f} s"

    avg_f = sum_f / total / 1000
    avg_i = sum_i / total / 1000
    return (
        total,
        failed,
        f"Avg form: {avg_f:.2f} s    Avg inquiry: {avg_i:.2f} s",
    )


def _chart_feature_breakdown(
    records: list[SyntheticRunRecord],
    mapping: SyntheticAppMapping,
    feature_name: str | None,
    *,
    chart_title: str,
) -> bytes | Path:
    """
    Per-feature panel bucketed by ``r.date`` (trx_date when mapped): (1) stacked daily
    success/failed + SR% line, (2) daily avg form/inquiry or duration, (3) footer totals.
    """
    if not feature_name:
        return _empty_feature_chart()

    subset = [r for r in records if r.feature_name == feature_name]
    if not subset:
        return _empty_feature_chart()

    by_date: dict[date, list[SyntheticRunRecord]] = defaultdict(list)
    for r in subset:
        by_date[r.date].append(r)

    dates = sorted(by_date.keys())
    labels = [f"{d.day} {d.strftime('%b')}" for d in dates]
    n = len(dates)
    x = list(range(n))

    daily_total = [len(by_date[d]) for d in dates]
    daily_ok = [sum(1 for r in by_date[d] if mapping.is_success(r)) for d in dates]
    daily_failed = [daily_total[i] - daily_ok[i] for i in range(n)]
    sr_vals = [
        round(daily_ok[i] / daily_total[i] * 100, 2) if daily_total[i] else 0.0
        for i in range(n)
    ]

    ms_only = feature_name.lower() in {
        x.lower().strip() for x in mapping.features_durations_ms_only if str(x).strip()
    }
    sum_f = sum((r.form_duration_ms or 0) for r in subset)
    sum_i = sum((r.inquiry_duration_ms or 0) for r in subset)
    use_duration_lines = ms_only or (sum_f == 0 and sum_i == 0)

    daily_dur_s: list[float] = []
    daily_form_s: list[float] = []
    daily_inq_s: list[float] = []
    for d in dates:
        rows = by_date[d]
        m = len(rows)
        if use_duration_lines:
            daily_dur_s.append(sum(r.duration_ms for r in rows) / m / 1000)
            daily_form_s.append(0.0)
            daily_inq_s.append(0.0)
        else:
            daily_form_s.append(sum((r.form_duration_ms or 0) for r in rows) / m / 1000)
            daily_inq_s.append(
                sum((r.inquiry_duration_ms or 0) for r in rows) / m / 1000
            )
            daily_dur_s.append(0.0)

    total_runs, failed_n, timing_line = _feature_timing_summary_line(
        subset, mapping, feature_name
    )
    summary = f"Total runs: {total_runs:,}    Failed: {failed_n:,}\n{timing_line}"

    base_fs = 7.25
    fig = plt.figure(
        figsize=(_FEATURE_CHART_W_IN, _FEATURE_CHART_H_IN),
        dpi=_FEATURE_CHART_DPI,
    )
    gs = fig.add_gridspec(
        3,
        1,
        height_ratios=[1.05, 0.62, 0.20],
        hspace=0.48,
        left=0.072,
        right=0.965,
        top=0.91,
        bottom=0.08,
    )
    ax1 = fig.add_subplot(gs[0])
    ax2 = fig.add_subplot(gs[1])
    ax_sum = fig.add_subplot(gs[2])

    fig.patch.set_facecolor("white")
    sns.set_style("white", {"font.family": ["Poppins"]})

    # --- Panel 1: stacked runs + SR% ---
    w = 0.62
    ax1.bar(x, daily_failed, width=w, label="Failed runs", color="#c0392b", zorder=2)
    ax1.bar(
        x,
        daily_ok,
        width=w,
        bottom=daily_failed,
        label="Success runs",
        color="#2980b9",
        zorder=2,
    )
    ax1.set_ylabel("Runs / day", color="#2c3e50", fontsize=base_fs * 0.95)
    ymax_r = max(daily_total) if daily_total else 1
    ax1.set_ylim(0, ymax_r * 1.22 if ymax_r else 1)
    ax1.spines["top"].set_visible(False)
    ax1.grid(False)
    ax1.tick_params(axis="y", labelsize=base_fs * 0.85)

    ax1r = ax1.twinx()
    ax1r.plot(
        x,
        sr_vals,
        color="orangered",
        marker="o",
        linewidth=2.0,
        markersize=5,
        label="SR %",
        zorder=4,
    )
    lo_sr = min(sr_vals) if sr_vals else 0.0
    hi_sr = max(sr_vals) if sr_vals else 100.0
    ax1r.set_ylim(max(0.0, lo_sr - 10.0), min(105.0, hi_sr + 10.0))
    ax1r.set_ylabel("SR %", color="orangered", fontsize=base_fs * 0.95)
    ax1r.spines["top"].set_visible(False)
    ax1r.tick_params(axis="y", labelsize=base_fs * 0.85)

    for i, v in enumerate(sr_vals):
        ax1r.annotate(
            f"{v:.1f}%",
            xy=(i, v),
            xytext=(3, 6),
            textcoords="offset points",
            fontsize=base_fs * 0.75,
            color="orangered",
        )

    ax1.set_xticks(x)
    ax1.set_xticklabels([])
    ax1.set_title(
        chart_title,
        fontsize=base_fs * 1.05,
        pad=3,
        fontweight="bold",
        color="#222222",
    )
    h1, l1 = ax1.get_legend_handles_labels()
    h2, l2 = ax1r.get_legend_handles_labels()
    ax1.legend(
        h1 + h2,
        l1 + l2,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.14),
        frameon=False,
        fontsize=base_fs * 0.72,
        ncol=3,
        columnspacing=0.65,
        handlelength=1.2,
    )

    # --- Panel 2: daily avg form / inq or duration ---
    ax2.set_facecolor("white")
    if use_duration_lines:
        ax2.plot(
            x,
            daily_dur_s,
            color="#8e44ad",
            marker="s",
            linewidth=1.8,
            markersize=4,
            label="Avg duration (s)",
        )
        ax2.set_ylabel("Seconds", fontsize=base_fs * 0.9)
    else:
        ax2.plot(
            x,
            daily_form_s,
            color="#16a085",
            marker="s",
            linewidth=1.8,
            markersize=4,
            label="Avg form (s)",
        )
        ax2.plot(
            x,
            daily_inq_s,
            color="#d35400",
            marker="^",
            linewidth=1.8,
            markersize=4,
            label="Avg inquiry (s)",
        )
        ax2.set_ylabel("Seconds", fontsize=base_fs * 0.9)
    ax2.set_xticks(x)
    ax2.set_xticklabels(labels, rotation=30, ha="right", fontsize=base_fs * 0.72)
    ax2.set_xlabel(_CHART_DATE_XLABEL, fontsize=base_fs * 0.72)
    ax2.spines["top"].set_visible(False)
    ax2.grid(True, axis="y", color="#eeeeee", linewidth=0.7)
    ax2.legend(
        loc="upper right",
        frameon=False,
        fontsize=base_fs * 0.68,
        ncol=2 if not use_duration_lines else 1,
        borderaxespad=0.2,
    )
    ax2.tick_params(axis="y", labelsize=base_fs * 0.85)

    # --- Footer ---
    ax_sum.axis("off")
    ax_sum.text(
        0.0,
        0.55,
        summary,
        ha="left",
        va="center",
        fontsize=base_fs * 0.82,
        color="#333333",
        transform=ax_sum.transAxes,
        linespacing=1.15,
    )

    return save(fig, dpi=_FEATURE_CHART_DPI, output=None, tight=False)


def process_synthetic_template(
    ppt: BPTX,
    *,
    mapping_path: Path,
    data_path: Path,
    records_preloaded: list[SyntheticRunRecord] | None = None,
) -> None:
    """Fill template_synthetic_monitoring.pptx with synthetic monitoring data."""
    mapping = SyntheticAppMapping.from_file(mapping_path)
    if records_preloaded is not None:
        raw = list(records_preloaded)
    else:
        raw = read_synthetic_table(data_path, mapping)

    dated = mapping.filter_by_date(raw)
    if dated is not raw:
        print(f"Date filter: {len(dated)}/{len(raw)} runs in mapping date_range.")

    total_run = len(dated)
    total_skipped = sum(1 for r in dated if mapping.is_skipped(r))

    if mapping.ignore_errors or mapping.ignore_features or mapping.skipped_statuses:
        before = len(dated)
        records = [r for r in dated if not r.is_ignored(mapping)]
        print(
            f"Ignored {before - len(records)} runs: "
            f"errors={mapping.ignore_errors} features={mapping.ignore_features} "
            f"skipped_statuses={mapping.skipped_statuses}"
        )
    else:
        records = list(dated)

    if not records:
        raise ValueError(
            "No synthetic runs left after date range, skip, and ignore filters."
        )

    total_exec = len([r for r in records if not mapping.is_skipped(r)])
    total_success = sum(
        1 for r in records if not mapping.is_skipped(r) and mapping.is_success(r)
    )
    total_failed = sum(
        1 for r in records if not mapping.is_skipped(r) and not mapping.is_success(r)
    )
    sr = total_success / total_exec if total_exec else 0.0
    avg_dur = (
        round(
            sum(r.duration_ms for r in records if not mapping.is_skipped(r))
            / 1000
            / total_exec,
            2,
        )
        if total_exec
        else 0.0
    )

    daily_total: dict[date, int] = defaultdict(int)
    daily_success: dict[date, int] = defaultdict(int)
    for r in records:
        d = r.date
        daily_total[d] += 1
        if mapping.is_success(r):
            daily_success[d] += 1

    trx_avg = total_exec // len(daily_total) if daily_total else 0
    h_trx_date = max(daily_total, key=lambda d: daily_total[d])
    daily_sr: dict[date, float] = {
        d: daily_success[d] / daily_total[d] for d in daily_total if daily_total[d]
    }
    h_sr_date = max(daily_sr, key=lambda d: daily_sr[d])
    l_sr_date = min(daily_sr, key=lambda d: daily_sr[d])
    date_range = format_date_range_auto([r.date for r in records])
    period_label = format_date_range_auto(
        [min(r.date for r in records), max(r.date for r in records)]
    )

    def fmt_date(d: date) -> str:
        return f"{d.day} {d.strftime('%b %Y')}"

    # Slide 1
    ppt.replace_text_on_slide(1, "{{year}}", get_year_range([r.date for r in records]))

    # Slide 2
    ppt.replace_text_on_slide(2, "{{title}}", mapping.name)

    # Slide 3
    ppt.replace_text_on_slide(
        3, "{{date_range}}", format_date_range_auto([r.date for r in records])
    )

    # Slide 4
    ppt.replace_text_on_slide(
        4,
        "{{title}}",
        f"{mapping.name} SyntheticPerformance & Success Rate {date_range}",
    )
    ppt.replace_text_on_slide(4, "{{total_run}}", f"{total_run:,}")
    ppt.replace_text_on_slide(4, "{{total_skipped}}", f"{total_skipped:,}")
    ppt.replace_text_on_slide(4, "{{total_exec}}", f"{total_exec:,}")
    ppt.replace_text_on_slide(4, "{{total_success}}", f"{total_success:,}")
    ppt.replace_text_on_slide(4, "{{total_failed}}", f"{total_failed:,}")
    ppt.replace_text_on_slide(4, "{{sr}}", f"{sr:.2%}")
    ppt.replace_text_on_slide(4, "{{trx_avg}}", f"{trx_avg:,}")
    ppt.replace_text_on_slide(4, "{{avg_dur}}", f"{avg_dur:.2f} s")
    ppt.replace_text_on_slide(4, "{{h_trx}}", f"{daily_total[h_trx_date]:,}")
    ppt.replace_text_on_slide(4, "{{h_trx_date}}", fmt_date(h_trx_date))
    ppt.replace_text_on_slide(4, "{{h_sr}}", f"{daily_sr[h_sr_date]:.2%}")
    ppt.replace_text_on_slide(4, "{{h_sr_date}}", fmt_date(h_sr_date))
    ppt.replace_text_on_slide(4, "{{l_sr}}", f"{daily_sr[l_sr_date]:.2%}")
    ppt.replace_text_on_slide(4, "{{l_sr_date}}", fmt_date(l_sr_date))
    ppt.replace_image_on_slide(
        4,
        "img_dialy_sr_run",
        _chart_daily_sr_action(records, mapping),
    )

    # Slides 5–11 — two features per slide (charts); features sorted (case-insensitive)
    distinct_features = _sorted_distinct_features(records)
    feature_pairs: list[tuple[str | None, str | None]] = []
    for i in range(0, 14, 2):
        f1 = distinct_features[i] if i < len(distinct_features) else None
        f2 = distinct_features[i + 1] if i + 1 < len(distinct_features) else None
        feature_pairs.append((f1, f2))
    while len(feature_pairs) < 7:
        feature_pairs.append((None, None))
    feature_pairs = feature_pairs[:7]

    for i, (f1, f2) in enumerate(feature_pairs):
        slide_num = 5 + i
        label_bits = [_format_feature_title_text(x) for x in (f1, f2) if x]
        label = " \u00b7 ".join(label_bits) if label_bits else "\u2014"
        ppt.replace_text_on_slide(slide_num, "{{features_name}}", label)
        t1 = (
            f"{mapping.name} \u2014 {_format_feature_title_text(f1)}: daily success rate"
            if f1
            else f"{mapping.name} \u2014 feature 1"
        )
        t2 = (
            f"{mapping.name} \u2014 {_format_feature_title_text(f2)}: daily success rate"
            if f2
            else f"{mapping.name} \u2014 feature 2"
        )
        ppt.replace_image_on_slide(
            slide_num,
            "img_chart_feature1_trends",
            _chart_feature_breakdown(records, mapping, f1, chart_title=t1),
        )
        ppt.replace_image_on_slide(
            slide_num,
            "img_chart_feature2_trends",
            _chart_feature_breakdown(records, mapping, f2, chart_title=t2),
        )

    action_rows = _synthetic_action_breakdown_rows(records, mapping)
    action_pages = _paginate_action_breakdown_tables(action_rows)
    if len(action_rows) > _ACTION_TABLE_DATA_ROWS * len(_ACTION_BREAKDOWN_SLIDE_NUMS):
        overflow = len(action_rows) - _ACTION_TABLE_DATA_ROWS * len(
            _ACTION_BREAKDOWN_SLIDE_NUMS
        )
        print(
            f"Per-action table: {overflow} action(s) omitted (template fits "
            f"{_ACTION_TABLE_DATA_ROWS * len(_ACTION_BREAKDOWN_SLIDE_NUMS)} rows).",
            file=sys.stderr,
        )

    table_style = TableStyle(
        header_style=TextStyle(bold=True, size=7, font="Poppins"),
        row_style=TextStyle(size=7, font="Poppins"),
        word_wrap=True,
        cell_margin_pt=1.25,
    )
    for idx, slide_num in enumerate(_ACTION_BREAKDOWN_SLIDE_NUMS):
        ppt.replace_text_on_slide(
            slide_num,
            "{{title}}",
            f"{mapping.name} \u2014 per-action breakdown {period_label}",
        )
        if idx < len(action_pages):
            ppt.replace_table_on_slide(
                slide_num,
                _ACTION_TABLE_SHAPE,
                action_pages[idx],
                style=table_style,
            )
        else:
            empty = TableData(
                headers=list(_ACTION_TABLE_HEADERS),
                rows=[
                    [""] * len(_ACTION_TABLE_HEADERS)
                    for _ in range(_ACTION_TABLE_DATA_ROWS)
                ],
            )
            ppt.replace_table_on_slide(
                slide_num,
                _ACTION_TABLE_SHAPE,
                empty,
                style=table_style,
            )

    ppt.replace_text_on_slide(
        _TOP_FAILED_SLIDE_NUM,
        "{{title}}",
        f"{mapping.name} \u2014 top failed features {period_label}",
    )
    ppt.replace_table_on_slide(
        _TOP_FAILED_SLIDE_NUM,
        _TOP_FAILED_TABLE_SHAPE,
        _top_failed_features_table(records, mapping),
        style=table_style,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate synthetic monitoring PowerPoint (KPIs + daily SR chart)."
    )
    parser.add_argument(
        "--mapping",
        type=Path,
        default=DATA_DIR / "bale.synthetic.mapping.json",
        help="Synthetic mapping JSON",
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=DATA_DIR / "examples" / "synthetic_data_april.xlsx",
        help="CSV or XLSX source",
    )
    parser.add_argument(
        "--template",
        type=Path,
        default=DATA_DIR / "template_synthetic_monitoring.pptx",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help=f"Output .pptx (default: {_SYNTHETIC_OUT_DIR}/<name>_<data_stem>.pptx)",
    )
    args = parser.parse_args()

    if not args.template.exists():
        print(f"Template not found: {args.template}", file=sys.stderr)
        sys.exit(1)
    if not args.data.exists():
        print(f"Data not found: {args.data}", file=sys.stderr)
        sys.exit(1)
    if not args.mapping.exists():
        print(f"Mapping not found: {args.mapping}", file=sys.stderr)
        sys.exit(1)

    mapping = SyntheticAppMapping.from_file(args.mapping)
    _SYNTHETIC_OUT_DIR.mkdir(parents=True, exist_ok=True)
    if args.output is not None:
        out = args.output
        out.parent.mkdir(parents=True, exist_ok=True)
    else:
        out = (
            _SYNTHETIC_OUT_DIR
            / f"{sanitize_for_filename(mapping.name)}_{sanitize_for_filename(args.data.stem)}.pptx"
        )

    with template(args.template) as ppt:
        process_synthetic_template(
            ppt,
            mapping_path=args.mapping,
            data_path=args.data,
        )
        ppt.save(out)

    print(f"Saved \u2192 {out.resolve()}")
    reopen_in_powerpoint(out)


if __name__ == "__main__":
    main()
