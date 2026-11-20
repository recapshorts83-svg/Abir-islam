<?php
require __DIR__ . '/includes/bootstrap.php';

$me = require_login();
$uid = (int) $me['id'];
$pdo = db();

$PAGE_TITLE = 'টাস্ক';
$ACTIVE     = 'tasks';

$filter = (string) ($_GET['f'] ?? 'all');

$tasks = $pdo->query("SELECT * FROM tasks WHERE status = 'active' ORDER BY sort_order ASC, id DESC")->fetchAll();

$rows = [];
$availableCount = 0;
foreach ($tasks as $task) {
    $state = task_state($task, $uid);
    if ($state['ok']) {
        $availableCount++;
    }
    $rows[] = ['task' => $task, 'state' => $state];
}

if ($filter === 'open') {
    $rows = array_values(array_filter($rows, fn($r) => $r['state']['ok']));
} elseif ($filter === 'waiting') {
    $rows = array_values(array_filter($rows, fn($r) => !$r['state']['ok']));
}

$todayStart = date('Y-m-d') . ' 00:00:00';
$st = $pdo->prepare('SELECT COUNT(*) FROM task_logs WHERE user_id = ? AND created_at >= ?');
$st->execute([$uid, $todayStart]);
$todayTasks = (int) $st->fetchColumn();

$maxDaily = (int) setting('daily_task_limit', 20);

include __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>টাস্ক লিস্ট</h1>
    <p class="muted small">
      আজ সম্পন্ন: <?= e(bn((string) $todayTasks)) ?><?= $maxDaily > 0 ? ' / ' . e(bn((string) $maxDaily)) : '' ?>
    </p>
  </div>
  <span class="pill"><?= e(bn((string) $availableCount)) ?>টি খোলা</span>
</section>

<div class="chip-row">
  <a class="chip <?= $filter === 'all' ? 'is-active' : '' ?>" href="<?= e(url('tasks.php')) ?>">সব</a>
  <a class="chip <?= $filter === 'open' ? 'is-active' : '' ?>" href="<?= e(url('tasks.php?f=open')) ?>">এখনই করা যাবে</a>
  <a class="chip <?= $filter === 'waiting' ? 'is-active' : '' ?>" href="<?= e(url('tasks.php?f=waiting')) ?>">অপেক্ষামান</a>
</div>

<?php if (!$rows): ?>
  <div class="card empty-card">
    <p>এই তালিকায় এখন কোনো টাস্ক নেই।</p>
    <a class="btn btn-ghost btn-sm" href="<?= e(url('tasks.php')) ?>">সব টাস্ক দেখুন</a>
  </div>
<?php else: ?>
  <div class="task-list">
    <?php foreach ($rows as $r):
        $task  = $r['task'];
        $state = $r['state'];
        $meta  = platform_meta((string) $task['platform']);
        $thumb = task_thumb($task);
        ?>
      <a class="task-card" href="<?= e(url('task.php?id=' . (int) $task['id'])) ?>">
        <div class="task-thumb" style="--accent: <?= e($meta['color']) ?>">
          <?php if ($thumb): ?>
            <img src="<?= e($thumb) ?>" alt="" loading="lazy">
          <?php else: ?>
            <span class="task-thumb-fallback">▶</span>
          <?php endif; ?>
        </div>
        <div class="task-body">
          <div class="task-meta">
            <span class="platform" style="--accent: <?= e($meta['color']) ?>"><?= e($meta['label']) ?></span>
            <span class="task-reward">+<?= e(pts($task['reward'])) ?></span>
          </div>
          <h3 class="task-title"><?= e(str_limit((string) $task['title'], 56)) ?></h3>
          <p class="task-sub">
            <?php if ($state['ok']): ?>
              <?= e(bn((string) $task['watch_seconds'])) ?> সেকেন্ড দেখুন · আজ <?= e(bn((string) $state['today_count'])) ?> বার হয়েছে
            <?php else: ?>
              <span class="wait-text" data-countdown="<?= (int) $state['next_at'] ?>">অপেক্ষা করুন…</span>
            <?php endif; ?>
          </p>
        </div>
        <span class="task-cta <?= $state['ok'] ? '' : 'is-wait' ?>">
          <?= $state['ok'] ? 'দেখুন' : 'বন্ধ' ?>
        </span>
      </a>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<?php include __DIR__ . '/includes/footer.php'; ?>
