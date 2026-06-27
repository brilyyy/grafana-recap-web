from __future__ import annotations

import json
from pathlib import Path

from constants import DATA_DIR


def list_mapping_apps(pattern: str, stem_suffix: str) -> list[tuple[str, Path]]:
    apps: list[tuple[str, Path]] = []
    for path in sorted(DATA_DIR.glob(pattern)):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            name = str(raw.get("name") or path.stem.replace(stem_suffix, "")).strip()
        except Exception:
            name = path.stem.replace(stem_suffix, "")
        apps.append((name, path))
    return apps
