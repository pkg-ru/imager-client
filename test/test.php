<?php

declare(strict_types=1);

/**
 * Раннер golden-тестов для PHP-клиента imager.
 *
 * Читает test/fixture.json (единые golden-кейсы для всех языков), выполняет
 * каждый кейс через imagerClient\Imager и сверяет результат с expected
 * побайтово (порядок ключей и состав полей). Дополнительно выполняет
 * unit-тесты админ-методов (AdminGenerate/AdminDelete) с локальным
 * mock-HTTP-сервером на stream_socket_server.
 *
 * Запуск: php test/test.php  (из корня проекта)
 */

use imagerClient\AssetPath;
use imagerClient\AssetType;
use imagerClient\Imager;

define('PROJECT_DIR', dirname(__DIR__));
define('FIXTURE', PROJECT_DIR . '/test/fixture.json');

// --------------------------------------------------------------------- //
//  Автозагрузка: composer (если vendor есть) либо PSR-4 fallback      //
// --------------------------------------------------------------------- //

if (is_file(PROJECT_DIR . '/vendor/autoload.php')) {
    require PROJECT_DIR . '/vendor/autoload.php';
} else {
    // Классы и функции imagerClient\ определены в двух файлах
    //: ImagerTypes.php и Imager.php.
    require_once PROJECT_DIR . '/src/imager-php/ImagerTypes.php';
    require_once PROJECT_DIR . '/src/imager-php/Imager.php';
}

// ------------------------------------------------------------------ //
//  Golden-кейсы                                                      //
// ------------------------------------------------------------------ //

/** @return array|mixed|null */
function loadFixture()
{
    $data = file_get_contents(FIXTURE);
    if ($data === false) {
        fwrite(STDERR, "[Fatal] cannot read " . FIXTURE . PHP_EOL);
        exit(2);
    }
    return json_decode($data, true);
}

