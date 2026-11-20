<?php
require __DIR__ . '/../includes/bootstrap.php';

$PAGE_TITLE   = 'ড্যাশবোর্ড';
$ADMIN_ACTIVE = 'dash';
$pdo = db();

$todayStart = date('Y-m-d') . ' 00:00:00';

function scalar(PDO $pdo, string $sql, array $params = [])
{
    $st = $pdo->prepare($sql);
    $st->execute($params);
    return $st->fetchColumn();
}

$totalUsers   = (int) scalar($pdo, 'SELECT COUNT(*) FROM users');
$activeUsers  = (int) scalar($pdo, "SELECT COUNT(*) FROM users WHERE status = 'active'");
$blockedUsers = (int) scalar($pdo, "SELECT COUNT(*) FROM users WHERE status = 'blocked'");
$newToday     = (int) scalar($pdo, 'SELECT COUNT(*) FROM users WHERE created_at >= ?', [$todayStart]);

$totalTasks   = (int) scalar($pdo, "SELECT COUNT(*) FROM tasks WHERE status = 'active'");
$claimsToday  = (int) scalar($pdo, 'SELECT COUNT(*) FROM task_logs WHERE created_at >= ?', [$todayStart]);
$claimsTotal  = (int) scalar($pdo, 'SELECT COUNT(*) FROM task_logs');
$pointsToday  = (int) scalar($pdo, 'SELECT COALESCE(SUM(points),0) FROM task_logs WHERE created_at >= ?', [$todayStart]);
$pointsIssued = (int) scalar($pdo, 'SELECT COALESCE(SUM(total_earned),0) FROM users');

$recentUsers = $pdo->query('SELECT * FROM users ORDER BY id DESC LIMIT 6')->fetchAll();

$topTasks = $pdo->query(
    "SELECT t.id, t.title, COUNT(l.id) AS claims, COALESCE(SUM(l.points),0) AS paid
     FROM tasks t LEFT JOIN task_logs l ON l.task_id = t.id
     GROUP BY t.id, t.title
     ORDER BY claims DESC, t.id DESC
     LIMIT 5"
)->fetchAll();

/* শেষ ৭ দিনের ক্লেইম */
$days = [];
for ($i = 6; $i >= 0; $i--) {
    $day = date('Y-m-d', strtotime('-' . $i . ' day'));
    $st = $pdo->prepare('SELECT COUNT(*) FROM task_logs WHERE created_at >= ? AND created_at < ?');
    $st->execute([$day . ' 00:00:00', date('Y-m-d 00:00:00', strtotime($day . ' +1 day'))]);
    $days[] = ['label' => bn(date('d/m', strtotime($day))), 'count' => (int) $st->fetchColumn()];
}
$maxDay = max(1, max(array_column($days, 'count')));

include __DIR__ . '/includes/header.php';
?>

<section class="stat-cards">
  <div class="stat-card">
    <span class="stat-label">মোট ইউজার</span>
    <strong><?= e(num($totalUsers)) ?></strong>
    <span class="stat-note">সক্রিয় <?= e(num($activeUsers)) ?> · ব্লক <?= e(num($blockedUsers)) ?></span>
  </div>
  <div class="stat-card">
    <span class="stat-label">আজ নতুন</span>
    <strong><?= e(num($newToday)) ?></strong>
    <span class="stat-note">নতুন রেজিস্ট্রেশন</span>
  </div>
  <div class="stat-card">
    <span class="stat-label">আজকের ক্লেইম</span>
    <strong><?= e(num($claimsToday)) ?></strong>
    <span class="stat-note">সর্বমোট <?= e(num($claimsTotal)) ?></span>
  </div>
  <div class="stat-card">
    <span class="stat-label">আজ বিতরণ</span>
    <strong><?= e(num($pointsToday)) ?></strong>
    <span class="stat-note"><?= e(setting('points_label', 'পয়েন্ট')) ?> · সব মিলিয়ে <?= e(num($pointsIssued)) ?></span>
  </div>
