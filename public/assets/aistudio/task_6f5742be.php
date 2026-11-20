<?php
require __DIR__ . '/includes/bootstrap.php';

$me  = require_login();
$uid = (int) $me['id'];
$pdo = db();

$taskId = (int) ($_GET['id'] ?? 0);
$st = $pdo->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
$st->execute([$taskId]);
$task = $st->fetch();

if (!$task) {
    flash('error', 'টাস্কটি খুঁজে পাওয়া যায়নি।');
    redirect(url('tasks.php'));
}

$state  = task_state($task, $uid);
$meta   = platform_meta((string) $task['platform']);
$embed  = task_embed((string) ($task['video_url'] ?? ''));
$thumb  = task_thumb($task);
$waitSeconds = max(5, (int) $task['watch_seconds']);

// এই পেজ খোলার সময় রেকর্ড (ক্লেইম যাচাইয়ের জন্য)
if ($state['ok']) {
    $_SESSION['watch'][$taskId] = time();
}

$PAGE_TITLE = (string) $task['title'];
$ACTIVE     = 'tasks';

$nextTask = $pdo->query("SELECT id, title FROM tasks WHERE status = 'active' AND id <> " . (int) $taskId . " ORDER BY sort_order ASC, id DESC LIMIT 1")->fetch();

include __DIR__ . '/includes/header.php';
?>

<a class="back-link" href="<?= e(url('tasks.php')) ?>">← সব টাস্ক</a>

<section class="watch-card">
  <div class="watch-head">
    <span class="platform" style="--accent: <?= e($meta['color']) ?>"><?= e($meta['label']) ?></span>
    <span class="task-reward">+<?= e(pts($task['reward'])) ?></span>
  </div>

  <h1 class="watch-title"><?= e($task['title']) ?></h1>
  <?php if (!empty($task['description'])): ?>
    <p class="muted small"><?= e($task['description']) ?></p>
  <?php endif; ?>

  <div class="video-frame">
    <?php if ($embed !== null): ?>
      <iframe src="<?= e($embed) ?>" title="<?= e($task['title']) ?>" loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    <?php elseif ($thumb !== ''): ?>
      <div class="video-poster">
        <img src="<?= e($thumb) ?>" alt="">
        <?php if (!empty($task['video_url'])): ?>
          <a class="video-play" href="<?= e($task['video_url']) ?>" target="_blank" rel="noopener">▶ নতুন ট্যাবে দেখুন</a>
        <?php endif; ?>
      </div>
    <?php else: ?>
      <div class="video-poster video-poster-empty">
        <p>এই টাস্কের ভিডিও লিংক এখনো যোগ করা হয়নি।</p>
        <?php if (!empty($task['video_url'])): ?>
          <a class="btn btn-ghost btn-sm" href="<?= e($task['video_url']) ?>" target="_blank" rel="noopener">লিংক খুলুন</a>
        <?php endif; ?>
      </div>
    <?php endif; ?>
  </div>

  <?php if ($state['ok']): ?>
    <div class="watch-timer" id="watchBox" data-remaining="<?= (int) $waitSeconds ?>" data-task="<?= (int) $task['id'] ?>">
      <div class="timer-ring">
        <span id="timerText"><?= e(bn((string) $waitSeconds)) ?></span>
        <small>সেকেন্ড</small>
      </div>
      <div class="timer-side">
        <strong id="timerHint">ভিডিওটি দেখুন…</strong>
        <span class="muted small">সময় শেষ হলে ক্লেইম বাটন চালু হবে</span>
      </div>
    </div>

    <button class="btn btn-primary btn-block btn-lg" id="claimBtn" disabled
            data-task="<?= (int) $task['id'] ?>" data-csrf="<?= e(csrf_token()) ?>">
      ক্লেইম করুন <?= e(pts($task['reward'])) ?>
    </button>
    <p class="center muted small" id="claimMsg"></p>
  <?php else: ?>
    <div class="alert alert-info">
      <?php if ($state['reason'] === 'daily_limit'): ?>
        এই টাস্কের আজকের লিমিট (<strong><?= e(bn((string) $task['daily_limit'])) ?></strong> বার) শেষ।
      <?php else: ?>
        এই টাস্ক এখন কুলডাউনে আছে। আবার করা যাবে:
      <?php endif; ?>
      <div class="big-countdown" data-countdown="<?= (int) $state['next_at'] ?>">…</div>
    </div>
    <?php if ($nextTask): ?>
      <a class="btn btn-ghost btn-block" href="<?= e(url('task.php?id=' . (int) $nextTask['id'])) ?>">
        পরের টাস্ক: <?= e(str_limit((string) $nextTask['title'], 34)) ?>
      </a>
    <?php endif; ?>
  <?php endif; ?>
</section>

<section class="card info-card">
  <h2 class="card-title">নিয়মাবলি</h2>
  <ul class="bullets">
    <li>কমপক্ষে <?= e(bn((string) $waitSeconds)) ?> সেকেন্ড থাকতে হবে।</li>
    <li>প্রতিটি টাস্ক আবার করার আগে <?= e(bn((string) $task['cooldown_hours'])) ?> ঘণ্টা অপেক্ষা।</li>
    <li>দিনে সর্বোচ্চ <?= e(bn((string) $task['daily_limit'])) ?> বার এই টাস্কটি করা যাবে।</li>
  </ul>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
