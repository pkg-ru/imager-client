# Imager Client — Go

Клиент микросервиса **Imager** на Go: построение путей/URL ассетов и админ-методы.

- [English version](./GO-EN.md)
- [Обзор](../README.md)
- [Демо](https://altuh.ru/demo/imager) — пример работы микросервиса и клиентской части

---

## Установка

Модуль `gitverse.ru/pkg-ru/imager-client/v2` (go 1.23.7+, package `imager`, без внешних зависимостей):

```bash
go get gitverse.ru/pkg-ru/imager-client/v2
```

Импорт:

```go
import imager "gitverse.ru/pkg-ru/imager-client/v2"
```

## Инициализация

```go
i := imager.New(options ...imager.Options) *Imager
```

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `Token` | `string` | `""` | токен админ-методов (только `AdminGenerate`/`AdminDelete`) |
| `Dpr` | `int` | `0` | итоговое dpr по умолчанию; 0-1 — не используется, 2-3 — используется |
| `Format` | `string` | `""` | формат генерации по умолчанию (`""`/`"auto"` — формат исходника; если исходник не картинка — `jpg`) |
| `Formats` | `[]string` | `[]` | список форматов по умолчанию; если пуст — используется `Format`; дубли удаляются (`jpeg` → `jpg`) |
| `BaseURL` | `string` | `"/"` | база URL ассетов; нормализуется (всегда с завершающим `/`) |
| `AdminURL` | `string` | `""` | базовый URL админ-API (без завершающего `/`) |

Нормализация `BaseURL`: пустой/не задан → `"/"`; без завершающего `/` → добавляется. `AdminURL`: завершающий `/` удаляется.

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

## Методы

### GetAsset

```go
func (i *Imager) GetAsset(source string, segment any, format string, dpr any) AssetType
```

Возвращает **один** `AssetType`. `Paths` содержит все варианты dpr от 1 до итогового.

| Параметр | Тип | Описание |
|---|---|---|
| `source` | `string` | путь к исходнику (`/test.gif`, `test.gif`, `thumbs/photo.jpg`) |
| `segment` | `any` | `string` \| `Size` \| `[2]int` \| `nil`; не задан → `"x"` |
| `format` | `string` | итоговый формат; `"auto"`/`""` → формат исходника (если исходник не картинка — `jpg`); пусто → настройки `Format` → формат исходника |
| `dpr` | `any` | `int` \| `string`; не задан → настройки `Dpr`; < 1 → не используется |

### GetAssets

```go
func (i *Imager) GetAssets(source string, segments any, formats any, dprs any) []AssetType
```

Возвращает **список** `AssetType` — по одному на каждый формат (все ассеты с одинаковым типом объединяются в один `AssetType`). Внутри `Paths` порядок **сегмент-мажорный**: для каждого сегмента все dpr-шаги подряд. `Dpr` каждого пути пересчитывается из фактических размеров: база — ширина (или высота) первого участника с известным размером, `dpr = фактическая ширина / базовая ширина`. `segments` не задан → `["x"]`. `formats` не задан → настройки `Formats` → `[Format]` → `[формат исходника]`.

Список форматов дедуплицируется: `jpeg` нормализуется к `jpg`, дубли удаляются (первое вхождение сохраняет позицию). Элемент `"auto"` (или `""`) означает формат исходника; если исходник не картинка (видео, нет расширения) — подставляется `jpg`. Поддерживаемые форматы картинок: `jpg, jpeg, png, webp, avif, heif, heic, apng, jxl, gif`.

```go
i.GetAssets("/test.jpg", "100x100", []string{"webp", "avif", "jpg", "webp", "auto"}, nil)  // → webp, avif, jpg
i.GetAssets("/test.jpg", "100x100", []string{"webp", "auto"}, nil)                         // → webp, jpg
i.GetAssets("/test.jpg", "100x100", []string{"jpg", "auto"}, nil)                          // → jpg
i.GetAssets("/test.mov", "100x100", []string{"jpg", "auto"}, nil)                          // → jpg
i.GetAssets("/test.jpg", "100x100", []string{"webp", "jpg", "auto"}, nil)                  // → webp, jpg
```

### GetAssetsHtml

```go
func (i *Imager) GetAssetsHtml(source string, segments any, formats any, dprs any, options map[string]any) string
```

Возвращает **строку** — HTML-разметку `<picture>`/`<img>` по тем же ассетам, что и `GetAssets` (ассеты группируются по типу). Один вызов генерирует ровно один тег `<picture>` (или `<img>`, если формат один).

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
- Булевы атрибуты (`lazy: true`, `loading: true`) — без значения; `false`/`nil` — пропускаются.
- Значения HTML-экранируются (`&` → `&`, `<` → `<`, `>` → `>`, `"` → `"`, `'` → `&#x27;`).
- Внутри `<picture>` теги делятся по типу (формату): все пути одного формата объединяются в один `srcset`.
- Для `<img>` выбирается группа: 1) формат исходника (`SourceFormat: true`); 2) первый поддерживаемый всеми браузерами (`AllSupport: true`); 3) последняя. Остальные форматы — `<source type="...">`.
- `srcset`-дескрипторы: если в `options` передан `sizes` — **w-режим**: `w`-дескрипторы по ширине (`200w`, `400w`); пути без ширины (сегмент `x`, оригинальный размер) в srcset **не попадают** — оригинал остаётся только в `src` у `<img>` как fallback; если в группе только `x`-пути — srcset пуст. Иначе — **x-режим**: `x`-дескрипторы по dpr (`1x`, `2x`, `3x`); если dpr нет, но есть высота — dpr вычисляется из отношения высот (дробные допустимы, напр. `1.5x`); `x`-пути включаются в srcset с эвристикой **max+1**: `max_dpr` вычисляется **только из размерных путей** (у которых есть width или height); dpr-поля `x`-путей (шаги 1, 2, 3...) в расчёт не участвуют. Если размерные пути есть (`max_dpr > 0`) — дескриптор = `(max_dpr + 1) × dpr-шаг` (приблизительный, т.к. реальный размер оригинала неизвестен); если размерных путей нет, но есть dpr-шаги (`dprs ≥ 2`) — дескриптор = dpr-шаг (`1x`, `2x`, `3x`...); если нет ни размерных путей, ни dpr-шагов (`dprs = 0`) — путь в srcset **без дескриптора** (просто путь, без ` 1x`). Размеры автоматически не генерируются.
- `<source>` всегда содержит `srcset` (никогда `src`), даже при одном пути в группе; если srcset пуст (в w-режиме все пути — `x`) — `<source>` не выводится.
- `<img>`: `srcset` добавляется только если путей > 1 **и** srcset не пуст; иначе у `<img>` только `src`.
- `width`/`height` на `<img>` добавляются из базового (первого) path, если известны — для CLS. Если пользователь задал свои `width`/`height` (напрямую или через `imgAttrs`) — автоматические не добавляются (без дублирования).
- `imgAttrs` объединяется с перенаправленными img-атрибутами (`alt`, `sizes`, `loading`, `width`, `height`, `decoding`, `fetchpriority`): значения из `imgAttrs` имеют приоритет. Сам ключ `imgAttrs` в `<picture>` не попадает.
- Если ассетов нет — возвращается пустая строка.

