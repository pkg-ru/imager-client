#!/usr/bin/env python3
"""Синхронизация версии пакета из git-тега в манифесты.

Источник истины — git-тег вида v1.2.3. Скрипт обновляет поле version
в package.json (npm), pyproject.toml (PyPI) и манифестах фреймворк-пакетов
(packages/react, packages/vue, packages/twig) перед сборкой/публикацией.
Версия фреймворк-пакетов — та же, что у основных пакетов (из тега).

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
PYPROJECT_TOML = ROOT / "pyproject.toml"
# Фреймворк-пакеты: версия та же, что у основных пакетов (из тега).
# composer.json (twig) не трогаем: Packagist берёт версию из git-тега.
FRAMEWORK_PACKAGE_JSONS = [
    ROOT / "packages" / "react" / "package.json",
    ROOT / "packages" / "vue" / "package.json",
]

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
    sync_pyproject_toml(version)
    for path in FRAMEWORK_PACKAGE_JSONS:
        sync_package_json(path, version)


if __name__ == "__main__":
    main()
