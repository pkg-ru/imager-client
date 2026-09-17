package main

// Раннер golden-тестов для Go-клиента imager.
//
// Читает test/fixture.json (единые golden-кейсы для всех языков), выполняет
// каждый кейс через imagergo.New/GetAsset/GetAssets/GetAssetPath и сверяет
// результат с expected побайтово (порядок ключей и состав полей).
// Дополнительно выполняет unit-тесты админ-методов (AdminGenerate/AdminDelete)
// с локальным mock-HTTP-сервером на net/http/httptest.
//
// Запуск: go run test/test.go  (из корня проекта)

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"reflect"
	"strconv"
	"strings"

	imagergo "gitverse.ru/pkg-ru/imager-client/v2"
)

// ------------------------------------------------------------------ //
//  Вспомогательные конвертации JSON → типизированные значения        //
// ------------------------------------------------------------------ //

// JSON-число (float64) → int.
func ToInt(v any) int {
	if v == nil {
		return 0
	}
	switch t := v.(type) {
	case int:
		return t
	case float64:
		return int(t)
	case string:
		s := strings.TrimSpace(t)
		if s != "" {
			n, err := strconv.Atoi(s)
			if err == nil {
				return n
			}
		}
		return 0
	default:
		return 0
	}
}

// JSON-значение → string (для format/dprs).
func ToString(v any) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.Itoa(int(t))
	case int:
		return strconv.Itoa(t)
	default:
		return ""
	}
}

// JSON-объект {width,height} → Size (поля необязательны).
func ToSize(v any) imagergo.Size {
	sz := imagergo.Size{Width: 0, Height: 0}
	if v == nil {
		return sz
	}
	m := v.(map[string]any)
	if m["width"] != nil {
		sz.Width = ToInt(m["width"])
	}
	if m["height"] != nil {
		sz.Height = ToInt(m["height"])
	}
	return sz
}

// JSON-сегмент → any (string | Size | []int | nil).
func ToSegment(v any) any {
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case string:
		return t
	case map[string]any:
		return ToSize(t)
	case []any:
		nums := []int{}
		for _, e := range t {
			nums = append(nums, ToInt(e))
		}
		return nums
	default:
		return v
	}
}

// JSON-список сегментов → []any (каждый через ToSegment).
// nil → nil (Imager сам подставит [nil] → "x").
func ToSegments(v any) []any {
	result := []any{}
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case []any:
		for _, e := range t {
			result = append(result, ToSegment(e))
		}
		return result
	default:
		result = append(result, ToSegment(v))
		return result
	}
}

// JSON-формат(ы) → []string.
func ToFormats(v any) []string {
	result := []string{}
	if v == nil {
		return result
	}
	switch t := v.(type) {
	case string:
		if t != "" {
			result = append(result, t)
		}
		return result
	case []any:
		for _, e := range t {
			s := ToString(e)
			if s != "" {
				result = append(result, s)
			}
		}
		return result
	default:
		return result
	}
}

// ------------------------------------------------------------------ //
//  Golden-кейсы                                                      //
// ------------------------------------------------------------------ //

// Читает fixture.json и возвращает список кейсов ([]any).
func LoadFixture() []any {
	data, err := os.ReadFile("test/fixture.json")
	if err != nil {
		fmt.Println("cannot read test/fixture.json:", err)
		os.Exit(1)
	}
	var cases []any
	err = json.Unmarshal(data, &cases)
	if err != nil {
		fmt.Println("cannot parse test/fixture.json:", err)
		os.Exit(1)
	}
	return cases
}

