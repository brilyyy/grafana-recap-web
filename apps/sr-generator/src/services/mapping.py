"""Mapping discovery — synthetic mapping files from data/ directories.

DB and Excel mappings are now stored in the database (app_mappings table).
Only synthetic mappings remain file-based.
"""

from __future__ import annotations

import json
from pathlib import Path

from constants import DATA_DIR


def list_synthetic_mapping_apps() -> list[tuple[str, Path]]:
    """List (app_name, path) tuples for synthetic mapping files."""
    results: list[tuple[str, Path]] = []
    for path in sorted(DATA_DIR.glob("others/*.synthetic.mapping.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            name = str(raw.get("name") or path.stem.replace(".synthetic.mapping", "")).strip()
        except Exception:
            name = path.stem.replace(".synthetic.mapping", "")
        results.append((name, path))
    return results
