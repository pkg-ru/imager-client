# Imager Client — PHP

**Imager** microservice client in PHP: asset path/URL building and admin methods.

- [Русская версия](./PHP-RU.md)
- [Overview](../README.md)

---

## Installation

Package `pkg-ru/imager-client` (Composer, PHP ≥ 8.1, requires `ext-curl`):

```bash
composer require pkg-ru/imager-client
```

Or in `composer.json`:

```json
{
    "require": {
        "pkg-ru/imager-client": "^1.0"
    }
}
```

PSR-4 autoloading: namespace `imagerClient\` → `src/imager-php/`. The types file `ImagerTypes.php` is loaded automatically (`autoload.files` section).

## Import

```php
use imagerClient\Imager;
use imagerClient\AssetType;
use imagerClient\AssetPath;
```

## Initialization

```php
$imager = new Imager(?array $options = null);
```

| Option | Type | Default | Description |
|---|---|---|---|
| `token` | `string` | `""` | admin method token (only `AdminGenerate`/`AdminDelete`) |
| `dpr` | `int` | `0` | default dpr; 0-1 = not used, 2-3 = used |
| `format` | `string` | `""` | default generation format (empty — source format) |
| `formats` | `string[]` | `[]` | default format list; if empty — `format` is used |
| `baseURL` | `string` | `"/"` | asset URL base; normalized (always trailing `/`) |
| `adminURL` | `string` | `""` | admin API base URL (no trailing `/`) |

`baseURL` normalization: empty/not set → `"/"`; missing trailing `/` → appended. `adminURL`: trailing `/` is stripped.

```php
$imager = new Imager([
    "baseURL" => "https://imgs.example.com/images",
    "format" => "webp",
    "dpr" => 2,
    "token" => "secret",
    "adminURL" => "https://imager.example.com",
]);
```

## Methods

### GetAsset

```php
public function GetAsset(
    string $source,
    Segment|array|string|null $segment = null,
    ?string $format = null,
    int|string|null $dpr = null
): AssetType;
```

Returns a **single** `AssetType`. `paths` contains all dpr variants from 1 to the final dpr.

| Parameter | Type | Description |
|---|---|---|
| `source` | `string` | path to the source (`/test.gif`, `test.gif`, `thumbs/photo.jpg`) |
| `segment` | `string` \| `{width,height}` \| `[w,h]` \| `null` | segment; not set → `"x"` |
| `format` | `?string` | output format; not set → `format` option → source format |
| `dpr` | `int` \| `string` \| `null` | final dpr; not set → `dpr` option; < 1 → not used |

### GetAssets

```php
public function GetAssets(
    string $source,
    mixed $segments = null,   // Segment | Segment[]
    mixed $formats = null,    // string | string[]
    int|string|null $dprs = null
): array;                     // AssetType[]
```

Returns a **list** of `AssetType` — Cartesian product of `segments × formats` (outer loop — segments). `segments` not set → `["x"]`. `formats` not set → `formats` option → `[format]` → `[source format]`.

### GetAssetsHtml

```php
public function GetAssetsHtml(
    string $source,
    mixed $segments = null,   // Segment | Segment[]
    mixed $formats = null,    // string | string[]
    int|string|null $dprs = null,
    ?array $options = null    // HTML attributes
): string;
```

Returns a **string** — HTML markup `<picture>`/`<img>` for the same Cartesian product `segments × formats` as `GetAssets`. A single call generates exactly one `<picture>` tag (or `<img>` if there is only one format).

`options` — HTML attributes:

| Attribute | Placement | Note |
|---|---|---|
| `class`, `id`, `data-*`, others | `<picture>` | — |
| `alt`, `sizes`, `loading` | `<img>` | — |
| `lazy` | `<img>` | boolean: becomes `loading="lazy"` |
| `width`, `height` | `<img>` | overridden by automatic values from the base path (for CLS) |

Rules:

- Attributes are output in alphabetical order of names (deterministic output).
- Boolean attributes (`lazy: true`, `loading: true`) — without a value; `false`/`null` — skipped.
- Values are HTML-escaped (`&` → `&`, `<` → `<`, `>` → `>`, `"` → `"`, `'` → `&#x27;`).
- Inside `<picture>` tags are divided by type (format): all paths of one format are merged into a single `srcset`.
- For `<img>` the group is chosen: 1) source format (`source_format: true`); 2) first universally supported (`all_support: true`); 3) the last one. The remaining formats become `<source type="...">`.
- `srcset` descriptors: if `sizes` is passed in `options` — `w`-descriptors by width (`200w`, `400w`); otherwise — `x`-descriptors by dpr (`1x`, `2x`, `3x`); if there is no dpr but height exists — dpr is computed from the height ratio (fractional allowed, e.g. `1.5x`); sizes are never auto-generated.
- `width`/`height` on `<img>` are added from the base (first) path when known — for CLS.
- If there are no assets — an empty string is returned.

