interface FormatListInterface {
    [key: number]: string;
}

const FORMAT_JPG = 1;
const FORMAT_JPEG = 2;
const FORMAT_GIF = 3;
const FORMAT_PNG = 4;
const FORMAT_APNG = 5;
const FORMAT_JPE = 6;
const FORMAT_JIF = 7;
const FORMAT_JFIF = 8;
const FORMAT_JFI = 9;
const FORMAT_WEBP = 10;
const FORMAT_AVIF = 11;
const FORMAT_HEIF = 12;
const FORMAT_HEIC = 13;

export var FormatList: FormatListInterface = {}
FormatList[FORMAT_JPG] = 'jpg'
FormatList[FORMAT_JPEG] = 'jpeg'
FormatList[FORMAT_GIF] = 'gif'
FormatList[FORMAT_PNG] = 'png'
FormatList[FORMAT_APNG] = 'apng'
FormatList[FORMAT_JPE] = 'jpe'
FormatList[FORMAT_JIF] = 'jif'
FormatList[FORMAT_JFIF] = 'jfif'
FormatList[FORMAT_JFI] = 'jfi'
FormatList[FORMAT_WEBP] = 'webp'
FormatList[FORMAT_AVIF] = 'avif'
FormatList[FORMAT_HEIF] = 'heif'
FormatList[FORMAT_HEIC] = 'heic'


export function ImagerFormat(format: string): number | false {
    format = format.toLowerCase();
    for (var k in FormatList) {
        if (format == FormatList[k]) {
            return parseInt(k);
        }
    }
    return false
}
