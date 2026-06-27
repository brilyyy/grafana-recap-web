from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, List, Optional, Tuple

from pptx.dml.color import RGBColor
from pptx.util import Pt

from ._enums import TextAlign
from ._types import ImageSource, RGBTuple


@dataclass(frozen=True)
class Position:
    x: float  # inches
    y: float  # inches

    def to_emu(self) -> Tuple[int, int]:
        return (int(self.x * 914400), int(self.y * 914400))


@dataclass(frozen=True)
class Size:
    width: float  # inches
    height: float  # inches

    def to_emu(self) -> Tuple[int, int]:
        return (int(self.width * 914400), int(self.height * 914400))


@dataclass
class TextStyle:
    """Text formatting options"""

    bold: Optional[bool] = None
    italic: Optional[bool] = None
    size: Optional[float] = None  # points
    color: Optional[RGBTuple] = None
    font: Optional[str] = None
    align: Optional[TextAlign] = None

    def apply(self, run: Any, paragraph: Any = None) -> None:
        """Apply to a paragraph run. Pass paragraph to also apply alignment."""
        font = run.font

        if self.bold is not None:
            font.bold = self.bold
        if self.italic is not None:
            font.italic = self.italic
        if self.size is not None:
            font.size = Pt(self.size)
        if self.color is not None:
            font.color.rgb = RGBColor(*self.color)
        if self.font is not None:
            font.name = self.font
        if paragraph is not None and self.align is not None:
            paragraph.alignment = self.align.value


@dataclass
class TableStyle:
    """Per-section styling for a table replacement."""

    header_style: Optional[TextStyle] = None  # applied to every header cell
    row_style: Optional[TextStyle] = None  # applied to every data row cell
    #: When True, enable word wrap and tighten paragraph spacing on every cell.
    word_wrap: bool = False
    #: If set, set all four text frame margins (helps dense tables fit the placeholder).
    cell_margin_pt: Optional[float] = None


@dataclass
class TableData:
    """Table data"""

    headers: List[str]
    rows: List[List[str]]

    @property
    def shape(self) -> Tuple[int, int]:
        return (len(self.rows), len(self.headers))

    def flatten(self) -> List[List[str]]:
        return [self.headers] + self.rows


@dataclass
class Replacement:
    """Single replacement operation"""

    placeholder: str
    value: str
    style: Optional[TextStyle] = None


@dataclass
class ImageReplacement:
    """Image replacement config"""

    placeholder: str
    image_path: ImageSource  # file path or raw PNG bytes
    preserve_aspect: bool = True


@dataclass
class Result:
    """Operation result"""

    success: bool
    operation: str
    placeholder: str
    message: str
    timestamp: datetime = field(default_factory=datetime.now)

    def __bool__(self) -> bool:
        return self.success


@dataclass
class BatchResult:
    """Batch operation results"""

    total: int
    succeeded: int
    failed: int
    results: List[Result] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        return (self.succeeded / self.total * 100) if self.total else 0.0
