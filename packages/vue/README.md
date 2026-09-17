# Vue integration for Imager Client

Vue 3-компоненты [`@pkg-ru/imager-vue`](https://www.npmjs.com/package/@pkg-ru/imager-vue) для микросервиса [Imager Service](https://gitverse.ru/pkg-ru/imager): рендер `<picture>`/`<img>` с адаптивными `srcset` на основе ядра [Imager Client](https://gitverse.ru/pkg-ru/imager-client).

> [npm](https://www.npmjs.com/package/@pkg-ru/imager-vue) · [Imager Service](https://gitverse.ru/pkg-ru/imager) · [Imager Client](https://gitverse.ru/pkg-ru/imager-client) · [Demo](https://altuh.ru/demo/imager)

## Overview

Пакет — тонкие обёртки над ядром `imager-client`: вся логика (сегменты, dpr, форматы, `srcset`) находится в ядре, компоненты нормализуют алиасы props и рендерят нативные Vue-ноды через `h()`.

Пакет самодостаточен: ядро встроено в бандл, отдельная установка `imager-client` не требуется. Ядро также реэкспортируется из пакета: `Imager`, `ImagerOptions`, `AssetPath`, `AssetType`, `Segment`, `mimeFor`, `normalizeProps`, `buildSrcset`, `groupAssets`, `pickImgGroup`, `splitAttrs`, `useWidthDescriptors`, `IMG_ATTRS`, `HtmlGroup`, `fmtDescriptor`, `ImagerComponentProps`, `NormalizedCall`.

## Installation

```bash
npm install @pkg-ru/imager-vue
```

`imager-client` нужен только если используется свой инстанс ядра (например, `ImagerServer` с админ-методами или другая версия ядра). В этом случае установите его отдельно и передайте инстанс в `ImagerProvider`:

```bash
npm install imager-client @pkg-ru/imager-vue
```

## Quick Start

```ts
// main.ts
import { createApp } from "vue";
import { ImagerPlugin } from "@pkg-ru/imager-vue";
import App from "./App.vue";

createApp(App)
    .use(ImagerPlugin, { baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2, sort: true })
    .mount("#app");
```

```vue
<!-- App.vue -->
<template>
    <ImagerAssets src="/test.png" width="200" height="200" dpr="2" format="webp" alt="Фото" />
</template>
```

## Initialization

### Через `ImagerPlugin` (глобально, `app.use()`)

`ImagerPlugin.install(app, options)` создаёт `Imager` из options и регистрирует его через `app.provide` (ключ — `imagerKey`). После этого компоненты работают без `ImagerProvider`.

```ts
// main.ts
createApp(App)
    .use(ImagerPlugin, { baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2, sort: true })
    .mount("#app");
```

### Через `ImagerProvider` (локально)

`ImagerProvider` — компонент-провайдер. Принимает **только** prop `imager` (готовый инстанс, обязательный). Передать options нельзя — в отличие от React-версии, инстанс нужно создать самостоятельно. Провайдер приоритетнее глобального `ImagerPlugin`.

```vue
<script setup lang="ts">
import { Imager, ImagerProvider, ImagerAssets } from "@pkg-ru/imager-vue";

const imager = new Imager({ baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2, sort: true });
</script>

<template>
    <ImagerProvider :imager="imager">
        <ImagerAssets src="/test.png" width="200" height="200" alt="Фото" />
    </ImagerProvider>
</template>
```

### Напрямую через `imagerKey` / `useInjectImager`

`imagerKey` — `InjectionKey<Imager>` для `provide`/`inject`; `useInjectImager()` возвращает инстанс из контекста или `null`.

```ts
import { imagerKey, useInjectImager } from "@pkg-ru/imager-vue";

// provide вручную (альтернатива ImagerPlugin)
app.provide(imagerKey, new Imager({ baseURL: "https://imgs.example.com/images/" }));

// inject в composable
const imager = useInjectImager();
```

Также каждый компонент принимает собственный prop `imager` — он приоритетнее контекста:

```vue
<ImagerAssets :imager="imager" src="/test.png" width="200" height="200" alt="Фото" />
```

## Components / Functions

| Экспорт | Назначение |
|---|---|
| `ImagerPlugin` | `app.use(ImagerPlugin, options)`: создаёт `Imager` и `provide` его |
| `imagerKey` | `InjectionKey<Imager>` для `provide`/`inject` |
| `useInjectImager()` | composable: возвращает `Imager` из контекста или `null` |
| `ImagerProvider` | компонент-провайдер, prop `imager` (обязательный) |
| `ImagerAssets` | `<picture>` + `<source>` + `<img>` из `GetAssets()`; при одном формате — только `<img>` |
| `ImagerAsset` | один `<img>` из `GetAsset()` |

Если инстанс не найден (нет провайдера/плагина и prop `imager`) или ядро вернуло пустой результат — компонент возвращает `null`.

## Props

Компоненты `ImagerAssets` и `ImagerAsset` принимают `ImagerComponentProps` (см. ядро) плюс `imager`:

| Prop | Тип | Назначение |
|---|---|---|
| `source` / `src` | `string` | путь к исходнику; `src` — алиас `source` |
| `segment` | `Segment` | канонический сегмент; приоритет: `segment` > `preset` > `width`/`height` |
| `preset` | `string` | алиас `segment` (именованный пресет) |
| `width` / `height` | `number \| string` | алиас `segment` (размерный сегмент) |
| `formats` | `string \| string[]` | список форматов; принимает и строку с запятыми: `formats="webp, avif"`; `format` — алиас |
| `dprs` | `number \| string` | коэффициент(ы) плотности; `dpr` — алиас |
| `imager` | `Imager` | инстанс ядра (приоритетнее контекста) |
| `imgAttrs` | `Record<string, unknown>` | атрибуты именно на `<img>` (приоритет над перенаправленными) |

### Белый список HTML-атрибутов

В options ядра (и далее в HTML) попадают **только** ключи из белого списка `HTML_ATTR_KEYS`:

`alt`, `sizes`, `loading`, `lazy`, `decoding`, `fetchpriority`, `imgAttrs`, `class`, `id`, `style`

Произвольные атрибуты (в том числе `data-*`) **не пробрасываются**. Распределение по элементам: `alt`, `sizes`, `loading`/`lazy`, `decoding`, `fetchpriority` → `<img>`; `class`, `id`, `style` → `<picture>`.

```vue
<ImagerAssets
    src="/test.png"
    class="wrap"
    alt="Фото"
    :img-attrs="{ class: 'img', decoding: 'async', fetchpriority: 'high', width: 333, height: 444 }"
/>
```

```html
<picture class="wrap">
    <source type="image/webp" srcset="...">
    <img src="..." srcset="..." alt="Фото" class="img" decoding="async" fetchpriority="high" width="333" height="444">
</picture>
```

## SSR / Prerender / Hydration

Плагин не является client-only: инстанс `Imager` нужен и на сервере (SSR/prerender формируют `<picture>` с `<source>` в HTML), и на клиенте (hydration). Компоненты рендерят нативные Vue-ноды (`h()`), а ядро — чистые функции без DOM/`window`, поэтому один и тот же код даёт идентичный HTML на сервере и на клиенте; повторная гидрация картинок не требуется.

### Nuxt 3

```ts
// plugins/imager.ts — выполняется и на сервере (SSR), и на клиенте (hydration)
import { ImagerPlugin } from "@pkg-ru/imager-vue";

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.hook("app:beforeMount", () => {
        ImagerPlugin.install(nuxtApp.vueApp, {
            baseURL: "https://imgs.example.com/images/",
            format: "webp",
            dpr: 2,
            sort: true,
        });
    });
});
```

```vue
<!-- app.vue -->
<template>
    <ImagerAssets src="/test.png" width="200" height="200" dpr="2" format="webp" alt="Фото" />
</template>
```

`ImagerPlugin.install` регистрируется один раз: на сервере он выполняется в процессе SSR, на клиенте — при инициализации приложения. `ImagerProvider` с `:imager` работает аналогично в обоих окружениях.

## Responsive images

`ImagerAssets` вызывает `GetAssets()` ядра: для каждого формата из `formats` и каждого коэффициента из `dprs` строится вариант URL, варианты группируются по MIME-типу (`groupAssets`), каждая группа становится `<source type="..." srcset="...">`, а группа основного формата — `<img>`. Дескрипторы `srcset` строятся по ширине или плотности в зависимости от `useWidthDescriptors(options)`. Если формат один — рендерится только `<img>` с `srcset`.

Формат `"auto"` (или пустая строка) означает формат исходника; если исходник не картинка (видео, нет расширения) — подставляется `jpg`. Список `formats` дедуплицируется: `jpeg` нормализуется к `jpg`, дубли удаляются (первое вхождение сохраняет позицию). Поддерживаемые форматы: `jpg, jpeg, png, webp, avif, heif, heic, apng, jxl, gif`.

```vue
<ImagerAssets src="/test.jpg" width="100" height="100" formats="webp, avif, jpg, webp, auto" />
<!-- → webp, avif, jpg (дубли удалены, auto → jpg) -->
```

## Examples

Именованный пресет и одиночный `<img>`:

```vue
<ImagerAsset source="/test.png" preset="thumb" format="webp" />
```

Ленивая загрузка и `sizes`:

```vue
<ImagerAssets src="/test.png" width="800" height="600" :formats="['webp', 'avif']" loading="lazy" sizes="(max-width: 600px) 100vw, 800px" alt="Фото" />
```

Composable `useInjectImager` для прямого доступа к ядру:

```vue
<script setup lang="ts">
import { useInjectImager } from "@pkg-ru/imager-vue";

const imager = useInjectImager();
const path = imager?.GetAssetPath("/test.png", "thumb", "webp");
</script>

<template>
    <img v-if="path" :src="path" alt="" />
</template>
```

## Testing

```bash
npm test   # из packages/vue
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
