/*! @license
 * imager-client — клиент микросервиса Imager
 * Репозиторий: https://gitverse.ru/pkg-ru/imager-client (зеркало: https://github.com/pkg-ru/imager-client)
 * Автор: Vladislav Altukhov (https://altuh.ru/about)
 * Демо: https://altuh.ru/demo/imager
 */
/** Класс Imager — клиент микросервиса imager (TypeScript, клиентская часть).

Клиентская часть (GetAsset/GetAssets/GetAssetPath) — чистое построение
путей/URL без HTTP, без валидации и исключений, только конкатенация строк.

Здесь нет служебных полей аутентификации и админ-методов: они живут
только в серверной части (src/imager-ts-server/ImagerServer.ts), чтобы
секреты не попадали в браузерную сборку.
*/
import {
    AssetType,
    AssetPath,
    ImagerOptions,
    Segment,
    mimeFor,
    resolveFormat,
    dedupeFormats,
    normalizeFormat,
} from "./ImagerTypes";

import {
    buildSrcset,
    groupAssets,
    pickImgGroup,
    splitAttrs,
    useWidthDescriptors,
} from "./render";

/** Сегмент-объект с необязательными размерами. */
interface SizeSegment {
    width?: number;
    height?: number;
}

type SegmentValue =
    | Segment
    | SizeSegment
    | null
    | undefined;

/** Внутренний mutable context нормализации сегмента (без аллокаций). */
interface SegCtx {
    segStr: string;
    isSize: boolean;
    width: number;
    height: number;
}

export class Imager {
    protected _dpr: number;
    protected _format: string;
    protected _formats: string[];
    protected _baseURL: string;

    // одноэлементный кэш последнего source: (source, prefix, sourceFormat)
    protected _lastSource: unknown = null;
    protected _lastPrefix = "";
    protected _lastSourceFormat = "";
    private _srcCached = false;

    private _segCtx: SegCtx = {
        segStr: "x",
        isSize: true,
        width: 0,
        height: 0,
    };

    constructor(options?: ImagerOptions | null) {
        const o =
            options && typeof options === "object"
                ? options
                : {};

        this._dpr = Imager._parseDpr(o.dpr === undefined ? 0 : o.dpr);

        this._format =
            o.format === null || o.format === undefined
                ? ""
                : String(o.format);

        this._formats =
            Array.isArray(o.formats)
                ? o.formats.map(String)
                : [];

        const base =
            o.baseURL === undefined || o.baseURL === null
                ? ""
                : String(o.baseURL);

        this._baseURL =
            base === ""
                ? "/"
                : base.endsWith("/")
                  ? base
                  : base + "/";
    }

    private static _toInt(value: unknown): number {
        if (typeof value === "number") {
            return Number.isFinite(value)
                ? Math.trunc(value)
                : 0;
        }

        if (typeof value === "string") {
            const len = value.length;
            let i = 0;

            while (i < len) {
                const c = value.charCodeAt(i);

                if (
                    c === 32 ||
                    c === 9 ||
                    c === 10 ||
                    c === 11 ||
                    c === 12 ||
                    c === 13
                ) {
                    i++;
                    continue;
                }

                break;
            }

            let sign = 1;

            if (i < len) {
                const c = value.charCodeAt(i);

                if (c === 43 || c === 45) {
                    if (c === 45) {
                        sign = -1;
                    }

                    i++;
                }
            }

            if (i >= len) {
                return 0;
            }

            let number = 0;
            const start = i;

            while (i < len) {
                const c = value.charCodeAt(i);

                if (c >= 48 && c <= 57) {
                    number = number * 10 + c - 48;
                    i++;
                } else {
                    break;
                }
            }

            if (i === start) {
                return 0;
            }

            while (i < len) {
                const c = value.charCodeAt(i);

                if (
                    c === 32 ||
                    c === 9 ||
                    c === 10 ||
                    c === 11 ||
                    c === 12 ||
                    c === 13
                ) {
                    i++;
                    continue;
                }

                return 0;
            }

            return sign < 0
                ? number === 0
                    ? 0
                    : -number
                : number;
        }

        if (typeof value === "boolean") {
            return value ? 1 : 0;
        }

        return 0;
    }

    private static _parseDpr(dpr: unknown): number {
        const number = Imager._toInt(dpr);

        if (number < 1) {
            return 0;
        }

        if (number > 3) {
            return 3;
        }

        return number;
    }

