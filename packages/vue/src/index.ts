/*! @license
 * @pkg-ru/imager-vue — Vue 3-компоненты для микросервиса Imager
 * Репозиторий: https://gitverse.ru/pkg-ru/imager-client (зеркало: https://github.com/pkg-ru/imager-client)
 * Автор: Vladislav Altukhov (https://altuh.ru/about)
 * Демо: https://altuh.ru/demo/imager
 */
/** Vue 3-компоненты для микросервиса Imager.
 *
 * - ImagerPlugin — app.use(ImagerPlugin, {baseURL, format, dpr});
 * - ImagerProvider — компонент-провайдер;
 * - ImagerAssets — <picture> + <source> + <img>;
 * - ImagerAsset — один <img>.
 *
 * Рендер — нативные Vue-ноды (h()).
 */
import {
    App,
    InjectionKey,
    PropType,
    defineComponent,
    h,
    inject,
    provide,
} from "vue";
import { Imager, AssetPath, ImagerOptions } from "../../../src/imager-ts";
import { ImagerComponentProps, normalizeProps } from "../../../src/imager-ts";
import {
    buildSrcset,
    groupAssets,
    pickImgGroup,
    splitAttrs,
    useWidthDescriptors,
} from "../../../src/imager-ts";

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

/** Возвращает Imager из контекста. */
export function useInjectImager(): Imager | null {
    return inject(imagerKey, null);
}

/** Плагин. */
export const ImagerPlugin = {
    install(app: App, options?: ImagerOptions | null): void {
        app.provide(imagerKey, new Imager(options || {}));
    },
};

/** Провайдер. */
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

/** Record → Vue-атрибуты: true → "", false/null/undefined → пропуск. */
function toVueAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(attrs);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = attrs[key];

        if (value === false || value === null || value === undefined) {
            continue;
        }

        out[key] = value === true ? "" : value;
    }

    return out;
}

/** Собирает атрибуты <img>. */
function imgAttrs(
    paths: AssetPath[],
    extra: Record<string, unknown>,
    useWidth: boolean,
): Record<string, unknown> {
    const base = paths[0];
    const attrs: Record<string, unknown> = { src: base.path };
    const extraKeys = Object.keys(extra);

    for (let i = 0; i < extraKeys.length; i++) {
        const key = extraKeys[i];
        const value = extra[key];

        if (value === false || value === null || value === undefined) {
            continue;
        }

        attrs[key] = value === true ? "" : value;
    }

    if (paths.length > 1) {
        const srcset = buildSrcset(paths, useWidth);
        if (srcset !== "") {
            attrs.srcset = srcset;
        }
    }

    if (
        base.width !== undefined &&
        base.width > 0 &&
        (extra.width === undefined || extra.width === null)
    ) {
        attrs.width = base.width;
    }

    if (
        base.height !== undefined &&
        base.height > 0 &&
        (extra.height === undefined || extra.height === null)
    ) {
        attrs.height = base.height;
    }

    return attrs;
}

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
    alt: { type: String, default: undefined },
    sizes: { type: String, default: undefined },
    loading: { type: String, default: undefined },
    lazy: { type: Boolean, default: undefined },
    decoding: { type: String, default: undefined },
    fetchpriority: { type: String, default: undefined },
    imgAttrs: { type: Object as PropType<Record<string, unknown> | undefined>, default: undefined },
    class: { type: String, default: undefined },
    id: { type: String, default: undefined },
    style: { type: [String, Object], default: undefined },
};

const HTML_ATTR_KEYS = [
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
] as const;

/** Нормализованные значения для вызова ядра. */
function resolveCall(props: ImagerComponentProps) {
    return normalizeProps(props, { include: HTML_ATTR_KEYS });
}

/** <picture> + <source> + <img>. */
export const ImagerAssets = defineComponent({
    name: "ImagerAssets",
    props: baseProps,
    setup(props) {
        const ctx = inject(imagerKey, null);

        return () => {
            const imager = props.imager || ctx;
            if (!imager) {
                return null;
            }

            const call = resolveCall(props as unknown as ImagerComponentProps);
            const assets = imager.GetAssets(
                call.source,
                call.segments as never,
                call.formats as never,
                call.dprs as never,
            );

            if (assets.length === 0) {
                return null;
            }

            const options = call.options;
            const useWidth = useWidthDescriptors(options);
            const { imgAttrs: imgA, picAttrs } = splitAttrs(options);
            const groups = groupAssets(assets);
            const imgIndex = pickImgGroup(groups);
            const imgGroup = groups[imgIndex];
            const imgPaths = imgGroup.paths;
            const img = h("img", imgAttrs(imgPaths, imgA, useWidth));

            if (groups.length === 1) {
                return img;
            }

            const sources: ReturnType<typeof h>[] = [];

            for (let i = 0; i < groups.length; i++) {
                if (i === imgIndex) {
                    continue;
                }

                const group = groups[i];
                const srcset = buildSrcset(group.paths, useWidth);

                if (srcset === "") {
                    continue;
                }

                sources.push(
                    h("source", {
                        type: group.mime,
                        srcset,
                    }),
                );
            }

            return h("picture", toVueAttrs(picAttrs), [...sources, img]);
        };
    },
});

/** Один <img>. */
export const ImagerAsset = defineComponent({
    name: "ImagerAsset",
    props: baseProps,
    setup(props) {
        const ctx = inject(imagerKey, null);

        return () => {
            const imager = props.imager || ctx;
            if (!imager) {
                return null;
            }

            const call = resolveCall(props as unknown as ImagerComponentProps);
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

export default {
    ImagerPlugin,
    ImagerProvider,
    ImagerAssets,
    ImagerAsset,
    useInjectImager,
};