// Строит Options из map[string]any (поля опциональны).
func BuildOptions(raw any) imagergo.Options {
	o := imagergo.Options{
		Token:    "",
		Dpr:      0,
		Format:   "",
		Formats:  []string{},
		BaseURL:  "",
		AdminURL: "",
		Sort:     false,
	}
	if raw == nil {
		return o
	}
	m := raw.(map[string]any)

	if m["token"] != nil {
		o.Token = ToString(m["token"])
	}
	if m["dpr"] != nil {
		o.Dpr = ToInt(m["dpr"])
	}
	if m["format"] != nil {
		o.Format = ToString(m["format"])
	}
	if m["formats"] != nil {
		o.Formats = ToFormats(m["formats"])
	}
	if m["baseURL"] != nil {
		o.BaseURL = ToString(m["baseURL"])
	}
	if m["adminURL"] != nil {
		o.AdminURL = ToString(m["adminURL"])
	}
	if m["sort"] != nil {
		o.Sort = m["sort"].(bool)
	}
	return o
}

// Вызывает метод Imager по кейсу и возвращает результат (any).
func RunCase(c any) any {
	m := c.(map[string]any)
	method := m["method"].(string)
	args := m["args"]
	am := args.(map[string]any)

	img := imagergo.New(BuildOptions(m["options"]))

	if method == "GetAsset" {
		source := am["source"].(string)
		format := ""
		if am["format"] != nil {
			format = ToString(am["format"])
		}
		return img.GetAsset(source, ToSegment(am["segment"]), format, am["dpr"])
	}
	if method == "GetAssets" {
		source := am["source"].(string)
		var segs any
		if am["segments"] == nil {
			segs = nil
		} else {
			segs = ToSegments(am["segments"])
		}
		var formats any
		if am["formats"] == nil {
			formats = nil
		} else {
			formats = ToFormats(am["formats"])
		}
		return img.GetAssets(source, segs, formats, am["dprs"])
	}
	if method == "GetAssetPath" {
		source := am["source"].(string)
		format := ""
		if am["format"] != nil {
			format = ToString(am["format"])
		}
		return img.GetAssetPath(source, ToSegment(am["segment"]), format, am["dpr"])
	}
	if method == "GetAssetsHtml" {
		source := am["source"].(string)
		var segs any
		if am["segments"] == nil {
			segs = nil
		} else {
			segs = ToSegments(am["segments"])
		}
		var formats any
		if am["formats"] == nil {
			formats = nil
		} else {
			formats = ToFormats(am["formats"])
		}
		var opts map[string]any
		if am["options"] != nil {
			opts = am["options"].(map[string]any)
		}
		return img.GetAssetsHtml(source, segs, formats, am["dprs"], opts)
	}
	fmt.Println("unknown method:", method)
	os.Exit(1)
	return nil
}

// Сериализует значение в JSON-строку (порядок полей — из struct-тегов).
func Dumps(v any) string {
	data, err := json.Marshal(v)
	if err != nil {
		return "<marshal error>"
	}
	return bytes.NewBuffer(data).String()
}

// Канонизирует expected: Unmarshal в типизированную struct, затем Marshal.
// Это даёт тот же порядок полей и omitempty, что и у actual.
func Canonical(expected any, method string) string {
	if method == "GetAsset" {
		var at imagergo.AssetType
		data, _ := json.Marshal(expected)
		err := json.Unmarshal(data, &at)
		if err != nil {
			return "<unmarshal error>"
		}
		return Dumps(at)
	}
	if method == "GetAssets" {
		var list []imagergo.AssetType
		data, _ := json.Marshal(expected)
		err := json.Unmarshal(data, &list)
		if err != nil {
			return "<unmarshal error>"
		}
		return Dumps(list)
	}
	// GetAssetPath — строка
	return expected.(string)
}

// ------------------------------------------------------------------ //
//  Сравнение HTML: атрибуты без учёта порядка (наличие + значения)   //
// ------------------------------------------------------------------ //

// Разбирает HTML-строку на список тегов. Каждый тег — [2]any:
// [0] — имя тега (string), [1] — список атрибутов [][2]any (имя, значение).
// Значение nil — атрибут без значения (булев). Текст между тегами
// игнорируется (в GetAssetsHtml его нет).
func parseHtmlTags(html string) [][2]any {
	tags := make([][2]any, 0, 8)
	rest := html
	for {
		_, after, ok := strings.Cut(rest, "<")
		if !ok {
			break
		}
		// Ищем закрывающую '>' в after.
		tagBody, tail, ok2 := strings.Cut(after, ">")
		if !ok2 {
			break
		}
		rest = tail
		// Пропускаем закрывающие теги и комментарии/декларации.
		if strings.HasPrefix(tagBody, "/") || strings.HasPrefix(tagBody, "!") {
			continue
		}
		name, attrs := parseTagAttrs(tagBody)
		tags = append(tags, [2]any{name, attrs})
	}
	return tags
}

