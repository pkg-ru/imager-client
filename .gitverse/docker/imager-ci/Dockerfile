# syntax=docker/dockerfile:1
#
# CI-образ для GitVerse-пайплайна pkg-ru/imager-client.
#
# Назначение: единый предварительно собранный toolchain для job build-test
# (.gitverse/workflows/publish.yml). Образ НЕ содержит исходников проекта,
# node_modules, vendor, .git и артефактов сборки — только инструменты.
#
# Версии (зафиксированы, без latest):
#   PHP       8.1.x   (php:8.1-cli-bookworm, multi-stage: копируется /usr/local)
#   Composer  <COMPOSER_VERSION> (getcomposer.org)
#   Node      22.x    (nodejs.org, официальные бинарники)
#   npm       — совместимая версия из дистрибутива Node 22
#   Python    3.12.x  (python:3.12-slim-bookworm, multi-stage)
#   Go        1.23.7  (go.dev, официальные бинарники; версия из go.mod)
#
# Multi-stage: PHP и Python собираются в отдельных stage, в финальный слой
# копируется только /usr/local — это убирает build-пакеты (PHPIZE_DEPS,
# build-essential) из итогового образа и уменьшает размер слоёв (важно для
# лимита blob в GitVerse Container Registry).
#
# Сборка:
#   docker build -f .gitverse/docker/imager-ci/Dockerfile \
#     -t gitverse.ru/pkg-ru/imager-ci:2026.09.1 .
#
# Публикация в GitVerse Container Registry (cloud runner без Docker daemon):
#   сборка через Kaniko, push в gitverse.ru/pkg-ru/imager-ci:<version>.
#   См. README.md в этом каталоге.

# --------------------------------------------------------------------------- #
#  Stage: php-builder — PHP 8.1 CLI (официальный образ)                       #
#  Используется только для сборки PHP + extensions. В финальный слой          #
#  копируется только /usr/local (php, extensions, php.ini), чтобы не тащить   #
#  PHPIZE_DEPS (build-essential и т.п.) в итоговый образ.                     #
# --------------------------------------------------------------------------- #
FROM php:8.1-cli-bookworm AS php-builder