Пример:

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

Возвращает **строку** — URL основного варианта ассета. Эквивалент `GetAsset(...).Paths[0].Path`.

### AdminGenerate

```go
func (i *Imager) AdminGenerate(target any, wait bool) bool
```

`POST {AdminURL}/admin/assets/generate`, заголовок `Authorization: Bearer <token>`. Возвращает `true` при HTTP 200/202, иначе `false`.

### AdminDelete

```go
func (i *Imager) AdminDelete(target any, wait bool) bool
```

`DELETE {AdminURL}/admin/assets/delete` — то же тело и заголовок. Возвращает `true` при HTTP 200, иначе `false`.

### Маппинг типов входа `target`

| Тип входа `target` | Режим | Тело запроса |
|---|---|---|
| `string` | A (source) | `{"source": "<строка как есть>", "wait": ...}` |
| `AssetType` | B (assets) | `{"assets": [paths[].path из AssetType], "wait": ...}` |
| `[]AssetType` | B (assets) | `{"assets": [paths[].path из ВСЕХ AssetType, подряд], "wait": ...}` |
| `[]string` | B (assets) | `{"assets": ["<элемент 1>", "<элемент 2>", ...], "wait": ...}` |

- `string` — режим A: путь к исходнику передаётся в `source` как есть.
- `AssetType` / `[]AssetType` — режим B: собираются все `paths[].path` в один список `assets`.
- `[]string` — режим B: элементы — **уже готовые пути** к ассетам, передаются в `assets` **как есть**, без валидации и без преобразований.

