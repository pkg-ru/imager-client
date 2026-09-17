<?php

/**
 * Benchmark for pkg-ru/imager-client PHP implementation.
 *
 * Запуск из корня проекта:
 *     php docs/bench.php [iterations]
 *
 * Измеряет клиентские операции (формирование URL/AssetType/HTML) — чистые
 * функции без HTTP. Админ-методы не бенчмаркастся.
 */

require_once __DIR__ . '/../vendor/autoload.php';

use imagerClient\Imager;

$imager = new Imager(['baseURL' => 'https://cdn.example.com/']);

function bench(string $name, callable $fn, int $iterations = 100000): void
{
    $start = hrtime(true);
    for ($i = 0; $i < $iterations; $i++) {
        $fn();
    }
    $elapsed = (hrtime(true) - $start) / 1e9;
    $ops = $iterations / $elapsed;
    $us = ($elapsed / $iterations) * 1_000_000;
    printf("%s: %s ops/s, %.2f μs/op\n", $name, number_format($ops, 0), $us);
}

$n = isset($argv[1]) ? (int) $argv[1] : 100_000;

bench("GetAsset", fn () => $imager->GetAsset("image.jpg", "200x200", "webp"), $n);
bench(
    "GetAssets",
    fn () => $imager->GetAssets("image.jpg", ["200x200", "400x400"], ["webp", "avif"]),
    $n
);
bench("GetAssetPath", fn () => $imager->GetAssetPath("image.jpg", "200x200", "webp"), $n);
bench(
    "GetAssetsHtml",
    fn () => $imager->GetAssetsHtml("image.jpg", ["200x200", "400x400"], ["webp", "avif"]),
    $n
);
