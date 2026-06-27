from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler

from constants import BASE_DIR

_LOGGER_NAME = "sr-gen-gui"


def setup_gui_logger() -> logging.Logger:
    logger = logging.getLogger(_LOGGER_NAME)
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)
    logger.propagate = False

    logs_dir = BASE_DIR / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    logfile = logs_dir / "sr_generator.log"

    file_handler = RotatingFileHandler(
        logfile,
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


def get_gui_logger(name: str = "app") -> logging.Logger:
    setup_gui_logger()
    return logging.getLogger(f"{_LOGGER_NAME}.{name}")
