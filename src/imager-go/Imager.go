package imager

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
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
		} else if before, ok := strings.CutSuffix(o.AdminURL, "/"); ok {
			i.AdminURL = before
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
	before, after, ok := strings.Cut(segment, "x")
	if !ok {
		return false, 0, 0
	}
	left := before
	right := after
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

// Нормализованный сегмент. Хранится один раз на вызов GetAssets.
type normalizedSegment struct {
	str    string
	isSize bool
	width  int
	height int
}

// normalizeSegments избегает создания []any для common-case с одним сегментом.
func normalizeSegments(segments any) (int, []normalizedSegment) {
	switch t := segments.(type) {
	case []any:
		if len(t) == 0 {
			return 0, nil
		}
		out := make([]normalizedSegment, len(t))
		for n := range t {
			s, isSize, w, h := normalizeSegment(t[n])
			out[n] = normalizedSegment{str: s, isSize: isSize, width: w, height: h}
		}
		return len(out), out
	default:
		s, isSize, w, h := normalizeSegment(segments)
		return 1, []normalizedSegment{{str: s, isSize: isSize, width: w, height: h}}
	}
}

func formatsToList(formats any, defaults []string, defaultFormat, sourceFormat string) []string {
	var list []string
	switch t := formats.(type) {
	case string:
		if t != "" {
			list = []string{t}
		}
	case []string:
		if len(t) > 0 {
			list = t
		}
	}

	if len(list) == 0 {
		if len(defaults) > 0 {
			list = defaults
		} else if defaultFormat != "" {
			list = []string{defaultFormat}
		} else {
			list = []string{""}
		}
	}

	resolved := make([]string, len(list))
	for n, f := range list {
		resolved[n] = resolveFormat(f, sourceFormat)
	}
	return dedupeFormats(resolved)
}

func dprSteps(dpr int) int {
	switch dpr {
	case 2:
		return 2
	case 3:
		return 3
	default:
		return 1
	}
}

// Один AssetType.
func (i *Imager) GetAsset(source string, segment any, format string, dpr any) AssetType {
	path, sourceName, sourceFormat := splitSource(source)
	segStr, isSize, width, height := normalizeSegment(segment)

	outFormat := format
	if outFormat == "" {
		outFormat = i.Format
	}
	outFormat = resolveFormat(outFormat, sourceFormat)

	dprVal := i.resolveDpr(dpr)

	prefix := i.urlPrefix(path, sourceName, sourceFormat)
	item := AssetPath{}

	if dprVal >= 2 {
		item.Path = prefix + segStr + dprSuffixes[dprVal] + "." + outFormat
		item.Dpr = float64(dprVal)
		if isSize {
			if width > 0 {
				item.Width = width * dprVal
			}
			if height > 0 {
				item.Height = height * dprVal
			}
		}
	} else {
		item.Path = prefix + segStr + "." + outFormat
		if isSize {
			item.Width = width
			item.Height = height
		}
	}

	asset := AssetType{
		Type:  mimeFor(outFormat),
		Paths: []AssetPath{item},
	}
	if normalizeFormat(outFormat) == normalizeFormat(sourceFormat) {
		asset.SourceFormat = boolPtr(true)
	}
	if outFormat == "jpg" || outFormat == "jpeg" || outFormat == "gif" || outFormat == "png" {
		asset.AllSupport = boolPtr(true)
	}
	return asset
}

// Один AssetType на формат; paths — все сегменты × dpr-шаги.
//
// Порядок paths — сегмент-мажорный: для каждого сегмента все dpr-шаги
// подряд. dpr вычисляется из фактических размеров: базовая ширина =
// ширина первого участника с известной шириной, dpr = фактическая
// ширина / базовая (или по высоте, если ширины нет).
func (i *Imager) GetAssets(source string, segments any, formats any, dprs any) []AssetType {
	path, sourceName, sourceFormat := splitSource(source)

	// Форматы: аргумент → настройки formats → format → исходный формат.
	fmtList := formatsToList(formats, i.Formats, i.Format, sourceFormat)
	nFmt := len(fmtList)

	// Нормализуем сегменты ровно один раз и сразу определяем базовые размеры.
	segCount, segs := normalizeSegments(segments)
	maxSteps := dprSteps(i.resolveDpr(dprs))

	baseWidth, baseHeight := 0, 0
	for n := 0; n < segCount; n++ {
		s := segs[n]
		if baseWidth == 0 && s.width > 0 {
			baseWidth = s.width
		}
		if baseHeight == 0 && s.height > 0 {
			baseHeight = s.height
		}
	}

	prefix := i.urlPrefix(path, sourceName, sourceFormat)
	pathsPerFormat := segCount * maxSteps

	result := make([]AssetType, nFmt)
	for fi := range nFmt {
		eff := fmtList[fi]

		paths := make([]AssetPath, pathsPerFormat)
		pos := 0
		hasGt1 := false

		for n := range segCount {
			s := segs[n]

			for step := 1; step <= maxSteps; step++ {
				item := AssetPath{
					Path: prefix + s.str + dprSuffixes[step] + "." + eff,
				}
				if step >= 2 {
					item.Dpr = float64(step)
				}

				if s.isSize {
					switch step {
					case 1:
						item.Width = s.width
						item.Height = s.height
					case 2:
						item.Dpr = 2
						item.Width = s.width * 2
						item.Height = s.height * 2
					default: // step == 3
						item.Dpr = 3
						item.Width = s.width * 3
						item.Height = s.height * 3
					}

					// Полностью повторяет старую логику baseWidth → baseHeight.
					var currentDpr float64
					hasDpr := false
					if baseWidth > 0 && item.Width > 0 {
						currentDpr = float64(item.Width) / float64(baseWidth)
						hasDpr = true
					} else if baseHeight > 0 && item.Height > 0 {
						currentDpr = float64(item.Height) / float64(baseHeight)
						hasDpr = true
					}
					if hasDpr {
						if currentDpr > 1 {
							hasGt1 = true
						}
						item.Dpr = currentDpr
					}
				}

				paths[pos] = item
				pos++
			}
		}

		// При единственном эффективном варианте 1x поле dpr не сериализуется.
		if !hasGt1 {
			for n := range paths {
				if paths[n].Dpr == 1 {
					paths[n].Dpr = 0
				}
			}
		}

		result[fi] = AssetType{
			Type:  mimeFor(eff),
			Paths: paths,
		}
		if normalizeFormat(eff) == normalizeFormat(sourceFormat) {
			result[fi].SourceFormat = boolPtr(true)
		}
		if eff == "jpg" || eff == "jpeg" || eff == "gif" || eff == "png" {
			result[fi].AllSupport = boolPtr(true)
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
	outFormat = resolveFormat(outFormat, sourceFormat)

	prefix := i.urlPrefix(path, sourceName, sourceFormat)
	dprVal := i.resolveDpr(dpr)
	if dprVal >= 2 {
		return prefix + segStr + dprSuffixes[dprVal] + "." + outFormat
	}
	return prefix + segStr + "." + outFormat
}

// ------------------------------------------------------------------ //
//  HTML-генерация (GetAssetsHtml)                                    //
// ------------------------------------------------------------------ //

// Экранирование значения HTML-атрибута.
func htmlEscape(value string) string {
	// Ручной escape быстрее strings.NewReplacer на коротких атрибутах
	// и не создаёт объект Replacer на каждый вызов.
	var b strings.Builder
	last := 0
	for idx := 0; idx < len(value); idx++ {
		var repl string
		switch value[idx] {
		case '&':
			repl = "&amp;"
		case '<':
			repl = "&lt;"
		case '>':
			repl = "&gt;"
		case '"':
			repl = "&quot;"
		case '\'':
			repl = "&#x27;"
		default:
			continue
		}
		if b.Cap() == 0 {
			b.Grow(len(value) + 8)
		}
		b.WriteString(value[last:idx])
		b.WriteString(repl)
		last = idx + 1
	}
	if last == 0 {
		return value
	}
	b.WriteString(value[last:])
	return b.String()
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
func buildSrcset(paths []AssetPath, useWidth bool) string {
	if len(paths) == 0 {
		return ""
	}

	baseWidth, baseHeight := 0, 0
	hasDpr := false
	maxDpr := 0.0

	for j := range paths {
		item := &paths[j]
		if baseWidth == 0 && item.Width > 0 {
			baseWidth = item.Width
		}
		if baseHeight == 0 && item.Height > 0 {
			baseHeight = item.Height
		}
		if item.Dpr > 0 {
			hasDpr = true
		}
	}

	if !useWidth {
		for j := range paths {
			item := &paths[j]
			if item.Width <= 0 && item.Height <= 0 {
				continue
			}

			var dpr float64
			switch {
			case item.Dpr > 0:
				dpr = item.Dpr
			case item.Width > 0 && baseWidth > 0:
				dpr = float64(item.Width) / float64(baseWidth)
			case item.Height > 0 && baseHeight > 0:
				dpr = float64(item.Height) / float64(baseHeight)
			default:
				continue
			}
			if dpr > maxDpr {
				maxDpr = dpr
			}
		}
	}

	// Оценка ёмкости: URL + дескриптор, без промежуточного parts []string.
	var b strings.Builder
	first := true

	appendPart := func(path, desc string) {
		if !first {
			b.WriteString(", ")
		}
		b.WriteString(path)
		if desc != "" {
			b.WriteByte(' ')
			b.WriteString(desc)
		}
		first = false
	}

	for j := range paths {
		item := paths[j]

		if useWidth {
			if item.Width <= 0 {
				continue
			}
			appendPart(item.Path, strconv.Itoa(item.Width)+"w")
			continue
		}

		var desc string
		switch {
		case item.Dpr > 0 && (item.Width > 0 || item.Height > 0):
			desc = fmtDescriptor(item.Dpr) + "x"
		case baseHeight > 0 && item.Height > 0:
			desc = fmtDescriptor(float64(item.Height)/float64(baseHeight)) + "x"
		case baseWidth > 0 && item.Width > 0:
			desc = fmtDescriptor(float64(item.Width)/float64(baseWidth)) + "x"
		case item.Width <= 0 && item.Height <= 0:
			dprStep := item.Dpr
			if dprStep <= 0 {
				dprStep = 1
			}
			if maxDpr > 0 {
				desc = fmtDescriptor((maxDpr+1)*dprStep) + "x"
			} else if hasDpr {
				desc = fmtDescriptor(dprStep) + "x"
			} else {
				appendPart(item.Path, "")
				continue
			}
		default:
			desc = "1x"
		}
		appendPart(item.Path, desc)
	}

	return b.String()
}

// Атрибуты, относящиеся к <img>, а не к <picture>.
func isImgAttr(name string) bool {
	switch name {
	case "alt", "sizes", "loading", "width", "height", "decoding", "fetchpriority":
		return true
	default:
		return false
	}
}

// Группа путей одного типа (формата) для HTML-вывода.
type htmlGroup struct {
	mime         string
	paths        []AssetPath
	sourceFormat bool
	allSupport   bool
}

// HTML <picture>/<img> по декартову произведению segments × formats.
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

	// Собираем атрибуты напрямую. maps.Copy + delete + отдельный map explicit
	// в горячем пути не нужны.
	imgAttrs := make([][2]any, 0, len(options)+1)
	picAttrs := make([][2]any, 0, len(options))
	var explicit map[string]any

	lazyEnabled := false
	if v, ok := options["lazy"]; ok {
		lazyEnabled = truthy(v)
	}

	for k, v := range options {
		switch k {
		case "lazy":
			continue

		case "imgAttrs":
			if m, ok := v.(map[string]any); ok && len(m) > 0 {
				if explicit == nil {
					explicit = make(map[string]any, len(m))
				}
				for ek, ev := range m {
					explicit[ek] = ev
				}
			}
			continue

		case "loading":
			if v == nil && lazyEnabled {
				imgAttrs = append(imgAttrs, [2]any{"loading", "lazy"})
				continue
			}
		}

		if isImgAttr(k) {
			imgAttrs = append(imgAttrs, [2]any{k, v})
		} else {
			picAttrs = append(picAttrs, [2]any{k, v})
		}
	}

	// lazy → loading="lazy", когда loading отсутствует.
	if lazyEnabled {
		if loading, exists := options["loading"]; !exists {
			imgAttrs = append(imgAttrs, [2]any{"loading", "lazy"})
		} else if loading == nil {
			// Уже добавлен в ветке loading выше.
		}
	}

	// Явные imgAttrs имеют приоритет. Удаляем дубли за один проход.
	if len(explicit) > 0 {
		merged := make([][2]any, 0, len(imgAttrs)+len(explicit))
		for _, kv := range imgAttrs {
			name, _ := kv[0].(string)
			if _, override := explicit[name]; !override {
				merged = append(merged, kv)
			}
		}
		for k, v := range explicit {
			merged = append(merged, [2]any{k, v})
		}
		imgAttrs = merged
	}

	// Группировка по MIME. В отличие от прежнего map, порядок групп всегда
	// совпадает с порядком assets. Форматов обычно мало; линейный поиск
	// устраняет map/hash overhead из hot path.
	groups := make([]htmlGroup, 0, len(assets))
	for ai := range assets {
		asset := &assets[ai]
		groupIdx := -1
		for gi := range groups {
			if groups[gi].mime == asset.Type {
				groupIdx = gi
				break
			}
		}

		if groupIdx < 0 {
			groups = append(groups, htmlGroup{
				mime:         asset.Type,
				sourceFormat: asset.SourceFormat != nil && *asset.SourceFormat,
				allSupport:   asset.AllSupport != nil && *asset.AllSupport,
				paths:        asset.Paths,
			})
			continue
		}

		g := &groups[groupIdx]
		g.paths = append(g.paths, asset.Paths...)
		if asset.SourceFormat != nil && *asset.SourceFormat {
			g.sourceFormat = true
		}
		if asset.AllSupport != nil && *asset.AllSupport {
			g.allSupport = true
		}
	}

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
	if len(imgPaths) == 0 {
		return ""
	}
	base := imgPaths[0]

	var img strings.Builder
	img.Grow(len(base.Path) + 128)
	img.WriteString(` src="`)
	img.WriteString(htmlEscape(base.Path))
	img.WriteByte('"')

	imgSrcset := buildSrcset(imgPaths, useWidth)
	if len(imgPaths) > 1 && imgSrcset != "" {
		img.WriteString(` srcset="`)
		img.WriteString(htmlEscape(imgSrcset))
		img.WriteByte('"')
	}

	hasWidth, hasHeight := false, false
	for _, kv := range imgAttrs {
		name := kv[0].(string)
		switch v := kv[1].(type) {
		case bool:
			if !v {
				continue
			}
			img.WriteByte(' ')
			img.WriteString(name)
		case nil:
			img.WriteByte(' ')
			img.WriteString(name)
		default:
			img.WriteByte(' ')
			img.WriteString(name)
			img.WriteString(`="`)
			img.WriteString(htmlEscape(fmt.Sprintf("%v", v)))
			img.WriteByte('"')
		}
		switch name {
		case "width":
			hasWidth = true
		case "height":
			hasHeight = true
		}
	}

	if base.Width > 0 && !hasWidth {
		img.WriteString(` width="`)
		img.WriteString(strconv.Itoa(base.Width))
		img.WriteByte('"')
	}
	if base.Height > 0 && !hasHeight {
		img.WriteString(` height="`)
		img.WriteString(strconv.Itoa(base.Height))
		img.WriteByte('"')
	}

	imgHTML := "<img" + img.String() + ">"

	if len(groups) == 1 {
		return imgHTML
	}

	var b strings.Builder
	b.Grow(len(imgHTML) + 64*len(groups))
	b.WriteString("<picture")
	for _, kv := range picAttrs {
		name := kv[0].(string)
		switch v := kv[1].(type) {
		case bool:
			if v {
				b.WriteByte(' ')
				b.WriteString(name)
			}
		case nil:
			b.WriteByte(' ')
			b.WriteString(name)
		default:
			b.WriteByte(' ')
			b.WriteString(name)
			b.WriteString(`="`)
			b.WriteString(htmlEscape(fmt.Sprintf("%v", v)))
			b.WriteByte('"')
		}
	}
	b.WriteByte('>')

	for idx := range groups {
		if idx == imgIdx {
			continue
		}
		srcset := buildSrcset(groups[idx].paths, useWidth)
		if srcset == "" {
			continue
		}
		b.WriteString("<source type=\"")
		b.WriteString(htmlEscape(groups[idx].mime))
		b.WriteString(`" srcset="`)
		b.WriteString(htmlEscape(srcset))
		b.WriteString("\">")
	}

	b.WriteString(imgHTML)
	b.WriteString("</picture>")
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
