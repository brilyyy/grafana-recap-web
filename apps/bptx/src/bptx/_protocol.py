from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from ._models import Result
from ._types import InputT


@runtime_checkable
class Handler(Protocol[InputT]):
    """
    Runtime-checkable handler interface.

    Each concrete handler (TextHandler, ImageHandler, TableHandler) satisfies
    this protocol structurally. When a ChartHandler or other future handler is
    added, TemplateEngine can hold a list[Handler[Any]] and dispatch via
    can_handle() instead of explicit attributes.
    """

    def can_handle(self, shape: Any) -> bool: ...
    def replace(self, shape: Any, data: InputT) -> Result: ...
