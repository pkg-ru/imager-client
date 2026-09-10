"""Раннер golden-тестов для Python-клиента imager.

Читает test/fixture.json (единые golden-кейсы для всех языков), выполняет
каждый кейс через src.imager.Imager и сверяет результат с expected
побайтово (порядок ключей и состав полей). Дополнительно выполняет
unit-тесты админ-методов (AdminGenerate/AdminDelete) с локальным
mock-HTTP-сервером на http.server.

Запуск: python test/test.py  (из корня проекта)
"""
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.imager import Imager  # noqa: E402

PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FIXTURE = os.path.join(PROJECT_DIR, "test", "fixture.json")


def load_fixture():
    with open(FIXTURE, "r", encoding="utf-8") as fh:
        return json.load(fh)


def run_case(case):
    """Вызывает метод Imager по кейсу и возвращает результат."""
    options = case.get("options") or {}
    args = case.get("args") or {}
    method = case["method"]
    img = Imager(options)

    if method == "GetAsset":
        return img.GetAsset(
            args.get("source"),
            args.get("segment"),
            args.get("format"),
            args.get("dpr"),
        )
    if method == "GetAssets":
        return img.GetAssets(
            args.get("source"),
            args.get("segments"),
            args.get("formats"),
            args.get("dprs"),
        )
    if method == "GetAssetPath":
        return img.GetAssetPath(
            args.get("source"),
            args.get("segment"),
            args.get("format"),
            args.get("dpr"),
        )
    if method == "GetAssetsHtml":
        return img.GetAssetsHtml(
            args.get("source"),
            args.get("segments"),
            args.get("formats"),
            args.get("dprs"),
            args.get("options"),
        )
    raise ValueError("Unknown method: %r" % method)


def dumps(value):
    return json.dumps(value, ensure_ascii=False)


def run_golden():
    """Сравнивает результаты всех кейсов fixture.json с expected."""
    fixture = load_fixture()
    failed = 0
    total = 0
    for case in fixture:
        total += 1
        cid = case["id"]
        actual = run_case(case)
        expected = case["expected"]
        if not _json_equal(actual, expected):
            failed += 1
            print("[FAIL] id=%d %s" % (cid, case["method"]))
            print("  expected: %s" % dumps(expected))
            print("  actual:   %s" % dumps(actual))
        else:
            print("[ok] id=%d %s" % (cid, case["method"]))
    print("---")
    print("golden: %d cases, %d passed, %d failed" % (total, total - failed, failed))
    return failed


