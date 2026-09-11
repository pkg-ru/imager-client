# [Imager](https://gitverse.ru/pkg-ru/imager) Client

Клиентская библиотека микросервиса **Imager** для четырёх языков — Python, PHP, TypeScript и Go — с **идентичным поведением на всех платформах**. Строит пути и URL ассетов (превью, размеры, форматы, retina) и вызывает админ-методы генерации/удаления.

> Для работы нужен настроенный и запущенный [микросервис Imager](https://gitverse.ru/pkg-ru/imager).

> **Основной репозиторий:** [GitVerse](https://gitverse.ru/pkg-ru/imager-client) · **Зеркало:** [GitHub](https://github.com/pkg-ru/imager-client)

## Документация: **RU** / [EN](./doc/README-EN.md)

- [Python](./doc/PY-RU.md) — пакет на [PyPI](https://pypi.org/project/imager_client/)
- [PHP](./doc/PHP-RU.md) — пакет на [Packagist](https://packagist.org/packages/pkg-ru/imager-client)
  - [Twig](./packages/twig/README.md) — пакет на [Packagist](https://packagist.org/packages/pkg-ru/imager-twig)
- [TypeScript (клиент + сервер)](./doc/TS-RU.md) — пакет на [npm](https://www.npmjs.com/package/imager-client)
  - [Vue](./packages/vue/README.md) — пакет на [npm](https://www.npmjs.com/package/@pkg-ru/imager-vue)
  - [React](./packages/react/README.md) — пакет на [npm](https://www.npmjs.com/package/@pkg-ru/imager-react)
- [Go](./doc/GO-RU.md) — модуль на [pkg.go.dev](https://pkg.go.dev/gitverse.ru/pkg-ru/imager-client)

---

## Почему Imager Client

- **Один API — четыре языка.** Все реализации дают **побайтово идентичный** JSON-результат на едином наборе golden-тестов: можно строить URL на бэкенде (PHP, Python, Go, Node) и на фронтенде (TS) без расхождений.
- **Zero-dependency.** Ни одного внешнего пакета: только стандартная библиотека каждого языка (urllib, curl, fetch, net/http).
- **Мгновенно.** Клиентские методы — чистые функции конкатенации строк: без HTTP, без валидации, без исключений. Генерация миллиона ассетов — практически мгновенно.
- **Безопасные секреты.** В TypeScript админ-методы вынесены в отдельный серверный импорт `imager-client/server`: токен физически не может попасть в браузерный бандл.
- **Гибкие параметры.** Сегмент размера можно передавать строкой, объектом или массивом; dpr — числом или строкой; формат — одним или списком.

## Установка

| Язык | Пакет | Команда |
|---|---|---|
| Python | `imager_client` (PyPI) | `pip install imager_client` |
| PHP | `pkg-ru/imager-client` (Composer) | `composer require pkg-ru/imager-client` |
| TypeScript | `imager-client` (npm) | `npm install imager-client` |
| Go | `gitverse.ru/pkg-ru/imager-client` | `go get gitverse.ru/pkg-ru/imager-client` |

## Фреймворк-компоненты

Тонкие обёртки над ядром для популярных фреймворков: вся логика (сегменты,
dpr, форматы, srcset) — в ядре, компоненты нормализуют алиасы props
(`src`→`source`, `preset`→`segment`, `width`/`height`→сегмент) и рендерят
нативные узлы фреймворка.

| Пакет | Экосистема | Компоненты | Документация |
|---|---|---|---|
| `@pkg-ru/imager-react` | npm, peer: react ≥17 | `ImagerPlugin`, `ImagerProvider`, `ImagerAssets`, `ImagerAsset` | [README](./packages/react/README.md) |
| `@pkg-ru/imager-vue` | npm, peer: vue ≥3.2 | `ImagerPlugin`, `ImagerProvider`, `ImagerAssets`, `ImagerAsset` | [README](./packages/vue/README.md) |
| `pkg-ru/imager-twig` | composer, twig ≥3 | функции `imager_assets`, `imager_asset`, `imager_assets_raw` | [README](./packages/twig/README.md) |

Пакеты **самодостаточны**: ядро встроено в бандл, `imager-client` — опциональный peerDependency
(нужен только для своего инстанса, например `ImagerServer` с админ-методами).

```tsx
// React: глобальная инициализация
ImagerPlugin.install({ baseURL: "...", format: "webp", dpr: 2 });

<ImagerAssets src="/test.png" width={200} height={200} dpr={2} format="webp" alt="Фото" />
```

```ts
// Vue: глобальная инициализация через app.use
createApp(App).use(ImagerPlugin, { baseURL: "...", format: "webp", dpr: 2 }).mount("#app");
```

```twig
{# Twig: расширение с imager-сервисом #}
{{ imager_assets('/test.png', {preset: 'thumb', format: 'webp', alt: 'Фото'})|raw }}
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
// Клиент (браузер) — без admin-методов и токена
import { Imager } from "imager-client";

const imager = new Imager({ baseURL: "https://imgs.example.com/images/", format: "webp" });
const asset = imager.GetAsset("/test.gif", { width: 200, height: 200 }, "gif", 2);
const url = imager.GetAssetPath("/test.gif", "200x200", "webp");
// https://imgs.example.com/images/test-gif/200x200.webp

// Сервер (Node) — только здесь доступны админ-методы
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

## Параметры методов

| Метод | Сигнатура | Результат |
|---|---|---|
| `GetAsset` | `(source, segment?, format?, dpr?)` | один `AssetType` |
| `GetAssets` | `(source, segments?, formats?, dprs?)` | `AssetType[]` — декартово произведение `segments × formats` |
| `GetAssetsHtml` | `(source, segments?, formats?, dprs?, options?)` | `string` — HTML `<picture>`/`<img>` |
| `GetAssetPath` | `(source, segment?, format?, dpr?)` | `string` — URL основного варианта |
| `AdminGenerate` | `(target, wait?)` | `bool` — HTTP 200/202 (в TS — только `ImagerServer`) |
| `AdminDelete` | `(target, wait?)` | `bool` — HTTP 200 (в TS — только `ImagerServer`) |

### segment — четыре формы записи

```text
"thumb"                       # строка как есть: именованный пресет
"200x200" | "200x" | "x200"   # строка-размер
{"width": 200, "height": 200} # объект; оба поля необязательны
[200, 200]                    # массив [width, height]; оба обязательны
— не задан                    # → "x"
```

### format / formats — строка или список

```text
"webp"                    # один формат
["webp", "gif"]           # список (для GetAssets)
— не задан                # → настройки imager (format / formats) → формат исходника
```

### dpr — число или строка

```text
2        # варианты без суффикса и @2
"3"      # строка-цифра: без суффикса, @2, @3
1        # один вариант с полем dpr: 1
0        # dpr не используется
> 3      # трактуется как 3
— не задан # → настройки imager (dpr)
```

### Примеры разных вариантов вызова

```python
imager.GetAsset("/test.gif")                       # минимальный: сегмент "x", формат исходника
imager.GetAsset("/test.gif", "thumb")              # именованный пресет
imager.GetAsset("/test.gif", {"width": 200})       # объект: только ширина → "200x"
imager.GetAsset("/test.gif", [200, 200])           # массив → "200x200"
imager.GetAsset("/test.gif", "200x200", "webp")    # + формат
imager.GetAsset("/test.gif", "200x200", "webp", 2) # + dpr (варианты без суффикса и @2)

imager.GetAssets("/test.gif", ["200x200", "x400"], ["webp", "gif"], "2")  # 4 ассета
imager.AdminGenerate("/test.gif", True)                   # по source
imager.AdminGenerate(asset)                               # по AssetType
imager.AdminDelete(["/path/a.webp", "/path/b.webp"])      # список готовых путей
```

Полное описание всех вариантов, структуры `AssetType`, MIME-таблица и правила формирования URL — в языковых доках: [Python](./doc/PY-RU.md), [PHP](./doc/PHP-RU.md), [TypeScript](./doc/TS-RU.md), [Go](./doc/GO-RU.md).

## Тесты

Единые golden-кейсы в [`test/fixture.json`](test/fixture.json): все 4 языка дают **побайтово идентичный** JSON-результат для каждого кейса. Нормализация props фреймворк-компонентов — в [`test/fixture-components.json`](test/fixture-components.json).

```bash
make test
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

© 2025 [Алтухов Владислав Владимирович](https://altuh.ru/about)
