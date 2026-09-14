/** Общая загрузка golden-фикстуры и маппинг args → props компонентов.

Пакеты react/vue прогоняют HTML-кейсы (GetAssetsHtml) из test/fixture.json
через свои компоненты ImagerAssets: args кейса преобразуются в props
компонента, а эталоном служит expected (HTML-строка) из фикстуры.
Ядро GetAssetsHtml при этом не вызывается.
*/

import * as fs from "fs";
import * as path from "path";

/** Кейс golden-фикстуры. */
export interface FixtureCase {
    id: number;
    options?: Record<string, unknown>;
    method: string;
    args?: Record<string, unknown>;
    expected: unknown;
}

/** Ищет корень проекта (каталог, содержащий test/fixture.json), поднимаясь вверх. */
export function findProjectRoot(dir: string): string {
    let cur = dir;
    for (;;) {
        if (fs.existsSync(path.join(cur, "test", "fixture.json"))) {
            return cur;
        }
        const parent = path.dirname(cur);
        if (parent === cur) {
            throw new Error("project root not found");
        }
        cur = parent;
    }
}

/** Загружает test/fixture.json. */
export function loadFixture(): FixtureCase[] {
    const root = findProjectRoot(__dirname);
    const raw = fs.readFileSync(path.join(root, "test", "fixture.json"), "utf-8");
    return JSON.parse(raw) as FixtureCase[];
}

/** Возвращает только HTML-кейсы (GetAssetsHtml). */
export function loadHtmlFixture(): FixtureCase[] {
    return loadFixture().filter((c) => c.method === "GetAssetsHtml");
}

/** Маппинг args кейса GetAssetsHtml → props компонента ImagerAssets.

args: { source, segments, formats, dprs, options }
props: { src, segment, formats, dprs, ...options }
*/
export function argsToAssetsProps(args: Record<string, unknown>): Record<string, unknown> {
    const props: Record<string, unknown> = {};

    if (args["source"] !== undefined) {
        props["src"] = args["source"];
    }
    if (args["segments"] !== undefined) {
        props["segment"] = args["segments"];
    }
    if (args["formats"] !== undefined) {
        props["formats"] = args["formats"];
    }
    if (args["dprs"] !== undefined) {
        props["dprs"] = args["dprs"];
    }

    const options = args["options"];
    if (options && typeof options === "object") {
        const keys = Object.keys(options as Record<string, unknown>);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            props[key] = (options as Record<string, unknown>)[key];
        }
    }

    return props;
}