Example:

```php
$html = $imager->GetAssetsHtml(
    "/test.png",
    "200x200",
    ["webp", "png"],
    2,
    ["class" => "photo", "id" => "main", "alt" => "Hello & <world>", "lazy" => true],
);
```

```html
<picture class="photo" id="main">
    <source type="image/webp" srcset="/test-png/200x200.webp 1x, /test-png/200x200@2.webp 2x">
    <img src="/test-png/200x200.png" srcset="/test-png/200x200.png 1x, /test-png/200x200@2.png 2x" alt="Hello & <world>" loading="lazy" width="200" height="200">
</picture>
```

### GetAssetPath

```php
public function GetAssetPath(
    string $source,
    mixed $segment = null,
    ?string $format = null,
    int|string|null $dpr = null
): string;
```

Returns a **string** — URL of the primary asset variant. Equivalent to `GetAsset(...)->paths[0]->path`.

### AdminGenerate

```php
public function AdminGenerate(AssetType|AssetType[]|string[]|string $target, bool $wait = false): bool;
```

`POST {adminURL}/admin/assets/generate`, header `Authorization: Bearer <token>`. Returns `true` on HTTP 200/202, otherwise `false`.

### AdminDelete

```php
public function AdminDelete(AssetType|AssetType[]|string[]|string $target, bool $wait = false): bool;
```

`DELETE {adminURL}/admin/assets/delete` — same body and header. Returns `true` on HTTP 200, otherwise `false`.

### `target` input type mapping

| `target` input type | Mode | Request body |
|---|---|---|
| `string` | A (source) | `{"source": "<string as-is>", "wait": ...}` |
| `AssetType` | B (assets) | `{"assets": [paths[].path from AssetType], "wait": ...}` |
| `AssetType[]` | B (assets) | `{"assets": [paths[].path from ALL AssetType, in order], "wait": ...}` |
| `string[]` | B (assets) | `{"assets": ["<item 1>", "<item 2>", ...], "wait": ...}` |

- `string` — mode A: the source path is passed to `source` as-is.
- `AssetType` / `AssetType[]` — mode B: all `paths[].path` are collected into a single `assets` list.
- `string[]` — mode B: the items are **already ready** asset paths, passed to `assets` **as-is**, without validation or transformations.

If `token` or `adminURL` is empty — admin methods return `false` **without** an HTTP request. HTTP client — `curl_*` (`ext-curl` extension).

## Segment

`segment` — a string as-is (`"preset"`, `"200x200"`, `"200x"`, `"x200"`, `"x"`), an associative array `["width" => 200, "height" => 200]` (both optional), a list `[width, height]` (both required), or not set → `"x"`.

| Input | Result |
|---|---|
| `"preset"` | `"preset"` |
| `["width" => 200, "height" => 200]` | `"200x200"` |
| `["width" => 200]` | `"200x"` |
| `["height" => 200]` | `"x200"` |
| `[]` / `["width" => 0, "height" => 0]` | `"x"` |
| `[200, 200]` | `"200x200"` |
| `[0, 400]` | `"x400"` |

## dpr

- `dpr`/`dprs` — a number or digit string (`"2"`).
- Result < 1 → not used (single path object without suffix and without `dpr` field).
- Result = 1 (explicit) → single path object with `dpr: 1`.
- Result = 2 → `[no suffix, @2]`.
- Result = 3 → `[no suffix, @2, @3]`.
- Result > 3 → treated as 3.

## Asset URL format

```text
{baseURL}{path}/{source_name}-{source_format}/{segment}@{dpr}.{output_format}
```

- `path` — logical source path (leading `/` stripped): `/thumbs/photo.jpg` → `path="thumbs"`, `name="photo"`, `format="jpg"`.
- `source_format` — extension in lowercase.
- `@{dpr}` — appended to the segment only when dpr ≥ 2.
- `output_format` — final format (argument → option → source format).

## AssetType structure

