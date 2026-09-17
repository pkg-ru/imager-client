<?php

declare(strict_types=1);

namespace imagerClient;

final class Imager
{
    private string $token = '';
    private int $dpr = 0;
    private string $format = '';
    /** @var string[] */
    private array $formats = [];
    private string $baseURL = '/';
    private string $adminURL = '';
    private bool $sort = false;

    private const IMG_ATTRS = [
        'alt' => true,
        'sizes' => true,
        'loading' => true,
        'width' => true,
        'height' => true,
        'decoding' => true,
        'fetchpriority' => true,
    ];

    private const ALL_SUPPORT = [
        'jpg' => true,
        'jpeg' => true,
        'gif' => true,
        'png' => true,
    ];

    public function __construct($options = null)
    {
        if (!is_array($options)) {
            $options = [];
        }

        $token = $options['token'] ?? null;
        $this->token = $token !== null ? (string) $token : '';

        $dpr = $options['dpr'] ?? null;
        $this->dpr = $dpr !== null ? (int) $dpr : 0;

        $format = $options['format'] ?? null;
        $this->format = $format !== null ? (string) $format : '';

        $formats = $options['formats'] ?? null;
        if ($formats !== null) {
            foreach ((array) $formats as $f) {
                $this->formats[] = (string) $f;
            }
        }

        $baseURL = $options['baseURL'] ?? null;
        if ($baseURL !== null && $baseURL !== '') {
            $baseURL = (string) $baseURL;
            $this->baseURL = substr($baseURL, -1) === '/' ? $baseURL : $baseURL . '/';
        }

        $adminURL = $options['adminURL'] ?? null;
        if ($adminURL !== null && $adminURL !== '') {
            $this->adminURL = rtrim((string) $adminURL, '/');
        }

        $sort = $options['sort'] ?? null;
        $this->sort = $sort !== null ? (bool) $sort : false;
    }

    /** @return array{0:string,1:string,2:string} */
    private static function splitSource(string $source): array
    {
        $source = ltrim($source, '/');
        $lastSlash = strrpos($source, '/');
        if ($lastSlash === false) {
            $path = '';
            $file = $source;
        } else {
            $path = substr($source, 0, $lastSlash);
            $file = substr($source, $lastSlash + 1);
        }

        $lastDot = strrpos($file, '.');
        if ($lastDot === false) {
            return [$path, $file, ''];
        }

        return [$path, substr($file, 0, $lastDot), strtolower(substr($file, $lastDot + 1))];
    }

    // ------------------------------------------------------------------ //
    //  Формализация сегмента                                 //
    // ------------------------------------------------------------------ //

    /**
     * Сборка сегмента из размеров: 200x200 / 200x / x200 / x.
     */
    private static function buildSize(int $width, int $height): string
    {
        if ($width > 0) {
            return $height > 0 ? $width . 'x' . $height : $width . 'x';
        }
        return $height > 0 ? 'x' . $height : 'x';
    }

    /** @return array{0:bool,1:int,2:int} */
    private static function parseSizeString(string $segment): array
    {
        $pos = strpos($segment, 'x');
        if ($pos === false) {
            return [false, 0, 0];
        }

        $left = substr($segment, 0, $pos);
        $right = substr($segment, $pos + 1);
        if (($left === '' || ctype_digit($left)) && ($right === '' || ctype_digit($right))) {
            return [true, $left === '' ? 0 : (int) $left, $right === '' ? 0 : (int) $right];
        }
        return [false, 0, 0];
    }

