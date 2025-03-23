from typing import Union

FORMAT_JPG = 1
FORMAT_JPEG = 2
FORMAT_GIF = 3
FORMAT_PNG = 4
FORMAT_APNG = 5
FORMAT_JPE = 6
FORMAT_JIF = 7
FORMAT_JFIF = 8
FORMAT_JFI = 9
FORMAT_WEBP = 10
FORMAT_AVIF = 11
FORMAT_HEIF = 12
FORMAT_HEIC = 13

FormatList = {
    FORMAT_JPG: "jpg",
    FORMAT_JPEG: "jpeg",
    FORMAT_GIF: "gif",
    FORMAT_PNG: "png",
    FORMAT_APNG: "apng",
    FORMAT_JPE: "jpe",
    FORMAT_JIF: "jif",
    FORMAT_JFIF: "jfif",
    FORMAT_JFI: "jfi",
    FORMAT_WEBP: "webp",
    FORMAT_AVIF: "avif",
    FORMAT_HEIF: "heif",
    FORMAT_HEIC: "heic",
}


def GetFormat(format: str) -> Union[int, bool]:
    format = format.lower()
    for key in FormatList:
        if FormatList[key] == format:
            return key
    return False
