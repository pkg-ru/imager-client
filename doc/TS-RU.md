# Imager Client — TypeScript

Клиент микросервиса **Imager** на TypeScript: построение путей/URL ассетов и админ-методы.

- [English version](./TS-EN.md)
- [Обзор](../README.md)

---

## Разделение клиентской и серверной части

Пакет `imager-client` состоит из **двух точек входа**:

| Импорт | Класс | Содержимое |
|---|---|---|
| `import { Imager } from "imager-client"` | `Imager` | клиентская (браузерная) часть: `GetAsset`, `GetAssets`, `GetAssetPath` |
| `import { ImagerServer } from "imager-client/server"` | `ImagerServer extends Imager` | серверная часть: + `AdminGenerate`, `AdminDelete` |

**Почему token только на сервере.** Браузерные сборщики (webpack/vite/esbuild) разрешают условие `browser` в `package.json` `exports` и физически **не включают** `imager-server` в бандл. Класс `Imager` вообще не содержит поля `token` — даже если передать `token` в опции, он будет проигнорирован (базовый класс не имеет такого поля). Поле `token` в `ImagerServer` — `private` и не входит в JSON-сериализацию. Так секреты не могут попасть в клиентский код.

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

## Установка

Пакет `imager-client` (Node 18+ для серверной части, без внешних зависимостей):

```bash
npm install imager-client
```

## Инициализация

### Клиентская часть

```ts
const imager = new Imager(options?: ImagerOptions | null);
```

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `dpr` | `number` | `0` | итоговое dpr по умолчанию; 0-1 — не используется, 2-3 — используется |
| `format` | `string` | `""` | формат генерации по умолчанию (пусто — формат исходника) |
| `formats` | `string[]` | `[]` | список форматов по умолчанию; если пуст — используется `format` |
| `baseURL` | `string` | `"/"` | база URL ассетов; нормализуется (всегда с завершающим `/`) |

### Серверная часть

```ts
const imager = new ImagerServer(options?: ImagerServerOptions | null);
```

`ImagerServerOptions extends ImagerOptions` — добавляет:

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `token` | `string` | `""` | токен админ-методов (только `AdminGenerate`/`AdminDelete`) |
| `adminURL` | `string` | `""` | базовый URL админ-API (без завершающего `/`) |

Нормализация `baseURL`: пустой/не задан → `"/"`; без завершающего `/` → добавляется. `adminURL`: завершающий `/` удаляется.

```ts
// Клиент (браузер)
const imager = new Imager({
    baseURL: "https://imgs.example.com/images",
    format: "webp",
    dpr: 2,
});

// Сервер
const server = new ImagerServer({
    baseURL: "https://imgs.example.com/images",
    format: "webp",
    token: "secret",
    adminURL: "https://imager.example.com",
});
```

## Методы

### Клиентская часть (`Imager`)

```ts
GetAsset(source: string, segment?: Segment, format?: string, dpr?: number | string): AssetType;
GetAssets(source: string, segments?: Segment | Segment[], formats?: string | string[], dprs?: number | string): AssetType[];
GetAssetsHtml(source: string, segments?: Segment | Segment[], formats?: string | string[], dprs?: number | string, options?: Record<string, unknown>): string;
GetAssetPath(source: string, segment?: Segment, format?: string, dpr?: number | string): string;
```

#### GetAsset

Возвращает **один** `AssetType`. `paths` содержит все варианты dpr от 1 до итогового.

| Параметр | Тип | Описание |
|---|---|---|
| `source` | `string` | путь к исходнику (`/test.gif`, `test.gif`, `thumbs/photo.jpg`) |
| `segment` | `Segment` \| `null` | сегмент; не задан → `"x"` |
| `format` | `string` \| `null` | итоговый формат; не задан → настройки `format` → формат исходника |
| `dpr` | `number` \| `string` \| `null` | итоговое dpr; не задан → настройки `dpr`; < 1 → не используется |

#### GetAssets

Возвращает **список** `AssetType` — декартово произведение `segments × formats` (внешний цикл — segments). `segments` не задан → `["x"]`. `formats` не задан → настройки `formats` → `[format]` → `[формат исходника]`.

#### GetAssetsHtml

Возвращает **строку** — HTML-разметку `<picture>`/`<img>` по тому же декартову произведению `segments × formats`, что и `GetAssets`. Один вызов генерирует ровно один тег `<picture>` (или `<img>`, если формат один).

`options` — HTML-атрибуты:

| Атрибут | Куда попадает | Примечание |
|---|---|---|
| `class`, `id`, `data-*`, прочие | `<picture>` | — |
| `alt`, `sizes`, `loading` | `<img>` | — |
| `decoding`, `fetchpriority` | `<img>` | нативные атрибуты `<img>` (async-декодирование, приоритет загрузки) |
| `lazy` | `<img>` | булев: превращается в `loading="lazy"` |
| `width`, `height` | `<img>` | перекрываются автоматическими значениями из базового path (для CLS) |
| `imgAttrs` | `<img>` | объект атрибутов, попадающих именно на `<img>`; объединяется с перенаправленными атрибутами, **имеет приоритет** |

