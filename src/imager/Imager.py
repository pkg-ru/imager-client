from .ImagerData import ImagerData
from .ImagerFormat import GetFormat
from .ImagerEncode import encode
from typing import Mapping, Any, List, Union
from typing_extensions import Self


class Imager:
    """Imager
    Горячее создание миниатюр для картинок
    @see https://github.com/pkg-ru/imager

    Args:
        thumb (str | Mapping[str, Any], optional): устанавливаем thumb или настройки по умолчанию. Defaults to "".
    """

    instance = {}

    def __init__(self, thumb: Union[str, Mapping[str, Any]] = "") -> Self:
        self.instance = ImagerData()

        if isinstance(thumb, str):
            self.thumb(thumb)
        else:
            self.setting(thumb)

    def setting(self, setting: Mapping[str, Any]) -> Self:
        """Настройки

        Returns:
                Imager: Imager
        """
        for key in setting:
            if key in self.instance:
                self.instance[key] = setting[key]
        return self

    def clone(self) -> "Imager":
        """Клонируем, чтобы не вносить изменения в общий экземпляр

        Returns:
                Imager: Imager
        """
        my = Imager(self.instance)
        my.instance = self.instance.copy()
        return my

    def copy(self) -> "Imager":
        """Клонируем, чтобы не вносить изменения в общий экземпляр

        Returns:
                Imager: Imager
        """
        return self.clone()

    def size(self, width: int = 0, height: int = 0) -> Self:
        """Изменяем размер

        Returns:
                self: self
        """
        self.width(width)
        return self.height(height)

    def width(self, width: int = 0) -> Self:
        """Ширина

        Returns:
                self: self
        """
        self.instance["width"] = width
        return self

    def height(self, height: int = 0) -> Self:
        """Высота

        Returns:
                self: self
        """
        self.instance["height"] = height
        return self

    def quality(self, quality: int) -> Self:
        """Качество

        Returns:
                self: self
        """
        self.instance["quality"] = quality
        return self

    def crop(self, crop: bool) -> Self:
        """Кроп

        Returns:
                self: self
        """
        self.instance["crop"] = crop
        return self

    def color(self, r: int, g: int, b: int) -> Self:
        """Цвет фона

        Returns:
                self: self
        """
        self.instance["color"] = [r, g, b]
        return self

    def loop(self, loop: bool) -> Self:
        """Зацикливание анимации

        Returns:
                self: self
        """
        self.instance["loop"] = loop
        return self

    def thumb(self, thumb: str) -> Self:
        """Шаблон настроек на сервере Imager

        Returns:
                self: self
        """
        self.instance["thumb"] = thumb
        return self

    def trim(self, active: bool, rate: int = 0, color: List[List[int]] = []) -> Self:
        """Обрезать по краям прозрачные пиксели/рамку/и т.д.

        Returns:
                self: self
        """
        self.trimActive(active)
        self.trimRate(rate)
        return self.trimColors(color)

    def trimActive(self, active: bool) -> Self:
        """активность фильтра: Обрезать по краям прозрачные пиксели/рамку/и т.д.

        Returns:
                self: self
        """
        self.instance["trimActive"] = active
        return self

    def trimRate(self, rate: int = 0) -> Self:
        """огрешность при сравнении цветов: Обрезать по краям прозрачные пиксели/рамку/и т.д.

        Returns:
                self: self
        """
        self.instance["trimRate"] = rate
        return self

    def trimColors(self, color: List[List[int]]) -> Self:
        """список цветов: Обрезать по краям прозрачные пиксели/рамку/и т.д.

        Returns:
                self: self
        """
        if len(color) > 0:
            newColors = []
            for item in color:
                if len(item) == 3:
                    newColors.append(item)
                else:
                    break
            self.instance["trimColor"] = newColors
        return self

    def convert(
        self, file: str, format: str, setting: Union[None, Mapping[str, Any]] = None
    ) -> str:
        """Получаем ассет на миниатюру в указаном формате

        Args:
            file (str): путь к исходной картинке
            format (str): формат файла миниатюры
            setting (None | Mapping[str, Any], optional): Настройки. Defaults to None.

        Returns:
            str: asset path
        """
        if setting != None:
            instance = self.clone().setting(setting).instance
        else:
            instance = self.instance

        file_arr = file.split(".")
        lastIndex = len(file_arr) - 1
        instance["format"] = file_arr[lastIndex]
        if GetFormat(instance["format"]) == False:
            return file

        if format == "":
            format = str(instance["format"]).lower()

        nf = GetFormat(format)
        if nf == False:
            return file

        instance["formatTo"] = nf
        if instance["format"] == format:
            # если запрашиваемый формат совпадает с текущим то не пишем в данные
            instance["format"] = ""

        if (
            instance["format"] != ""
            and instance["format"] == str(instance["format"]).lower()
        ):
            # если формат файла в нижнем регистре, пишем в данные только 1 байт
            nf = GetFormat(instance["format"])
            if nf != False:
                instance["formatFrom"] = nf
                instance["format"] = ""

        if instance["trimActive"] != True:
            instance["trimColor"] = []
            instance["trimRate"] = 0

        code = encode(instance)
        if code == "":
            return file

        return ".".join(file_arr[0:lastIndex]) + "/" + code + "." + format

    def get(self, file: str, setting: Union[None, Mapping[str, Any]] = None) -> str:
        """Получаем ассет на миниатюру в формате исходного файла

        Args:
            file (str): путь к исходной картинке
            setting (None | Mapping[str, Any], optional): Настройки. Defaults to None.

        Returns:
            str: asset path
        """
        return self.convert(file, "", setting)
