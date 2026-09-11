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
	"strconv"
	"strings"

	imagergo "gitverse.ru/pkg-ru/imager-client/v2/src/imager-go"
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
		if method == "GetAssetPath" || method == "GetAssetsHtml" {
			// строки сравниваем напрямую (без JSON-кавычек)
			actualStr = actual.(string)
			expectedStr = expected.(string)
		} else {
			actualStr = Dumps(actual)
			expectedStr = Canonical(expected, method)
		}
		if actualStr != expectedStr {
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
	fmt.Println("---")
	fmt.Println(">>>", name, strings.Join(args, " "))
	cmd := exec.Command(name, args...)
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
	// Go-часть — выше (RunGolden/RunAdmin.
	failed += runExternal("npm", "test")
	failed += runExternal("php", "test/test.php")
	failed += runExternal("python", "test/test.py")
	if failed > 0 {
		fmt.Println("=== RESULT: FAIL ===")
		os.Exit(1)
	} else {
		fmt.Println("=== RESULT: PASS ===")
	}
}
