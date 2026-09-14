<?php

declare(strict_types=1);

namespace imagerClient;

/**
 * Один вариант ассета внутри `paths`.
 */
final class AssetPath
{
    /** Полный URL ассета (всегда). */
    public string $path = "";

    public ?float $dpr = null;
    public ?int $width = null;
    public ?int $height = null;
}

/**
 * Результат GetAsset / элемента списка GetAssets.
 */
final class AssetType
{
    /** MIME итогового формата. */
    public string $type = '';
    /** @var AssetPath[] */
    public array $paths = [];

    /** Итоговый формат совпадает с исходным форматом файла. */
    public ?bool $source_format = null;

    /** Формат поддерживается всеми браузерами (jpg/jpeg/gif/png). */
    public ?bool $all_support = null;
}

/**
 * MIME по итоговому формату.
 */
function mime_for(string $format): string
{
    return 'image/' . ($format === 'jpg' ? 'jpeg' : $format);
}
