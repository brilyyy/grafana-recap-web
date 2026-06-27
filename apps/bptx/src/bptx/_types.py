from __future__ import annotations

from pathlib import Path
from typing import Tuple, TypeVar, Union

PathLike = Union[str, Path]
ImageSource = Union[str, Path, bytes]  # path or raw PNG/image bytes
RGBTuple = Tuple[int, int, int]
Numeric = Union[int, float]

T = TypeVar("T")
InputT = TypeVar("InputT")