    protected _resolveDpr(dpr: number | string | null | undefined): number {
        if (dpr === null || dpr === undefined) {
            return this._dpr;
        }

        return Imager._parseDpr(dpr);
    }

    protected _updateSource(source: unknown): void {
        if (
            this._srcCached &&
            source === this._lastSource
        ) {
            return;
        }

        let value =
            source === null || source === undefined
                ? ""
                : String(source);

        let start = 0;
        const length = value.length;

        while (start < length && value.charCodeAt(start) === 47) {
            start++;
        }

        if (start > 0) {
            value = value.slice(start);
        }

        const slash = value.lastIndexOf("/");

        let path = "";
        let file = value;

        if (slash >= 0) {
            path = value.slice(0, slash);
            file = value.slice(slash + 1);
        }

        const dot = file.lastIndexOf(".");

        let sourceName: string;
        let sourceFormat: string;

        if (dot >= 0) {
            sourceName = file.slice(0, dot);
            sourceFormat = file
                .slice(dot + 1)
                .toLowerCase();
        } else {
            sourceName = file;
            sourceFormat = "";
        }

        const name =
            sourceFormat !== ""
                ? sourceName + "-" + sourceFormat
                : sourceName;

        const prefix =
            path !== ""
                ? this._baseURL +
                  path +
                  "/" +
                  name +
                  "/"
                : this._baseURL +
                  name +
                  "/";

        this._lastSource = source;
        this._lastSourceFormat = sourceFormat;
        this._lastPrefix = prefix;
        this._srcCached = true;
    }

    private static _buildSize(width: number, height: number): string {
        if (width > 0) {
            if (height > 0) {
                return (String(width) + "x" + String(height));
            }

            return String(width) + "x";
        }

        if (height > 0) {
            return "x" + String(height);
        }

        return "x";
    }

    protected _parseSegment(segment: SegmentValue): SegCtx {
        const ctx = this._segCtx;

        if (
            segment === null ||
            segment === undefined
        ) {
            ctx.segStr = "x";
            ctx.isSize = true;
            ctx.width = 0;
            ctx.height = 0;
            return ctx;
        }

        if (typeof segment === "string") {
            const length = segment.length;

            let xIndex = -1;

            for (let i = 0; i < length; i++) {
                if (segment.charCodeAt(i) === 120) {
                    xIndex = i;
                    break;
                }
            }

            if (xIndex < 0) {
                ctx.segStr = segment;
                ctx.isSize = false;
                ctx.width = 0;
                ctx.height = 0;
                return ctx;
            }

            let width = 0;

            for (let i = 0; i < xIndex; i++) {
                const c = segment.charCodeAt(i);

                if (c < 48 || c > 57) {
                    ctx.segStr = segment;
                    ctx.isSize = false;
                    ctx.width = 0;
                    ctx.height = 0;
                    return ctx;
                }

                width = width * 10 + c - 48;
            }

            let height = 0;

            for (let i = xIndex + 1; i < length; i++) {
                const c = segment.charCodeAt(i);

                if (c < 48 || c > 57) {
                    ctx.segStr = segment;
                    ctx.isSize = false;
                    ctx.width = 0;
                    ctx.height = 0;
                    return ctx;
                }

                height = height * 10 + c - 48;
            }

            ctx.segStr = segment;
            ctx.isSize = true;
            ctx.width = width;
            ctx.height = height;

            return ctx;
        }

        if (typeof segment === "object") {
            let width = 0;
            let height = 0;

            if (Array.isArray(segment)) {
                const first = segment[0];
                const second = segment[1];

                width =
                    first === null ||
                    first === undefined
                        ? 0
                        : Imager._toInt(first);

                height =
                    second === null ||
                    second === undefined
                        ? 0
                        : Imager._toInt(second);
            } else {
                const value =
                    segment as SizeSegment;

                width =
                    value.width === null ||
                    value.width === undefined
                        ? 0
                        : Imager._toInt(value.width);

                height =
                    value.height === null ||
                    value.height === undefined
                        ? 0
                        : Imager._toInt(value.height);
            }

            ctx.segStr = Imager._buildSize(width, height);
            ctx.isSize = true;
            ctx.width = width;
            ctx.height = height;

            return ctx;
        }

        ctx.segStr = "x";
        ctx.isSize = true;
        ctx.width = 0;
        ctx.height = 0;

        return ctx;
    }

