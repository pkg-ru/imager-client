/** Нормализация props фреймворк-компонентов (React/Vue/Twig).

Единая логика алиасов для всех фреймворк-обёрток:
- `src` → `source`;
- `preset` → `segment` (строка-пресет);
- `width`/`height` → сегмент-объект `{width, height}`;
- `format`/`formats`, `dpr`/`dprs` — как в ядре;
- остальные ключи — HTML-атрибуты (options для рендера).

Приоритет сегмента: `segment` > `preset` > `width`/`height`.
*/
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

/** Разворачивает алиасы props в вызов ядра. */
export function normalizeProps(props: ImagerComponentProps | null | undefined): NormalizedCall {
    const p = props && typeof props === "object" ? props : {};

    const source = p.source !== undefined ? String(p.source) : p.src !== undefined ? String(p.src) : "";

    // сегмент: segment > preset > width/height
    let segments: Segment | Segment[] | null = null;
    if (p.segment !== undefined && p.segment !== null) {
        segments = p.segment as Segment;
    } else if (p.preset !== undefined && p.preset !== null) {
        segments = String(p.preset);
    } else if (p.width !== undefined || p.height !== undefined) {
        const seg: { width?: number; height?: number } = {};
        if (p.width !== undefined && p.width !== null) {
            seg.width = Number(p.width);
        }
        if (p.height !== undefined && p.height !== null) {
            seg.height = Number(p.height);
        }
        segments = seg;
    }

    const formats = p.formats !== undefined ? p.formats : p.format !== undefined ? p.format : null;
    const dprs = p.dprs !== undefined ? p.dprs : p.dpr !== undefined ? p.dpr : null;

    // остаток — HTML-атрибуты
    const options: Record<string, unknown> = {};
    for (const key of Object.keys(p)) {
        if (!RESERVED.has(key)) {
            options[key] = p[key];
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
