"""Пакет imager — клиент микросервиса imager (Python-реализация).

Экспортирует класс Imager и типы AssetType/AssetPath.
"""
from .Imager import Imager
from .ImagerTypes import AssetPath, AssetType, ImagerOptions, ImagerServerOptions, Segment

__all__ = [
    "Imager",
    "AssetPath",
    "AssetType",
    "ImagerOptions",
    "ImagerServerOptions",
    "Segment",
]
