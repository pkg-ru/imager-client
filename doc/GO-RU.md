# Imager Client — Go

Клиент микросервиса **Imager** на Go: построение путей/URL ассетов и админ-методы.

- [English version](./GO-EN.md)
- [Обзор](../README.md)

---

## Установка

Модуль `gitverse.ru/pkg-ru/imager-client/v2` (go 1.23.7+, package `imager`, без внешних зависимостей):

```bash
go get gitverse.ru/pkg-ru/imager-client/v2
```

Импорт:

```go
import imager "gitverse.ru/pkg-ru/imager-client/v2/src/imager-go"
```

## Инициализация

```go
i := imager.New(options ...imager.Options) *Imager
```

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `Token` | `string` | `""` | токен админ-методов (только `AdminGenerate`/`AdminDelete`) |
| `Dpr` | `int` | `0` | итоговое dpr по умолчанию; 0-1 — не используется, 2-3 — используется |
| `Format` | `string` | `""` | формат генерации по умолчанию (пусто — формат исходника) |
| `Formats` | `[]string` | `[]` | список форматов по умолчанию; если пуст — используется `Format` |
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
| `format` | `string` | итоговый формат; пусто → настройки `Format` → формат исходника |
| `dpr` | `any` | `int` \| `string`; не задан → настройки `Dpr`; < 1 → не используется |

### GetAssets

```go
func (i *Imager) GetAssets(source string, segments any, formats any, dprs any) []AssetType
```

Возвращает **список** `AssetType` — декартово произведение `segments × formats` (внешний цикл — segments). `segments` не задан → `["x"]`. `formats` не задан → настройки `Formats` → `[Format]` → `[формат исходника]`.

### GetAssetsHtml

```go
func (i *Imager) GetAssetsHtml(source string, segments any, formats any, dprs any, options map[string]any) string
```

Возвращает **строку** — HTML-разметку `<picture>`/`<img>` по тому же декартову произведению `segments × formats`, что и `GetAssets`. Один вызов генерирует ровно один тег `<picture>` (или `<img>`, если формат один).

`options` — HTML-атрибуты:

| Атрибут | Куда попадает | Примечание |
|---|---|---|
| `class`, `id`, `data-*`, прочие | `<picture>` | — |
| `alt`, `sizes`, `loading` | `<img>` | — |
| `lazy` | `<img>` | булев: превращается в `loading="lazy"` |
| `width`, `height` | `<img>` | перекрываются автоматическими значениями из базового path (для CLS) |

Правила:

- Атрибуты выводятся в алфавитном порядке имён (детерминированный вывод).
- Булевы атрибуты (`lazy: true`, `loading: true`) — без значения; `false`/`nil` — пропускаются.
- Значения HTML-экранируются (`&` → `&`, `<` → `<`, `>` → `>`, `"` → `"`, `'` → `&#x27;`).
- Внутри `<picture>` теги делятся по типу (формату): все пути одного формата объединяются в один `srcset`.
- Для `<img>` выбирается группа: 1) формат исходника (`SourceFormat: true`); 2) первый поддерживаемый всеми браузерами (`AllSupport: true`); 3) последняя. Остальные форматы — `<source type="...">`.
- `srcset`-дескрипторы: если в `options` передан `sizes` — `w`-дескрипторы по ширине (`200w`, `400w`); иначе — `x`-дескрипторы по dpr (`1x`, `2x`, `3x`); если dpr нет, но есть высота — dpr вычисляется из отношения высот (дробные допустимы, напр. `1.5x`); размеры автоматически не генерируются.
- `width`/`height` на `<img>` добавляются из базового (первого) path, если известны — для CLS.
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
- Итог = 1 (задан явно) → один path-объект с `Dpr: 1`.
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
i.GetAssets("/test.gif", []any{"200x200", "x400"}, []any{"webp", "gif"}, 2)  // 4 ассета
```

## Примеры

```go
import imager "gitverse.ru/pkg-ru/imager-client/v2/src/imager-go"

i := imager.New(imager.Options{
    BaseURL: "https://imgs.example.com/images/",
    Format:  "webp",
})

// Один ассет
asset := i.GetAsset("/test.gif", imager.Size{Width: 200, Height: 200}, "gif", 2)
// asset.Type  == "image/gif"
// asset.Paths == [AssetPath{Path: '.../200x200.gif', Width: 200, Height: 200},
//                 AssetPath{Path: '.../200x200@2.gif', Width: 400, Height: 400, Dpr: 2}]

// Список ассетов (декартово произведение)
assets := i.GetAssets("/test.gif", []any{imager.Size{Width: 200, Height: 200}, imager.Size{Height: 400}}, []string{"webp", "gif"}, 1)
// len(assets) == 4

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