Если `Token` или `AdminURL` пусты — админ-методы возвращают `false` **без** HTTP-запроса. HTTP-клиент — `net/http` (стандартная библиотека).

## Segment

`segment` — строка как есть (`"preset"`, `"200x200"`, `"200x"`, `"x200"`, `"x"`), структура `Size{Width, Height}` (оба необязательны), массив `[width, height]` (оба обязательны) или не задан → `"x"`.

| Вход | Результат |
|---|---|
| `"preset"` | `"preset"` |
| `Size{Width: 200, Height: 200}` | `"200x200"` |
| `Size{Width: 200}` | `"200x"` |
| `Size{Height: 200}` | `"x200"` |
| `Size{}` / `Size{Width: 0, Height: 0}` | `"x"` |
| `[200, 200]` | `"200x200"` |
| `[0, 400]` | `"x400"` |

## dpr

- `dpr`/`dprs` — число или строка-цифра (`"2"`).
- Итог < 1 → не используется (один path-объект без суффикса и без поля `Dpr`).
- Итог = 1 (задан явно) → один path-объект без поля `Dpr` (1x — дефолтный дескриптор; `Dpr: 1` добавляется только если в группе есть путь с `Dpr > 1`).
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

Пример результата `GetAsset("/test.gif", imager.Size{Width: 200, Height: 200}, "gif", 2)`:

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
- `dpr` — при dpr ≥ 2; `dpr: 1` — только если в группе есть путь с `dpr > 1` (иначе 1x — дефолтный дескриптор, без поля).
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

```go
// segment: четыре формы записи
i.GetAsset("/test.gif", nil)                       // не задан → "x", формат исходника
i.GetAsset("/test.gif", "thumb")                   // строка: именованный пресет
i.GetAsset("/test.gif", "200x200")                 // строка: размер
i.GetAsset("/test.gif", imager.Size{Width: 200})   // структура: только ширина → "200x"
i.GetAsset("/test.gif", imager.Size{Height: 400})  // структура: только высота → "x400"
i.GetAsset("/test.gif", [2]int{200, 200})          // массив [width, height] → "200x200"

// format: строка или список, dpr: число или строка
i.GetAsset("/test.gif", "200x200", "webp", nil)    // + формат
i.GetAsset("/test.gif", "200x200", "webp", 2)      // + dpr
i.GetAsset("/test.gif", "200x200", "webp", "2")    // dpr строкой
i.GetAssets("/test.gif", []any{"200x200", "x400"}, []any{"webp", "gif"}, 2)  // 2 ассета (по одному на формат)
```

## Примеры

```go
import imager "gitverse.ru/pkg-ru/imager-client/v2"

i := imager.New(imager.Options{
    BaseURL: "https://imgs.example.com/images/",
    Format:  "webp",
})

// Один ассет
asset := i.GetAsset("/test.gif", imager.Size{Width: 200, Height: 200}, "gif", 2)
// asset.Type  == "image/gif"
// asset.Paths == [AssetPath{Path: '.../200x200.gif', Width: 200, Height: 200},
//                 AssetPath{Path: '.../200x200@2.gif', Width: 400, Height: 400, Dpr: 2}]

// Список ассетов (по одному AssetType на формат)
assets := i.GetAssets("/test.gif", []any{imager.Size{Width: 200, Height: 200}, imager.Size{Height: 400}}, []string{"webp", "gif"}, 1)
// len(assets) == 2

// Только URL основного варианта
url := i.GetAssetPath("/test.gif", "200x200", "webp")
// url == "https://imgs.example.com/images/test-gif/200x200.webp"

// Админ-методы
admin := imager.New(imager.Options{Token: "secret", AdminURL: "https://imager.example.com"})
ok := admin.AdminGenerate("/test.gif", true)   // POST .../admin/assets/generate
ok = admin.AdminDelete(asset, false)           // DELETE .../admin/assets/delete
```

## Тесты

```bash
go run test/test.go
```

`test/test.go` — оркестратор: запускает Python/PHP/TS-раннеры, выполняет Go-кейсы и сравнивает результаты всех языков с [`test/fixture.json`](../test/fixture.json) (идентичность JSON-сериализации). Полный прогон — `make test`.

© 2025 [Алтухов Владислав Владимирович](https://altuh.ru/about)