</section>

<section class="panel">
  <div class="panel-head">
    <h2>শেষ ৭ দিনের ক্লেইম</h2>
    <span class="muted small">সক্রিয় টাস্ক: <?= e(num($totalTasks)) ?></span>
  </div>
  <?php if (array_sum(array_column($days, 'count')) === 0): ?>
    <p class="muted small chart-empty">গত ৭ দিনে কোনো ক্লেইম হয়নি। ইউজাররা টাস্ক শুরু করলে এখানে গ্রাফ দেখা যাবে।</p>
  <?php else: ?>
    <div class="bar-chart">
      <?php foreach ($days as $d): $h = (int) round($d['count'] / $maxDay * 100); ?>
        <div class="bar-col">
          <span class="bar-value"><?= e(bn((string) $d['count'])) ?></span>
          <div class="bar" style="height: <?= max(4, $h) ?>%"></div>
          <span class="bar-label"><?= e($d['label']) ?></span>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</section>

<div class="panel-grid">
  <section class="panel">
    <div class="panel-head">
      <h2>নতুন ইউজার</h2>
      <a class="link" href="<?= e(url('admin/users.php')) ?>">সব →</a>
    </div>
    <div class="table-wrap">
      <table class="admin-table">
        <thead>
          <tr><th>নাম</th><th>ইউজারনেম</th><th>পয়েন্ট</th><th>অবস্থা</th><th>অ্যাকশন</th></tr>
        </thead>
        <tbody>
          <?php foreach ($recentUsers as $u): ?>
            <tr>
              <td><?= e($u['name']) ?></td>
              <td class="muted">@<?= e($u['username']) ?></td>
              <td><?= e(num($u['points'])) ?></td>
              <td><span class="badge <?= $u['status'] === 'active' ? 'badge-ok' : 'badge-bad' ?>"><?= $u['status'] === 'active' ? 'সক্রিয়' : 'ব্লক' ?></span></td>
              <td><a class="link" href="<?= e(url('admin/user.php?id=' . (int) $u['id'])) ?>">দেখুন</a></td>
            </tr>
          <?php endforeach; ?>
          <?php if (!$recentUsers): ?>
            <tr><td colspan="5" class="muted">এখনো কোনো ইউজার নেই।</td></tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>জনপ্রিয় টাস্ক</h2>
      <a class="link" href="<?= e(url('admin/tasks.php')) ?>">ম্যানেজ →</a>
    </div>
    <ul class="rank-list">
      <?php foreach ($topTasks as $t): ?>
        <li>
          <span class="rank-title" title="<?= e($t['title']) ?>"><?= e(str_limit((string) $t['title'], 38)) ?></span>
          <span class="muted small"><?= e(num($t['claims'])) ?> ক্লেইম · <?= e(num($t['paid'])) ?> পয়েন্ট</span>
        </li>
      <?php endforeach; ?>
      <?php if (!$topTasks): ?>
        <li class="muted">কোনো টাস্ক নেই।</li>
      <?php endif; ?>
    </ul>
  </section>
</div>

<section class="panel">
  <div class="panel-head"><h2>দ্রুত কাজ</h2></div>
  <div class="quick-actions">
    <a class="btn btn-primary btn-sm" href="<?= e(url('admin/task-edit.php')) ?>">+ নতুন টাস্ক</a>
    <a class="btn btn-ghost btn-sm" href="<?= e(url('admin/users.php')) ?>">ইউজার ম্যানেজ</a>
    <a class="btn btn-ghost btn-sm" href="<?= e(url('admin/export.php?type=users')) ?>">ইউজার CSV</a>
    <a class="btn btn-ghost btn-sm" href="<?= e(url('admin/settings.php')) ?>">সাইট সেটিংস</a>
  </div>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
