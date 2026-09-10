package imager

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Класс Imager — клиент микросервиса imager (Go-реализация).
//
// Клиентская часть (GetAsset/GetAssets/GetAssetPath) — чистое построение
// путей/URL без HTTP, без валидации и исключений, только конкатенация строк.
// Админ-часть (AdminGenerate/AdminDelete) — стандартный HTTP-клиент
// (net/http), результат — bool по маппингу кодов ответа.
//
// Настройки:
//   token    — токен админ-методов (только AdminGenerate/AdminDelete);
//   dpr      — итоговое dpr по умолчанию (0 — не используется);
//   format   — формат генерации по умолчанию ("");
//   formats  — список форматов по умолчанию ([] → используется `format`);
//   baseURL  — база URL ассетов, нормализована (всегда с `/` на конце);
//   adminURL — база админ-API (без завершающего `/`).

// Сегмент-объект с необязательными размерами.
// Публичный: принимается как `segment` в GetAsset/GetAssets/GetAssetPath.
type Size struct {
	Width  int
	Height int
}

type Imager struct {
	Token    string
	Dpr      int
	Format   string
	Formats  []string
	BaseURL  string
	AdminURL string
}

// Общий HTTP-клиент для админ-методов (один на все запросы, не per-request).
var adminClient = &http.Client{
	Timeout: 10 * time.Second,
}

// Конструктор.
func New(options ...Options) *Imager {
	i := &Imager{
		Token:    "",
		Dpr:      0,
		Format:   "",
		Formats:  []string{},
		BaseURL:  "/",
		AdminURL: "",
	}

	if len(options) >= 1 {
		o := options[0]

		// token
		i.Token = o.Token

		// dpr
		i.Dpr = o.Dpr

		// format / formats
		i.Format = o.Format
		i.Formats = o.Formats

		// baseURL — нормализация «…/» в конце
		if o.BaseURL == "" {
			i.BaseURL = "/"
		} else if strings.HasSuffix(o.BaseURL, "/") {
			i.BaseURL = o.BaseURL
		} else {
			i.BaseURL = o.BaseURL + "/"
		}

		// adminURL — без завершающего `/`
		if o.AdminURL == "" {
			i.AdminURL = ""
		} else if strings.HasSuffix(o.AdminURL, "/") {
			i.AdminURL = strings.TrimSuffix(o.AdminURL, "/")
		} else {
			i.AdminURL = o.AdminURL
		}
	}

	return i
}

// ------------------------------------------------------------------ //
//  Разбор source: (path, source_name, source_format)     //
// ------------------------------------------------------------------ //

// Отбрасывает ведущий `/`, отделяет path и расширение (в lower-case).
func splitSource(source string) (string, string, string) {
	s := source
	start := 0
	for start < len(s) && s[start] == '/' {
		start++
	}
	if start > 0 {
		s = s[start:]
	}

	lastSlash := strings.LastIndex(s, "/")
	var path, file string
	if lastSlash >= 0 {
		path = s[0:lastSlash]
		file = s[lastSlash+1:]
	} else {
		path = ""
		file = s
	}

	lastDot := strings.LastIndex(file, ".")
	var sourceName, sourceFormat string
	if lastDot >= 0 {
		sourceName = file[0:lastDot]
		sourceFormat = strings.ToLower(file[lastDot+1:])
	} else {
		sourceName = file
		sourceFormat = ""
	}

	return path, sourceName, sourceFormat
}

// ------------------------------------------------------------------ //
//  Формализация сегмента                                 //
// ------------------------------------------------------------------ //

