# imager-ci — CI-образ для GitVerse-пайплайна

Единый предварительно собранный toolchain для job `build-test`
([`.gitverse/workflows/publish.yml`](../../workflows/publish.yml)) проекта
`pkg-ru/imager-client`.

Образ **не содержит** исходников проекта, `node_modules`, `vendor`, `.git`
и артефактов сборки — только инструменты. Toolchain устанавливается один раз
при сборке образа, а не в каждом запуске workflow.

## Версии (зафиксированы, без `latest`)

| Инструмент | Версия | Источник |
|---|---|---|
| PHP | 8.1.34 (CLI) | `php:8.1-cli-bookworm` (официальный образ) |
| Composer | 2.9.1 | getcomposer.org (фиксированный phar) |
| Node.js | 22.14.0 | nodejs.org (официальные бинарники) |
| npm | 10.9.2 | из дистрибутива Node 22 |
| Python | 3.12.14 | `python:3.12-slim-bookworm` (multi-stage) |
| Go | 1.23.7 | go.dev (официальные бинарники; версия из `go.mod`) |

PHP-расширения: `curl` (требует `composer.json` + `src/imager-php/Imager.php`),
`iconv` (требует `symfony/polyfill-mbstring` из `composer.lock`). `ctype`,
`mbstring`, `json`, `openssl`, `zlib` встроены в PHP 8.1. XML/zip не нужны.

## Сборка

Локально (Docker):

```bash
docker build -f .gitverse/docker/imager-ci/Dockerfile \
  -t gitverse.ru/pkg-ru/imager-ci:2026.09.1 .
```

В GitVerse (cloud runner без Docker daemon) — через **Kaniko**:

```bash
docker run --rm \
  -v "$PWD":/workspace \
  -e DESTINATION=gitverse.ru/pkg-ru/imager-ci:2026.09.1 \
  gcr.io/kaniko-project/executor:latest \
  --context=/workspace \
  --dockerfile=/workspace/.gitverse/docker/imager-ci/Dockerfile \
  --destination=gitverse.ru/pkg-ru/imager-ci:2026.09.1
```

(аутентификация в GitVerse Container Registry — через `--registry-*` флаги
или `docker login` на хосте с Docker daemon).

## Публикация в GitVerse Container Registry

```bash
# 1. Собрать образ
docker build -f .gitverse/docker/imager-ci/Dockerfile -t gitverse.ru/pkg-ru/imager-ci:2026.09.1 .

# 2. Войти в registry (username — имя пользователя GitVerse)
docker login gitverse.ru

# 3. Опубликовать
docker push gitverse.ru/pkg-ru/imager-ci:2026.09.1
```

После публикации проверить доступность:

```bash
docker pull gitverse.ru/pkg-ru/imager-ci:2026.09.1
```

## Тестирование образа

```bash
docker run --rm imager-ci:test php -v
docker run --rm imager-ci:test composer --version
docker run --rm imager-ci:test node --version
docker run --rm imager-ci:test npm --version
docker run --rm imager-ci:test python3 --version
docker run --rm imager-ci:test go version
docker run --rm imager-ci:test php -m   # проверить curl, iconv
```

Полный прогон pipeline-команд внутри образа (монтируя исходники):

```bash
docker run --rm -v "$PWD":/workspace -w /workspace imager-ci:test sh -c "
  npm ci && npm run build && go run test/test.go &&
  cd packages/react && npm ci && npm test &&
  cd ../vue && npm ci && npm test &&
  cd ../.. && composer install --no-interaction --no-progress --prefer-dist &&
  php packages/twig/test/test.php"
```

## Публикация новой версии образа

1. Измените версии toolchain в `Dockerfile` (при необходимости).
2. Соберите и протестируйте образ локально (см. выше).
3. Опубликуйте в GitVerse Container Registry под новым immutable-тегом
   (например, `2026.09.1` → `2026.10.1`). Не перезаписывайте существующие теги.
4. Обновите `image:` в `.gitverse/workflows/publish.yml` на новый тег.
5. Запустите workflow на теге `v*` и убедитесь, что шаг
   `Check CI environment` показывает ожидаемые версии.

Обновление образа — **отдельное контролируемое изменение**, не часть
release-пайплайна. `publish.yml` всегда ссылается на зафиксированный тег.

## Registry

Образ публикуется в GitVerse Container Registry:

```text
gitverse.ru/pkg-ru/imager-ci:<version>
```

Это Docker-образ (не Git-репозиторий). Для pull на cloud runner образ должен
быть публичным, либо runner должен иметь доступ к registry (см. документацию
GitVerse по аутентификации runner в Container Registry).

## Текущий статус (2026-09-11)

- Образ `gitverse.ru/pkg-ru/imager-ci:2026.09.1` **опубликован** в GitVerse
  Container Registry (digest `sha256:5b0775fc68cce04a226d0ba9cddc4ad4f96738cebe71d88fd74a38f3d69a4e1e`).
- Образ **публичный** — pull без аутентификации работает (проверено).
- Размер: **~975 MB** (после multi-stage оптимизации; лимит blob GitVerse
  Registry соблюдён — push прошёл без ошибки 413).
