"""CLI: generate a single report from hardcoded Excel file.

This was the original sr-gen entrypoint — kept as a dev convenience.
Run with: uv run python -m cli.generate [--no-open]
"""

from __future__ import annotations

import argparse
import sys

from bptx import template
from constants import TEMPLATE
from lib.data_processing import AppMapping, read_excel
from lib.report_helpers import format_date_range_auto
from lib.utils import reopen_in_powerpoint, sanitize_for_filename
from generators.template import process_template

from ._paths import MAPPING, OUTPUT, XLSX


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--no-open", action="store_true", help="skip opening in PowerPoint"
    )
    args = parser.parse_args()
    mapping = AppMapping.from_file(MAPPING)
    records = read_excel(XLSX, mapping)
    if mapping.ignore_errors or mapping.ignore_features:
        records = [r for r in records if not r.is_ignored(mapping)]
    records = mapping.filter_by_date(records)
    date_str = format_date_range_auto([r.date for r in records])

    output = (
        TEMPLATE.parent
        / f"SuccessRate_{sanitize_for_filename(mapping.name)}_{sanitize_for_filename(date_str)}.pptx"
    )

    with template(TEMPLATE) as ppt:
        process_template(ppt, mapping_path=MAPPING, xlsx_path=XLSX)
        ppt.save(output)

        print(f"Saved → {output}")
        for result in ppt.log():
            status = "✓" if result.success else "✗"
            print(
                f"  {status} [{result.operation}] {result.placeholder}: {result.message}"
            )

    if not args.no_open and not getattr(sys, "frozen", False):
        reopen_in_powerpoint(OUTPUT)


if __name__ == "__main__":
    main()
