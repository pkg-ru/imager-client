package imager

import "strings"

// Типы и структуры клиентской библиотеки imager (Go-реализация).
//
// Содержит:
// - структуры AssetPath / AssetType (результаты клиентских методов);
// - структуру Options (настройки конструктора).

// Один вариант ассета внутри `paths`.
//
// Все поля кроме Path опциональны: включаются в сериализацию только
// если заданы, в порядке path, dpr, width, height.
type AssetPath struct {
	Path   string  `json:"path"`
	Dpr    float64 `json:"dpr,omitempty"`
	Width  int     `json:"width,omitempty"`
	Height int     `json:"height,omitempty"`
}

// Результат GetAsset / элемента GetAssets.
//
// Опциональные поля SourceFormat/AllSupport включаются в JSON только
// при true (nil опускается через omitempty):
//
//	SourceFormat — итоговый формат совпадает с исходным форматом файла;
//	AllSupport   — формат поддерживается всеми браузерами (jpg/jpeg/gif/png).
type AssetType struct {
	Type         string      `json:"type"`
	Paths        []AssetPath `json:"paths"`
	SourceFormat *bool       `json:"source_format,omitempty"`
	AllSupport   *bool       `json:"all_support,omitempty"`
}

// boolPtr — вспомогательная функция для установки опциональных bool-полей.
func boolPtr(v bool) *bool {
	return &v
}

// imageFormats — форматы картинок, поддерживаемые сервисом. Всё, что не
// входит в этот список (видео и прочее), при format="auto"/"" трактуется
// как не-картинка.
var imageFormats = map[string]bool{
	"jpg":  true,
	"jpeg": true,
	"png":  true,
	"webp": true,
	"avif": true,
	"heif": true,
	"heic": true,
	"apng": true,
	"jxl":  true,
	"gif":  true,
}

// normalizeFormat — нормализация формата: lower-case, jpeg → jpg.
func normalizeFormat(format string) string {
	if format == "jpeg" {
		return "jpg"
	}
	return strings.ToLower(format)
}

// resolveFormat — резолв одного формата: "auto"/"" → исходный формат,
// если он картинка, иначе jpg.
func resolveFormat(format, sourceFormat string) string {
	if format == "auto" || format == "" {
		if imageFormats[sourceFormat] {
			return sourceFormat
		}
		return "jpg"
	}
	return normalizeFormat(format)
}

// dedupeFormats — дедупликация списка форматов (jpeg → jpg, первое
// вхождение сохраняет позицию).
func dedupeFormats(formats []string) []string {
	seen := make(map[string]bool, len(formats))
	result := make([]string, 0, len(formats))
	for _, fmt := range formats {
		fmt = normalizeFormat(fmt)
		if !seen[fmt] {
			seen[fmt] = true
			result = append(result, fmt)
		}
	}
	return result
}

// Настройки конструктора Imager.
type Options struct {
	Token    string
	Dpr      int
	Format   string
	Formats  []string
	BaseURL  string
	AdminURL string
}
