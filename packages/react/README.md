# @pkg-ru/imager-react

React-компоненты для микросервиса [Imager](https://gitverse.ru/pkg-ru/imager).

> **Пакет:** [npm](https://www.npmjs.com/package/@pkg-ru/imager-react) · **Репозиторий:** [GitVerse](https://gitverse.ru/pkg-ru/imager-client) / [GitHub](https://github.com/pkg-ru/imager-client)

Тонкие обёртки над ядром [`imager-client`](https://www.npmjs.com/package/imager-client): вся логика
(сегменты, dpr, форматы, srcset, группировка `<picture>`) — в ядре, компоненты нормализуют
алиасы props и рендерят нативные React-узлы.

Пакет **самодостаточен**: ядро встроено в бандл, отдельная установка `imager-client` не требуется.



## Установка

```bash
npm install @pkg-ru/imager-react
```

> `imager-client` — **опциональный** peerDependency. Он нужен только если в коде
> используется свой инстанс ядра (например, `ImagerServer` с админ-методами или другая версия ядра).
> В этом случае установите его отдельно и передайте инстанс в `ImagerProvider`:

> ```bash
> npm install imager-client @pkg-ru/imager-react
> ```

## Инициализация по умолчанию

### Через `ImagerPlugin.install`

Глобальная инициализация: после вызова компоненты работают **без** `ImagerProvider`:

```tsx
import { ImagerPlugin, ImagerAssets, ImagerAsset } from "@pkg-ru/imager-react";

// main.tsx — один раз при старте приложения
ImagerPlugin.install({ baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2 });

export function App() {
    return (
        <>
            <ImagerAssets src="/test.png" width={200} height={200} dpr={2} format="webp" alt="Фото" />
            <ImagerAsset source="/test.png" preset="thumb" format="webp" />
        </>
    );
}
```

Можно передать и готовый инстанс: `ImagerPlugin.set(imager)`.



### Через `ImagerProvider` (локально)

`ImagerProvider` принимает `options` и создаёт `Imager` из них один раз:

```tsx
import { ImagerProvider, ImagerAssets, ImagerAsset } from "@pkg-ru/imager-react";

export function App() {
    return (
        <ImagerProvider options={{ baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2 }}>
            <ImagerAssets src="/test.png" width={200} height={200} dpr={2} format="webp" alt="Фото" />
            <ImagerAsset source="/test.png" preset="thumb" format="webp" />
        </ImagerProvider>
    );
}
```

### Через готовый инстанс

```tsx
import { Imager } from "@pkg-ru/imager-react";   // или из "imager-client"
import { ImagerProvider, ImagerAssets, ImagerAsset } from "@pkg-ru/imager-react";

const imager = new Imager({ baseURL: "https://imgs.example.com/images/", format: "webp", dpr: 2 });

export function App() {
    return (
        <ImagerProvider imager={imager}>
            <ImagerAssets src="/test.png" width={200} height={200} dpr={2} format="webp" alt="Фото" />
            <ImagerAsset source="/test.png" preset="thumb" format="webp" />
        </ImagerProvider>
    );
}
```

Приоритет: `imager` > `options`. Если заданы оба — используется `imager`.
`ImagerProvider` (контекст) приоритетнее глобального `ImagerPlugin.install`.



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
| `width`/`height` | `segment` | `<ImagerAssets width={200} height={200} />` |
| `format` | `formats` | `<ImagerAssets format="webp" />` |
| `dpr` | `dprs` | `<ImagerAssets dpr={2} />` |

Приоритет сегмента: `segment` > `preset` > `width`/`height`.

## Компоненты

- `ImagerPlugin` — глобальная инициализация (`install(options)` / `set(imager)`);
- `ImagerProvider` — React Context с `Imager`-инстансом (`imager` или `options`);
- `ImagerAssets` — `<picture>` + `<source>` + `<img>` из `GetAssets()`;
- `ImagerAsset` — один `<img>` из `GetAsset()`.



HTML-атрибуты: `alt`, `sizes`, `loading`/`lazy` → `<img>`; `class`, `id`, `style` → `<picture>`.



## Тесты

```bash
npm test   # из packages/react
