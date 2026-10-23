<?php
/**
 * เก็บหน้าหลังบ้าน + ข้อมูล AJAX ของระบบหนึ่งเป็นไฟล์ดิบ สำหรับเว็บทดลอง mrta-back-office (build.py แปลงต่อเป็นเว็บ static)
 *
 * ล็อกอินเป็นผู้ใช้ที่กำหนดในโปรเซส (ไม่ใช้รหัสผ่าน ไม่สร้าง session ในฐานข้อมูล)
 * ทุก request อยู่ในทรานแซกชันแล้ว rollback (cache ก็อยู่ใน DB เดียวกัน) + Mail/Queue/Notification ปลอม
 * HTTP ออกไปข้างนอก: ตอบปลอมทั้งหมด (ไม่ไปสร้าง session / log ในระบบอื่น)
 *
 * ไล่หน้าแบบ BFS: เริ่มจาก route GET admin/* ที่ไม่มีพารามิเตอร์ แล้วตามลิงก์ในหน้า/ในข้อมูลตาราง
 * URL ใน <script> ที่ตรง route POST แนวอ่านข้อมูล (datatable / chart / list ...) เก็บด้วยพารามิเตอร์ DataTables ทั้งหมดทีเดียว
 *
 * ใช้: php capture.php <app dir> <sys> <user id> <out dir> [guest paths คั่นด้วย ,] [seeds.json]
 */

ini_set('memory_limit', '2048M');
set_time_limit(0);

[$_, $dir, $sys, $uid, $outRoot] = $argv;
$guestPaths = array_values(array_filter(explode(',', $argv[5] ?? '')));
$uid = (int) $uid;
$out = rtrim($outRoot, '/\\') . '/' . $sys;
@mkdir($out . '/raw', 0775, true);

chdir($dir);
require $dir . '/vendor/autoload.php';
$app = require $dir . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const PER_ROUTE = 12;      // เก็บหน้ารายละเอียด/แก้ไขต่อ route ไม่เกินกี่รายการ
const MAX_ITEMS = 1500;    // กันหลุดวน

// GET ที่เปลี่ยนข้อมูลหรือได้ไฟล์ ไม่เปิด
const SKIP = '~(^|[/._-])(logout|signout|delete|destroy|remove|export|exports|download|excel|csv|xlsx|pdf|reindex|clear|flush|sync|run|send|resend|test-?mail|impersonate|login-?as|approve|reject|toggle|set-?status|change-?status|update-?status|duplicate|copy|clone|restore|import|generate|regenerate|reset|unlock|unblock|block|revoke|cancel|backup|truncate|purge|rebuild|install|refresh|reveal|switch|lang|locale)([/._-]|$)~i';
// POST ที่เป็นการอ่านข้อมูล (DataTables / กราฟ / dropdown)
const DATA = '~(datatable|data-?table|(^|[/._-])dt([/._-]|$)|list|get|fetch|load|search|chart|stat|summary|dashboard|report|json|ajax|select2|option|data|count|graph|table|detail|preview|poll|feed|history|calendar|tree)~i';
// ตัดสินจากชื่อเมธอดของ controller (เช่น datatable / ajaxGetData = อ่าน, store / update = เขียน) - ชื่อ path อย่าง comment/datatable ไม่ใช่การเขียน
const READ_ACT = '~(datatable|data|list|get|fetch|load|chart|stat|summary|report|count|search|json|preview|show|index|history|detail|estimate|option|tree|poll|feed|calendar)~i';
const MUT_ACT = '~^(store|save|create|update|edit|delete|destroy|remove|set|toggle|approve|reject|import|upload|send|resend|block|unblock|cancel|sort|reorder|move|assign|invite|enrol|enroll|grade|score|publish|unpublish|restore|reset|clear|sync|lock|unlock|copy|duplicate|clone|generate|regenerate|reveal|mark|reply|answer|comment|like|bookmark|subscribe|confirm|checkin|return|borrow|reserve|renew|extend|login|logout|verify|change|add|post|submit|process|run|execute|apply|accept|decline|close|archive|attach|detach|insert|push|notify|test)~i';

config(['session.driver' => 'array']);
Mail::fake();
Queue::fake();
Notification::fake();
$httpLog = [];
// ไม่ยิงออกนอกโปรเซสเลย: GET ไประบบอื่น (เช่น หน้าตรวจสถานะระบบ / autocomplete) จะสร้าง session + log การเข้าชมจริงในฐานข้อมูลกลาง
Http::fake(function ($request) use (&$httpLog) {
    $httpLog[$request->method() . ' ' . preg_replace('/\?.*/', '', $request->url())] = true;

    return $request->method() === 'GET' ? Http::response('', 200) : Http::response(['status' => 'success', 'data' => []], 200);
});

