/*! @license
 * imager-client — клиент микросервиса Imager
 * Репозиторий: https://gitverse.ru/pkg-ru/imager-client (зеркало: https://github.com/pkg-ru/imager-client)
 * Автор: Vladislav Altukhov (https://altuh.ru/about)
 * Демо: https://altuh.ru/demo/imager
 */
/** Типы и структуры клиентской библиотеки imager (TypeScript, клиентская часть). */

export interface AssetPath {
    path: string;
    dpr?: number;
    width?: number;
    height?: number;
}

/** Результат GetAsset / элемента GetAssets.

Опциональные поля включаются в сериализацию только при true:
- source_format — итоговый формат совпадает с исходным форматом файла;
- all_support — формат поддерживается всеми браузерами (jpg/jpeg/gif/png).
*/
export interface AssetType {
    type: string;
    paths: AssetPath[];
    source_format?: boolean;
    all_support?: boolean;
}

/** Настройки клиентской части. Без служебных полей серверной части. */
export interface ImagerOptions {
    dpr?: number;
    format?: string;
    formats?: string[];
    baseURL?: string;
    sort?: boolean;
}

/** Настройки серверной части — добавляет token и adminURL. */
export interface ImagerServerOptions extends ImagerOptions {
    token?: string;
    adminURL?: string;
}

/** строка | {width,height} | [width,height] */
export type Segment = string | { width?: number; height?: number } | [number, number];

/** MIME для итогового формата; неизвестный/видео → пустая строка. */
export function mimeFor(format: string): string {
    if (format === "jpg") {
        format = "jpeg";
    }

    return "image/" + format;
}

/** Форматы картинок, поддерживаемые сервисом. Всё, что не входит в этот
 * список (видео и прочее), при format="auto"/"" трактуется как не-картинка. */
export const IMAGE_FORMATS: ReadonlySet<string> = new Set([
    "jpg",
    "jpeg",
    "png",
    "webp",
    "avif",
    "heif",
    "heic",
    "apng",
    "jxl",
    "gif",
]);

/** Нормализация формата: lower-case, jpeg → jpg. */
export function normalizeFormat(format: string): string {
    if (format === "jpeg") {
        return "jpg";
    }
    return format === format.toUpperCase() && format !== format.toLowerCase()
        ? format.toLowerCase()
        : format;
}

/** Резолв одного формата: "auto"/"" → исходный формат, если он картинка, иначе jpg. */
export function resolveFormat(format: string, sourceFormat: string): string {
    if (format === "auto" || format === "") {
        return IMAGE_FORMATS.has(sourceFormat) ? sourceFormat : "jpg";
    }
    return normalizeFormat(format);
}

/** Дедупликация списка форматов (jpeg → jpg, первое вхождение сохраняет позицию). */
export function dedupeFormats(formats: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (let i = 0; i < formats.length; i++) {
        const fmt = normalizeFormat(formats[i]);
        if (!seen.has(fmt)) {
            seen.add(fmt);
            result.push(fmt);
        }
    }
    return result;
}
