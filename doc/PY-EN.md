# Imager Client — Python

**Imager** microservice client in Python: asset path/URL building and admin methods.

- [Русская версия](./PY-RU.md)
- [Overview](../README.md)
- [Demo](https://altuh.ru/demo/imager) — example of the microservice and client part in action

---

## Installation

Package `imager_client` (Python ≥ 3.10, no external dependencies):

```bash
pip install imager_client
```

Or from the repository:

```bash
pip install git+https://gitverse.ru/pkg-ru/imager-client
```

## Import

```python
from imager import Imager
from imager import AssetType, AssetPath, ImagerOptions, ImagerServerOptions, Segment
```

## Initialization

```python
imager = Imager(options: ImagerOptions | dict | None = None)
```

The `Imager` class uses `__slots__` (a fixed set of fields, no `__dict__`).

### ImagerOptions vs ImagerServerOptions

- [`ImagerOptions`](https://gitverse.ru/pkg-ru/imager-client/blob/master/src/imager/ImagerTypes.py) — TypedDict of the client part: `dpr`, `format`, `formats`, `baseURL`, `sort`. **Does not contain** `token`/`adminURL`.
- `ImagerServerOptions(ImagerOptions)` — extends it with `token`, `adminURL` (for admin methods).

The `Imager` constructor accepts any dict and reads all seven keys from it (including `token`/`adminURL`), so for admin methods you can pass either `ImagerServerOptions` or a plain dict. The `ImagerOptions` typing simply does not describe the server keys.

| Option | Type | Default | Description |
|---|---|---|---|
| `token` | `str` | `""` | admin method token (only `AdminGenerate`/`AdminDelete`); present in `ImagerServerOptions` |
| `dpr` | `int` | `0` | default dpr; 0-1 = not used, 2-3 = used |
| `format` | `str` | `""` | default generation format (`""`/`"auto"` — source format; if the source is not an image — `jpg`) |
| `formats` | `list[str]` | `[]` | default format list; if empty — `format` is used; duplicates are removed (`jpeg` → `jpg`) |
| `baseURL` | `str` | `"/"` | asset URL base; normalized (always trailing `/`) |
| `adminURL` | `str` | `""` | admin API base URL (no trailing `/`); present in `ImagerServerOptions` |
| `sort` | `bool` | `False` | sort size segments in `GetAssets` by `width`/`height` (see below) |

`baseURL` normalization: empty/not set → `"/"`; missing trailing `/` → appended. `adminURL`: trailing `/` is stripped.

### Segment sorting (`sort: true`)

With `sort: true` the segments in `GetAssets` are sorted **before** building paths and computing `dpr`:

1. Segments with `width > 0` — ascending by `width`; on equal `width` — ascending by `height`.
2. `height = 0`/missing — to the end of its `width` group.
3. Segments without `width` (`x400`, `thumb`) — to the very end, **not** sorted among themselves (keep the original order).
4. If no segment has `width` or `height` — no sorting is performed.
5. `dpr` is computed **after** sorting: the first (smallest) size segment defines `base_width`/`base_height`, so all ratios are ≥ 1.

Example: `["300x", "100x100", "200x", "x400", "thumb"]` → `100x100 → 200x → 300x → x400 → thumb`.

```python
imager = Imager({
    "baseURL": "https://imgs.example.com/images",
    "format": "webp",
    "dpr": 2,
    "token": "secret",
    "adminURL": "https://imager.example.com",
})
```

## Methods

### GetAsset

```python
def GetAsset(
    self,
    source: str,
    segment: Segment | None = None,
    format: str | None = None,
    dpr: int | str | None = None,
) -> AssetType: ...
```

Returns a **single** `AssetType`. `paths` contains all dpr variants from 1 to the final dpr.

| Parameter | Type | Description |
|---|---|---|
| `source` | `str` | path to the source (`/test.gif`, `test.gif`, `thumbs/photo.jpg`) |
| `segment` | `str` \| `{width,height}` \| `[w,h]` \| `None` | segment; not set → `"x"` |
| `format` | `str` \| `None` | output format; `"auto"`/`""` → source format (if the source is not an image — `jpg`); not set → `format` option → source format |
| `dpr` | `int` \| `str` \| `None` | final dpr; not set → `dpr` option; < 1 → not used |

### GetAssets

```python
def GetAssets(
    self,
    source: str,
    segments: Segment | list[Segment] | None = None,
    formats: str | list[str] | None = None,
    dprs: int | str | None = None,
) -> list[AssetType]: ...
```

Returns a **list** of `AssetType` — one per format (all assets with the same type are merged into a single `AssetType`). Inside `paths` the order is **segment-major**: for each segment all dpr steps in a row. The `dpr` of each path is recalculated from actual sizes: the base is the width (or height) of the first participant with a known size, `dpr = actual width / base width`. `segments` not set → `["x"]`. `formats` not set → `formats` option → `[format]` → `[source format]`.

The format list is deduplicated: `jpeg` is normalized to `jpg`, duplicates are removed (the first occurrence keeps its position). An `"auto"` (or `""`) element means the source file format; if the source is not an image (video, no extension) — `jpg` is used. Supported image formats: `jpg, jpeg, png, webp, avif, heif, heic, apng, jxl, gif`.

```python
imager.GetAssets("/test.jpg", "100x100", ["webp", "avif", "jpg", "webp", "auto"])  # → webp, avif, jpg
imager.GetAssets("/test.jpg", "100x100", ["webp", "auto"])                         # → webp, jpg
imager.GetAssets("/test.jpg", "100x100", ["jpg", "auto"])                          # → jpg
imager.GetAssets("/test.mov", "100x100", ["jpg", "auto"])                          # → jpg
imager.GetAssets("/test.jpg", "100x100", ["webp", "jpg", "auto"])                  # → webp, jpg
```

### GetAssetsHtml

```python
def GetAssetsHtml(
    self,
    source: str,
    segments: Segment | list[Segment] | None = None,
    formats: str | list[str] | None = None,
    dprs: int | str | None = None,
    options: dict | None = None,
) -> str: ...
```

Returns a **string** — HTML markup `<picture>`/`<img>` for the same assets as `GetAssets` (assets are grouped by type). A single call generates exactly one `<picture>` tag (or `<img>` if there is only one format).

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

- Attributes are output in insertion order (the order of dict/options keys); no sorting is performed.
- Boolean attributes (`lazy: true`, `loading: true`) — without a value; `false`/`null` — skipped.
- Values are HTML-escaped (`&` → `&`, `<` → `<`, `>` → `>`, `"` → `"`, `'` → `&#x27;`).
- Inside `<picture>` tags are divided by type (format): all paths of one format are merged into a single `srcset`.
- For `<img>` the group is chosen: 1) source format (`source_format: true`); 2) first universally supported (`all_support: true`); 3) the last one. The remaining formats become `<source type="...">`.
- `srcset` descriptors: if `sizes` is passed in `options` — **w-mode**: `w`-descriptors by width (`200w`, `400w`); paths without width (segment `x`, original size) are **excluded** from srcset — the original stays only in `src` of `<img>` as a fallback; if a group has only `x`-paths — srcset is empty. Otherwise — **x-mode**: `x`-descriptors by dpr (`1x`, `2x`, `3x`); if there is no dpr but height exists — dpr is computed from the height ratio (fractional allowed, e.g. `1.5x`); `x`-paths are included in srcset with the **max+1** heuristic: `max_dpr` is computed **only from sized paths** (those with width or height); dpr fields of `x`-paths (steps 1, 2, 3...) do not participate. If sized paths exist (`max_dpr > 0`) — descriptor = `(max_dpr + 1) × dpr step` (approximate, since the real original size is unknown); if there are no sized paths but dpr steps exist (`dprs ≥ 2`) — descriptor = dpr step (`1x`, `2x`, `3x`...); if there are neither sized paths nor dpr steps (`dprs = 0`) — the path goes into srcset **without a descriptor** (just the path, no ` 1x`). Sizes are never auto-generated.
- `<source>` always has `srcset` (never `src`), even with a single path in the group; if srcset is empty (in w-mode all paths are `x`) — `<source>` is not rendered.
- `<img>`: `srcset` is added only if there are more than 1 path **and** srcset is not empty; otherwise `<img>` has only `src`.
- `width`/`height` on `<img>` are added from the base (first) path when known — for CLS. If the user provided their own `width`/`height` (directly or via `imgAttrs`) — automatic ones are not added (no duplication).
- `imgAttrs` is merged with forwarded img attributes (`alt`, `sizes`, `loading`, `width`, `height`, `decoding`, `fetchpriority`): values from `imgAttrs` take priority. The `imgAttrs` key itself never lands on `<picture>`.
- If there are no assets — an empty string is returned.
- The Python implementation raises `IndexError` on an empty `GetAssets` result (access to `paths[0]`) — a known quirk, see the [README](https://gitverse.ru/pkg-ru/imager-client/blob/master/README.md).

Example:

```python
html = imager.GetAssetsHtml(
    "/test.png",
    "200x200",
    ["webp", "png"],
    2,
    {"class": "photo", "id": "main", "alt": "Hello & <world>", "lazy": True},
)
```

```html
<picture class="photo" id="main">
    <source type="image/webp" srcset="/test-png/200x200.webp 1x, /test-png/200x200@2.webp 2x">
    <img src="/test-png/200x200.png" srcset="/test-png/200x200.png 1x, /test-png/200x200@2.png 2x" alt="Hello & <world>" loading="lazy" width="200" height="200">
</picture>
```

### GetAssetPath

```python
def GetAssetPath(
    self,
    source: str,
    segment: Segment | None = None,
    format: str | None = None,
    dpr: int | str | None = None,
) -> str: ...
```

Returns a **string** — URL of the primary asset variant. Equivalent to `GetAsset(...).paths[0].path`.

### AdminGenerate

```python
def AdminGenerate(
    self,
    target: str | AssetType | list[AssetType] | list[str],
    wait: bool = False,
) -> bool: ...
```

`POST {adminURL}/admin/assets/generate`, header `Authorization: Bearer <token>`. Returns `True` on HTTP 200/202, otherwise `False`.

### AdminDelete

```python
def AdminDelete(
    self,
    target: str | AssetType | list[AssetType] | list[str],
    wait: bool = False,
) -> bool: ...
```

`DELETE {adminURL}/admin/assets/delete` — same body and header. Returns `True` on HTTP 200, otherwise `False`.

### `target` input type mapping

| `target` input type | Mode | Request body |
|---|---|---|
| `str` | A (source) | `{"source": "<string as-is>", "wait": ...}` |
| `AssetType` | B (assets) | `{"assets": [paths[].path from AssetType], "wait": ...}` |
| `list[AssetType]` | B (assets) | `{"assets": [paths[].path from ALL AssetType, in order], "wait": ...}` |
| `list[str]` | B (assets) | `{"assets": ["<item 1>", "<item 2>", ...], "wait": ...}` |

- `str` — mode A: the source path is passed to `source` as-is.
- `AssetType` / `list[AssetType]` — mode B: all `paths[].path` are collected into a single `assets` list.
- `list[str]` — mode B: the items are **already ready** asset paths, passed to `assets` **as-is**, without validation or transformations.

If `token` or `adminURL` is empty — admin methods return `False` **without** an HTTP request. HTTP client — `urllib.request` (standard library).

## Segment

`segment` — a string as-is (`"preset"`, `"200x200"`, `"200x"`, `"x200"`, `"x"`), a dict `{width, height}` (both optional), a list/tuple `[width, height]` (both required), or not set → `"x"`.

| Input | Result |
|---|---|
| `"preset"` | `"preset"` |
| `{"width": 200, "height": 200}` | `"200x200"` |
| `{"width": 200}` | `"200x"` |
| `{"height": 200}` | `"x200"` |
| `{}` / `{"width": 0, "height": 0}` | `"x"` |
| `[200, 200]` | `"200x200"` |
| `[0, 400]` | `"x400"` |

## dpr

- `dpr`/`dprs` — a number or digit string (`"2"`).
- Result < 1 → not used (single path object without suffix and without `dpr` field).
- Result = 1 (explicit) → single path object without `dpr` field (1x is the default descriptor; `dpr: 1` is added only if the group has a path with `dpr > 1`).
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

```python
class AssetPath(TypedDict, total=False):
    path: str
    dpr: int | float
    width: int
    height: int

class AssetType(TypedDict):
    type: str
    paths: list[AssetPath]
    source_format: bool  # only when true
    all_support: bool    # only when true
```

Example result of `GetAsset("/test.gif", {"width": 200, "height": 200}, "gif", 2)`:

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
- `dpr` — when dpr ≥ 2; `dpr: 1` — only if the group has a path with `dpr > 1` (otherwise 1x is the default descriptor, no field).
- `width`/`height` — only for size segments (`200x200`, `{w,h}`, `[w,h]`, `x`, etc.); multiplied by dpr when dpr ≥ 2. Not added for named presets.
- `type` — MIME of the output format: always `"image/" + format` (for `jpg` — `image/jpeg`). An empty string is impossible: `mime_for` is defined for any format.
- `source_format` — `true` when the output format matches the source file format; present in JSON only when `true`.
- `all_support` — `true` when the output format ∈ {`jpg`, `jpeg`, `gif`, `png`} (supported by all browsers); present in JSON only when `true`.

### Format functions

The [`imager.ImagerTypes`](https://gitverse.ru/pkg-ru/imager-client/blob/master/src/imager/ImagerTypes.py) module exports:

- `IMAGE_FORMATS` — frozenset of supported image formats: `jpg, jpeg, png, webp, avif, heif, heic, apng, jxl, gif`. Anything not in the list (video, etc.) is treated as a non-image when `format="auto"/""`.
- `normalize_format(format)` — normalization: lower-case, `jpeg` → `jpg`.
- `resolve_format(format, source_format)` — resolves a single format: `"auto"`/`""` → the source format if it is an image, otherwise `jpg`.
- `dedupe_formats(formats)` — deduplication of the format list (`jpeg` → `jpg`, the first occurrence keeps its position).
- `mime_for(format)` — MIME by output format: always `"image/" + format` (for `jpg` — `image/jpeg`). Not in the package `__all__`, but available via `from imager.ImagerTypes import mime_for`.

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

```python
# segment: four ways to write it
imager.GetAsset("/test.gif")                     # not set → "x", source format
imager.GetAsset("/test.gif", "thumb")            # string: named preset
imager.GetAsset("/test.gif", "200x200")          # string: size
imager.GetAsset("/test.gif", {"width": 200})     # dict: width only → "200x"
imager.GetAsset("/test.gif", {"height": 400})    # dict: height only → "x400"
imager.GetAsset("/test.gif", (200, 200))         # tuple → "200x200"

# format: string or list, dpr: number or string
imager.GetAsset("/test.gif", "200x200", "webp")          # + format
imager.GetAsset("/test.gif", "200x200", "webp", 2)       # + dpr
imager.GetAsset("/test.gif", "200x200", "webp", "2")     # dpr as a string
imager.GetAssets("/test.gif", ["200x200", "x400"], ["webp", "gif"], 2)  # 2 assets (one per format)
```

## Source cache

`Imager` caches parsing of the last source (`_src_cache`: source → path, name, format, prefix). Repeated method calls with **the same** `source` reuse the parsed result and run faster. The cache holds a single entry — changing the source triggers a full re-parse. This is an internal optimization: it does not affect the result.

## Examples

```python
from imager import Imager

imager = Imager({"baseURL": "https://imgs.example.com/images/", "format": "webp"})

# Single asset
asset = imager.GetAsset("/test.gif", {"width": 200, "height": 200}, "gif", 2)
print(asset["type"])   # image/gif
print(asset["paths"])  # [{'path': '.../200x200.gif', 'width': 200, 'height': 200},
                       #  {'path': '.../200x200@2.gif', 'width': 400, 'height': 400, 'dpr': 2}]

# Asset list (one AssetType per format)
assets = imager.GetAssets("/test.gif", [{"width": 200, "height": 200}, {"height": 400}], ["webp", "gif"], 1)
print(len(assets))  # 2

# Primary variant URL only
url = imager.GetAssetPath("/test.gif", "200x200", "webp")
print(url)  # https://imgs.example.com/images/test-gif/200x200.webp

# Admin methods
admin = Imager({"token": "secret", "adminURL": "https://imager.example.com"})
ok = admin.AdminGenerate("/test.gif", wait=True)   # POST .../admin/assets/generate
ok = admin.AdminDelete(asset, wait=False)          # DELETE .../admin/assets/delete
```

## Tests

```bash
python test/test.py
```

The runner reads [`test/fixture.json`](../test/fixture.json) and executes golden cases. Full cross-language run — `make test` (orchestrator — `go run test/test.go`).

© 2025 [Vladislav Altukhov](https://altuh.ru/about)
