# [Imager](https://gitverse.ru/pkg-ru/imager) Client

Client library for the **Imager** microservice for four languages — Python, PHP, TypeScript and Go — with **identical behavior across all platforms**. Builds asset paths and URLs (previews, sizes, formats, retina) and calls admin generate/delete methods.

> Requires a configured and running [Imager microservice](https://gitverse.ru/pkg-ru/imager).

> **Primary repository:** [GitVerse](https://gitverse.ru/pkg-ru/imager-client) · **Mirror:** [GitHub](https://github.com/pkg-ru/imager-client)

## Documentation: [RU](../README.md) / **EN**

- [Python](./PY-EN.md)
- [PHP](./PHP-EN.md)
- [TypeScript (client + server)](./TS-EN.md)
- [Go](./GO-EN.md)

---

## Why Imager Client

- **One API — four languages.** All implementations produce **byte-identical** JSON results on a shared golden test suite: build URLs on the backend (PHP, Python, Go, Node) and on the frontend (TS) with no discrepancies.
- **Zero-dependency.** Not a single external package: only the standard library of each language (urllib, curl, fetch, net/http).
- **Instant.** Client methods are pure string-concatenation functions: no HTTP, no validation, no exceptions. Generating a million assets is nearly instant.
- **Safe secrets.** In TypeScript, admin methods live in a separate server import `imager-client/server`: the token physically cannot end up in the browser bundle.
- **Flexible parameters.** Pass a size segment as a string, object or array; dpr as a number or string; format as one value or a list.

## Installation

| Language | Package | Command |
|---|---|---|
| Python | `imager_client` (PyPI) | `pip install imager_client` |
| PHP | `pkg-ru/imager-client` (Composer) | `composer require pkg-ru/imager-client` |
| TypeScript | `imager-client` (npm) | `npm install imager-client` |
| Go | `gitverse.ru/pkg-ru/imager-client` | `go get gitverse.ru/pkg-ru/imager-client` |

## Framework components

Thin wrappers over the core for popular frameworks: all logic (segments, dpr,
formats, srcset) lives in the core; components normalize prop aliases
(`src`→`source`, `preset`→`segment`, `width`/`height`→segment) and render
native framework nodes.

| Package | Ecosystem | Components | Docs |
|---|---|---|---|
| `@pkg-ru/imager-react` | npm, peer: react ≥17 | `ImagerPlugin`, `ImagerProvider`, `ImagerAssets`, `ImagerAsset` | [README](../packages/react/README.md) |
| `@pkg-ru/imager-vue` | npm, peer: vue ≥3.2 | `ImagerPlugin`, `ImagerProvider`, `ImagerAssets`, `ImagerAsset` | [README](../packages/vue/README.md) |
| `pkg-ru/imager-twig` | composer, twig ≥3 | functions `imager_assets`, `imager_asset`, `imager_assets_raw` | [README](../packages/twig/README.md) |

Packages are **self-sufficient**: the core is bundled in, `imager-client` is an optional peerDependency
(needed only for your own instance, e.g. `ImagerServer` with admin methods).

```tsx
// React: global initialization
ImagerPlugin.install({ baseURL: "...", format: "webp", dpr: 2 });

<ImagerAssets src="/test.png" width={200} height={200} dpr={2} format="webp" alt="Photo" />
```

```ts
// Vue: global initialization via app.use
createApp(App).use(ImagerPlugin, { baseURL: "...", format: "webp", dpr: 2 }).mount("#app");
```

```twig
{# Twig: extension with an imager service #}
{{ imager_assets('/test.png', {preset: 'thumb', format: 'webp', alt: 'Photo'})|raw }}
```

## Quick Start

### Python

```python
from imager import Imager

imager = Imager({"baseURL": "https://imgs.example.com/images/", "format": "webp"})

asset = imager.GetAsset("/test.gif", {"width": 200, "height": 200}, "gif", 2)
url = imager.GetAssetPath("/test.gif", "200x200", "webp")
# https://imgs.example.com/images/test-gif/200x200.webp
```

### PHP

```php
use imagerClient\Imager;

$imager = new Imager(["baseURL" => "https://imgs.example.com/images/", "format" => "webp"]);

$asset = $imager->GetAsset("/test.gif", ["width" => 200, "height" => 200], "gif", 2);
$url = $imager->GetAssetPath("/test.gif", "200x200", "webp");
// https://imgs.example.com/images/test-gif/200x200.webp
```

### TypeScript

```ts
// Client (browser) — no admin methods, no token
import { Imager } from "imager-client";

const imager = new Imager({ baseURL: "https://imgs.example.com/images/", format: "webp" });
const asset = imager.GetAsset("/test.gif", { width: 200, height: 200 }, "gif", 2);
const url = imager.GetAssetPath("/test.gif", "200x200", "webp");
// https://imgs.example.com/images/test-gif/200x200.webp

// Server (Node) — admin methods available only here
import { ImagerServer } from "imager-client/server";

const server = new ImagerServer({
    baseURL: "https://imgs.example.com/images/",
    token: "secret",
    adminURL: "https://imager.example.com",
});
await server.AdminGenerate("/test.gif", true);
```

### Go

```go
import imager "gitverse.ru/pkg-ru/imager-client/src/imager-go"

i := imager.New(imager.Options{
    BaseURL: "https://imgs.example.com/images/",
    Format:  "webp",
})

asset := i.GetAsset("/test.gif", imager.Size{Width: 200, Height: 200}, "gif", 2)
url := i.GetAssetPath("/test.gif", "200x200", "webp")
// https://imgs.example.com/images/test-gif/200x200.webp
```

## Method parameters

| Method | Signature | Result |
|---|---|---|
| `GetAsset` | `(source, segment?, format?, dpr?)` | single `AssetType` |
| `GetAssets` | `(source, segments?, formats?, dprs?)` | `AssetType[]` — Cartesian product of `segments × formats` |
| `GetAssetsHtml` | `(source, segments?, formats?, dprs?, options?)` | `string` — HTML `<picture>`/`<img>` |
| `GetAssetPath` | `(source, segment?, format?, dpr?)` | `string` — URL of the primary variant |
| `AdminGenerate` | `(target, wait?)` | `bool` — HTTP 200/202 (in TS — `ImagerServer` only) |
| `AdminDelete` | `(target, wait?)` | `bool` — HTTP 200 (in TS — `ImagerServer` only) |

### segment — four ways to write it

```text
"thumb"                       # string as-is: named preset
"200x200" | "200x" | "x200"   # size string
{"width": 200, "height": 200} # object; both fields optional
[200, 200]                    # array [width, height]; both required
— not set                     # → "x"
```

### format / formats — string or list

```text
"webp"                    # single format
["webp", "gif"]           # list (for GetAssets)
— not set                 # → imager settings (format / formats) → source format
```

### dpr — number or string

```text
2        # variants without suffix and @2
"3"      # digit string: no suffix, @2, @3
1        # single variant with dpr: 1 field
0        # dpr not used
> 3      # treated as 3
— not set  # → imager settings (dpr)
```

### Examples of different call styles

```python
imager.GetAsset("/test.gif")                       # minimal: segment "x", source format
imager.GetAsset("/test.gif", "thumb")              # named preset
imager.GetAsset("/test.gif", {"width": 200})       # object: width only → "200x"
imager.GetAsset("/test.gif", [200, 200])           # array → "200x200"
imager.GetAsset("/test.gif", "200x200", "webp")    # + format
imager.GetAsset("/test.gif", "200x200", "webp", 2) # + dpr (variants without suffix and @2)

imager.GetAssets("/test.gif", ["200x200", "x400"], ["webp", "gif"], "2")  # 4 assets
imager.AdminGenerate("/test.gif", True)                   # by source
imager.AdminGenerate(asset)                               # by AssetType
imager.AdminDelete(["/path/a.webp", "/path/b.webp"])      # list of ready paths
```

Full description of all variants, the `AssetType` structure, the MIME table and URL building rules — in the language docs: [Python](./PY-EN.md), [PHP](./PHP-EN.md), [TypeScript](./TS-EN.md), [Go](./GO-EN.md).

## Tests

Unified golden cases in [`test/fixture.json`](../test/fixture.json): all 4 languages produce a **byte-identical** JSON result for each case. Prop normalization for framework components — in [`test/fixture-components.json`](../test/fixture-components.json).

```bash
make test
```

or per language:

```bash
python test/test.py
php test/test.php
npm test
go run test/test.go
```

Framework packages:

```bash
make test-react test-vue test-twig
```

© 2025 [Altukhov Vladislav Vladimirovich](https://altuh.ru/about)
