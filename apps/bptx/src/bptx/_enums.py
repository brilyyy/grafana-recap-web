from __future__ import annotations

from enum import Enum, auto

from pptx.enum.text import PP_ALIGN


class ContentType(Enum):
    TEXT = auto()
    IMAGE = auto()
    TABLE = auto()


class TextAlign(Enum):
    LEFT = PP_ALIGN.LEFT
    CENTER = PP_ALIGN.CENTER
    RIGHT = PP_ALIGN.RIGHT
    JUSTIFY = PP_ALIGN.JUSTIFY
