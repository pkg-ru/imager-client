/** Vue 3-компоненты для микросервиса Imager.

- ImagerPlugin — app.use(ImagerPlugin, {baseURL, format, dpr}) — провайдер по умолчанию;
- ImagerProvider — компонент-провайдер с imager-инстансом;
- ImagerAssets — <picture> + <source> + <img> из GetAssets();
- ImagerAsset — один <img> из GetAsset().

Рендер — нативные Vue-ноды (h()).
*/
import {
    App,
    InjectionKey,
    PropType,
    computed,
    defineComponent,
    h,
    inject,
    provide,
} from "vue";
import { Imager, AssetPath, ImagerOptions, normalizeProps } from "../../../src/imager-ts";
import {
    buildSrcset,
    groupAssets,
    pickImgGroup,
    splitAttrs,
    useWidthDescriptors,
} from "../../../src/imager-ts";

// Re-export ядра: пакет самодостаточен, но можно использовать и свой инстанс
// (например, ImagerServer с админ-методами) — типы совместимы.
export {
    Imager,
    AssetPath,
    AssetType,
    ImagerOptions,
    ImagerComponentProps,
    NormalizedCall,
    Segment,
    mimeFor,
    normalizeProps,
    IMG_ATTRS,
    HtmlGroup,
    buildSrcset,
    fmtDescriptor,
    groupAssets,
    pickImgGroup,
    splitAttrs,
    useWidthDescriptors,
} from "../../../src/imager-ts";

/** InjectionKey для Imager-инстанса. */
export const imagerKey: InjectionKey<Imager> = Symbol("imager");

/** useInjectImager: возвращает Imager из контекста (или null). */
export function useInjectImager(): Imager | null {
    return inject(imagerKey, null);
}

/** Плагин: app.use(ImagerPlugin, { baseURL, format, dpr }) — провайдер по умолчанию. */
export const ImagerPlugin = {
    install(app: App, options?: ImagerOptions | null): void {
        app.provide(imagerKey, new Imager(options || {}));
    },
};

/** Провайдер: <ImagerProvider :imager="imager">...</ImagerProvider> */
export const ImagerProvider = defineComponent({
    name: "ImagerProvider",
    props: {
        imager: {
            type: Object as PropType<Imager>,
            required: true,
        },
    },
    setup(props, { slots }) {
        provide(imagerKey, props.imager);
        return () => (slots.default ? slots.default() : null);
    },
});

/** Record → Vue-атрибуты: true → пустая строка, false/null/undefined → пропуск. */
function toVueAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(attrs)) {
        const value = attrs[key];
        if (value === false || value === null || value === undefined) {
            continue;
        }
        out[key] = value === true ? "" : value;
    }
    return out;
}

/** Собирает img-атрибуты из группы путей. */
function imgAttrs(
    paths: AssetPath[],
    extra: Record<string, unknown>,
    useWidth: boolean,
): Record<string, unknown> {
    const base = paths[0];
    const attrs: Record<string, unknown> = {
        src: base.path,
        ...toVueAttrs(extra),
    };
    if (paths.length > 1) {
        attrs.srcset = buildSrcset(paths, useWidth);
    }
    // width/height для CLS из базового path — только если пользователь
    // не задал свои (напрямую или через imgAttrs): без дублирования.
    if (
        base.width !== undefined &&
        base.width > 0 &&
        (extra["width"] === undefined || extra["width"] === null)
    ) {
        attrs.width = base.width;
    }
    if (
        base.height !== undefined &&
        base.height > 0 &&
        (extra["height"] === undefined || extra["height"] === null)
    ) {
        attrs.height = base.height;
    }
    return attrs;
}