// Разбирает содержимое тега (без < >) на имя и список атрибутов.
func parseTagAttrs(tag string) (string, [][2]any) {
	// Имя тега — до первого пробела.
	sp := strings.Index(tag, " ")
	if sp < 0 {
		return tag, make([][2]any, 0, 0)
	}
	name := tag[0:sp]
	attrs := make([][2]any, 0, 8)
	rest := strings.TrimSpace(tag[sp:])
	for rest != "" {
		// Имя атрибута — до '=' или пробела.
		eq := strings.Index(rest, "=")
		sp2 := strings.Index(rest, " ")
		var attrName, afterName string
		if eq >= 0 && (sp2 < 0 || eq < sp2) {
			attrName = rest[0:eq]
			afterName = rest[eq+1:]
		} else if sp2 >= 0 {
			attrName = rest[0:sp2]
			afterName = rest[sp2:]
		} else {
			attrName = rest
			afterName = ""
		}
		attrName = strings.TrimSpace(attrName)
		afterName = strings.TrimSpace(afterName)

		if attrName == "" {
			rest = afterName
			continue
		}

		// Значение в кавычках (или без кавычек до пробела).
		var value any
		if strings.HasPrefix(afterName, `"`) {
			// Ищем закрывающую кавычку.
			valBody, valTail, okv := strings.Cut(afterName[1:], `"`)
			if okv {
				value = valBody
				rest = strings.TrimSpace(valTail)
			} else {
				value = afterName[1:]
				rest = ""
			}
		} else if afterName != "" {
			sp3 := strings.Index(afterName, " ")
			if sp3 >= 0 {
				value = afterName[0:sp3]
				rest = strings.TrimSpace(afterName[sp3:])
			} else {
				value = afterName
				rest = ""
			}
		} else {
			// Атрибут без значения (булев).
			value = nil
			rest = ""
		}
		attrs = append(attrs, [2]any{attrName, value})
	}
	return name, attrs
}

