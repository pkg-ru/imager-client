/*! @license
 * imager-client — клиент микросервиса Imager
 * Репозиторий: https://gitverse.ru/pkg-ru/imager-client (зеркало: https://github.com/pkg-ru/imager-client)
 * Автор: Vladislav Altukhov (https://altuh.ru/about)
 * Демо: https://altuh.ru/demo/imager
 */
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
export function buildSrcset(
    paths: AssetPath[],
    useWidth: boolean,
): string {
    const length = paths.length;

    let baseWidth = 0;
    let baseHeight = 0;

    // Первый проход нужен только для определения базовых размеров.
    for (let i = 0; i < length; i++) {
        const item = paths[i];

        if (
            baseWidth === 0 &&
            item.width !== undefined &&
            item.width > 0
        ) {
            baseWidth = item.width;
        }

        if (
            baseHeight === 0 &&
            item.height !== undefined &&
            item.height > 0
        ) {
            baseHeight = item.height;
        }

        if (baseWidth > 0 && baseHeight > 0) {
            break;
        }
    }

    let maxDpr = 0;
    let hasDpr = false;

    if (!useWidth) {
        for (let i = 0; i < length; i++) {
            const item = paths[i];

            if (
                item.dpr !== undefined &&
                item.dpr > 0
            ) {
                hasDpr = true;
            }

            if (
                (item.width === undefined || item.width <= 0) &&
                (item.height === undefined || item.height <= 0)
            ) {
                continue;
            }

            let dpr: number;

            if (item.dpr !== undefined && item.dpr > 0) {
                dpr = item.dpr;
            } else if (
                item.width !== undefined &&
                item.width > 0 &&
                baseWidth > 0
            ) {
                dpr = item.width / baseWidth;
            } else if (
                item.height !== undefined &&
                item.height > 0 &&
                baseHeight > 0
            ) {
                dpr = item.height / baseHeight;
            } else {
                continue;
            }

            if (dpr > maxDpr) {
                maxDpr = dpr;
            }
        }
    } else {
        for (let i = 0; i < length; i++) {
            const item = paths[i];

            if (
                item.width === undefined ||
                item.width <= 0
            ) {
                continue;
            }

            if (
                item.dpr !== undefined &&
                item.dpr > 0
            ) {
                hasDpr = true;
                break;
            }
        }
    }

    let result = "";
    let first = true;

    for (let i = 0; i < length; i++) {
        const item = paths[i];

        let descriptor: string;

        if (useWidth) {
            if (
                item.width === undefined ||
                item.width <= 0
            ) {
                continue;
            }

            descriptor = item.width + "w";
        } else if (
            item.dpr !== undefined &&
            item.dpr > 0 &&
            (
                (item.width !== undefined && item.width > 0) ||
                (item.height !== undefined && item.height > 0)
            )
        ) {
            descriptor = fmtDescriptor(item.dpr) + "x";
        } else if (
            baseHeight > 0 &&
            item.height !== undefined &&
            item.height > 0
        ) {
            descriptor =
                fmtDescriptor(item.height / baseHeight) + "x";
        } else if (
            baseWidth > 0 &&
            item.width !== undefined &&
            item.width > 0
        ) {
            descriptor =
                fmtDescriptor(item.width / baseWidth) + "x";
        } else if (
            (item.width === undefined || item.width <= 0) &&
            (item.height === undefined || item.height <= 0)
        ) {
            const dprStep =
                item.dpr !== undefined && item.dpr > 0
                    ? item.dpr
                    : 1;

            if (maxDpr > 0) {
                descriptor =
                    fmtDescriptor((maxDpr + 1) * dprStep) + "x";
            } else if (hasDpr) {
                descriptor =
                    fmtDescriptor(dprStep) + "x";
            } else {
                if (!first) {
                    result += ", ";
                }

                result += item.path;
                first = false;
                continue;
            }
        } else {
            descriptor = "1x";
        }

        if (!first) {
            result += ", ";
        }

        result += item.path + " " + descriptor;
        first = false;
    }

    return result;
}

/** Группа путей одного MIME-типа. */
export interface HtmlGroup {
    mime: string;
    paths: AssetPath[];
    sourceFormat: boolean;
    allSupport: boolean;
}

/** Группировка ассетов по типу (формату). */
export function groupAssets(
    assets: AssetType[],
): HtmlGroup[] {
    const length = assets.length;

    if (length === 0) {
        return [];
    }

    const groups: HtmlGroup[] = [];
    const byType = new Map<string, HtmlGroup>();

    for (let i = 0; i < length; i++) {
        const asset = assets[i];

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

        const assetPaths = asset.paths;
        const groupPaths = group.paths;

        for (let j = 0; j < assetPaths.length; j++) {
            groupPaths.push(assetPaths[j]);
        }

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
export function pickImgGroup(
    groups: HtmlGroup[],
): number {
    const length = groups.length;

    for (let i = 0; i < length; i++) {
        if (groups[i].sourceFormat) {
            return i;
        }
    }

    for (let i = 0; i < length; i++) {
        if (groups[i].allSupport) {
            return i;
        }
    }

    return length - 1;
}

export function splitAttrs(options: Record<string, unknown>): {
    imgAttrs: Record<string, unknown>;
    picAttrs: Record<string, unknown>;
} {
    const imgAttrs: Record<string, unknown> = {};
    const picAttrs: Record<string, unknown> = {};

    const explicit =
        options.imgAttrs !== null &&
        options.imgAttrs !== undefined &&
        typeof options.imgAttrs === "object"
            ? (options.imgAttrs as Record<string, unknown>)
            : null;

    const lazy =
        options.lazy === true;

    const keys = Object.keys(options);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (key === "imgAttrs" || key === "lazy") {
            continue;
        }

        let value = options[key];

        if (
            lazy &&
            key === "loading" &&
            (value === null || value === undefined)
        ) {
            value = "lazy";
        }

        if (IMG_ATTRS[key]) {
            imgAttrs[key] = value;
        } else {
            picAttrs[key] = value;
        }
    }

    if (
        lazy &&
        (
            options.loading === null ||
            options.loading === undefined
        )
    ) {
        imgAttrs.loading = "lazy";
    }

    if (explicit !== null) {
        const keysExplicit = Object.keys(explicit);

        for (let i = 0; i < keysExplicit.length; i++) {
            const key = keysExplicit[i];
            imgAttrs[key] = explicit[key];
        }
    }

    return {
        imgAttrs,
        picAttrs,
    };
}

/** true, если в options передан sizes (включая w-дескрипторы). */
export function useWidthDescriptors(options: Record<string, unknown>): boolean {
    return (
        "sizes" in options &&
        options.sizes !== null &&
        options.sizes !== undefined
    );
}
