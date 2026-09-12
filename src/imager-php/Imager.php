<?php

declare(strict_types=1);

namespace imagerClient;

/**
 * Imager — клиент микросервиса imager (PHP-реализация).
 *
 * Клиентская часть (GetAsset/GetAssets/GetAssetPath) — чистое построение
 * путей/URL без HTTP, без валидации и исключений, только конкатенация строк.
 * Админ-часть (AdminGenerate/AdminDelete) — стандартный HTTP-клиент (curl),
 * результат — bool по маппингу кодов ответа.
 *
 * Настройки:
 *   token    — токен админ-методов (только AdminGenerate/AdminDelete);
 *   dpr      — итоговое dpr по умолчанию (0 — не используется);
 *   format   — формат генерации по умолчанию ("");
 *   formats  — список форматов по умолчанию ([] → используется `format`);
 *   baseURL  — база URL ассетов, нормализована (всегда с `/` на конце);
 *   adminURL — база админ-API (без завершающего `/`).
 */
final class Imager
{
    /** @var string */
    private $token = "";
    /** @var int */
    private $dpr = 0;
    /** @var string */
    private $format = "";
    /** @var string[] */
    private $formats = [];
    /** @var string */
    private $baseURL = "/";
    /** @var string */
    private $adminURL = "";

    /**
     * @param array|null $options настройки
     */
    public function __construct($options = null)
    {
        $options = is_array($options) ? $options : [];

        // token
        $token = $options['token'] ?? null;
        $this->token = $token !== null ? (string)$token : "";

        // dpr
        $dpr = $options['dpr'] ?? null;
        $this->dpr = $dpr !== null ? (int)$dpr : 0;

        // format
        $fmt = $options['format'] ?? null;
        $this->format = $fmt !== null ? (string)$fmt : "";

        // formats
        $formats = $options['formats'] ?? null;
        if ($formats === null) {
            $this->formats = [];
        } else {
            $this->formats = [];
            foreach ((array)$formats as $f) {
                $this->formats[] = (string)$f;
            }
        }

        // baseURL — нормализация «…/» в конце
        $baseURL = $options['baseURL'] ?? null;
        if ($baseURL === null || $baseURL === "") {
            $this->baseURL = "/";
        } else {
            $baseURL = (string)$baseURL;
            $this->baseURL = substr($baseURL, -1) === "/" ? $baseURL : $baseURL . "/";
        }

        // adminURL — без завершающего `/`
        $adminURL = $options['adminURL'] ?? null;
        if ($adminURL === null || $adminURL === "") {
            $this->adminURL = "";
        } else {
            $this->adminURL = rtrim((string)$adminURL, '/');
        }
    }

    // ------------------------------------------------------------------ //
    //  Разбор source: (path, source_name, source_format)     //
    // ------------------------------------------------------------------ //

