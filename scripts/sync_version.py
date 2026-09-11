#!/usr/bin/env python3
"""Синхронизация версии пакета из git-тега в манифесты.

Источник истины — git-тег вида v1.2.3. Скрипт обновляет поле version
в package.json и package-lock.json (npm), pyproject.toml (PyPI)
и манифестах фреймворк-пакетов (packages/react, packages/vue)
перед сборкой/публикацией. Версия фреймворк-пакетов — та же,
что у основных пакетов (из тега). Также обновляются диапазоны
зависимостей от imager-client: peerDependencies.imager-client
(>=версия) в packages/react и packages/vue (включая lock-файлы)
и require.pkg-ru/imager-client (^версия) в packages/twig/composer.json.

Использование:
    python scripts/sync_version.py v1.2.3
    python scripts/sync_version.py 1.2.3
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGE_JSON = ROOT / "package.json"
PACKAGE_LOCK_JSON = ROOT / "package-lock.json"
PYPROJECT_TOML = ROOT / "pyproject.toml"
# Фреймворк-пакеты: версия та же, что у основных пакетов (из тега).
FRAMEWORK_PACKAGE_JSONS = [
    ROOT / "packages" / "react" / "package.json",
    ROOT / "packages" / "vue" / "package.json",
]
# lock-файлы npm должны соответствовать package.json (иначе npm ci упадёт).
FRAMEWORK_PACKAGE_LOCK_JSONS = [
    ROOT / "packages" / "react" / "package-lock.json",
    ROOT / "packages" / "vue" / "package-lock.json",
]
# Twig-пакет: диапазон зависимости от imager-client (^версия).
TWIG_COMPOSER_JSON = ROOT / "packages" / "twig" / "composer.json"

SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")


def parse_version(tag: str) -> str:
    """Извлекает semver-версию из имени тега (v1.2.3 -> 1.2.3)."""
    version = tag[1:] if tag.startswith("v") else tag
    if not SEMVER_RE.match(version):
        raise SystemExit(
            f"Некорректная версия в теге: {tag!r}. "
            "Ожидается semver вида v1.2.3"
        )
    return version


def sync_package_json(path: Path, version: str) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    data["version"] = version
    path.write_text(
        json.dumps(data, indent=4, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"{path.relative_to(ROOT)}: version -> {version}")


def sync_package_lock_json(path: Path, version: str) -> None:
    """Обновляет version в package-lock.json (корень и packages['']).

    lock-файл npm должен совпадать с package.json, иначе npm ci
    в CI упадёт с EUSAGE после простановки версии тега.
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    data["version"] = version
    packages = data.get("packages", {})
    for key in ("", "..", "../.."):
        if key in packages:
            packages[key]["version"] = version
    path.write_text(
        json.dumps(data, indent=4, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"{path.relative_to(ROOT)}: version -> {version}")


def sync_peer_dependency(path: Path, version: str) -> None:
    """Обновляет peerDependencies.imager-client (>=версия).

    В package.json peerDependencies лежит на верхнем уровне,
    в package-lock.json — внутри packages[''].
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    containers = [data]
    packages = data.get("packages")
    if isinstance(packages, dict) and "" in packages:
        containers.append(packages[""])
    updated = False
    for container in containers:
        peers = container.get("peerDependencies")
        if isinstance(peers, dict) and "imager-client" in peers:
            peers["imager-client"] = f">={version}"
            updated = True
    if not updated:
        raise SystemExit(
            f"{path.relative_to(ROOT)}: peerDependencies.imager-client не найдено"
        )
    path.write_text(
        json.dumps(data, indent=4, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"{path.relative_to(ROOT)}: peerDependencies.imager-client -> >={version}")


def sync_composer_require(version: str) -> None:
    """Обновляет require['pkg-ru/imager-client'] (^версия) в composer.json."""
    data = json.loads(TWIG_COMPOSER_JSON.read_text(encoding="utf-8"))
    require = data.get("require", {})
    if "pkg-ru/imager-client" not in require:
        raise SystemExit(
            f"{TWIG_COMPOSER_JSON.relative_to(ROOT)}: "
            "require['pkg-ru/imager-client'] не найдено"
        )
    require["pkg-ru/imager-client"] = f"^{version}"
    TWIG_COMPOSER_JSON.write_text(
        json.dumps(data, indent=4, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(
        f"{TWIG_COMPOSER_JSON.relative_to(ROOT)}: "
        f"require['pkg-ru/imager-client'] -> ^{version}"
    )


def sync_pyproject_toml(version: str) -> None:
    text = PYPROJECT_TOML.read_text(encoding="utf-8")
    new_text, count = re.subn(
        r"^(version\s*=\s*)\"[^\"]*\"",
        lambda m: f'{m.group(1)}"{version}"',
        text,
        count=1,
        flags=re.MULTILINE,
    )
    if count != 1:
        raise SystemExit("pyproject.toml: поле version не найдено")
    PYPROJECT_TOML.write_text(new_text, encoding="utf-8")
    print(f"pyproject.toml: version -> {version}")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"Использование: {sys.argv[0]} <tag>")
    version = parse_version(sys.argv[1])
    sync_package_json(PACKAGE_JSON, version)
    sync_package_lock_json(PACKAGE_LOCK_JSON, version)
    sync_pyproject_toml(version)
    for path in FRAMEWORK_PACKAGE_JSONS:
        sync_package_json(path, version)
        sync_peer_dependency(path, version)
    for path in FRAMEWORK_PACKAGE_LOCK_JSONS:
        sync_package_lock_json(path, version)
        sync_peer_dependency(path, version)
    sync_composer_require(version)


if __name__ == "__main__":
    main()
