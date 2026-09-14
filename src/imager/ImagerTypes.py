"""Типы и структуры клиентской библиотеки imager."""
from __future__ import annotations

from typing import List, TypedDict, Union

__all__ = [
    "AssetPath",
    "AssetType",
    "ImagerOptions",
    "ImagerServerOptions",
    "Segment",
]


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
