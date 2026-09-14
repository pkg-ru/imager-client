/** Тест Vue 3-компонентов imager (golden-сценарий).

Пакет прогоняет HTML-кейсы (GetAssetsHtml) из test/fixture.json через
свой компонент ImagerAssets (renderToString) и сверяет результат с
expected из фикстуры (семантически: порядок тегов важен, порядок
атрибутов — нет). Ядро GetAssetsHtml при этом не вызывается.
*/
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { Imager, ImagerProvider, ImagerAssets } from "../src/index";
import { htmlEqual } from "../../../test/html-parse";
import { loadHtmlFixture, argsToAssetsProps } from "../../../test/fixture-html";

const imager = new Imager({ baseURL: "/test-png/", format: "webp", dpr: 2 });

async function renderAssets(props: Record<string, unknown>): Promise<string> {
    const app = createSSRApp({
        render: () => h(ImagerProvider, { imager }, () => h(ImagerAssets, props)),
    });
    return renderToString(app);
}

let failed = 0;
let total = 0;

async function check(name: string, actualP: Promise<string>, expected: string) {
    total += 1;
    const actual = await actualP;
    if (htmlEqual(actual, expected)) {
        console.log(`[ok] ${name}`);
    } else {
        failed += 1;
        console.log(`[FAIL] ${name}`);
        console.log(`  expected: ${expected}`);
        console.log(`  actual:   ${actual}`);
    }
}

// --------------------------------------------------------------------- //
//  Golden-кейсы GetAssetsHtml из test/fixture.json через ImagerAssets   //
// --------------------------------------------------------------------- //

async function main() {
    const fixture = loadHtmlFixture();

    for (const case_ of fixture) {
        const props = argsToAssetsProps(case_.args || {});
        await check(`id${case_.id} ${case_.method}`, renderAssets(props), String(case_.expected));
    }

    console.log("---");
    console.log(`vue: ${total} cases, ${total - failed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

main();
