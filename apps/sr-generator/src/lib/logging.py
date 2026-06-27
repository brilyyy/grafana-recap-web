"""Application logging — console + rotating file output.

Two loggers:

- ``get_logger(name)`` → ``sr-gen.<name>``  — main app logger (coloured console + file)
- ``get_pipeline_logger(name)`` → ``sr-gen.pipeline.<name>`` — pipeline logger (file + console)

Usage::

    from lib.logging import get_logger
    log = get_logger(__name__)
    log.info("Processing %d records", len(records))
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
PIPELINE_LOG_FILE = LOGS_DIR / "sr_generator.log"

# ---------------------------------------------------------------------------
# ANSI colour helpers
# ---------------------------------------------------------------------------

_RESET = "\033[0m"
_BOLD = "\033[1m"
_DIM = "\033[2m"

_LEVEL_COLOURS: dict[int, str] = {
    logging.DEBUG: "\033[36m",
    logging.INFO: "\033[32m",
    logging.WARNING: "\033[33m",
    logging.ERROR: "\033[31m",
    logging.CRITICAL: "\033[35m",
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

        data = getattr(record, "data", None)
        if data is not None:
            pretty = pprint.pformat(data, indent=2, width=100)
            indented = "\n".join(f"  {line}" for line in pretty.splitlines())
            prefix = f"{prefix}\n{_DIM}{indented}{_RESET}"

        if record.exc_info:
            prefix += "\n" + self.formatException(record.exc_info)

        return prefix


class _PlainFormatter(logging.Formatter):
    """File formatter — no colour codes, ISO timestamp."""

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
        return

    root.setLevel(logging.DEBUG)

    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(_ColourFormatter())
    root.addHandler(console)

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
# Pipeline logger (separate file for generator runs)
# ---------------------------------------------------------------------------

_PIPELINE_LOGGER_NAME = "sr-gen.pipeline"


def _setup_pipeline_logger() -> logging.Logger:
    logger = logging.getLogger(_PIPELINE_LOGGER_NAME)
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)
    logger.propagate = False

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    file_handler = RotatingFileHandler(
        PIPELINE_LOG_FILE,
        maxBytes=2 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter("%(levelname)s %(message)s"))

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    return logger


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_logger(name: str) -> logging.Logger:
    """Return a child logger under the ``sr-gen`` root.

    Example::

        log = get_logger(__name__)   # → sr-gen.lib.chart
    """
    clean = name.removeprefix("src.")
    return logging.getLogger(f"sr-gen.{clean}")


def get_pipeline_logger(name: str = "app") -> logging.Logger:
    """Return a logger for the generation pipeline.

    Writes to a separate log file (``sr_generator.log``).
    """
    _setup_pipeline_logger()
    return logging.getLogger(f"{_PIPELINE_LOGGER_NAME}.{name}")