    protected _segmentString(
        segment: SegmentValue,
    ): string {
        if (
            segment === null ||
            segment === undefined
        ) {
            return "x";
        }

        if (typeof segment === "string") {
            return segment;
        }

        if (typeof segment === "object") {
            let width = 0;
            let height = 0;

            if (Array.isArray(segment)) {
                const first = segment[0];
                const second = segment[1];

                width =
                    first === null ||
                    first === undefined
                        ? 0
                        : Imager._toInt(first);

                height =
                    second === null ||
                    second === undefined
                        ? 0
                        : Imager._toInt(second);
            } else {
                const value =
                    segment as SizeSegment;

                width =
                    value.width === null ||
                    value.width === undefined
                        ? 0
                        : Imager._toInt(value.width);

                height =
                    value.height === null ||
                    value.height === undefined
                        ? 0
                        : Imager._toInt(value.height);
            }

            return Imager._buildSize(width, height);
        }

        return "x";
    }

    private static _htmlEscape(value: unknown): string {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;");
    }

    private static _renderAttrs(attrs: Record<string, unknown>): string {
        const keys = Object.keys(attrs);

        let result = "";

        for (let i = 0; i < keys.length; i++) {
            const name = keys[i];
            const value = attrs[name];

            if (value === true) {
                result += " " + name;
            } else if (
                value === false ||
                value === null ||
                value === undefined
            ) {
                continue;
            } else {
                result +=
                    " " +
                    name +
                    '="' +
                    Imager._htmlEscape(value) +
                    '"';
            }
        }

        return result;
    }

    GetAsset(
        source: string,
        segment?: Segment | null,
        format?: string | null,
        dpr?: number | string | null,
    ): AssetType {
        this._updateSource(source);

        const prefix = this._lastPrefix;
        const sourceFormat =
            this._lastSourceFormat;

        const ctx =
            this._parseSegment(segment);

        let outFormat =
            format !== null &&
            format !== undefined &&
            format !== ""
                ? format
                : this._format;

        outFormat = resolveFormat(outFormat, sourceFormat);

        const dprValue =
            this._resolveDpr(dpr);

        let path: AssetPath;

        if (dprValue >= 2) {
            path = {
                path:
                    prefix +
                    ctx.segStr +
                    "@" +
                    dprValue +
                    "." +
                    outFormat,
                dpr: dprValue,
            };
        } else {
            path = {
                path:
                    prefix +
                    ctx.segStr +
                    "." +
                    outFormat,
            };
        }

        if (
            ctx.isSize &&
            ctx.width > 0
        ) {
            path.width =
                dprValue >= 2
                    ? ctx.width * dprValue
                    : ctx.width;
        }

        if (
            ctx.isSize &&
            ctx.height > 0
        ) {
            path.height =
                dprValue >= 2
                    ? ctx.height * dprValue
                    : ctx.height;
        }

        const asset: AssetType = {
            type: mimeFor(outFormat),
            paths: [path],
        };

        if (normalizeFormat(outFormat) === normalizeFormat(sourceFormat)) {
            asset.source_format = true;
        }

        if (
            outFormat === "jpg" ||
            outFormat === "jpeg" ||
            outFormat === "gif" ||
            outFormat === "png"
        ) {
            asset.all_support = true;
        }

        return asset;
    }

