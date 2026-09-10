/** Раннер golden-тестов для TypeScript-клиента imager.

Читает test/fixture.json (единые golden-кейсы), выполняет каждый кейс через
src/imager-ts.Imager и сверяет результат с expected побайтово (JSON.stringify
с сохранением порядка ключей). Дополнительно — unit-тесты админ-методов
(AdminGenerate/AdminDelete) на ImagerServer с mock-HTTP-сервером (node:http)
и проверка, что клиентская часть не содержит token/админ-методов.

Запуск: npm test  (из корня проекта), либо:
    tsc -p test/tsconfig.json && node test/dist/test.js
*/
import * as fs from "fs";
import * as path from "path";
import * as http from "http";

import { Imager } from "../src/imager-ts/Imager";
import { ImagerServer } from "../src/imager-ts-server/ImagerServer";
import { AssetType } from "../src/imager-ts/ImagerTypes";
import { normalizeProps } from "../src/imager-ts/component";

// --------------------------------------------------------------------- //
//  Загрузка фикстур                                                     //
// --------------------------------------------------------------------- //

/** Ищет корень проекта (каталог, содержащий test/fixture.json), поднимаясь вверх. */
function findProjectRoot(dir: string): string {
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

const PROJECT_DIR = findProjectRoot(__dirname);
const FIXTURE = path.join(PROJECT_DIR, "test", "fixture.json");

interface FixtureCase {
    id: number;
    options?: Record<string, unknown>;
    method: string;
    args?: Record<string, unknown>;
    expected: unknown;
}

function loadFixture(): FixtureCase[] {
    const raw = fs.readFileSync(FIXTURE, "utf-8");
    return JSON.parse(raw) as FixtureCase[];
}

// --------------------------------------------------------------------- //
//  Вызов метода по кейсу                                                //
// --------------------------------------------------------------------- //

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runCase(case_: FixtureCase): any {
    const options = case_.options ? case_.options : {};
    const args = case_.args ? case_.args : {};
    const img = new Imager(options);

    switch (case_.method) {
        case "GetAsset":
            return img.GetAsset(
                args["source"] as string,
                args["segment"] as never,
                args["format"] as string,
                args["dpr"] as number | string,
            );
        case "GetAssets":
            return img.GetAssets(
                args["source"] as string,
                args["segments"] as never,
                args["formats"] as never,
                args["dprs"] as number | string,
            );
        case "GetAssetPath":
            return img.GetAssetPath(
                args["source"] as string,
                args["segment"] as never,
                args["format"] as string,
                args["dpr"] as number | string,
            );
        case "GetAssetsHtml":
            return img.GetAssetsHtml(
                args["source"] as string,
                args["segments"] as never,
                args["formats"] as never,
                args["dprs"] as number | string,
                args["options"] as Record<string, unknown>,
            );
        case "NormalizeProps":
            return normalizeProps(args["props"] as never);
        default:
            throw new Error("Unknown method: " + case_.method);
    }
}

// --------------------------------------------------------------------- //
//  Сравнение: побайтовая JSON-сериализация (порядок ключей важен)      //
// --------------------------------------------------------------------- //

function jsonEqual(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((x, i) => jsonEqual(x, b[i]));
    }
    if (
        a !== null &&
        b !== null &&
        typeof a === "object" &&
        typeof b === "object"
    ) {
        const ak = Object.keys(a as Record<string, unknown>);
        const bk = Object.keys(b as Record<string, unknown>);
        if (ak.length !== bk.length) {
            return false;
        }
        for (let i = 0; i < ak.length; i++) {
            if (ak[i] !== bk[i]) {
                return false;
            }
            if (
                !jsonEqual(
                    (a as Record<string, unknown>)[ak[i]],
                    (b as Record<string, unknown>)[bk[i]],
                )
            ) {
                return false;
            }
        }
        return true;
    }
    return a === b;
}

function dumps(value: unknown): string {
    return JSON.stringify(value);
}

