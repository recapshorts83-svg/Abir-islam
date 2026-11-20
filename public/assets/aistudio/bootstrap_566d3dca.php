<?php
/**
 * Viral Video Pro — বুটস্ট্র্যাপ
 * সব পেজের শুরুতে এই ফাইলটি include হয়।
 */
declare(strict_types=1);

define('APP_ROOT', dirname(__DIR__));
define('APP_VERSION', '1.0.0');

$CONFIG = require APP_ROOT . '/config.php';

date_default_timezone_set($CONFIG['app']['timezone'] ?? 'Asia/Dhaka');

error_reporting(E_ALL);
ini_set('display_errors', !empty($CONFIG['app']['debug']) ? '1' : '0');

/* ---------------------------------------------------------------
 |  সেশন
 * --------------------------------------------------------------- */
if (session_status() !== PHP_SESSION_ACTIVE) {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => $isHttps,
    ]);
    session_name('VVP_SESSION');
    session_start();
}

/* ---------------------------------------------------------------
 |  বেস URL (সাব-ফোল্ডারেও কাজ করবে)
 * --------------------------------------------------------------- */
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
$scriptDir = rtrim($scriptDir, '/');
if (substr($scriptDir, -6) === '/admin') {
    $scriptDir = substr($scriptDir, 0, -6);
}
define('BASE_URL', $scriptDir === '/' ? '' : $scriptDir);

/** অ্যাপের ভেতরের লিংক তৈরি */
function url(string $path = ''): string
{
    return BASE_URL . '/' . ltrim($path, '/');
}

function redirect(string $path): void
{
    header('Location: ' . $path);
    exit;
}

/* ---------------------------------------------------------------
 |  ডেটাবেস
 * --------------------------------------------------------------- */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    global $CONFIG;
    $c = $CONFIG['db'];

    try {
        if (($c['driver'] ?? 'mysql') === 'sqlite') {
            $dir = dirname($c['sqlite_path']);
            if (!is_dir($dir)) {
                mkdir($dir, 0775, true);
            }
            $pdo = new PDO('sqlite:' . $c['sqlite_path']);
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = WAL');
        } else {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $c['host'],
                (int) ($c['port'] ?? 3306),
                $c['name']
            );
            $pdo = new PDO($dsn, $c['user'], $c['pass']);
        }

        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    } catch (PDOException $e) {
        http_response_code(500);
        $msg = htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
        echo '<div style="font-family:system-ui;max-width:620px;margin:80px auto;padding:24px;'
            . 'border:1px solid #fca5a5;border-radius:14px;background:#fff5f5;color:#7f1d1d">'
            . '<h3 style="margin:0 0 10px">ডেটাবেসে কানেক্ট করা যাচ্ছে না</h3>'
            . '<p style="margin:0 0 12px"><strong>config.php</strong> ফাইলে ডেটাবেসের নাম, ইউজার ও পাসওয়ার্ড ঠিক আছে কিনা দেখুন।</p>'
            . '<pre style="white-space:pre-wrap;font-size:13px">' . $msg . '</pre></div>';
        exit;
    }

    return $pdo;
}

