# План: фреймворк-компоненты imager (React, Vue 3, Twig)

## 1. Суть

Тонкие обёртки-компоненты над существующим ядром `imager-client`. Вся логика
(сегменты, dpr, форматы, srcset) остаётся в ядре; компоненты:

1. нормализуют алиасы props (`src`→`source`, `preset`→`segment`, `width`/`height`→сегмент);
2. получают готовый `Imager` из Provider/Plugin (значения по умолчанию);
3. вызывают `GetAssets(...)` и рендерят `<picture>/<source>/<img>` **нативными узлами**
   фреймворка (согласовано: React/Vue — нативный рендер; Twig — `GetAssetsHtml|raw`,
   т.к. Twig рендерит из строк).

## 2. Пакеты

| Пакет | Экосистема | Содержимое |
|---|---|---|
| `@pkg-ru/imager-react` | npm, peer: react ≥17 | `ImagerProvider`, `ImagerAssets`, `ImagerAsset` |
| `@pkg-ru/imager-vue` | npm, peer: vue ≥3.2 | `ImagerPlugin`, `ImagerProvider`, `ImagerAssets`, `ImagerAsset` |
| `pkg-ru/imager-twig` | composer, twig ≥3 | Twig-расширение: функции `imager_assets`, `imager_asset`, `imager_assets_raw` |

Каждый пакет — отдельный каталог в этом же репозитории (`packages/react`,
`packages/vue`, `packages/twig`) со своим манифестом; публикуются отдельно.
Зависимость от ядра: `imager-client` (npm) / `pkg-ru/imager-client` (composer).

## 3. Общее ядро нормализации props (новый код)

Чтобы React/Vue/Twig не дублировали маппинг алиасов, добавляем в TS-пакет
экспортируемую функцию (не ломает zero-dependency):

```ts
// src/imager-ts/component.ts
export interface ImagerComponentProps {
    // алиасы source
    source?: string; src?: string;
    // алиасы segment (взаимоисключимы, приоритет: segment > preset > width/height)
    segment?: Segment; preset?: string;
    width?: number | string; height?: number | string;
    // прочее
    format?: string; formats?: string | string[];
    dpr?: number | string; dprs?: number | string;
    // HTML-атрибуты (<img>/<picture>): alt, sizes, loading|lazy, class, id, ...
    [attr: string]: unknown;
}

/** Разворачивает алиасы и возвращает (source, segments, formats, dprs, options). */
export function normalizeProps(props: ImagerComponentProps): NormalizedCall;
```

Правила нормализации:
- `source ?? src` — если нет ни одного → ошибка разработки (в React — throw в dev, warn в prod);
- `width`/`height` — если заданы, собираются в `{width, height}` (отсутствующие → undefined);
- `format`→string, `formats`→list; `dpr`→dpr, `dprs`→dprs;
- остаток props (кроме зарезервированных: `source`, `src`, `segment`, `preset`,
  `width`, `height`, `format`, `formats`, `dpr`, `dprs`, `imager`) — HTML-атрибуты
  в `options` для рендера.

## 4. React-пакет

```tsx
// инициализация по умолчанию
const imager = new Imager({ baseURL: "...", format: "webp", dpr: 2 });

<ImagerProvider imager={imager}>
    <ImagerAssets src="/test.png" width={200} height={200} dpr={2} format="webp" alt="Фото" class="thumb" />
    <ImagerAssets source="/test.png" preset="thumb" formats={["webp", "avif"]} lazy sizes="(max-width:600px) 100vw, 50vw" />
</ImagerProvider>
```

- `ImagerProvider` — React Context c `Imager`-инстансом;
- `ImagerAssets` — рендер `<picture>` + `<source>`-ы + `<img>` из `GetAssets()`;
  если формат один → только `<img>`;
- `ImagerAsset` — упрощённый: один `<img>` из `GetAsset()`;
- группировка по mime: пути всех сегментов одного формата → один `<source>`;
- выбор группы для `<img>`: `source_format` → `all_support` → последняя (как в `GetAssetsHtml`);
- srcset/descriptors: дублируем правила из `_buildSrcset` (dpr `Nx`; height-only → `height/base*`;
  `sizes` передан и есть width → `Ww`);
- атрибуты: `alt/sizes/loading/width/height` → `<img>`; остальные (`class`, `id`, ...) → `<picture>`;
  React-имена: `className` → `class`, `htmlFor` → `for`;
- booleans → атрибут без значения, React-стиль (`loading="lazy"` для `lazy`);

## 5. Vue 3-пакет

```ts
// main.ts — инициализация по умолчанию
app.use(ImagerPlugin, { baseURL: "...", format: "webp", dpr: 2 });
// или <ImagerProvider :imager="imager">...
```

```html
<ImagerAssets src="/test.png" preset="thumb" format="webp" alt="Фото" class="thumb" />
<ImagerAssets :source="src" :width="200" :height="200" :dpr="2" formats="webp, avif" />
```

- `ImagerPlugin` — `app.provide(imagerKey, new Imager(options))`;
- `ImagerAssets` — функциональный/`<script setup>` SFC c `useInjectImager()`; нативные vnode;
- `ImagerAsset` — один `<img>`;
- правила группировки/srcset/атрибутов — общие с React (единая логика из п.4);
- `class`/`style` — на `<picture>`; `formats` принимает и строку с запятыми (Vue-удобство).