function runGolden(): number {
    const fixture = loadFixture();
    let failed = 0;
    let total = 0;
    for (const case_ of fixture) {
        total += 1;
        const actual = runCase(case_);
        const expected = case_.expected;
        const actualJson = JSON.stringify(actual);
        const expectedJson = JSON.stringify(expected);
        if (!jsonEqual(actual, expected) || actualJson !== expectedJson) {
            failed += 1;
            console.log(`[FAIL] id=${case_.id} ${case_.method}`);
            console.log(`  expected: ${dumps(expected)}`);
            console.log(`  actual:   ${dumps(actual)}`);
        } else {
            console.log(`[ok] id=${case_.id} ${case_.method}`);
        }
    }
    console.log("---");
    console.log(`golden: ${total} cases, ${total - failed} passed, ${failed} failed`);
    return failed;
}

// --------------------------------------------------------------------- //
//  Golden-кейсы компонентов (fixture-components.json)                   //
// --------------------------------------------------------------------- //

const FIXTURE_COMPONENTS = path.join(PROJECT_DIR, "test", "fixture-components.json");

function loadComponentFixture(): FixtureCase[] {
    const raw = fs.readFileSync(FIXTURE_COMPONENTS, "utf-8");
    return JSON.parse(raw) as FixtureCase[];
}

function runComponentGolden(): number {
    const fixture = loadComponentFixture();
    let failed = 0;
    let total = 0;
    for (const case_ of fixture) {
        total += 1;
        const actual = runCase(case_);
        const expected = case_.expected;
        const actualJson = JSON.stringify(actual);
        const expectedJson = JSON.stringify(expected);
        if (!jsonEqual(actual, expected) || actualJson !== expectedJson) {
            failed += 1;
            console.log(`[FAIL] id=${case_.id} ${case_.method}`);
            console.log(`  expected: ${dumps(expected)}`);
            console.log(`  actual:   ${dumps(actual)}`);
        } else {
            console.log(`[ok] id=${case_.id} ${case_.method}`);
        }
    }
    console.log("---");
    console.log(`components: ${total} cases, ${total - failed} passed, ${failed} failed`);
    return failed;
}

// --------------------------------------------------------------------- //
//  Проверка клиентской части: нет token/админ-методов     //
// --------------------------------------------------------------------- //

function runClientSanity(): number {
    let failed = 0;
    const img = new Imager({ baseURL: "/" });
    const lookup = img as unknown as Record<string, unknown>;

    // клиентский класс не должен иметь админ-методов
    if (typeof lookup["AdminGenerate"] !== "undefined") {
        failed += 1;
        console.log("[FAIL] client Imager must not have AdminGenerate");
    } else {
        console.log("[ok] client has no AdminGenerate");
    }
    if (typeof lookup["AdminDelete"] !== "undefined") {
        failed += 1;
        console.log("[FAIL] client Imager must not have AdminDelete");
    } else {
        console.log("[ok] client has no AdminDelete");
    }
    // даже при попытке передать token в опции — поле не появляется
    const probe = new Imager({ baseURL: "/", token: "secret" } as never);
    const probeLookup = probe as unknown as Record<string, unknown>;
    if (probeLookup["token"] !== undefined) {
        failed += 1;
        console.log("[FAIL] client Imager leaks public token");
    } else {
        console.log("[ok] client has no public token");
    }
    if (probeLookup["_token"] !== undefined) {
        failed += 1;
        console.log("[FAIL] client Imager leaks token field");
    } else {
        console.log("[ok] client has no token field");
    }
    console.log("---");
    console.log(`client: ${failed} failed`);
    return failed;
}

// --------------------------------------------------------------------- //
//  Админ-методы: mock HTTP-сервер (node:http)                          //
// --------------------------------------------------------------------- //

interface MockRequestInfo {
    method: string;
    path: string;
    authorization: string;
    content_type: string;
    body: string;
}

class MockServer {
    static code = 202;
    static lastRequest: MockRequestInfo | null = null;
}

