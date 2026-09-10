"""Класс Imager — клиент микросервиса imager (Python-реализация).

Клиентская часть (GetAsset/GetAssets/GetAssetPath) — чистое построение
путей/URL без HTTP, без валидации и исключений, только конкатенация строк.
Админ-часть (AdminGenerate/AdminDelete) — стандартный HTTP-клиент
(urllib.request), результат — bool по маппингу кодов ответа.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Union

from .ImagerTypes import (
    AssetType,
    ImagerOptions,
    mime_for,
)

__all__ = ["Imager"]


class Imager:
    """Построитель путей/URL ассетов imager.

    Настройки:
        token    — токен админ-методов (только AdminGenerate/AdminDelete);
        dpr      — итоговое dpr по умолчанию (0 — не используется);
        format   — формат генерации по умолчанию ("");
        formats  — список форматов по умолчанию ([] → используется `format`);
        baseURL  — база URL ассетов, нормализована (всегда с `/` на конце);
        adminURL — база админ-API (без завершающего `/`).
    """

    __slots__ = (
        "_token",
        "_dpr",
        "_format",
        "_formats",
        "_baseURL",
        "_adminURL",
        "_src_cache",
    )

    def __init__(self, options: Optional[Union[ImagerOptions, dict]] = None) -> None:
        options = options if isinstance(options, dict) else {}

        # token
        token = options.get("token")
        self._token = str(token) if token is not None else ""

        # dpr
        dpr = options.get("dpr", 0)
        try:
            self._dpr = int(dpr) if dpr is not None else 0
        except (TypeError, ValueError):
            self._dpr = 0

        # format / formats
        fmt = options.get("format")
        self._format = str(fmt) if fmt is not None else ""

        formats = options.get("formats")
        if formats is None:
            self._formats = []
        else:
            self._formats = [str(f) for f in formats]

        # baseURL — нормализация «…/» в конце
        base_url = options.get("baseURL")
        if base_url is None or base_url == "":
            self._baseURL = "/"
        else:
            base_url = str(base_url)
            self._baseURL = base_url if base_url.endswith("/") else base_url + "/"

        # adminURL — без завершающего `/`
        admin_url = options.get("adminURL")
        if admin_url is None or admin_url == "":
            self._adminURL = ""
        else:
            admin_url = str(admin_url)
            self._adminURL = admin_url.rstrip("/") if admin_url.endswith("/") else admin_url

        # одноэлементный кэш последнего source: (source, path, name, fmt, prefix)
        self._src_cache = None

    # ------------------------------------------------------------------ #
    #  Разбор source: (path, source_name, source_format)    #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _split_source(source: str) -> tuple:
        """Отбрасывает ведущий `/`, отделяет path и расширение (в lower-case)."""
        if not isinstance(source, str):
            source = str(source)
        source = source.lstrip("/")

        last_slash = source.rfind("/")
        if last_slash >= 0:
            path = source[:last_slash]
            file = source[last_slash + 1:]
        else:
            path = ""
            file = source

        last_dot = file.rfind(".")
        if last_dot >= 0:
            source_name = file[:last_dot]
            source_format = file[last_dot + 1:].lower()
        else:
            source_name = file
            source_format = ""

        return path, source_name, source_format

    # ------------------------------------------------------------------ #
    #  Формализация сегмента                                 #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_size(width: int, height: int) -> str:
        """Сборка сегмента из размеров: 200x200 / 200x / x200 / x."""
        if width > 0:
            if height > 0:
                return str(width) + "x" + str(height)
            return str(width) + "x"
        if height > 0:
            return "x" + str(height)
        return "x"

    @staticmethod
    def _parse_size_string(segment: str) -> tuple:
        """→ (is_size, width, height) — один проход по строке."""
        idx = segment.find("x")
        if idx < 0:
            return False, 0, 0
        left = segment[:idx]
        right = segment[idx + 1:]
        if (left == "" or left.isdigit()) and (right == "" or right.isdigit()):
            width = int(left) if left else 0
            height = int(right) if right else 0
            return True, width, height
        return False, 0, 0

    def _normalize_segment(self, segment: Optional[Any]) -> tuple:
        """→ (segment_str, is_size, width, height)."""
        if segment is None:
            return "x", True, 0, 0
        if isinstance(segment, str):
            is_size, width, height = self._parse_size_string(segment)
            if is_size:
                return segment, True, width, height
            return segment, False, 0, 0
        if isinstance(segment, dict):
            width = 0
            height = 0
            if segment.get("width") is not None:
                try:
                    width = int(segment["width"])
                except (TypeError, ValueError):
                    width = 0
            if segment.get("height") is not None:
                try:
                    height = int(segment["height"])
                except (TypeError, ValueError):
                    height = 0
            return self._build_size(width, height), True, width, height
        if isinstance(segment, (list, tuple)):
            width = 0
            height = 0
            if len(segment) > 0 and segment[0] is not None:
                try:
                    width = int(segment[0])
                except (TypeError, ValueError):
                    width = 0
            if len(segment) > 1 and segment[1] is not None:
                try:
                    height = int(segment[1])
                except (TypeError, ValueError):
                    height = 0
            return self._build_size(width, height), True, width, height
        # прочие типы → размер без размеров
        return "x", True, 0, 0

    @staticmethod
    def _segment_to_string(segment: Optional[Any]) -> str:
        """→ seg_str (только строка сегмента) — лёгкий путь для GetAssetPath.

        Не разбирает width/height, если это не влияет на итоговую строку URL.
        """
        if segment is None:
            return "x"
        if isinstance(segment, str):
            return segment
        if isinstance(segment, dict):
            width = 0
            height = 0
            if segment.get("width") is not None:
                try:
                    width = int(segment["width"])
                except (TypeError, ValueError):
                    width = 0
            if segment.get("height") is not None:
                try:
                    height = int(segment["height"])
                except (TypeError, ValueError):
                    height = 0
            return Imager._build_size(width, height)
        if isinstance(segment, (list, tuple)):
            width = 0
            height = 0
            if len(segment) > 0 and segment[0] is not None:
                try:
                    width = int(segment[0])
                except (TypeError, ValueError):
                    width = 0
            if len(segment) > 1 and segment[1] is not None:
                try:
                    height = int(segment[1])
                except (TypeError, ValueError):
                    height = 0
            return Imager._build_size(width, height)
        # прочие типы → размер без размеров
        return "x"

    # ------------------------------------------------------------------ #
    #  dpr                                                   #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _parse_dpr(dpr: Any) -> int:
        """Строка-цифра → число; < 1 → 0 (не используется); >3 → 3."""
        try:
            number = int(dpr)
        except (TypeError, ValueError):
            return 0
        if number < 1:
            return 0
        if number > 3:
            return 3
        return number

    def _resolve_dpr(self, dpr: Optional[Union[int, str]]) -> int:
        """Аргумент → настройки → 0."""
        if dpr is not None:
            return self._parse_dpr(dpr)
        return self._parse_dpr(self._dpr)

    # ------------------------------------------------------------------ #
    #  Построение URL и списка paths                                     #
    # ------------------------------------------------------------------ #

    def _url_prefix(self, path: str, source_name: str, source_format: str) -> str:
        """{baseURL}{path}/{name}/ — общий префикс URL ассета."""
        if source_format:
            name = source_name + "-" + source_format
        else:
            name = source_name
        if path:
            return self._baseURL + path + "/" + name + "/"
        return self._baseURL + name + "/"

    def _build_url(self, path: str, source_name: str, source_format: str,
                   segment: str, dpr: int, format: str) -> str:
        """{baseURL}{path}/{name}-{srcfmt}/{segment}@{dpr}.{fmt}.

        dpr — итоговое значение суффикса: 1 — без суффикса, 2-3 — `@2`/`@3`.
        Если итоговый формат пуст — используется исходный (source_format).
        """
        if format:
            out_format = format
        else:
            out_format = source_format

        if dpr >= 2:
            segment_part = segment + "@" + str(dpr)
        else:
            segment_part = segment

        return self._url_prefix(path, source_name, source_format) + segment_part + "." + out_format

    def _asset_path(self, prefix: str, seg_str: str, is_size: bool,
                    width: int, height: int, dpr: int, explicit: bool,
                    out_format: str) -> dict:
        """Один path-объект для целевого dpr (GetAsset).

        dpr — целевое значение, формирует ровно один вариант ассета:

        - dpr < 1 (не используется) → без dpr-поля и суффикса;
        - dpr == 1 и задан явно → без суффикса, с `dpr: 1`;
        - dpr == 1 из настроек → без суффикса, без поля dpr;
        - dpr >= 2 → суффикс `@dpr`, поле `dpr`, размеры умножены на dpr.
        """
        if dpr >= 2:
            item: Dict[str, Any] = {
                "path": prefix + seg_str + "@" + str(dpr) + "." + out_format,
                "dpr": dpr,
            }
            if is_size and width > 0:
                item["width"] = width * dpr
            if is_size and height > 0:
                item["height"] = height * dpr
            return item
        item = {"path": prefix + seg_str + "." + out_format}
        if explicit and dpr == 1:
            item["dpr"] = 1
        if is_size and width > 0:
            item["width"] = width
        if is_size and height > 0:
            item["height"] = height
        return item

    def _asset_paths(self, prefix: str, seg_str: str, is_size: bool,
                     width: int, height: int, dpr: int, explicit: bool,
                     out_format: str) -> list:
        """Список path-объектов от dpr=1 до итогового dpr.

        prefix — уже готовый общий префикс URL (вычисляется один раз на вызов).
        Специализированные ветки dpr вместо общего цикла (быстрее в hot path).

        - dpr < 1 (не используется) → один объект без dpr-поля и суффикса;
        - итоговый dpr == 1 и задан явно → один объект с `dpr: 1`;
        - итоговый dpr == 1 из настроек → один объект без поля dpr;
        - итоговый dpr == 2 → [без суффикса, @2 (dpr:2)];
        - итоговый dpr >= 3 → [без суффикса, @2 (dpr:2), @3 (dpr:3)].

        Поле `dpr` вписывается в варианты с суффиксом;
        для размера width/height умножаются на шаг.
        """
        if dpr < 1:
            item: Dict[str, Any] = {"path": prefix + seg_str + "." + out_format}
            if is_size and width > 0:
                item["width"] = width
            if is_size and height > 0:
                item["height"] = height
            return [item]
        if dpr == 1:
            item = {"path": prefix + seg_str + "." + out_format}
            if explicit:
                item["dpr"] = 1
            if is_size and width > 0:
                item["width"] = width
            if is_size and height > 0:
                item["height"] = height
            return [item]
        if dpr == 2:
            item1 = {"path": prefix + seg_str + "." + out_format}
            if is_size and width > 0:
                item1["width"] = width
            if is_size and height > 0:
                item1["height"] = height
            item2 = {"path": prefix + seg_str + "@2." + out_format, "dpr": 2}
            if is_size and width > 0:
                item2["width"] = width * 2
            if is_size and height > 0:
                item2["height"] = height * 2
            return [item1, item2]
        # dpr >= 3
        item1 = {"path": prefix + seg_str + "." + out_format}
        if is_size and width > 0:
            item1["width"] = width
        if is_size and height > 0:
            item1["height"] = height
        item2 = {"path": prefix + seg_str + "@2." + out_format, "dpr": 2}
        if is_size and width > 0:
            item2["width"] = width * 2
        if is_size and height > 0:
            item2["height"] = height * 2
        item3 = {"path": prefix + seg_str + "@3." + out_format, "dpr": 3}
        if is_size and width > 0:
            item3["width"] = width * 3
        if is_size and height > 0:
            item3["height"] = height * 3
        return [item1, item2, item3]

    # ------------------------------------------------------------------ #
    #  Клиентские методы — без HTTP, без валидации, без исключений      #
    # ------------------------------------------------------------------ #

    def GetAsset(
        self,
        source: str,
        segment: Optional[Any] = None,
        format: Optional[str] = None,
        dpr: Optional[Union[int, str]] = None,
    ) -> AssetType:
        """Один AssetType."""
        cache = self._src_cache
        if cache is not None and cache[0] == source:
            source_format = cache[3]
            prefix = cache[4]
        else:
            path, source_name, source_format = self._split_source(source)
            prefix = self._url_prefix(path, source_name, source_format)
            self._src_cache = (source, path, source_name, source_format, prefix)
        seg_str, is_size, width, height = self._normalize_segment(segment)
        out_format = format if (format is not None and format != "") else self._format
        if out_format == "":
            out_format = source_format
        dpr_val = self._resolve_dpr(dpr)
        explicit = dpr is not None
        paths = [self._asset_path(prefix, seg_str, is_size, width, height,
                                  dpr_val, explicit, out_format)]
        result: AssetType = {"type": mime_for(out_format), "paths": paths}
        if out_format == source_format:
            result["source_format"] = True
        if out_format in ("jpg", "jpeg", "gif", "png"):
            result["all_support"] = True
        return result

    def GetAssets(
        self,
        source: str,
        segments: Optional[Any] = None,
        formats: Optional[Any] = None,
        dprs: Optional[Union[int, str]] = None,
    ) -> List[AssetType]:
        """Декартово произведение segments × formats."""
        # segments: не задан → [None] → "x"
        if segments is None:
            seg_list: list = [None]
        elif isinstance(segments, list):
            seg_list = segments
        else:
            seg_list = [segments]

        # formats: аргумент → настройки formats → format → [исходный]
        fmt_list: List[str] = []
        if formats is not None:
            if isinstance(formats, str):
                fmt_list = [formats] if formats != "" else []
            else:
                fmt_list = [str(f) for f in formats] if formats else []

        # source разбирается один раз; prefix строится один раз на вызов
        cache = self._src_cache
        if cache is not None and cache[0] == source:
            source_format = cache[3]
            prefix = cache[4]
        else:
            path, source_name, source_format = self._split_source(source)
            prefix = self._url_prefix(path, source_name, source_format)
            self._src_cache = (source, path, source_name, source_format, prefix)

        if not fmt_list:
            if self._formats:
                fmt_list = list(self._formats)
            elif self._format:
                fmt_list = [self._format]
            else:
                fmt_list = [source_format] if source_format else [""]

        dpr_val = self._resolve_dpr(dprs)
        explicit = dprs is not None

        # segments нормализуются один раз на элемент
        seg_data = []
        for seg in seg_list:
            seg_data.append(self._normalize_segment(seg))

        # formats подготавливаются один раз: (effective_format, mime)
        fmt_data = []
        for fmt in fmt_list:
            eff = fmt if fmt != "" else source_format
            fmt_data.append((eff, mime_for(eff)))

        result: List[AssetType] = []
        append = result.append
        for seg_str, is_size, width, height in seg_data:
            for eff, mime in fmt_data:
                paths = self._asset_paths(prefix, seg_str, is_size, width, height,
                                          dpr_val, explicit, eff)
                asset: AssetType = {"type": mime, "paths": paths}
                if eff == source_format:
                    asset["source_format"] = True
                if eff in ("jpg", "jpeg", "gif", "png"):
                    asset["all_support"] = True
                append(asset)
        return result

    # ------------------------------------------------------------------ #
    #  HTML-генерация (GetAssetsHtml)                                    #
    # ------------------------------------------------------------------ #

    #: атрибуты, относящиеся к <img>, а не к <picture>
    _IMG_ATTRS = frozenset(("alt", "sizes", "loading", "width", "height"))

    @staticmethod
    def _html_escape(value: str) -> str:
        """Экранирование значения атрибута (как html.escape(quote=True))."""
        value = str(value)
        value = value.replace("&", "&" + "amp;")
        value = value.replace("<", "&" + "lt;")
        value = value.replace(">", "&" + "gt;")
        value = value.replace('"', "&" + "quot;")
        value = value.replace("'", "&" + "#x27;")
        return value

    @staticmethod
    def _fmt_dpr(value: Union[int, float]) -> str:
        """Число → строка дескриптора: 1 → "1", 1.5 → "1.5" (без хвостовых нулей)."""
        if isinstance(value, int):
            return str(value)
        if value == int(value):
            return str(int(value))
        return repr(round(value, 2)).rstrip("0").rstrip(".")

    def _build_srcset(self, paths: List[AssetPath], use_width: bool) -> str:
        """srcset для списка путей одного типа.

        use_width=True → w-дескрипторы по AssetPath.width (200w, 400w, ...);
        иначе → dpr-дескрипторы: из AssetPath.dpr, а если dpr нет — dpr
        вычисляется из отношения height (или width) к базовому (первому)
        значению (дробные допустимы, напр. 1.5x).
        """
        base_width = 0
        base_height = 0
        for item in paths:
            if base_width == 0 and item.get("width"):
                base_width = item["width"]
            if base_height == 0 and item.get("height"):
                base_height = item["height"]
        parts = []
        for item in paths:
            path = item["path"]
            if use_width and item.get("width"):
                desc = str(item["width"]) + "w"
            elif item.get("dpr"):
                desc = self._fmt_dpr(item["dpr"]) + "x"
            elif base_height > 0 and item.get("height"):
                desc = self._fmt_dpr(round(item["height"] / base_height, 2)) + "x"
            elif base_width > 0 and item.get("width"):
                desc = self._fmt_dpr(round(item["width"] / base_width, 2)) + "x"
            else:
                desc = "1x"
            parts.append(path + " " + desc)
        return ", ".join(parts)

    def _render_attrs(self, attrs: List[tuple]) -> str:
        """Список (имя, значение|None) → строка атрибутов с ведущим пробелом."""
        chunks = []
        for name, value in attrs:
            if value is None:
                chunks.append(" " + name)
            elif value is True:
                chunks.append(" " + name)
            elif value is False:
                continue
            else:
                chunks.append(" " + name + '="' + self._html_escape(str(value)) + '"')
        return "".join(chunks)

    def GetAssetsHtml(
        self,
        source: str,
        segments: Optional[Any] = None,
        formats: Optional[Any] = None,
        dprs: Optional[Union[int, str]] = None,
        options: Optional[dict] = None,
    ) -> str:
        """HTML <picture>/<img> по декартову произведению segments × formats.

        options — HTML-атрибуты: class/id/... → <picture>,
        alt/sizes/loading (lazy → loading="lazy") → <img>.
        """
        assets = self.GetAssets(source, segments, formats, dprs)
        if not assets:
            return ""

        options = options if isinstance(options, dict) else {}
        use_width = "sizes" in options and options.get("sizes") is not None

        # lazy → loading="lazy"
        img_opts = dict(options)
        if img_opts.get("lazy"):
            img_opts["loading"] = img_opts.get("loading") or "lazy"
        img_opts.pop("lazy", None)

        # Разделение атрибутов: img-атрибуты vs атрибуты <picture>
        # (сортировка по имени — детерминированный порядок вывода)
        img_attrs = []
        pic_attrs = []
        for key, value in sorted(img_opts.items()):
            if key in self._IMG_ATTRS:
                img_attrs.append((key, value))
            else:
                pic_attrs.append((key, value))

        # Группировка по типу (формату): пути всех сегментов одного формата
        # объединяются в один srcset внутри одного <source>/<img>.
        groups = []          # список dict(type, paths, source_format, all_support)
        by_type = {}         # mime → группа
        for asset in assets:
            mime = asset["type"]
            group = by_type.get(mime)
            if group is None:
                group = {
                    "type": mime,
                    "paths": [],
                    "source_format": False,
                    "all_support": False,
                }
                by_type[mime] = group
                groups.append(group)
            group["paths"].extend(asset["paths"])
            if asset.get("source_format"):
                group["source_format"] = True
            if asset.get("all_support"):
                group["all_support"] = True

        # Выбор группы для <img>:
        # 1) source_format=true; 2) первый all_support=true; 3) последняя.
        img_group = None
        for group in groups:
            if group["source_format"]:
                img_group = group
                break
        if img_group is None:
            for group in groups:
                if group["all_support"]:
                    img_group = group
                    break
        if img_group is None:
            img_group = groups[-1]
        img_index = groups.index(img_group)
        sources = [g for i, g in enumerate(groups) if i != img_index]

        # Базовый path (первый, без dpr-суффикса) для src и width/height CLS
        base = img_group["paths"][0]

        img_attr_chunks = []
        img_attr_chunks.append(" src=" + '"' + self._html_escape(base["path"]) + '"')
        if len(img_group["paths"]) > 1:
            img_attr_chunks.append(
                " srcset=" + '"' + self._html_escape(self._build_srcset(img_group["paths"], use_width)) + '"'
            )
        for name, value in img_attrs:
            if value is None or value is True:
                img_attr_chunks.append(" " + name)
            elif value is False:
                continue
            else:
                img_attr_chunks.append(
                    " " + name + '="' + self._html_escape(str(value)) + '"'
                )
        # width/height для CLS из базового path
        if base.get("width"):
            img_attr_chunks.append(' width="' + str(base["width"]) + '"')
        if base.get("height"):
            img_attr_chunks.append(' height="' + str(base["height"]) + '"')

        img_html = "<img" + "".join(img_attr_chunks) + ">"

        if not sources:
            return img_html

        picture_attrs = self._render_attrs(pic_attrs)
        lines = ["<picture" + picture_attrs + ">"]
        for src_group in sources:
            attrs = " type=" + '"' + self._html_escape(src_group["type"]) + '"'
            if len(src_group["paths"]) > 1:
                srcset = self._build_srcset(src_group["paths"], use_width)
                attrs += " srcset=" + '"' + self._html_escape(srcset) + '"'
            else:
                attrs += " src=" + '"' + self._html_escape(src_group["paths"][0]["path"]) + '"'
            lines.append("    <source" + attrs + ">")
        lines.append("    " + img_html)
        lines.append("</picture>")
        return "\n".join(lines)

    def GetAssetPath(
        self,
        source: str,
        segment: Optional[Any] = None,
        format: Optional[str] = None,
        dpr: Optional[Union[int, str]] = None,
    ) -> str:
        """URL ассета для целевого dpr (суффикс `@dpr` при dpr >= 2)."""
        cache = self._src_cache
        if cache is not None and cache[0] == source:
            source_format = cache[3]
            prefix = cache[4]
        else:
            path, source_name, source_format = self._split_source(source)
            prefix = self._url_prefix(path, source_name, source_format)
            self._src_cache = (source, path, source_name, source_format, prefix)
        seg = segment
        if seg is None:
            seg_str = "x"
        elif isinstance(seg, str):
            seg_str = seg
        else:
            seg_str = self._segment_to_string(seg)
        out_format = format if (format is not None and format != "") else self._format
        if out_format == "":
            out_format = source_format
        dpr_val = self._resolve_dpr(dpr)
        if dpr_val >= 2:
            seg_str = seg_str + "@" + str(dpr_val)
        return prefix + seg_str + "." + out_format

    # ------------------------------------------------------------------ #
    #  Админ-методы (HTTP через urllib.request)                          #
    # ------------------------------------------------------------------ #

    def _admin_request(
        self, target: Any, wait: bool,
        endpoint: str, method: str,
    ) -> bool:
        """Общий админ-запрос; пустой token/adminURL → False без HTTP.

        target:
            str          → режим A: {"source": ...}
            AssetType    → режим B: {"assets": [paths[].path]}
            AssetType[]  → режим B: {"assets": [paths[].path из ВСЕХ AssetType]}
            string[]     → режим B: {"assets": [элементы как есть]}
        """
        if not self._token or not self._adminURL:
            return False

        body: Dict[str, Any]
        if isinstance(target, str):
            # режим A: source-строка как есть
            body = {"source": target}
        else:
            # режим B: собираем список assets
            assets: List[str] = []
            if isinstance(target, list):
                if target and all(isinstance(item, str) for item in target):
                    # string[] — пути как есть, без валидации и преобразований
                    assets = [item for item in target]  # type: ignore[misc]
                else:
                    # AssetType[] — path'ы всех AssetType подряд
                    for item in target:
                        assets.extend(p_str["path"] for p_str in item["paths"])
            else:
                # AssetType — все paths[].path
                assets = [p_str["path"] for p_str in target["paths"]]
            body = {"assets": assets}
        if wait is not None:
            body["wait"] = wait

        url = self._adminURL + endpoint
        data = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Authorization": "Bearer " + self._token,
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                code = response.status
        except urllib.error.HTTPError as err:
            code = err.code
        except Exception:
            return False

        if endpoint == "/admin/assets/delete":
            return code == 200
        return code == 200 or code == 202

    def AdminGenerate(
        self,
        target: Union[str, AssetType, List[AssetType], List[str]],
        wait: bool = False,
    ) -> bool:
        """POST {adminURL}/admin/assets/generate → 200/202.

        target: str | AssetType | list[AssetType] | list[str] (маппинг §7.1).
        """
        return self._admin_request(target, wait, "/admin/assets/generate", "POST")

    def AdminDelete(
        self,
        target: Union[str, AssetType, List[AssetType], List[str]],
        wait: bool = False,
    ) -> bool:
        """DELETE {adminURL}/admin/assets/delete → 200.

        target: str | AssetType | list[AssetType] | list[str] (маппинг §7.1).
        """
        return self._admin_request(target, wait, "/admin/assets/delete", "DELETE")
