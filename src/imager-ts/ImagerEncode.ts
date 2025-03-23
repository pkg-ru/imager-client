import { ImagerDataInterface, FlagsSorted, Flags } from "./ImagerData";

export const ImagerEncode = (instance: ImagerDataInterface): string => {
    if (instance.thumb == "default") {
        instance.thumb = "";
    }

    var myFlag = 0;
    var newData = ""
    var flagsSorted = FlagsSorted();
    var len = flagsSorted.length;
    for (var i = 0; i < len; ++i) {
        var name = flagsSorted[i] as keyof ImagerDataInterface;
        var flag = Flags[name] ?? 0;

        if (name == "color" && instance[name] && (instance[name] as number[]).length == 3) {
            // [3]uint8
            myFlag |= flag;
            newData += String.fromCharCode(...instance.color as number[])
        } else if (name == "trimColor" && instance[name] && (instance[name] as number[][]).length > 0) {
            // [][3]uint8
            myFlag |= flag;
            var el = instance[name] as number[][];
            newData += String.fromCharCode(el.length * 3)
            for (var q = 0; el.length > q; ++q) {
                newData = newData + String.fromCharCode(el[q][0] ?? 255, el[q][1] ?? 255, el[q][2] ?? 255)
            }
        } else if (["loop", "trimActive", "crop"].includes(name) && (instance[name] as boolean)) {
            // bool
            myFlag |= flag;
        } else if (["formatTo", "formatFrom", "quality", "trimRate"].includes(name) && instance[name] && (instance[name] as number) > 0) {
            // uint8
            myFlag |= flag;
            newData = newData + String.fromCharCode(instance[name] as number)
        } else if (["width", "height"].includes(name) && instance[name] && (instance[name] as number) > 0) {
            // uint16
            myFlag |= flag;
            var uint16 = instance[name] as number;
            newData += String.fromCharCode((uint16 >> 8) & 0xff, uint16 & 0xff)
        } else if (["format", "thumb"].includes(name) && instance[name] && instance[name] != "") {
            // string
            myFlag |= flag;
            var _len = (instance[name] as string).length;
            newData += String.fromCharCode(_len);
            newData += instance[name];
        }
    }

    return btoa(String.fromCharCode((myFlag >> 8) & 0xff, myFlag & 0xff) + newData)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
