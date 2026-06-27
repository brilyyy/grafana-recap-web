"""API server entrypoint.

Usage:
    uv run python src/main.py          # dev with reload
    uv run uvicorn api:app             # production (via Docker)
"""

from __future__ import annotations

import os

import uvicorn


def main() -> None:
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8321"))
    reload_val = os.environ.get("UVICORN_RELOAD", "true").lower() == "true"
    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=reload_val,
    )


if __name__ == "__main__":
    main()
