// Benchmark for gitverse.ru/pkg-ru/imager-client/v2 (Go implementation).
//
// Запуск из корня проекта:
//
//	go run docs/bench.go [iterations]
//
// Измеряет клиентские операции (формирование URL/AssetType/HTML) — чистые
// функции без HTTP. Админ-методы не бенчмаркастся.
package main

import (
	"fmt"
	"os"
	"strconv"
	"time"

	imager "gitverse.ru/pkg-ru/imager-client/v2"
)

func bench(name string, fn func(), iterations int) {
	start := time.Now()
	for i := 0; i < iterations; i++ {
		fn()
	}
	elapsed := time.Since(start).Seconds()
	ops := float64(iterations) / elapsed
	us := (elapsed / float64(iterations)) * 1_000_000
	fmt.Printf("%s: %.0f ops/s, %.2f μs/op\n", name, ops, us)
}

func main() {
	im := imager.New(imager.Options{BaseURL: "https://cdn.example.com/"})

	n := 100_000
	if len(os.Args) > 1 {
		if parsed, err := strconv.Atoi(os.Args[1]); err == nil && parsed > 0 {
			n = parsed
		}
	}

	bench("GetAsset", func() { im.GetAsset("image.jpg", "200x200", "webp", nil) }, n)
	bench("GetAssets", func() { im.GetAssets("image.jpg", []any{"200x200", "400x400"}, []string{"webp", "avif"}, nil) }, n)
	bench("GetAssetPath", func() { im.GetAssetPath("image.jpg", "200x200", "webp", nil) }, n)
	bench("GetAssetsHtml", func() { im.GetAssetsHtml("image.jpg", []any{"200x200", "400x400"}, []string{"webp", "avif"}, nil, nil) }, n)
}
