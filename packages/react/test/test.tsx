/** Тест React-компонентов imager (golden-сценарий).

Пакет прогоняет HTML-кейсы (GetAssetsHtml) из test/fixture.json через
свой компонент ImagerAssets и сверяет результат с expected из фикстуры
(семантически: порядок тегов важен, порядок атрибутов — нет).
Ядро GetAssetsHtml при этом не вызывается — эталоном служит фикстура.
*/
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Imager, ImagerProvider, ImagerAssets } from "../src/index";
import { htmlEqual } from "../../../test/html-parse";
import { loadHtmlFixture, argsToAssetsProps } from "../../../test/fixture-html";

const imager = new Imager({ baseURL: "/test-png/", format: "webp", dpr: 2 });

function renderAssets(props: Record<string, unknown>): string {
    return renderToStaticMarkup(
        <ImagerProvider imager={imager}>
            <ImagerAssets {...props} />
        </ImagerProvider>,
    );
}

let failed = 0;
let total = 0;

function check(name: string, actual: string, expected: string) {
    total += 1;
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

const fixture = loadHtmlFixture();

for (const case_ of fixture) {
    const props = argsToAssetsProps(case_.args || {});
    const actual = renderAssets(props);
    check(`id${case_.id} ${case_.method}`, actual, String(case_.expected));
}

console.log("---");
console.log(`react: ${total} cases, ${total - failed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