    /** @return array{0:string,1:bool,2:int,3:int} */
    private static function normalizeSegment($segment): array
    {
        if ($segment === null) {
            return ['x', true, 0, 0];
        }

        if (is_string($segment)) {
            [$isSize, $width, $height] = self::parseSizeString($segment);
            return $isSize ? [$segment, true, $width, $height] : [$segment, false, 0, 0];
        }

        if (is_array($segment)) {
            if (!array_is_list($segment)) {
                $width = isset($segment['width']) && $segment['width'] !== null ? (int) $segment['width'] : 0;
                $height = isset($segment['height']) && $segment['height'] !== null ? (int) $segment['height'] : 0;
            } else {
                $width = isset($segment[0]) && $segment[0] !== null ? (int) $segment[0] : 0;
                $height = isset($segment[1]) && $segment[1] !== null ? (int) $segment[1] : 0;
            }
            return [self::buildSize($width, $height), true, $width, $height];
        }

        return ['x', true, 0, 0];
    }

    /**
     * Сортирует нормализованные сегменты по width/height (стабильно).
     *
     * Правила:
     * - сегменты с width > 0 — по возрастанию width, при равенстве — по height;
     * - height = 0/отсутствует — в конец своей width-группы;
     * - сегменты без width (x400, thumb) — в самый конец, между собой
     *   не сортируются (сохраняют исходный порядок);
     * - если ни у одного сегмента нет ни width, ни height — не сортируем.
     *
     * @param array $segments array{0:string,1:bool,2:int,3:int}[]
     * @return array
     */
    private static function sortSegments(array $segments): array
    {
        $hasSize = false;
        foreach ($segments as $seg) {
            if ($seg[2] > 0 || $seg[3] > 0) {
                $hasSize = true;
                break;
            }
        }
        if (!$hasSize) {
            return $segments;
        }

        $withWidth = [];
        $withoutWidth = [];
        foreach ($segments as $seg) {
            if ($seg[2] > 0) {
                $withWidth[] = $seg;
            } else {
                $withoutWidth[] = $seg;
            }
        }

        // Сортировка вставками: стабильная и без внешних зависимостей.
        for ($i = 1; $i < count($withWidth); ++$i) {
            $key = $withWidth[$i];
            $j = $i - 1;
            while ($j >= 0 && self::compareSegments($withWidth[$j], $key) > 0) {
                $withWidth[$j + 1] = $withWidth[$j];
                --$j;
            }
            $withWidth[$j + 1] = $key;
        }

        $result = [];
        foreach ($withWidth as $seg) {
            $result[] = $seg;
        }
        foreach ($withoutWidth as $seg) {
            $result[] = $seg;
        }
        return $result;
    }

    /** Компаратор сегментов для usort: width, затем height (0 — в конец). */
    private static function compareSegments(array $a, array $b): int
    {
        if ($a[2] !== $b[2]) {
            return $a[2] < $b[2] ? -1 : 1;
        }
        $ah = $a[3] > 0 ? $a[3] : PHP_INT_MAX;
        $bh = $b[3] > 0 ? $b[3] : PHP_INT_MAX;
        if ($ah !== $bh) {
            return $ah < $bh ? -1 : 1;
        }
        return 0;
    }

    private static function parseDpr($dpr): int
    {
        $number = (int) $dpr;
        if ($number < 1) {
            return 0;
        }
        return $number > 3 ? 3 : $number;
    }

    private function resolveDpr($dpr): int
    {
        return self::parseDpr($dpr !== null ? $dpr : $this->dpr);
    }

    // ------------------------------------------------------------------ //
    //  Клиентские методы — без HTTP, без валидации, без исключений      //
    // ------------------------------------------------------------------ //