function startMockServer(): Promise<http.Server> {
    return new Promise((resolve) => {
        const server = http.createServer(
            (req: http.IncomingMessage, res: http.ServerResponse) => {
                if (req.method !== "POST" && req.method !== "DELETE") {
                    res.statusCode = 404;
                    res.end();
                    return;
                }
                const chunks: Buffer[] = [];
                req.on("data", (c: Buffer) => chunks.push(c));
                req.on("end", () => {
                    MockServer.lastRequest = {
                        method: req.method || "",
                        path: req.url || "",
                        authorization: req.headers["authorization"] || "",
                        content_type: req.headers["content-type"] || "",
                        body: Buffer.concat(chunks).toString("utf-8"),
                    };
                    res.statusCode = MockServer.code;
                    res.setHeader("Content-Type", "application/json");
                    res.end("{}");
                });
            },
        );
        server.listen(0, "127.0.0.1", () => resolve(server));
    });
}

async function runAdmin(): Promise<number> {
    let failed = 0;
    const server = await startMockServer();
    const addr = server.address() as { port: number };
    const base = "http://127.0.0.1:" + addr.port;
    const img = new ImagerServer({ token: "secret", adminURL: base });

    // 1. Generate target-string, wait=true -> 202 -> True, тело/заголовки
    MockServer.code = 202;
    let ok = await img.AdminGenerate("thumbs/photo.jpg", true);
    const req = MockServer.lastRequest;
    if (!ok) {
        failed += 1;
        console.log("[FAIL] admin.generate string (202)");
    } else if (
        !req ||
        req.method !== "POST" ||
        req.path !== "/admin/assets/generate" ||
        req.authorization !== "Bearer secret" ||
        req.content_type !== "application/json"
    ) {
        failed += 1;
        console.log("[FAIL] admin.generate headers/url: " + JSON.stringify(req));
    } else {
        const body = JSON.parse(req.body);
        if (body.source !== "thumbs/photo.jpg" || body.wait !== true) {
            failed += 1;
            console.log("[FAIL] admin.generate body: " + req.body);
        } else {
            console.log("[ok] admin.generate string (202)");
        }
    }

    // 2. Generate с AssetType -> assets + wait
    MockServer.code = 200;
    const asset: AssetType = {
        type: "image/webp",
        paths: [
            { path: "https://x.test/a.webp" },
            { path: "https://x.test/a@2.webp", dpr: 2 },
        ],
    };
    ok = await img.AdminGenerate(asset, false);
    const req2 = MockServer.lastRequest;
    if (!ok) {
        failed += 1;
        console.log("[FAIL] admin.generate assets (200)");
    } else {
        const body = req2 ? JSON.parse(req2.body) : {};
        if (
            !req2 ||
            req2.method !== "POST" ||
            req2.path !== "/admin/assets/generate" ||
            body.wait !== false ||
            !Array.isArray(body.assets) ||
            body.assets.length !== 2 ||
            body.assets[0] !== "https://x.test/a.webp" ||
            body.assets[1] !== "https://x.test/a@2.webp"
        ) {
            failed += 1;
            console.log("[FAIL] admin.generate assets body: " + (req2 ? req2.body : ""));
        } else {
            console.log("[ok] admin.generate assets (200)");
        }
    }

    // 2b. Generate с AssetType[] -> все path'ы в один список assets
    MockServer.code = 200;
    const asset2: AssetType = {
        type: "image/webp",
        paths: [{ path: "https://x.test/b.webp" }],
    };
    ok = await img.AdminGenerate([asset, asset2], false);
    const req2b = MockServer.lastRequest;
    if (!ok) {
        failed += 1;
        console.log("[FAIL] admin.generate AssetType[] (200)");
    } else {
        const body = req2b ? JSON.parse(req2b.body) : {};
        if (
            !req2b ||
            req2b.method !== "POST" ||
            req2b.path !== "/admin/assets/generate" ||
            body.wait !== false ||
            !Array.isArray(body.assets) ||
            body.assets.length !== 3 ||
            body.assets[0] !== "https://x.test/a.webp" ||
            body.assets[1] !== "https://x.test/a@2.webp" ||
            body.assets[2] !== "https://x.test/b.webp"
        ) {
            failed += 1;
            console.log("[FAIL] admin.generate AssetType[] body: " + (req2b ? req2b.body : ""));
        } else {
            console.log("[ok] admin.generate AssetType[] (200)");
        }
    }

    // 2c. Generate с string[] -> пути как есть, без валидации
    MockServer.code = 200;
    const rawPaths = ["https://cdn.test/one.webp", "https://cdn.test/two.webp"];
    ok = await img.AdminGenerate(rawPaths, false);
    const req2c = MockServer.lastRequest;
    if (!ok) {
        failed += 1;
        console.log("[FAIL] admin.generate string[] (200)");
    } else {
        const body = req2c ? JSON.parse(req2c.body) : {};
        if (
            !req2c ||
            req2c.method !== "POST" ||
            req2c.path !== "/admin/assets/generate" ||
            body.wait !== false ||
            !Array.isArray(body.assets) ||
            body.assets.length !== 2 ||
            body.assets[0] !== "https://cdn.test/one.webp" ||
            body.assets[1] !== "https://cdn.test/two.webp"
        ) {
            failed += 1;
            console.log("[FAIL] admin.generate string[] body: " + (req2c ? req2c.body : ""));
        } else {
            console.log("[ok] admin.generate string[] (200)");
        }
    }

    // 3. Generate: 500 -> False
    MockServer.code = 500;
    ok = await img.AdminGenerate("thumbs/photo.jpg", false);
    if (ok) {
        failed += 1;
        console.log("[FAIL] admin.generate must be False on 500");
    } else {
        console.log("[ok] admin.generate False on 500");
    }

    // 4. Delete: 200 -> True
    MockServer.code = 200;
    ok = await img.AdminDelete("thumbs/photo.jpg", true);
    const req4 = MockServer.lastRequest;
    if (!ok) {
        failed += 1;
        console.log("[FAIL] admin.delete (200)");
    } else {
        const body = req4 ? JSON.parse(req4.body) : {};
        if (
            !req4 ||
            req4.method !== "DELETE" ||
            req4.path !== "/admin/assets/delete" ||
            body.source !== "thumbs/photo.jpg" ||
            body.wait !== true
        ) {
            failed += 1;
            console.log("[FAIL] admin.delete request: " + JSON.stringify(req4));
        } else {
            console.log("[ok] admin.delete (200)");
        }
    }

    // 5. Delete: 202 (недопустим для delete) -> False
    MockServer.code = 202;
    ok = await img.AdminDelete("thumbs/photo.jpg", true);
    if (ok) {
        failed += 1;
        console.log("[FAIL] admin.delete must be False on 202");
    } else {
        console.log("[ok] admin.delete False on 202");
    }

    // 6. Пустой token/adminURL -> False без сети
    const noAdmin = new ImagerServer({ token: "t" });
    const [g1, d1] = await Promise.all([
        noAdmin.AdminGenerate("x.jpg", false),
        noAdmin.AdminDelete("x.jpg", false),
    ]);
    if (g1 || d1) {
        failed += 1;
        console.log("[FAIL] empty adminURL must return False");
    } else {
        console.log("[ok] empty adminURL -> False");
    }

    MockServer.code = 200;
    const noTok = new ImagerServer({ adminURL: base });
    const g2 = await noTok.AdminGenerate("x.jpg", false);
    if (g2) {
        failed += 1;
        console.log("[FAIL] empty token must return False");
    } else {
        console.log("[ok] empty token -> False");
    }

    server.close();
    console.log("---");
    console.log(`admin: ${failed} failed`);
    return failed;
}

async function main() {
    let failed = 0;
    failed += runGolden();
    failed += runComponentGolden();
    failed += runClientSanity();
    failed += await runAdmin();
    console.log(`=== RESULT: ${failed ? "FAIL" : "PASS"} ===`);
    if (failed > 0) {
        process.exit(1);
    }
}

main();
