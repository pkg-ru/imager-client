/**
 * Benchmark for imager-client TypeScript implementation.
 *
 * Запуск из корня проекта:
 *     npx tsx docs/bench.ts [iterations]
 *
 * Измеряет клиентские операции (формирование URL/AssetType/HTML) — чистые
 * функции без HTTP. Админ-методы не бенчмаркастся.
 */
import { Imager } from "../src/imager-ts/Imager";

const imager = new Imager({ baseURL: "https://cdn.example.com/" });

function bench(
    name: string,
    fn: () => void,
    iterations = 100_000,
): void {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    const elapsed = performance.now() - start;
    const ops = iterations / (elapsed / 1000);
    const us = (elapsed / iterations) * 1000;
    console.log(
        `${name}: ${ops.toLocaleString("en-US", { maximumFractionDigits: 0 })} ops/s, ${us.toFixed(2)} μs/op`,
    );
}

const n = process.argv[2] ? parseInt(process.argv[2], 10) : 100_000;

bench("GetAsset", () => imager.GetAsset("image.jpg", "200x200", "webp"), n);
bench(
    "GetAssets",
    () => imager.GetAssets("image.jpg", ["200x200", "400x400"], ["webp", "avif"]),
    n,
);
bench("GetAssetPath", () => imager.GetAssetPath("image.jpg", "200x200", "webp"), n);
bench(
    "GetAssetsHtml",
    () => imager.GetAssetsHtml("image.jpg", ["200x200", "400x400"], ["webp", "avif"]),
    n,
);
