"""Mapping discovery — list DB/Excel mapping files from data/ directories."""

from __future__ import annotations

import json
from pathlib import Path

from constants import DATA_DIR


def list_mapping_apps(glob_pattern: str, suffix: str) -> list[tuple[str, Path]]:
    """List (app_name, path) tuples for mapping files matching *glob_pattern*."""
    results: list[tuple[str, Path]] = []
    for path in sorted(DATA_DIR.glob(glob_pattern)):
        raw = json.loads(path.read_text(encoding="utf-8"))
        name = str(raw.get("name") or path.stem.replace(suffix, "")).strip()
        results.append((name, path))
    return results


def is_db_mapping_path(path: Path) -> bool:
    return path.name.endswith(".db.mapping.json")


def list_db_mapping_apps() -> list[tuple[str, Path]]:
    return list_mapping_apps("*.db.mapping.json", ".db.mapping")


def is_excel_mapping_path(path: Path) -> bool:
    return path.name.endswith(".excel.mapping.json")


def list_excel_mapping_apps() -> list[tuple[str, Path]]:
    return list_mapping_apps("*.excel.mapping.json", ".excel.mapping")