    /**
     * Отбрасывает ведущий `/`, отделяет path и расширение (в lower-case).
     *
     * @return array{0:string,1:string,2:string}
     */
    private static function splitSource(string $source): array
    {
        $source = (string)$source;
        $source = ltrim($source, "/");

        $lastSlash = strrpos($source, "/");
        if ($lastSlash !== false) {
            $path = substr($source, 0, $lastSlash);
            $file = substr($source, $lastSlash + 1);
        } else {
            $path = "";
            $file = $source;
        }

        $lastDot = strrpos($file, ".");
        if ($lastDot !== false) {
            $sourceName = substr($file, 0, $lastDot);
            $sourceFormat = strtolower(substr($file, $lastDot + 1));
        } else {
            $sourceName = $file;
            $sourceFormat = "";
        }

        return [$path, $sourceName, $sourceFormat];
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
            if ($height > 0) {
                return $width . "x" . $height;
            }
            return $width . "x";
        }
        if ($height > 0) {
            return "x" . $height;
        }
        return "x";
    }

    /**
     * → [is_size, width, height] — один проход по строке.
     *
     * @return array{0:bool,1:int,2:int}
     */
    private static function parseSizeString(string $segment): array
    {
        $pos = strpos($segment, "x");
        if ($pos === false) {
            return [false, 0, 0];
        }
        $left = substr($segment, 0, $pos);
        $right = substr($segment, $pos + 1);
        if (($left === "" || ctype_digit($left)) && ($right === "" || ctype_digit($right))) {
            $width = $left !== "" ? (int)$left : 0;
            $height = $right !== "" ? (int)$right : 0;
            return [true, $width, $height];
        }
        return [false, 0, 0];
    }

    /**
     * → [segment_str, is_size, width, height].
     *
     * @param mixed $segment
     *
     * @return array{0:string,1:bool,2:int,3:int}
     */
    private static function normalizeSegment($segment): array
    {
        if ($segment === null) {
            return ["x", true, 0, 0];
        }
        if (is_string($segment)) {
            [$isSize, $width, $height] = self::parseSizeString($segment);
            if ($isSize) {
                return [$segment, true, $width, $height];
            }
            return [$segment, false, 0, 0];
        }
        if (is_array($segment) && !array_is_list($segment)) {
            $width = isset($segment['width']) && $segment['width'] !== null ? (int)$segment['width'] : 0;
            $height = isset($segment['height']) && $segment['height'] !== null ? (int)$segment['height'] : 0;
            return [self::buildSize($width, $height), true, $width, $height];
        }
        if (is_array($segment)) {
            $width = (isset($segment[0]) && $segment[0] !== null) ? (int)$segment[0] : 0;
            $height = (isset($segment[1]) && $segment[1] !== null) ? (int)$segment[1] : 0;
            return [self::buildSize($width, $height), true, $width, $height];
        }
        // прочие типы → размер без размеров
        return ["x", true, 0, 0];
    }

    // ------------------------------------------------------------------ //
    //  dpr                                                   //
    // ------------------------------------------------------------------ //

    /**
     * Строка-цифра → число; < 1 → 0 (не используется); > 3 → 3.
     */
    private static function parseDpr($dpr): int
    {
        $number = (int)$dpr;
        if ($number < 1) {
            return 0;
        }
        if ($number > 3) {
            return 3;
        }
        return $number;
    }

    /**
     * Аргумент → настройки → 0.
     */
    private function resolveDpr($dpr): int
    {
        if ($dpr !== null) {
            return self::parseDpr($dpr);
        }
        return self::parseDpr($this->dpr);
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
        [$path, $sourceName, $sourceFormat] = self::splitSource((string)$source);
        [$segStr, $isSize, $width, $height] = self::normalizeSegment($segment);

        $outFormat = $format !== null && $format !== "" ? (string)$format : $this->format;
        if ($outFormat === "") {
            $outFormat = $sourceFormat;
        }

        $dprVal = $this->resolveDpr($dpr);
        $explicit = $dpr !== null;

        // --- Инварианты, вычисляемые ОДИН раз ---
        $name = $sourceFormat !== "" ? $sourceName . "-" . $sourceFormat : $sourceName;
        $prefix = $path !== "" ? $this->baseURL . $path . "/" . $name . "/" : $this->baseURL . $name . "/";

        // dpr — целевое значение: формирует ровно один вариант ассета
        $item = new AssetPath();
        if ($dprVal >= 2) {
            $item->path = $prefix . $segStr . "@" . $dprVal . "." . $outFormat;
            $item->dpr = $dprVal;
        } else {
            $item->path = $prefix . $segStr . "." . $outFormat;
            if ($explicit && $dprVal == 1) {
                $item->dpr = 1;
            }
        }
        if ($isSize && $width > 0) {
            $item->width = $dprVal >= 2 ? $width * $dprVal : $width;
        }
        if ($isSize && $height > 0) {
            $item->height = $dprVal >= 2 ? $height * $dprVal : $height;
        }

        $result = new AssetType();
        $result->type = mime_for($outFormat);
        $result->paths = [$item];
        if ($outFormat === $sourceFormat) {
            $result->source_format = true;
        }
        if ($outFormat === 'jpg' || $outFormat === 'jpeg' || $outFormat === 'gif' || $outFormat === 'png') {
            $result->all_support = true;
        }
        return $result;
    }

    /**
     * Декартово произведение segments × formats.
     *
     * @param mixed $segments Segment | Segment[] | null
     * @param mixed $formats  string | string[] | null
     * @param mixed $dprs
     *
     * @return AssetType[]
     */
    public function GetAssets($source, $segments = null, $formats = null, $dprs = null): array
    {
        // segments: не задан → [None] → "x"
        if ($segments === null) {
            $segList = [null];
        } elseif (is_array($segments) && array_is_list($segments)) {
            $segList = $segments;
        } else {
            $segList = [$segments];
        }

        // formats: аргумент → настройки formats → format → [исходный]
        $fmtList = [];
        if ($formats !== null) {
            if (is_string($formats)) {
                $fmtList = $formats !== "" ? [$formats] : [];
            } elseif (is_array($formats)) {
                foreach ($formats as $f) {
                    $fmtList[] = (string)$f;
                }
                if (count($formats) === 0) {
                    $fmtList = [];
                }
            }
        }
        $sourceParts = self::splitSource((string)$source);
        [, , $sourceFormat] = $sourceParts;
        if (!$fmtList) {
            if ($this->formats) {
                $fmtList = $this->formats;
            } elseif ($this->format !== "") {
                $fmtList = [$this->format];
            } else {
                $fmtList = $sourceFormat !== "" ? [$sourceFormat] : [""];
            }
        }

        $dprVal = $this->resolveDpr($dprs);
        $explicit = $dprs !== null;

        // --- Инварианты, вычисляемые ОДИН раз на весь вызов ---
        // 1. Префикс URL {baseURL}{path}/{name}-{srcfmt}/ — одинаков для всех путей.
        [$path, $sourceName] = $sourceParts;
        $name = $sourceFormat !== "" ? $sourceName . "-" . $sourceFormat : $sourceName;
        $prefix = $path !== "" ? $this->baseURL . $path . "/" . $name . "/" : $this->baseURL . $name . "/";
        // 2. Суффиксы dpr: [без суффикса, @2, @3] — константы.
        $maxSteps = $dprVal == 2 ? 2 : ($dprVal >= 3 ? 3 : 1);

        $result = [];
        foreach ($segList as $seg) {
            [$segStr, $isSize, $width, $height] = self::normalizeSegment($seg);
            // Базы URL для шагов 1..3: {prefix}{segStr}[@2|@3]. — один раз на segment.
            $bases = [
                $prefix . $segStr . ".",
                $prefix . $segStr . "@2.",
                $prefix . $segStr . "@3.",
            ];
            foreach ($fmtList as $fmt) {
                $effectiveFmt = $fmt !== "" ? $fmt : $sourceFormat;

                $paths = [];
                for ($step = 1; $step <= $maxSteps; $step++) {
                    $url = $bases[$step - 1] . $effectiveFmt;

                    $item = new AssetPath();
                    $item->path = $url;
                    if ($dprVal == 1 && $explicit) {
                        $item->dpr = 1;
                    } elseif ($step >= 2) {
                        $item->dpr = $step;
                    }
                    if ($isSize && $width > 0) {
                        $multiply = $step >= 2 ? $step : 1;
                        $item->width = $width * $multiply;
                    }
                    if ($isSize && $height > 0) {
                        $multiply = $step >= 2 ? $step : 1;
                        $item->height = $height * $multiply;
                    }
                    $paths[] = $item;
                }

                $asset = new AssetType();
                $asset->type = mime_for($effectiveFmt);
                $asset->paths = $paths;
                if ($effectiveFmt === $sourceFormat) {
                    $asset->source_format = true;
                }
                if ($effectiveFmt === 'jpg' || $effectiveFmt === 'jpeg' || $effectiveFmt === 'gif' || $effectiveFmt === 'png') {
                    $asset->all_support = true;
                }
                $result[] = $asset;
            }
        }

        return $result;
    }

    // ------------------------------------------------------------------ //
    //  HTML-генерация (GetAssetsHtml)                                    //
    // ------------------------------------------------------------------ //

    /** @var array<int, string> атрибуты, относящиеся к <img>, а не к <picture> */
    private const IMG_ATTRS = ['alt', 'sizes', 'loading', 'width', 'height', 'decoding', 'fetchpriority'];

    /**
     * Экранирование значения HTML-атрибута.
     */
    private static function htmlEscape($value): string
    {
        return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /**
     * Число → строка дескриптора: 1 → "1", 1.5 → "1.5" (без хвостовых нулей).
     */
    private static function fmtDescriptor($value): string
    {
        if ((float)$value === (float)(int)$value) {
            return (string)(int)$value;
        }
        $s = number_format((float)$value, 2, '.', '');
        $s = rtrim($s, '0');
        return rtrim($s, '.');
    }

    /**
     * srcset для списка путей одного типа.
     *
     * useWidth → w-дескрипторы по AssetPath.width; иначе dpr-дескрипторы:
     * из AssetPath.dpr, а если dpr нет — из отношения height (или width)
     * к базовому (первому) значению (дробные допустимы).
     *
     * @param AssetPath[] $paths
     */
    private static function buildSrcset(array $paths, bool $useWidth): string
    {
        $baseWidth = 0;
        $baseHeight = 0;
        foreach ($paths as $item) {
            if ($baseWidth === 0 && $item->width !== null && $item->width > 0) {
                $baseWidth = $item->width;
            }
            if ($baseHeight === 0 && $item->height !== null && $item->height > 0) {
                $baseHeight = $item->height;
            }
        }
        $parts = [];
        foreach ($paths as $item) {
            if ($useWidth && $item->width !== null && $item->width > 0) {
                $desc = $item->width . 'w';
            } elseif ($item->dpr !== null && $item->dpr > 0) {
                $desc = self::fmtDescriptor($item->dpr) . 'x';
            } elseif ($baseHeight > 0 && $item->height !== null && $item->height > 0) {
                $desc = self::fmtDescriptor($item->height / $baseHeight) . 'x';
            } elseif ($baseWidth > 0 && $item->width !== null && $item->width > 0) {
                $desc = self::fmtDescriptor($item->width / $baseWidth) . 'x';
            } else {
                $desc = '1x';
            }
            $parts[] = $item->path . ' ' . $desc;
        }
        return implode(', ', $parts);
    }

    /**
     * Рендер атрибутов: true → имя без значения, false → пропуск, иначе name="value".
     *
     * @param array<string, mixed> $attrs
     */
    private static function renderAttrs(array $attrs): string
    {
        ksort($attrs);
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
     * HTML <picture>/<img> по декартову произведению segments × formats.
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
        $assets = $this->GetAssets($source, $segments, $formats, $dprs);
        if (!$assets) {
            return "";
        }

        $options = is_array($options) ? $options : [];
        $useWidth = array_key_exists('sizes', $options) && $options['sizes'] !== null;

        // lazy → loading="lazy"
        if (!empty($options['lazy'])) {
            if (!isset($options['loading']) || $options['loading'] === null) {
                $options['loading'] = 'lazy';
            }
        }
        unset($options['lazy']);

        // явные img-атрибуты (приоритет над перенаправленными)
        $explicit = is_array($options['imgAttrs'] ?? null) ? $options['imgAttrs'] : [];
        unset($options['imgAttrs']);

        // Разделение атрибутов: img-атрибуты vs атрибуты <picture>
        // (ksort в renderAttrs — детерминированный порядок вывода)
        $imgAttrs = [];
        $picAttrs = [];
        foreach ($options as $key => $value) {
            if (in_array($key, self::IMG_ATTRS, true)) {
                $imgAttrs[$key] = $value;
            } else {
                $picAttrs[$key] = $value;
            }
        }
        // merge: перенаправленные + явные (явные имеют приоритет)
        foreach ($explicit as $key => $value) {
            $imgAttrs[$key] = $value;
        }

        // Группировка по типу (формату): пути всех сегментов одного формата
        // объединяются в один srcset внутри одного <source>/<img>.
        $groups = [];
        $byType = [];
        foreach ($assets as $asset) {
            $mime = $asset->type;
            if (!isset($byType[$mime])) {
                $byType[$mime] = [
                    'type' => $mime,
                    'paths' => [],
                    'source_format' => false,
                    'all_support' => false,
                ];
                $groups[] =& $byType[$mime];
            }
            foreach ($asset->paths as $p) {
                $byType[$mime]['paths'][] = $p;
            }
            if ($asset->source_format === true) {
                $byType[$mime]['source_format'] = true;
            }
            if ($asset->all_support === true) {
                $byType[$mime]['all_support'] = true;
            }
        }
        unset($byType);

        // Выбор группы для <img>:
        // 1) source_format=true; 2) первая all_support=true; 3) последняя.
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

        // <img>
        $img = ' src="' . self::htmlEscape($base->path) . '"';
        if (count($imgPaths) > 1) {
            $img .= ' srcset="' . self::htmlEscape(self::buildSrcset($imgPaths, $useWidth)) . '"';
        }
        ksort($imgAttrs);
        foreach ($imgAttrs as $name => $value) {
            if ($value === true) {
                $img .= ' ' . $name;
            } elseif ($value === false || $value === null) {
                continue;
            } else {
                $img .= ' ' . $name . '="' . self::htmlEscape($value) . '"';
            }
        }
        // width/height для CLS из базового path — только если пользователь
        // не задал свои (напрямую или через imgAttrs): без дублирования.
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
            $html .= "\n    " . '<source type="' . self::htmlEscape($group['type']) . '"';
            if (count($group['paths']) > 1) {
                $html .= ' srcset="' . self::htmlEscape(self::buildSrcset($group['paths'], $useWidth)) . '"';
            } else {
                $html .= ' src="' . self::htmlEscape($group['paths'][0]->path) . '"';
            }
            $html .= '>';
        }
        $html .= "\n    " . $imgHtml . "\n</picture>";
        return $html;
    }

    /**
     * URL ассета для целевого dpr (суффикс `@dpr` при dpr >= 2).
     *
     * @param mixed $segment
     * @param mixed $format
     * @param mixed $dpr
     */
    public function GetAssetPath($source, $segment = null, $format = null, $dpr = null): string
    {
        [$path, $sourceName, $sourceFormat] = self::splitSource((string)$source);
        [$segStr] = self::normalizeSegment($segment);

        $outFormat = $format !== null && $format !== "" ? (string)$format : $this->format;
        if ($outFormat === "") {
            $outFormat = $sourceFormat;
        }

        $dprVal = $this->resolveDpr($dpr);
        if ($dprVal >= 2) {
            $segStr = $segStr . "@" . $dprVal;
        }

        $name = $sourceFormat !== "" ? $sourceName . "-" . $sourceFormat : $sourceName;
        $prefix = $path !== "" ? $this->baseURL . $path . "/" . $name . "/" : $this->baseURL . $name . "/";
        return $prefix . $segStr . "." . $outFormat;
    }

    // ------------------------------------------------------------------ //
    //  Админ-методы (HTTP через curl)                                    //
    // ------------------------------------------------------------------ //

    /**
     * Общий админ-запрос; пустой token/adminURL → false без HTTP.
     *
     * target:
     *   string          → режим A: {"source": ...}
     *   AssetType       → режим B: {"assets": [paths[].path]}
     *   AssetType[]     → режим B: {"assets": [paths[].path из ВСЕХ AssetType]}
     *   string[]        → режим B: {"assets": [элементы как есть]}
     *
     * @param AssetType|AssetType[]|string[]|string $target
     */
    private function adminRequest($target, bool $wait, string $endpoint, string $method): bool
    {
        if ($this->token === "" || $this->adminURL === "") {
            return false;
        }

        if (is_string($target)) {
            // режим A: source-строка как есть
            $body = ["source" => $target];
        } else {
            // режим B: собираем список assets
            $assets = [];
            if (is_array($target)) {
                if (array_is_list($target) && count($target) > 0 && is_string($target[0])) {
                    // string[] — пути как есть, без валидации и преобразований
                    foreach ($target as $p) {
                        $assets[] = (string)$p;
                    }
                } elseif (array_is_list($target)) {
                    // AssetType[] — path'ы всех AssetType подряд
                    foreach ($target as $at) {
                        if ($at instanceof AssetType) {
                            foreach ($at->paths as $p) {
                                $assets[] = $p->path;
                            }
                        } elseif (is_array($at) && isset($at['paths']) && is_array($at['paths'])) {
                            foreach ($at['paths'] as $p) {
                                $assets[] = is_array($p) && isset($p['path']) ? (string)$p['path'] : "";
                            }
                        }
                    }
                } else {
                    // ассоциативный массив — один AssetType
                    if (isset($target['paths']) && is_array($target['paths'])) {
                        foreach ($target['paths'] as $p) {
                            $assets[] = is_array($p) && isset($p['path']) ? (string)$p['path'] : "";
                        }
                    }
                }
            } elseif ($target instanceof AssetType) {
                foreach ($target->paths as $p) {
                    $assets[] = $p->path;
                }
            }
            $body = ["assets" => $assets];
        }
        $body['wait'] = $wait;

        $url = $this->adminURL . $endpoint;
        $json = json_encode($body);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer " . $this->token,
                "Content-Type: application/json",
            ],
            CURLOPT_TIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $response = curl_exec($ch);
        if ($response === false) {
            curl_close($ch);
            return false;
        }
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($endpoint === "/admin/assets/delete") {
            return $code === 200;
        }
        return $code === 200 || $code === 202;
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
