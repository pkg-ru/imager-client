/*! @license
 * imager-client — клиент микросервиса Imager
 * Репозиторий: https://gitverse.ru/pkg-ru/imager-client (зеркало: https://github.com/pkg-ru/imager-client)
 * Автор: Vladislav Altukhov (https://altuh.ru/about)
 * Демо: https://altuh.ru/demo/imager
 */
/** Нормализация props фреймворк-компонентов (React/Vue/Twig). */

import { Segment } from "./ImagerTypes";

/** Props компонента ImagerAssets/ImagerAsset. */
export interface ImagerComponentProps {
    source?: string;
    src?: string;
    segment?: Segment;
    preset?: string;
    width?: number | string;
    height?: number | string;
    format?: string;
    formats?: string | string[];
    dpr?: number | string;
    dprs?: number | string;
    /** Атрибуты, попадающие именно на <img> (приоритет над перенаправленными). */
    imgAttrs?: Record<string, unknown>;
    [attr: string]: unknown;
}

/** Нормализованный вызов ядра. */
export interface NormalizedCall {
    source: string;
    segments?: Segment | Segment[] | null;
    formats?: string | string[] | null;
    dprs?: number | string | null;
    options: Record<string, unknown>;
}

/** Ключи, которые не являются HTML-атрибутами. */
const RESERVED = new Set([
    "source",
    "src",
    "segment",
    "preset",
    "width",
    "height",
    "format",
    "formats",
    "dpr",
    "dprs",
    "imager",
]);

/** Опции нормализации props. */
export interface NormalizePropsOptions {
    /** Белый список ключей для options. Если задан — в options попадают только эти ключи (с фильтрацией null/undefined). Если не задан — чёрный список RESERVED (текущее поведение). */
    include?: readonly string[];
}

export function normalizeProps(
    props: ImagerComponentProps | null | undefined,
    opts?: NormalizePropsOptions,
): NormalizedCall {
    const p =
        props && typeof props === "object"
            ? props
            : ({} as ImagerComponentProps);

    const source =
        p.source !== undefined
            ? String(p.source)
            : p.src !== undefined
              ? String(p.src)
              : "";

    let segments: Segment | Segment[] | null = null;

    if (p.segment !== undefined && p.segment !== null) {
        segments = p.segment;
    } else if (p.preset !== undefined && p.preset !== null) {
        segments = String(p.preset);
    } else if (p.width !== undefined || p.height !== undefined) {
        const segment: { width?: number; height?: number } = {};

        if (p.width !== undefined && p.width !== null) {
            segment.width = Number(p.width);
        }

        if (p.height !== undefined && p.height !== null) {
            segment.height = Number(p.height);
        }

        segments = segment;
    }

    const formats =
        p.formats !== undefined
            ? p.formats
            : p.format !== undefined
              ? p.format
              : null;

    const dprs =
        p.dprs !== undefined
            ? p.dprs
            : p.dpr !== undefined
              ? p.dpr
              : null;

    const options: Record<string, unknown> = {};

    if (opts && opts.include) {
        const include = opts.include;

        for (let i = 0; i < include.length; i++) {
            const key = include[i];
            const value = p[key];

            if (value !== undefined && value !== null) {
                options[key] = value;
            }
        }
    } else {
        const keys = Object.keys(p);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            if (!RESERVED.has(key)) {
                options[key] = p[key];
            }
        }
    }

    return {
        source,
        segments,
        formats: formats as string | string[] | null,
        dprs: dprs as number | string | null,
        options,
    };
}