## 6. Twig-пакет (PHP)

Twig не строит DOM — тут используем `GetAssetsHtml` (уже реализован в
`src/imager-php/Imager.php:490`) и выводим через `|raw` (строка строится самим
пакетом, escape выполняет ядро):

```twig
{# инициализация: расширение Twig с imager-сервисом #}
{{ imager_assets('/test.png', {preset: 'thumb', format: 'webp', alt: 'Фото', class: 'thumb'}) }}
{{ imager_assets('/test.png', {width: 200, height: 200, dpr: 2, formats: ['webp','avif'], lazy: true}) }}
{{ imager_asset('/test.png', {preset: 'thumb', format: 'webp'}) }}
```

- Twig-расширение `ImagerTwigExtension`:
  - `imager_assets(source, args)` → HTML `<picture>/<img>`: `GetAssetsHtml` c нормализацией
    алиасов (`src`/`preset`/`width`/`height`);
  - `imager_asset(source, args)` → URL: `GetAssetPath` c той же нормализацией;
  - `imager_assets_raw(source, args)` → массив `AssetType` (если нужен свой рендер);
- конструктор расширения принимает `Imager` (или options-массив, создаёт сам).

## 7. Тесты

- Общая golden-логика уже покрыта `test/fixture.json` для ядра.
- Для нормализации props: `test/fixture-components.json` — 7 кейсов `NormalizeProps`
  (args = props, expected = нормализованная пятёрка), единый для React/Vue/Twig.
- React: `packages/react/test/test.tsx` — 5 кейсов, семантическое сравнение DOM
  (извлечение тегов, нормализация `srcSet`→`srcset`, сортировка атрибутов,
  отбрасывание preload-`<link>` React 19) с HTML из `GetAssetsHtml`.
- Vue: `packages/vue/test/test.ts` — 5 кейсов через `createSSRApp` + `renderToString`.
- Twig: `packages/twig/test/test.php` — 6 кейсов: сравнение вывода расширения
  с методами ядра (`GetAssetsHtml`, `GetAssetPath`, `GetAssets`).
- Доп. кейсы: отсутствует source; конфликт `segment`+`preset`; `width` без `height`;
  formats строкой с запятыми; `lazy` → `loading="lazy"`.

## 8. Сборка и публикация

- `packages/react`: tsc → ESM + d.ts; peerDeps: react, imager-client;
- `packages/vue`: tsc → ESM + d.ts; peerDeps: vue, imager-client;
- `packages/twig`: обычный composer-пакет, PSR-4 `imagerTwig\\`;
- `Makefile`: цели `build-react`, `build-vue`, `test-react`, `test-vue`, `test-twig`;
- документация: `packages/react/README.md`, `packages/vue/README.md`,
  `packages/twig/README.md` + разделы в `README.md` / `doc/README-EN.md`.

## 9. Порядок реализации

1. `src/imager-ts/component.ts` — `normalizeProps` + golden-кейсы в fixture. ✅
2. `packages/react` — Provider + ImagerAssets + ImagerAsset + тесты (5/5 PASS). ✅
3. `packages/vue` — Plugin + Provider + компоненты + тесты (5/5 PASS). ✅
4. `packages/twig` — расширение + тесты (6/6 PASS). ✅
5. Доки, README, Makefile, публикация. ✅ (README пакетов + Makefile; публикация — отдельно)

## 10. Рефакторинг: общая render-логика в ядре (выполнено)

Чтобы React/Vue не дублировали render-логику, она вынесена в ядро:

- `src/imager-ts/render.ts` — новый модуль: `IMG_ATTRS`, `fmtDescriptor`, `buildSrcset`,
  `HtmlGroup`, `groupAssets`, `pickImgGroup`, `splitAttrs`, `useWidthDescriptors`;
- `Imager.GetAssetsHtml` рефакторингован на эти функции (приватные дубли `_fmtDescriptor`,
  `_buildSrcset`, `IMG_ATTRS`, inline-группировка/splitAttrs удалены);
- `packages/react/src/render.ts` и `packages/vue/src/render.ts` удалены — пакеты импортируют
  render-функции из `imager-client` (экспортируются из `src/imager-ts/index.ts`);
- `ImagerProvider` (React) получил `options?: ImagerOptions` — создаёт `new Imager(options)`
  один раз при монтировании (как Vue `ImagerPlugin`); приоритет: `imager` > `options`;
- сборка пакетов: `devDependency "imager-client": "file:../.."` + `Makefile`: `build-react`/`build-vue`
  зависят от `build` ядра (пакеты резолвят `dist/imager/index.js` ядра);
- тесты пакетов используют `paths` на исходники ядра (компиляция) + `dist` ядра (рантайм);
  React-пакет получил `react-dom@18` + `@types/react-dom@18` в devDependencies (согласованная
  пара с `react@18` — иначе `Invalid hook call` из-за двух копий React в монорепо).

## Открытые вопросы (решить при имплементации)

- Публиковать `@imager/*` под тем же scope, что `imager-client`, или отдельные имена?
- React 19 Server Components: нужен ли отдельный async-компонент (пока не планируется —
  все методы синхронные).