// Сравнивает два списка атрибутов как мультимножества (порядок не важен).
func attrsEqual(a, b [][2]any) bool {
	if len(a) != len(b) {
		return false
	}
	used := make(map[int]bool, len(b))
	for _, ka := range a {
		found := false
		for j := range b {
			if used[j] {
				continue
			}
			kb := b[j]
			if ka[0].(string) == kb[0].(string) && attrValueEqual(ka[1], kb[1]) {
				used[j] = true
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// Сравнивает значения атрибутов (nil — атрибут без значения).
func attrValueEqual(a, b any) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
}

// Сравнивает HTML-строки: порядок тегов важен, порядок атрибутов — нет.
func htmlEqual(a, b string) bool {
	ta := parseHtmlTags(a)
	tb := parseHtmlTags(b)
	if len(ta) != len(tb) {
		return false
	}
	for i := range ta {
		na, aa := ta[i][0].(string), ta[i][1].([][2]any)
		nb, ab := tb[i][0].(string), tb[i][1].([][2]any)
		if na != nb || !attrsEqual(aa, ab) {
			return false
		}
	}
	return true
}

func RunGolden() int {
	cases := LoadFixture()
	failed := 0
	total := 0
	for _, c := range cases {
		total++
		m := c.(map[string]any)
		cid := ToInt(m["id"])
		method := m["method"].(string)

		actual := RunCase(c)
		expected := m["expected"]
		var actualStr, expectedStr string
		ok := false
		switch method {
		case "GetAssetPath":
			// строки сравниваем напрямую (без JSON-кавычек)
			actualStr = actual.(string)
			expectedStr = expected.(string)
			ok = actualStr == expectedStr
		case "GetAssetsHtml":
			// HTML: порядок тегов важен, порядок атрибутов — нет.
			actualStr = actual.(string)
			expectedStr = expected.(string)
			ok = htmlEqual(actualStr, expectedStr)
		default:
			// JSON-объекты/массивы: сравниваем без учёта порядка ключей.
			// Обе стороны нормализуем через Marshal/Unmarshal в any, чтобы
			// типы совпадали (числа → float64), затем reflect.DeepEqual
			// (для map порядок ключей не важен).
			actualStr = Dumps(actual)
			expectedStr = Canonical(expected, method)
			var actualAny, expectedAny any
			aData, _ := json.Marshal(actual)
			eData, _ := json.Marshal(expected)
			_ = json.Unmarshal(aData, &actualAny)
			_ = json.Unmarshal(eData, &expectedAny)
			ok = reflect.DeepEqual(actualAny, expectedAny)
		}
		if !ok {
			failed++
			fmt.Println("[FAIL] id=" + strconv.Itoa(cid) + " " + method)
			fmt.Println("  expected: " + expectedStr)
			fmt.Println("  actual:   " + actualStr)
		} else {
			fmt.Println("[ok] id=" + strconv.Itoa(cid) + " " + method)
		}
	}
	fmt.Println("---")
	fmt.Println("golden: " + strconv.Itoa(total) + " cases, " + strconv.Itoa(total-failed) + " passed, " + strconv.Itoa(failed) + " failed")
	return failed
}

// ------------------------------------------------------------------ //
//  Админ-методы: mock HTTP-сервер                                    //
// ------------------------------------------------------------------ //

// Последний принятый запрос (для проверки заголовков/тела).
var LastRequest = map[string]string{}
var ResponseCode = 202
var ResponseBody = "{}"

// Хендлер мок-сервера: /admin/assets/generate (POST) и /admin/assets/delete (DELETE).
func MockHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if path == "/admin/assets/generate" && r.Method == "POST" {
		HandleMock(w, r, "POST", path)
		return
	}
	if path == "/admin/assets/delete" && r.Method == "DELETE" {
		HandleMock(w, r, "DELETE", path)
		return
	}
	w.WriteHeader(http.StatusNotFound)
	w.Write(bytes.NewBufferString("{}").Bytes())
}

func HandleMock(w http.ResponseWriter, r *http.Request, method, path string) {
	body := ""
	if r.Body != nil {
		data, err := io.ReadAll(r.Body)
		if err == nil {
			body = bytes.NewBuffer(data).String()
		}
	}
	auth := ""
	if r.Header["Authorization"] != nil && len(r.Header["Authorization"]) > 0 {
		auth = r.Header["Authorization"][0]
	}
	ct := ""
	if r.Header["Content-Type"] != nil && len(r.Header["Content-Type"]) > 0 {
		ct = r.Header["Content-Type"][0]
	}
	LastRequest["method"] = method
	LastRequest["path"] = path
	LastRequest["authorization"] = auth
	LastRequest["content_type"] = ct
	LastRequest["body"] = body

	w.WriteHeader(ResponseCode)
	w.Header().Set("Content-Type", "application/json")
	w.Write(bytes.NewBufferString(ResponseBody).Bytes())
}

func RunAdmin() int {
	failed := 0

	mux := http.NewServeMux()
	mux.HandleFunc("/admin/assets/generate", MockHandler)
	mux.HandleFunc("/admin/assets/delete", MockHandler)
	srv := httptest.NewServer(mux)
	base := srv.URL

	img := imagergo.New(imagergo.Options{
		Token:    "secret",
		Dpr:      0,
		Format:   "",
		Formats:  []string{},
		BaseURL:  "/",
		AdminURL: base,
	})

	// 1. Generate target-string, wait=true -> 202 -> True, тело и заголовки
	ResponseCode = 202
	ok := img.AdminGenerate("thumbs/photo.jpg", true)
	req := LastRequest
	if !ok {
		failed++
		fmt.Println("[FAIL] admin.generate string (202)")
	} else if req["method"] != "POST" || req["path"] != "/admin/assets/generate" ||
		req["authorization"] != "Bearer secret" || req["content_type"] != "application/json" {
		failed++
		fmt.Println("[FAIL] admin.generate headers/url: " + Dumps(req))
	} else {
		body := ParseJsonObject(req["body"])
		if body["source"] != "thumbs/photo.jpg" || body["wait"] != "true" {
			failed++
			fmt.Println("[FAIL] admin.generate body: " + req["body"])
		} else {
			fmt.Println("[ok] admin.generate string (202)")
		}
	}

	// 2. Generate с AssetType -> assets + wait
	ResponseCode = 200
	asset := imagergo.AssetType{
		Type: "image/webp",
		Paths: []imagergo.AssetPath{
			imagergo.AssetPath{Path: "https://x.test/a.webp"},
			imagergo.AssetPath{Path: "https://x.test/a@2.webp", Dpr: 2},
		},
	}
	ok = img.AdminGenerate(asset, false)
	req = LastRequest
	if !ok {
		failed++
		fmt.Println("[FAIL] admin.generate assets (200)")
	} else {
		body := ParseJsonObject(req["body"])
		if body["assets"] != "[\"https://x.test/a.webp\",\"https://x.test/a@2.webp\"]" || body["wait"] != "false" {
			failed++
			fmt.Println("[FAIL] admin.generate assets body: " + req["body"])
		} else {
			fmt.Println("[ok] admin.generate assets (200)")
		}
	}

	// 2b. Generate с []AssetType -> все path'ы в один список assets
	ResponseCode = 200
	asset2 := imagergo.AssetType{
		Type: "image/webp",
		Paths: []imagergo.AssetPath{
			imagergo.AssetPath{Path: "https://x.test/b.webp"},
		},
	}
	ok = img.AdminGenerate([]imagergo.AssetType{asset, asset2}, false)
	req = LastRequest
	if !ok {
		failed++
		fmt.Println("[FAIL] admin.generate []AssetType (200)")
	} else {
		body := ParseJsonObject(req["body"])
		if body["assets"] != "[\"https://x.test/a.webp\",\"https://x.test/a@2.webp\",\"https://x.test/b.webp\"]" || body["wait"] != "false" {
			failed++
			fmt.Println("[FAIL] admin.generate []AssetType body: " + req["body"])
		} else {
			fmt.Println("[ok] admin.generate []AssetType (200)")
		}
	}

	// 2c. Generate с []string -> пути как есть, без валидации
	ResponseCode = 200
	rawPaths := []string{"https://cdn.test/one.webp", "https://cdn.test/two.webp"}
	ok = img.AdminGenerate(rawPaths, false)
	req = LastRequest
	if !ok {
		failed++
		fmt.Println("[FAIL] admin.generate []string (200)")
	} else {
		body := ParseJsonObject(req["body"])
		if body["assets"] != "[\"https://cdn.test/one.webp\",\"https://cdn.test/two.webp\"]" || body["wait"] != "false" {
			failed++
			fmt.Println("[FAIL] admin.generate []string body: " + req["body"])
		} else {
			fmt.Println("[ok] admin.generate []string (200)")
		}
	}

	// 3. Generate: код 500 -> False
	ResponseCode = 500
	if img.AdminGenerate("thumbs/photo.jpg", false) {
		failed++
		fmt.Println("[FAIL] admin.generate must be False on 500")
	} else {
		fmt.Println("[ok] admin.generate False on 500")
	}

	// 4. Delete: 200 -> True
	ResponseCode = 200
	if !img.AdminDelete("thumbs/photo.jpg", true) {
		failed++
		fmt.Println("[FAIL] admin.delete (200)")
	} else {
		req = LastRequest
		body := ParseJsonObject(req["body"])
		if req["method"] != "DELETE" || req["path"] != "/admin/assets/delete" {
			failed++
			fmt.Println("[FAIL] admin.delete request: " + Dumps(req))
		} else if body["source"] != "thumbs/photo.jpg" || body["wait"] != "true" {
			failed++
			fmt.Println("[FAIL] admin.delete body: " + req["body"])
		} else {
			fmt.Println("[ok] admin.delete (200)")
		}
	}

	// 5. Delete: 202 (недопустим для delete) -> False
	ResponseCode = 202
	if img.AdminDelete("thumbs/photo.jpg", true) {
		failed++
		fmt.Println("[FAIL] admin.delete must be False on 202")
	} else {
		fmt.Println("[ok] admin.delete False on 202")
	}

	// 6. Пустой token/adminURL -> False без сети
	noauth := imagergo.New(imagergo.Options{
		Token:    "",
		Dpr:      0,
		Format:   "",
		Formats:  []string{},
		BaseURL:  "/",
		AdminURL: base,
	})
	if noauth.AdminGenerate("x.jpg", false) {
		failed++
		fmt.Println("[FAIL] empty token must return False")
	} else {
		fmt.Println("[ok] empty token -> False")
	}
	noauth2 := imagergo.New(imagergo.Options{
		Token:    "t",
		Dpr:      0,
		Format:   "",
		Formats:  []string{},
		BaseURL:  "/",
		AdminURL: "",
	})
	if noauth2.AdminGenerate("x.jpg", false) || noauth2.AdminDelete("x.jpg", false) {
		failed++
		fmt.Println("[FAIL] empty adminURL must return False")
	} else {
		fmt.Println("[ok] empty adminURL -> False")
	}

	srv.Close()
	fmt.Println("---")
	fmt.Println("admin: " + strconv.Itoa(failed) + " failed")
	return failed
}

// Парсит JSON-объект в map[string]string (значения — строки).
func ParseJsonObject(s string) map[string]string {
	result := map[string]string{}
	var v any
	err := json.Unmarshal(bytes.NewBufferString(s).Bytes(), &v)
	if err != nil {
		return result
	}
	m := v.(map[string]any)
	for k, val := range m {
		if val == nil {
			result[k] = ""
		} else {
			switch t := val.(type) {
			case string:
				result[k] = t
			case bool:
				if t {
					result[k] = "true"
				} else {
					result[k] = "false"
				}
			case []string:
				data, _ := json.Marshal(t)
				result[k] = bytes.NewBuffer(data).String()
			default:
				data, _ := json.Marshal(val)
				result[k] = bytes.NewBuffer(data).String()
			}
		}
	}
	return result
}

// runExternal запускает внешний тест-раннер (npm/php/python) и возвращает
// 1 при ошибке, 0 при успехе. Используется оркестратором для единого
// запуска тестов всех языков из одного шага CI.

func runExternal(name string, args ...string) int {
	return runExternalDir("", name, args...)
}

// runExternalDir — как runExternal, но с рабочей директорией dir
// (пустая строка — корень проекта).
func runExternalDir(dir, name string, args ...string) int {
	fmt.Println("---")
	fmt.Println(">>>", name, strings.Join(args, " "))
	cmd := exec.Command(name, args...)
	if dir != "" {
		cmd.Dir = dir
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Println("[FAIL] external:", name, strings.Join(args, " "), "->", err)
		return 1
	}
	return 0
}

func main() {
	failed := 0
	failed += RunGolden()
	failed += RunAdmin()
	// Оркестратор: единый запуск тестов всех языков (TS, PHP, Python).
	// Go-часть — выше (RunGolden/RunAdmin).
	failed += runExternal("npm", "test")
	failed += runExternal("php", "test/test.php")
	failed += runExternal("python", "test/test.py")
	// Фреймворк-пакеты: golden-сценарий по test/fixture.json (HTML-кейсы).
	// Twig в golden-прогоне не участвует (сверяется с ядром PHP локально).
	failed += runExternalDir("packages/react", "npm", "test")
	failed += runExternalDir("packages/vue", "npm", "test")
	if failed > 0 {
		fmt.Println("=== RESULT: FAIL ===")
		os.Exit(1)
	} else {
		fmt.Println("=== RESULT: PASS ===")
	}
}
