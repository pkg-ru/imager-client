# Docker-образ для запуска benchmarks проекта imager-client.
#
# Сборка (из корня проекта, контекст — корень, т.к. нужны src/, go.mod и т.д.):
#     docker build -t imager-benchmarks -f benchmarks/Dockerfile .
#
# Запуск всех бенчмарков (Go, PHP, Python, TS) на всех масштабах:
#     docker run --rm imager-benchmarks
#
# Разовые запуски внутри контейнера:
#     docker run --rm imager-benchmarks go run benchmarks/bench.go 100000
#     docker run --rm imager-benchmarks php benchmarks/bench.php 100000
#     docker run --rm imager-benchmarks python3 benchmarks/bench.py 100000
#     docker run --rm imager-benchmarks tsx benchmarks/bench.ts 100000

FROM php:8.3-cli-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    GOTOOLCHAIN=local \
    PATH="/usr/local/go/bin:${PATH}"

# Python 3 (bookworm: 3.11) и Node.js/npm (bookworm: 18.x) из apt,
# PHP 8.3 + ext-curl уже в базовом образе.
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        unzip \
        python3 \
        nodejs \
        npm \
    && rm -rf /var/lib/apt/lists/*

# Composer — из официального образа.
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# Go 1.23.7 — версия из go.mod (GOTOOLCHAIN=local запрещает автозагрузку).
RUN curl -fsSL https://go.dev/dl/go1.23.7.linux-amd64.tar.gz -o /tmp/go.tgz \
    && tar -C /usr/local -xzf /tmp/go.tgz \
    && rm /tmp/go.tgz \
    && go version

# tsx — раннер TypeScript-бенчмарка.
RUN npm install --global tsx@4 \
    && tsx --version

WORKDIR /app

COPY . .

# PHP-зависимости (autoload для src/imager-php).
RUN composer install --no-dev --no-interaction --no-progress --optimize-autoloader

CMD ["bash", "/app/benchmarks/run-benchmarks.sh"]
