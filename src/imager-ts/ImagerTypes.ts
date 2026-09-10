/** Типы и структуры клиентской библиотеки imager (TypeScript, клиентская часть).

Содержит:
- интерфейсы AssetPath / AssetType (результаты клиентских методов);
- интерфейсы ImagerOptions / ImagerServerOptions (настройки конструкторов);
- тип Segment и таблицу MIME по формату.

Важно: в клиентской части (ImagerOptions) нет служебных полей
аутентификации — они существуют только в серверной части
(ImagerServerOptions, src/imager-ts-server).
*/

/** Один вариант ассета внутри `paths`.

Все поля кроме `path` опциональны: включаются в сериализацию только
если заданы, в порядке path, dpr, width, height.
*/
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
    if (format == 'jpg') {
        format = 'jpeg';
    }
    return "image/" + format;
}