# Требования к extensions определены из composer.json / composer.lock / кода:
#   ext-curl  — composer.json (require) + src/imager-php/Imager.php (curl_*);
#   ext-iconv — symfony/polyfill-mbstring (composer.lock, Twig 3.28);
#               iconv УЖЕ встроен в php:8.1-cli-bookworm;
#   ctype/mbstring — встроены в ядро PHP 8.1 (polyfill не нужен);
#   xml/zip   — НЕ используются проектом, не устанавливаем.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends libcurl4-openssl-dev; \
    docker-php-ext-install curl; \
    rm -rf /var/lib/apt/lists/*; \
    php -m | grep -E '^(curl|iconv)$'

# --------------------------------------------------------------------------- #
#  Stage: node — официальные бинарники Node.js 22 (nodejs.org)                #
#  Распаковываем в /opt/node, удаляем лишнее (заголовки C, man, docs npm).    #
# --------------------------------------------------------------------------- #
FROM debian:bookworm-slim AS node-stage

# Node.js 22 LTS — фиксированная версия (без latest).
# Обновлять только осознанно: npm из этого дистрибутива.
ARG NODE_VERSION=22.14.0
ARG NODE_DISTRO=linux-x64

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends xz-utils curl ca-certificates; \
    rm -rf /var/lib/apt/lists/*; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_DISTRO}.tar.xz"; \
    tar -xJf "node-v${NODE_VERSION}-${NODE_DISTRO}.tar.xz" -C /opt; \
    mv "/opt/node-v${NODE_VERSION}-${NODE_DISTRO}" /opt/node; \
    # Удаляем лишнее: заголовки C (не нужны для JS-сборки), man, docs npm
    rm -rf /opt/node/include /opt/node/share /opt/node/lib/node_modules/npm/docs /opt/node/lib/node_modules/npm/man; \
    rm -f "node-v${NODE_VERSION}-${NODE_DISTRO}.tar.xz"

# --------------------------------------------------------------------------- #
#  Stage: go — официальные бинарники Go 1.23.7 (go.dev)                       #
#  Версия ровно из go.mod (go 1.23.7). Распаковываем в /opt/go, удаляем       #
#  неиспользуемые каталоги (test/misc/api/doc/blog/tour) для уменьшения слоя. #
# --------------------------------------------------------------------------- #
FROM debian:bookworm-slim AS go-stage

ARG GO_VERSION=1.23.7
ARG GO_ARCH=amd64

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates; \
    rm -rf /var/lib/apt/lists/*; \
    curl -fsSLO "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"; \
    # Официальный Go-архив распаковывается в каталог go/ (не go<version>/).
    tar -xzf "go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" -C /opt; \
    # Удаляем неиспользуемые каталоги (не нужны для go run test/test.go).
    # pkg/linux_amd64 и src оставляем — нужны для быстрой компиляции stdlib.
    rm -rf /opt/go/test /opt/go/misc /opt/go/api /opt/go/doc /opt/go/blog /opt/go/tour; \
    rm -f "go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"

# --------------------------------------------------------------------------- #
#  Stage: python — официальный Python 3.12 (Debian bookworm)                  #
#  Копируем только /usr/local (python3, pip, site-packages).                  #
# --------------------------------------------------------------------------- #
FROM python:3.12-slim-bookworm AS python-stage

# --------------------------------------------------------------------------- #
#  Финальный слой: Debian bookworm-slim + toolchain                           #
# --------------------------------------------------------------------------- #
FROM debian:bookworm-slim

# Версия Composer — фиксированная стабильная (без latest).
ARG COMPOSER_VERSION=2.9.1

# --- Системные пакеты (runtime) -------------------------------------------- #
# git, curl, ca-certificates — нужны pipeline (checkout, push, dispatch).
# libcurl4 и прочие runtime-библиотеки — для PHP-расширений (curl, mbstring,
# openssl, sqlite, sodium, argon2, readline, xml, zlib).
# Единый apt-get install + очистка /var/lib/apt/lists/* и apt-кэша.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        libcurl4 \
        libonig5 \
        libxml2 \
        libssl3 \
        libsqlite3-0 \
        libargon2-1 \
        libsodium23 \
        libreadline8 \
        zlib1g; \
    rm -rf /var/lib/apt/lists/*; \
    apt-get clean

# --- PHP 8.1 + extensions (из php-builder) --------------------------------- #
# Копируем только /usr/local (php, extensions, php.ini, pear).
COPY --from=php-builder /usr/local /usr/local
ENV PATH="/usr/local/bin:${PATH}"

# --- Composer -------------------------------------------------------------- #
# Официальный установщик getcomposer.org, фиксированная версия.
RUN set -eux; \
    curl -fsSL "https://getcomposer.org/download/${COMPOSER_VERSION}/composer.phar" -o /usr/local/bin/composer; \
    chmod +x /usr/local/bin/composer; \
    composer --version

# --- Node.js 22 + npm ------------------------------------------------------ #
COPY --from=node-stage /opt/node /opt/node
ENV PATH="/opt/node/bin:${PATH}"
RUN set -eux; \
    node --version; \
    npm --version

# --- Python 3.12 ----------------------------------------------------------- #
# Копируем /usr/local из python:3.12-slim-bookworm (python3, pip, site-packages).
COPY --from=python-stage /usr/local /usr/local
ENV PATH="/usr/local/bin:${PATH}"
# Оркестратор (test/test.go) и workflow вызывают именно `python` — alias.
RUN set -eux; \
    ln -sf /usr/local/bin/python3 /usr/local/bin/python; \
    python --version; \
    python3 --version

# --- Go 1.23.7 ------------------------------------------------------------- #
COPY --from=go-stage /opt/go /opt/go
ENV PATH="/opt/go/bin:${PATH}" \
    GOROOT="/opt/go"
RUN set -eux; \
    go version

# --- Диагностика окружения ------------------------------------------------- #
# Быстрая проверка, что образ собран корректно (дублирует шаг
# "Check CI environment" в publish.yml).
RUN set -eux; \
    php --version; \
    composer --version; \
    node --version; \
    npm --version; \
    python3 --version; \
    go version

# Рабочий каталог по умолчанию (checkout в GitVerse монтируется в $GITHUB_WORKSPACE).
WORKDIR /workspace