// ข้าม CSRF ทุกชื่อที่แต่ละระบบใช้ (session ใหม่ทุก request เลยไม่มี token ให้ส่ง)
$pass = new class {
    public function handle($request, $next, ...$args)
    {
        return $next($request);
    }
};
foreach ([
    'Illuminate\Foundation\Http\Middleware\ValidateCsrfToken',
    'Illuminate\Foundation\Http\Middleware\VerifyCsrfToken',
    'Illuminate\Foundation\Http\Middleware\PreventRequestForgery',
    'App\Http\Middleware\VerifyCsrfToken',
    'App\Http\Middleware\ValidateCsrfToken',
    'App\Http\Middleware\PreventRequestForgery',
] as $cls) {
    $app->instance($cls, $pass);
}

$lastException = null;
$app->make(Illuminate\Contracts\Debug\ExceptionHandler::class)->reportable(function (Throwable $e) use (&$lastException) {
    $lastException = get_class($e) . ': ' . mb_substr($e->getMessage(), 0, 300) . ' @ ' . basename($e->getFile()) . ':' . $e->getLine();
});

$base = rtrim(config('app.url'), '/');
$host = parse_url($base, PHP_URL_HOST);
$router = app('router');
$routes = $router->getRoutes();

$manifest = ['sys' => $sys, 'base' => $base, 'entries' => [], 'errors' => [], 'skipped' => [], 'http' => []];
$seen = [];          // key => true
$perRoute = [];      // route uri => count
$queue = [];

function skipRoute($route, string $path): bool
{
    return (bool) (preg_match(SKIP, $route->uri()) || preg_match(SKIP, (string) $route->getName()) || preg_match(SKIP, $path));
}

function matchRoute(string $method, string $path)
{
    global $routes, $base;
    try {
        return $routes->match(Request::create($base . $path, $method));
    } catch (Throwable $e) {
        return null;
    }
}

function enqueue(string $method, string $path, string $why, bool $guest = false, array $params = [], bool $seed = false, int $limit = PER_ROUTE): void
{
    global $seen, $perRoute, $queue, $manifest;
    $path = '/' . ltrim(preg_replace('~[?#].*$~', '', $path), '/');
    $path = preg_replace('~/+~', '/', $path);
    if ($path !== '/' ) {
        $path = rtrim($path, '/');
    }
    $key = ($seed ? 'seed ' : '') . $method . ' ' . $path . ($guest ? ' guest' : '');
    if (isset($seen[$key])) {
        return;
    }
    $route = matchRoute($method, $path);
    if (! $route) {
        return;
    }
    if (! $guest && ! preg_match('~^admin(/|$)~', $route->uri())) {
        return;
    }
    $seen[$key] = true;
    if (skipRoute($route, $path)) {
        $manifest['skipped'][] = $key;
        return;
    }
    // POST: เฉพาะแนวอ่านข้อมูล (seed = หน้าเรียกตอนเปิดจริง ไม่ต้องเข้า DATA แต่ต้องไม่ใช่การเปลี่ยนข้อมูล)
    $act = $route->getActionMethod();
    $label = $act === 'Closure' ? basename($route->uri()) : $act;
    $isMut = ! preg_match(READ_ACT, $label) && preg_match(MUT_ACT, $label);
    if ($method !== 'GET' && ((! $seed && ! preg_match(DATA, $route->uri() . ' ' . $route->getName() . ' ' . $act)) || $isMut)) {
        $manifest['skipped'][] = $key . ' (post not data)';
        return;
    }
    $ru = $method . ' ' . $route->uri();
    if (! $seed && str_contains($route->uri(), '{')) {
        $perRoute[$ru] = ($perRoute[$ru] ?? 0) + 1;
        if ($perRoute[$ru] > $limit) {
            return;
        }
    }
    $queue[] = [$method, $path, $guest, $why, $params];
}

/** ถอด token ปุ่มดูข้อมูลเต็ม → demo:<base64 ค่าจริง> (build.py แทนค่าจริงด้วยค่าสมมติก่อนเผยแพร่) */
function demoPii(string $s): string
{
    return preg_replace_callback('~data-pii=(\\\\?)"([^"\\\\]+)\\\\?"~', function ($m) {
        try {
            $d = json_decode(Crypt::decryptString($m[2]), true);
            $v = (string) ($d['v'] ?? '');
        } catch (Throwable $e) {
            $v = '';
        }

        return 'data-pii=' . $m[1] . '"demo:' . base64_encode($v) . $m[1] . '"';
    }, $s);
}

