/** Общий HTML-парсер для golden-тестов.

Сравнение HTML-разметки семантическое:
- порядок тегов важен;
- порядок атрибутов не важен (атрибуты сравниваются как мультимножества);
- значения атрибутов сравниваются как строки;
- атрибут без значения (булев) — null;
- текст между тегами игнорируется.

Нормализация (чтобы единый код работал и для ядра, и для React/Vue):
- `srcSet` → `srcset` (React рендерит camelCase);
- самозакрывающиеся теги `<img/>`/`<source/>` — завершающий `/` не атрибут;
- `<link rel="preload">` (React 19) игнорируется.

Используется ядром (test/test.ts) и фреймворк-пакетами
(packages/react, packages/vue) — единый код сравнения.
*/

export interface HtmlTag {
    name: string;
    attrs: Array<[string, unknown]>;
}

/** Разбирает HTML-строку на список тегов (текст между тегами игнорируется). */
export function parseHtmlTags(html: string): HtmlTag[] {
    const tags: HtmlTag[] = [];
    let rest = html;
    for (;;) {
        const open = rest.indexOf("<");
        if (open < 0) {
            break;
        }
        const after = rest.slice(open + 1);
        const close = after.indexOf(">");
        if (close < 0) {
            break;
        }
        let tagBody = after.slice(0, close);
        rest = after.slice(close + 1);
        if (tagBody.startsWith("/") || tagBody.startsWith("!")) {
            continue;
        }
        // Самозакрывающийся тег: <img .../> — завершающий '/' не атрибут.
        if (tagBody.endsWith("/")) {
            tagBody = tagBody.slice(0, -1).trimEnd();
        }
        const tag = parseTagAttrs(tagBody);
        // <link rel="preload"> (React 19) — не часть разметки imager.
        if (tag.name === "link") {
            continue;
        }
        tags.push(tag);
    }
    return tags;
}

/** Разбирает содержимое тега (без < >) на имя и атрибуты. */
export function parseTagAttrs(tag: string): HtmlTag {
    const sp = tag.indexOf(" ");
    if (sp < 0) {
        return { name: tag, attrs: [] };
    }
    const name = tag.slice(0, sp);
    const attrs: Array<[string, unknown]> = [];
    let rest = tag.slice(sp + 1).trim();
    while (rest !== "") {
        const eq = rest.indexOf("=");
        const sp2 = rest.indexOf(" ");
        let attrName = "";
        let afterName = "";
        if (eq >= 0 && (sp2 < 0 || eq < sp2)) {
            attrName = rest.slice(0, eq);
            afterName = rest.slice(eq + 1);
        } else if (sp2 >= 0) {
            attrName = rest.slice(0, sp2);
            afterName = rest.slice(sp2 + 1);
        } else {
            attrName = rest;
            afterName = "";
        }
        attrName = attrName.trim();
        afterName = afterName.trim();

        if (attrName === "") {
            rest = afterName;
            continue;
        }

        // React рендерит srcSet (camelCase) — нормализуем к HTML-имени srcset.
        if (attrName === "srcSet") {
            attrName = "srcset";
        }

        let value: unknown = null;
        if (afterName.startsWith('"')) {
            const close = afterName.slice(1).indexOf('"');
            if (close >= 0) {
                value = afterName.slice(1, 1 + close);
                rest = afterName.slice(close + 2).trim();
            } else {
                value = afterName.slice(1);
                rest = "";
            }
        } else if (afterName !== "") {
            const sp3 = afterName.indexOf(" ");
            if (sp3 >= 0) {
                value = afterName.slice(0, sp3);
                rest = afterName.slice(sp3 + 1).trim();
            } else {
                value = afterName;
                rest = "";
            }
        } else {
            value = null;
            rest = "";
        }
        attrs.push([attrName, value]);
    }
    return { name, attrs };
}

/** Сравнивает два списка атрибутов как мультимножества (порядок не важен). */
export function attrsEqual(a: Array<[string, unknown]>, b: Array<[string, unknown]>): boolean {
    if (a.length !== b.length) {
        return false;
    }
    const used: boolean[] = new Array(b.length).fill(false);
    for (const ka of a) {
        let found = false;
        for (let j = 0; j < b.length; j++) {
            if (used[j]) {
                continue;
            }
            const kb = b[j];
            if (ka[0] === kb[0] && attrValueEqual(ka[1], kb[1])) {
                used[j] = true;
                found = true;
                break;
            }
        }
        if (!found) {
            return false;
        }
    }
    return true;
}

/** Сравнивает значения атрибутов (null — атрибут без значения). */
export function attrValueEqual(a: unknown, b: unknown): boolean {
    if (a === null || b === null) {
        return a === null && b === null;
    }
    return String(a) === String(b);
}

/** Сравнивает HTML-строки: порядок тегов важен, порядок атрибутов — нет. */
export function htmlEqual(a: string, b: string): boolean {
    const ta = parseHtmlTags(a);
    const tb = parseHtmlTags(b);
    if (ta.length !== tb.length) {
        return false;
    }
    for (let i = 0; i < ta.length; i++) {
        if (ta[i].name !== tb[i].name || !attrsEqual(ta[i].attrs, tb[i].attrs)) {
            return false;
        }
    }
    return true;
}