    /**
     * Один AssetType.
     *
     * @param mixed $segment строка | {width,height} | [w,h] | null
     * @param mixed $format
     * @param mixed $dpr
     */
    public function GetAsset($source, $segment = null, $format = null, $dpr = null): AssetType
    {
        [$path, $sourceName, $sourceFormat] = self::splitSource((string) $source);
        [$segStr, $isSize, $width, $height] = self::normalizeSegment($segment);
        $outFormat = resolve_format(
            ($format !== null && $format !== '') ? (string) $format : $this->format,
            $sourceFormat
        );
        $dprVal = self::parseDpr($dpr !== null ? $dpr : $this->dpr);

        $name = $sourceFormat !== '' ? $sourceName . '-' . $sourceFormat : $sourceName;
        $prefix = $path !== '' ? $this->baseURL . $path . '/' . $name . '/' : $this->baseURL . $name . '/';

        $item = new AssetPath();
        if ($dprVal >= 2) {
            $item->path = $prefix . $segStr . '@' . $dprVal . '.' . $outFormat;
            $item->dpr = $dprVal;
        } else {
            $item->path = $prefix . $segStr . '.' . $outFormat;
        }

        if ($isSize) {
            if ($width > 0) {
                $item->width = $dprVal >= 2 ? $width * $dprVal : $width;
            }
            if ($height > 0) {
                $item->height = $dprVal >= 2 ? $height * $dprVal : $height;
            }
        }

        $result = new AssetType();
        $result->type = mime_for($outFormat);
        $result->paths = [$item];
        if (normalize_format($outFormat) === normalize_format($sourceFormat)) {
            $result->source_format = true;
        }
        if ($outFormat === 'jpg' || $outFormat === 'jpeg' || $outFormat === 'gif' || $outFormat === 'png') {
            $result->all_support = true;
        }
        return $result;
    }

