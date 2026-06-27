"""Load API-related env files before ``web`` (and ``auth``) import."""

from __future__ import annotations

import os
import sys
from pathlib import Path

_LOADED = False


def load_api_dotenv() -> None:
    """Load variables from a dotenv file into the process environment.

    Precedence:

    1. If ``SR_GEN_ENV_FILE`` is set, load that path only (does not override
       variables already set in the environment).
    2. Otherwise, use the first directory in the search list that contains
       ``.env`` and/or ``.env.api`` and/or ``.env.db``.
       Load ``.env``, then ``.env.api``, then ``.env.db`` so later files
       override earlier ones.
    3. If none of those directories have either file, fall back to
       ``python-dotenv`` default (``.env`` in the current working directory).

    Search order for (2): current working directory, directory containing the
    frozen executable (if applicable), then repository root when running from
    source.
    """
    global _LOADED
    if _LOADED:
        return
    _LOADED = True

    from dotenv import load_dotenv

    explicit = os.environ.get("SR_GEN_ENV_FILE")
    if explicit:
        load_dotenv(Path(explicit), override=False)
        return

    roots: list[Path] = [Path.cwd()]
    if getattr(sys, "frozen", False):
        roots.append(Path(sys.executable).parent)
    # walk up from __file__ to find monorepo root .env
    _here = Path(__file__).resolve().parent
    for p in _here.parents:
        if (p / ".env").exists():
            roots.append(p)
            break

    for base in roots:
        env_path = base / ".env"
        api_path = base / ".env.api"
        db_path = base / ".env.db"
        legacy_jump_path = base / ".env.jumphost"
        has_any = (
            env_path.exists()
            or api_path.exists()
            or db_path.exists()
            or legacy_jump_path.exists()
        )
        if not has_any:
            continue
        if env_path.exists():
            load_dotenv(env_path, override=False)
        if api_path.exists():
            load_dotenv(api_path, override=True)
        if db_path.exists():
            load_dotenv(db_path, override=True)
        elif legacy_jump_path.exists():
            # Backward compatibility for older deployments.
            load_dotenv(legacy_jump_path, override=True)
        return

    load_dotenv(override=False)
