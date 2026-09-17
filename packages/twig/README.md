# Twig integration for Imager Client

Twig-расширение [`pkg-ru/imager-twig`](https://packagist.org/packages/pkg-ru/imager-twig) для микросервиса [Imager Service](https://gitverse.ru/pkg-ru/imager): функции `imager_assets` / `imager_asset` / `imager_assets_raw` для рендера `<picture>`/`<img>` с адаптивными `srcset` на основе ядра [Imager Client](https://gitverse.ru/pkg-ru/imager-client).

> [Packagist](https://packagist.org/packages/pkg-ru/imager-twig) · [Репозиторий](https://github.com/pkg-ru/imager-twig) · [Imager Service](https://gitverse.ru/pkg-ru/imager) · [Imager Client](https://gitverse.ru/pkg-ru/imager-client) · [Demo](https://altuh.ru/demo/imager)

## Overview

Пакет — тонкая обёртка над PHP-ядром [`pkg-ru/imager-client`](https://packagist.org/packages/pkg-ru/imager-client): вся логика (сегменты, dpr, форматы, `srcset`) находится в ядре, расширение нормализует алиасы аргументов и вызывает `GetAssetsHtml` / `GetAssetPath` / `GetAssets`.

## Installation

```bash
composer require pkg-ru/imager-twig
```

## Quick Start

```php
use imagerTwig\ImagerTwigExtension;

$twig = new \Twig\Environment($loader);
$twig->addExtension(new ImagerTwigExtension([
    'baseURL' => 'https://imgs.example.com/images/',
    'format'  => 'webp',
    'dpr'     => 2,
    'sort'    => true,
]));
```

```twig
{{ imager_assets('/test.png', {width: 200, height: 200, dpr: 2, format: 'webp', alt: 'Фото'})|raw }}
```

## Initialization

Конструктор `ImagerTwigExtension` принимает инстанс `Imager` или options-массив (расширение само создаёт `Imager` из них):

```php
use imagerClient\Imager;
use imagerTwig\ImagerTwigExtension;

// 1) Расширение само создаёт Imager из options
$twig->addExtension(new ImagerTwigExtension([
    'baseURL' => 'https://imgs.example.com/images/',
    'format'  => 'webp',
    'dpr'     => 2,
    'sort'    => true,
]));

// 2) Или передайте готовый Imager-инстанс
$twig->addExtension(new ImagerTwigExtension(new Imager([
    'baseURL' => 'https://imgs.example.com/images/',
])));
```

Опции передаются в ядро `Imager` без изменений. `sort: true` сортирует размерные сегменты в `imager_assets`/`imager_assets_raw` по `width`/`height` (по возрастанию; сегменты без `width` — в конец) **до** вычисления `dpr`, поэтому все коэффициенты ≥ 1. По умолчанию `false`.

## Functions

| Функция | Ядро | Возвращает |
|---|---|---|
| `imager_assets(source, args)` | `GetAssetsHtml` | HTML `<picture>`/`<img>` (строка) |
| `imager_asset(source, args)` | `GetAssetPath` | URL основного варианта (строка) |
| `imager_assets_raw(source, args)` | `GetAssets` | массив `AssetType` (для своего рендера) |

```twig
{# <picture> + <source> + <img> из GetAssetsHtml #}
{{ imager_assets('/test.png', {preset: 'thumb', format: 'webp', alt: 'Фото', class: 'thumb'})|raw }}
{{ imager_assets('/test.png', {width: 200, height: 200, dpr: 2, formats: ['webp', 'avif'], lazy: true})|raw }}

{# URL из GetAssetPath #}
{{ imager_asset('/test.png', {preset: 'thumb', format: 'webp'}) }}

{# массив AssetType из GetAssets — для своего рендера #}
{% for asset in imager_assets_raw('/test.png', {width: 200, height: 200}) %}
    <img src="{{ asset.path }}" alt="">
{% endfor %}
```

Вывод `imager_assets` через `|raw` — строка строится пакетом, escape выполняет ядро.

## Arguments

`args` — ассоциативный массив. Аргументы:

| Аргумент | Тип | Назначение |
|---|---|---|
| `source` / `src` | `string` | путь к исходнику; `src` — алиас `source` |
| `segment` | `string\|array` | канонический сегмент; приоритет: `segment` > `preset` > `width`/`height` |
| `preset` | `string` | алиас `segment` (именованный пресет) |
| `width` / `height` | `int` | алиас `segment` (размерный сегмент) |
| `formats` | `string\|string[]` | список форматов; `format` — алиас |
| `dprs` | `int\|string` | коэффициент(ы) плотности; `dpr` — алиас |

### Чёрный список RESERVED

В отличие от React/Vue (белый список), в Twig действует **чёрный список** `RESERVED`: все ключи `args`, не входящие в список ниже, считаются HTML-атрибутами и передаются в options ядра:

`source`, `src`, `segment`, `preset`, `width`, `height`, `format`, `formats`, `dpr`, `dprs`, `imager`

Распределение по элементам: `alt`, `sizes`, `loading`/`lazy` → `<img>`; `class`, `id`, `style` → `<picture>`.

```twig
{{ imager_assets('/test.png', {width: 200, height: 200, alt: 'Фото', class: 'thumb', lazy: true})|raw }}
```

## Responsive images

`imager_assets` вызывает `GetAssetsHtml` ядра: для каждого формата из `formats` и каждого коэффициента из `dprs` строится вариант URL, варианты группируются по MIME-типу, каждая группа становится `<source type="..." srcset="...">`, а группа основного формата — `<img>`. Если формат один — рендерится только `<img>` с `srcset`.

Формат `'auto'` (или пустая строка) означает формат исходника; если исходник не картинка (видео, нет расширения) — подставляется `jpg`. Список `formats` дедуплицируется: `jpeg` нормализуется к `jpg`, дубли удаляются (первое вхождение сохраняет позицию). Поддерживаемые форматы: `jpg, jpeg, png, webp, avif, heif, heic, apng, jxl, gif`.

```twig
{{ imager_assets('/test.jpg', {width: 100, height: 100, formats: ['webp', 'avif', 'jpg', 'webp', 'auto']})|raw }}
{# → webp, avif, jpg (дубли удалены, auto → jpg) #}
```

## Examples

Именованный пресет и одиночный URL:

```twig
{{ imager_asset('/test.png', {preset: 'thumb', format: 'webp'}) }}
```

Ленивая загрузка и `sizes`:

```twig
{{ imager_assets('/test.png', {width: 800, height: 600, formats: ['webp', 'avif'], loading: 'lazy', sizes: '(max-width: 600px) 100vw, 800px', alt: 'Фото'})|raw }}
```

## Testing

```bash
php test/test.php   # из packages/twig
```

## Related

- [Imager Service](https://gitverse.ru/pkg-ru/imager) — микросервис обработки изображений
- [Imager Client](https://gitverse.ru/pkg-ru/imager-client) — ядро (клиенты для TS/PHP/Python/Go)
- [Demo](https://altuh.ru/demo/imager) — демонстрация возможностей

## License

GPL-3.0

## Author

Алтухов Владислав Владимирович
https://altuh.ru/about