    /**
     * Сгруппированные ассеты по типу
     *
     * @param mixed $segments Segment | Segment[] | null
     * @param mixed $formats  string | string[] | null
     * @param mixed $dprs
     *
     * @return AssetType[]
     */
    public function GetAssets($source, $segments = null, $formats = null, $dprs = null): array
    {
        if ($segments === null) {
            $segList = [null];
        } elseif (is_array($segments) && array_is_list($segments)) {
            $segList = $segments;
        } else {
            $segList = [$segments];
        }

        $fmtList = [];
        if ($formats !== null) {
            if (is_string($formats)) {
                if ($formats !== '') {
                    $fmtList[] = $formats;
                }
            } elseif (is_array($formats)) {
                foreach ($formats as $f) {
                    $fmtList[] = (string) $f;
                }
            }
        }

        [$path, $sourceName, $sourceFormat] = self::splitSource((string) $source);
        if ($fmtList) {
            $fmtList = dedupe_formats(array_map(
                static fn (string $f): string => resolve_format($f, $sourceFormat),
                $fmtList
            ));
        } elseif ($this->formats) {
            $fmtList = dedupe_formats(array_map(
                static fn (string $f): string => resolve_format($f, $sourceFormat),
                $this->formats
            ));
        } elseif ($this->format !== '') {
            $fmtList = [resolve_format($this->format, $sourceFormat)];
        } else {
            $fmtList = [resolve_format('', $sourceFormat)];
        }

        $dprVal = $this->resolveDpr($dprs);
        $maxSteps = $dprVal === 2 ? 2 : ($dprVal >= 3 ? 3 : 1);

        $name = $sourceFormat !== '' ? $sourceName . '-' . $sourceFormat : $sourceName;
        $prefix = $path !== '' ? $this->baseURL . $path . '/' . $name . '/' : $this->baseURL . $name . '/';

        $normalizedSegments = [];
        foreach ($segList as $seg) {
            $normalizedSegments[] = self::normalizeSegment($seg);
        }
        if ($this->sort) {
            $normalizedSegments = self::sortSegments($normalizedSegments);
        }

        $baseWidth = 0;
        $baseHeight = 0;
        foreach ($normalizedSegments as $normalized) {
            if ($baseWidth === 0 && $normalized[2] > 0) {
                $baseWidth = $normalized[2];
            }
            if ($baseHeight === 0 && $normalized[3] > 0) {
                $baseHeight = $normalized[3];
            }
        }

        $hasGt1 = false;
        if ($baseWidth > 0 || $baseHeight > 0) {
            foreach ($normalizedSegments as $normalized) {
                $width = $normalized[2];
                $height = $normalized[3];
                if ($width > 0 && $baseWidth > 0) {
                    $ratio = $width / $baseWidth;
                    if ($ratio * $maxSteps > 1) {
                        $hasGt1 = true;
                        break;
                    }
                } elseif ($height > 0 && $baseHeight > 0) {
                    $ratio = $height / $baseHeight;
                    if ($ratio * $maxSteps > 1) {
                        $hasGt1 = true;
                        break;
                    }
                }
            }
        }

        // Формат вычисляется один раз; дальше hot loop работает только с готовыми строками.
        $effectiveFormats = [];
        $mimes = [];
        $sourceFlags = [];
        $supportFlags = [];
        foreach ($fmtList as $fmt) {
            $effective = $fmt;
            $effectiveFormats[] = $effective;
            $mimes[] = mime_for($effective);
            $sourceFlags[] = normalize_format($effective) === normalize_format($sourceFormat);
            $supportFlags[] = isset(self::ALL_SUPPORT[$effective]);
        }

        $formatCount = count($effectiveFormats);
        $pathsByFormat = array_fill(0, $formatCount, []);

        foreach ($normalizedSegments as $normalized) {
            [$segStr, $isSize, $width, $height] = $normalized;

            for ($step = 1; $step <= $maxSteps; ++$step) {
                $mult = $step >= 2 ? $step : 1;
                $scaledWidth = $isSize && $width > 0 ? $width * $mult : null;
                $scaledHeight = $isSize && $height > 0 ? $height * $mult : null;
                $dpr = $step >= 2 ? $step : null;
                $isDimensional = $scaledWidth !== null || $scaledHeight !== null;
                if ($isDimensional) {
                    if ($scaledWidth !== null && $baseWidth > 0) {
                        $dpr = $scaledWidth / $baseWidth;
                    } elseif ($scaledHeight !== null && $baseHeight > 0) {
                        $dpr = $scaledHeight / $baseHeight;
                    } else {
                        $dpr = null;
                    }
                    if ($dpr !== null && $dpr == (int) $dpr) {
                        $dpr = (int) $dpr;
                    }
                    if ($dpr === 1 && !$hasGt1) {
                        $dpr = null;
                    }
                }

                $segmentBase = $prefix . $segStr . ($step >= 2 ? '@' . $step : '') . '.';
                for ($fi = 0; $fi < $formatCount; ++$fi) {
                    $item = new AssetPath();
                    $item->path = $segmentBase . $effectiveFormats[$fi];
                    if ($dpr !== null) {
                        $item->dpr = $dpr;
                    }
                    if ($scaledWidth !== null) {
                        $item->width = $scaledWidth;
                    }
                    if ($scaledHeight !== null) {
                        $item->height = $scaledHeight;
                    }
                    $pathsByFormat[$fi][] = $item;
                }
            }
        }

        $result = [];
        for ($fi = 0; $fi < $formatCount; ++$fi) {
            $asset = new AssetType();
            $asset->type = $mimes[$fi];
            $asset->paths = $pathsByFormat[$fi];
            if ($sourceFlags[$fi]) {
                $asset->source_format = true;
            }
            if ($supportFlags[$fi]) {
                $asset->all_support = true;
            }
            $result[] = $asset;
        }

        return $result;
    }

