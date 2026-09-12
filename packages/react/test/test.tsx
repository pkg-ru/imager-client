/** Тест React-компонентов imager.

Проверяет, что нативный рендер ImagerAssets/ImagerAsset семантически
совпадает с HTML из GetAssetsHtml/GetAsset ядра: та же структура
<picture>/<source>/<img>, те же src/srcset/type/width/height/атрибуты.
*/
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Imager, ImagerPlugin, ImagerProvider, ImagerAssets, ImagerAsset } from "../src/index";

const imager = new Imager({ baseURL: "/test-png/", format: "webp", dpr: 2 });

function renderAssets(props: Record<string, unknown>): string {
    return renderToStaticMarkup(
        <ImagerProvider imager={imager}>
            <ImagerAssets {...props} />
        </ImagerProvider>,
    );
}

function renderAsset(props: Record<string, unknown>): string {
    return renderToStaticMarkup(
        <ImagerProvider imager={imager}>
            <ImagerAsset {...props} />
        </ImagerProvider>,
    );
}

/** Извлекает из HTML-строки список тегов с атрибутами (без preload-линков). */
function extractTags(html: string): string[] {
    // убираем <link rel="preload"> (React 19 добавляет их для img с srcSet)
    const withoutPreload = html.replace(/<link[^>]*>/g, "");
    const tags: string[] = [];
    const re = /<(\/?)(picture|source|img)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(withoutPreload)) !== null) {
        const closing = m[1];
        const name = m[2];
        const attrsRaw = m[3];
        // атрибуты в каноническом порядке; srcSet → srcset (React camelCase)
        const attrs: string[] = [];
        const are = /([a-zA-Z-]+)="([^"]*)"/g;
        let am: RegExpExecArray | null;
        while ((am = are.exec(attrsRaw)) !== null) {
            const attrName = am[1] === "srcSet" ? "srcset" : am[1];
            attrs.push(attrName + "=" + am[2]);
        }
        attrs.sort();
        tags.push("<" + closing + name + (attrs.length ? " " + attrs.join(" ") : "") + ">");
    }
    return tags;
}

let failed = 0;
let total = 0;

function check(name: string, actual: string, expected: string) {
    total += 1;
    const a = extractTags(actual).join("\n");
    const e = extractTags(expected).join("\n");
    if (a === e) {
        console.log(`[ok] ${name}`);
    } else {
        failed += 1;
        console.log(`[FAIL] ${name}`);
        console.log(`  expected:\n${e}`);
        console.log(`  actual:\n${a}`);
    }
}

// 1. ImagerAssets: src + width/height + dpr + format → picture
check(
    "assets src+size+dpr+format",
    renderAssets({ src: "/test.png", width: 200, height: 200, dpr: 2, format: "webp" }),
    imager.GetAssetsHtml("/test.png", { width: 200, height: 200 }, "webp", 2),
);

// 2. ImagerAssets: source + preset + formats + lazy + alt + class
check(
    "assets source+preset+formats+lazy",
    renderAssets({
        source: "/test.png",
        preset: "thumb",
        formats: ["webp", "png"],
        lazy: true,
        alt: "Фото",
        class: "thumb",
    }),
    imager.GetAssetsHtml(
        "/test.png",
        "thumb",
        ["webp", "png"],
        null,
        { lazy: true, alt: "Фото", class: "thumb" },
    ),
);

// 3. ImagerAssets: один формат → только <img>
check(
    "assets single format",
    renderAssets({ src: "/test.png", segment: "200x200", format: "webp", dpr: 3 }),
    imager.GetAssetsHtml("/test.png", "200x200", "webp", 3),
);

// 4. ImagerAsset: один <img> из GetAsset (dpr=2 → один путь @2)
// GetAsset с dpr=2 возвращает один путь @2 (в отличие от GetAssetsHtml с srcset)
{
    const asset = imager.GetAsset("/test.png", { width: 200, height: 200 }, "webp", 2);
    const expected = '<img src="' + asset.paths[0].path + '" width="' + asset.paths[0].width + '" height="' + asset.paths[0].height + '">';
    check("asset single img", renderAsset({ src: "/test.png", width: 200, height: 200, dpr: 2, format: "webp" }), expected);
}

// 5. ImagerAssets: sizes → w-дескрипторы
check(
    "assets sizes w-descriptors",
    renderAssets({
        src: "/test.png",
        segment: "200x200",
        formats: ["webp", "png"],
        dpr: 3,
        sizes: "(max-width: 600px) 100vw, 50vw",
    }),
    imager.GetAssetsHtml(
        "/test.png",
        "200x200",
        ["webp", "png"],
        3,
        { sizes: "(max-width: 600px) 100vw, 50vw" },
    ),
);

// 5b. ImagerAssets: decoding/fetchpriority → <img>
check(
    "assets decoding fetchpriority",
    renderAssets({
        src: "/test.png",
        segment: "200x200",
        formats: ["webp", "png"],
        dpr: 2,
        decoding: "async",
        fetchpriority: "high",
    }),
    imager.GetAssetsHtml(
        "/test.png",
        "200x200",
        ["webp", "png"],
        2,
        { decoding: "async", fetchpriority: "high" },
    ),
);

// 5c. ImagerAssets: imgAttrs → <img> с приоритетом над перенаправленными
check(
    "assets imgAttrs priority",
    renderAssets({
        src: "/test.png",
        segment: "200x200",
        formats: ["webp", "png"],
        dpr: 2,
        alt: "Фото",
        class: "wrap",
        imgAttrs: { class: "img", decoding: "async", fetchpriority: "high", width: 333, height: 444 },
    }),
    imager.GetAssetsHtml(
        "/test.png",
        "200x200",
        ["webp", "png"],
        2,
        {
            alt: "Фото",
            class: "wrap",
            imgAttrs: { class: "img", decoding: "async", fetchpriority: "high", width: 333, height: 444 },
        },
    ),
);

// 6. ImagerPlugin.install: глобальная инициализация без ImagerProvider
ImagerPlugin.install({ baseURL: "/test-png/", format: "webp", dpr: 2 });
check(
    "plugin install global",
    renderToStaticMarkup(<ImagerAssets src="/test.png" width={200} height={200} dpr={2} format="webp" />),
    imager.GetAssetsHtml("/test.png", { width: 200, height: 200 }, "webp", 2),
);

console.log("---");
console.log(`react: ${total} cases, ${total - failed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
