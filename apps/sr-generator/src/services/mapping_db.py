from __future__ import annotations

from pathlib import Path

from services.mapping_common import list_mapping_apps


def is_db_mapping_path(path: Path) -> bool:
    return path.name.endswith(".db.mapping.json")


def list_db_mapping_apps() -> list[tuple[str, Path]]:
    return list_mapping_apps("*.db.mapping.json", ".db.mapping")