function doRequest(string $method, string $path, bool $guest, bool $ajax, array $params = []): array
{
    global $app, $kernel, $uid, $base, $lastException;
    $lastException = null;
    DB::beginTransaction();
    $r = ['status' => 0, 'ctype' => '', 'loc' => null, 'body' => null, 'error' => null];
    try {
        app('session')->forgetDrivers();
        $app->forgetInstance('session.store');
        $app['auth']->forgetGuards();
        if (! $guest) {
            $user = App\Models\User::find($uid);
            $app['auth']->guard()->setUser($user);
        }
        $server = [
            'HTTP_USER_AGENT' => UA,
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_ACCEPT' => $ajax ? 'application/json, text/javascript, */*; q=0.01' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'HTTP_ACCEPT_LANGUAGE' => 'th-TH,th;q=0.9',
        ];
        if ($ajax) {
            $server['HTTP_X_REQUESTED_WITH'] = 'XMLHttpRequest';
        }
        $data = $params;
        if ($method !== 'GET' && ! $data) {
            $data = ['draw' => 1, 'start' => 0, 'length' => 5000, 'search' => ['value' => '', 'regex' => 'false'], 'order' => []];
        }
        if (isset($data['draw'])) {
            $data['start'] = 0;
            $data['length'] = 5000; // เก็บทุกแถว ให้ demo.js แบ่งหน้าเอง
        }
        $url = $base . $path . ($method === 'GET' && $data ? '?' . http_build_query($data) : '');
        $req = Request::create($url, $method, $method === 'GET' ? [] : $data, ['mrta_locale' => 'th', 'locale' => 'th', 'lang' => 'th'], [], $server);
        $res = $kernel->handle($req);
        $kernel->terminate($req, $res);
        $r['status'] = $res->getStatusCode();
        $r['ctype'] = (string) $res->headers->get('Content-Type');
        $r['loc'] = $res->headers->get('Location');
        if ($res instanceof Symfony\Component\HttpFoundation\BinaryFileResponse || $res instanceof Symfony\Component\HttpFoundation\StreamedResponse) {
            $r['body'] = null;
        } else {
            $r['body'] = (string) $res->getContent();
        }
    } catch (Throwable $e) {
        $r['error'] = get_class($e) . ': ' . mb_substr($e->getMessage(), 0, 300);
    } finally {
        if ($lastException && $r['status'] >= 500) {
            $r['error'] = $lastException;
        }
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
    }

    return $r;
}

/** URL ของระบบนี้ที่อยู่ในข้อความ → [path, อยู่ใน script ไหม] */
function urlsIn(string $text): array
{
    global $host;
    $found = [];
    $text = str_replace('\\/', '/', $text); // URL ใน @json(...) ถูก escape เป็น http:\/\/host\/...
    $h = preg_quote($host, '~');
    if (preg_match_all('~(?:https?:)?//' . $h . '(/[^"\'\s<>\\\\)`]*)~i', $text, $m)) {
        foreach ($m[1] as $p) {
            $found[] = html_entity_decode($p);
        }
    }
    if (preg_match_all('~["\'`](/admin(?:/[^"\'\s<>\\\\`]*)?)["\'`]~', $text, $m)) {
        foreach ($m[1] as $p) {
            $found[] = html_entity_decode($p);
        }
    }

    return $found;
}

function scriptsOf(string $html): string
{
    preg_match_all('~<script\b[^>]*>(.*?)</script>~is', $html, $m);

    return implode("\n", $m[1]);
}

function jsonStrings($v, array &$acc): void
{
    if (is_string($v)) {
        $acc[] = $v;
    } elseif (is_array($v)) {
        foreach ($v as $x) {
            jsonStrings($x, $acc);
        }
    }
}

// ---- เริ่มคิว
foreach ($guestPaths as $p) {
    enqueue('GET', $p, 'guest', true);
}
foreach ($routes->getRoutes() as $route) {
    if (in_array('GET', $route->methods(), true) && preg_match('~^admin(/|$)~', $route->uri()) && ! str_contains($route->uri(), '{')) {
        enqueue('GET', '/' . $route->uri(), 'route');
    }
}
// AJAX ที่หน้าเรียกจริงแต่ยังไม่มีข้อมูล (check_site.py → seeds.json) พร้อมพารามิเตอร์ที่หน้าส่ง
$seedsFile = $argv[6] ?? '';
if ($seedsFile !== '' && is_file($seedsFile)) {
    foreach ((json_decode((string) file_get_contents($seedsFile), true)[$sys] ?? []) as $sd) {
        enqueue((string) $sd['m'], (string) $sd['p'], 'seed', false, (array) ($sd['q'] ?? []), true);
    }
}

/** แถวข้อมูลใน JSON ที่เก็บแล้ว (DataTables data / paginator data / list) ตาม path */
function rowsByPath(): array
{
    global $manifest, $out;
    $acc = [];
    foreach ($manifest['entries'] as $e) {
        if (($e['kind'] ?? '') !== 'json' || empty($e['f'])) {
            continue;
        }
        $d = json_decode((string) file_get_contents($out . '/' . $e['f']), true);
        $rows = is_array($d) ? ($d['data'] ?? ($d['rows'] ?? (array_is_list($d) ? $d : []))) : [];
        if (is_array($rows) && isset($rows['data']) && is_array($rows['data'])) {
            $rows = $rows['data'];
        }
        $acc[$e['p']] = is_array($rows) ? array_slice(array_values(array_filter($rows, 'is_array')), 0, 60) : [];
    }

    return $acc;
}

/** ค่าที่พารามิเตอร์แบบ "ประเภท" รับได้ (ไม่ใช่ id จึงเดาจากแถวข้อมูลไม่ได้) - หน้าโหลดตามที่ผู้ใช้กดเลือก */
const ENUMS = [
    'nameform' => ['Assignment', 'Material', 'Video', 'url'], // learnext MaterialsController@content_form
    'kind' => ['question', 'answer'],                         // portal QaQuestionController@detail
];

/** ค่า id/slug จากแถวข้อมูลของ path ที่ขึ้นต้นเหมือนกัน ไม่เจอก็ขยับขึ้นไปหมวดที่อยู่เหนือกว่า (เช่น /admin/redemption/load-modal-address → /admin/redemption) */
function sampleValues(array $rowsByPath, string $prefix, string $param): array
{
    while (substr_count($prefix, '/') >= 2) {
        $vals = [];
        foreach ($rowsByPath as $p => $rows) {
            if ($p !== $prefix && ! str_starts_with($p, $prefix . '/')) {
                continue;
            }
            foreach ($rows as $row) {
                foreach ([$param, 'id', 'slug', 'uuid', 'code', 'ip_address', 'ip'] as $k) {
                    $v = $row[$k] ?? null;
                    if (is_scalar($v) && (string) $v !== '' && strlen((string) $v) < 80 && ! str_contains((string) $v, '<')) {
                        $vals[] = (string) $v;
                        break;
                    }
                }
            }
        }
        if ($vals) {
            return array_slice(array_values(array_unique($vals)), 0, PER_ROUTE);
        }
        $prefix = substr($prefix, 0, (int) strrpos($prefix, '/'));
    }

    return [];
}

/** route GET admin ที่มีพารามิเตอร์: id ไม่เกิน 1 ตัว (เติมจากแถวข้อมูล) + พารามิเตอร์ประเภทใน ENUMS */
function sampleParams(): void
{
    global $routes;
    $rowsByPath = rowsByPath();
    foreach ($routes->getRoutes() as $route) {
        $uri = $route->uri();
        if (! in_array('GET', $route->methods(), true) || ! preg_match('~^admin/~', $uri) || ! preg_match_all('~\{(\w+)(\?)?\}~', $uri, $pm, PREG_SET_ORDER)) {
            continue;
        }
        $ids = array_values(array_filter($pm, fn ($m) => ! isset(ENUMS[$m[1]])));
        if (count($ids) > 1) {
            continue;
        }
        $combos = [$uri];
        foreach ($pm as $m) {
            if (isset(ENUMS[$m[1]])) {
                $next = [];
                foreach ($combos as $c) {
                    foreach (ENUMS[$m[1]] as $v) {
                        $next[] = str_replace($m[0], $v, $c);
                    }
                }
                $combos = $next;
            }
        }
        if ($ids) {
            [$tok, $param, $optional] = [$ids[0][0], $ids[0][1], ($ids[0][2] ?? '') === '?'];
            $vals = sampleValues($rowsByPath, '/' . rtrim(strstr($uri, '{', true), '/'), $param);
            $next = [];
            foreach ($combos as $c) {
                if ($optional) {
                    $next[] = rtrim(str_replace('/' . $tok, '', $c), '/');
                }
                foreach ($vals as $v) {
                    $next[] = str_replace($tok, rawurlencode($v), $c);
                }
            }
            $combos = $next;
        }
        $limit = PER_ROUTE * max(1, (int) array_product(array_map(fn ($m) => count(ENUMS[$m[1]] ?? [1]), $pm)));
        foreach ($combos as $c) {
            enqueue('GET', '/' . $c, 'sample', false, [], false, $limit);
        }
    }
}

$n = 0;
$sampled = 0;
while (($queue || $sampled < 3) && $n < MAX_ITEMS) {
    if (! $queue) {
        $sampled++;
        sampleParams();
        continue;
    }
    [$method, $path, $guest, $why, $params] = array_shift($queue) + [4 => []];
    $n++;
    $isData = $method !== 'GET' || in_array($why, ['script', 'xhr', 'seed'], true);
    $r = doRequest($method, $path, $guest, $isData, $params);
    $entry = ['m' => $method, 'p' => $path, 'g' => $guest, 's' => $r['status'], 'ct' => $r['ctype'], 'why' => $why];
    if ($why === 'xhr') {
        $entry['x'] = true;
    }

    if ($r['error'] || $r['status'] >= 400 || $r['status'] === 0) {
        $entry['err'] = $r['error'] ?: mb_substr(trim(preg_replace('/\s+/', ' ', strip_tags((string) $r['body']))), 0, 200);
        $manifest['errors'][] = $entry;
        fwrite(STDERR, "[{$r['status']}] $method $path {$entry['err']}\n");
        continue;
    }
    if ($r['status'] >= 300) {
        $loc = (string) $r['loc'];
        if (str_starts_with($loc, $base)) {
            $loc = substr($loc, strlen($base)) ?: '/';
        } elseif (! preg_match('~^https?://~', $loc)) {
            $loc = '/' . ltrim($loc, '/');
        }
        $entry['kind'] = 'redirect';
        $entry['loc'] = $loc;
        $manifest['entries'][] = $entry;
        if (str_starts_with($loc, '/')) {
            enqueue('GET', $loc, 'redirect', $guest);
        }
        continue;
    }
    if ($r['body'] === null) {
        $manifest['skipped'][] = "$method $path (file)";
        continue;
    }

    $body = demoPii($r['body']);
    $isJson = str_contains($entry['ct'], 'json') || (($body[0] ?? '') === '{' || ($body[0] ?? '') === '[') && json_decode($body) !== null;
    if ($why === 'xhr' && ! $isJson) {
        continue; // เรียกแบบ AJAX แล้วได้ HTML เหมือนเดิม ไม่ต้องเก็บซ้ำ
    }
    $file = 'raw/' . sha1($method . ' ' . $path . ($guest ? ' guest' : '') . ($why === 'xhr' ? ' xhr' : '')) . ($isJson ? '.json' : '.html');
    file_put_contents($out . '/' . $file, $body);
    $entry['f'] = $file;

    $links = [];
    $scriptUrls = [];
    if ($isJson) {
        $d = json_decode($body, true);
        $entry['kind'] = 'json';
        $entry['dt'] = is_array($d) && array_key_exists('data', $d) && (array_key_exists('recordsTotal', $d) || array_key_exists('draw', $d));
        $strs = [];
        jsonStrings($d, $strs);
        foreach ($strs as $s) {
            foreach (urlsIn($s) as $u) {
                $links[] = $u;
            }
        }
    } else {
        $entry['kind'] = preg_match('~<html~i', $body) ? 'page' : 'fragment';
        $scripts = scriptsOf($body);
        $scriptUrls = urlsIn($scripts);
        $links = urlsIn(preg_replace('~<script\b[^>]*>.*?</script>~is', '', $body));
    }
    $manifest['entries'][] = $entry;

    foreach ($links as $u) {
        enqueue('GET', $u, 'link', $guest);
    }
    foreach ($scriptUrls as $u) {
        $u = preg_replace('~[?#].*$~', '', $u);
        if (matchRoute('GET', $u)) {
            enqueue('GET', $u, 'script', $guest);
        }
        if (matchRoute('POST', $u)) {
            enqueue('POST', $u, 'script', $guest);
        }
    }
    // หน้ารายละเอียดที่ JS อาจ fetch เป็น JSON (เช่น modal รายละเอียดผู้ใช้) - เก็บแบบ AJAX ไว้อีกชุดถ้าได้ JSON
    if ($entry['kind'] === 'page' && $why === 'sample') {
        global $queue;
        $queue[] = ['GET', $path, $guest, 'xhr'];
    }
    if ($n % 25 === 0) {
        fwrite(STDERR, "... $n done, queue " . count($queue) . "\n");
    }
}

$manifest['http'] = array_keys($httpLog);
$manifest['left_in_queue'] = count($queue);
file_put_contents($out . '/manifest.json', json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
echo "$sys: captured " . count($manifest['entries']) . ' entries, ' . count($manifest['errors']) . ' errors, ' . count($manifest['skipped']) . " skipped\n";
