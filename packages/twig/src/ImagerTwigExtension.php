<?php

declare(strict_types=1);

namespace imagerTwig;

use imagerClient\Imager;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

/**
 * Twig-расширение для микросервиса Imager.
 *
 * Функции:
 * - imager_assets(source, args) — HTML <picture>/<img> (GetAssetsHtml);
 * - imager_asset(source, args)  — URL основного варианта (GetAssetPath);
 * - imager_assets_raw(source, args) — массив AssetType (GetAssets).
 *
 * args — ассоциативный массив с алиасами:
 *   src|source, preset|segment|width/height, format|formats, dpr|dprs,
 *   остальное — HTML-атрибуты (alt, class, sizes, lazy, ...).
 */
final class ImagerTwigExtension extends AbstractExtension
{
    private Imager $imager;

    /** @param Imager|array|null $imager инстанс или options для конструктора */
    public function __construct($imager = null)
    {
        if ($imager instanceof Imager) {
            $this->imager = $imager;
        } else {
            $this->imager = new Imager(is_array($imager) ? $imager : []);
        }
    }

    public function getFunctions(): array
    {
        return [
            new TwigFunction('imager_assets', [$this, 'assets']),
            new TwigFunction('imager_asset', [$this, 'asset']),
            new TwigFunction('imager_assets_raw', [$this, 'assetsRaw']),
        ];
    }

    /** HTML <picture>/<img>. */
    public function assets(string $source, ?array $args = null): string
    {
        $call = self::normalize($args);
        return $this->imager->GetAssetsHtml(
            $call['source'],
            $call['segments'],
            $call['formats'],
            $call['dprs'],
            $call['options'],
        );
    }

    /** URL основного варианта. */
    public function asset(string $source, ?array $args = null): string
    {
        $call = self::normalize($args);
        return $this->imager->GetAssetPath(
            $call['source'],
            $call['segments'],
            $call['formats'],
            $call['dprs'],
        );
    }

    /** Массив AssetType (для своего рендера). */
    public function assetsRaw(string $source, ?array $args = null): array
    {
        $call = self::normalize($args);
        return $this->imager->GetAssets(
            $call['source'],
            $call['segments'],
            $call['formats'],
            $call['dprs'],
        );
    }

    /**
     * Нормализация алиасов args (аналог normalizeProps в TS-ядре).
     *
     * @param ?array $args
     *
     * @return array{source:string, segments:mixed, formats:mixed, dprs:mixed, options:array}
     */
    private static function normalize(?array $args): array
    {
        $args = is_array($args) ? $args : [];

        $source = $args['source'] ?? $args['src'] ?? '';

        // сегмент: segment > preset > width/height
        $segments = null;
        if (isset($args['segment']) && $args['segment'] !== null) {
            $segments = $args['segment'];
        } elseif (isset($args['preset']) && $args['preset'] !== null) {
            $segments = (string) $args['preset'];
        } elseif (isset($args['width']) || isset($args['height'])) {
            $seg = [];
            if (isset($args['width']) && $args['width'] !== null) {
                $seg['width'] = (int) $args['width'];
            }
            if (isset($args['height']) && $args['height'] !== null) {
                $seg['height'] = (int) $args['height'];
            }
            $segments = $seg;
        }

        $formats = $args['formats'] ?? $args['format'] ?? null;
        $dprs = $args['dprs'] ?? $args['dpr'] ?? null;

        // остаток — HTML-атрибуты
        $reserved = ['source', 'src', 'segment', 'preset', 'width', 'height',
            'format', 'formats', 'dpr', 'dprs', 'imager'];
        $options = [];
        foreach ($args as $key => $value) {
            if (!in_array($key, $reserved, true)) {
                $options[$key] = $value;
            }
        }

        return [
            'source' => $source,
            'segments' => $segments,
            'formats' => $formats,
            'dprs' => $dprs,
            'options' => $options,
        ];
    }
}
