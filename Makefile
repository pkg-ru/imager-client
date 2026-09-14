.PHONY: test build lint test-react test-vue test-twig build-react build-vue

# Единый прогон: ядра (Go/TS/PHP/Python) + фреймворк-пакеты react/vue
# (golden-сценарий по test/fixture.json). Twig в golden-прогоне не участвует.
test:
	go run test/test.go

test-react:
	cd packages/react && npm test

test-vue:
	cd packages/vue && npm test

# Локальный тест twig: сверка расширения с ядром PHP (не golden).
test-twig:
	cd packages/twig && php test/test.php

build:
	npm run build

# Пакеты зависят от ядра (imager-client: file:../..) — сначала собираем ядро.
build-react: build
	cd packages/react && npm run build

build-vue: build
	cd packages/vue && npm run build

lint:
	npm run lint
