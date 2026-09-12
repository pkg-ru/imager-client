# @pkg-ru/imager-vue

Vue 3-компоненты для микросервиса [Imager](https://gitverse.ru/pkg-ru/imager).

> **Пакет:** [npm](https://www.npmjs.com/package/@pkg-ru/imager-vue) · **Репозиторий:** [GitVerse](https://gitverse.ru/pkg-ru/imager-client) / [GitHub](https://github.com/pkg-ru/imager-client)

Тонкие обёртки над ядром [`imager-client`](https://www.npmjs.com/package/imager-client): вся логика
(сегменты, dpr, форматы, srcset) — в ядре, компоненты нормализуют алиасы
props и рендерят нативные vnode.

Пакет **самодостаточен**: ядро встроено в бандл, отдельная установка `imager-client` не требуется.



## Установка

```bash
npm install @pkg-ru/imager-vue
```

> `imager-client` — **опциональный** peerDependency. Он нужен только если в коде
> используется свой инстанс ядра (например, `ImagerServer` с админ-методами или другая версия ядра).
> В этом случае установите его отдельно и передайте инстанс в `ImagerProvider`:

> ```bash
> npm install imager-client @pkg-ru/imager-vue
> ```

## Инициализация по умолчанию

### Через `ImagerPlugin` (глобально, `app.use()``

```ts
// main.ts
import { createApp } from "vue";
import { ImagerPlugin } from "@pkg-ru/imager-vue";

createApp(App)
    .use(ImagerPlugin, { baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2 })
    .mount("#app");
```

После этого компоненты работают **без** `ImagerProvider`:

```vue
<template>
    <ImagerAssets src="/test.png" width="200" height="200" dpr="2" format="webp" alt="Фото" />
    <ImagerAsset source="/test.png" preset="thumb" format="webp" />
</template>
```



### Через компонент-провайдер

```vue
<script setup lang="ts">
import { Imager } from "@pkg-ru/imager-vue";   // или из "imager-client"
import { ImagerProvider, ImagerAssets, ImagerAsset } from "@pkg-ru/imager-vue";

const imager = new Imager({ baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2 });
</script>

<template>
    <ImagerProvider :imager="imager">
        <ImagerAssets src="/test.png" width="200" height="200" dpr="2" format="webp" alt="Фото" />
        <ImagerAsset source="/test.png" preset="thumb" format="webp" />
    </ImagerProvider>
</template>
```

`ImagerProvider` (контекст) приоритетнее глобального `ImagerPlugin`.



## SSR / prerender + hydration

Плагин **не является `.client`-only**: инстанс `Imager` нужен и на сервере
(SSR/prerender формируют `<picture>` с `<source>` в HTML), и на клиенте
(ts/vue/react — hydration). Компоненты рендерят **нативные Vue-ноды** (`h()`),
а ядро — чистые функции без DOM/`window`, поэтому один и тот же код даёт
**идентичный HTML** на сервере и на клиенте.

### Nuxt 3

```ts
// nuxt.config.ts
export default defineNuxtConfig({
    modules: ["@pkg-ru/imager-vue/nuxt"], // или свой модуль с ImagerPlugin
});
```

Либо инициализация вручную в `app.vue` / `nuxt.config.ts`:

```ts
// plugins/imager.ts — выполняется и на сервере (SSR), и на клиенте (hydration)
import { ImagerPlugin } from "@pkg-ru/imager-vue";

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.hook("app:beforeMount", () => {
        ImagerPlugin.install(nuxtApp.vueApp, {
            baseURL: "https://imgs.example.com/images/",
            format: "webp",
            dpr: 2,
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

`ImagerPlugin.install` регистрируется один раз: на сервере он выполняется в
процессе SSR, на клиенте — при инициализации приложения. `ImagerProvider`
с `:imager`/`options` работает аналогично в обоих окружениях.



## Re-export ядра

Пакет re-export'ит ядро: `Imager`, `ImagerOptions`, `AssetPath`, `AssetType`, `Segment`,
`mimeFor`, `normalizeProps`, `buildSrcset`, `groupAssets`, `pickImgGroup`, `splitAttrs`,
`useWidthDescriptors`, `IMG_ATTRS`, `HtmlGroup` и др. — можно импортировать из пакета,
не подключая `imager-client` отдельно.



## Алиасы props

| Алиас | Канонический | Пример |
|---|---|---|
| `src` | `source` | `<ImagerAssets src="/a.png" />` |
| `preset` | `segment` | `<ImagerAssets preset="thumb" />` |
| `width`/`height` | `segment` | `<ImagerAssets width="200" height="200" />` |
| `format` | `formats` | `<ImagerAssets format="webp" />` |
| `dpr` | `dprs` | `<ImagerAssets dpr="2" />` |

Приоритет сегмента: `segment` > `preset` > `width`/`height`.

`formats` принимает и строку с запятыми: `formats="webp, avif"`.

## Компоненты

- `ImagerPlugin` — `app.use()`: создаёт `Imager` из options и `provide` его;
- `ImagerProvider` — компонент-провайдер с `:imager`-пропом;
- `ImagerAssets` — `<picture>` + `<source>` + `<img>` из `GetAssets()`;
- `ImagerAsset` — один `<img>` из `GetAsset()`.



HTML-атрибуты: `alt`, `sizes`, `loading`/`lazy`, `decoding`, `fetchpriority` → `<img>`;
`class`, `id`, `style` → `<picture>`.

`imgAttrs` — объект атрибутов, попадающих **именно на `<img>`** (приоритет над
перенаправленными атрибутами):

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



## Тесты

```bash
npm test   # из packages/vue
