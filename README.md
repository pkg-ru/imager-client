# Imager Client

Клиентская библиотека микросервиса [Imager](https://gitverse.ru/pkg-ru/imager) для четырёх языков — Python, PHP, TypeScript и Go — с единым API и структурно идентичным результатом на всех платформах. Строит canonical URL ассетов (превью, размеры, форматы, retina) и вызывает admin API генерации/удаления.

**Framework integrations:** [React](./packages/react/README.md) · [Vue 3](./packages/vue/README.md) · [Twig](./packages/twig/README.md)

> Для работы нужен настроенный и запущенный [микросервис Imager](https://gitverse.ru/pkg-ru/imager).

**Основной репозиторий:** [GitVerse](https://gitverse.ru/pkg-ru/imager-client) · **Зеркало:** [GitHub](https://github.com/pkg-ru/imager-client) · **Демо:** [altuh.ru/demo/imager](https://altuh.ru/demo/imager)

**Документация:** RU / [EN](./doc/README-EN.md)

---

## Overview

**Imager Service** — микросервис, который по запросу генерирует и отдаёт производные изображения: ресайзы, форматы (webp, avif и др.), retina-варианты.

**Imager Client** — клиентские библиотеки к этому сервису. Клиент не обрабатывает изображения сам: он вычисляет canonical URL ассета по правилам сервиса и, при необходимости, обращается к admin API для генерации или удаления ассетов. Один и тот же URL, построенный на любом из четырёх языков, совпадает — можно строить пути на бэкенде (PHP, Python, Go, Node) и на фронтенде (TypeScript) без расхождений.

## Features

- **Один API — четыре языка.** Все реализации проходят единый набор golden-тестов и дают структурно идентичный результат (сравнение без учёта порядка ключей).
- **Без сторонних runtime-библиотек.** Ядро клиента использует только стандартную библиотеку каждого языка (urllib, curl, fetch, net/http). Исключение: PHP требует расширение `ext-curl`.
- **Гибкие параметры.** Сегмент размера — строкой, объектом или массивом; dpr — числом или строкой; формат — одним или списком. Опция `sort: true` сортирует размерные сегменты в `GetAssets` по `width`/`height` (по возрастанию; сегменты без `width` — в конец) **до** вычисления `dpr`, поэтому все коэффициенты ≥ 1.
- **Безопасные секреты.** В TypeScript admin-методы вынесены в отдельный серверный импорт `imager-client/server`: токен не попадает в браузерный бандл.
- **HTML-рендер.** `GetAssetsHtml` строит готовый `<picture>`/`<img>` с `srcset` (w- или x-режим).

## Architecture / How it works

```text
┌─────────────┐   canonical URL    ┌───────────────┐
│ Imager Client│ ────────────────▶ │ Imager Service │ ──▶ сгенерированный ассет
│  (4 языка)  │                    │  (генерация)   │
└─────────────┘                    └───────────────┘
       │  ▲
       │  └── admin API: AdminGenerate / AdminDelete (только server-side)
       └───── клиентские методы — чистые функции, без HTTP
```

Структура URL: `{baseURL}{path}/{source_name}-{source_format}/{segment}[@{dpr}].{output_format}`

Клиентские методы (`GetAsset`, `GetAssets`, `GetAssetPath`, `GetAssetsHtml`) — чистые функции конкатенации строк: без HTTP-запросов. Admin-методы (`AdminGenerate`, `AdminDelete`) выполняют HTTP-запросы к admin API и доступны только в server-side окружении.

## Supported languages

| Язык | Пакет | Runtime | Установка | Документация |
|---|---|---|---|---|
| Python | [`imager_client`](https://pypi.org/project/imager_client/) | Python 3 | `pip install imager_client` | [RU](./doc/PY-RU.md) / [EN](./doc/PY-EN.md) |
| PHP | [`pkg-ru/imager-client`](https://packagist.org/packages/pkg-ru/imager-client) | PHP ≥ 8.1, ext-curl | `composer require pkg-ru/imager-client` | [RU](./doc/PHP-RU.md) / [EN](./doc/PHP-EN.md) |
| TypeScript | [`imager-client`](https://www.npmjs.com/package/imager-client) | Node 18+ (для server), браузеры | `npm install imager-client` | [RU](./doc/TS-RU.md) / [EN](./doc/TS-EN.md) |
| Go | [`gitverse.ru/pkg-ru/imager-client/v2`](https://pkg.go.dev/gitverse.ru/pkg-ru/imager-client/v2) | Go ≥ 1.23.7 | `go get gitverse.ru/pkg-ru/imager-client/v2` | [RU](./doc/GO-RU.md) / [EN](./doc/GO-EN.md) |

## Framework integrations

Тонкие обёртки над ядром: вся логика (сегменты, dpr, форматы, srcset) — в ядре, компоненты нормализуют алиасы props (`src`→`source`, `preset`→`segment`, `width`/`height`→сегмент) и рендерят нативные узлы фреймворка.

Плагины **не являются client-only**: инстанс `Imager` нужен и на сервере (SSR/prerender формируют `<picture>` с `<source>` в HTML), и на клиенте (hydration). Ядро — чистые функции без DOM/`window`, поэтому один и тот же код даёт идентичный HTML на сервере и на клиенте. Примеры интеграции: [Next.js](./packages/react/README.md#ssr--prerender--hydration), [Nuxt 3](./packages/vue/README.md#ssr--prerender--hydration), SvelteKit.

| Фреймворк | Пакет | Требования | Документация |
|---|---|---|---|
| React | [`@pkg-ru/imager-react`](https://www.npmjs.com/package/@pkg-ru/imager-react) | react ≥ 17 | [README](./packages/react/README.md) |
| Vue | [`@pkg-ru/imager-vue`](https://www.npmjs.com/package/@pkg-ru/imager-vue) | vue ≥ 3.2 | [README](./packages/vue/README.md) |
| Twig | [`pkg-ru/imager-twig`](https://packagist.org/packages/pkg-ru/imager-twig) | PHP ≥ 8.0, twig ^3.0 | [README](./packages/twig/README.md) |

Пакеты самодостаточны: ядро встроено в бандл, `imager-client` — опциональный peerDependency (нужен только для своего инстанса, например `ImagerServer` с admin-методами).

## Installation

```bash
pip install imager_client          # Python
composer require pkg-ru/imager-client   # PHP
npm install imager-client          # TypeScript
go get gitverse.ru/pkg-ru/imager-client/v2   # Go
```

## Quick Start

Один сценарий для всех языков: source `/test.gif` → сегмент `200x200` → формат `webp` → dpr `2` → canonical URL.

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
// Клиент (браузер) — без admin-методов и токена
import { Imager } from "imager-client";

const imager = new Imager({ baseURL: "https://imgs.example.com/images/", format: "webp" });
const asset = imager.GetAsset("/test.gif", { width: 200, height: 200 }, "gif", 2);
const url = imager.GetAssetPath("/test.gif", "200x200", "webp");
// https://imgs.example.com/images/test-gif/200x200.webp
```

### Go

```go
import imager "gitverse.ru/pkg-ru/imager-client/v2"

i := imager.New(imager.Options{
    BaseURL: "https://imgs.example.com/images/",
    Format:  "webp",
})

asset := i.GetAsset("/test.gif", imager.Size{Width: 200, Height: 200}, "gif", 2)
url := i.GetAssetPath("/test.gif", "200x200", "webp")
// https://imgs.example.com/images/test-gif/200x200.webp
```

## Common use cases

```python
imager.GetAsset("/test.gif")                       # минимальный: сегмент "x", формат исходника
imager.GetAsset("/test.gif", "thumb")              # именованный пресет
imager.GetAsset("/test.gif", {"width": 200})       # объект: только ширина → "200x"
imager.GetAsset("/test.gif", [200, 200])           # массив → "200x200"
imager.GetAsset("/test.gif", "200x200", "webp")    # + формат
imager.GetAsset("/test.gif", "200x200", "webp", 2) # + dpr (варианты без суффикса и @2)

imager.GetAssets("/test.gif", ["200x200", "x400"], ["webp", "gif"], "2")  # 2 ассета (по одному на формат)
imager.GetAssetsHtml("/test.gif", "200x200", ["webp", "jpg"], 2)          # готовый <picture>
```

Admin-методы (только server-side):

```python
imager.AdminGenerate("/test.gif", True)                   # по source
imager.AdminGenerate(asset)                               # по AssetType
imager.AdminDelete(["/path/a.webp", "/path/b.webp"])      # список готовых путей
```

## Client vs Server-side usage

Клиентские методы — чистые функции, безопасны в любом окружении. Admin-методы требуют токен и доступ к admin API, поэтому:

- **Python, PHP, Go** — все методы в одном классе; используйте admin-методы только на бэкенде, не раскрывайте токен во фронтенд-коде.
- **TypeScript** — разделение на уровне импортов:
  - `imager-client` — браузер/клиент: `GetAsset`, `GetAssets`, `GetAssetPath`, `GetAssetsHtml`. Без token/adminURL.
  - `imager-client/server` — Node.js: `ImagerServer` расширяет `Imager` методами `AdminGenerate`, `AdminDelete` (async, fetch).

```ts
import { ImagerServer } from "imager-client/server";

const server = new ImagerServer({
    baseURL: "https://imgs.example.com/images/",
    token: "secret",
    adminURL: "https://imager.example.com",
});
await server.AdminGenerate("/test.gif", true);
```

## Documentation

| Документ | Описание |
|---|---|
| [README-EN](./doc/README-EN.md) | Английская версия этого файла |
| [PY-RU](./doc/PY-RU.md) / [PY-EN](./doc/PY-EN.md) | Python: полный API, AssetType, MIME-таблица |
| [PHP-RU](./doc/PHP-RU.md) / [PHP-EN](./doc/PHP-EN.md) | PHP: полный API, AssetType, MIME-таблица |
| [TS-RU](./doc/TS-RU.md) / [TS-EN](./doc/TS-EN.md) | TypeScript: клиент + сервер, browser/server разделение |
| [GO-RU](./doc/GO-RU.md) / [GO-EN](./doc/GO-EN.md) | Go: полный API, AssetType, MIME-таблица |
| [React README](./packages/react/README.md) | React-компоненты, SSR/hydration |
| [Vue README](./packages/vue/README.md) | Vue-компоненты, SSR/hydration |
| [Twig README](./packages/twig/README.md) | Twig-функции |

## Packages

| Registry | Пакеты |
|---|---|
| [PyPI](https://pypi.org/project/imager_client/) | `imager_client` |
| [Packagist](https://packagist.org/packages/pkg-ru/imager-client) | `pkg-ru/imager-client`, [`pkg-ru/imager-twig`](https://packagist.org/packages/pkg-ru/imager-twig) |
| [npm](https://www.npmjs.com/package/imager-client) | `imager-client`, [`@pkg-ru/imager-react`](https://www.npmjs.com/package/@pkg-ru/imager-react), [`@pkg-ru/imager-vue`](https://www.npmjs.com/package/@pkg-ru/imager-vue) |
| [pkg.go.dev](https://pkg.go.dev/gitverse.ru/pkg-ru/imager-client/v2) | `gitverse.ru/pkg-ru/imager-client/v2` |

## Compatibility

| Язык | Версия | Runtime |
|---|---|---|
| Python | 2.0.5 | Python 3 |
| PHP | 2.x | PHP ≥ 8.1, ext-curl |
| TypeScript | 2.0.5 | Node 18+ (для server), современные браузеры |
| Go | 2.0.5 | Go ≥ 1.23.7 |

Все реализации v2 используют единый формат URL и проходят одни и те же golden-тесты. Изменения формата URL между мажорными версиями — breaking changes; см. changelog в репозитории.

## Limitations

- Клиент не генерирует изображения — для этого нужен запущенный [Imager Service](https://gitverse.ru/pkg-ru/imager).
- Admin-методы недоступны в браузерном импорте `imager-client` (только `imager-client/server`).
- Python `GetAssetsHtml` может бросить `IndexError` при пустом результате.
- PHP требует расширение `ext-curl`.
- Поддерживаемые форматы: `jpg, jpeg, png, webp, avif, heif, heic, apng, jxl, gif`. Всё остальное (видео, отсутствие расширения) считается не-картинкой: `auto`/`""` резолвится в `jpg`.
- DPR ограничен диапазоном 1..3; при dpr ≥ 2 генерируются шаги 1..dpr с суффиксами `@2`/`@3`.

## Testing

Единые golden-кейсы: [`test/fixture.json`](test/fixture.json) (82 кейса) — все 4 языка дают структурно идентичный результат для каждого кейса. Нормализация props фреймворк-компонентов — [`test/fixture-components.json`](test/fixture-components.json) (12 кейсов).

```bash
make test   # Go + TS + PHP + Python (golden-прогон)
```

или по языкам:

```bash
python test/test.py
php test/test.php
npm test
go run test/test.go
```

Фреймворк-пакеты:

```bash
make test-react test-vue test-twig
```

## Development

```bash
npm run build        # сборка TS-ядра
npm run lint         # линтинг
make build-react     # сборка react-пакета (включая ядро)
make build-vue       # сборка vue-пакета (включая ядро)
```

Версии пакетов синхронизируются скриптом [`scripts/sync_version.py`](scripts/sync_version.py).

## Project ecosystem

- [Imager Service](https://gitverse.ru/pkg-ru/imager) — микросервис генерации изображений
- [Imager Client](https://gitverse.ru/pkg-ru/imager-client) — этот репозиторий (зеркало: [GitHub](https://github.com/pkg-ru/imager-client))
- [Демо](https://altuh.ru/demo/imager) — пример работы микросервиса и клиентской части

## License

[GPL-3.0](./LICENSE)

## Author

[Алтухов Владислав Владимирович](https://altuh.ru/about)