    private static function htmlEscape($value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function fmtDescriptor($value): string
    {
        if ((float) $value === (float) (int) $value) {
            return (string) (int) $value;
        }
        $s = number_format((float) $value, 2, '.', '');
        return rtrim(rtrim($s, '0'), '.');
    }

    /** @param AssetPath[] $paths */
    private static function buildSrcset(array $paths, bool $useWidth): string
    {
        $baseWidth = 0;
        $baseHeight = 0;
        $count = count($paths);

        for ($i = 0; $i < $count; ++$i) {
            $item = $paths[$i];
            if ($baseWidth === 0 && $item->width !== null && $item->width > 0) {
                $baseWidth = $item->width;
            }
            if ($baseHeight === 0 && $item->height !== null && $item->height > 0) {
                $baseHeight = $item->height;
            }
        }

        if ($useWidth) {
            $parts = [];
            for ($i = 0; $i < $count; ++$i) {
                $item = $paths[$i];
                if ($item->width === null || $item->width === 0) {
                    continue;
                }
                $parts[] = $item->path . ' ' . $item->width . 'w';
            }
            return implode(', ', $parts);
        }

        $maxDpr = 0.0;
        $hasDpr = false;
        for ($i = 0; $i < $count; ++$i) {
            $item = $paths[$i];
            if ($item->dpr !== null && $item->dpr > 0) {
                $hasDpr = true;
            }
            if (($item->width === null || $item->width === 0)
                && ($item->height === null || $item->height === 0)) {
                continue;
            }

            if ($item->dpr !== null && $item->dpr > 0) {
                $dpr = (float) $item->dpr;
            } elseif ($item->width !== null && $item->width > 0 && $baseWidth > 0) {
                $dpr = (float) $item->width / (float) $baseWidth;
            } elseif ($item->height !== null && $item->height > 0 && $baseHeight > 0) {
                $dpr = (float) $item->height / (float) $baseHeight;
            } else {
                continue;
            }
            if ($dpr > $maxDpr) {
                $maxDpr = $dpr;
            }
        }

        $parts = [];
        for ($i = 0; $i < $count; ++$i) {
            $item = $paths[$i];

            if ($item->dpr !== null && $item->dpr > 0
                && (($item->width !== null && $item->width > 0) || ($item->height !== null && $item->height > 0))) {
                $desc = self::fmtDescriptor($item->dpr) . 'x';
            } elseif ($baseHeight > 0 && $item->height !== null && $item->height > 0) {
                $desc = self::fmtDescriptor(round($item->height / $baseHeight, 2)) . 'x';
            } elseif ($baseWidth > 0 && $item->width !== null && $item->width > 0) {
                $desc = self::fmtDescriptor(round($item->width / $baseWidth, 2)) . 'x';
            } elseif (($item->width === null || $item->width === 0)
                && ($item->height === null || $item->height === 0)) {
                $dprStep = ($item->dpr !== null && $item->dpr > 0) ? $item->dpr : 1;
                if ($maxDpr > 0) {
                    $desc = self::fmtDescriptor(round(($maxDpr + 1) * $dprStep, 2)) . 'x';
                } elseif ($hasDpr) {
                    $desc = self::fmtDescriptor($dprStep) . 'x';
                } else {
                    $parts[] = $item->path;
                    continue;
                }
            } else {
                $desc = '1x';
            }

            $parts[] = $item->path . ' ' . $desc;
        }

        return implode(', ', $parts);
    }

    /** @param array<string,mixed> $attrs */
    private static function renderAttrs(array $attrs): string
    {
        if (!$attrs) {
            return '';
        }
        $out = '';
        foreach ($attrs as $name => $value) {
            if ($value === true) {
                $out .= ' ' . $name;
            } elseif ($value === false || $value === null) {
                continue;
            } else {
                $out .= ' ' . $name . '="' . self::htmlEscape($value) . '"';
            }
        }
        return $out;
    }

    /**
     * HTML <picture>/<img> по сгруппированным сегментам.
     *
     * options — HTML-атрибуты: class/id/... → <picture>,
     * alt/sizes/loading (lazy → loading="lazy") → <img>.
     *
     * @param mixed $segments
     * @param mixed $formats
     * @param mixed $dprs
     * @param array|null $options
     */
    public function GetAssetsHtml($source, $segments = null, $formats = null, $dprs = null, $options = null): string
    {
        if ($segments === null) {
            $segList = [null];
        } elseif (is_array($segments) && array_is_list($segments)) {
            $segList = $segments;
        } else {
            $segList = [$segments];
        }

        $fmtList = [];
        if ($formats !== null) {
            if (is_string($formats)) {
                if ($formats !== '') {
                    $fmtList[] = $formats;
                }
            } elseif (is_array($formats)) {
                foreach ($formats as $f) {
                    $fmtList[] = (string) $f;
                }
            }
        }

        [$path, $sourceName, $sourceFormat] = self::splitSource((string) $source);
        if ($fmtList) {
            $fmtList = dedupe_formats(array_map(
                static fn (string $f): string => resolve_format($f, $sourceFormat),
                $fmtList
            ));
        } elseif ($this->formats) {
            $fmtList = dedupe_formats(array_map(
                static fn (string $f): string => resolve_format($f, $sourceFormat),
                $this->formats
            ));
        } elseif ($this->format !== '') {
            $fmtList = [resolve_format($this->format, $sourceFormat)];
        } else {
            $fmtList = [resolve_format('', $sourceFormat)];
        }

        $dprVal = $this->resolveDpr($dprs);
        $maxSteps = $dprVal === 2 ? 2 : ($dprVal >= 3 ? 3 : 1);

        $options = is_array($options) ? $options : [];
        $useWidth = array_key_exists('sizes', $options) && $options['sizes'] !== null;

        if (!empty($options['lazy']) && (!isset($options['loading']) || $options['loading'] === null)) {
            $options['loading'] = 'lazy';
        }
        unset($options['lazy']);

        $explicit = is_array($options['imgAttrs'] ?? null) ? $options['imgAttrs'] : [];
        unset($options['imgAttrs']);

        $imgAttrs = [];
        $picAttrs = [];
        foreach ($options as $key => $value) {
            if (isset(self::IMG_ATTRS[$key])) {
                $imgAttrs[$key] = $value;
            } else {
                $picAttrs[$key] = $value;
            }
        }
        foreach ($explicit as $key => $value) {
            $imgAttrs[$key] = $value;
        }

        $normalizedSegments = [];
        $baseWidth = 0;
        $baseHeight = 0;
        foreach ($segList as $seg) {
            $normalized = self::normalizeSegment($seg);
            $normalizedSegments[] = $normalized;
            if ($baseWidth === 0 && $normalized[2] > 0) {
                $baseWidth = $normalized[2];
            }
            if ($baseHeight === 0 && $normalized[3] > 0) {
                $baseHeight = $normalized[3];
            }
        }

        $hasGt1 = false;
        if ($baseWidth > 0 || $baseHeight > 0) {
            foreach ($normalizedSegments as $normalized) {
                $width = $normalized[2];
                $height = $normalized[3];
                if ($width > 0 && $baseWidth > 0) {
                    if (($width / $baseWidth) * $maxSteps > 1) {
                        $hasGt1 = true;
                        break;
                    }
                } elseif ($height > 0 && $baseHeight > 0) {
                    if (($height / $baseHeight) * $maxSteps > 1) {
                        $hasGt1 = true;
                        break;
                    }
                }
            }
        }

        $prefixName = $sourceFormat !== '' ? $sourceName . '-' . $sourceFormat : $sourceName;
        $prefix = $path !== ''
            ? $this->baseURL . $path . '/' . $prefixName . '/'
            : $this->baseURL . $prefixName . '/';

        $groups = [];
        $groupIndex = [];

        foreach ($fmtList as $fmt) {
            $effectiveFmt = $fmt;
            $mime = mime_for($effectiveFmt);

            if (isset($groupIndex[$mime])) {
                $gi = $groupIndex[$mime];
                if (normalize_format($effectiveFmt) === normalize_format($sourceFormat)) {
                    $groups[$gi]['source_format'] = true;
                }
                if (isset(self::ALL_SUPPORT[$effectiveFmt])) {
                    $groups[$gi]['all_support'] = true;
                }
            } else {
                $gi = count($groups);
                $groupIndex[$mime] = $gi;
                $groups[] = [
                    'type' => $mime,
                    'paths' => [],
                    'source_format' => normalize_format($effectiveFmt) === normalize_format($sourceFormat),
                    'all_support' => isset(self::ALL_SUPPORT[$effectiveFmt]),
                ];
            }

            foreach ($normalizedSegments as $normalized) {
                [$segStr, $isSize, $width, $height] = $normalized;

                for ($step = 1; $step <= $maxSteps; ++$step) {
                    $mult = $step >= 2 ? $step : 1;
                    $scaledWidth = $isSize && $width > 0 ? $width * $mult : null;
                    $scaledHeight = $isSize && $height > 0 ? $height * $mult : null;

                    $item = new AssetPath();
                    $item->path = $prefix . $segStr . ($step >= 2 ? '@' . $step : '') . '.' . $effectiveFmt;
                    $itemDpr = $step >= 2 ? $step : null;
                    if ($scaledWidth !== null && $baseWidth > 0) {
                        $itemDpr = $scaledWidth / $baseWidth;
                        $itemDpr = $itemDpr == (int) $itemDpr ? (int) $itemDpr : $itemDpr;
                    } elseif ($scaledHeight !== null && $baseHeight > 0) {
                        $itemDpr = $scaledHeight / $baseHeight;
                        $itemDpr = $itemDpr == (int) $itemDpr ? (int) $itemDpr : $itemDpr;
                    } elseif ($scaledWidth === null && $scaledHeight === null) {
                        // Для x-путей исходный GetAssets сохраняет dpr шага (@2/@3).
                    } else {
                        $itemDpr = null;
                    }
                    if (($scaledWidth !== null || $scaledHeight !== null) && $itemDpr === 1 && !$hasGt1) {
                        $itemDpr = null;
                    }
                    if ($itemDpr !== null) {
                        $item->dpr = $itemDpr;
                    }
                    if ($scaledWidth !== null) {
                        $item->width = $scaledWidth;
                    }
                    if ($scaledHeight !== null) {
                        $item->height = $scaledHeight;
                    }
                    $groups[$gi]['paths'][] = $item;
                }
            }
        }

        if (!$groups) {
            return '';
        }

        $imgIndex = -1;
        foreach ($groups as $idx => $group) {
            if ($group['source_format']) {
                $imgIndex = $idx;
                break;
            }
        }
        if ($imgIndex < 0) {
            foreach ($groups as $idx => $group) {
                if ($group['all_support']) {
                    $imgIndex = $idx;
                    break;
                }
            }
        }
        if ($imgIndex < 0) {
            $imgIndex = count($groups) - 1;
        }

        $imgPaths = $groups[$imgIndex]['paths'];
        $base = $imgPaths[0];

        $img = ' src="' . self::htmlEscape($base->path) . '"';
        $imgSrcset = self::buildSrcset($imgPaths, $useWidth);
        if (count($imgPaths) > 1 && $imgSrcset !== '') {
            $img .= ' srcset="' . self::htmlEscape($imgSrcset) . '"';
        }

        if ($imgAttrs) {
            foreach ($imgAttrs as $name => $value) {
                if ($value === true) {
                    $img .= ' ' . $name;
                } elseif ($value === false || $value === null) {
                    continue;
                } else {
                    $img .= ' ' . $name . '="' . self::htmlEscape($value) . '"';
                }
            }
        }

        if ($base->width !== null && $base->width > 0 && !isset($imgAttrs['width'])) {
            $img .= ' width="' . $base->width . '"';
        }
        if ($base->height !== null && $base->height > 0 && !isset($imgAttrs['height'])) {
            $img .= ' height="' . $base->height . '"';
        }

        $imgHtml = '<img' . $img . '>';
        if (count($groups) === 1) {
            return $imgHtml;
        }

        $html = '<picture' . self::renderAttrs($picAttrs) . '>';
        foreach ($groups as $idx => $group) {
            if ($idx === $imgIndex) {
                continue;
            }
            $srcset = self::buildSrcset($group['paths'], $useWidth);
            if ($srcset === '') {
                continue;
            }
            $html .= '<source type="' . self::htmlEscape($group['type']) . '" srcset="'
                . self::htmlEscape($srcset) . '">';
        }
        return $html . $imgHtml . '</picture>';
    }

    public function GetAssetPath($source, $segment = null, $format = null, $dpr = null): string
    {
        [$path, $sourceName, $sourceFormat] = self::splitSource((string) $source);
        [$segStr] = self::normalizeSegment($segment);
        $outFormat = resolve_format(
            ($format !== null && $format !== '') ? (string) $format : $this->format,
            $sourceFormat
        );
        $dprVal = self::parseDpr($dpr !== null ? $dpr : $this->dpr);
        if ($dprVal >= 2) {
            $segStr .= '@' . $dprVal;
        }

        $name = $sourceFormat !== '' ? $sourceName . '-' . $sourceFormat : $sourceName;
        $prefix = $path !== '' ? $this->baseURL . $path . '/' . $name . '/' : $this->baseURL . $name . '/';
        return $prefix . $segStr . '.' . $outFormat;
    }

    private function adminRequest($target, bool $wait, string $endpoint, string $method): bool
    {
        if ($this->token === '' || $this->adminURL === '') {
            return false;
        }

        if (is_string($target)) {
            $body = ['source' => $target];
        } else {
            $assets = [];
            if (is_array($target)) {
                if (array_is_list($target) && isset($target[0]) && is_string($target[0])) {
                    foreach ($target as $p) {
                        $assets[] = (string) $p;
                    }
                } elseif (array_is_list($target)) {
                    foreach ($target as $at) {
                        if ($at instanceof AssetType) {
                            foreach ($at->paths as $p) {
                                $assets[] = $p->path;
                            }
                        } elseif (is_array($at) && isset($at['paths']) && is_array($at['paths'])) {
                            foreach ($at['paths'] as $p) {
                                $assets[] = is_array($p) && isset($p['path']) ? (string) $p['path'] : '';
                            }
                        }
                    }
                } elseif (isset($target['paths']) && is_array($target['paths'])) {
                    foreach ($target['paths'] as $p) {
                        $assets[] = is_array($p) && isset($p['path']) ? (string) $p['path'] : '';
                    }
                }
            } elseif ($target instanceof AssetType) {
                foreach ($target->paths as $p) {
                    $assets[] = $p->path;
                }
            }
            $body = ['assets' => $assets];
        }

        $body['wait'] = $wait;
        $json = json_encode($body);
        if ($json === false) {
            return false;
        }

        $ch = curl_init($this->adminURL . $endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->token,
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => false,
        ]);

        $response = curl_exec($ch);
        if ($response === false) {
            curl_close($ch);
            return false;
        }
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        return $endpoint === '/admin/assets/delete' ? $code === 200 : ($code === 200 || $code === 202);
    }

    /**
     * POST {adminURL}/admin/assets/generate → true на 200/202.
     *
     * @param AssetType|AssetType[]|string[]|string $target
     */
    public function AdminGenerate($target, bool $wait = false): bool
    {
        return $this->adminRequest($target, $wait, '/admin/assets/generate', 'POST');
    }

    /**
     * DELETE {adminURL}/admin/assets/delete → true на 200.
     *
     * @param AssetType|AssetType[]|string[]|string $target
     */
    public function AdminDelete($target, bool $wait = false): bool
    {
        return $this->adminRequest($target, $wait, '/admin/assets/delete', 'DELETE');
    }
}
