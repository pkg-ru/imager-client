<?php

declare(strict_types=1);

/**
 * Тест Twig-расширения imager.
 *
 * Проверяет, что imager_assets/imager_asset/imager_assets_raw дают
 * тот же результат, что и методы ядра Imager (GetAssetsHtml/GetAssetPath/GetAssets),
 * для набора args-кейсов с алиасами.
 *
 * Запуск: php packages/twig/test/test.php  (из корня проекта)
 */

define('PROJECT_DIR', dirname(__DIR__, 3));

// Автозагрузка ядра (как в test/test.php)
if (is_file(PROJECT_DIR . '/vendor/autoload.php')) {
    require PROJECT_DIR . '/vendor/autoload.php';
} else {
    require_once PROJECT_DIR . '/src/imager-php/ImagerTypes.php';
    require_once PROJECT_DIR . '/src/imager-php/Imager.php';
}

require_once PROJECT_DIR . '/packages/twig/src/ImagerTwigExtension.php';

use imagerClient\Imager;
use imagerTwig\ImagerTwigExtension;

$imager = new Imager(['baseURL' => '/test-png/', 'format' => 'webp', 'dpr' => 2]);
$ext = new ImagerTwigExtension($imager);

$failed = 0;
$total = 0;

function check(string $name, mixed $actual, mixed $expected): void
{
    global $failed, $total;
    $total++;
    if ($actual === $expected) {
        echo "[ok] $name\n";
    } else {
        $failed++;
        echo "[FAIL] $name\n";
        echo "  expected: " . json_encode($expected) . "\n";
        echo "  actual:   " . json_encode($actual) . "\n";
    }
}

// 1. imager_assets: src + width/height + dpr + format
check(
    'assets src+size+dpr+format',
    $ext->assets('/test.png', ['src' => '/test.png', 'width' => 200, 'height' => 200, 'dpr' => 2, 'format' => 'webp']),
    $imager->GetAssetsHtml('/test.png', ['width' => 200, 'height' => 200], 'webp', 2),
);

// 2. imager_assets: source + preset + formats + lazy + alt + class
check(
    'assets source+preset+formats+lazy',
    $ext->assets('/test.png', [
        'source' => '/test.png',
        'preset' => 'thumb',
        'formats' => ['webp', 'png'],
        'lazy' => true,
        'alt' => 'Фото',
        'class' => 'thumb',
    ]),
    $imager->GetAssetsHtml('/test.png', 'thumb', ['webp', 'png'], null, [
        'lazy' => true, 'alt' => 'Фото', 'class' => 'thumb',
    ]),
);

// 3. imager_assets: один формат → только <img>
check(
    'assets single format',
    $ext->assets('/test.png', ['src' => '/test.png', 'segment' => '200x200', 'format' => 'webp', 'dpr' => 3]),
    $imager->GetAssetsHtml('/test.png', '200x200', 'webp', 3),
);

// 4. imager_asset: URL основного варианта
check(
    'asset url',
    $ext->asset('/test.png', ['src' => '/test.png', 'preset' => 'thumb', 'format' => 'webp']),
    $imager->GetAssetPath('/test.png', 'thumb', 'webp'),
);

// 5. imager_assets_raw: массив AssetType
check(
    'assets raw count',
    count($ext->assetsRaw('/test.png', ['src' => '/test.png', 'segment' => '200x200', 'formats' => ['webp', 'png']])),
    2,
);

// 6. imager_assets: sizes → w-дескрипторы
check(
    'assets sizes w-descriptors',
    $ext->assets('/test.png', [
        'src' => '/test.png',
        'segment' => '200x200',
        'formats' => ['webp', 'png'],
        'dpr' => 3,
        'sizes' => '(max-width: 600px) 100vw, 50vw',
    ]),
    $imager->GetAssetsHtml('/test.png', '200x200', ['webp', 'png'], 3, [
        'sizes' => '(max-width: 600px) 100vw, 50vw',
    ]),
);

echo "---\n";
echo "twig: $total cases, " . ($total - $failed) . " passed, $failed failed\n";
if ($failed > 0) {
    exit(1);
}
