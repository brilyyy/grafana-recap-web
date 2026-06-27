from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from ._framework import BPTX
from ._types import PathLike


@contextmanager
def template(path: PathLike) -> Generator[BPTX, None, None]:
    """Context manager that loads an existing .pptx template"""
    b = BPTX()
    try:
        b.load(path)
        yield b
    finally:
        b.close()


@contextmanager
def new_presentation(
    width: float = 10, height: float = 7.5
) -> Generator[BPTX, None, None]:
    """Context manager that creates a blank presentation"""
    b = BPTX()
    try:
        b.new(width, height)
        yield b
    finally:
        b.close()
