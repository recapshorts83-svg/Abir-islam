<?php
/**
 * Viral Video Pro — অ্যাকশন (চেক-ইন ও টাস্ক ক্লেইম)
 * রিটার্ন করে: [bool $ok, string $message, array $extra]
 */

function do_checkin(int $userId): array
{
    $pdo = db();

    $st = $pdo->prepare('SELECT last_checkin, streak FROM users WHERE id = ?');
    $st->execute([$userId]);
    $u = $st->fetch();
    if (!$u) {
        return [false, 'ইউজার পাওয়া যায়নি।', []];
    }

    $today     = date('Y-m-d');
    $yesterday = date('Y-m-d', strtotime('-1 day'));

    if (($u['last_checkin'] ?? '') === $today) {
        return [false, 'আপনি আজ ইতিমধ্যে চেক-ইন করেছেন। কাল আবার আসুন।', []];
    }

    $streak = ((string) $u['last_checkin'] === $yesterday) ? ((int) $u['streak'] + 1) : 1;

    $base     = max(0, (int) setting('checkin_points', 10));
    $bonus    = max(0, (int) setting('checkin_streak_bonus', 5));
    $bonusDay = min($streak - 1, 6);          // সর্বোচ্চ ৭ দিনের বোনাস
    $points   = $base + $bonusDay * $bonus;

    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE users SET last_checkin = ?, streak = ?, updated_at = ? WHERE id = ?')
            ->execute([$today, $streak, now(), $userId]);

        $pdo->prepare('INSERT INTO checkins (user_id, checkin_date, points, streak, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$userId, $today, $points, $streak, now()]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        return [false, 'চেক-ইন সেভ করা যায়নি।', []];
    }

    add_transaction($userId, 'checkin', $points, 'ডেইলি চেক-ইন (স্ট্রিক ' . $streak . ')');

    return [true, 'চেক-ইন সফল! ' . pts($points) . ' যোগ হয়েছে (স্ট্রিক ' . bn((string) $streak) . ' দিন)।', [
        'points' => $points,
        'streak' => $streak,
    ]];
}

function claim_task(int $userId, int $taskId): array
{
    if ($taskId <= 0) {
        return [false, 'টাস্ক পাওয়া যায়নি।', []];
    }

    $pdo = db();
    $st = $pdo->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
    $st->execute([$taskId]);
    $task = $st->fetch();

    if (!$task) {
        return [false, 'টাস্ক পাওয়া যায়নি।', []];
    }
    if ($task['status'] !== 'active') {
        return [false, 'এই টাস্কটি এখন বন্ধ আছে।', []];
    }

    /* ---- অ্যান্টি-চিট: ভিডিও পেজ খোলার পর সময় পেরিয়েছে কিনা ---- */
    $start = (int) ($_SESSION['watch'][$taskId] ?? 0);
    if ($start <= 0) {
        return [false, 'আগে টাস্কটি খুলে দেখুন, তারপর ক্লেইম করুন।', ['reason' => 'no_watch']];
    }
    $elapsed = time() - $start;
    if ($elapsed < max(3, (int) $task['watch_seconds'] - 2)) {
        $left = max(1, (int) $task['watch_seconds'] - $elapsed);
        return [false, 'আরও ' . bn((string) $left) . ' সেকেন্ড ভিডিওটি দেখুন।', ['reason' => 'too_early']];
    }
    if ($elapsed > 7200) { // ২ ঘণ্টার বেশি পুরোনো সেশন অকার্যকর
        unset($_SESSION['watch'][$taskId]);
        return [false, 'সেশন পুরোনো হয়ে গেছে, টাস্কটি আবার খুলুন।', ['reason' => 'expired']];
    }

    /* ---- কুলডাউন ও ডেইলি লিমিট ---- */
    $state = task_state($task, $userId);
    if (!$state['ok']) {
        $msg = $state['reason'] === 'daily_limit'
            ? 'এই টাস্কের আজকের লিমিট শেষ।'
            : 'কুলডাউন শেষ হয়নি। পরের বার ' . date('d M, h:i A', $state['next_at']) . ' ঘুরে আসুন।';
        return [false, $msg, ['reason' => $state['reason'], 'next_at' => $state['next_at']]];
    }

    /* ---- দিনে সর্বোচ্চ কতগুলো টাস্ক ---- */
    $maxDaily = (int) setting('daily_task_limit', 20);
    if ($maxDaily > 0) {
        $st = $pdo->prepare('SELECT COUNT(*) FROM task_logs WHERE user_id = ? AND created_at >= ?');
        $st->execute([$userId, date('Y-m-d') . ' 00:00:00']);
        if ((int) $st->fetchColumn() >= $maxDaily) {
            return [false, 'আজকের সব টাস্কের লিমিট শেষ হয়েছে (' . bn((string) $maxDaily) . 'টি)। কাল আবার আসুন।', ['reason' => 'global_limit']];
        }
    }

    $reward = max(0, (int) $task['reward']);
    $ip     = $_SERVER['REMOTE_ADDR'] ?? null;

    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO task_logs (user_id, task_id, points, ip, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$userId, $taskId, $reward, $ip, now()]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        return [false, 'কিছু একটা ভুল হয়েছে, আবার চেষ্টা করুন।', []];
    }

    add_transaction($userId, 'task', $reward, 'টাস্ক: ' . $task['title']);
    unset($_SESSION['watch'][$taskId]);

    return [true, 'অভিনন্দন! ' . pts($reward) . ' যোগ হয়েছে।', ['points' => $reward]];
}
