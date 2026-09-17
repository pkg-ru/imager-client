#!/usr/bin/env bash
# Прогон всех benchmark-скриптов imager-client на четырёх масштабах
# (1k / 10k / 100k / 1M итераций) внутри Docker-контейнера.
set -euo pipefail
cd /app

echo "=== Environment ==="
echo "Kernel: $(uname -sr)"
echo "CPU: $(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | sed 's/^ *//' || echo n/a)"
echo "Cores: $(nproc)"
go version
php -r 'echo "PHP ", PHP_VERSION, "\n";'
python3 --version
node --version
tsx --version

for n in 1000 10000 100000 1000000; do
    echo ""
    echo "=== Scale: ${n} iterations ==="

    echo "--- Go ---"
    go run benchmarks/bench.go "${n}"

    echo "--- PHP ---"
    php benchmarks/bench.php "${n}"

    echo "--- Python ---"
    python3 benchmarks/bench.py "${n}"

    echo "--- TypeScript ---"
    tsx benchmarks/bench.ts "${n}"
done

echo ""
echo "=== Done ==="
