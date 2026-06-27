"""
bptx — Business PowerPoint Template Framework
Template-based PowerPoint automation using python-pptx. No PowerPoint installation required.

Public API::
    from bptx import BPTX, template, new_presentation
    from bptx import TextStyle, TableData, TableStyle, Result, BatchResult, Position, Size
    from bptx import TextAlign, BPTXError, TemplateError, ShapeError
"""

from ._convenience import new_presentation, template
from ._enums import TextAlign
from ._exceptions import BPTXError, ShapeError, TemplateError
from ._framework import BPTX
from ._models import (
    BatchResult,
    Position,
    Result,
    Size,
    TableData,
    TableStyle,
    TextStyle,
)

__all__ = [
    # Core
    "BPTX",
    "template",
    "new_presentation",
    # Models
    "TextStyle",
    "TableData",
    "TableStyle",
    "Result",
    "BatchResult",
    "Position",
    "Size",
    # Enums
    "TextAlign",
    # Exceptions
    "BPTXError",
    "TemplateError",
    "ShapeError",
]