/** Базовые props для ImagerAssets/ImagerAsset.

HTML-атрибуты объявлены явно, чтобы Vue не применял их автоматически
к корневому элементу <picture> (fallthrough-поведение single-root).
*/
const baseProps = {
    imager: { type: Object as PropType<Imager | null>, default: null },
    src: { type: String, default: undefined },
    source: { type: String, default: undefined },
    segment: { type: [String, Object, Array] as PropType<unknown>, default: undefined },
    preset: { type: String, default: undefined },
    width: { type: [Number, String], default: undefined },
    height: { type: [Number, String], default: undefined },
    format: { type: String, default: undefined },
    formats: { type: [String, Array] as PropType<string | string[] | undefined>, default: undefined },
    dpr: { type: [Number, String], default: undefined },
    dprs: { type: [Number, String], default: undefined },
    // img-атрибуты
    alt: { type: String, default: undefined },
    sizes: { type: String, default: undefined },
    loading: { type: String, default: undefined },
    lazy: { type: Boolean, default: undefined },
    decoding: { type: String, default: undefined },
    fetchpriority: { type: String, default: undefined },
    // явные img-атрибуты (приоритет над перенаправленными)
    imgAttrs: { type: Object as PropType<Record<string, unknown> | undefined>, default: undefined },
    // picture-атрибуты
    class: { type: String, default: undefined },
    id: { type: String, default: undefined },
    style: { type: [String, Object], default: undefined },
};

/** Собирает HTML-атрибуты из props (alt, sizes, loading, lazy, decoding, fetchpriority, imgAttrs, class, id, style). */
function htmlAttrsFromProps(props: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of [
        "alt",
        "sizes",
        "loading",
        "lazy",
        "decoding",
        "fetchpriority",
        "imgAttrs",
        "class",
        "id",
        "style",
    ]) {
        if (props[key] !== undefined && props[key] !== null) {
            out[key] = props[key];
        }
    }
    return out;
}

/** <picture> + <source> + <img> из GetAssets(). */
export const ImagerAssets = defineComponent({
    name: "ImagerAssets",
    props: baseProps,
    setup(props) {
        const ctx = inject(imagerKey, null);
        const inst = computed(() => (props.imager ? props.imager : ctx));
        return () => {
            const imager = inst.value;
            if (!imager) {
                return null;
            }
            const call = normalizeProps({
                source: props.source,
                src: props.src,
                segment: props.segment as never,
                preset: props.preset,
                width: props.width,
                height: props.height,
                format: props.format,
                formats: props.formats,
                dpr: props.dpr,
                dprs: props.dprs,
                ...htmlAttrsFromProps(props),
            } as never);
            const assets = imager.GetAssets(call.source, call.segments, call.formats, call.dprs);
            if (assets.length === 0) {
                return null;
            }
            const useWidth = useWidthDescriptors(call.options);
            const { imgAttrs: imgA, picAttrs } = splitAttrs(call.options);
            const groups = groupAssets(assets);
            const imgIndex = pickImgGroup(groups);
            const imgPaths = groups[imgIndex].paths;
            const img = h("img", imgAttrs(imgPaths, imgA, useWidth));

            if (groups.length === 1) {
                return img;
            }

            const sources = groups
                .map((group, i) => {
                    if (i === imgIndex) {
                        return null;
                    }
                    const sourceAttrs: Record<string, unknown> = { type: group.mime };
                    if (group.paths.length > 1) {
                        sourceAttrs.srcset = buildSrcset(group.paths, useWidth);
                    } else {
                        sourceAttrs.src = group.paths[0].path;
                    }
                    return h("source", sourceAttrs);
                })
                .filter((x) => x !== null);

            return h("picture", toVueAttrs(picAttrs), [...sources, img]);
        };
    },
});

/** Один <img> из GetAsset(). */
export const ImagerAsset = defineComponent({
    name: "ImagerAsset",
    props: baseProps,
    setup(props) {
        const ctx = inject(imagerKey, null);
        const inst = computed(() => (props.imager ? props.imager : ctx));
        return () => {
            const imager = inst.value;
            if (!imager) {
                return null;
            }
            const call = normalizeProps({
                source: props.source,
                src: props.src,
                segment: props.segment as never,
                preset: props.preset,
                width: props.width,
                height: props.height,
                format: props.format,
                formats: props.formats,
                dpr: props.dpr,
                dprs: props.dprs,
                ...htmlAttrsFromProps(props),
            } as never);
            const asset = imager.GetAsset(
                call.source,
                call.segments as never,
                call.formats as string,
                call.dprs as number | string,
            );
            if (!asset) {
                return null;
            }
            const useWidth = useWidthDescriptors(call.options);
            const { imgAttrs: imgA } = splitAttrs(call.options);
            return h("img", imgAttrs(asset.paths, imgA, useWidth));
        };
    },
});

export default { ImagerPlugin, ImagerProvider, ImagerAssets, ImagerAsset, useInjectImager };
