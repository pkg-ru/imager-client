/** Общая render-логика <picture>/<source>/<img> из GetAssets().

Используется ядром (GetAssetsHtml) и фреймворк-пакетами (React/Vue),
чтобы поведение было идентичным: группировка по mime, выбор <img>-группы,
srcset-дескрипторы, разделение атрибутов img/picture.
*/
import { AssetPath, AssetType } from "./ImagerTypes";

/** Атрибуты, относящиеся к <img>, а не к <picture>. */
export const IMG_ATTRS: Record<string, boolean> = {
    alt: true,
    sizes: true,
    loading: true,
    width: true,
    height: true,
    decoding: true,
    fetchpriority: true,
};

/** Число → строка дескриптора: 1 → "1", 1.5 → "1.5" (без хвостовых нулей). */
export function fmtDescriptor(value: number): string {
    if (value === Math.trunc(value)) {
        return String(Math.trunc(value));
    }
    return String(Math.round(value * 100) / 100);
}

/** srcset для списка путей одного типа. */
export function buildSrcset(paths: AssetPath[], useWidth: boolean): string {
    let baseWidth = 0;
    let baseHeight = 0;
    for (const item of paths) {
        if (baseWidth === 0 && item.width !== undefined && item.width > 0) {
            baseWidth = item.width;
        }
        if (baseHeight === 0 && item.height !== undefined && item.height > 0) {
            baseHeight = item.height;
        }
    }
    const parts: string[] = [];
    for (const item of paths) {
        let desc: string;
        if (useWidth && item.width !== undefined && item.width > 0) {
            desc = item.width + "w";
        } else if (item.dpr !== undefined && item.dpr > 0) {
            desc = fmtDescriptor(item.dpr) + "x";
        } else if (baseHeight > 0 && item.height !== undefined && item.height > 0) {
            desc = fmtDescriptor(item.height / baseHeight) + "x";
        } else if (baseWidth > 0 && item.width !== undefined && item.width > 0) {
            desc = fmtDescriptor(item.width / baseWidth) + "x";
        } else {
            desc = "1x";
        }
        parts.push(item.path + " " + desc);
    }
    return parts.join(", ");
}

/** Группа путей одного MIME-типа. */
export interface HtmlGroup {
    mime: string;
    paths: AssetPath[];
    sourceFormat: boolean;
    allSupport: boolean;
}

/** Группировка ассетов по типу (формату). */
export function groupAssets(assets: AssetType[]): HtmlGroup[] {
    const groups: HtmlGroup[] = [];
    const byType = new Map<string, HtmlGroup>();
    for (const asset of assets) {
        let group = byType.get(asset.type);
        if (group === undefined) {
            group = {
                mime: asset.type,
                paths: [],
                sourceFormat: false,
                allSupport: false,
            };
            byType.set(asset.type, group);
            groups.push(group);
        }
        group.paths.push(...asset.paths);
        if (asset.source_format === true) {
            group.sourceFormat = true;
        }
        if (asset.all_support === true) {
            group.allSupport = true;
        }
    }
    return groups;
}

/** Индекс группы для <img>: source_format → all_support → последняя. */
export function pickImgGroup(groups: HtmlGroup[]): number {
    let imgIndex = -1;
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].sourceFormat) {
            imgIndex = i;
            break;
        }
    }
    if (imgIndex < 0) {
        for (let i = 0; i < groups.length; i++) {
            if (groups[i].allSupport) {
                imgIndex = i;
                break;
            }
        }
    }
    if (imgIndex < 0) {
        imgIndex = groups.length - 1;
    }
    return imgIndex;
}

/** Разделение атрибутов: img-атрибуты vs атрибуты <picture>.

`imgAttrs` в options — объект атрибутов, которые попадают именно на <img>.
Он объединяется с перенаправленными img-атрибутами (alt, sizes, loading,
width, height, decoding, fetchpriority), при этом `imgAttrs` имеет приоритет.
Сам ключ `imgAttrs` в <picture> не попадает.
*/
export function splitAttrs(
    options: Record<string, unknown>,
): { imgAttrs: Record<string, unknown>; picAttrs: Record<string, unknown> } {
    const imgOpts: Record<string, unknown> = { ...options };
    if (imgOpts["lazy"]) {
        if (imgOpts["loading"] === null || imgOpts["loading"] === undefined) {
            imgOpts["loading"] = "lazy";
        }
    }
    delete imgOpts["lazy"];

    // явные img-атрибуты (приоритет над перенаправленными)
    const explicit: Record<string, unknown> =
        imgOpts["imgAttrs"] !== null &&
        imgOpts["imgAttrs"] !== undefined &&
        typeof imgOpts["imgAttrs"] === "object"
            ? (imgOpts["imgAttrs"] as Record<string, unknown>)
            : {};
    delete imgOpts["imgAttrs"];

    const imgAttrs: Record<string, unknown> = {};
    const picAttrs: Record<string, unknown> = {};
    for (const key of Object.keys(imgOpts)) {
        if (IMG_ATTRS[key]) {
            imgAttrs[key] = imgOpts[key];
        } else {
            picAttrs[key] = imgOpts[key];
        }
    }
    // merge: перенаправленные + явные (явные имеют приоритет)
    for (const key of Object.keys(explicit)) {
        imgAttrs[key] = explicit[key];
    }
    return { imgAttrs, picAttrs };
}

/** true, если в options передан sizes (включая w-дескрипторы). */
export function useWidthDescriptors(options: Record<string, unknown>): boolean {
    return "sizes" in options && options["sizes"] !== null && options["sizes"] !== undefined;
}