Правила:

- Атрибуты выводятся в алфавитном порядке имён (детерминированный вывод).
- Булевы атрибуты (`lazy: true`, `loading: true`) — без значения; `false`/`null` — пропускаются.
- Значения HTML-экранируются (`&` → `&`, `<` → `<`, `>` → `>`, `"` → `"`, `'` → `&#x27;`).
- Внутри `<picture>` теги делятся по типу (формату): все пути одного формата объединяются в один `srcset`.
- Для `<img>` выбирается группа: 1) формат исходника (`source_format: true`); 2) первый поддерживаемый всеми браузерами (`all_support: true`); 3) последняя. Остальные форматы — `<source type="...">`.
- `srcset`-дескрипторы: если в `options` передан `sizes` — `w`-дескрипторы по ширине (`200w`, `400w`); иначе — `x`-дескрипторы по dpr (`1x`, `2x`, `3x`); если dpr нет, но есть высота — dpr вычисляется из отношения высот (дробные допустимы, напр. `1.5x`); размеры автоматически не генерируются.
- `width`/`height` на `<img>` добавляются из базового (первого) path, если известны — для CLS. Если пользователь задал свои `width`/`height` (напрямую или через `imgAttrs`) — автоматические не добавляются (без дублирования).
- `imgAttrs` объединяется с перенаправленными img-атрибутами (`alt`, `sizes`, `loading`, `width`, `height`, `decoding`, `fetchpriority`): значения из `imgAttrs` имеют приоритет. Сам ключ `imgAttrs` в `<picture>` не попадает.
- Если ассетов нет — возвращается пустая строка.

Пример:

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

Пример с `imgAttrs` (атрибуты именно на `<img>`, приоритет над перенаправленными):

```ts
const html = imager.GetAssetsHtml(
    "/test.png",
    "200x200",
    ["webp", "png"],
    2,
    {
        class: "photo",
        alt: "Фото",
        imgAttrs: { class: "img", decoding: "async", fetchpriority: "high", width: 333, height: 444 },
    },
);
```

```html
<picture class="photo">
    <source type="image/webp" srcset="/test-png/200x200.webp 1x, /test-png/200x200@2.webp 2x">
    <img src="/test-png/200x200.png" srcset="/test-png/200x200.png 1x, /test-png/200x200@2.png 2x" alt="Фото" class="img" decoding="async" fetchpriority="high" width="333" height="444">
</picture>
```

#### GetAssetPath

Возвращает **строку** — URL основного варианта ассета. Эквивалент `GetAsset(...).paths[0].path`.

### Серверная часть (`ImagerServer`)

```ts
AdminGenerate(target: string | AssetType | AssetType[] | string[], wait?: boolean): Promise<boolean>;
AdminDelete(target: string | AssetType | AssetType[] | string[], wait?: boolean): Promise<boolean>;
```

#### AdminGenerate

`POST {adminURL}/admin/assets/generate`, заголовок `Authorization: Bearer <token>`. Возвращает `true` при HTTP 200/202, иначе `false`.

#### AdminDelete

`DELETE {adminURL}/admin/assets/delete` — то же тело и заголовок. Возвращает `true` при HTTP 200, иначе `false`.

#### Маппинг типов входа `target`

| Тип входа `target` | Режим | Тело запроса |
|---|---|---|
| `string` | A (source) | `{"source": "<строка как есть>", "wait": ...}` |
| `AssetType` | B (assets) | `{"assets": [paths[].path из AssetType], "wait": ...}` |
| `AssetType[]` | B (assets) | `{"assets": [paths[].path из ВСЕХ AssetType, подряд], "wait": ...}` |
| `string[]` | B (assets) | `{"assets": ["<элемент 1>", "<элемент 2>", ...], "wait": ...}` |

- `string` — режим A: путь к исходнику передаётся в `source` как есть.
- `AssetType` / `AssetType[]` — режим B: собираются все `paths[].path` в один список `assets`.
- `string[]` — режим B: элементы — **уже готовые пути** к ассетам, передаются в `assets` **как есть**, без валидации и без преобразований.

Если `token` или `adminURL` пусты — админ-методы возвращают `false` **без** HTTP-запроса. HTTP-клиент — `fetch` (Node 18+).

## Segment

```ts
type Segment = string | { width?: number; height?: number } | [number, number];
```

`segment` — строка как есть (`"preset"`, `"200x200"`, `"200x"`, `"x200"`, `"x"`), объект `{width, height}` (оба необязательны), кортеж `[width, height]` (оба обязательны) или не задан → `"x"`.