// Все цифры ASCII? (побайтовый проход — без rune-итерации и regex).
func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for j := 0; j < len(s); j++ {
		c := s[j]
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// → (is_size, width, height) из строки-размера — один проход по строке.
//
// Семантика сохранена: "200x200" → (true,200,200), "200x" → (true,200,0),
// "x200" → (true,0,200), "x" → (true,0,0), без "x" → (false,0,0).
func parseSizeString(segment string) (bool, int, int) {
	idx := strings.Index(segment, "x")
	if idx < 0 {
		return false, 0, 0
	}
	left := segment[0:idx]
	right := segment[idx+1:]
	if (left == "" || isDigits(left)) && (right == "" || isDigits(right)) {
		width := 0
		height := 0
		if left != "" {
			width, _ = strconv.Atoi(left)
		}
		if right != "" {
			height, _ = strconv.Atoi(right)
		}
		return true, width, height
	}
	return false, 0, 0
}

// → (segment_str, is_size, width, height).
//
// segment: string | Size | [w,h] | nil.
func normalizeSegment(segment any) (string, bool, int, int) {
	switch t := segment.(type) {
	case string:
		isSize, width, height := parseSizeString(t)
		if isSize {
			return t, true, width, height
		}
		return t, false, 0, 0
	case Size:
		return buildSize(t.Width, t.Height), true, t.Width, t.Height
	case []int:
		width := 0
		height := 0
		if len(t) > 0 {
			width = t[0]
		}
		if len(t) > 1 {
			height = t[1]
		}
		return buildSize(width, height), true, width, height
	default:
		// nil и прочие типы → размер без размеров
		return "x", true, 0, 0
	}
}

// ------------------------------------------------------------------ //
//  dpr                                                   //
// ------------------------------------------------------------------ //

// Строка-цифра → число; < 1 → 0 (не используется); > 3 → 3.
func parseDpr(dpr any) int {
	number := toInt(dpr)
	if number < 1 {
		return 0
	}
	if number > 3 {
		return 3
	}
	return number
}

// Приведение к int (как int() в Python-эталоне).
func toInt(value any) int {
	switch t := value.(type) {
	case int:
		return t
	case float64:
		return int(t)
	case string:
		s := strings.TrimSpace(t)
		if s != "" && isDigits(s) {
			n, _ := strconv.Atoi(s)
			return n
		}
		return 0
	default:
		return 0
	}
}

// Аргумент → настройки → 0.
func (i *Imager) resolveDpr(dpr any) int {
	if dpr != nil {
		return parseDpr(dpr)
	}
	return parseDpr(i.Dpr)
}

// ------------------------------------------------------------------ //
//  Построение URL и списка paths                                     //
// ------------------------------------------------------------------ //

// {baseURL}{path}/{name}/ — общий префикс URL ассета.
func (i *Imager) urlPrefix(path, sourceName, sourceFormat string) string {
	name := sourceName
	if sourceFormat != "" {
		name = sourceName + "-" + sourceFormat
	}
	if path != "" {
		return i.BaseURL + path + "/" + name + "/"
	}
	return i.BaseURL + name + "/"
}

// Суффиксы dpr: индекс = шаг (1 → без суффикса, 2 → @2, 3 → @3).
// [4]string — чтобы индекс 3 (шаг 3) не выходил за границы.
var dprSuffixes = [4]string{"", "", "@2", "@3"}

// Сборка сегмента из размеров: 200x200 / 200x / x200 / x.
func buildSize(width, height int) string {
	if width > 0 {
		if height > 0 {
			return strconv.Itoa(width) + "x" + strconv.Itoa(height)
		}
		return strconv.Itoa(width) + "x"
	}
	if height > 0 {
		return "x" + strconv.Itoa(height)
	}
	return "x"
}

// MIME для итогового формата; неизвестный/видео → пустая строка.
//
// GetAsset/GetAssets вызывает mimeFor на каждый формат.
func mimeFor(format string) string {
	if format == "jpg" {
		format = "jpeg"
	}
	return "image/" + format
}

// ------------------------------------------------------------------ //
//  Клиентские методы — без HTTP, без валидации, без исключений      //
// ------------------------------------------------------------------ //

// Один AssetType.
func (i *Imager) GetAsset(source string, segment any, format string, dpr any) AssetType {
	path, sourceName, sourceFormat := splitSource(source)
	segStr, isSize, width, height := normalizeSegment(segment)

	outFormat := format
	if outFormat == "" {
		outFormat = i.Format
	}
	if outFormat == "" {
		outFormat = sourceFormat
	}

	dprVal := i.resolveDpr(dpr)
	explicit := dpr != nil

	// --- Инварианты, вычисляемые ОДИН раз ---
	prefix := i.urlPrefix(path, sourceName, sourceFormat)

	// dpr — целевое значение: формирует ровно один вариант ассета
	item := AssetPath{}
	if dprVal >= 2 {
		item.Path = prefix + segStr + "@" + strconv.Itoa(dprVal) + "." + outFormat
		item.Dpr = dprVal
	} else {
		item.Path = prefix + segStr + "." + outFormat
		if explicit && dprVal == 1 {
			item.Dpr = 1
		}
	}
	if isSize && width > 0 {
		if dprVal >= 2 {
			item.Width = width * dprVal
		} else {
			item.Width = width
		}
	}
	if isSize && height > 0 {
		if dprVal >= 2 {
			item.Height = height * dprVal
		} else {
			item.Height = height
		}
	}

	asset := AssetType{
		Type:  mimeFor(outFormat),
		Paths: []AssetPath{item},
	}
	if outFormat == sourceFormat {
		asset.SourceFormat = boolPtr(true)
	}
	if outFormat == "jpg" || outFormat == "jpeg" || outFormat == "gif" || outFormat == "png" {
		asset.AllSupport = boolPtr(true)
	}
	return asset
}

// Декартово произведение segments × formats.
func (i *Imager) GetAssets(source string, segments any, formats any, dprs any) []AssetType {
	// segments: не задан → [nil] → "x"
	var segList []any
	if segments == nil {
		segList = []any{nil}
	} else {
		switch t := segments.(type) {
		case []any:
			segList = t
		default:
			segList = []any{segments}
		}
	}

	// formats: аргумент → настройки formats → format → [исходный]
	var fmtList []string
	if formats != nil {
		switch t := formats.(type) {
		case string:
			if t != "" {
				fmtList = []string{t}
			}
		case []string:
			fmtList = t
		}
	}
	path, sourceName, sourceFormat := splitSource(source)
	if len(fmtList) == 0 {
		if len(i.Formats) > 0 {
			fmtList = i.Formats
		} else if i.Format != "" {
			fmtList = []string{i.Format}
		} else if sourceFormat != "" {
			fmtList = []string{sourceFormat}
		} else {
			fmtList = []string{""}
		}
	}

	dprVal := i.resolveDpr(dprs)
	explicit := dprs != nil

	// --- Инварианты, вычисляемые ОДИН раз на весь вызов ---
	// 1. Префикс URL {baseURL}{path}/{name}-{srcfmt}/ — одинаков для всех путей.
	prefix := i.urlPrefix(path, sourceName, sourceFormat)
	// 2. Суффиксы dpr: [без суффикса, @2, @3] — константы.
	maxSteps := 1
	if dprVal == 2 {
		maxSteps = 2
	} else if dprVal >= 3 {
		maxSteps = 3
	}

	// --- Точные ёмкости: по одному массиву на результат и на все paths ---
	nSeg := len(segList)
	nFmt := len(fmtList)
	nTypes := nSeg * nFmt
	nPaths := nTypes * maxSteps

	result := make([]AssetType, nTypes)
	allPaths := make([]AssetPath, nPaths)

	idx := 0
	pidx := 0
	for _, seg := range segList {
		segStr, isSize, width, height := normalizeSegment(seg)
		for fi := 0; fi < nFmt; fi++ {
			eff := fmtList[fi]
			if eff == "" {
				eff = sourceFormat
			}
			// слайс одного AssetType внутри общего массива
			paths := allPaths[pidx : pidx+maxSteps]
			pidx += maxSteps
			for step := 1; step <= maxSteps; step++ {
				item := AssetPath{
					Path: prefix + segStr + dprSuffixes[step] + "." + eff,
				}
				if dprVal == 1 && explicit {
					item.Dpr = 1
				} else if step >= 2 {
					item.Dpr = step
				}
				if isSize && width > 0 {
					multiply := 1
					if step >= 2 {
						multiply = step
					}
					item.Width = width * multiply
				}
				if isSize && height > 0 {
					multiply := 1
					if step >= 2 {
						multiply = step
					}
					item.Height = height * multiply
				}
				paths[step-1] = item
			}
			asset := AssetType{
				Type:  mimeFor(eff),
				Paths: paths,
			}
			if eff == sourceFormat {
				asset.SourceFormat = boolPtr(true)
			}
			if eff == "jpg" || eff == "jpeg" || eff == "gif" || eff == "png" {
				asset.AllSupport = boolPtr(true)
			}
			result[idx] = asset
			idx++
		}
	}

	return result
}

// URL ассета для целевого dpr (суффикс `@dpr` при dpr >= 2).
func (i *Imager) GetAssetPath(source string, segment any, format string, dpr any) string {
	path, sourceName, sourceFormat := splitSource(source)
	segStr, _, _, _ := normalizeSegment(segment)

	outFormat := format
	if outFormat == "" {
		outFormat = i.Format
	}
	if outFormat == "" {
		outFormat = sourceFormat
	}

	dprVal := i.resolveDpr(dpr)
	if dprVal >= 2 {
		segStr = segStr + "@" + strconv.Itoa(dprVal)
	}

	prefix := i.urlPrefix(path, sourceName, sourceFormat)
	return prefix + segStr + "." + outFormat
}

// ------------------------------------------------------------------ //
//  HTML-генерация (GetAssetsHtml)                                    //
// ------------------------------------------------------------------ //

// Экранирование значения HTML-атрибута (как html.EscapeString для атрибутов).
func htmlEscape(value string) string {
	r := strings.NewReplacer(
		"&", "&am"+"p;",
		"<", "&l"+"t;",
		">", "&g"+"t;",
		`"`, "&qu"+"ot;",
		"'", "&#x"+"27;",
	)
	return r.Replace(value)
}

// Число → строка дескриптора: 1 → "1", 1.5 → "1.5" (без хвостовых нулей).
func fmtDescriptor(value float64) string {
	if value == float64(int(value)) {
		return strconv.Itoa(int(value))
	}
	s := strconv.FormatFloat(value, 'f', 2, 64)
	s = strings.TrimRight(s, "0")
	s = strings.TrimSuffix(s, ".")
	return s
}

// srcset для списка путей одного типа.
//
// useWidth → w-дескрипторы по AssetPath.Width; иначе dpr-дескрипторы:
// из AssetPath.Dpr, а если dpr нет — из отношения height (или width)
// к базовому (первому) значению (дробные допустимы).
func buildSrcset(paths []AssetPath, useWidth bool) string {
	baseWidth, baseHeight := 0, 0
	for j := range paths {
		if baseWidth == 0 && paths[j].Width > 0 {
			baseWidth = paths[j].Width
		}
		if baseHeight == 0 && paths[j].Height > 0 {
			baseHeight = paths[j].Height
		}
	}
	parts := make([]string, 0, len(paths))
	for j := range paths {
		item := paths[j]
		var desc string
		switch {
		case useWidth && item.Width > 0:
			desc = strconv.Itoa(item.Width) + "w"
		case item.Dpr > 0:
			desc = fmtDescriptor(float64(item.Dpr)) + "x"
		case baseHeight > 0 && item.Height > 0:
			desc = fmtDescriptor(float64(item.Height)/float64(baseHeight)) + "x"
		case baseWidth > 0 && item.Width > 0:
			desc = fmtDescriptor(float64(item.Width)/float64(baseWidth)) + "x"
		default:
			desc = "1x"
		}
		parts = append(parts, item.Path+" "+desc)
	}
	return strings.Join(parts, ", ")
}

// Атрибуты, относящиеся к <img>, а не к <picture>.
var imgAttrsSet = map[string]bool{
	"alt": true, "sizes": true, "loading": true, "width": true, "height": true,
}

// Рендер атрибутов: true → имя без значения, false → пропуск, иначе "name=\"value\"".
func renderAttrs(attrs [][2]any) string {
	var b strings.Builder
	for _, kv := range attrs {
		name, _ := kv[0].(string)
		switch v := kv[1].(type) {
		case bool:
			if v {
				b.WriteString(" " + name)
			}
		case nil:
			b.WriteString(" " + name)
		default:
			b.WriteString(" " + name + `="` + htmlEscape(fmt.Sprintf("%v", v)) + `"`)
		}
	}
	return b.String()
}

// Группа путей одного типа (формата) для HTML-вывода.
type htmlGroup struct {
	mime         string
	paths        []AssetPath
	sourceFormat bool
	allSupport   bool
}

// HTML <picture>/<img> по декартову произведению segments × formats.
//
// options — HTML-атрибуты: class/id/... → <picture>,
// alt/sizes/loading (lazy → loading="lazy") → <img>.
func (i *Imager) GetAssetsHtml(source string, segments any, formats any, dprs any, options map[string]any) string {
	assets := i.GetAssets(source, segments, formats, dprs)
	if len(assets) == 0 {
		return ""
	}

	useWidth := false
	if options != nil {
		if v, ok := options["sizes"]; ok && v != nil {
			useWidth = true
		}
	}

	// lazy → loading="lazy"
	imgOpts := make(map[string]any, len(options))
	for k, v := range options {
		imgOpts[k] = v
	}
	if lazy, ok := imgOpts["lazy"]; ok && truthy(lazy) {
		if _, has := imgOpts["loading"]; !has || imgOpts["loading"] == nil {
			imgOpts["loading"] = "lazy"
		}
	}
	delete(imgOpts, "lazy")

	// Разделение атрибутов: img-атрибуты vs атрибуты <picture>
	// (сортировка по имени — детерминированный порядок вывода)
	keys := make([]string, 0, len(imgOpts))
	for k := range imgOpts {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var imgAttrs, picAttrs [][2]any
	for _, k := range keys {
		v := imgOpts[k]
		if imgAttrsSet[k] {
			imgAttrs = append(imgAttrs, [2]any{k, v})
		} else {
			picAttrs = append(picAttrs, [2]any{k, v})
		}
	}

	// Группировка по типу (формату): пути всех сегментов одного формата
	// объединяются в один srcset внутри одного <source>/<img>.
	groups := make([]htmlGroup, 0, len(assets))
	byType := make(map[string]*htmlGroup, len(assets))
	for _, asset := range assets {
		g, ok := byType[asset.Type]
		if !ok {
			groups = append(groups, htmlGroup{mime: asset.Type})
			g = &groups[len(groups)-1]
			byType[asset.Type] = g
		}
		g.paths = append(g.paths, asset.Paths...)
		if asset.SourceFormat != nil && *asset.SourceFormat {
			g.sourceFormat = true
		}
		if asset.AllSupport != nil && *asset.AllSupport {
			g.allSupport = true
		}
	}

	// Выбор группы для <img>:
	// 1) source_format=true; 2) первая all_support=true; 3) последняя.
	imgIdx := -1
	for idx := range groups {
		if groups[idx].sourceFormat {
			imgIdx = idx
			break
		}
	}
	if imgIdx < 0 {
		for idx := range groups {
			if groups[idx].allSupport {
				imgIdx = idx
				break
			}
		}
	}
	if imgIdx < 0 {
		imgIdx = len(groups) - 1
	}

	imgPaths := groups[imgIdx].paths
	base := imgPaths[0]

	// <img>
	var img strings.Builder
	img.WriteString(` src="` + htmlEscape(base.Path) + `"`)
	if len(imgPaths) > 1 {
		img.WriteString(` srcset="` + htmlEscape(buildSrcset(imgPaths, useWidth)) + `"`)
	}
	for _, kv := range imgAttrs {
		name, _ := kv[0].(string)
		switch v := kv[1].(type) {
		case bool:
			if v {
				img.WriteString(" " + name)
			}
		case nil:
			img.WriteString(" " + name)
		default:
			img.WriteString(" " + name + `="` + htmlEscape(fmt.Sprintf("%v", v)) + `"`)
		}
	}
	if base.Width > 0 {
		img.WriteString(` width="` + strconv.Itoa(base.Width) + `"`)
	}
	if base.Height > 0 {
		img.WriteString(` height="` + strconv.Itoa(base.Height) + `"`)
	}
	imgHTML := "<img" + img.String() + ">"

	if len(groups) == 1 {
		return imgHTML
	}

	var b strings.Builder
	b.WriteString("<picture" + renderAttrs(picAttrs) + ">")
	for idx, group := range groups {
		if idx == imgIdx {
			continue
		}
		b.WriteString("\n    " + `<source type="` + htmlEscape(group.mime) + `"`)
		if len(group.paths) > 1 {
			b.WriteString(` srcset="` + htmlEscape(buildSrcset(group.paths, useWidth)) + `"`)
		} else {
			b.WriteString(` src="` + htmlEscape(group.paths[0].Path) + `"`)
		}
		b.WriteString(">")
	}
	b.WriteString("\n    " + imgHTML + "\n</picture>")
	return b.String()
}

// truthy — интерпретация значения options как булева.
func truthy(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t != "" && t != "0" && t != "false"
	case float64:
		return t != 0
	case int:
		return t != 0
	default:
		return v != nil
	}
}

// ------------------------------------------------------------------ //
//  Админ-методы (HTTP через net/http)                                //
// ------------------------------------------------------------------ //

// Общий админ-запрос; пустой token/adminURL → false без HTTP.
//
//	string          → режим A: {"source": ...}
//	AssetType       → режим B: {"assets": [paths[].path]}
//	[]AssetType     → режим B: {"assets": [paths[].path из ВСЕХ AssetType]}
//	[]string        → режим B: {"assets": [элементы как есть]}
func (i *Imager) AdminRequest(target any, wait bool, endpoint, method string) bool {
	if i.Token == "" || i.AdminURL == "" {
		return false
	}

	body := map[string]any{}
	switch t := target.(type) {
	case string:
		// режим A: source-строка как есть
		body["source"] = t
	case AssetType:
		// режим B: один AssetType — все paths[].path
		assets := []string{}
		for _, p := range t.Paths {
			assets = append(assets, p.Path)
		}
		body["assets"] = assets
	case []AssetType:
		// режим B: path'ы всех AssetType подряд
		assets := []string{}
		for _, at := range t {
			for _, p := range at.Paths {
				assets = append(assets, p.Path)
			}
		}
		body["assets"] = assets
	case []string:
		// режим B: string[] — пути как есть, без валидации и преобразований
		body["assets"] = t
	default:
		// неизвестный тип → пустой список assets
		body["assets"] = []string{}
	}
	body["wait"] = wait

	url := i.AdminURL + endpoint
	data, _ := json.Marshal(body)

	req, err := http.NewRequest(method, url, bytes.NewReader(data))
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer "+i.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := adminClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	code := resp.StatusCode
	if endpoint == "/admin/assets/delete" {
		return code == 200
	}
	return code == 200 || code == 202
}

// POST {adminURL}/admin/assets/generate → true на 200/202.
func (i *Imager) AdminGenerate(target any, wait bool) bool {
	return i.AdminRequest(target, wait, "/admin/assets/generate", "POST")
}

// DELETE {adminURL}/admin/assets/delete → true на 200.
func (i *Imager) AdminDelete(target any, wait bool) bool {
	return i.AdminRequest(target, wait, "/admin/assets/delete", "DELETE")
}
