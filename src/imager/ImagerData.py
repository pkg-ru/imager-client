from typing import Mapping, Any, List


def ImagerData() -> Mapping[str, Any]:
    return {
        "trimColor": [],
        "format": "",
        "thumb": "",
        "color": [],
        "width": 0,
        "height": 0,
        "formatTo": 0,
        "formatFrom": 0,
        "quality": 0,
        "trimRate": False,
        "loop": True,
        "trimActive": False,
        "crop": False,
    }


Flags: Mapping[str, int] = {
    "width": 1 << 0,
    "height": 1 << 1,
    "quality": 1 << 2,
    "format": 1 << 3,
    "color": 1 << 4,
    "loop": 1 << 5,
    "thumb": 1 << 6,
    "trimActive": 1 << 7,
    "trimColor": 1 << 8,
    "trimRate": 1 << 9,
    "formatTo": 1 << 10,
    "formatFrom": 1 << 11,
    "crop": 1 << 12,
}


__flagsSorted = []

def FlagsSorted() -> List[str]:
    """Отсортированные ключи"""
    global __flagsSorted
    if len(__flagsSorted) == 0:
        __flagsSorted = list({key: Flags[key] for key in sorted(Flags)}.keys())
    return __flagsSorted