```php
final class AssetPath {
    public string $path = "";
    public ?int $dpr = null;
    public ?int $width = null;
    public ?int $height = null;
}

final class AssetType {
    public string $type = "";
    /** @var AssetPath[] */
    public array $paths = [];
    /** Output format matches the source file format (in JSON only when true). */
    public ?bool $source_format = null;
    /** Format supported by all browsers (jpg/jpeg/gif/png) (in JSON only when true). */
    public ?bool $all_support = null;
}
```

Example result of `GetAsset("/test.gif", ["width" => 200, "height" => 200], "gif", 2)`:

```json
{
  "type": "image/gif",
  "paths": [
    {"path": "https://imgs.example.com/images/test-gif/200x200.gif", "width": 200, "height": 200},
    {"path": "https://imgs.example.com/images/test-gif/200x200@2.gif", "width": 400, "height": 400, "dpr": 2}
  ],
  "source_format": true,
  "all_support": true
}
```

Path object field rules:

- `path` — full URL, always present.
- `dpr` — when dpr ≥ 2 or explicit dpr = 1.
- `width`/`height` — only for size segments (`200x200`, `{w,h}`, `[w,h]`, `x`, etc.); multiplied by dpr when dpr ≥ 2. Not added for named presets.
- `type` — MIME of the output format; video (`mp4`, `webm`, `mov`, `mkv`, `avi`, `m4v`) and unknown format → `""`.
- `source_format` — `true` when the output format matches the source file format; present in JSON only when `true`.
- `all_support` — `true` when the output format ∈ {`jpg`, `jpeg`, `gif`, `png`} (supported by all browsers); present in JSON only when `true`.

### MIME by format

| Format | MIME |
|---|---|
| `jpeg`, `jpg` | `image/jpeg` |
| `png` | `image/png` |
| `webp` | `image/webp` |
| `gif` | `image/gif` |
| `avif` | `image/avif` |
| `heif` | `image/heif` |
| `heic` | `image/heic` |
| `apng` | `image/apng` |
| `jxl` | `image/jxl` |

## Different call styles

```php
// segment: four ways to write it
$imager->GetAsset("/test.gif");                     // not set → "x", source format
$imager->GetAsset("/test.gif", "thumb");            // string: named preset
$imager->GetAsset("/test.gif", "200x200");          // string: size
$imager->GetAsset("/test.gif", ["width" => 200]);   // array: width only → "200x"
$imager->GetAsset("/test.gif", ["height" => 400]);  // array: height only → "x400"
$imager->GetAsset("/test.gif", [200, 200]);         // list [width, height] → "200x200"

// format: string or list, dpr: number or string
$imager->GetAsset("/test.gif", "200x200", "webp");       // + format
$imager->GetAsset("/test.gif", "200x200", "webp", 2);    // + dpr
$imager->GetAsset("/test.gif", "200x200", "webp", "2");  // dpr as a string
$imager->GetAssets("/test.gif", ["200x200", "x400"], ["webp", "gif"], 2);  // 4 assets
```

## Examples

```php
use imagerClient\Imager;

$imager = new Imager(["baseURL" => "https://imgs.example.com/images/", "format" => "webp"]);

// Single asset
$asset = $imager->GetAsset("/test.gif", ["width" => 200, "height" => 200], "gif", 2);
echo $asset->type;   // image/gif
// $asset->paths: [AssetPath{path: '.../200x200.gif', width: 200, height: 200},
//                 AssetPath{path: '.../200x200@2.gif', width: 400, height: 400, dpr: 2}]

// Asset list (Cartesian product)
$assets = $imager->GetAssets("/test.gif", [["width" => 200, "height" => 200], ["height" => 400]], ["webp", "gif"], 1);
echo count($assets);  // 4

// Primary variant URL only
$url = $imager->GetAssetPath("/test.gif", "200x200", "webp");
echo $url;  // https://imgs.example.com/images/test-gif/200x200.webp

// Admin methods
$admin = new Imager(["token" => "secret", "adminURL" => "https://imager.example.com"]);
$ok = $admin->AdminGenerate("/test.gif", true);   // POST .../admin/assets/generate
$ok = $admin->AdminDelete($asset, false);         // DELETE .../admin/assets/delete
```

## Tests

```bash
php test/test.php
```

The runner reads [`test/fixture.json`](../test/fixture.json) and executes golden cases. Full cross-language run — `make test` (orchestrator — `go run test/test.go`).

© 2025 [Vladislav Altukhov](https://altuh.ru/about)
