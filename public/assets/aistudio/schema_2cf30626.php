<?php
/**
 * Viral Video Pro — ডেটাবেস টেবিল তৈরি
 * MySQL ও SQLite দুটোতেই কাজ করে।
 */

function install_schema(PDO $pdo, string $driver): void
{
    $isSqlite = $driver === 'sqlite';

    $pk     = $isSqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
    $engine = $isSqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $ifNot  = ' IF NOT EXISTS ';

    $pdo->exec("CREATE TABLE{$ifNot}users (
        id            {$pk},
        name          VARCHAR(100) NOT NULL,
        username      VARCHAR(50)  NOT NULL UNIQUE,
        email         VARCHAR(150) NULL,
        phone         VARCHAR(30)  NULL,
        password      VARCHAR(255) NOT NULL,
        points        INT NOT NULL DEFAULT 0,
        total_earned  INT NOT NULL DEFAULT 0,
        role          VARCHAR(10) NOT NULL DEFAULT 'user',
        status        VARCHAR(10) NOT NULL DEFAULT 'active',
        ref_code      VARCHAR(20) NULL,
        referred_by   INT NULL,
        streak        INT NOT NULL DEFAULT 0,
        last_checkin  VARCHAR(10) NULL,
        note          VARCHAR(255) NULL,
        created_at    DATETIME NULL,
        updated_at    DATETIME NULL
    ){$engine}");

    $pdo->exec("CREATE TABLE{$ifNot}tasks (
        id             {$pk},
        title          VARCHAR(150) NOT NULL,
        description    TEXT NULL,
        platform       VARCHAR(30) NOT NULL DEFAULT 'youtube',
        video_url      TEXT NULL,
        thumb          TEXT NULL,
        reward         INT NOT NULL DEFAULT 10,
        watch_seconds  INT NOT NULL DEFAULT 20,
        cooldown_hours INT NOT NULL DEFAULT 24,
        daily_limit    INT NOT NULL DEFAULT 1,
        status         VARCHAR(10) NOT NULL DEFAULT 'active',
        sort_order     INT NOT NULL DEFAULT 0,
        created_at     DATETIME NULL
    ){$engine}");

    $pdo->exec("CREATE TABLE{$ifNot}task_logs (
        id         {$pk},
        user_id    INT NOT NULL,
        task_id    INT NOT NULL,
        points     INT NOT NULL DEFAULT 0,
        ip         VARCHAR(45) NULL,
        created_at DATETIME NULL
    ){$engine}");

    $pdo->exec("CREATE TABLE{$ifNot}checkins (
        id           {$pk},
        user_id      INT NOT NULL,
        checkin_date VARCHAR(10) NOT NULL,
        points       INT NOT NULL DEFAULT 0,
        streak       INT NOT NULL DEFAULT 1,
        created_at   DATETIME NULL
    ){$engine}");

    $pdo->exec("CREATE TABLE{$ifNot}transactions (
        id         {$pk},
        user_id    INT NOT NULL,
        type       VARCHAR(20) NOT NULL,
        amount     INT NOT NULL,
        note       VARCHAR(255) NULL,
        created_at DATETIME NULL
    ){$engine}");

    $pdo->exec("CREATE TABLE{$ifNot}settings (
        setting_key   VARCHAR(64) NOT NULL PRIMARY KEY,
        setting_value TEXT NULL
    ){$engine}");

    // দ্রুত সার্চের জন্য ইনডেক্স (SQLite-এও চলে)
    $indexes = [
        'idx_task_logs_user'  => 'CREATE INDEX IF NOT EXISTS idx_task_logs_user ON task_logs (user_id, task_id)',
        'idx_tx_user'         => 'CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions (user_id)',
        'idx_users_status'    => 'CREATE INDEX IF NOT EXISTS idx_users_status ON users (status)',
    ];
    foreach ($indexes as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {
            // ইনডেক্স আগেই থাকলে উপেক্ষা
        }
    }
}

/** ডিফল্ট সেটিংস */
function install_default_settings(PDO $pdo): void
{
    $defaults = [
        'site_name'            => 'Viral Video Pro',
        'site_tagline'         => 'ভিডিও দেখুন, পয়েন্ট জমান',
        'points_label'         => 'পয়েন্ট',
        'bn_digits'            => '1',
        'checkin_points'       => '10',
        'checkin_streak_bonus' => '5',
        'daily_task_limit'     => '20',
        'referral_enabled'     => '0',
        'referral_commission'  => '10',
        'currency_enabled'     => '0',
        'currency_rate'        => '100',
        'currency_label'       => '৳',
        'min_withdraw'         => '5000',
        'support_link'         => 'https://t.me/',
        'notice'               => '',
        'maintenance'          => '0',
        'footer_text'          => 'সব দাম পয়েন্টে — কোনো টাকা জড়িত নয়।',
    ];

    $check = $pdo->prepare('SELECT COUNT(*) FROM settings WHERE setting_key = ?');
    $insert = $pdo->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)');

    foreach ($defaults as $k => $v) {
        $check->execute([$k]);
        if ((int) $check->fetchColumn() === 0) {
            $insert->execute([$k, $v]);
        }
    }
}

/** ডেমো টাস্ক (ইনস্টলের সময় চাইলে যোগ হয়) */
function install_demo_tasks(PDO $pdo): void
{
    $st = $pdo->query('SELECT COUNT(*) FROM tasks');
    if ((int) $st->fetchColumn() > 0) {
        return;
    }

    $tasks = [
        ['সেরা ভাইরাল ভিডিও ২০২৬ — সম্পূর্ণ দেখুন', 'পুরো ভিডিওটি দেখুন, তারপর ক্লেইম করুন।', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 25, 20, 24, 1],
        ['স্মার্টফোন টিপস — ১ মিনিটের ভিডিও', 'ভিডিওটি শেষ পর্যন্ত দেখতে হবে।', 'youtube', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 30, 30, 24, 1],
        ['ফেসবুক রিলস — নতুন ট্রেন্ড', 'রিলসটি দেখে ক্লেইম করুন।', 'facebook', 'https://www.facebook.com/watch/', 20, 15, 12, 2],
        ['টিকটক ভাইরাল ক্লিপ', 'ক্লিপটি পুরোটা দেখুন।', 'tiktok', 'https://www.tiktok.com/', 15, 15, 24, 1],
        ['আমাদের টেলিগ্রাম চ্যানেলে জয়েন করুন', 'চ্যানেলে জয়েন করে ফিরে এসে ক্লেইম করুন।', 'telegram', 'https://t.me/', 50, 10, 48, 1],
    ];

    $insert = $pdo->prepare(
        'INSERT INTO tasks (title, description, platform, video_url, reward, watch_seconds, cooldown_hours, daily_limit, status, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    foreach ($tasks as $i => $t) {
        $insert->execute([$t[0], $t[1], $t[2], $t[3], $t[4], $t[5], $t[6], $t[7], 'active', $i + 1, date('Y-m-d H:i:s')]);
    }
}