/** টেবিলগুলো তৈরি হয়েছে কিনা */
function app_is_installed(): bool
{
    try {
        db()->query('SELECT COUNT(*) FROM settings')->fetchColumn();
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

function now(): string
{
    return date('Y-m-d H:i:s');
}

/* ---------------------------------------------------------------
 |  সেটিংস
 * --------------------------------------------------------------- */
function settings(bool $refresh = false): array
{
    static $cache = null;
    if ($cache === null || $refresh) {
        $cache = [];
        try {
            foreach (db()->query('SELECT setting_key, setting_value FROM settings') as $row) {
                $cache[$row['setting_key']] = $row['setting_value'];
            }
        } catch (Throwable $e) {
            $cache = [];
        }
    }
    return $cache;
}

function setting(string $key, $default = null)
{
    $all = settings();
    if (!array_key_exists($key, $all)) {
        return $default;
    }
    return $all[$key] === '' ? $default : $all[$key];
}

function set_setting(string $key, string $value): void
{
    $pdo = db();
    $upd = $pdo->prepare('UPDATE settings SET setting_value = ? WHERE setting_key = ?');
    $upd->execute([$value, $key]);

    if ($upd->rowCount() === 0) {
        $chk = $pdo->prepare('SELECT COUNT(*) FROM settings WHERE setting_key = ?');
        $chk->execute([$key]);
        if ((int) $chk->fetchColumn() === 0) {
            $pdo->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)')
                ->execute([$key, $value]);
        }
    }
    settings(true);
}

/* ---------------------------------------------------------------
 |  হেল্পার
 * --------------------------------------------------------------- */
function e($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

/** ইংরেজি অংককে বাংলা অংকে বদলায় (সেটিংসে বন্ধ করা যায়) */
function bn(string $text): string
{
    if ((string) setting('bn_digits', '1') !== '1') {
        return $text;
    }
    return str_replace(
        ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
        ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'],
        $text
    );
}

function num($number): string
{
    return bn(number_format((float) $number));
}

/** পয়েন্ট + লেবেল: ২৫০ পয়েন্ট */
function pts($number): string
{
    return num($number) . ' ' . setting('points_label', 'পয়েন্ট');
}

function str_limit(string $text, int $limit = 90): string
{
    if (function_exists('mb_substr')) {
        return mb_strlen($text) > $limit ? mb_substr($text, 0, $limit - 1) . '…' : $text;
    }
    return strlen($text) > $limit ? substr($text, 0, $limit - 3) . '...' : $text;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function csrf_verify(): void
{
    $sent = $_POST['_csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals((string) ($_SESSION['csrf_token'] ?? ''), (string) $sent)) {
        http_response_code(419);
        echo '<div style="font-family:system-ui;padding:40px;text-align:center">'
            . '<h3>সেশন মেয়াদোত্তীর্ণ হয়েছে</h3>'
            . '<p>পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।</p></div>';
        exit;
    }
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'][] = ['type' => $type, 'message' => $message];
}

function take_flashes(): array
{
    $all = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $all;
}

function json_out(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

/* ---------------------------------------------------------------
 |  ইউজার / অথ
 * --------------------------------------------------------------- */
function current_user(bool $refresh = false): ?array
{
    static $user = null;
    static $loaded = false;

    if ($loaded && !$refresh) {
        return $user;
    }

    $loaded = true;
    $user = null;

    $id = (int) ($_SESSION['uid'] ?? 0);
    if ($id > 0) {
        $st = db()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $st->execute([$id]);
        $row = $st->fetch();
        if ($row && $row['status'] === 'active') {
            $user = $row;
        } else {
            unset($_SESSION['uid']);
        }
    }

    return $user;
}

function is_admin(): bool
{
    $u = current_user();
    return $u !== null && $u['role'] === 'admin';
}

function require_login(): array
{
    $u = current_user();
    if ($u === null) {
        flash('error', 'আগে লগইন করুন।');
        redirect(url('login.php'));
    }
    return $u;
}

function require_admin(): array
{
    $u = require_login();
    if ($u['role'] !== 'admin') {
        http_response_code(403);
        echo '<div style="font-family:system-ui;padding:60px;text-align:center">'
            . '<h2>৪০৩ — প্রবেশ নিষেধ</h2><p>এই পেজটি শুধু অ্যাডমিনের জন্য।</p>'
            . '<a href="' . e(url('index.php')) . '">হোমে ফিরে যান</a></div>';
        exit;
    }
    return $u;
}

/* ---------------------------------------------------------------
 |  পয়েন্ট / ট্রানজেকশন
 * --------------------------------------------------------------- */
function add_transaction(int $userId, string $type, int $amount, string $note = ''): void
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO transactions (user_id, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$userId, $type, $amount, $note, now()]);

        $pdo->prepare(
            'UPDATE users SET points = points + ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?'
        )->execute([$amount, max(0, $amount), now(), $userId]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    current_user(true);
}

/* ---------------------------------------------------------------
 |  টাস্ক
 * --------------------------------------------------------------- */
/**
 * টাস্কটি এখন ক্লেইম করা যাবে কিনা তার হিসাব।
 * @return array{ok:bool, reason:string, next_at:int, today_count:int}
 */
function task_state(array $task, int $userId): array
{
    $pdo = db();

    $st = $pdo->prepare('SELECT created_at FROM task_logs WHERE user_id = ? AND task_id = ? ORDER BY id DESC LIMIT 1');
    $st->execute([$userId, $task['id']]);
    $last = $st->fetchColumn();

    $st = $pdo->prepare('SELECT COUNT(*) FROM task_logs WHERE user_id = ? AND task_id = ? AND created_at >= ?');
    $st->execute([$userId, $task['id'], date('Y-m-d') . ' 00:00:00']);
    $todayCount = (int) $st->fetchColumn();

    $cooldown = max(0, (int) $task['cooldown_hours']);
    if ($last && $cooldown > 0) {
        $next = strtotime((string) $last) + $cooldown * 3600;
        if (time() < $next) {
            return ['ok' => false, 'reason' => 'cooldown', 'next_at' => $next, 'today_count' => $todayCount];
        }
    }

    $dailyLimit = (int) $task['daily_limit'];
    if ($dailyLimit > 0 && $todayCount >= $dailyLimit) {
        return [
            'ok'         => false,
            'reason'     => 'daily_limit',
            'next_at'    => strtotime('tomorrow midnight'),
            'today_count' => $todayCount,
        ];
    }

    return ['ok' => true, 'reason' => '', 'next_at' => 0, 'today_count' => $todayCount];
}

/** ভিডিও লিংক থেকে এমবেড/থাম্বনেইল বের করা */
function youtube_id(string $url): ?string
{
    if (preg_match('~(?:youtube\.com/(?:watch\?v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})~', $url, $m)) {
        return $m[1];
    }
    return null;
}

function task_embed(string $url): ?string
{
    if ($id = youtube_id($url)) {
        return 'https://www.youtube.com/embed/' . $id . '?rel=0';
    }
    if (preg_match('~vimeo\.com/(\d+)~', $url, $m)) {
        return 'https://player.vimeo.com/video/' . $m[1];
    }
    if (preg_match('~facebook\.com/.+/videos/~', $url)) {
        return 'https://www.facebook.com/plugins/video.php?href=' . rawurlencode($url);
    }
    return null;
}

function task_thumb(array $task): string
{
    if (!empty($task['thumb'])) {
        return $task['thumb'];
    }
    if ($id = youtube_id((string) $task['video_url'])) {
        return 'https://i.ytimg.com/vi/' . $id . '/mqdefault.jpg';
    }
    return '';
}

/** টেলিগ্রাম/সোশ্যাল প্ল্যাটফর্মের ছোট আইকন-লেবেল */
function platform_meta(string $platform): array
{
    $map = [
        'youtube'   => ['label' => 'YouTube',   'color' => '#ff4d4d'],
        'facebook'  => ['label' => 'Facebook',  'color' => '#3b82f6'],
        'tiktok'    => ['label' => 'TikTok',    'color' => '#22d3ee'],
        'instagram' => ['label' => 'Instagram', 'color' => '#e879f9'],
        'telegram'  => ['label' => 'Telegram',  'color' => '#38bdf8'],
        'website'   => ['label' => 'ওয়েবসাইট',  'color' => '#a3e635'],
        'other'     => ['label' => 'অন্যান্য',   'color' => '#fbbf24'],
    ];
    return $map[$platform] ?? $map['other'];
}

/** সাইটের নাম */
function site_name(): string
{
    global $CONFIG;
    return (string) setting('site_name', $CONFIG['app']['name'] ?? 'Viral Video Pro');
}

/** CSV/স্প্রেডশিটে এক্সপোর্টের সময় হেডার */
function csv_download(string $filename, array $rows): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // বাংলা লেখা Excel-এ ঠিক দেখানোর জন্য
    foreach ($rows as $row) {
        if (PHP_VERSION_ID >= 80400) {
            fputcsv($out, $row, ',', '"', '');
        } else {
            fputcsv($out, $row);
        }
    }
    fclose($out);
    exit;
}

/* ---------------------------------------------------------------
 |  ইনস্টল চেক — টেবিল না থাকলে ইনস্টলারের দিকে পাঠানো হয়
 * --------------------------------------------------------------- */
$currentScript = (string) ($_SERVER['SCRIPT_NAME'] ?? '');

if (basename($currentScript) !== 'install.php' && !app_is_installed()) {
    redirect(url('install.php'));
}

/* ---------------------------------------------------------------
 |  মেইনটেন্যান্স মোড (অ্যাডমিন বাদে সবাই বন্ধ পেজ দেখবে)
 * --------------------------------------------------------------- */
if (setting('maintenance', '0') === '1') {
    $scriptName = basename($currentScript);
    $inAdminDir = strpos(str_replace('\\', '/', $currentScript), '/admin/') !== false;
    $viewer     = current_user();
    $viewerIsAdmin = $viewer !== null && $viewer['role'] === 'admin';

    if (!$viewerIsAdmin && !$inAdminDir && !in_array($scriptName, ['login.php', 'install.php', 'logout.php'], true)) {
        http_response_code(503);
        header('Retry-After: 3600');
        echo '<!doctype html><html lang="bn"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<title>রক্ষণাবেক্ষণ চলছে</title><style>'
            . 'body{margin:0;min-height:100vh;display:grid;place-items:center;'
            . 'font-family:"Hind Siliguri",system-ui,sans-serif;background:#0b1020;color:#eaf0ff;text-align:center;padding:24px}'
            . 'h1{font-size:22px;margin:0 0 10px}p{color:#8d99bb;max-width:420px;margin:0 auto}'
            . '</style></head><body><div><h1>🛠 সাইটে রক্ষণাবেক্ষণ চলছে</h1>'
            . '<p>আমরা কিছু উন্নয়নের কাজ করছি। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।</p></div></body></html>';
        exit;
    }
}
