from __future__ import annotations

from collections.abc import Callable

# pylint: disable=broad-exception-caught


class CleanupRegistry:
    """Best-effort cleanup stack executed in LIFO order."""

    def __init__(self) -> None:
        self._actions: list[Callable[[], None]] = []

    def add(self, action: Callable[..., None], *args, **kwargs) -> None:
        def _runner() -> None:
            action(*args, **kwargs)

        self._actions.append(_runner)

    def run(self) -> None:
        while self._actions:
            action = self._actions.pop()
            try:
                action()
            except Exception:
                # Cleanup should never mask integration assertion failures.
                continue
