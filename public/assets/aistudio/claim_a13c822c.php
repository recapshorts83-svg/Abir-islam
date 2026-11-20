<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/actions.php';

header('Content-Type: application/json; charset=utf-8');

$me = current_user();
if ($me === null) {
    json_out(['ok' => false, 'message' => 'সেশন শেষ হয়েছে, আবার লগইন করুন।', 'redirect' => url('login.php')], 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['ok' => false, 'message' => 'ভুল রিকোয়েস্ট।'], 405);
}

$csrf = $_POST['_csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!hash_equals((string) ($_SESSION['csrf_token'] ?? ''), (string) $csrf)) {
    json_out(['ok' => false, 'message' => 'সেশন মেয়াদোত্তীর্ণ, পেজ রিফ্রেশ করুন।'], 419);
}

$taskId = (int) ($_POST['task_id'] ?? 0);

// একই সময়ে দুবার ক্লেইম আটকানো (ডাবল-ক্লিক)
$lockKey = 'claim_lock_' . $taskId;
if (!empty($_SESSION[$lockKey]) && (time() - (int) $_SESSION[$lockKey]) < 3) {
    json_out(['ok' => false, 'message' => 'একটু অপেক্ষা করুন…'], 429);
}
$_SESSION[$lockKey] = time();

[$ok, $message, $extra] = claim_task((int) $me['id'], $taskId);

$refresh = current_user(true);

json_out([
    'ok'      => $ok,
    'message' => $message,
    'points'  => $ok ? (int) ($refresh['points'] ?? 0) : null,
    'extra'   => $extra,
], $ok ? 200 : 400);
