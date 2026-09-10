/** React-компоненты для микросервиса Imager.

- ImagerPlugin — глобальная инициализация по умолчанию (как Vue ImagerPlugin);
- ImagerProvider — React Context с Imager-инстансом (локальный, приоритетнее глобального);
- ImagerAssets — <picture> + <source> + <img> из GetAssets();
- ImagerAsset — один <img> из GetAsset().

Пакет самодостаточен: ядро imager-client встроено (бандлится внутрь).
Рендер — нативные React-узлы (без dangerouslySetInnerHTML).
*/
import * as React from "react";
import { Imager, AssetPath, ImagerOptions } from "../../../src/imager-ts";
import { normalizeProps, ImagerComponentProps } from "../../../src/imager-ts";
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

const ImagerContext = React.createContext<Imager | null>(null);

/** Глобальный инстанс по умолчанию (задаётся ImagerPlugin.install). */
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
    const [inst] = React.useState<Imager | null>(() =>
        imager !== undefined && imager !== null ? imager : options ? new Imager(options) : null,
    );
    return <ImagerContext.Provider value={inst}>{children}</ImagerContext.Provider>;
}

/** Возвращает Imager: из контекста (ImagerProvider) или глобального (ImagerPlugin). */
export function useImager(): Imager | null {
    const ctx = React.useContext(ImagerContext);
    return ctx !== null ? ctx : globalImager;
}

/** HTML-имя атрибута → React-имя (class → className, for → htmlFor). */
function reactAttrName(name: string): string {
    if (name === "class") {
        return "className";
    }
    if (name === "for") {
        return "htmlFor";
    }
    return name;
}

/** Record<string, unknown> → React-атрибуты (className, htmlFor и т.д.). */
function toReactAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(attrs)) {
        const value = attrs[key];
        if (value === false || value === null || value === undefined) {
            continue;
        }
        const name = reactAttrName(key);
        out[name] = value === true ? "" : value;
    }
    return out;
}

/** Собирает <img> из группы путей (нативный React-узел). */
function buildImg(
    paths: AssetPath[],
    imgAttrs: Record<string, unknown>,
    useWidth: boolean,
): React.ReactElement {
    const base = paths[0];
    const attrs: Record<string, unknown> = {
        src: base.path,
        ...toReactAttrs(imgAttrs),
    };
    if (paths.length > 1) {
        attrs.srcSet = buildSrcset(paths, useWidth);
    }
    if (base.width !== undefined && base.width > 0) {
        attrs.width = base.width;
    }
    if (base.height !== undefined && base.height > 0) {
        attrs.height = base.height;
    }
    return React.createElement("img", attrs);
}

/** <picture> + <source> + <img> из GetAssets(). */
export function ImagerAssets({ imager, ...props }: { imager?: Imager | null } & ImagerComponentProps) {
    const ctx = useImager();
    const inst = imager !== undefined && imager !== null ? imager : ctx;
    if (inst === null) {
        return null;
    }
    const call = normalizeProps(props);
    const assets = inst.GetAssets(call.source, call.segments, call.formats, call.dprs);
    if (assets.length === 0) {
        return null;
    }
    const useWidth = useWidthDescriptors(call.options);
    const { imgAttrs, picAttrs } = splitAttrs(call.options);
    const groups = groupAssets(assets);
    const imgIndex = pickImgGroup(groups);
    const imgPaths = groups[imgIndex].paths;
    const img = buildImg(imgPaths, imgAttrs, useWidth);

    if (groups.length === 1) {
        return img;
    }

    const sources: React.ReactElement[] = [];
    for (let i = 0; i < groups.length; i++) {
        if (i === imgIndex) {
            continue;
        }
        const group = groups[i];
        const sourceAttrs: Record<string, unknown> = { type: group.mime };
        if (group.paths.length > 1) {
            sourceAttrs.srcSet = buildSrcset(group.paths, useWidth);
        } else {
            sourceAttrs.src = group.paths[0].path;
        }
        sources.push(React.createElement("source", sourceAttrs));
    }

    return React.createElement(
        "picture",
        toReactAttrs(picAttrs),
        ...sources,
        img,
    );
}

/** Один <img> из GetAsset(). */
export function ImagerAsset({ imager, ...props }: { imager?: Imager | null } & ImagerComponentProps) {
    const ctx = useImager();
    const inst = imager !== undefined && imager !== null ? imager : ctx;
    if (inst === null) {
        return null;
    }
    const call = normalizeProps(props);
    const asset = inst.GetAsset(
        call.source,
        call.segments as never,
        call.formats as string,
        call.dprs as number | string,
    );
    if (asset === null || asset === undefined) {
        return null;
    }
    const useWidth = useWidthDescriptors(call.options);
    const { imgAttrs } = splitAttrs(call.options);
    return buildImg(asset.paths, imgAttrs, useWidth);
}

export default { ImagerPlugin, ImagerProvider, ImagerAssets, ImagerAsset, useImager };
