"""
utils/chart.py — Chart factory functions for sr-gen.

Each function returns bytes (PNG) for direct use with bptx.replace_image(),
or saves to disk when `output` is provided.

Font sizes auto-scale with figure width:
    base  = fig_w_in * font_scale      (default: 0.8)
    tick  = base * 0.60
    label = base * 0.50
    legend = base * 0.65

Functions:
    create_bar_line_chart(labels, bar_values, line_values, ...)
    create_multi_line_breakdown_chart(labels, left_name, left_values, right_name, right_values, ...)
    create_multi_line_errors_chart(labels, series_names, series_values, ...)
    create_trx_breakdown_chart(total_trx, success, error, business_error, system_error, ...)
    create_stacked_bar_chart(labels, series_names, series_values, series_colors, ...)
"""

from __future__ import annotations

import io
from pathlib import Path
import matplotlib
import matplotlib.figure
import matplotlib.pyplot as plt


def save_fig(
    fig: matplotlib.figure.Figure,
    dpi: int,
    output: str | Path | None,
    *,
    tight: bool = True,
) -> bytes | Path:
    """Save figure as PNG. Use ``tight=False`` when the figure size already matches the
    target placeholder so pixels are exactly ``figsize * dpi`` (avoids rescale blur in viewers)."""
    kw: dict = {
        "dpi": dpi,
        "facecolor": fig.get_facecolor(),
        "edgecolor": "none",
    }
    if tight:
        kw["bbox_inches"] = "tight"
    try:
        if output:
            path = Path(output)
            fig.savefig(path, **kw)
            return path
        buf = io.BytesIO()
        fig.savefig(buf, format="png", **kw)
        buf.seek(0)
        return buf.read()
    finally:
        plt.close(fig)
