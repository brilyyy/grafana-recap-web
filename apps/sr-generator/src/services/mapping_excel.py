from __future__ import annotations

from pathlib import Path

from services.mapping_common import list_mapping_apps


def is_excel_mapping_path(path: Path) -> bool:
    return path.name.endswith(".excel.mapping.json")


def list_excel_mapping_apps() -> list[tuple[str, Path]]:
    return list_mapping_apps("*.excel.mapping.json", ".excel.mapping")
