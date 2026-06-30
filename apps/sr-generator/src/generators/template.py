"""Template-based report generation for PowerPoint.

The main entry point is :func:`process_template`, which fills a BPTX presentation
with transaction data, charts, and tables.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable
from datetime import date, timedelta
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from bptx import TableStyle, TextStyle
from bptx._framework import BPTX
from constants import DATA_DIR
from lib.chart import save_fig as save
from lib.data_processing import AppMapping, TransactionRecord, read_excel
from lib.logging import get_logger
from lib.report_helpers import (
    aggregate_by_period,
    get_distinct_colors,
    get_table_pages,
)
from lib.utils import (
    format_date_range_list,
    get_year_range,
    short_num_format,
)

log = get_logger(__name__)



def _chart_monthly_sr_trx(
    records: list[TransactionRecord],
    mapping: AppMapping,
) -> bytes | Path:
    """Monthly total trx + success rate → bar+line combo (img_monthly_sr_trx)."""
    from collections import defaultdict as _dd

    monthly_total: dict[tuple[int, int], int] = _dd(int)
    monthly_success: dict[tuple[int, int], int] = _dd(int)
    for r in records:
        key = (r.date.year, r.date.month)
        monthly_total[key] += r.trx_count
        if not r.is_system_error(mapping):
            monthly_success[key] += r.trx_count

    months = sorted(monthly_total)
    labels = [date(y, m, 1).strftime("%b %Y") for y, m in months]
    totals = [float(monthly_total[k]) for k in months]
    sr_vals = [
        round(monthly_success[k] / monthly_total[k] * 100, 2)
        if monthly_total[k]
        else 0.0
        for k in months
    ]

    # Detect whether the latest month is still mid-month (ongoing)
    latest_idx = len(labels) - 1
    y, m = months[latest_idx]
    last_day_of_month = (date(y + (m // 12), m % 12 + 1, 1) - timedelta(days=1)).day
    max_day_in_month = max(
        r.date.day for r in records if r.date.year == y and r.date.month == m
    )
    is_ongoing = max_day_in_month < last_day_of_month
    if is_ongoing:
        labels[latest_idx] = f"{labels[latest_idx]} (ongoing)"

    dpi = 110
    figsize = (12.52 * 2, 2.1 * 2)
    base_fontsize = figsize[0] * 0.9

    df = pd.DataFrame({"labels": labels, "totals": totals, "sr_vals": sr_vals})
    fig, ax1 = plt.subplots(figsize=figsize, dpi=dpi)
    sns.barplot(x="labels", y="totals", data=df, ax=ax1, color="steelblue")
    ax1.set_ylabel("Total Trx", color="steelblue", fontsize=base_fontsize * 0.8)
    ax1.set_ylim(0, max(totals) * 1.5)
    ax1.spines["top"].set_visible(False)

    # Style the last bar only when it is mid-month (ongoing)
    if is_ongoing:
        for i, patch in enumerate(ax1.patches):
            if i == latest_idx:
                patch.set_facecolor("#b8d4e8")
                patch.set_hatch("///")
                patch.set_edgecolor("#4a86b0")
                patch.set_linewidth(1.5)

    for i, v in enumerate(totals):
        ax1.text(
            i,
            v + max(totals) * 0.02,
            f"{v:,.0f}",
            color="black",
            horizontalalignment="center",
            fontsize=base_fontsize * 0.55,
        )
    ax2 = ax1.twinx()
    sns.lineplot(
        x="labels", y="sr_vals", data=df, ax=ax2, color="orangered", marker="o"
    )
    ax2.set_ylabel("Success Rate (%)", color="orangered", fontsize=base_fontsize * 0.8)
    ax2.set_ylim(min(sr_vals) - 20, 100 * 1.05)
    ax2.spines["top"].set_visible(False)
    for i, v in enumerate(sr_vals):
        ax2.text(
            i,
            v + 1,
            f"{v:.2f}%",
            color="black",
            horizontalalignment="center",
            fontsize=base_fontsize * 0.55,
        )
    ax1.tick_params(axis="y", rotation=45, labelsize=base_fontsize * 0.55)
    ax2.tick_params(axis="y", rotation=45, labelsize=base_fontsize * 0.55)

    ax1.set_xticklabels(labels, fontsize=base_fontsize * 0.55)
    if is_ongoing:
        for i, tick in enumerate(ax1.get_xticklabels()):
            if i == latest_idx:
                tick.set_color("#888888")
                tick.set_fontstyle("italic")

    ax1.set_title(
        "Monthly Total Transactions and Success Rate", fontsize=base_fontsize, y=1.1
    )
    ax1.set_xlabel("Bulan Transaksi", fontsize=base_fontsize * 0.8)
    plt.tight_layout()
    return save(fig, dpi=dpi, output=None)


def _chart_daily_sr_trx(
    records: list[TransactionRecord],
    mapping: AppMapping,
) -> bytes | Path:
    """Daily total trx + success rate → bar+line combo (img_daily_sr_trx)."""
    daily_total: dict[date, int] = defaultdict(int)
    daily_success: dict[date, int] = defaultdict(int)
    for r in records:
        daily_total[r.date] += r.trx_count
        if not r.is_system_error(mapping):
            daily_success[r.date] += r.trx_count

    dates = sorted(daily_total)
    labels = [f"{d.day} {d.strftime('%b')}" for d in dates]
    totals = [float(daily_total[d]) for d in dates]
    sr_vals = [
        round(daily_success[d] / daily_total[d] * 100, 2) if daily_total[d] else 0.0
        for d in dates
    ]

    dpi = 110
    figsize = (12.52 * 2, 3.03 * 2)
    base_fontsize = figsize[0] * 1

    df = pd.DataFrame({"labels": labels, "totals": totals, "sr_vals": sr_vals})
    fig, ax1 = plt.subplots(figsize=figsize, dpi=dpi)
    sns.barplot(x="labels", y="totals", data=df, ax=ax1, color="steelblue", width=0.6)
    ax1.set_ylabel("Total Trx", color="steelblue", fontsize=base_fontsize * 0.8)
    ax1.set_ylim(0, max(totals) * 2)
    ax1.spines["top"].set_visible(False)

    for i, v in enumerate(totals):
        ax1.text(
            i,
            v + max(totals) * 0.02,
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
    ax2.set_ylim(min(sr_vals) - 20, 100 * 1.05)
    ax2.spines["top"].set_visible(False)
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
    ax1.set_xticklabels(
        ax1.get_xticklabels(), ha="center", fontsize=base_fontsize * 0.55
    )
    ax1.tick_params(axis="y", rotation=45, labelsize=base_fontsize * 0.55)
    ax2.tick_params(axis="y", rotation=45, labelsize=base_fontsize * 0.55)
    ax1.set_title(
        "Daily Total Transactions and Success Rate", fontsize=base_fontsize, y=1.1
    )
    ax1.set_xlabel("Tanggal Transaksi", fontsize=base_fontsize * 0.8)
    plt.tight_layout()
    return save(fig, dpi=dpi, output=None)


def _chart_trx_breakdown(
    records: list[TransactionRecord], mapping: AppMapping
) -> bytes | Path:
    """Transaction breakdown by response code → stacked bar (img_trx_breakdown)."""
    success_count = sum(r.trx_count for r in records if r.is_success(mapping))
    system_error_count = sum(r.trx_count for r in records if r.is_system_error(mapping))
    business_error_count = sum(
        r.trx_count for r in records if r.is_business_error(mapping)
    )
    error_count = system_error_count + business_error_count

    data = {
        "Success": success_count,
        "Error": error_count,
        "Business Error": business_error_count,
        "System Error": system_error_count,
    }

    total_h = data["Success"] + data["Error"]
    error_subtotal = data["Business Error"] + data["System Error"]

    # Normalize all bar heights to a fixed max so bars always fill the same height
    MAX_H = 100
    norm_error = (data["Error"] / total_h) * MAX_H if total_h else 0
    norm_success = (data["Success"] / total_h) * MAX_H if total_h else MAX_H
    norm_sys = (data["System Error"] / error_subtotal) * MAX_H if error_subtotal else 0
    norm_bus = (
        (data["Business Error"] / error_subtotal) * MAX_H if error_subtotal else MAX_H
    )

    figsize = (2.75 * 2, 1.65 * 2)
    dpi = 96

    sns.set_style("white", {"font.family": ["Poppins"]})
    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    x1, x2 = 0, 1.7
    bar_width = 0.78

    # Draw bars with a subtle drop-shadow effect
    shadow_kw = dict(
        color="#cccccc", width=bar_width + 0.04, edgecolor="none", zorder=1
    )
    ax.bar(x1, MAX_H, **shadow_kw)  # type: ignore
    ax.bar(x2, MAX_H, **shadow_kw)  # type: ignore

    ax.bar(
        x1,
        norm_error,
        width=bar_width,
        color="#e63946",
        edgecolor="white",
        linewidth=2,
        zorder=2,
    )
    ax.bar(
        x1,
        norm_success,
        bottom=norm_error,
        width=bar_width,
        color="#0062ff",
        edgecolor="white",
        linewidth=2,
        zorder=2,
    )
    ax.bar(
        x2,
        norm_sys,
        width=bar_width,
        color="#b30000",
        edgecolor="white",
        linewidth=2,
        zorder=2,
    )
    ax.bar(
        x2,
        norm_bus,
        bottom=norm_sys,
        width=bar_width,
        color="#ff7034",
        edgecolor="white",
        linewidth=2,
        zorder=2,
    )

    label_cfg = {
        "ha": "center",
        "va": "center",
        "color": "white",
        "fontweight": "bold",
        "fontsize": 11,
        "zorder": 3,
    }
    error_pct = (data["Error"] / total_h * 100) if total_h else 0
    ax.text(
        x1,
        norm_error + (norm_success / 2),
        f"Success\n{data['Success']:,}\n{100 - error_pct:.2f}%",
        **label_cfg,  # ty:ignore[invalid-argument-type]
    )
    error_label = f"Error\n{data['Error']:,}\n{error_pct:.2f}%"
    if norm_error < 22:
        # Segment too small — place label outside to the left with a connector
        ax.text(
            x1 - bar_width / 2 - 0.1,
            norm_error / 2,
            error_label,
            ha="right",
            va="center",
            color="#e63946",
            fontweight="bold",
            fontsize=11,
            zorder=3,
        )
        ax.annotate(
            "",
            xy=(x1 - bar_width / 2, norm_error / 2),
            xytext=(x1 - bar_width / 2 - 0.08, norm_error / 2),
            arrowprops=dict(arrowstyle="-", color="#e63946", lw=1.2, alpha=0.8),
        )
    else:
        ax.text(x1, norm_error / 2, error_label, **label_cfg)  # ty:ignore[invalid-argument-type]
    _OUTSIDE_THRESHOLD = 25  # % of MAX_H below which label moves outside bar 2

    def _bar2_label(y_center: float, segment_h: float, text: str, color: str) -> None:
        if segment_h >= _OUTSIDE_THRESHOLD:
            ax.text(x2, y_center, text, **label_cfg)  # ty:ignore[invalid-argument-type]
        else:
            right_x = x2 + bar_width / 2 + 0.1
            ax.text(
                right_x,
                y_center,
                text,
                ha="left",
                va="center",
                color=color,
                fontweight="bold",
                fontsize=11,
                zorder=3,
            )
            ax.annotate(
                "",
                xy=(x2 + bar_width / 2, y_center),
                xytext=(right_x - 0.06, y_center),
                arrowprops=dict(arrowstyle="-", color=color, lw=1.2, alpha=0.8),
            )

    bus_pct = (data["Business Error"] / total_h * 100) if total_h else 0
    sys_pct = (data["System Error"] / total_h * 100) if total_h else 0

    _bar2_label(
        norm_sys + norm_bus / 2,
        norm_bus,
        f"Business Error\n{data['Business Error']:,}\n{bus_pct:.2f}%",
        "#ff7034",
    )
    _bar2_label(
        norm_sys / 2,
        norm_sys,
        f"System Error\n{data['System Error']:,}\n{sys_pct:.2f}%",
        "#b30000",
    )

    # Bar title labels below each bar
    ax.text(
        x1,
        -6,
        "Total Transaction",
        ha="center",
        va="top",
        fontsize=9,
        color="#444444",
        fontweight="bold",
    )
    ax.text(
        x2,
        -6,
        "Error Breakdown",
        ha="center",
        va="top",
        fontsize=9,
        color="#444444",
        fontweight="bold",
    )

    ax.set_ylim(-14, MAX_H + 3)
    ax.axis("off")
    plt.tight_layout(pad=0.4)

    return save(fig, dpi=dpi, output=None)


def _chart_errors_breakdown(
    records: list[TransactionRecord], mapping: AppMapping
) -> bytes | Path:
    days = sorted(set(r.date for r in records))
    business_errors_data: list[tuple[date, float]] = []
    system_errors_data: list[tuple[date, float]] = []
    total_errors_by_day: dict[date, int] = {}
    for day in days:
        day_records = [r for r in records if r.date == day]
        business_errors = sum(
            r.trx_count for r in day_records if r.is_business_error(mapping)
        )
        system_errors = sum(
            r.trx_count for r in day_records if r.is_system_error(mapping)
        )
        total_errors_by_day[day] = business_errors + system_errors
        # get percentages relative to total errors that day
        if total_errors_by_day[day] > 0:
            business_errors_data.append(
                (day, business_errors / total_errors_by_day[day] * 100)
            )
            system_errors_data.append(
                (day, system_errors / total_errors_by_day[day] * 100)
            )
        else:
            business_errors_data.append((day, 0.0))
            system_errors_data.append((day, 0.0))

    figsize = (10.23 * 2, 2.1 * 2)
    dpi = 96
    base_fontsize = figsize[0] * 0.6

    sns.set_style("white", {"font.family": ["Poppins"]})
    df = pd.DataFrame(
        {
            "Date": [f"{d.day} {d.strftime('%b')}" for d in days],
            "BE %": [be for _, be in business_errors_data],
            "SE %": [se for _, se in system_errors_data],
        }
    )
    plt.figure(figsize=figsize, dpi=dpi)
    sns.lineplot(
        x="Date",
        y="BE %",
        data=df,
        color="#ed8e3d",
        marker="o",
        linewidth=2.5,
        label="BE %",
    )
    sns.lineplot(
        x="Date",
        y="SE %",
        data=df,
        color="#b30000",
        marker="o",
        linewidth=2.5,
        label="SE %",
    )
    for i in range(len(df)):
        plt.text(
            i,
            df["BE %"][i] + 2,
            f"{df['BE %'][i]:.2f}%",
            ha="center",
            va="bottom",
            fontsize=base_fontsize,
            fontweight="bold",
            color="#333333",
        )
        plt.text(
            i,
            df["SE %"][i] - 10,
            f"{df['SE %'][i]:.2f}%",
            ha="center",
            va="bottom",
            fontsize=base_fontsize,
            fontweight="bold",
            color="#333333",
        )
    plt.title(
        f"{mapping.name} System and Business Error",
        fontsize=18,
        color="#444444",
    )
    plt.xticks(rotation=45, ha="right")
    sns.despine(left=True, top=True, right=True)
    plt.yticks([])
    plt.ylabel("")
    plt.xlabel("")
    plt.ylim(min(df["BE %"].min(), df["SE %"].min()) - 10, 120)
    plt.legend(loc="center left", bbox_to_anchor=(1, 0.5), frameon=False)
    plt.tight_layout()
    return save(plt.gcf(), dpi=dpi, output=None)


def _no_data_chart() -> bytes | Path:
    dpi = 150
    figsize = (12.65 * 2, 2.97 * 2)
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
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
    return save(fig, dpi=dpi, output=None)


def _chart_top_five_errors(
    records: list[TransactionRecord],
    mapping: AppMapping,
    predicate: Callable[[TransactionRecord, AppMapping], bool],
    title: str,
) -> bytes | Path:
    period_labels, counts = aggregate_by_period(records, mapping, predicate)
    if not period_labels or not counts:
        counts_v2: dict[str, dict[str, int]] = {}
    else:
        latest_idx = len(period_labels) - 1
        top_keys = [
            key
            for key, _ in sorted(
                counts.items(), key=lambda kv: kv[1][latest_idx], reverse=True
            )[:5]
            if counts[key][latest_idx] > 0
        ]
        counts_v2 = {
            period_labels[i]: {k: counts[k][i] for k in top_keys}
            for i in range(len(period_labels))
        }
    log.debug("top data", extra={"data": counts_v2})

    if not counts_v2:
        return _no_data_chart()

    period_order = list(counts_v2.keys())
    error_keys = list(next(iter(counts_v2.values())).keys())
    rows = []
    for pl in period_order:
        row: dict[str, str | int] = {"Period": pl}
        for ek in error_keys:
            row[ek] = counts_v2[pl].get(ek, 0)
        rows.append(row)
    df = pd.DataFrame(rows)
    columns = [c for c in df.columns if c != "Period"]
    if not columns:
        return _no_data_chart()

    unique_colors = get_distinct_colors(len(columns))
    color_map = dict(zip(columns, unique_colors))

    dpi = 150
    figsize = (12.65 * 2, 2.97 * 2)
    base_fontsize = 16

    sns.set_style("white", {"font.family": ["Poppins"]})
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    # Subtle horizontal grid behind everything
    ax.yaxis.set_visible(False)
    ax.set_axisbelow(True)
    ax.yaxis.grid(True, color="#eeeeee", linewidth=1)

    for col in columns:
        ax.plot(
            range(len(df)),
            df[col],
            marker="o",
            color=color_map[col],
            linewidth=2.5,
            markersize=9,
            markeredgecolor="white",
            markeredgewidth=1.5,
            label=col,
            zorder=3,
        )

    # Anti-overlap label placement — push labels with < min_gap apart
    y_max = float(df[columns].max().max())
    if y_max <= 0:
        y_max = 1.0
    min_gap = y_max * 0.09  # minimum vertical separation between labels

    def _spread(positions: list[float], gap: float) -> list[float]:
        result = sorted(range(len(positions)), key=lambda i: positions[i])
        adj = [positions[i] for i in result]
        for _ in range(200):
            moved = False
            for k in range(1, len(adj)):
                if adj[k] - adj[k - 1] < gap:
                    mid = (adj[k] + adj[k - 1]) / 2
                    adj[k - 1] = mid - gap / 2
                    adj[k] = mid + gap / 2
                    moved = True
            if not moved:
                break
        # Map back to original order
        out = [0.0] * len(positions)
        for rank, orig_i in enumerate(result):
            out[orig_i] = adj[rank]
        return out

    for x_idx in range(len(df)):
        raw_y = [float(df[col].iloc[x_idx]) for col in columns]
        adjusted_y = _spread([y + min_gap * 0.6 for y in raw_y], min_gap)
        for col, y_data, y_label in zip(columns, raw_y, adjusted_y):
            ax.annotate(
                f"{int(y_data):,}",
                xy=(x_idx, y_data),
                xytext=(x_idx, y_label),
                ha="center",
                va="center",
                fontsize=base_fontsize * 0.82,
                fontweight="bold",
                color=color_map[col],
                zorder=5,
                bbox=dict(
                    boxstyle="round,pad=0.25",
                    facecolor="white",
                    edgecolor=color_map[col],
                    linewidth=0.8,
                    alpha=0.92,
                ),
                arrowprops=dict(
                    arrowstyle="-",
                    color=color_map[col],
                    lw=0.8,
                    alpha=0.5,
                ),
            )

    ax.set_title(
        title, fontsize=base_fontsize * 1.25, pad=10, fontweight="bold", color="#222222"
    )
    ax.set_ylim(-y_max * 0.06, y_max * 1.6)
    ax.set_xticks(range(len(df)))
    ax.set_xticklabels(df["Period"].tolist(), fontsize=base_fontsize * 0.85)
    ax.tick_params(axis="x", pad=10)
    ax.set_ylabel("")
    sns.despine(ax=ax, left=True, top=True, right=True)

    # Legend on the right side, vertical, no frame
    ax.legend(
        loc="center left",
        bbox_to_anchor=(1.01, 0.5),
        frameon=False,
        fontsize=base_fontsize * 0.82,
        handlelength=1.5,
        borderaxespad=0,
    )

    plt.tight_layout()
    return save(fig, dpi=dpi, output=None)


# ---------------------------------------------------------------------------
# Template processor
# ---------------------------------------------------------------------------
def process_template(
    ppt: BPTX,
    *,
    mapping_path: Path,
    xlsx_path: Path | None = None,
    records_preloaded: list[TransactionRecord] | None = None,
) -> None:
    plt.close("all")
    mapping = AppMapping.from_file(mapping_path)
    if records_preloaded is not None:
        yearly_data = list(records_preloaded)
    else:
        if xlsx_path is None:
            raise ValueError("xlsx_path required when records_preloaded not given")
        yearly_data = read_excel(xlsx_path, mapping)

    if mapping.ignore_errors or mapping.ignore_features:
        ignored_yearly_data = [r for r in yearly_data if r.is_ignored(mapping)]
        yearly_data = [r for r in yearly_data if not r.is_ignored(mapping)]
        print(
            f"Ignored {len(ignored_yearly_data)} records matching: errors={mapping.ignore_errors} features={mapping.ignore_features}"
        )

    monthly_data = mapping.filter_by_date(yearly_data)

    if monthly_data is not yearly_data:
        print(
            f"Date filter applied: {len(monthly_data)}/{len(yearly_data)} records in range."
        )
    if not monthly_data:
        raise ValueError(
            "No records found after applying mapping, ignore filters, and date range."
        )

    total_trx = sum(r.trx_count for r in monthly_data)
    success_trx = sum(r.trx_count for r in monthly_data if r.is_considered_success(mapping))
    sr = success_trx / total_trx if total_trx else 0.0
    system_error_trx = sum(r.trx_count for r in monthly_data if r.is_system_error(mapping))
    business_error_trx = sum(
        r.trx_count for r in monthly_data if r.is_business_error(mapping)
    )

    daily_total: dict[date, int] = defaultdict(int)
    daily_success: dict[date, int] = defaultdict(int)
    for r in monthly_data:
        daily_total[r.date] += r.trx_count
        if r.is_considered_success(mapping):
            daily_success[r.date] += r.trx_count

    trx_avg = total_trx // len(daily_total) if daily_total else 0
    h_trx_date = max(daily_total, key=lambda d: daily_total[d])
    daily_sr: dict[date, float] = {
        d: daily_success[d] / daily_total[d] for d in daily_total if daily_total[d]
    }
    h_sr_date = max(daily_sr, key=lambda d: daily_sr[d])
    l_sr_date = min(daily_sr, key=lambda d: daily_sr[d])
    date_range = format_date_range_list([r.date for r in monthly_data])

    def fmt_date(d: date) -> str:
        return f"{d.day} {d.strftime('%b %Y')}"

    # Slide 1
    ppt.replace_text_on_slide(1, "{{year}}", get_year_range([r.date for r in yearly_data]))

    # Slide 2
    ppt.replace_text_on_slide(2, "{{title}}", mapping.name)

    # Slide 3
    ppt.replace_text_on_slide(
        3, "{{date_range}}", format_date_range_list([r.date for r in monthly_data])
    )

    # Slide 4
    ppt.replace_text_on_slide(
        4, "{{title}}", f"{mapping.name} Performance & Success Rate {date_range}"
    )
    ppt.replace_text_on_slide(4, "{{total_trx}}", f"{total_trx:,}")
    ppt.replace_text_on_slide(4, "{{sr}}", f"{sr:.2%}")
    ppt.replace_text_on_slide(4, "{{trx_avg}}", f"{trx_avg:,}")
    ppt.replace_text_on_slide(4, "{{h_trx}}", f"{daily_total[h_trx_date]:,}")
    ppt.replace_text_on_slide(4, "{{h_trx_date}}", fmt_date(h_trx_date))
    ppt.replace_text_on_slide(4, "{{h_sr}}", f"{daily_sr[h_sr_date]:.2%}")
    ppt.replace_text_on_slide(4, "{{h_sr_date}}", fmt_date(h_sr_date))
    ppt.replace_text_on_slide(4, "{{l_sr}}", f"{daily_sr[l_sr_date]:.2%}")
    ppt.replace_text_on_slide(4, "{{l_sr_date}}", fmt_date(l_sr_date))
    ppt.replace_image("img_daily_sr_trx", _chart_daily_sr_trx(monthly_data, mapping))
    ppt.replace_image("img_monthly_sr_trx", _chart_monthly_sr_trx(yearly_data, mapping))

    # Fixed slide layout: 5=SE p1, 6=SE p2, 7=SE p3, 8=BE, 9=trends
    se_pages, be_page = get_table_pages(monthly_data, mapping)
    log.debug("CEK SE BE", {"se": se_pages, "be": be_page})

    img_trx_breakdown = _chart_trx_breakdown(monthly_data, mapping)
    img_errors_breakdown = _chart_errors_breakdown(monthly_data, mapping)
    table_style = TableStyle(
        header_style=TextStyle(bold=True, size=9, font="Poppins"),
        row_style=TextStyle(size=9, font="Poppins"),
    )
    total_trx_short = short_num_format(total_trx)
    total_error_short = short_num_format(system_error_trx + business_error_trx)

    if mapping.weekly_periods:
        p_from, p_to = mapping.weekly_periods[-1]
        latest_period_label = format_date_range_list([p_from, p_to])
    else:
        latest_period_label = format_date_range_list([r.date for r in monthly_data])

    # SE slides 5 - 7
    for i, page in enumerate(se_pages):
        slide_num = 5 + i
        ppt.replace_text_on_slide(slide_num, "{{total_trx}}", total_trx_short)
        ppt.replace_text_on_slide(slide_num, "{{total_error}}", total_error_short)
        ppt.replace_image_on_slide(slide_num, "img_diagram_se_be", img_trx_breakdown)
        ppt.replace_image_on_slide(slide_num, "img_chart_se_be", img_errors_breakdown)
        ppt.replace_table_on_slide(slide_num, "tbl_rc", page, style=table_style)
        ppt.replace_text_on_slide(
            slide_num, "{{title}}", f"System Error {mapping.name} {latest_period_label}"
        )

    # BE slide 8
    ppt.replace_text_on_slide(8, "{{total_trx}}", total_trx_short)
    ppt.replace_text_on_slide(8, "{{total_error}}", total_error_short)
    ppt.replace_image_on_slide(8, "img_diagram_se_be", img_trx_breakdown)
    ppt.replace_image_on_slide(8, "img_chart_se_be", img_errors_breakdown)
    ppt.replace_table_on_slide(8, "tbl_rc", be_page, style=table_style)
    ppt.replace_text_on_slide(
        8, "{{title}}", f"Business Error {mapping.name} {latest_period_label}"
    )

    # Trends slide 9
    ppt.replace_image_on_slide(
        9,
        "img_chart_se_trends",
        _chart_top_five_errors(
            yearly_data,
            mapping,
            TransactionRecord.is_system_error,
            f"{mapping.name} System Error Trends",
        ),
    )
    ppt.replace_image_on_slide(
        9,
        "img_chart_be_trends",
        _chart_top_five_errors(
            yearly_data,
            mapping,
            TransactionRecord.is_business_error,
            f"{mapping.name} Business Error Trends",
        ),
    )
    ppt.replace_text_on_slide(9, "{{app_name}}", mapping.name)
    plt.close("all")
