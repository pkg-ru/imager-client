"""Benchmark for imager_client Python implementation.

Запуск из корня проекта:
    python docs/bench.py [iterations]

Измеряет клиентские операции (формирование URL/AssetType/HTML) — чистые
функции без HTTP. Админ-методы не бенчмаркастся.
"""
import os
import sys
import time

# Windows-консоли (cp1251 и др.) нужен UTF-8 для вывода "μs/op".
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.imager import Imager  # noqa: E402

imager = Imager({"baseURL": "https://cdn.example.com/"})


def bench(name, fn, iterations=100000):
    start = time.perf_counter()
    for _ in range(iterations):
        fn()
    elapsed = time.perf_counter() - start
    ops = iterations / elapsed
    us_per_op = (elapsed / iterations) * 1_000_000
    print(f"{name}: {ops:,.0f} ops/s, {us_per_op:.2f} μs/op")


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 100_000

    bench("GetAsset", lambda: imager.GetAsset("image.jpg", "200x200", "webp"), n)
    bench(
        "GetAssets",
        lambda: imager.GetAssets("image.jpg", ["200x200", "400x400"], ["webp", "avif"]),
        n,
    )
    bench("GetAssetPath", lambda: imager.GetAssetPath("image.jpg", "200x200", "webp"), n)
    bench(
        "GetAssetsHtml",
        lambda: imager.GetAssetsHtml("image.jpg", ["200x200", "400x400"], ["webp", "avif"]),
        n,
    )
