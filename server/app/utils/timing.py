from __future__ import annotations

from contextlib import contextmanager
from time import perf_counter
from typing import Callable, Iterator


@contextmanager
def measure_time() -> Iterator[Callable[[], float]]:
    """简单计时器。

    用法：
        with measure_time() as elapsed:
            ...
        print(elapsed())
    """
    start = perf_counter()

    def elapsed_ms() -> float:
        return round((perf_counter() - start) * 1000, 2)

    yield elapsed_ms
