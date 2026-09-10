package imager

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
	Path   string `json:"path"`
	Dpr    int    `json:"dpr,omitempty"`
	Width  int    `json:"width,omitempty"`
	Height int    `json:"height,omitempty"`
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

// Настройки конструктора Imager.
type Options struct {
	Token    string
	Dpr      int
	Format   string
	Formats  []string
	BaseURL  string
	AdminURL string
}
