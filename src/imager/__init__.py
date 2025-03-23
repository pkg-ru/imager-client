from typing import Mapping, Any, Union
from .Imager import Imager
from .ImagerFormat import FormatList
from .ImagerData import Flags, FlagsSorted


def ImagerGet(file: str, setting: Union[None, Mapping[str, Any]] = None) -> str:
    """Получаем ассет на миниатюру в формате исходного файла

    Args:
        file (str): путь к исходной картинке
        setting (None | Mapping[str, Any], optional): Настройки. Defaults to None.

    Returns:
        str: asset path
    """
    img = Imager()
    if setting != None:
        img.setting(setting)
    return img.get(file)


def ImagerConvert(
    file: str, format: str, setting: Union[None, Mapping[str, Any]] = None
) -> str:
    """Получаем ассет на миниатюру в указаном формате

    Args:
        file (str): путь к исходной картинке
        format (str): формат файла миниатюры
        setting (None | Mapping[str, Any], optional): Настройки. Defaults to None.

    Returns:
        str: asset path
    """
    img = Imager()
    if setting != None:
        img.setting(setting)
    return img.convert(file, format)