    GetAssets(
        source: string,
        segments?: Segment | Segment[] | null,
        formats?: string | string[] | null,
        dprs?: number | string | null,
    ): AssetType[] {
        this._updateSource(source);

        const prefix = this._lastPrefix;
        const sourceFormat =
            this._lastSourceFormat;

        let fmtList: string[];

        if (
            formats === null ||
            formats === undefined
        ) {
            if (this._formats.length > 0) {
                fmtList = this._formats;
            } else if (this._format !== "") {
                fmtList = [this._format];
            } else {
                fmtList = [""];
            }
        } else if (
            typeof formats === "string"
        ) {
            fmtList =
                formats !== ""
                    ? [formats]
                    : [];
        } else {
            const sourceFormats =
                formats as string[];

            const length =
                sourceFormats.length;

            const list =
                new Array<string>(length);

            for (let i = 0; i < length; i++) {
                list[i] = String(sourceFormats[i]);
            }

            fmtList = list;
        }

        if (fmtList.length === 0) {
            if (this._formats.length > 0) {
                fmtList = this._formats;
            } else if (this._format !== "") {
                fmtList = [this._format];
            } else {
                fmtList = [""];
            }
        }

        fmtList = dedupeFormats(
            fmtList.map((f) => resolveFormat(f, sourceFormat)),
        );

        const dprValue = this._resolveDpr(dprs);

        const explicit =
            (dprs !== null && dprs !== undefined) ||
            this._dpr > 0;

        let maxSteps: number;

        if (dprValue <= 1) {
            maxSteps = 1;
        } else if (dprValue === 2) {
            maxSteps = 2;
        } else {
            maxSteps = 3;
        }

        let segList: SegmentValue[];

        if (
            segments === null ||
            segments === undefined
        ) {
            segList = [null];
        } else if (
            Array.isArray(segments)
        ) {
            segList = segments as unknown as SegmentValue[];
        } else {
            segList = [
                segments as SegmentValue,
            ];
        }

        const segmentCount = segList.length;
        const formatCount = fmtList.length;

        /*
         * Базовые размеры определяются до генерации путей.
         *
         * Это полностью эквивалентно старой логике:
         * первый width > 0 и первый height > 0.
         */
        let baseWidth = 0;
        let baseHeight = 0;

        for (let i = 0; i < segmentCount; i++) {
            const ctx = this._parseSegment(segList[i]);

            if (
                baseWidth === 0 &&
                ctx.isSize &&
                ctx.width > 0
            ) {
                baseWidth = ctx.width;
            }

            if (
                baseHeight === 0 &&
                ctx.isSize &&
                ctx.height > 0
            ) {
                baseHeight = ctx.height;
            }

            if (baseWidth > 0 && baseHeight > 0) {
                break;
            }
        }

        const effList = new Array<string>(formatCount);

        const mimeList = new Array<string>(formatCount);

        const sourceFormatFlags = new Array<boolean>(formatCount);

        const allSupportFlags = new Array<boolean>(formatCount);

        for (let i = 0; i < formatCount; i++) {
            const effective = fmtList[i];

            effList[i] = effective;
            mimeList[i] = mimeFor(effective);

            sourceFormatFlags[i] =
                normalizeFormat(effective) === normalizeFormat(sourceFormat);

            allSupportFlags[i] =
                effective === "jpg" ||
                effective === "jpeg" ||
                effective === "gif" ||
                effective === "png";
        }

        const totalPaths = segmentCount * maxSteps;

        const pathsByFormat = new Array<AssetPath[]>(formatCount);

        for (let i = 0; i < formatCount; i++) {
            pathsByFormat[i] = new Array<AssetPath>(totalPaths);
        }

        /*
         * Второй проход по сегментам:
         * сегмент разбирается ровно один раз
         * при построении результатов.
         */
        for (let s = 0; s < segmentCount; s++) {
            const ctx = this._parseSegment(segList[s]);

            const segStr = ctx.segStr;

            const isSize = ctx.isSize;

            const width = ctx.width;

            const height = ctx.height;

            for (let f = 0; f < formatCount; f++) {
                const effective = effList[f];

                const paths = pathsByFormat[f];

                const pathBase = s * maxSteps;

                for (let step = 1; step <= maxSteps; step++) {
                    const hasStepDpr = step >= 2;

                    const suffix = hasStepDpr ? "@" + step : "";

                    const path =
                        prefix +
                        segStr +
                        suffix +
                        "." +
                        effective;

                    /*
                     * x-пути:
                     *
                     * старый код сохранял dpr=2/3,
                     * потому что последующая нормализация
                     * не находила width/height и оставляла
                     * исходный объект без пересоздания.
                     */
                    if (!isSize) {
                        if (hasStepDpr) {
                            paths[pathBase + step - 1] = {
                                path,
                                dpr: step,
                            };
                        } else if (dprValue === 1 && explicit) {
                            paths[pathBase + step - 1] = {
                                path,
                                dpr: 1,
                            };
                        } else {
                            paths[pathBase + step - 1] = {
                                path,
                            };
                        }

                        continue;
                    }

                    let actualDpr: number | undefined;

                    if (baseWidth > 0 && width > 0) {
                        actualDpr = (width * step) / baseWidth;
                    } else if (baseHeight > 0 && height > 0) {
                        actualDpr = (height * step) / baseHeight;
                    }

                    const itemWidth = width > 0 ? width * step : undefined;

                    const itemHeight = height > 0 ? height * step : undefined;

                    let item: AssetPath;

                    if (actualDpr !== undefined) {
                        if (actualDpr === 1 && !explicit) {
                            item = { path };
                        } else {
                            item = {
                                path,
                                dpr: actualDpr,
                            };
                        }
                    } else if (step >= 2) {
                        item = {
                            path,
                            dpr: step,
                        };
                    } else {
                        item = { path };
                    }

                    if (
                        itemWidth !== undefined
                    ) {
                        item.width = itemWidth;
                    }

                    if (
                        itemHeight !== undefined
                    ) {
                        item.height = itemHeight;
                    }

                    paths[pathBase + step - 1] = item;
                }
            }
        }

        const result = new Array<AssetType>(formatCount);

        for (let f = 0; f < formatCount; f++) {
            const asset: AssetType = {
                type: mimeList[f],
                paths: pathsByFormat[f],
            };

            if (sourceFormatFlags[f]) {
                asset.source_format = true;
            }

            if (allSupportFlags[f]) {
                asset.all_support = true;
            }

            result[f] = asset;
        }

        return result;
    }

