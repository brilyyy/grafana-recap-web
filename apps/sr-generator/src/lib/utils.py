from __future__ import annotations

import os
import platform
import re
import subprocess
from datetime import date
from pathlib import Path


def reopen_in_powerpoint(path: Path) -> None:
    system = platform.system()
    if system == "Darwin":
        script = f"""
set pptxPath to POSIX file "{path.resolve()}"
if application "Microsoft PowerPoint" is running then
    tell application "Microsoft PowerPoint"
        try
            close presentation "{path.name}" saving no
        end try
    end tell
end if
tell application "Microsoft PowerPoint"
    open pptxPath
    activate
end tell
"""
        subprocess.run(["osascript", "-e", script], check=False)
    elif system == "Windows":
        os.startfile(str(path))  # type: ignore
    else:
        subprocess.Popen(["xdg-open", str(path)])


_ID_MONTHS = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
]


def format_date_range(start: date, end: date) -> str:
    """
    Format a date range as an Indonesian string.

    Same month+year : "1 - 3 Maret 2026"
    Same year only  : "28 Februari - 3 Maret 2026"
    Different years : "30 Desember 2025 - 2 Januari 2026"
    Single date     : "1 Maret 2026"
    """
    if start > end:
        start, end = end, start

    start_month = _ID_MONTHS[start.month - 1]
    end_month = _ID_MONTHS[end.month - 1]

    if start == end:
        return f"{start.day} {start_month} {start.year}"

    if start.year == end.year and start.month == end.month:
        return f"{start.day} - {end.day} {end_month} {end.year}"

    if start.year == end.year:
        return f"{start.day} {start_month} - {end.day} {end_month} {end.year}"

    return f"{start.day} {start_month} {start.year} - {end.day} {end_month} {end.year}"


def format_date_range_auto(dates: list[date]) -> str:
    """Format a date range by auto-detecting the oldest and latest date in the list."""
    if not dates:
        raise ValueError("dates must not be empty")
    return format_date_range(min(dates), max(dates))


def get_year_range(dates: list[date]) -> str:
    """Get the year range from a list of dates. If all dates are in the same year, return that year. Otherwise, return a range of years."""
    if not dates:
        raise ValueError("dates must not be empty")
    years = {d.year for d in dates}
    if len(years) == 1:
        return str(years.pop())
    return f"{min(years)} - {max(years)}"


def short_num_format(n):
    # Skala: Triliun (T), Miliar (M), Juta (jt), Ribu (rb)
    if n >= 1_000_000_000_000:
        hasil = n / 1_000_000_000_000
        suffix = "T"
    elif n >= 1_000_000_000:
        hasil = n / 1_000_000_000
        suffix = "M"
    elif n >= 1_000_000:
        hasil = n / 1_000_000
        suffix = "jt"
    elif n >= 1_000:
        hasil = n / 1_000
        suffix = "rb"
    else:
        return str(n)

    # Format .1f memastikan pembulatan 1 angka di belakang koma
    # .replace('.', ',') mengubah standar US ke standar Indonesia
    return f"~{hasil:.1f}{suffix}".replace(".", ",")

def sanitize_for_filename(text: str) -> str:
    return re.sub(r"[^\w\-.]", "", text.replace(" - ", "-").replace(" ", "_"))

def is_dev() -> bool:
    return os.environ.get("SR_GEN_ENV", "").strip().lower() == "development"