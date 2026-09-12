# Imager Client — Go

**Imager** microservice client in Go: asset path/URL building and admin methods.

- [Русская версия](./GO-RU.md)
- [Overview](../README.md)

---

## Installation

Module `gitverse.ru/pkg-ru/imager-client/v2` (go 1.23.7+, package `imager`, no external dependencies):

```bash
go get gitverse.ru/pkg-ru/imager-client/v2
```

Import:

```go
import imager "gitverse.ru/pkg-ru/imager-client/v2/src/imager-go"
```

## Initialization

```go
i := imager.New(options ...imager.Options) *Imager
```

| Option | Type | Default | Description |
|---|---|---|---|
| `Token` | `string` | `""` | admin method token (only `AdminGenerate`/`AdminDelete`) |
| `Dpr` | `int` | `0` | default dpr; 0-1 = not used, 2-3 = used |
| `Format` | `string` | `""` | default generation format (empty — source format) |
| `Formats` | `[]string` | `[]` | default format list; if empty — `Format` is used |
| `BaseURL` | `string` | `"/"` | asset URL base; normalized (always trailing `/`) |
| `AdminURL` | `string` | `""` | admin API base URL (no trailing `/`) |

`BaseURL` normalization: empty/not set → `"/"`; missing trailing `/` → appended. `AdminURL`: trailing `/` is stripped.

```go
i := imager.New(imager.Options{
    Token:    "secret",
    Dpr:      2,
    Format:   "webp",
    Formats:  []string{},
    BaseURL:  "https://imgs.example.com/images",
    AdminURL: "https://imager.example.com",
})
```

## Methods

### GetAsset

```go
func (i *Imager) GetAsset(source string, segment any, format string, dpr any) AssetType
```

Returns a **single** `AssetType`. `Paths` contains all dpr variants from 1 to the final dpr.

| Parameter | Type | Description |
|---|---|---|
| `source` | `string` | path to the source (`/test.gif`, `test.gif`, `thumbs/photo.jpg`) |
| `segment` | `any` | `string` \| `Size` \| `[2]int` \| `nil`; not set → `"x"` |
| `format` | `string` | output format; empty → `Format` option → source format |
| `dpr` | `any` | `int` \| `string`; not set → `Dpr` option; < 1 → not used |

### GetAssets

```go
func (i *Imager) GetAssets(source string, segments any, formats any, dprs any) []AssetType
```

Returns a **list** of `AssetType` — Cartesian product of `segments × formats` (outer loop — segments). `segments` not set → `["x"]`. `formats` not set → `Formats` option → `[Format]` → `[source format]`.

### GetAssetsHtml

```go
func (i *Imager) GetAssetsHtml(source string, segments any, formats any, dprs any, options map[string]any) string
```

Returns a **string** — HTML markup `<picture>`/`<img>` for the same Cartesian product `segments × formats` as `GetAssets`. A single call generates exactly one `<picture>` tag (or `<img>` if there is only one format).

`options` — HTML attributes:

| Attribute | Placement | Note |
|---|---|---|
| `class`, `id`, `data-*`, others | `<picture>` | — |
| `alt`, `sizes`, `loading` | `<img>` | — |
| `decoding`, `fetchpriority` | `<img>` | native `<img>` attributes (async decoding, fetch priority) |
| `lazy` | `<img>` | boolean: becomes `loading="lazy"` |
| `width`, `height` | `<img>` | overridden by automatic values from the base path (for CLS) |
| `imgAttrs` | `<img>` | object of attributes placed exactly on `<img>`; merged with forwarded attributes, **has priority** |

Rules:

- Attributes are output in alphabetical order of names (deterministic output).
- Boolean attributes (`lazy: true`, `loading: true`) — without a value; `false`/`nil` — skipped.
- Values are HTML-escaped (`&` → `&`, `<` → `<`, `>` → `>`, `"` → `"`, `'` → `&#x27;`).
- Inside `<picture>` tags are divided by type (format): all paths of one format are merged into a single `srcset`.
- For `<img>` the group is chosen: 1) source format (`SourceFormat: true`); 2) first universally supported (`AllSupport: true`); 3) the last one. The remaining formats become `<source type="...">`.
- `srcset` descriptors: if `sizes` is passed in `options` — `w`-descriptors by width (`200w`, `400w`); otherwise — `x`-descriptors by dpr (`1x`, `2x`, `3x`); if there is no dpr but height exists — dpr is computed from the height ratio (fractional allowed, e.g. `1.5x`); sizes are never auto-generated.
- `width`/`height` on `<img>` are added from the base (first) path when known — for CLS. If the user provided their own `width`/`height` (directly or via `imgAttrs`) — automatic ones are not added (no duplication).
- `imgAttrs` is merged with forwarded img attributes (`alt`, `sizes`, `loading`, `width`, `height`, `decoding`, `fetchpriority`): values from `imgAttrs` take priority. The `imgAttrs` key itself never lands on `<picture>`.
- If there are no assets — an empty string is returned.

Example:

```go
html := i.GetAssetsHtml(
    "/test.png",
    "200x200",
    []any{"webp", "png"},
    2,
    map[string]any{"class": "photo", "id": "main", "alt": "Hello & <world>", "lazy": true},
)
```

```html
<picture class="photo" id="main">
    <source type="image/webp" srcset="/test-png/200x200.webp 1x, /test-png/200x200@2.webp 2x">
    <img src="/test-png/200x200.png" srcset="/test-png/200x200.png 1x, /test-png/200x200@2.png 2x" alt="Hello & <world>" loading="lazy" width="200" height="200">
</picture>
```

### GetAssetPath