    GetAssetPath(
        source: string,
        segment?: Segment | null,
        format?: string | null,
        dpr?: number | string | null,
    ): string {
        this._updateSource(source);

        const sourceFormat =
            this._lastSourceFormat;

        let outFormat =
            format !== null &&
            format !== undefined &&
            format !== ""
                ? format
                : this._format;

        outFormat = resolveFormat(outFormat, sourceFormat);

        const dprValue = this._resolveDpr(dpr);

        const segStr = this._segmentString(segment);

        if (dprValue >= 2) {
            return (
                this._lastPrefix +
                segStr +
                "@" +
                dprValue +
                "." +
                outFormat
            );
        }

        return (
            this._lastPrefix +
            segStr +
            "." +
            outFormat
        );
    }

    GetAssetsHtml(
        source: string,
        segments?: Segment | Segment[] | null,
        formats?: string | string[] | null,
        dprs?: number | string | null,
        options?: Record<string, unknown> | null,
    ): string {
        const assets = this.GetAssets(source, segments, formats, dprs);

        if (assets.length === 0) {
            return "";
        }

        const opts =
            options &&
            typeof options === "object"
                ? options
                : {};

        const useWidth = useWidthDescriptors(opts);

        const {imgAttrs, picAttrs} = splitAttrs(opts);

        const groups = groupAssets(assets);

        const imgIndex = pickImgGroup(groups);

        const imgGroup = groups[imgIndex];

        const imgPaths = imgGroup.paths;

        const base = imgPaths[0];

        let img =
            ' src="' +
            Imager._htmlEscape(
                base.path,
            ) +
            '"';

        if (imgPaths.length > 1) {
            const srcset = buildSrcset(imgPaths, useWidth);

            if (srcset !== "") {
                img += ' srcset="' + Imager._htmlEscape(srcset) + '"';
            }
        }

        const imgKeys = Object.keys(imgAttrs);

        for (let i = 0; i < imgKeys.length; i++) {
            const name = imgKeys[i];

            const value = imgAttrs[name];

            if (value === true) {
                img += " " + name;
            } else if (
                value === false ||
                value === null ||
                value === undefined
            ) {
                continue;
            } else {
                img += " " + name + '="' + Imager._htmlEscape(value) + '"';
            }
        }

        if (
            base.width !== undefined &&
            base.width > 0 &&
            (
                imgAttrs.width === undefined ||
                imgAttrs.width === null
            )
        ) {
            img += ' width="' + base.width + '"';
        }

        if (
            base.height !== undefined &&
            base.height > 0 &&
            (
                imgAttrs.height === undefined ||
                imgAttrs.height === null
            )
        ) {
            img += ' height="' + base.height + '"';
        }

        const imgHtml = "<img" + img + ">";

        if (groups.length === 1) {
            return imgHtml;
        }

        let html = "<picture" + Imager._renderAttrs(picAttrs) + ">";

        for (let i = 0; i < groups.length; i++) {
            if (i === imgIndex) {
                continue;
            }

            const group = groups[i];

            const srcset = buildSrcset(group.paths, useWidth);

            if (srcset === "") {
                continue;
            }

            html += "<source type=\"" + Imager._htmlEscape(group.mime) + "\" srcset=\"" + Imager._htmlEscape(srcset) + "\">";
        }

        html += imgHtml + "</picture>";

        return html;
    }
}

export default Imager;
