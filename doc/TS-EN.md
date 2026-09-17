# Imager Client — TypeScript

**Imager** microservice client in TypeScript: asset path/URL building and admin methods.

- [Русская версия](./TS-RU.md)
- [Overview](../README.md)
- [Demo](https://altuh.ru/demo/imager) — example of the microservice and client part in action

---

## Client / server split

The `imager-client` package has **two entry points**:

| Import | Class | Contents |
|---|---|---|
| `import { Imager } from "imager-client"` | `Imager` | client (browser) part: `GetAsset`, `GetAssets`, `GetAssetPath` |
| `import { ImagerServer } from "imager-client/server"` | `ImagerServer extends Imager` | server part: + `AdminGenerate`, `AdminDelete` |

**Why the token is server-only.** Browser bundlers (webpack/vite/esbuild) resolve the `browser` condition in the `package.json` `exports` and physically **do not include** `imager-server` in the bundle. The `Imager` class has no `token` field at all — even if you pass `token` in the options, it is ignored (the base class has no such field). The `token` field in `ImagerServer` is `private` and is not part of JSON serialization. This way secrets cannot leak into client code.

```json
{
  "exports": {
    ".": {
      "browser": "./dist/imager/index.js",
      "default": "./dist/imager/index.js"
    },
    "./server": {
      "node": "./dist/imager-server/index.js",
      "default": "./dist/imager-server/index.js"
    }
  }
}
```

## Installation

Package `imager-client` (Node 18+ for the server part, no external dependencies):

```bash
npm install imager-client
```

## Initialization

### Client part

```ts
const imager = new Imager(options?: ImagerOptions | null);
```

| Option | Type | Default | Description |
|---|---|---|---|
| `dpr` | `number` | `0` | default dpr; 0-1 = not used, 2-3 = used |
| `format` | `string` | `""` | default generation format (`""`/`"auto"` — source format; if the source is not an image — `jpg`) |
| `formats` | `string[]` | `[]` | default format list; if empty — `format` is used; duplicates are removed (`jpeg` → `jpg`) |
| `baseURL` | `string` | `"/"` | asset URL base; normalized (always trailing `/`) |

### Server part

```ts
const imager = new ImagerServer(options?: ImagerServerOptions | null);
```

`ImagerServerOptions extends ImagerOptions` — adds:

| Option | Type | Default | Description |
|---|---|---|---|
| `token` | `string` | `""` | admin method token (only `AdminGenerate`/`AdminDelete`) |
| `adminURL` | `string` | `""` | admin API base URL (no trailing `/`) |

`baseURL` normalization: empty/not set → `"/"`; missing trailing `/` → appended. `adminURL`: trailing `/` is stripped.

```ts
// Client (browser)
const imager = new Imager({
    baseURL: "https://imgs.example.com/images",
    format: "webp",
    dpr: 2,
});

// Server
const server = new ImagerServer({
    baseURL: "https://imgs.example.com/images",
    format: "webp",
    token: "secret",
    adminURL: "https://imager.example.com",
});
```

## Methods

### Client part (`Imager`)

```ts
GetAsset(source: string, segment?: Segment, format?: string, dpr?: number | string): AssetType;
GetAssets(source: string, segments?: Segment | Segment[], formats?: string | string[], dprs?: number | string): AssetType[];
GetAssetsHtml(source: string, segments?: Segment | Segment[], formats?: string | string[], dprs?: number | string, options?: Record<string, unknown>): string;
GetAssetPath(source: string, segment?: Segment, format?: string, dpr?: number | string): string;
```

#### GetAsset

Returns a **single** `AssetType`. `paths` contains all dpr variants from 1 to the final dpr.

| Parameter | Type | Description |
|---|---|---|
| `source` | `string` | path to the source (`/test.gif`, `test.gif`, `thumbs/photo.jpg`) |
| `segment` | `Segment` \| `null` | segment; not set → `"x"` |
| `format` | `string` \| `null` | output format; `"auto"`/`""` → source format (if the source is not an image — `jpg`); not set → `format` option → source format |
| `dpr` | `number` \| `string` \| `null` | final dpr; not set → `dpr` option; < 1 → not used |

#### GetAssets

Returns a **list** of `AssetType` — one per format (all assets with the same type are merged into a single `AssetType`). Inside `paths` the order is **segment-major**: for each segment all dpr steps in a row. The `dpr` of each path is recalculated from actual sizes: the base is the width (or height) of the first participant with a known size, `dpr = actual width / base width`. `segments` not set → `["x"]`. `formats` not set → `formats` option → `[format]` → `[source format]`.

The format list is deduplicated: `jpeg` is normalized to `jpg`, duplicates are removed (the first occurrence keeps its position). An `"auto"` (or `""`) element means the source file format; if the source is not an image (video, no extension) — `jpg` is used. Supported image formats: `jpg, jpeg, png, webp, avif, heif, heic, apng, jxl, gif`.

```ts
imager.GetAssets("/test.jpg", "100x100", ["webp", "avif", "jpg", "webp", "auto"]);  // → webp, avif, jpg
imager.GetAssets("/test.jpg", "100x100", ["webp", "auto"]);                         // → webp, jpg
imager.GetAssets("/test.jpg", "100x100", ["jpg", "auto"]);                          // → jpg
imager.GetAssets("/test.mov", "100x100", ["jpg", "auto"]);                          // → jpg
imager.GetAssets("/test.jpg", "100x100", ["webp", "jpg", "auto"]);                  // → webp, jpg
```

#### GetAssetsHtml

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

- Attributes are output in alphabetical order of names (deterministic output).
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

Example:

```ts
const html = imager.GetAssetsHtml(
    "/test.png",
    "200x200",
    ["webp", "png"],
    2,
    { class: "photo", id: "main", alt: "Hello & <world>", lazy: true },
);
```

```html
<picture class="photo" id="main">
    <source type="image/webp" srcset="/test-png/200x200.webp 1x, /test-png/200x200@2.webp 2x">
    <img src="/test-png/200x200.png" srcset="/test-png/200x200.png 1x, /test-png/200x200@2.png 2x" alt="Hello & <world>" loading="lazy" width="200" height="200">
</picture>
```

Example with `imgAttrs` (attributes placed exactly on `<img>`, priority over forwarded):

```ts
const html = imager.GetAssetsHtml(
    "/test.png",
    "200x200",
    ["webp", "png"],
    2,
    {
        class: "photo",
        alt: "Photo",
        imgAttrs: { class: "img", decoding: "async", fetchpriority: "high", width: 333, height: 444 },
    },
);
```

```html
<picture class="photo">
    <source type="image/webp" srcset="/test-png/200x200.webp 1x, /test-png/200x200@2.webp 2x">
    <img src="/test-png/200x200.png" srcset="/test-png/200x200.png 1x, /test-png/200x200@2.png 2x" alt="Photo" class="img" decoding="async" fetchpriority="high" width="333" height="444">
</picture>
```

#### GetAssetPath

Returns a **string** — URL of the primary asset variant. Equivalent to `GetAsset(...).paths[0].path`.

### Server part (`ImagerServer`)

```ts
AdminGenerate(target: string | AssetType | AssetType[] | string[], wait?: boolean): Promise<boolean>;
AdminDelete(target: string | AssetType | AssetType[] | string[], wait?: boolean): Promise<boolean>;
```

#### AdminGenerate

`POST {adminURL}/admin/assets/generate`, header `Authorization: Bearer <token>`. Returns `true` on HTTP 200/202, otherwise `false`.

#### AdminDelete

`DELETE {adminURL}/admin/assets/delete` — same body and header. Returns `true` on HTTP 200, otherwise `false`.

#### `target` input type mapping

| `target` input type | Mode | Request body |
|---|---|---|
| `string` | A (source) | `{"source": "<string as-is>", "wait": ...}` |
| `AssetType` | B (assets) | `{"assets": [paths[].path from AssetType], "wait": ...}` |
| `AssetType[]` | B (assets) | `{"assets": [paths[].path from ALL AssetType, in order], "wait": ...}` |
| `string[]` | B (assets) | `{"assets": ["<item 1>", "<item 2>", ...], "wait": ...}` |

- `string` — mode A: the source path is passed to `source` as-is.
- `AssetType` / `AssetType[]` — mode B: all `paths[].path` are collected into a single `assets` list.
- `string[]` — mode B: the items are **already ready** asset paths, passed to `assets` **as-is**, without validation or transformations.

If `token` or `adminURL` is empty — admin methods return `false` **without** an HTTP request. HTTP client — `fetch` (Node 18+).

## Segment

```ts
type Segment = string | { width?: number; height?: number } | [number, number];
```

`segment` — a string as-is (`"preset"`, `"200x200"`, `"200x"`, `"x200"`, `"x"`), an object `{width, height}` (both optional), a tuple `[width, height]` (both required), or not set → `"x"`.

| Input | Result |
|---|---|
| `"preset"` | `"preset"` |
| `{ width: 200, height: 200 }` | `"200x200"` |
| `{ width: 200 }` | `"200x"` |
| `{ height: 200 }` | `"x200"` |
| `{}` / `{ width: 0, height: 0 }` | `"x"` |
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

```ts
interface AssetPath {
    path: string;
    dpr?: number;
    width?: number;
    height?: number;
}

interface AssetType {
    type: string;
    paths: AssetPath[];
    source_format?: boolean;  // only when true
    all_support?: boolean;    // only when true
}
```

Example result of `GetAsset("/test.gif", { width: 200, height: 200 }, "gif", 2)`:

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

```ts
// segment: four ways to write it
imager.GetAsset("/test.gif");                     // not set → "x", source format
imager.GetAsset("/test.gif", "thumb");            // string: named preset
imager.GetAsset("/test.gif", "200x200");          // string: size
imager.GetAsset("/test.gif", { width: 200 });     // object: width only → "200x"
imager.GetAsset("/test.gif", { height: 400 });    // object: height only → "x400"
imager.GetAsset("/test.gif", [200, 200]);         // tuple [width, height] → "200x200"

// format: string or list, dpr: number or string
imager.GetAsset("/test.gif", "200x200", "webp");       // + format
imager.GetAsset("/test.gif", "200x200", "webp", 2);    // + dpr
imager.GetAsset("/test.gif", "200x200", "webp", "2");  // dpr as a string
imager.GetAssets("/test.gif", ["200x200", "x400"], ["webp", "gif"], 2);  // 2 assets (one per format)
```

## Examples

### Client part (browser)

```ts
import { Imager } from "imager-client";

const imager = new Imager({ baseURL: "https://imgs.example.com/images/", format: "webp" });

// Single asset
const asset = imager.GetAsset("/test.gif", { width: 200, height: 200 }, "gif", 2);
console.log(asset.type);   // image/gif
console.log(asset.paths);  // [{path: '.../200x200.gif', width: 200, height: 200},
                           //  {path: '.../200x200@2.gif', width: 400, height: 400, dpr: 2}]

// Asset list (one AssetType per format)
const assets = imager.GetAssets("/test.gif", [{ width: 200, height: 200 }, { height: 400 }], ["webp", "gif"], 1);
console.log(assets.length);  // 2

// Primary variant URL only
const url = imager.GetAssetPath("/test.gif", "200x200", "webp");
console.log(url);  // https://imgs.example.com/images/test-gif/200x200.webp
```

### Server part (Node)

```ts
import { ImagerServer } from "imager-client/server";

const server = new ImagerServer({
    baseURL: "https://imgs.example.com/images/",
    token: "secret",
    adminURL: "https://imager.example.com",
});

const ok = await server.AdminGenerate("/test.gif", true);  // POST .../admin/assets/generate
const ok2 = await server.AdminDelete(asset, false);        // DELETE .../admin/assets/delete
```

## Tests

```bash
npm test
```

The runner reads [`test/fixture.json`](../test/fixture.json) and executes golden cases. Full cross-language run — `make test` (orchestrator — `go run test/test.go`).

© 2025 [Vladislav Altukhov](https://altuh.ru/about)
