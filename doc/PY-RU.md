# Imager Client — Python

Клиент микросервиса **Imager** на Python: построение путей/URL ассетов и админ-методы.

- [English version](https://gitverse.ru/pkg-ru/imager-client/blob/master/doc/PY-EN.md)
- [Обзор](https://gitverse.ru/pkg-ru/imager-client/blob/master/README.md)

---

## Установка

Пакет `imager_client` (Python ≥ 3.10, без внешних зависимостей):

```bash
pip install imager_client
```

Или из репозитория:

```bash
pip install git+https://gitverse.ru/pkg-ru/imager-client
```

## Импорт

```python
from imager import Imager
from imager import AssetType, AssetPath, ImagerOptions, ImagerServerOptions, Segment
```

## Инициализация

```python
imager = Imager(options: ImagerOptions | dict | None = None)
```

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `token` | `str` | `""` | токен админ-методов (только `AdminGenerate`/`AdminDelete`) |
| `dpr` | `int` | `0` | итоговое dpr по умолчанию; 0-1 — не используется, 2-3 — используется |
| `format` | `str` | `""` | формат генерации по умолчанию (пусто — формат исходника) |
| `formats` | `list[str]` | `[]` | список форматов по умолчанию; если пуст — используется `format` |
| `baseURL` | `str` | `"/"` | база URL ассетов; нормализуется (всегда с завершающим `/`) |
| `adminURL` | `str` | `""` | базовый URL админ-API (без завершающего `/`) |

Нормализация `baseURL`: пустой/не задан → `"/"`; без завершающего `/` → добавляется. `adminURL`: завершающий `/` удаляется.

```python
imager = Imager({
    "baseURL": "https://imgs.example.com/images",
    "format": "webp",
    "dpr": 2,
    "token": "secret",
    "adminURL": "https://imager.example.com",
})
```

## Методы

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

Возвращает **один** `AssetType`. `paths` содержит все варианты dpr от 1 до итогового.

| Параметр | Тип | Описание |
|---|---|---|
| `source` | `str` | путь к исходнику (`/test.gif`, `test.gif`, `thumbs/photo.jpg`) |
| `segment` | `str` \| `{width,height}` \| `[w,h]` \| `None` | сегмент; не задан → `"x"` |
| `format` | `str` \| `None` | итоговый формат; не задан → настройки `format` → формат исходника |
| `dpr` | `int` \| `str` \| `None` | итоговое dpr; не задан → настройки `dpr`; < 1 → не используется |

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

Возвращает **список** `AssetType` — декартово произведение `segments × formats` (внешний цикл — segments). `segments` не задан → `["x"]`. `formats` не задан → настройки `formats` → `[format]` → `[формат исходника]`.

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

Возвращает **строку** — URL основного варианта ассета. Эквивалент `GetAsset(...).paths[0].path`.

### AdminGenerate

```python
def AdminGenerate(
    self,
    target: str | AssetType | list[AssetType] | list[str],
    wait: bool = False,
) -> bool: ...
```

`POST {adminURL}/admin/assets/generate`, заголовок `Authorization: Bearer <token>`. Возвращает `True` при HTTP 200/202, иначе `False`.

### AdminDelete

```python
def AdminDelete(
    self,
    target: str | AssetType | list[AssetType] | list[str],
    wait: bool = False,
) -> bool: ...
```

`DELETE {adminURL}/admin/assets/delete` — то же тело и заголовок. Возвращает `True` при HTTP 200, иначе `False`.

### Маппинг типов входа `target`

| Тип входа `target` | Режим | Тело запроса |
|---|---|---|
| `str` | A (source) | `{"source": "<строка как есть>", "wait": ...}` |
| `AssetType` | B (assets) | `{"assets": [paths[].path из AssetType], "wait": ...}` |
| `list[AssetType]` | B (assets) | `{"assets": [paths[].path из ВСЕХ AssetType, подряд], "wait": ...}` |
| `list[str]` | B (assets) | `{"assets": ["<элемент 1>", "<элемент 2>", ...], "wait": ...}` |

- `str` — режим A: путь к исходнику передаётся в `source` как есть.
- `AssetType` / `list[AssetType]` — режим B: собираются все `paths[].path` в один список `assets`.
- `list[str]` — режим B: элементы — **уже готовые пути** к ассетам, передаются в `assets` **как есть**, без валидации и без преобразований.

Если `token` или `adminURL` пусты — админ-методы возвращают `False` **без** HTTP-запроса. HTTP-клиент — `urllib.request` (стандартная библиотека).

## Segment

`segment` — строка как есть (`"preset"`, `"200x200"`, `"200x"`, `"x200"`, `"x"`), словарь `{width, height}` (оба необязательны), список/кортеж `[width, height]` (оба обязательны) или не задан → `"x"`.

| Вход | Результат |
|---|---|
| `"preset"` | `"preset"` |
| `{"width": 200, "height": 200}` | `"200x200"` |
| `{"width": 200}` | `"200x"` |
| `{"height": 200}` | `"x200"` |
| `{}` / `{"width": 0, "height": 0}` | `"x"` |
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

```python
class AssetPath(TypedDict, total=False):
    path: str
    dpr: int
    width: int
    height: int

class AssetType(TypedDict):
    type: str
    paths: list[AssetPath]
    source_format: bool  # только при true
    all_support: bool    # только при true
```

Пример результата `GetAsset("/test.gif", {"width": 200, "height": 200}, "gif", 2)`:

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

```python
# segment: четыре формы записи
imager.GetAsset("/test.gif")                     # не задан → "x", формат исходника
imager.GetAsset("/test.gif", "thumb")            # строка: именованный пресет
imager.GetAsset("/test.gif", "200x200")          # строка: размер
imager.GetAsset("/test.gif", {"width": 200})     # dict: только ширина → "200x"
imager.GetAsset("/test.gif", {"height": 400})    # dict: только высота → "x400"
imager.GetAsset("/test.gif", (200, 200))         # кортеж → "200x200"

# format: строка или список, dpr: число или строка
imager.GetAsset("/test.gif", "200x200", "webp")          # + формат
imager.GetAsset("/test.gif", "200x200", "webp", 2)       # + dpr
imager.GetAsset("/test.gif", "200x200", "webp", "2")     # dpr строкой
imager.GetAssets("/test.gif", ["200x200", "x400"], ["webp", "gif"], 2)  # 4 ассета
```

## Примеры

```python
from imager import Imager

imager = Imager({"baseURL": "https://imgs.example.com/images/", "format": "webp"})

# Один ассет
asset = imager.GetAsset("/test.gif", {"width": 200, "height": 200}, "gif", 2)
print(asset["type"])   # image/gif
print(asset["paths"])  # [{'path': '.../200x200.gif', 'width': 200, 'height': 200},
                       #  {'path': '.../200x200@2.gif', 'width': 400, 'height': 400, 'dpr': 2}]

# Список ассетов (декартово произведение)
assets = imager.GetAssets("/test.gif", [{"width": 200, "height": 200}, {"height": 400}], ["webp", "gif"], 1)
print(len(assets))  # 4

# Только URL основного варианта
url = imager.GetAssetPath("/test.gif", "200x200", "webp")
print(url)  # https://imgs.example.com/images/test-gif/200x200.webp

# Админ-методы
admin = Imager({"token": "secret", "adminURL": "https://imager.example.com"})
ok = admin.AdminGenerate("/test.gif", wait=True)   # POST .../admin/assets/generate
ok = admin.AdminDelete(asset, wait=False)          # DELETE .../admin/assets/delete
```

## Тесты

```bash
python test/test.py
```

Раннер читает [`test/fixture.json`](https://gitverse.ru/pkg-ru/imager-client/blob/master/test/fixture.json) и выполняет golden-кейсы. Полный прогон всех языков — `make test` (оркестратор — `go run test/test.go`).

© 2025 [Алтухов Владислав Владимирович](https://altuh.ru/about)
