// Package imager — Go-клиент микросервиса Imager.
//
// Построение путей/URL ассетов (GetAsset/GetAssets/GetAssetPath/GetAssetsHtml)
// и админ-методы (AdminGenerate/AdminDelete). Без внешних зависимостей,
// только стандартная библиотека (net/http — для админ-методов).
//
// Установка:
//
//	go get gitverse.ru/pkg-ru/imager-client/v2
//
// Импорт:
//
//	import imager "gitverse.ru/pkg-ru/imager-client/v2"
//
// Краткий пример:
//
//	i := imager.New(imager.Options{
//		BaseURL: "https://imgs.example.com/images/",
//		Format:  "webp",
//	})
//	asset := i.GetAsset("/test.gif", imager.Size{Width: 200, Height: 200}, "gif", 2)
//	url := i.GetAssetPath("/test.gif", "200x200", "webp")
//
// Полная документация: doc/GO-RU.md (русский), doc/GO-EN.md (English).
//
// Реализация находится в src/imager-go/ (Imager.go, ImagerTypes.go);
// этот файл реэкспортирует её публичную часть через type aliases
// и обёртку конструктора New (Go не поддерживает pub import, как в V).

package imager

import inner "gitverse.ru/pkg-ru/imager-client/v2/src/imager-go"

// Size — сегмент-объект с необязательными размерами (реэкспорт из src/imager-go).
type Size = inner.Size

// Imager — клиент микросервиса imager (реэкспорт из src/imager-go).
type Imager = inner.Imager

// AssetPath — один вариант ассета внутри `paths` (реэкспорт из src/imager-go).
type AssetPath = inner.AssetPath

// AssetType — результат GetAsset / элемента GetAssets (реэкспорт из src/imager-go).
type AssetType = inner.AssetType

// Options — настройки конструктора Imager (реэкспорт из src/imager-go).
type Options = inner.Options

// New — конструктор Imager (реэкспорт из src/imager-go).
func New(options ...Options) *Imager {
	return inner.New(options...)
}
