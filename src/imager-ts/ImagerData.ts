interface FlagsInterface {
    [key: string]: number;
}

export interface ImagerDataInterface {
    width?: number,
    height?: number,
    quality?: number,
    color?: number[],
    loop?: boolean,
    thumb?: string,
    trimActive?: boolean,
    trimColor?: number[][],
    trimRate?: number,
    crop?: boolean,
    format?: string,
    formatTo?: number,
    formatFrom?: number,
}

export const ImagerData = (): ImagerDataInterface => {
    return {
        trimColor: [],
        format: "",
        thumb: "",
        color: [],
        width: 0,
        height: 0,
        formatTo: 0,
        formatFrom: 0,
        quality: 0,
        trimRate: 0,
        loop: true,
        trimActive: false,
        crop: false,
    }
}

export const Flags: FlagsInterface = {
    width: 1 << 0,
    height: 1 << 1,
    quality: 1 << 2,
    format: 1 << 3,
    color: 1 << 4,
    loop: 1 << 5,
    thumb: 1 << 6,
    trimActive: 1 << 7,
    trimColor: 1 << 8,
    trimRate: 1 << 9,
    formatTo: 1 << 10,
    formatFrom: 1 << 11,
    crop: 1 << 12,
}

var _flagsSorted: string[];

/**
 * Отсортированные ключи
 *
 * @returns string[]
 */
export const FlagsSorted = (): string[] => {
    if (!_flagsSorted || _flagsSorted.length == 0) {
        _flagsSorted = (Object.keys(Flags) as string[]).sort();
    }
    return _flagsSorted;
}
