# imager-twig

Twig-расширение для микросервиса [Imager](https://gitverse.ru/pkg-ru/imager).

Тонкая обёртка над ядром [`pkg-ru/imager-client`](../../README.md): вся логика
(сегменты, dpr, форматы, srcset) — в ядре, расширение нормализует алиасы
аргументов и вызывает `GetAssetsHtml` / `GetAssetPath`.

## Установка

```bash
composer require pkg-ru/imager-client imager-twig
```

## Инициализация

```php
use imagerTwig\ImagerTwigExtension;
use pkgru\imager\Imager;

$twig = new \Twig\Environment($loader);

// 1) Расширение само создаёт Imager из options
$twig->addExtension(new ImagerTwigExtension([
    'baseURL' => 'https://imgs.example.com/images/',
    'format'  => 'webp',
    'dpr'     => 2,
]));

// 2) Или передайте готовый Imager-инстанс
$twig->addExtension(new ImagerTwigExtension(new Imager([
    'baseURL' => 'https://imgs.example.com/images/',
])));
```

## Функции

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

## Алиасы аргументов

| Алиас | Канонический | Пример |
|---|---|---|
| `src` | `source` | `imager_assets('/a.png')` |
| `preset` | `segment` | `{preset: 'thumb'}` |
| `width`/`height` | `segment` | `{width: 200, height: 200}` |
| `format` | `formats` | `{format: 'webp'}` |
| `dpr` | `dprs` | `{dpr: 2}` |

Приоритет сегмента: `segment` > `preset` > `width`/`height`.

HTML-атрибуты: `alt`, `sizes`, `loading`/`lazy` → `<img>`; `class`, `id`, `style` → `<picture>`.
Вывод через `|raw` — строка строится пакетом, escape выполняет ядро.

## Тесты

```bash
php test/test.php   # из packages/twig
