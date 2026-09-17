"""Типы и структуры клиентской библиотеки imager."""
from __future__ import annotations

from typing import List, TypedDict, Union

__all__ = [
    "AssetPath",
    "AssetType",
    "ImagerOptions",
    "ImagerServerOptions",
    "Segment",
    "IMAGE_FORMATS",
    "normalize_format",
    "resolve_format",
    "dedupe_formats",
]

# Форматы картинок, поддерживаемые сервисом. Всё, что не входит в этот
# список (видео и прочее), при format="auto"/"" трактуется как не-картинка.
IMAGE_FORMATS = frozenset(
    ("jpg", "jpeg", "png", "webp", "avif", "heif", "heic", "apng", "jxl", "gif")
)


def normalize_format(format: str) -> str:
    """Нормализация формата: lower-case, jpeg → jpg."""
    if format == "jpeg":
        return "jpg"
    if format.isupper():
        return format.lower()
    return format


def resolve_format(format: str, source_format: str) -> str:
    """Резолв одного формата: "auto"/"" → исходный формат, если он картинка, иначе jpg."""
    if format == "auto" or format == "":
        return source_format if source_format in IMAGE_FORMATS else "jpg"
    return normalize_format(format)


def dedupe_formats(formats: List[str]) -> List[str]:
    """Дедупликация списка форматов (jpeg → jpg, первое вхождение сохраняет позицию)."""
    seen = set()
    result = []
    for fmt in formats:
        fmt = normalize_format(fmt)
        if fmt not in seen:
            seen.add(fmt)
            result.append(fmt)
    return result


class AssetPath(TypedDict, total=False):
    """Один вариант ассета внутри paths."""

    path: str
    dpr: Union[int, float]
    width: int
    height: int


class _AssetTypeRequired(TypedDict):
    """Обязательные поля AssetType."""

    type: str
    paths: List[AssetPath]


class AssetType(_AssetTypeRequired, total=False):
    """Результат GetAsset / элемента GetAssets."""

    source_format: bool
    all_support: bool


class ImagerOptions(TypedDict, total=False):
    """Настройки клиентской части."""

    dpr: int
    format: str
    formats: List[str]
    baseURL: str
    sort: bool


class ImagerServerOptions(ImagerOptions, total=False):
    """Настройки серверной части."""

    token: str
    adminURL: str


Segment = Union[str, dict, list, tuple]


def mime_for(format: str) -> str:
    """MIME для итогового формата."""

    if format == "jpg":
        return "image/jpeg"
    return "image/" + format
