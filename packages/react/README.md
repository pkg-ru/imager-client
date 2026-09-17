# React integration for Imager Client

React-компоненты [`@pkg-ru/imager-react`](https://www.npmjs.com/package/@pkg-ru/imager-react) для микросервиса [Imager Service](https://gitverse.ru/pkg-ru/imager): рендер `<picture>`/`<img>` с адаптивными `srcset` на основе ядра [Imager Client](https://gitverse.ru/pkg-ru/imager-client).

> [npm](https://www.npmjs.com/package/@pkg-ru/imager-react) · [Imager Service](https://gitverse.ru/pkg-ru/imager) · [Imager Client](https://gitverse.ru/pkg-ru/imager-client) · [Demo](https://altuh.ru/demo/imager)

## Overview

Пакет — тонкие обёртки над ядром `imager-client`: вся логика (сегменты, dpr, форматы, `srcset`, группировка `<picture>`) находится в ядре, компоненты нормализуют алиасы props и рендерят нативные React-узлы (`<picture>`, `<source>`, `<img>`) без `dangerouslySetInnerHTML`.

Пакет самодостаточен: ядро встроено в бандл, отдельная установка `imager-client` не требуется. Ядро также реэкспортируется из пакета: `Imager`, `ImagerOptions`, `AssetPath`, `AssetType`, `Segment`, `mimeFor`, `normalizeProps`, `buildSrcset`, `groupAssets`, `pickImgGroup`, `splitAttrs`, `useWidthDescriptors`, `IMG_ATTRS`, `HtmlGroup`, `fmtDescriptor`, `ImagerComponentProps`, `NormalizedCall`.

## Installation

```bash
npm install @pkg-ru/imager-react
```

`imager-client` нужен только если используется свой инстанс ядра (например, `ImagerServer` с админ-методами или другая версия ядра). В этом случае установите его отдельно и передайте инстанс в `ImagerProvider`:

```bash
npm install imager-client @pkg-ru/imager-react
```

## Quick Start

```tsx
// main.tsx — один раз при старте приложения
import { ImagerPlugin, ImagerAssets } from "@pkg-ru/imager-react";

ImagerPlugin.install({ baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2, sort: true });

// компонент
export function App() {
    return (
        <ImagerAssets src="/test.png" width={200} height={200} dpr={2} format="webp" alt="Фото" />
    );
}
```

## Initialization

### Через `ImagerPlugin` (глобально)

`ImagerPlugin.install(options)` создаёт глобальный инстанс `Imager`; после вызова компоненты работают без `ImagerProvider`. Можно передать и готовый инстанс: `ImagerPlugin.set(imager)`.

```tsx
import { ImagerPlugin } from "@pkg-ru/imager-react";

ImagerPlugin.install({ baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2, sort: true });
// или
ImagerPlugin.set(new Imager({ baseURL: "https://imgs.example.com/images/" }));
```

### Через `ImagerProvider` (локально)

`ImagerProvider` — React Context. Принимает `imager` (готовый инстанс) или `options` (инстанс создаётся один раз). Приоритет: `imager` > `options`. Провайдер приоритетнее глобального `ImagerPlugin.install`.

```tsx
import { ImagerProvider, ImagerAssets } from "@pkg-ru/imager-react";

export function App() {
    return (
        <ImagerProvider options={{ baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2, sort: true }}>
            <ImagerAssets src="/test.png" width={200} height={200} alt="Фото" />
        </ImagerProvider>
    );
}
```

### Через готовый инстанс

```tsx
import { Imager, ImagerProvider, ImagerAssets } from "@pkg-ru/imager-react";

const imager = new Imager({ baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2, sort: true });

export function App() {
    return (
        <ImagerProvider imager={imager}>
            <ImagerAssets src="/test.png" width={200} height={200} alt="Фото" />
        </ImagerProvider>
    );
}
```

Также каждый компонент принимает собственный prop `imager` — он приоритетнее контекста и глобального инстанса:

```tsx
<ImagerAssets imager={imager} src="/test.png" width={200} height={200} alt="Фото" />
```

## Components / Functions

| Экспорт | Назначение |
|---|---|
| `ImagerPlugin` | глобальная инициализация: `install(options)` / `set(imager)` |
| `ImagerProvider` | React Context с инстансом `Imager` (`imager` или `options`) |
| `useImager()` | хук: возвращает `Imager` из контекста или глобальный инстанс (`Imager \| null`) |
| `ImagerAssets` | `<picture>` + `<source>` + `<img>` из `GetAssets()`; при одном формате — только `<img>` |
| `ImagerAsset` | один `<img>` из `GetAsset()` |

Если инстанс не найден (нет провайдера, плагина и prop `imager`) или ядро вернуло пустой результат — компонент возвращает `null`.

## Props

Компоненты `ImagerAssets` и `ImagerAsset` принимают `ImagerComponentProps` (см. ядро) плюс `imager`:

| Prop | Тип | Назначение |
|---|---|---|
| `source` / `src` | `string` | путь к исходнику; `src` — алиас `source` |
| `segment` | `Segment` | канонический сегмент; приоритет: `segment` > `preset` > `width`/`height` |
| `preset` | `string` | алиас `segment` (именованный пресет) |
| `width` / `height` | `number \| string` | алиас `segment` (размерный сегмент) |
| `formats` | `string \| string[]` | список форматов; `format` — алиас |
| `dprs` | `number \| string` | коэффициент(ы) плотности; `dpr` — алиас |
| `imager` | `Imager` | инстанс ядра (приоритетнее контекста) |
| `imgAttrs` | `Record<string, unknown>` | атрибуты именно на `<img>` (приоритет над перенаправленными) |

### Белый список HTML-атрибутов

В options ядра (и далее в HTML) попадают **только** ключи из белого списка `HTML_ATTR_KEYS`:

`alt`, `sizes`, `loading`, `lazy`, `decoding`, `fetchpriority`, `imgAttrs`, `class`, `id`, `style`

Произвольные атрибуты (в том числе `data-*`) **не пробрасываются**. Распределение по элементам: `alt`, `sizes`, `loading`/`lazy`, `decoding`, `fetchpriority` → `<img>`; `class`, `id`, `style` → `<picture>`.

```tsx
<ImagerAssets
    src="/test.png"
    class="wrap"
    alt="Фото"
    imgAttrs={{ class: "img", decoding: "async", fetchpriority: "high", width: 333, height: 444 }}
/>
```

```html
<picture class="wrap">
    <source type="image/webp" srcset="...">
    <img src="..." srcset="..." alt="Фото" class="img" decoding="async" fetchpriority="high" width="333" height="444">
</picture>
```

## SSR / Prerender / Hydration

Плагин не является client-only: инстанс `Imager` нужен и на сервере (SSR/prerender формируют `<picture>` с `<source>` в HTML), и на клиенте (hydration). Компоненты рендерят нативные React-узлы, а ядро — чистые функции без DOM/`window`, поэтому один и тот же код даёт идентичный HTML на сервере и на клиенте; повторная гидрация картинок не требуется.

### Next.js (App Router)

```tsx
// app/layout.tsx — серверный рендер
import { ImagerPlugin, ImagerAssets } from "@pkg-ru/imager-react";

ImagerPlugin.install({ baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2 });

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ru">
            <body>
                <ImagerAssets src="/test.png" width={200} height={200} dpr={2} format="webp" alt="Фото" />
                {children}
            </body>
        </html>
    );
}
```

`ImagerPlugin.install` вызывается один раз при старте приложения: на сервере — в процессе SSR, на клиенте — при инициализации модуля. `ImagerProvider` с `options`/`imager` работает аналогично в обоих окружениях.

## Responsive images

`ImagerAssets` вызывает `GetAssets()` ядра: для каждого формата из `formats` и каждого коэффициента из `dprs` строится вариант URL, варианты группируются по MIME-типу (`groupAssets`), каждая группа становится `<source type="..." srcset="...">`, а группа основного формата — `<img>`. Дескрипторы `srcset` строятся по ширине или плотности в зависимости от `useWidthDescriptors(options)`. Если формат один — рендерится только `<img>` с `srcset`.

Формат `"auto"` (или пустая строка) означает формат исходника; если исходник не картинка (видео, нет расширения) — подставляется `jpg`. Список `formats` дедуплицируется: `jpeg` нормализуется к `jpg`, дубли удаляются (первое вхождение сохраняет позицию). Поддерживаемые форматы: `jpg, jpeg, png, webp, avif, heif, heic, apng, jxl, gif`.

```tsx
<ImagerAssets src="/test.jpg" width={100} height={100} formats={["webp", "avif", "jpg", "webp", "auto"]} />
{/* → webp, avif, jpg (дубли удалены, auto → jpg) */}
```

## Examples

Именованный пресет и одиночный `<img>`:

```tsx
import { ImagerAsset } from "@pkg-ru/imager-react";

<ImagerAsset source="/test.png" preset="thumb" format="webp" />
```

Ленивая загрузка и `sizes`:

```tsx
<ImagerAssets src="/test.png" width={800} height={600} formats={["webp", "avif"]} loading="lazy" sizes="(max-width: 600px) 100vw, 800px" alt="Фото" />
```

Хук `useImager` для прямого доступа к ядру:

```tsx
import { useImager } from "@pkg-ru/imager-react";

export function Thumb() {
    const imager = useImager();
    const path = imager?.GetAssetPath("/test.png", "thumb", "webp");
    return path ? <img src={path} alt="" /> : null;
}
```

## Testing

```bash
npm test   # из packages/react
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