| Вход | Результат |
|---|---|
| `"preset"` | `"preset"` |
| `{ width: 200, height: 200 }` | `"200x200"` |
| `{ width: 200 }` | `"200x"` |
| `{ height: 200 }` | `"x200"` |
| `{}` / `{ width: 0, height: 0 }` | `"x"` |
| `[200, 200]` | `"200x200"` |
| `[0, 400]` | `"x400"` |

## dpr

- `dpr`/`dprs` — число или строка-цифра (`"2"`).
- Итог < 1 → не используется (один path-объект без суффикса и без поля `dpr`).
- Итог = 1 (задан явно) → один path-объект с `dpr: 1`.
- Итог = 2 → `[без суффикса, @2]`.
- Итог = 3 → `[без суффикса, @2, @3]`.
- Итог > 3 → трактуется как 3.

## Формат URL ассета

```text
{baseURL}{path}/{source_name}-{source_format}/{segment}@{dpr}.{output_format}
```

- `path` — логический путь исходника (ведущий `/` отбрасывается): `/thumbs/photo.jpg` → `path="thumbs"`, `name="photo"`, `format="jpg"`.
- `source_format` — расширение в нижнем регистре.
- `@{dpr}` — добавляется к сегменту только при dpr ≥ 2.
- `output_format` — итоговый формат (аргумент → настройки → формат исходника).

## Структура AssetType

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
    source_format?: boolean;  // только при true
    all_support?: boolean;    // только при true
}
```

Пример результата `GetAsset("/test.gif", { width: 200, height: 200 }, "gif", 2)`:

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

Правила заполнения path-объектов:

- `path` — полный URL, всегда.
- `dpr` — при dpr ≥ 2 или явном dpr = 1.
- `width`/`height` — только для size-сегмента (`200x200`, `{w,h}`, `[w,h]`, `x` и т.п.); при dpr ≥ 2 умножаются на dpr. Для именованного пресета не добавляются.
- `type` — MIME итогового формата; видео (`mp4`, `webm`, `mov`, `mkv`, `avi`, `m4v`) и неизвестный формат → `""`.
- `source_format` — `true`, если итоговый формат совпадает с исходным форматом файла; в JSON присутствует только при `true`.
- `all_support` — `true`, если итоговый формат ∈ {`jpg`, `jpeg`, `gif`, `png`} (поддерживается всеми браузерами); в JSON присутствует только при `true`.

### MIME по формату

| Формат | MIME |
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

## Разные варианты вызова

```ts
// segment: четыре формы записи
imager.GetAsset("/test.gif");                     // не задан → "x", формат исходника
imager.GetAsset("/test.gif", "thumb");            // строка: именованный пресет
imager.GetAsset("/test.gif", "200x200");          // строка: размер
imager.GetAsset("/test.gif", { width: 200 });     // объект: только ширина → "200x"
imager.GetAsset("/test.gif", { height: 400 });    // объект: только высота → "x400"
imager.GetAsset("/test.gif", [200, 200]);         // кортеж [width, height] → "200x200"

// format: строка или список, dpr: число или строка
imager.GetAsset("/test.gif", "200x200", "webp");       // + формат
imager.GetAsset("/test.gif", "200x200", "webp", 2);    // + dpr
imager.GetAsset("/test.gif", "200x200", "webp", "2");  // dpr строкой
imager.GetAssets("/test.gif", ["200x200", "x400"], ["webp", "gif"], 2);  // 4 ассета
```

## Примеры

### Клиентская часть (браузер)

```ts
import { Imager } from "imager-client";

const imager = new Imager({ baseURL: "https://imgs.example.com/images/", format: "webp" });

// Один ассет
const asset = imager.GetAsset("/test.gif", { width: 200, height: 200 }, "gif", 2);
console.log(asset.type);   // image/gif
console.log(asset.paths);  // [{path: '.../200x200.gif', width: 200, height: 200},
                           //  {path: '.../200x200@2.gif', width: 400, height: 400, dpr: 2}]

// Список ассетов (декартово произведение)
const assets = imager.GetAssets("/test.gif", [{ width: 200, height: 200 }, { height: 400 }], ["webp", "gif"], 1);
console.log(assets.length);  // 4

// Только URL основного варианта
const url = imager.GetAssetPath("/test.gif", "200x200", "webp");
console.log(url);  // https://imgs.example.com/images/test-gif/200x200.webp
```

### Серверная часть (Node)

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

## Тесты

```bash
npm test
```

Раннер читает [`test/fixture.json`](../test/fixture.json) и выполняет golden-кейсы. Полный прогон всех языков — `make test` (оркестратор — `go run test/test.go`).

© 2025 [Алтухов Владислав Владимирович](https://altuh.ru/about)
