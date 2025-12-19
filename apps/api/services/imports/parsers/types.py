from __future__ import annotations

from typing import Any, Dict, List, Tuple

NormalizedRow = Dict[str, Any]
ParseResult = Tuple[List[NormalizedRow], List[Tuple[int, str]]]

__all__ = ["NormalizedRow", "ParseResult"]
