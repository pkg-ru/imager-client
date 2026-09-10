<?php

declare(strict_types=1);

namespace imagerClient;

/**
 * Типы и структуры клиентской библиотеки imager.
 *
 * - AssetPath — один вариант ассета внутри `paths`;
 * - AssetType — результат GetAsset / элемента GetAssets;
 * - MIME-типы по итоговому формату.
 *
 * Порядок ключей в JSON-сериализации: path, dpr, width, height
 * (для идентичности golden-тестов).
 */
final class AssetPath
{
    /** Полный URL ассета (всегда). */
    public string $path = "";

    /** Итоговое dpr (включается при dpr >= 2 или явном dpr = 1). */
    public ?int $dpr = null;

    /** Ширина сегмента (только для size-сегмента; умножена на dpr при dpr >= 2). */
    public ?int $width = null;

    /** Высота сегмента (только для size-сегмента; умножена на dpr при dpr >= 2). */
    public ?int $height = null;
}

/**
 * Результат GetAsset / элемент списка GetAssets.
 */
final class AssetType
{
    /** MIME итогового формата; для видео/неизвестного — "". */
    public string $type = "";

    /** @var AssetPath[] */
    public array $paths = [];

    /** Итоговый формат совпадает с исходным форматом файла (в JSON только при true). */
    public ?bool $source_format = null;

    /** Формат поддерживается всеми браузерами (jpg/jpeg/gif/png) (в JSON только при true). */
    public ?bool $all_support = null;
}

/**
 * MIME по итоговому формату.
 *
 * @param string $format итоговый формат (output_format)
 *
 * @return string MIME-тип
 */
function mime_for(string $format): string
{
    if ($format == 'jpg') {
        $format = 'jpeg';
    }
    return "image/" . $format;
}
