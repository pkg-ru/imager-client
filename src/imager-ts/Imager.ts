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
} from "./ImagerTypes";
import {
    buildSrcset,
    groupAssets,
    pickImgGroup,
    splitAttrs,
    useWidthDescriptors,
} from "./render";

export { AssetType, AssetPath, ImagerOptions, Segment, mimeFor } from "./ImagerTypes";

/** Сегмент-объект с необязательными размерами. */
interface SizeSegment {
    width?: number;
    height?: number;
}

type SegmentValue = Segment | SizeSegment | null | undefined;

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

    // переиспользуемый context для нормализации сегмента
    private _segCtx: SegCtx = { segStr: "x", isSize: true, width: 0, height: 0 };

    constructor(options?: ImagerOptions | null) {
        const o = options && typeof options === "object" ? options : {};

        // dpr: строки/числа → число; некорректное → 0
        this._dpr = Imager._toInt(o.dpr === undefined ? 0 : o.dpr);

        // format / formats
        this._format = o.format === null || o.format === undefined ? "" : String(o.format);
        this._formats = Array.isArray(o.formats) ? o.formats.map(String) : [];

        // baseURL — нормализация «…/» в конце
        const base = o.baseURL === undefined || o.baseURL === null ? "" : String(o.baseURL);
        this._baseURL = base === "" ? "/" : base.endsWith("/") ? base : base + "/";
    }

    // ------------------------------------------------------------------ //
    //  Приведение значений (как int() в Python-эталоне)                  //
    // ------------------------------------------------------------------ //

    private static _toInt(value: unknown): number {
        if (typeof value === "number") {
            return Number.isFinite(value) ? Math.trunc(value) : 0;
        }
        if (typeof value === "string") {
            const s = value;
            const n = s.length;
            let i = 0;
            // ведущие пробелы (как String.prototype.trim)
            while (i < n) {
                const c = s.charCodeAt(i);
                if (c === 32 || c === 9 || c === 10 || c === 11 || c === 12 || c === 13) {
                    i++;
                } else {
                    break;
                }
            }
            let sign = 1;
            if (i < n) {
                const c = s.charCodeAt(i);
                if (c === 43 || c === 45) {
                    if (c === 45) {
                        sign = -1;
                    }
                    i++;
                }
            }
            if (i >= n) {
                return 0;
            }
            let v = 0;
            const ds = i;
            while (i < n) {
                const c = s.charCodeAt(i);
                if (c >= 48 && c <= 57) {
                    v = v * 10 + (c - 48);
                    i++;
                } else {
                    break;
                }
            }
            if (i === ds) {
                return 0;
            }
            // хвостовые пробелы
            while (i < n) {
                const c = s.charCodeAt(i);
                if (c === 32 || c === 9 || c === 10 || c === 11 || c === 12 || c === 13) {
                    i++;
                } else {
                    break;
                }
            }
            if (i < n) {
                return 0;
            }
            return sign < 0 ? (v === 0 ? 0 : -v) : v;
        }
        if (typeof value === "boolean") {
            return value ? 1 : 0;
        }
        return 0;
    }

    // ------------------------------------------------------------------ //
    //  Разбор source: префикс path/name строит один раз (с кэшем).       //
    // ------------------------------------------------------------------ //

    /** Обновляет кэш source: _lastPrefix + _lastSourceFormat. */
    protected _updateSource(source: unknown): void {
        if (this._srcCached && source === this._lastSource) {
            return;
        }

        let s = source === null || source === undefined ? "" : String(source);
        let i = 0;
        const len = s.length;
        while (i < len && s.charCodeAt(i) === 47) {
            i++;
        }
        if (i > 0) {
            s = s.slice(i);
        }

        const lastSlash = s.lastIndexOf("/");
        let path: string;
        let file: string;
        if (lastSlash >= 0) {
            path = s.slice(0, lastSlash);
            file = s.slice(lastSlash + 1);
        } else {
            path = "";
            file = s;
        }

        const lastDot = file.lastIndexOf(".");
        let sourceName: string;
        let sourceFormat: string;
        if (lastDot >= 0) {
            sourceName = file.slice(0, lastDot);
            sourceFormat = file.slice(lastDot + 1).toLowerCase();
        } else {
            sourceName = file;
            sourceFormat = "";
        }

        const name = sourceFormat ? sourceName + "-" + sourceFormat : sourceName;
        const prefix = path ? this._baseURL + path + "/" + name + "/" : this._baseURL + name + "/";

        this._lastSource = source;
        this._lastSourceFormat = sourceFormat;
        this._lastPrefix = prefix;
        this._srcCached = true;
    }

    // ------------------------------------------------------------------ //
    //  Формализация сегмента                                             //
    // ------------------------------------------------------------------ //

    private static _buildSize(width: number, height: number): string {
        if (width > 0) {
            if (height > 0) {
                return String(width) + "x" + String(height);
            }
            return String(width) + "x";
        }
        if (height > 0) {
            return "x" + String(height);
        }
        return "x";
    }

    /** Одноходовой разбор "WxH" — пишет в ctx, возвращает isSize. */
    protected _parseSegment(segment: SegmentValue): SegCtx {
        const ctx = this._segCtx;
        if (segment === null || segment === undefined) {
            ctx.segStr = "x";
            ctx.isSize = true;
            ctx.width = 0;
            ctx.height = 0;
            return ctx;
        }
        if (typeof segment === "string") {
            const ok = this._parseSizeString(segment, ctx);
            if (!ok) {
                ctx.segStr = segment;
                ctx.isSize = false;
                ctx.width = 0;
                ctx.height = 0;
            } else {
                ctx.segStr = segment;
            }
            return ctx;
        }
        if (typeof segment === "object") {
            let width: number;
            let height: number;
            if (Array.isArray(segment)) {
                width =
                    segment.length > 0 && segment[0] !== null && segment[0] !== undefined
                        ? Imager._toInt(segment[0])
                        : 0;
                height =
                    segment.length > 1 && segment[1] !== null && segment[1] !== undefined
                        ? Imager._toInt(segment[1])
                        : 0;
            } else {
                const segmentObj = segment as SizeSegment;
                const sw = segmentObj.width;
                const sh = segmentObj.height;
                width = sw === null || sw === undefined ? 0 : Imager._toInt(sw);
                height = sh === null || sh === undefined ? 0 : Imager._toInt(sh);
            }
            ctx.segStr = Imager._buildSize(width, height);
            ctx.isSize = true;
            ctx.width = width;
            ctx.height = height;
            return ctx;
        }
        // прочие типы → размер без размеров
        ctx.segStr = "x";
        ctx.isSize = true;
        ctx.width = 0;
        ctx.height = 0;
        return ctx;
    }

    /** Парсинг "200x300" → true/false; результат записывается в ctx. */
    private _parseSizeString(segment: string, ctx: SegCtx): boolean {
        const len = segment.length;
        let xi = -1;
        for (let j = 0; j < len; j++) {
            if (segment.charCodeAt(j) === 120) {
                xi = j;
                break;
            }
        }
        if (xi < 0) {
            ctx.isSize = false;
            ctx.width = 0;
            ctx.height = 0;
            return false;
        }
        let width = 0;
        if (xi > 0) {
            for (let j = 0; j < xi; j++) {
                const c = segment.charCodeAt(j);
                if (c < 48 || c > 57) {
                    ctx.isSize = false;
                    ctx.width = 0;
                    ctx.height = 0;
                    return false;
                }
                width = width * 10 + (c - 48);
            }
        }
        let height = 0;
        for (let j = xi + 1; j < len; j++) {
            const c = segment.charCodeAt(j);
            if (c < 48 || c > 57) {
                ctx.isSize = false;
                ctx.width = 0;
                ctx.height = 0;
                return false;
            }
            height = height * 10 + (c - 48);
        }
        ctx.isSize = true;
        ctx.width = width;
        ctx.height = height;
        return true;
    }

    /** Только строка сегмента (без width/height) — лёгкий путь. */
    protected _segmentString(segment: SegmentValue): string {
        if (segment === null || segment === undefined) {
            return "x";
        }
        if (typeof segment === "string") {
            return segment;
        }
        if (typeof segment === "object") {
            if (Array.isArray(segment)) {
                const width =
                    segment.length > 0 && segment[0] !== null && segment[0] !== undefined
                        ? Imager._toInt(segment[0])
                        : 0;
                const height =
                    segment.length > 1 && segment[1] !== null && segment[1] !== undefined
                        ? Imager._toInt(segment[1])
                        : 0;
                return Imager._buildSize(width, height);
            }
            const segmentObj = segment as SizeSegment;
            const sw = segmentObj.width;
            const sh = segmentObj.height;
            const width = sw === null || sw === undefined ? 0 : Imager._toInt(sw);
            const height = sh === null || sh === undefined ? 0 : Imager._toInt(sh);
            return Imager._buildSize(width, height);
        }
        return "x";
    }

    // ------------------------------------------------------------------ //
    //  dpr                                                               //
    // ------------------------------------------------------------------ //

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
        if (dpr !== null && dpr !== undefined) {
            return Imager._parseDpr(dpr);
        }
        return Imager._parseDpr(this._dpr);
    }

    // ------------------------------------------------------------------ //
    //  Построение списка paths (общий для GetAssets)                     //
    // ------------------------------------------------------------------ //

    /** Добавляет в result assets для одного сегмента; возвращает новый idx. */
    protected _appendSegmentAssets(
        result: AssetType[],
        idx: number,
        prefix: string,
        segment: SegmentValue,
        effList: string[],
        mimeList: string[],
        dprVal: number,
        explicit: boolean,
        maxSteps: number,
        sourceFormat: string,
    ): number {
        const ctx = this._parseSegment(segment);
        const segStr = ctx.segStr;
        const isSize = ctx.isSize;
        const width = ctx.width;
        const height = ctx.height;

        // DPR-базы строятся один раз на segment (не на segment×format)
        const base1 = prefix + segStr + ".";
        const base2 = maxSteps >= 2 ? prefix + segStr + "@2." : "";
        const base3 = maxSteps >= 3 ? prefix + segStr + "@3." : "";

        const nf = effList.length;
        for (let j = 0; j < nf; j++) {
            const eff = effList[j];
            const paths = new Array<AssetPath>(maxSteps);
            const p1: AssetPath = { path: base1 + eff };
            if (dprVal === 1 && explicit) {
                p1.dpr = 1;
            }
            if (isSize && width > 0) {
                p1.width = width;
            }
            if (isSize && height > 0) {
                p1.height = height;
            }
            paths[0] = p1;
            if (maxSteps >= 2) {
                const p2: AssetPath = { path: base2 + eff, dpr: 2 };
                if (isSize && width > 0) {
                    p2.width = width * 2;
                }
                if (isSize && height > 0) {
                    p2.height = height * 2;
                }
                paths[1] = p2;
            }
            if (maxSteps >= 3) {
                const p3: AssetPath = { path: base3 + eff, dpr: 3 };
                if (isSize && width > 0) {
                    p3.width = width * 3;
                }
                if (isSize && height > 0) {
                    p3.height = height * 3;
                }
                paths[2] = p3;
            }
            const asset: AssetType = { type: mimeList[j], paths };
            if (eff === sourceFormat) {
                asset.source_format = true;
            }
            if (eff === "jpg" || eff === "jpeg" || eff === "gif" || eff === "png") {
                asset.all_support = true;
            }
            result[idx++] = asset;
        }
        return idx;
    }

    // ------------------------------------------------------------------ //
    //  Клиентские методы — без HTTP, без валидации, без исключений       //
    // ------------------------------------------------------------------ //

    GetAsset(
        source: string,
        segment?: Segment | null,
        format?: string | null,
        dpr?: number | string | null,
    ): AssetType {
        this._updateSource(source);
        const prefix = this._lastPrefix;
        const sourceFormat = this._lastSourceFormat;

        const ctx = this._parseSegment(segment);
        const segStr = ctx.segStr;
        const isSize = ctx.isSize;
        const width = ctx.width;
        const height = ctx.height;

        let outFormat =
            format !== null && format !== undefined && format !== "" ? format : this._format;
        if (!outFormat) {
            outFormat = sourceFormat;
        }

        const dprVal = this._resolveDpr(dpr);
        const explicit = dpr !== null && dpr !== undefined;

        // dpr — целевое значение: формирует ровно один вариант ассета
        const paths = new Array<AssetPath>(1);
        const p1: AssetPath =
            dprVal >= 2
                ? { path: prefix + segStr + "@" + dprVal + "." + outFormat, dpr: dprVal }
                : { path: prefix + segStr + "." + outFormat };
        if (dprVal === 1 && explicit) {
            p1.dpr = 1;
        }
        if (isSize && width > 0) {
            p1.width = dprVal >= 2 ? width * dprVal : width;
        }
        if (isSize && height > 0) {
            p1.height = dprVal >= 2 ? height * dprVal : height;
        }
        paths[0] = p1;

        const asset: AssetType = { type: mimeFor(outFormat) || "", paths };
        if (outFormat === sourceFormat) {
            asset.source_format = true;
        }
        if (outFormat === "jpg" || outFormat === "jpeg" || outFormat === "gif" || outFormat === "png") {
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
        const sourceFormat = this._lastSourceFormat;

        // форматы: аргумент → настройки formats → format → [исходный]
        let fmtList: string[] = [];
        if (formats === null || formats === undefined) {
            if (this._formats.length > 0) {
                fmtList = this._formats;
            } else if (this._format) {
                fmtList = [this._format];
            } else {
                fmtList = sourceFormat ? [sourceFormat] : [""];
            }
        } else if (typeof formats === "string") {
            fmtList = formats !== "" ? [formats] : [];
        } else {
            const arr = formats as string[];
            const list: string[] = new Array(arr.length);
            for (let i = 0; i < arr.length; i++) {
                list[i] = String(arr[i]);
            }
            fmtList = list;
        }
        if (fmtList.length === 0) {
            if (this._formats.length > 0) {
                fmtList = this._formats;
            } else if (this._format) {
                fmtList = [this._format];
            } else {
                fmtList = sourceFormat ? [sourceFormat] : [""];
            }
        }

        const dprVal = this._resolveDpr(dprs);
        const explicit = dprs !== null && dprs !== undefined;

        let maxSteps: number;
        if (dprVal < 1 || dprVal === 1) {
            maxSteps = 1;
        } else if (dprVal === 2) {
            maxSteps = 2;
        } else {
            maxSteps = 3;
        }

        // effective formats и MIME — один раз на формат
        const nf = fmtList.length;
        const effList: string[] = new Array(nf);
        const mimeList: string[] = new Array(nf);
        for (let i = 0; i < nf; i++) {
            const eff = fmtList[i] !== "" ? fmtList[i] : sourceFormat;
            effList[i] = eff;
            mimeList[i] = mimeFor(eff) || "";
        }

        // размер результата известен заранее
        let segCount: number;
        if (segments === null || segments === undefined) {
            segCount = 1;
        } else if (Array.isArray(segments)) {
            segCount = segments.length;
        } else {
            segCount = 1;
        }

        const result = new Array<AssetType>(segCount * nf);
        let idx = 0;

        if (segments === null || segments === undefined) {
            idx = this._appendSegmentAssets(
                result, idx, prefix, null,
                effList, mimeList, dprVal, explicit, maxSteps, sourceFormat,
            );
        } else if (Array.isArray(segments)) {
            const segs = segments as unknown as SegmentValue[];
            for (let i = 0; i < segs.length; i++) {
                idx = this._appendSegmentAssets(
                    result, idx, prefix, segs[i] as SegmentValue,
                    effList, mimeList, dprVal, explicit, maxSteps, sourceFormat,
                );
            }
        } else {
            idx = this._appendSegmentAssets(
                result, idx, prefix, segments as SegmentValue,
                effList, mimeList, dprVal, explicit, maxSteps, sourceFormat,
            );
        }

        return result;
    }

    // ------------------------------------------------------------------ //
    //  HTML-генерация (GetAssetsHtml)                                    //
    // ------------------------------------------------------------------ //

    /** Экранирование значения HTML-атрибута. */
    private static _htmlEscape(value: unknown): string {
        return String(value)
            .replace(/&/g, "&am" + "p;")
            .replace(/</g, "&l" + "t;")
            .replace(/>/g, "&g" + "t;")
            .replace(/"/g, "&qu" + "ot;")
            .replace(/'/g, "&#x" + "27;");
    }

    /** Рендер атрибутов: true → имя, false → пропуск, иначе name="value". */
    private static _renderAttrs(attrs: Record<string, unknown>): string {
        const keys = Object.keys(attrs).sort();
        let out = "";
        for (const name of keys) {
            const value = attrs[name];
            if (value === true) {
                out += " " + name;
            } else if (value === false || value === null || value === undefined) {
                continue;
            } else {
                out += " " + name + '="' + Imager._htmlEscape(value) + '"';
            }
        }
        return out;
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

        const opts: Record<string, unknown> =
            options && typeof options === "object" ? options : {};
        const useWidth = useWidthDescriptors(opts);

        // Разделение атрибутов: img-атрибуты vs атрибуты <picture>
        // (сортировка в _renderAttrs — детерминированный порядок вывода)
        const { imgAttrs, picAttrs } = splitAttrs(opts);

        // Группировка по типу (формату): пути всех сегментов одного формата
        // объединяются в один srcset внутри одного <source>/<img>.
        const groups = groupAssets(assets);

        // Выбор группы для <img>:
        // 1) source_format=true; 2) первая all_support=true; 3) последняя.
        const imgIndex = pickImgGroup(groups);

        const imgPaths = groups[imgIndex].paths;
        const base = imgPaths[0];

        // <img>
        let img = ' src="' + Imager._htmlEscape(base.path) + '"';
        if (imgPaths.length > 1) {
            img += ' srcset="' + Imager._htmlEscape(buildSrcset(imgPaths, useWidth)) + '"';
        }
        for (const name of Object.keys(imgAttrs).sort()) {
            const value = imgAttrs[name];
            if (value === true) {
                img += " " + name;
            } else if (value === false || value === null || value === undefined) {
                continue;
            } else {
                img += " " + name + '="' + Imager._htmlEscape(value) + '"';
            }
        }
        // width/height для CLS из базового path — только если пользователь
        // не задал свои (напрямую или через imgAttrs): без дублирования.
        if (
            base.width !== undefined &&
            base.width > 0 &&
            (imgAttrs["width"] === undefined || imgAttrs["width"] === null)
        ) {
            img += ' width="' + base.width + '"';
        }
        if (
            base.height !== undefined &&
            base.height > 0 &&
            (imgAttrs["height"] === undefined || imgAttrs["height"] === null)
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
            html += "\n    " + '<source type="' + Imager._htmlEscape(group.mime) + '"';
            if (group.paths.length > 1) {
                html += ' srcset="' + Imager._htmlEscape(buildSrcset(group.paths, useWidth)) + '"';
            } else {
                html += ' src="' + Imager._htmlEscape(group.paths[0].path) + '"';
            }
            html += ">";
        }
        html += "\n    " + imgHtml + "\n</picture>";
        return html;
    }

    GetAssetPath(
        source: string,
        segment?: Segment | null,
        format?: string | null,
        dpr?: number | string | null,
    ): string {
        this._updateSource(source);
        const sourceFormat = this._lastSourceFormat;

        let outFormat =
            format !== null && format !== undefined && format !== "" ? format : this._format;
        if (!outFormat) {
            outFormat = sourceFormat;
        }

        const dprVal = this._resolveDpr(dpr);
        const segStr = this._segmentString(segment);
        const segPart = dprVal >= 2 ? segStr + "@" + dprVal : segStr;
        return this._lastPrefix + segPart + "." + outFormat;
    }
}

export default Imager;