```go
func (i *Imager) GetAssetPath(source string, segment any, format string, dpr any) string
```

Returns a **string** — URL of the primary asset variant. Equivalent to `GetAsset(...).Paths[0].Path`.

### AdminGenerate

```go
func (i *Imager) AdminGenerate(target any, wait bool) bool
```

`POST {AdminURL}/admin/assets/generate`, header `Authorization: Bearer <token>`. Returns `true` on HTTP 200/202, otherwise `false`.

### AdminDelete

```go
func (i *Imager) AdminDelete(target any, wait bool) bool
```

`DELETE {AdminURL}/admin/assets/delete` — same body and header. Returns `true` on HTTP 200, otherwise `false`.

### `target` input type mapping

| `target` input type | Mode | Request body |
|---|---|---|
| `string` | A (source) | `{"source": "<string as-is>", "wait": ...}` |
| `AssetType` | B (assets) | `{"assets": [paths[].path from AssetType], "wait": ...}` |
| `[]AssetType` | B (assets) | `{"assets": [paths[].path from ALL AssetType, in order], "wait": ...}` |
| `[]string` | B (assets) | `{"assets": ["<item 1>", "<item 2>", ...], "wait": ...}` |

- `string` — mode A: the source path is passed to `source` as-is.
- `AssetType` / `[]AssetType` — mode B: all `paths[].path` are collected into a single `assets` list.
- `[]string` — mode B: the items are **already ready** asset paths, passed to `assets` **as-is**, without validation or transformations.

If `Token` or `AdminURL` is empty — admin methods return `false` **without** an HTTP request. HTTP client — `net/http` (standard library).

## Segment

`segment` — a string as-is (`"preset"`, `"200x200"`, `"200x"`, `"x200"`, `"x"`), a `Size{Width, Height}` struct (both optional), an array `[width, height]` (both required), or not set → `"x"`.

| Input | Result |
|---|---|
| `"preset"` | `"preset"` |
| `Size{Width: 200, Height: 200}` | `"200x200"` |
| `Size{Width: 200}` | `"200x"` |
| `Size{Height: 200}` | `"x200"` |
| `Size{}` / `Size{Width: 0, Height: 0}` | `"x"` |
| `[200, 200]` | `"200x200"` |
| `[0, 400]` | `"x400"` |

## dpr

- `dpr`/`dprs` — a number or digit string (`"2"`).
- Result < 1 → not used (single path object without suffix and without `Dpr` field).
- Result = 1 (explicit) → single path object with `Dpr: 1`.
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

```go
type AssetPath struct {
    Path   string `json:"path"`
    Dpr    int    `json:"dpr,omitempty"`
    Width  int    `json:"width,omitempty"`
    Height int    `json:"height,omitempty"`
}

type AssetType struct {
    Type         string      `json:"type"`
    Paths        []AssetPath `json:"paths"`
    SourceFormat *bool       `json:"source_format,omitempty"`
    AllSupport   *bool       `json:"all_support,omitempty"`
}
```

Example result of `GetAsset("/test.gif", imager.Size{Width: 200, Height: 200}, "gif", 2)`:

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

```go
// segment: four ways to write it
i.GetAsset("/test.gif", nil)                       // not set → "x", source format
i.GetAsset("/test.gif", "thumb")                   // string: named preset
i.GetAsset("/test.gif", "200x200")                 // string: size
i.GetAsset("/test.gif", imager.Size{Width: 200})   // struct: width only → "200x"
i.GetAsset("/test.gif", imager.Size{Height: 400})  // struct: height only → "x400"
i.GetAsset("/test.gif", [2]int{200, 200})          // array [width, height] → "200x200"

// format: string or list, dpr: number or string
i.GetAsset("/test.gif", "200x200", "webp", nil)    // + format
i.GetAsset("/test.gif", "200x200", "webp", 2)      // + dpr
i.GetAsset("/test.gif", "200x200", "webp", "2")    // dpr as a string
i.GetAssets("/test.gif", []any{"200x200", "x400"}, []any{"webp", "gif"}, 2)  // 4 assets
```

## Examples

```go
import imager "gitverse.ru/pkg-ru/imager-client/v2/src/imager-go"

i := imager.New(imager.Options{
    BaseURL: "https://imgs.example.com/images/",
    Format:  "webp",
})

// Single asset
asset := i.GetAsset("/test.gif", imager.Size{Width: 200, Height: 200}, "gif", 2)
// asset.Type  == "image/gif"
// asset.Paths == [AssetPath{Path: '.../200x200.gif', Width: 200, Height: 200},
//                 AssetPath{Path: '.../200x200@2.gif', Width: 400, Height: 400, Dpr: 2}]

// Asset list (Cartesian product)
assets := i.GetAssets("/test.gif", []any{imager.Size{Width: 200, Height: 200}, imager.Size{Height: 400}}, []string{"webp", "gif"}, 1)
// len(assets) == 4

// Primary variant URL only
url := i.GetAssetPath("/test.gif", "200x200", "webp")
// url == "https://imgs.example.com/images/test-gif/200x200.webp"

// Admin methods
admin := imager.New(imager.Options{Token: "secret", AdminURL: "https://imager.example.com"})
ok := admin.AdminGenerate("/test.gif", true)   // POST .../admin/assets/generate
ok = admin.AdminDelete(asset, false)           // DELETE .../admin/assets/delete
```

## Tests

```bash
go run test/test.go
```

`test/test.go` is the orchestrator: it runs the Python/PHP/TS runners, executes the Go cases, and compares results from all languages against [`test/fixture.json`](../test/fixture.json) (JSON serialization identity). Full run — `make test`.

© 2025 [Vladislav Altukhov](https://altuh.ru/about)
