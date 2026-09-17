"""Класс Imager — высокопроизводительный клиент микросервиса imager.

Клиентские методы не выполняют HTTP: только строят URL/структуры результатов.
Админ-методы используют стандартный urllib.request.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Union

from .ImagerTypes import (
    AssetType,
    ImagerOptions,
    dedupe_formats,
    normalize_format,
    resolve_format,
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

    _IMG_ATTRS = frozenset(
        ("alt", "sizes", "loading", "width", "height", "decoding", "fetchpriority")
    )
    _MIME_JPG = "image/jpeg"

    def __init__(self, options: Optional[Union[ImagerOptions, dict]] = None) -> None:
        options = options if isinstance(options, dict) else {}

        token = options.get("token")
        self._token = str(token) if token is not None else ""

        dpr = options.get("dpr", 0)
        try:
            self._dpr = int(dpr) if dpr is not None else 0
        except (TypeError, ValueError):
            self._dpr = 0

        fmt = options.get("format")
        self._format = str(fmt) if fmt is not None else ""

        formats = options.get("formats")
        self._formats = [] if formats is None else [str(f) for f in formats]

        base_url = options.get("baseURL")
        if base_url is None or base_url == "":
            self._baseURL = "/"
        else:
            base_url = str(base_url)
            self._baseURL = base_url if base_url.endswith("/") else base_url + "/"

        admin_url = options.get("adminURL")
        if admin_url is None or admin_url == "":
            self._adminURL = ""
        else:
            admin_url = str(admin_url)
            self._adminURL = admin_url.rstrip("/") if admin_url.endswith("/") else admin_url

        # (source, path, source_name, source_format, prefix)
        self._src_cache = None

    @staticmethod
    def _split_source(source: str) -> tuple:
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
            return path, file[:last_dot], file[last_dot + 1:].lower()
        return path, file, ""

    @staticmethod
    def _build_size(width: int, height: int) -> str:
        if width > 0:
            if height > 0:
                return f"{width}x{height}"
            return f"{width}x"
        if height > 0:
            return f"x{height}"
        return "x"

    @staticmethod
    def _parse_size_string(segment: str) -> tuple:
        idx = segment.find("x")
        if idx < 0:
            return False, 0, 0
        left = segment[:idx]
        right = segment[idx + 1:]
        if (left == "" or left.isdigit()) and (right == "" or right.isdigit()):
            return True, int(left) if left else 0, int(right) if right else 0
        return False, 0, 0

    @staticmethod
    def _normalize_segment(segment: Optional[Any]) -> tuple:
        if segment is None:
            return "x", True, 0, 0

        if isinstance(segment, str):
            is_size, width, height = Imager._parse_size_string(segment)
            if is_size:
                return segment, True, width, height
            return segment, False, 0, 0

        if isinstance(segment, dict):
            try:
                raw_width = segment.get("width")
                width = int(raw_width) if raw_width is not None else 0
            except (TypeError, ValueError):
                width = 0
            try:
                raw_height = segment.get("height")
                height = int(raw_height) if raw_height is not None else 0
            except (TypeError, ValueError):
                height = 0
            return Imager._build_size(width, height), True, width, height

        if isinstance(segment, (list, tuple)):
            try:
                raw_width = segment[0] if len(segment) > 0 else None
                width = int(raw_width) if raw_width is not None else 0
            except (TypeError, ValueError):
                width = 0
            try:
                raw_height = segment[1] if len(segment) > 1 else None
                height = int(raw_height) if raw_height is not None else 0
            except (TypeError, ValueError):
                height = 0
            return Imager._build_size(width, height), True, width, height

        return "x", True, 0, 0

    @staticmethod
    def _segment_to_string(segment: Optional[Any]) -> str:
        if segment is None:
            return "x"
        if isinstance(segment, str):
            return segment
        if isinstance(segment, dict):
            try:
                raw_width = segment.get("width")
                width = int(raw_width) if raw_width is not None else 0
            except (TypeError, ValueError):
                width = 0
            try:
                raw_height = segment.get("height")
                height = int(raw_height) if raw_height is not None else 0
            except (TypeError, ValueError):
                height = 0
            return Imager._build_size(width, height)
        if isinstance(segment, (list, tuple)):
            try:
                raw_width = segment[0] if len(segment) > 0 else None
                width = int(raw_width) if raw_width is not None else 0
            except (TypeError, ValueError):
                width = 0
            try:
                raw_height = segment[1] if len(segment) > 1 else None
                height = int(raw_height) if raw_height is not None else 0
            except (TypeError, ValueError):
                height = 0
            return Imager._build_size(width, height)
        return "x"

    @staticmethod
    def _parse_dpr(dpr: Any) -> int:
        try:
            number = int(dpr)
        except (TypeError, ValueError):
            return 0
        if number < 1:
            return 0
        if number > 3:
            return 3
        return number


    def _effective_format(fmt: str, source_format: str) -> str:
        return fmt if fmt else source_format


    def _append_path_item(
        out: list,
        prefix: str,
        seg_str: str,
        is_size: bool,
        width: int,
        height: int,
        step: int,
        out_format: str,
        calculated_dpr: Optional[Union[int, float]] = None,
        include_dpr_from_step: bool = False,
    ) -> None:
        if step >= 2:
            path = prefix + seg_str + "@" + str(step) + "." + out_format
            item: Dict[str, Any] = {"path": path, "dpr": step}
            if is_size and width > 0:
                item["width"] = width * step
            if is_size and height > 0:
                item["height"] = height * step
        else:
            path = prefix + seg_str + "." + out_format
            item = {"path": path}
            if is_size and width > 0:
                item["width"] = width
            if is_size and height > 0:
                item["height"] = height

        if calculated_dpr is not None:
            if calculated_dpr == int(calculated_dpr):
                calculated_dpr = int(calculated_dpr)
            if calculated_dpr == 1:
                return
            if step >= 2:
                item["dpr"] = calculated_dpr
            else:
                item["dpr"] = calculated_dpr
        out.append(item)

    @staticmethod
    def _format_input_formats(
        formats: Optional[Any],
        source_format: str,
        default_format: str,
        default_formats: list,
    ) -> List[str]:
        # Сохраняется семантика исходной реализации: пустой formats
        # означает «использовать defaults», а не «вернуть []».
        if formats is not None:
            if isinstance(formats, str):
                fmt_list = [formats] if formats != "" else []
            else:
                fmt_list = [str(f) for f in formats] if formats else []
            if fmt_list:
                return dedupe_formats(
                    [resolve_format(f, source_format) for f in fmt_list]
                )

        if default_formats:
            return dedupe_formats(
                [resolve_format(f, source_format) for f in default_formats]
            )
        if default_format:
            return [resolve_format(default_format, source_format)]
        return [resolve_format("", source_format)]


    @staticmethod
    def _prepare_variants(
        prefix: str,
        seg_data: list,
        dpr_val: int,
        base_width: int,
        base_height: int,
    ) -> tuple:
        """Вычисляет общие для всех форматов данные вариантов один раз.

        Возвращает:
            variants: [(path_stem, dpr_or_none, width, height), ...]
            has_gt1: есть ли dpr > 1 в итоговой группе.
        """
        variants = []

        if dpr_val <= 1:
            calculated = []
            has_gt1 = False

            for seg_str, is_size, width, height in seg_data:
                if width > 0 and base_width > 0:
                    dpr = width / base_width
                elif height > 0 and base_height > 0:
                    dpr = height / base_height
                else:
                    dpr = 0

                if dpr > 1:
                    has_gt1 = True
                if dpr and dpr == int(dpr):
                    dpr = int(dpr)

                item_width = width if is_size and width > 0 else 0
                item_height = height if is_size and height > 0 else 0
                stem = prefix + seg_str
                calculated.append((stem, dpr or None, item_width, item_height))

            if has_gt1:
                return calculated, True
            return [
                (stem, None, width, height)
                for stem, dpr, width, height in calculated
            ], False

        max_step = 2 if dpr_val == 2 else 3
        for seg_str, is_size, width, height in seg_data:
            stem_base = prefix + seg_str
            for step in range(1, max_step + 1):
                stem = (
                    stem_base
                    if step == 1
                    else stem_base + "@" + str(step)
                )

                if step >= 2:
                    if width > 0 and base_width > 0:
                        dpr = (width / base_width) * step
                    elif height > 0 and base_height > 0:
                        dpr = (height / base_height) * step
                    else:
                        dpr = step
                else:
                    if width > 0 and base_width > 0:
                        dpr = width / base_width
                    elif height > 0 and base_height > 0:
                        dpr = height / base_height
                    else:
                        dpr = 0

                if dpr and dpr == int(dpr):
                    dpr = int(dpr)

                item_width = width * step if is_size and width > 0 else 0
                item_height = height * step if is_size and height > 0 else 0
                variants.append((stem, dpr or None, item_width, item_height))

        has_gt1 = any(dpr is not None and dpr > 1 for _, dpr, _, _ in variants)
        if not has_gt1:
            variants = [
                (stem, None if dpr == 1 else dpr, width, height)
                for stem, dpr, width, height in variants
            ]
        return variants, has_gt1


    def _build_assets(
        self,
        source: str,
        segments: Optional[Any],
        formats: Optional[Any],
        dprs: Optional[Union[int, str]],
    ) -> list:
        cache = self._src_cache
        if cache is not None and cache[0] == source:
            source_format = cache[3]
            prefix = cache[4]
        else:
            path, source_name, source_format = self._split_source(source)
            if source_format:
                name = source_name + "-" + source_format
            else:
                name = source_name
            prefix = self._baseURL + path + "/" + name + "/" if path else self._baseURL + name + "/"
            self._src_cache = (source, path, source_name, source_format, prefix)

        if segments is None:
            raw_segments = (None,)
        elif isinstance(segments, list):
            raw_segments = segments
        else:
            raw_segments = (segments,)

        seg_data = [self._normalize_segment(seg) for seg in raw_segments]
        fmt_list = self._format_input_formats(
            formats, source_format, self._format, self._formats
        )
        dpr_val = self._parse_dpr(self._dpr if dprs is None else dprs)

        base_width = 0
        base_height = 0
        for _, _, width, height in seg_data:
            if base_width == 0 and width > 0:
                base_width = width
            if base_height == 0 and height > 0:
                base_height = height

        variants, has_gt1 = self._prepare_variants(
            prefix, seg_data, dpr_val, base_width, base_height
        )

        result: list = []
        for fmt in fmt_list:
            eff = fmt if fmt else source_format
            if eff == "jpg":
                mime = self._MIME_JPG
            else:
                mime = "image/" + eff

            paths = []
            for stem, dpr, width, height in variants:
                item = {"path": stem + "." + eff}
                if dpr is not None:
                    item["dpr"] = dpr
                if width:
                    item["width"] = width
                if height:
                    item["height"] = height
                paths.append(item)

            asset: AssetType = {"type": mime, "paths": paths}
            if normalize_format(eff) == normalize_format(source_format):
                asset["source_format"] = True
            if eff in ("jpg", "jpeg", "gif", "png"):
                asset["all_support"] = True
            result.append(asset)
        return result

    def GetAsset(
        self,
        source: str,
        segment: Optional[Any] = None,
        format: Optional[str] = None,
        dpr: Optional[Union[int, str]] = None,
    ) -> AssetType:
        cache = self._src_cache
        if cache is not None and cache[0] == source:
            source_format = cache[3]
            prefix = cache[4]
        else:
            path, source_name, source_format = self._split_source(source)
            if source_format:
                name = source_name + "-" + source_format
            else:
                name = source_name
            prefix = self._baseURL + path + "/" + name + "/" if path else self._baseURL + name + "/"
            self._src_cache = (source, path, source_name, source_format, prefix)

        seg_str, is_size, width, height = self._normalize_segment(segment)
        out_format = resolve_format(
            format if format else (self._format if self._format else ""),
            source_format,
        )

        dpr_val = self._parse_dpr(self._dpr if dpr is None else dpr)

        if dpr_val >= 2:
            item: Dict[str, Any] = {
                "path": prefix + seg_str + "@" + str(dpr_val) + "." + out_format,
                "dpr": dpr_val,
            }
            if is_size and width > 0:
                item["width"] = width * dpr_val
            if is_size and height > 0:
                item["height"] = height * dpr_val
        else:
            item = {"path": prefix + seg_str + "." + out_format}
            if is_size and width > 0:
                item["width"] = width
            if is_size and height > 0:
                item["height"] = height

        if out_format == "jpg":
            mime = self._MIME_JPG
        else:
            mime = "image/" + out_format

        result: AssetType = {"type": mime, "paths": [item]}
        if normalize_format(out_format) == normalize_format(source_format):
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
        return self._build_assets(source, segments, formats, dprs)

    @staticmethod
    def _html_escape(value: str) -> str:
        return str(value).translate({
            38: "&amp;",   # &
            60: "&lt;",    # <
            62: "&gt;",    # >
            34: "&quot;",  # "
            39: "&#x27;",  # '
        })

    @staticmethod
    def _fmt_dpr(value: Union[int, float]) -> str:
        if isinstance(value, int):
            return str(value)
        if value == int(value):
            return str(int(value))
        return repr(round(value, 2)).rstrip("0").rstrip(".")

    def _build_srcset(self, paths: List[dict], use_width: bool) -> str:
        if use_width:
            return ", ".join(
                item["path"] + " " + str(item["width"]) + "w"
                for item in paths
                if item.get("width")
            )

        base_width = 0
        base_height = 0
        max_dpr = 0.0
        has_dpr = False

        for item in paths:
            width = item.get("width")
            height = item.get("height")
            dpr = item.get("dpr")

            if base_width == 0 and width:
                base_width = width
            if base_height == 0 and height:
                base_height = height
            if dpr:
                has_dpr = True

        for item in paths:
            if not item.get("width") and not item.get("height"):
                continue
            dpr = item.get("dpr")
            if dpr:
                if dpr > max_dpr:
                    max_dpr = dpr
            elif item.get("width") and base_width > 0:
                value = item["width"] / base_width
                if value > max_dpr:
                    max_dpr = value
            elif item.get("height") and base_height > 0:
                value = item["height"] / base_height
                if value > max_dpr:
                    max_dpr = value

        parts = []
        if not paths:
            return ""

        for item in paths:
            path = item["path"]
            width = item.get("width")
            height = item.get("height")
            dpr = item.get("dpr")

            if dpr and (width or height):
                desc = self._fmt_dpr(dpr) + "x"
            elif height and base_height > 0:
                desc = self._fmt_dpr(round(height / base_height, 2)) + "x"
            elif width and base_width > 0:
                desc = self._fmt_dpr(round(width / base_width, 2)) + "x"
            elif not width and not height:
                dpr_step = dpr or 1
                if max_dpr > 0:
                    desc = self._fmt_dpr(round((max_dpr + 1) * dpr_step, 2)) + "x"
                elif has_dpr:
                    desc = self._fmt_dpr(dpr_step) + "x"
                else:
                    parts.append(path)
                    continue
            else:
                desc = "1x"

            parts.append(path + " " + desc)
        return ", ".join(parts)

    def _render_attrs(self, attrs: List[tuple]) -> str:
        parts = []
        escape = self._html_escape
        for name, value in attrs:
            if value is None or value is True:
                parts.append(" " + name)
            elif value is False:
                continue
            else:
                parts.append(" " + name + '="' + escape(value) + '"')
        return "".join(parts)

    def _prepare_html_attrs(self, options: dict) -> tuple:
        use_width = "sizes" in options and options.get("sizes") is not None

        img_opts = dict(options)
        if img_opts.get("lazy"):
            img_opts["loading"] = img_opts.get("loading") or "lazy"
        img_opts.pop("lazy", None)

        explicit = img_opts.get("imgAttrs")
        if not isinstance(explicit, dict):
            explicit = {}
        img_opts.pop("imgAttrs", None)

        img_keys = self._IMG_ATTRS
        img_attrs = []
        pic_attrs = []
        for key, value in img_opts.items():
            (img_attrs if key in img_keys else pic_attrs).append((key, value))

        if explicit:
            explicit_keys = set(explicit)
            img_attrs = [item for item in img_attrs if item[0] not in explicit_keys]
            img_attrs.extend(explicit.items())

        return use_width, img_attrs, pic_attrs

    def _build_html_groups_fast(
        self,
        source: str,
        segments: Optional[Any],
        formats: Optional[Any],
        dprs: Optional[Union[int, str]],
        use_width: bool,
    ) -> list:
        """Готовит только данные, необходимые для HTML, без AssetType/paths-объектов."""
        cache = self._src_cache
        if cache is not None and cache[0] == source:
            source_format = cache[3]
            prefix = cache[4]
        else:
            path, source_name, source_format = self._split_source(source)
            if source_format:
                name = source_name + "-" + source_format
            else:
                name = source_name
            prefix = self._baseURL + path + "/" + name + "/" if path else self._baseURL + name + "/"
            self._src_cache = (source, path, source_name, source_format, prefix)

        if segments is None:
            raw_segments = (None,)
        elif isinstance(segments, list):
            raw_segments = segments
        else:
            raw_segments = (segments,)

        seg_data = [self._normalize_segment(seg) for seg in raw_segments]
        fmt_list = self._format_input_formats(
            formats, source_format, self._format, self._formats
        )
        dpr_val = self._parse_dpr(self._dpr if dprs is None else dprs)

        base_width = 0
        base_height = 0
        for _, _, width, height in seg_data:
            if base_width == 0 and width > 0:
                base_width = width
            if base_height == 0 and height > 0:
                base_height = height

        # Коэффициент размера сегмента относительно первого размерного сегмента.
        ratios = []
        has_gt1 = False
        max_dpr = 0.0

        for _, _, width, height in seg_data:
            if width > 0 and base_width > 0:
                ratio = width / base_width
            elif height > 0 and base_height > 0:
                ratio = height / base_height
            else:
                ratio = 0

            ratios.append(ratio)
            if ratio > 1:
                has_gt1 = True

            if dpr_val >= 2:
                candidate = ratio * dpr_val if ratio else 0
                if candidate > max_dpr:
                    max_dpr = candidate
            elif ratio > max_dpr:
                max_dpr = ratio

        groups = []
        by_type = {}
        has_dpr = dpr_val >= 2 or has_gt1

        for fmt in fmt_list:
            eff = fmt if fmt else source_format
            mime = self._MIME_JPG if eff == "jpg" else "image/" + eff

            group = by_type.get(mime)
            if group is None:
                group = {
                    "type": mime,
                    "src": "",
                    "srcset": "",
                    "source_format": False,
                    "all_support": False,
                    "width": 0,
                    "height": 0,
                    "path_count": 0,
                }
                by_type[mime] = group
                groups.append(group)

            srcset_parts = []
            first_path = True
            first_width = 0
            first_height = 0

            # dpr >= 2 always has dpr steps. For <= 1, dpr is derived
            # from segment size ratios exactly as in GetAssets.
            steps = 1 if dpr_val <= 1 else (2 if dpr_val == 2 else 3)

            for seg_idx, (seg_str, is_size, width, height) in enumerate(seg_data):
                ratio = ratios[seg_idx]

                for step in range(1, steps + 1):
                    if step == 1:
                        path = prefix + seg_str + "." + eff
                    else:
                        path = (
                            prefix + seg_str + "@" + str(step) + "." + eff
                        )

                    item_width = width * step if is_size and width > 0 else 0
                    item_height = height * step if is_size and height > 0 else 0

                    if first_path:
                        group["src"] = path
                        group["width"] = item_width
                        group["height"] = item_height
                        first_width = item_width
                        first_height = item_height
                        first_path = False

                    if use_width:
                        if item_width:
                            srcset_parts.append(
                                path + " " + str(item_width) + "w"
                            )
                        continue

                    # Полное соответствие логике _build_srcset.
                    if step >= 2:
                        item_dpr = ratio * step if ratio else step
                    elif ratio:
                        item_dpr = ratio if has_gt1 else 0
                    else:
                        item_dpr = 0

                    if item_dpr:
                        if item_dpr == int(item_dpr):
                            item_dpr = int(item_dpr)

                    if item_dpr and (item_width or item_height):
                        desc = self._fmt_dpr(item_dpr) + "x"
                    elif item_height and base_height > 0:
                        desc = self._fmt_dpr(
                            round(item_height / base_height, 2)
                        ) + "x"
                    elif item_width and base_width > 0:
                        desc = self._fmt_dpr(
                            round(item_width / base_width, 2)
                        ) + "x"
                    else:
                        # x-путь: для dpr>=2 item_dpr уже равен step.
                        dpr_step = item_dpr or 1
                        if max_dpr > 0:
                            desc = self._fmt_dpr(
                                round((max_dpr + 1) * dpr_step, 2)
                            ) + "x"
                        elif has_dpr:
                            desc = self._fmt_dpr(dpr_step) + "x"
                        else:
                            srcset_parts.append(path)
                            continue

                    srcset_parts.append(path + " " + desc)

            group["srcset"] = ", ".join(srcset_parts)
            group["path_count"] = len(seg_data) * steps
            if normalize_format(eff) == normalize_format(source_format):
                group["source_format"] = True
            if eff in ("jpg", "jpeg", "gif", "png"):
                group["all_support"] = True

        return groups

    def GetAssetsHtml(
        self,
        source: str,
        segments: Optional[Any] = None,
        formats: Optional[Any] = None,
        dprs: Optional[Union[int, str]] = None,
        options: Optional[dict] = None,
    ) -> str:
        options = options if isinstance(options, dict) else {}
        use_width = "sizes" in options and options.get("sizes") is not None

        groups = self._build_html_groups_fast(
            source, segments, formats, dprs, use_width
        )
        if not groups:
            return ""

        use_width, img_attrs, pic_attrs = self._prepare_html_attrs(options)

        img_group = None
        img_index = -1
        for idx, group in enumerate(groups):
            if group["source_format"]:
                img_group = group
                img_index = idx
                break

        if img_group is None:
            for idx, group in enumerate(groups):
                if group["all_support"]:
                    img_group = group
                    img_index = idx
                    break

        if img_group is None:
            img_index = len(groups) - 1
            img_group = groups[img_index]

        if img_group["path_count"] == 0:
            # Исходный GetAssetsHtml обращался к paths[0] и в этом случае
            # выбрасывал IndexError.
            raise IndexError("list index out of range")

        escape = self._html_escape
        img_parts = ['<img src="', escape(img_group["src"]), '"']

        if img_group["path_count"] > 1 and img_group["srcset"]:
            img_parts.extend((' srcset="', escape(img_group["srcset"]), '"'))

        img_attr_names = set()
        for name, value in img_attrs:
            img_attr_names.add(name)
            if value is None or value is True:
                img_parts.append(" " + name)
            elif value is False:
                continue
            else:
                img_parts.extend((" " + name + '="', escape(value), '"'))

        if img_group["width"] and "width" not in img_attr_names:
            img_parts.extend((' width="', str(img_group["width"]), '"'))
        if img_group["height"] and "height" not in img_attr_names:
            img_parts.extend((' height="', str(img_group["height"]), '"'))

        img_parts.append(">")
        img_html = "".join(img_parts)

        if len(groups) == 1:
            return img_html

        parts = ["<picture" + self._render_attrs(pic_attrs) + ">"]
        for idx, group in enumerate(groups):
            if idx == img_index or not group["srcset"]:
                continue
            parts.append(
                '<source type="' + escape(group["type"]) +
                '" srcset="' + escape(group["srcset"]) + '">'
            )
        parts.append(img_html)
        parts.append("</picture>")
        return "".join(parts)

    def GetAssetPath(
        self,
        source: str,
        segment: Optional[Any] = None,
        format: Optional[str] = None,
        dpr: Optional[Union[int, str]] = None,
    ) -> str:
        cache = self._src_cache
        if cache is not None and cache[0] == source:
            source_format = cache[3]
            prefix = cache[4]
        else:
            path, source_name, source_format = self._split_source(source)
            if source_format:
                name = source_name + "-" + source_format
            else:
                name = source_name
            prefix = self._baseURL + path + "/" + name + "/" if path else self._baseURL + name + "/"
            self._src_cache = (source, path, source_name, source_format, prefix)

        if segment is None:
            seg_str = "x"
        elif isinstance(segment, str):
            seg_str = segment
        else:
            seg_str = self._segment_to_string(segment)

        out_format = resolve_format(
            format if format else (self._format if self._format else ""),
            source_format,
        )

        dpr_val = self._parse_dpr(self._dpr if dpr is None else dpr)
        if dpr_val >= 2:
            return prefix + seg_str + "@" + str(dpr_val) + "." + out_format
        return prefix + seg_str + "." + out_format

    def _admin_request(self, target: Any, wait: bool, endpoint: str, method: str) -> bool:
        if not self._token or not self._adminURL:
            return False

        if isinstance(target, str):
            body: Dict[str, Any] = {"source": target}
        else:
            assets: List[str] = []
            if isinstance(target, list):
                if target and all(isinstance(item, str) for item in target):
                    assets = [item for item in target]
                else:
                    for item in target:
                        assets.extend(p_str["path"] for p_str in item["paths"])
            else:
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
        return self._admin_request(target, wait, "/admin/assets/generate", "POST")

    def AdminDelete(
        self,
        target: Union[str, AssetType, List[AssetType], List[str]],
        wait: bool = False,
    ) -> bool:
        return self._admin_request(target, wait, "/admin/assets/delete", "DELETE")
