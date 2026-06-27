from __future__ import annotations

from typing import Dict, Optional


class BPTXError(Exception):
    """Base exception"""

    def __init__(self, message: str, details: Optional[Dict] = None) -> None:
        super().__init__(message)
        self.details = details or {}


class TemplateError(BPTXError):
    """Template-related errors"""

    pass


class ShapeError(BPTXError):
    """Shape not found or wrong type"""

    def __init__(self, shape_name: str, message: str) -> None:
        super().__init__(message)
        self.shape_name = shape_name
