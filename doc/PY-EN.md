# Imager Client — Python

**Imager** microservice client in Python: asset path/URL building and admin methods.

- [Русская версия](./PY-RU.md)
- [Overview](../README.md)

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

| Option | Type | Default | Description |
|---|---|---|---|
| `token` | `str` | `""` | admin method token (only `AdminGenerate`/`AdminDelete`) |
| `dpr` | `int` | `0` | default dpr; 0-1 = not used, 2-3 = used |
| `format` | `str` | `""` | default generation format (empty — source format) |
| `formats` | `list[str]` | `[]` | default format list; if empty — `format` is used |
| `baseURL` | `str` | `"/"` | asset URL base; normalized (always trailing `/`) |
| `adminURL` | `str` | `""` | admin API base URL (no trailing `/`) |

`baseURL` normalization: empty/not set → `"/"`; missing trailing `/` → appended. `adminURL`: trailing `/` is stripped.

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
| `format` | `str` \| `None` | output format; not set → `format` option → source format |
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

Returns a **list** of `AssetType` — Cartesian product of `segments × formats` (outer loop — segments). `segments` not set → `["x"]`. `formats` not set → `formats` option → `[format]` → `[source format]`.

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
- Boolean attributes (`lazy: true`, `loading: true`) — without a value; `false`/`null` — skipped.
- Values are HTML-escaped (`&` → `&`, `<` → `<`, `>` → `>`, `"` → `"`, `'` → `&#x27;`).
- Inside `<picture>` tags are divided by type (format): all paths of one format are merged into a single `srcset`.
- For `<img>` the group is chosen: 1) source format (`source_format: true`); 2) first universally supported (`all_support: true`); 3) the last one. The remaining formats become `<source type="...">`.
- `srcset` descriptors: if `sizes` is passed in `options` — `w`-descriptors by width (`200w`, `400w`); otherwise — `x`-descriptors by dpr (`1x`, `2x`, `3x`); if there is no dpr but height exists — dpr is computed from the height ratio (fractional allowed, e.g. `1.5x`); sizes are never auto-generated.
- `width`/`height` on `<img>` are added from the base (first) path when known — for CLS. If the user provided their own `width`/`height` (directly or via `imgAttrs`) — automatic ones are not added (no duplication).
- `imgAttrs` is merged with forwarded img attributes (`alt`, `sizes`, `loading`, `width`, `height`, `decoding`, `fetchpriority`): values from `imgAttrs` take priority. The `imgAttrs` key itself never lands on `<picture>`.
- If there are no assets — an empty string is returned.

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

```python
class AssetPath(TypedDict, total=False):
    path: str
    dpr: int
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
imager.GetAssets("/test.gif", ["200x200", "x400"], ["webp", "gif"], 2)  # 4 assets
```

## Examples

```python
from imager import Imager

imager = Imager({"baseURL": "https://imgs.example.com/images/", "format": "webp"})

# Single asset
asset = imager.GetAsset("/test.gif", {"width": 200, "height": 200}, "gif", 2)
print(asset["type"])   # image/gif
print(asset["paths"])  # [{'path': '.../200x200.gif', 'width': 200, 'height': 200},
                       #  {'path': '.../200x200@2.gif', 'width': 400, 'height': 400, 'dpr': 2}]

# Asset list (Cartesian product)
assets = imager.GetAssets("/test.gif", [{"width": 200, "height": 200}, {"height": 400}], ["webp", "gif"], 1)
print(len(assets))  # 4

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
