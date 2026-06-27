"""lib/logger.py — Application logger with pretty console + file output.

Usage:
    from lib.logger import get_logger

    log = get_logger(__name__)
    log.info("Processing %d records", len(records))
    log.debug("Mapping loaded", extra={"data": mapping})
    log.error("Failed to parse row", exc_info=True)

Log file location: <BASE_DIR>/logs/sr-gen.log  (rotating, 5 MB × 3 backups)
Console output  : coloured, human-readable
File output     : plain-text, same format (no colour codes)
"""

from __future__ import annotations

import logging
import pprint
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_BASE_DIR = Path(__file__).parent.parent.parent  # project root
LOGS_DIR = _BASE_DIR / "logs"
LOG_FILE = LOGS_DIR / "sr-gen.log"

# ---------------------------------------------------------------------------
# ANSI colour helpers
# ---------------------------------------------------------------------------

_RESET = "\033[0m"
_BOLD = "\033[1m"
_DIM = "\033[2m"

_LEVEL_COLOURS: dict[int, str] = {
    logging.DEBUG: "\033[36m",     # cyan
    logging.INFO: "\033[32m",      # green
    logging.WARNING: "\033[33m",   # yellow
    logging.ERROR: "\033[31m",     # red
    logging.CRITICAL: "\033[35m",  # magenta
}


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------

class _ColourFormatter(logging.Formatter):
    """Console formatter — coloured level, dim timestamp, pretty extra data."""

    _FMT = "{dim}{asctime}{reset}  {colour}{bold}{level:<8}{reset}  {name}  {message}"

    def format(self, record: logging.LogRecord) -> str:
        colour = _LEVEL_COLOURS.get(record.levelno, "")
        level = record.levelname
        dim = _DIM
        bold = _BOLD
        reset = _RESET

        prefix = self._FMT.format(
            dim=dim,
            asctime=self.formatTime(record, "%H:%M:%S"),
            reset=reset,
            colour=colour,
            bold=bold,
            level=level,
            name=record.name,
            message=record.getMessage(),
        )

        # Append pretty-printed `data` if caller passed extra={"data": ...}
        data = getattr(record, "data", None)
        if data is not None:
            pretty = pprint.pformat(data, indent=2, width=100)
            indented = "\n".join(f"  {line}" for line in pretty.splitlines())
            prefix = f"{prefix}\n{_DIM}{indented}{_RESET}"

        if record.exc_info:
            prefix += "\n" + self.formatException(record.exc_info)

        return prefix


class _PlainFormatter(logging.Formatter):
    """File formatter — no colour codes, ISO timestamp, pretty extra data."""

    _FMT = "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s"

    def __init__(self) -> None:
        super().__init__(fmt=self._FMT, datefmt="%Y-%m-%d %H:%M:%S")

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        data = getattr(record, "data", None)
        if data is not None:
            pretty = pprint.pformat(data, indent=2, width=100)
            indented = "\n".join(f"  {line}" for line in pretty.splitlines())
            base = f"{base}\n{indented}"
        return base


# ---------------------------------------------------------------------------
# Root logger setup (runs once)
# ---------------------------------------------------------------------------

def _setup_root() -> None:
    root = logging.getLogger("sr-gen")
    if root.handlers:
        return  # already initialised

    root.setLevel(logging.DEBUG)

    # Console — INFO and above
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(_ColourFormatter())
    root.addHandler(console)

    # File — DEBUG and above, rotating 5 MB × 3
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(_PlainFormatter())
    root.addHandler(file_handler)


_setup_root()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_logger(name: str) -> logging.Logger:
    """Return a child logger under the 'sr-gen' root.

    Example:
        log = get_logger(__name__)   # → 'sr-gen.lib.chart'
    """
    # Strip leading 'src.' so names read as 'sr-gen.lib.chart', not 'sr-gen.src.lib.chart'
    clean = name.removeprefix("src.")
    return logging.getLogger(f"sr-gen.{clean}")
