/** Тест Vue 3-компонентов imager.

Проверяет, что нативный рендер ImagerAssets/ImagerAsset (через renderToString)
семантически совпадает с HTML из GetAssetsHtml/GetAsset ядра.
*/
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { Imager, ImagerProvider, ImagerAssets, ImagerAsset } from "../src/index";

const imager = new Imager({ baseURL: "/test-png/", format: "webp", dpr: 2 });

async function renderAssets(props: Record<string, unknown>): Promise<string> {
    const app = createSSRApp({
        render: () => h(ImagerProvider, { imager }, () => h(ImagerAssets, props)),
    });
    return renderToString(app);
}

async function renderAsset(props: Record<string, unknown>): Promise<string> {
    const app = createSSRApp({
        render: () => h(ImagerProvider, { imager }, () => h(ImagerAsset, props)),
    });
    return renderToString(app);
}

/** Извлекает из HTML список тегов с атрибутами. */
function extractTags(html: string): string[] {
    const tags: string[] = [];
    const re = /<(\/?)(picture|source|img)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
        const closing = m[1];
        const name = m[2];
        const attrsRaw = m[3];
        const attrs: string[] = [];
        const are = /([a-zA-Z-]+)="([^"]*)"/g;
        let am: RegExpExecArray | null;
        while ((am = are.exec(attrsRaw)) !== null) {
            attrs.push(am[1] + "=" + am[2]);
        }
        attrs.sort();
        tags.push("<" + closing + name + (attrs.length ? " " + attrs.join(" ") : "") + ">");
    }
    return tags;
}

let failed = 0;
let total = 0;

async function check(name: string, actualP: Promise<string>, expectedP: () => string) {
    total += 1;
    const actual = await actualP;
    const expected = expectedP();
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

const expected1 = imager.GetAssetsHtml("/test.png", { width: 200, height: 200 }, "webp", 2);
check(
    "assets src+size+dpr+format",
    renderAssets({ src: "/test.png", width: 200, height: 200, dpr: 2, format: "webp" }),
    () => expected1,
);

const expected2 = imager.GetAssetsHtml(
    "/test.png",
    "thumb",
    ["webp", "png"],
    null,
    { lazy: true, alt: "Фото", class: "thumb" },
);
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
    () => expected2,
);

const expected3 = imager.GetAssetsHtml("/test.png", "200x200", "webp", 3);
check(
    "assets single format",
    renderAssets({ src: "/test.png", segment: "200x200", format: "webp", dpr: 3 }),
    () => expected3,
);

const expected4 = (() => {
    const asset = imager.GetAsset("/test.png", { width: 200, height: 200 }, "webp", 2);
    return '<img src="' + asset.paths[0].path + '" width="' + asset.paths[0].width + '" height="' + asset.paths[0].height + '">';
})();
check(
    "asset single img",
    renderAsset({ src: "/test.png", width: 200, height: 200, dpr: 2, format: "webp" }),
    () => expected4,
);

const expected5 = imager.GetAssetsHtml(
    "/test.png",
    "200x200",
    ["webp", "png"],
    3,
    { sizes: "(max-width: 600px) 100vw, 50vw" },
);
check(
    "assets sizes w-descriptors",
    renderAssets({
        src: "/test.png",
        segment: "200x200",
        formats: ["webp", "png"],
        dpr: 3,
        sizes: "(max-width: 600px) 100vw, 50vw",
    }),
    () => expected5,
);

console.log("---");
console.log(`vue: ${total} cases, ${total - failed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
