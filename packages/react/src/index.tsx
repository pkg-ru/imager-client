/*! @license
 * @pkg-ru/imager-react — React-компоненты для микросервиса Imager
 * Репозиторий: https://gitverse.ru/pkg-ru/imager-client (зеркало: https://github.com/pkg-ru/imager-client)
 * Автор: Vladislav Altukhov (https://altuh.ru/about)
 * Демо: https://altuh.ru/demo/imager
 */
/** React-компоненты для микросервиса Imager.
 *
 * - ImagerPlugin — глобальная инициализация по умолчанию;
 * - ImagerProvider — React Context;
 * - ImagerAssets — <picture> + <source> + <img>;
 * - ImagerAsset — один <img>.
 *
 * Пакет самодостаточен: ядро imager-client встроено.
 * Рендер — нативные React-узлы.
 */
import * as React from "react";
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

const ImagerContext = React.createContext<Imager | null>(null);

/** Глобальный инстанс по умолчанию. */
let globalImager: Imager | null = null;

/** Плагин: ImagerPlugin.install({ baseURL, format, dpr }) — глобальная инициализация.

После вызова компоненты ImagerAssets/ImagerAsset работают без ImagerProvider.
Можно передать и готовый инстанс: ImagerPlugin.install({ imager }).
*/
export const ImagerPlugin = {
    install(options?: ImagerOptions | null): void {
        globalImager = new Imager(options || {});
    },
    set(imager: Imager): void {
        globalImager = imager;
    },
};

/** Провайдер: задаёт Imager-инстанс (baseURL, format, dpr по умолчанию).

Два способа:
- `imager` — готовый инстанс (приоритет);
- `options` — настройки, из которых инстанс создаётся один раз.

Если провайдер не задан — используется глобальный инстанс из ImagerPlugin.install.
*/
export function ImagerProvider({
    imager,
    options,
    children,
}: {
    imager?: Imager | null;
    options?: ImagerOptions | null;
    children?: React.ReactNode;
}) {
    const instRef = React.useRef<Imager | null>(null);

    if (instRef.current === null) {
        instRef.current =
            imager !== undefined && imager !== null
                ? imager
                : options
                  ? new Imager(options)
                  : null;
    }

    return (
        <ImagerContext.Provider value={instRef.current}>
            {children}
        </ImagerContext.Provider>
    );
}

/** Возвращает Imager: Provider → global. */
export function useImager(): Imager | null {
    const ctx = React.useContext(ImagerContext);
    return ctx !== null ? ctx : globalImager;
}

/** HTML-имя атрибута → React-имя. */
function reactAttrName(name: string): string {
    if (name === "class") {
        return "className";
    }
    if (name === "for") {
        return "htmlFor";
    }
    return name;
}

/** Record → React-атрибуты. */
function toReactAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(attrs);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = attrs[key];

        if (value === false || value === null || value === undefined) {
            continue;
        }

        out[reactAttrName(key)] = value === true ? "" : value;
    }

    return out;
}

/** Собирает <img>. */
function buildImg(
    paths: AssetPath[],
    imgAttrs: Record<string, unknown>,
    useWidth: boolean,
): React.ReactElement {
    const base = paths[0];
    const attrs: Record<string, unknown> = {
        src: base.path,
    };

    const keys = Object.keys(imgAttrs);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = imgAttrs[key];

        if (value === false || value === null || value === undefined) {
            continue;
        }

        attrs[reactAttrName(key)] = value === true ? "" : value;
    }

    if (paths.length > 1) {
        const srcset = buildSrcset(paths, useWidth);

        if (srcset !== "") {
            attrs.srcSet = srcset;
        }
    }

    if (
        base.width !== undefined &&
        base.width > 0 &&
        (imgAttrs.width === undefined || imgAttrs.width === null)
    ) {
        attrs.width = base.width;
    }

    if (
        base.height !== undefined &&
        base.height > 0 &&
        (imgAttrs.height === undefined || imgAttrs.height === null)
    ) {
        attrs.height = base.height;
    }

    return React.createElement("img", attrs);
}

/** Белый список HTML-атрибутов, попадающих в options. */
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

/** <picture> + <source> + <img>. */
export function ImagerAssets({ imager, ...props }: { imager?: Imager | null } & ImagerComponentProps) {
    const ctx = useImager();
    const inst = imager !== undefined && imager !== null ? imager : ctx;

    if (inst === null) {
        return null;
    }

    const call = normalizeProps(props, { include: HTML_ATTR_KEYS });
    const assets = inst.GetAssets(
        call.source,
        call.segments as never,
        call.formats as never,
        call.dprs as never,
    );

    if (assets.length === 0) {
        return null;
    }

    const useWidth =
        useWidthDescriptors(call.options);

    const {
        imgAttrs,
        picAttrs,
    } = splitAttrs(call.options);

    const groups = groupAssets(assets);
    const imgIndex = pickImgGroup(groups);
    const imgPaths = groups[imgIndex].paths;
    const img = buildImg(
        imgPaths,
        imgAttrs,
        useWidth,
    );

    if (groups.length === 1) {
        return img;
    }

    const sources: React.ReactElement[] = [];

    for (let i = 0; i < groups.length; i++) {
        if (i === imgIndex) {
            continue;
        }

        const group = groups[i];
        const srcset = buildSrcset(
            group.paths,
            useWidth,
        );

        if (srcset === "") {
            continue;
        }

        sources.push(
            React.createElement(
                "source",
                {
                    type: group.mime,
                    srcSet: srcset,
                },
            ),
        );
    }

    const pictureAttrs =
        toReactAttrs(picAttrs);

    return React.createElement(
        "picture",
        pictureAttrs,
        ...sources,
        img,
    );
}

/** Один <img>. */
export function ImagerAsset({
    imager,
    ...props
}: { imager?: Imager | null } & ImagerComponentProps) {
    const ctx = useImager();
    const inst =
        imager !== undefined && imager !== null
            ? imager
            : ctx;

    if (inst === null) {
        return null;
    }

    const call = normalizeProps(props, { include: HTML_ATTR_KEYS });
    const asset = inst.GetAsset(
        call.source,
        call.segments as never,
        call.formats as string,
        call.dprs as number | string,
    );

    if (asset === null || asset === undefined) {
        return null;
    }

    const useWidth =
        useWidthDescriptors(call.options);

    const { imgAttrs } =
        splitAttrs(call.options);

    return buildImg(
        asset.paths,
        imgAttrs,
        useWidth,
    );
}

export default {
    ImagerPlugin,
    ImagerProvider,
    ImagerAssets,
    ImagerAsset,
    useImager,
};
