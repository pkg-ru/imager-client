"""Типы и структуры клиентской библиотеки imager.

Содержит:
- TypedDict-структуры AssetPath / AssetType (результаты клиентских методов);
- TypedDict ImagerOptions / ImagerServerOptions (настройки конструктора);
- псевдонимы Segment и список MIME-типов по формату.
"""
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
    """Один вариант ассета внутри `paths`.

    Все поля опциональны (`total=False`): включаются в сериализацию
    только если заданы, в порядке path, dpr, width, height.
    """

    path: str
    dpr: int
    width: int
    height: int


class _AssetTypeRequired(TypedDict):
    """Обязательные поля AssetType (порядок ключей: type, paths)."""

    type: str
    paths: List[AssetPath]


class AssetType(_AssetTypeRequired, total=False):
    """Результат GetAsset / элемента GetAssets.

    Опциональные поля (в JSON включаются только при true):
        source_format — итоговый формат совпадает с исходным форматом файла;
        all_support   — формат поддерживается всеми браузерами (jpg/jpeg/gif/png).
    """

    source_format: bool
    all_support: bool


class ImagerOptions(TypedDict, total=False):
    """Настройки клиентской части."""

    dpr: int
    format: str
    formats: List[str]
    baseURL: str


class ImagerServerOptions(ImagerOptions, total=False):
    """Настройки серверной части (добавляет token и adminURL)."""

    token: str
    adminURL: str


#: строка / {width,height} / [width,height]
Segment = Union[str, dict, list, tuple]

def mime_for(format: str) -> str:
    """MIME для итогового формата; неизвестный/видео → пустая строка."""
    if format == "jpg":
        format = 'jpeg'
    return "image/" + format