/** @param mixed $value */
function encode($value): string
{
    return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function assetPathToArray(AssetPath $path): array
{
    $out = ['path' => $path->path];
    if ($path->dpr !== null) {
        $out['dpr'] = $path->dpr;
    }
    if ($path->width !== null) {
        $out['width'] = $path->width;
    }
    if ($path->height !== null) {
        $out['height'] = $path->height;
    }
    return $out;
}

function assetTypeToArray(AssetType $asset): array
{
    $paths = [];
    foreach ($asset->paths as $p) {
        $paths[] = assetPathToArray($p);
    }
    $result = ['type' => $asset->type, 'paths' => $paths];
    if ($asset->source_format === true) {
        $result['source_format'] = true;
    }
    if ($asset->all_support === true) {
        $result['all_support'] = true;
    }
    return $result;
}

function runCase(array $case)
{
    $options = $case['options'] ?? [];
    $args = $case['args'] ?? [];
    $method = $case['method'];

    $img = new Imager($options);

    if ($method === 'GetAsset') {
        return assetTypeToArray($img->GetAsset(
            $args['source'] ?? null,
            $args['segment'] ?? null,
            $args['format'] ?? null,
            $args['dpr'] ?? null
        ));
    }
    if ($method === 'GetAssets') {
        $assets = $img->GetAssets(
            $args['source'] ?? null,
            $args['segments'] ?? null,
            $args['formats'] ?? null,
            $args['dprs'] ?? null
        );
        $out = [];
        foreach ($assets as $a) {
            $out[] = assetTypeToArray($a);
        }
        return $out;
    }
    if ($method === 'GetAssetPath') {
        return $img->GetAssetPath(
            $args['source'] ?? null,
            $args['segment'] ?? null,
            $args['format'] ?? null,
            $args['dpr'] ?? null
        );
    }
    if ($method === 'GetAssetsHtml') {
        return $img->GetAssetsHtml(
            $args['source'] ?? null,
            $args['segments'] ?? null,
            $args['formats'] ?? null,
            $args['dprs'] ?? null,
            $args['options'] ?? null
        );
    }

    throw new RuntimeException('Unknown method: ' . $method);
}

function dumps($value): string
{
    return encode($value);
}

function runGolden(): int
{
    $fixture = loadFixture();
    if (!is_array($fixture)) {
        fwrite(STDERR, "[FATAL] fixture is not a list" . PHP_EOL);
        exit(2);
    }

    $failed = 0;
    $total = 0;
    foreach ($fixture as $case) {
        $total++;
        $cid = $case['id'] ?? '?';
        $actual = runCase($case);
        $expected = $case['expected'];

        if (!jsonEqual($actual, $expected)) {
            $failed++;
            echo '[FAIL] id=' . $cid . ' ' . $case['method'] . PHP_EOL;
            echo '  expected: ' . dumps($expected) . PHP_EOL;
            echo '  actual:   ' . dumps($actual) . PHP_EOL;
        } else {
            echo '[ok] id=' . $cid . ' ' . $case['method'] . PHP_EOL;
        }
    }
    echo '---' . PHP_EOL;
    echo sprintf('golden: %d cases, %d passed, %d failed', $total, $total - $failed, $failed) . PHP_EOL;

    return $failed;
}

/**
 * Побайтовое сравнение JSON-сериализации (включая порядок ключей).
 *
 * Ассоциативные массивы сравниваются по порядку ключей и значениям;
 * списки — по элементам; скаляры — со строгой типизацией.
 */
function jsonEqual($a, $b): bool
{
    if (is_array($a) && is_array($b)) {
        if (array_keys($a) !== array_keys($b)) {
            return false;
        }
        foreach ($a as $k => $v) {
            if (!jsonEqual($v, $b[$k])) {
                return false;
            }
        }
        return true;
    }
    if (is_array($a) || is_array($b)) {
        return false;
    }
    if (is_bool($a) !== is_bool($b)) {
        return false;
    }
    if (is_int($a) !== is_int($b)) {
        return false;
    }
    return $a === $b;
}

// --------------------------------------------------------------------- #
//  Админ-методы: mock HTTP-сервер (stream_socket_server)               #
// --------------------------------------------------------------------- #

/**
 * Запускает mock-HTTP-сервер в отдельном процессе PHP.
 * Возвращает массив с процессом, трубами, портом и путями команд/лога.
 */
function startMockServer(): array
{
    // Выбираем свободный порт
    for ($attempt = 0; $attempt < 20; $attempt++) {
        $port = random_int(20000, 45000);
        $sock = @stream_socket_server('tcp://127.0.0.1:' . $port, $errno, $errstr);
        if ($sock) {
            fclose($sock);
            break;
        }
        $port = 0;
    }
    if (!$port) {
        throw new RuntimeException('Cannot find free port');
    }

    $tmp = sys_get_temp_dir();
    $cmdFile = tempnam($tmp, 'imgr_cmd_');
    $logFile = tempnam($tmp, 'imgr_log_');

    $code = <<<'PHP'
<?php
$port    = (int)$argv[1];
$logFile = $argv[2];
$cmdFile = $argv[3];

$server = stream_socket_server("tcp://127.0.0.1:" . $port, $errno, $errstr);
if (!$server) {
    fwrite(STDERR, "ERR " . $errstr);
    exit(1);
}
fwrite(STDOUT, "READY\n");
fflush(STDOUT);

// обрабатываем до 32 запросов, затем завершаемся
for ($n = 0; $n < 32; $n++) {
    $conn = @stream_socket_accept($server, 30);
    if (!$conn) {
        break;
    }

    // читаем заголовки до CRLFCRLF
    $raw = '';
    while (strpos($raw, "\r\n\r\n") === false) {
        $chunk = fread($conn, 8192);
        if ($chunk === false || $chunk === '') {
            break;
        }
        $raw .= $chunk;
    }

    $headerEnd = strpos($raw, "\r\n\r\n");
    if ($headerEnd === false) {
        $headerEnd = 0;
    }
    $headerBlock = substr($raw, 0, $headerEnd);
    $bodyRaw = strlen($raw) > $headerEnd + 4 ? substr($raw, $headerEnd + 4) : '';

    $lines = explode("\r\n", $headerBlock);
    $requestLine = $lines[0] ?? '';
    $parts = explode(' ', $requestLine);
    $method = $parts[0] ?? '';
    $path = $parts[1] ?? '';

    $headers = [];
    foreach (array_slice($lines, 1) as $line) {
        if (strpos($line, ':') !== false) {
            [$k, $v] = explode(':', $line, 2);
            $headers[strtolower(trim($k))] = trim($v);
        }
    }

    $length = (int)($headers['content-length'] ?? 0);
    while (strlen($bodyRaw) < $length) {
        $chunk = fread($conn, 8192);
        if ($chunk === false || $chunk === '') {
            break;
        }
        $bodyRaw .= $chunk;
    }
    $body = substr($bodyRaw, 0, $length);

    $log = [
        'method'        => $method,
        'path'          => $path,
        'authorization' => $headers['authorization'] ?? '',
        'content_type'  => $headers['content-type'] ?? '',
        'body'          => $body,
    ];
    file_put_contents($logFile, json_encode($log));

    $cmd = json_decode((string)file_get_contents($cmdFile), true);
    $code2 = isset($cmd['code']) ? (int)$cmd['code'] : 200;
    $respBody = '{}';
    fwrite($conn, "HTTP/1.1 " . $code2 . " Status\r\n"
        . "Content-Type: application/json\r\n"
        . "Content-Length: " . strlen($respBody) . "\r\n"
        . "Connection: close\r\n\r\n" . $respBody);
    fclose($conn);
}
fclose($server);
PHP;

    $serverFile = tempnam($tmp, 'mockr_') . '.php';
    file_put_contents($serverFile, $code);

    $process = proc_open(
        [PHP_BINARY, $serverFile, (string)$port, $logFile, $cmdFile],
        [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ],
        $pipes
    );
    if (!is_resource($process)) {
        throw new RuntimeException('Cannot start mock server');
    }

    // ждём READY
    $ready = stream_get_line($pipes[1], 1024, "\n");
    if ($ready !== 'READY') {
        $err = stream_get_contents($pipes[2]);
        fclose($pipes[0]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);
        throw new RuntimeException('Mock server not ready: ' . $err);
    }

    return [
        'process' => $process,
        'pipes'   => $pipes,
        'port'    => $port,
        'cmdFile' => $cmdFile,
        'logFile' => $logFile,
        'serverFile' => $serverFile,
    ];
}

function stopMockServer(array $server): void
{
    if (isset($server['pipes'])) {
        foreach ($server['pipes'] as $pipe) {
            if (is_resource($pipe)) {
                fclose($pipe);
            }
        }
    }
    if (isset($server['process']) && is_resource($server['process'])) {
        proc_close($server['process']);
    }
    foreach (['cmdFile', 'logFile', 'serverFile'] as $key) {
        if (isset($server[$key]) && is_file($server[$key])) {
            @unlink($server[$key]);
        }
    }
}

/** @param mixed $body */
function readLastRequest(array $server): array
{
    $data = file_get_contents($server['logFile']);
    if ($data === false || $data === '') {
        return [];
    }
    return json_decode($data, true) ?: [];
}

/** @param array<string,mixed> $server */
function setResponseCode(array $server, int $code): void
{
    file_put_contents($server['cmdFile'], json_encode(['code' => $code]));
}

function runAdmin(): int
{
    $failed = 0;

    $server = null;
    try {
        $server = startMockServer();
    } catch (Throwable $e) {
        fwrite(STDERR, '[FATAL] cannot start mock server: ' . $e->getMessage() . PHP_EOL);
        return 1;
    }

    $base = 'http://127.0.0.1:' . $server['port'];
    $img = new Imager(['token' => 'secret', 'adminURL' => $base]);

    // 1. Generate target-string, wait=true -> 202 -> True, тело и заголовки
    setResponseCode($server, 202);
    $ok = $img->AdminGenerate('thumbs/photo.jpg', true);
    $req = readLastRequest($server);
    if (!$ok) {
        $failed++;
        echo '[FAIL] admin.generate string (202)' . PHP_EOL;
    } elseif (
        $req['method'] !== 'POST'
        || $req['path'] !== '/admin/assets/generate'
        || $req['authorization'] !== 'Bearer secret'
        || $req['content_type'] !== 'application/json'
    ) {
        $failed++;
        echo '[FAIL] admin.generate headers/url: ' . json_encode($req) . PHP_EOL;
    } else {
        $body = json_decode($req['body'], true);
        if ($body === null || $body !== ['source' => 'thumbs/photo.jpg', 'wait' => true]) {
            $failed++;
            echo '[FAIL] admin.generate body: ' . $req['body'] . PHP_EOL;
        } else {
            echo '[ok] admin.generate string (202)' . PHP_EOL;
        }
    }

    // 2. Generate с AssetType -> assets + wait=200
    setResponseCode($server, 200);
    $asset = new AssetType();
    $asset->type = 'image/webp';
    $p1 = new AssetPath();
    $p1->path = 'https://x.test/a.webp';
    $p2 = new AssetPath();
    $p2->path = 'https://x.test/a@2.webp';
    $p2->dpr = 2;
    $asset->paths = [$p1, $p2];

    $ok = $img->AdminGenerate($asset, false);
    $req = readLastRequest($server);
    if (!$ok) {
        $failed++;
        echo '[FAIL] admin.generate assets (200)' . PHP_EOL;
    } else {
        $body = json_decode($req['body'], true);
        $expectedBody = [
            'assets' => ['https://x.test/a.webp', 'https://x.test/a@2.webp'],
            'wait' => false,
        ];
        if ($body === null || $body !== $expectedBody) {
            $failed++;
            echo '[FAIL] admin.generate assets body: ' . $req['body'] . PHP_EOL;
        } else {
            echo '[ok] admin.generate assets (200)' . PHP_EOL;
        }
    }

    // 2b. Generate с AssetType[] -> все path'ы в один список assets
    setResponseCode($server, 200);
    $asset2 = new AssetType();
    $asset2->type = 'image/webp';
    $p3 = new AssetPath();
    $p3->path = 'https://x.test/b.webp';
    $asset2->paths = [$p3];

    $ok = $img->AdminGenerate([$asset, $asset2], false);
    $req = readLastRequest($server);
    if (!$ok) {
        $failed++;
        echo '[FAIL] admin.generate AssetType[] (200)' . PHP_EOL;
    } else {
        $body = json_decode($req['body'], true);
        $expectedBody = [
            'assets' => ['https://x.test/a.webp', 'https://x.test/a@2.webp', 'https://x.test/b.webp'],
            'wait' => false,
        ];
        if ($body === null || $body !== $expectedBody) {
            $failed++;
            echo '[FAIL] admin.generate AssetType[] body: ' . $req['body'] . PHP_EOL;
        } else {
            echo '[ok] admin.generate AssetType[] (200)' . PHP_EOL;
        }
    }

    // 2c. Generate с string[] -> пути как есть, без валидации
    setResponseCode($server, 200);
    $rawPaths = ['https://cdn.test/one.webp', 'https://cdn.test/two.webp'];
    $ok = $img->AdminGenerate($rawPaths, false);
    $req = readLastRequest($server);
    if (!$ok) {
        $failed++;
        echo '[FAIL] admin.generate string[] (200)' . PHP_EOL;
    } else {
        $body = json_decode($req['body'], true);
        $expectedBody = ['assets' => $rawPaths, 'wait' => false];
        if ($body === null || $body !== $expectedBody) {
            $failed++;
            echo '[FAIL] admin.generate string[] body: ' . $req['body'] . PHP_EOL;
        } else {
            echo '[ok] admin.generate string[] (200)' . PHP_EOL;
        }
    }

    // 3. Generate: код 500 -> False
    setResponseCode($server, 500);
    if ($img->AdminGenerate('thumbs/photo.jpg', false)) {
        $failed++;
        echo '[FAIL] admin.generate must be False on 500' . PHP_EOL;
    } else {
        echo '[ok] admin.generate False on 500' . PHP_EOL;
    }

    // 4. Delete: 200 -> True
    setResponseCode($server, 200);
    if (!$img->AdminDelete('thumbs/photo.jpg', true)) {
        $failed++;
        echo '[FAIL] admin.delete (200)' . PHP_EOL;
    } else {
        $req = readLastRequest($server);
        $body = json_decode($req['body'] ?? '', true) ?: [];
        if ($req['method'] !== 'DELETE' || $req['path'] !== '/admin/assets/delete') {
            $failed++;
            echo '[FAIL] admin.delete request: ' . json_encode($req) . PHP_EOL;
        } elseif ($body !== ['source' => 'thumbs/photo.jpg', 'wait' => true]) {
            $failed++;
            echo '[FAIL] admin.delete body: ' . $req['body'] . PHP_EOL;
        } else {
            echo '[ok] admin.delete (200)' . PHP_EOL;
        }
    }

    // 5. Delete: 202 (недопустим для delete) -> False
    setResponseCode($server, 202);
    if ($img->AdminDelete('thumbs/photo.jpg', true)) {
        $failed++;
        echo '[FAIL] admin.delete must be False on 202' . PHP_EOL;
    } else {
        echo '[ok] admin.delete False on 202' . PHP_EOL;
    }

    // 6. Пустой token/adminURL -> False без сети
    $noauth = new Imager(['adminURL' => $base]);
    if ($noauth->AdminGenerate('x.jpg', false)) {
        $failed++;
        echo '[FAIL] empty token must return False' . PHP_EOL;
    } else {
        echo '[ok] empty token -> False' . PHP_EOL;
    }
    $noauth2 = new Imager(['token' => 't']);
    if ($noauth2->AdminGenerate('x.jpg', false) || $noauth2->AdminDelete('x.jpg', false)) {
        $failed++;
        echo '[FAIL] empty adminURL must return False' . PHP_EOL;
    } else {
        echo '[ok] empty adminURL -> False' . PHP_EOL;
    }

    stopMockServer($server);
    echo '---' . PHP_EOL;
    echo 'admin: ' . $failed . ' failed' . PHP_EOL;

    return $failed;
}

$failed = 0;
$failed += runGolden();
$failed += runAdmin();

echo '=== RESULT: ' . ($failed ? 'FAIL' : 'PASS') . ' ===' . PHP_EOL;
if ($failed) {
    exit(1);
}
exit(0);
