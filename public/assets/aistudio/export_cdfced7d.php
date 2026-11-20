<?php
require __DIR__ . '/../includes/bootstrap.php';

require_admin();

$pdo  = db();
$type = (string) ($_GET['type'] ?? 'users');

if ($type === 'tasks') {
    $rows = $pdo->query(
        'SELECT id, title, platform, reward, watch_seconds, cooldown_hours, daily_limit, status, created_at
         FROM tasks ORDER BY id DESC'
    )->fetchAll(PDO::FETCH_NUM);

    csv_download('tasks-' . date('Ymd') . '.csv', array_merge(
        [['ID', 'শিরোনাম', 'প্ল্যাটফর্ম', 'রিওয়ার্ড', 'দেখার সময়', 'কুলডাউন (ঘণ্টা)', 'দৈনিক লিমিট', 'অবস্থা', 'তৈরি']],
        $rows
    ));
}

$rows = $pdo->query(
    'SELECT id, name, username, email, phone, points, total_earned, streak, role, status, ref_code, last_checkin, created_at
     FROM users ORDER BY id DESC'
)->fetchAll(PDO::FETCH_NUM);

csv_download('users-' . date('Ymd') . '.csv', array_merge(
    [['ID', 'নাম', 'ইউজারনেম', 'ইমেইল', 'মোবাইল', 'পয়েন্ট', 'মোট আয়', 'স্ট্রিক', 'রোল', 'অবস্থা', 'রেফারেল কোড', 'শেষ চেক-ইন', 'যোগদান']],
    $rows
));
