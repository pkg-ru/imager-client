# Benchmarks

Бенчмарки клиентской части Imager Client. Документ содержит методологию измерений и воспроизводимые скрипты. Готовых результатов в репозитории нет — таблицы в разделе [Results](#results) заполняются после запуска скриптов на целевом железе.

## Methodology

### What is measured

Измеряется CPU/memory overhead **клиентских операций** Imager Client — формирование URL, `AssetType`, `AssetPath` и HTML. Работа самого Imager Service (генерация, кэширование, отдача изображений) **не измеряется**: клиентские методы — чистые функции конкатенации строк без HTTP-запросов.

### Measured operations

| Operation | Что делает |
|---|---|
| `GetAsset` | генерация одного `AssetType` (single asset URL) |
| `GetAssets` | пакетная генерация `AssetType[]` (несколько сегментов × форматы) |
| `GetAssetPath` | генерация одного пути (строки) |
| `GetAssetsHtml` | генерация HTML `<picture>`/`<img>` с `srcset` |

### Scale

Каждая операция прогоняется на четырёх масштабах:

- 1 000 операций
- 10 000 операций
- 100 000 операций
- 1 000 000 операций

Скрипты в этом каталоге по умолчанию используют 100 000 итераций на операцию; для остальных масштабов передайте количество итераций аргументом (см. раздел [Running benchmarks](#running-benchmarks)).

### Metrics

- **Operations per second (ops/s)** — пропускная способность.
- **Time per operation (μs)** — обратная величина, удобна для оценки latency.
- **Memory allocation** — где применимо (Go: `go test -benchmem`; Python/PHP/TS — через профилировщик платформы, в базовых скриптах не измеряется).

### Environment requirements

Для воспроизводимости фиксируйте при запуске:

- **Runtime version** — Python 3.10+, PHP 8.1+, Node 18+ (tsx), Go 1.23.7+;
- **OS** — версия и ядро;
- **CPU** — модель, частота, число ядер;
- Режим питания/турбо-буст, фоновая нагрузка (желательно — отсутствие).

Пример строки окружения для отчёта:

```
Ubuntu 24.04, AMD Ryzen 7 5800X, Python 3.12.3, PHP 8.3.8, Node 22.4.0, Go 1.23.7
```

## Running benchmarks

### Python

```bash
python docs/bench.py [iterations]
```

Пример: `python docs/bench.py 1000000`

### PHP

```bash
php docs/bench.php [iterations]
```

Пример: `php docs/bench.php 1000000`

### TypeScript

```bash
npx tsx docs/bench.ts [iterations]
```

Пример: `npx tsx docs/bench.ts 1000000`

### Go

```bash
go run docs/bench.go [iterations]
```

Пример: `go run docs/bench.go 1000000`

## Results

### Запуск от 2026-09-17 (Docker)

- **Дата:** 2026-09-17
- **Окружение:** Docker (образ `imager-benchmarks`, собран из `benchmarks/Dockerfile` на базе `php:8.3-cli-bookworm`), Windows 11 + Docker Desktop (WSL2), ядро Linux 6.6.87.2-microsoft-standard-WSL2
- **CPU:** AMD Ryzen 9 5900X 12-Core Processor, 24 ядра (SMT)
- **Рантаймы:** Go 1.23.7, PHP 8.3.33, Python 3.11.2, Node.js 18.20.4 (tsx 4.23.13)
- **Запуск:** `docker run --rm imager-benchmarks` (скрипт `benchmarks/run-benchmarks.sh` прогоняет все четыре скрипта на масштабах 1k / 10k / 100k / 1M)

### Python

| Operation | 1k (ops/s) | 10k (ops/s) | 100k (ops/s) | 1M (ops/s) |
|-----------|------------|-------------|--------------|------------|
| GetAsset | 944,872 | 974,973 | 1,008,158 | 975,515 |
| GetAssets | 230,216 | 240,980 | 259,427 | 258,634 |
| GetAssetPath | 3,027,074 | 3,206,944 | 3,187,147 | 3,237,073 |
| GetAssetsHtml | 72,424 | 78,318 | 81,169 | 77,362 |

### PHP

| Operation | 1k (ops/s) | 10k (ops/s) | 100k (ops/s) | 1M (ops/s) |
|-----------|------------|-------------|--------------|------------|
| GetAsset | 907,824 | 940,661 | 957,432 | 981,576 |
| GetAssets | 279,291 | 291,976 | 291,814 | 303,002 |
| GetAssetPath | 1,309,536 | 1,400,908 | 1,397,945 | 1,344,114 |
| GetAssetsHtml | 121,770 | 131,983 | 130,345 | 129,715 |

### TypeScript

| Operation | 1k (ops/s) | 10k (ops/s) | 100k (ops/s) | 1M (ops/s) |
|-----------|------------|-------------|--------------|------------|
| GetAsset | 517,292 | 1,078,217 | 3,056,668 | 4,228,795 |
| GetAssets | 178,939 | 355,535 | 954,579 | 1,182,102 |
| GetAssetPath | 2,714,706 | 4,723,737 | 12,475,741 | 18,007,668 |
| GetAssetsHtml | 96,021 | 271,455 | 377,429 | 390,846 |

### Go

| Operation | 1k (ops/s) | 10k (ops/s) | 100k (ops/s) | 1M (ops/s) |
|-----------|------------|-------------|--------------|------------|
| GetAsset | 3,290,437 | 3,499,680 | 4,057,411 | 4,712,038 |
| GetAssets | 870,113 | 979,291 | 1,338,045 | 1,355,955 |
| GetAssetPath | 3,790,406 | 8,035,814 | 7,164,634 | 7,355,996 |
| GetAssetsHtml | 219,941 | 495,045 | 527,551 | 517,395 |

> **Примечание:** числа на масштабе 1k/10k для JIT-рантаймов (TS) заметно ниже из-за прогрева V8; на больших масштабах значения стабильнее. Прямое сравнение языков см. в [Notes](#notes).

## Notes

- Клиентские методы — чистые функции конкатенации строк, без HTTP-запросов; админ-методы (`AdminGenerate`/`AdminDelete`) в бенчмарках не участвуют.
- Результаты могут варьироваться в зависимости от hardware и runtime version — всегда указывайте окружение рядом с числами.
- Не сравнивать языки в формате «X в N раз быстрее» без полной методологии: различия JIT/AOT, GC, аллокаций и warm-up делают прямое сравнение некорректным без одинаковых условий и нескольких прогонов.
- Для Go дополнительно можно использовать нативный фреймворк: `go test -bench=. -benchmem ./...` (при добавлении `*_test.go` бенчмарков).

## License

[GPL-3.0](../LICENSE)

## Author

© 2025 [Алтухов Владислав Владимирович](https://altuh.ru/about)
