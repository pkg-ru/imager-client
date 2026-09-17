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

/**
 * Форматы картинок, поддерживаемые сервисом. Всё, что не входит в этот
 * список (видео и прочее), при format="auto"/"" трактуется как не-картинка.
 */
const IMAGE_FORMATS = [
    'jpg' => true,
    'jpeg' => true,
    'png' => true,
    'webp' => true,
    'avif' => true,
    'heif' => true,
    'heic' => true,
    'apng' => true,
    'jxl' => true,
    'gif' => true,
];

/**
 * Нормализация формата: lower-case, jpeg → jpg.
 */
function normalize_format(string $format): string
{
    if ($format === 'jpeg') {
        return 'jpg';
    }
    return ctype_upper($format) ? strtolower($format) : $format;
}

/**
 * Резолв одного формата: "auto"/"" → исходный формат, если он картинка, иначе jpg.
 */
function resolve_format(string $format, string $source_format): string
{
    if ($format === 'auto' || $format === '') {
        return isset(IMAGE_FORMATS[$source_format]) ? $source_format : 'jpg';
    }
    return normalize_format($format);
}

/**
 * Дедупликация списка форматов (jpeg → jpg, первое вхождение сохраняет позицию).
 *
 * @param string[] $formats
 * @return string[]
 */
function dedupe_formats(array $formats): array
{
    $seen = [];
    $result = [];
    foreach ($formats as $fmt) {
        $fmt = normalize_format($fmt);
        if (!isset($seen[$fmt])) {
            $seen[$fmt] = true;
            $result[] = $fmt;
        }
    }
    return $result;
}