def _json_equal(a, b):
    """Побайтовое сравнение JSON-сериализации (включая порядок ключей)."""
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        return all(_json_equal(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        if list(a.keys()) != list(b.keys()):
            return False
        return all(_json_equal(a[k], b[k]) for k in a)
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    return a == b


# --------------------------------------------------------------------- #
#  Админ-методы: mock HTTP-сервер                                      #
# --------------------------------------------------------------------- #

class MockHandler(BaseHTTPRequestHandler):
    # --- настраивается извне через класс-атрибуты ---
    response_code = 202
    response_body = b"{}"
    last_request = None

    def do_POST(self):
        if self.path != "/admin/assets/generate":
            self.send_response(404)
            self.end_headers()
            return
        self._handle("POST")

    def do_DELETE(self):
        if self.path != "/admin/assets/delete":
            self.send_response(404)
            self.end_headers()
            return
        self._handle("DELETE")

    def _handle(self, method):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode("utf-8") if length else ""
        MockHandler.last_request = {
            "method": method,
            "path": self.path,
            "authorization": self.headers.get("Authorization", ""),
            "content_type": self.headers.get("Content-Type", ""),
            "body": body,
        }
        self.send_response(MockHandler.response_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(MockHandler.response_body)

    def log_message(self, *args):
        pass


def start_mock_server(port=0):
    server = HTTPServer(("127.0.0.1", port), MockHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def run_admin():
    """Unit-тесты AdminGenerate/AdminDelete на mock-HTTP-сервере."""
    server = start_mock_server()
    base = "http://127.0.0.1:%d" % server.server_address[1]
    failed = 0

    img = Imager({"token": "secret", "adminURL": base})

    # 1. Generate target-string, wait=true -> 202 -> True, тело и заголовки
    MockHandler.response_code = 202
    ok = img.AdminGenerate("thumbs/photo.jpg", True)
    req = MockHandler.last_request
    if not ok:
        failed += 1
        print("[FAIL] admin.generate string (202)")
    elif (
        req["method"] != "POST"
        or req["path"] != "/admin/assets/generate"
        or req["authorization"] != "Bearer secret"
        or req["content_type"] != "application/json"
    ):
        failed += 1
        print("[FAIL] admin.generate headers/url: %r" % req)
    else:
        body = json.loads(req["body"])
        if body != {"source": "thumbs/photo.jpg", "wait": True}:
            failed += 1
            print("[FAIL] admin.generate body: %r" % req["body"])
        else:
            print("[ok] admin.generate string (202)")

    # 2. Generate с AssetType -> assets + wait
    MockHandler.response_code = 200
    asset = {
        "type": "image/webp",
        "paths": [
            {"path": "https://x.test/a.webp"},
            {"path": "https://x.test/a@2.webp", "dpr": 2},
        ],
    }
    ok = img.AdminGenerate(asset, False)
    req = MockHandler.last_request
    if not ok:
        failed += 1
        print("[FAIL] admin.generate assets (200)")
    else:
        body = json.loads(req["body"])
        expected_body = {
            "assets": ["https://x.test/a.webp", "https://x.test/a@2.webp"],
            "wait": False,
        }
        if body != expected_body:
            failed += 1
            print("[FAIL] admin.generate assets body: %r" % req["body"])
        else:
            print("[ok] admin.generate assets (200)")

    # 2b. Generate с AssetType[] -> все path'ы в один список assets
    MockHandler.response_code = 200
    asset2 = {
        "type": "image/webp",
        "paths": [{"path": "https://x.test/b.webp"}],
    }
    ok = img.AdminGenerate([asset, asset2], False)
    req = MockHandler.last_request
    if not ok:
        failed += 1
        print("[FAIL] admin.generate AssetType[] (200)")
    else:
        body = json.loads(req["body"])
        expected_body = {
            "assets": ["https://x.test/a.webp", "https://x.test/a@2.webp", "https://x.test/b.webp"],
            "wait": False,
        }
        if body != expected_body:
            failed += 1
            print("[FAIL] admin.generate AssetType[] body: %r" % req["body"])
        else:
            print("[ok] admin.generate AssetType[] (200)")

    # 2c. Generate с string[] -> пути как есть, без валидации
    MockHandler.response_code = 200
    raw_paths = ["https://cdn.test/one.webp", "https://cdn.test/two.webp"]
    ok = img.AdminGenerate(raw_paths, False)
    req = MockHandler.last_request
    if not ok:
        failed += 1
        print("[FAIL] admin.generate string[] (200)")
    else:
        body = json.loads(req["body"])
        expected_body = {"assets": raw_paths, "wait": False}
        if body != expected_body:
            failed += 1
            print("[FAIL] admin.generate string[] body: %r" % req["body"])
        else:
            print("[ok] admin.generate string[] (200)")

    # 3. Generate: код 500 -> False
    MockHandler.response_code = 500
    if img.AdminGenerate("thumbs/photo.jpg", False):
        failed += 1
        print("[FAIL] admin.generate must be False on 500")
    else:
        print("[ok] admin.generate False on 500")

    # 4. Delete: 200 -> True
    MockHandler.response_code = 200
    if not img.AdminDelete("thumbs/photo.jpg", True):
        failed += 1
        print("[FAIL] admin.delete (200)")
    else:
        req = MockHandler.last_request
        body = json.loads(req["body"]) if req else {}
        if req["method"] != "DELETE" or req["path"] != "/admin/assets/delete":
            failed += 1
            print("[FAIL] admin.delete request: %r" % req)
        elif body != {"source": "thumbs/photo.jpg", "wait": True}:
            failed += 1
            print("[FAIL] admin.delete body: %r" % req["body"])
        else:
            print("[ok] admin.delete (200)")

    # 5. Delete: 202 (недопустим для delete) -> False
    MockHandler.response_code = 202
    if img.AdminDelete("thumbs/photo.jpg", True):
        failed += 1
        print("[FAIL] admin.delete must be False on 202")
    else:
        print("[ok] admin.delete False on 202")

    # 6. Пустой token/adminURL -> False без сети
    noauth = Imager({"adminURL": base})  # token пуст
    if noauth.AdminGenerate("x.jpg", False):
        failed += 1
        print("[FAIL] empty token must return False")
    else:
        print("[ok] empty token -> False")
    noauth2 = Imager({"token": "t"})
    if noauth2.AdminGenerate("x.jpg", False) or noauth2.AdminDelete("x.jpg", False):
        failed += 1
        print("[FAIL] empty adminURL must return False")
    else:
        print("[ok] empty adminURL -> False")

    server.shutdown()
    print("---")
    print("admin: %d failed" % failed)
    return failed


def main():
    failed = 0
    failed += run_golden()
    failed += run_admin()
    print("=== RESULT: %s ===" % ("FAIL" if failed else "PASS"))
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
