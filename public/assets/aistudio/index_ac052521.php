<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/actions.php';

$me = current_user();

/* ---------- ডেইলি চেক-ইন ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'checkin') {
    csrf_verify();
    if ($me === null) {
        flash('error', 'আগে লগইন করুন।');
        redirect(url('login.php'));
    }
    [$ok, $msg] = do_checkin((int) $me['id']);
    flash($ok ? 'success' : 'error', $msg);
    redirect(url('index.php'));
}

$PAGE_TITLE = 'হোম';
$ACTIVE     = 'home';

/* ---------- লগইন ছাড়া ল্যান্ডিং পেজ ---------- */
if ($me === null) {
    $taskCount = (int) db()->query("SELECT COUNT(*) FROM tasks WHERE status = 'active'")->fetchColumn();
    include __DIR__ . '/includes/header.php';
    ?>
    <section class="hero">
      <p class="hero-eyebrow">ভিডিও দেখে পয়েন্ট</p>
      <h1 class="hero-title">দেখুন, ক্লেইম করুন,<br><span class="grad-text">পয়েন্ট জমান</span></h1>
      <p class="hero-sub">
        প্রতিদিন নতুন ভিডিও টাস্ক, ডেইলি চেক-ইন বোনাস আর স্ট্রিক রিওয়ার্ড।
        এখন <strong><?= e(bn((string) $taskCount)) ?></strong>টি টাস্ক চালু আছে।
      </p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="<?= e(url('register.php')) ?>">ফ্রি অ্যাকাউন্ট খুলুন</a>
        <a class="btn btn-ghost btn-lg" href="<?= e(url('login.php')) ?>">লগইন</a>
      </div>
    </section>

    <section class="feature-grid">
      <article class="feature-card">
        <span class="feature-icon">▶</span>
        <h3>ভিডিও টাস্ক</h3>
        <p>ভিডিও দেখুন, টাইমার শেষ হলে ক্লেইম করুন — পয়েন্ট যোগ হবে সাথে সাথে।</p>
      </article>
      <article class="feature-card">
        <span class="feature-icon">✓</span>
        <h3>ডেইলি চেক-ইন</h3>
        <p>প্রতিদিন একবার চেক-ইন। টানা যত দিন, বোনাসও তত বেশি।</p>
      </article>
      <article class="feature-card">
        <span class="feature-icon">★</span>
        <h3>লিডারবোর্ড</h3>
        <p>সবার সাথে প্রতিযোগিতা করুন, উপরের দিকে উঠে আসুন।</p>
      </article>
    </section>

    <section class="card how-card">
      <h2 class="card-title">কীভাবে কাজ করে</h2>
      <ol class="steps">
        <li><span class="step-n">১</span> অ্যাকাউন্ট খুলুন — মাত্র ইউজারনেম আর পাসওয়ার্ড।</li>
        <li><span class="step-n">২</span> টাস্ক লিস্ট থেকে ভিডিও বেছে নিন।</li>
        <li><span class="step-n">৩</span> নির্দিষ্ট সময় ভিডিও দেখুন।</li>
        <li><span class="step-n">৪</span> "ক্লেইম" চাপুন — পয়েন্ট যোগ হবে।</li>
      </ol>
      <p class="muted small">
        দ্রষ্টব্য: এই সাইটে কোনো টাকা, ডিপোজিট বা উইথড্র নেই — শুধু পয়েন্ট।
      </p>
    </section>
    <?php
    include __DIR__ . '/includes/footer.php';
    exit;
}

/* ---------- লগইন করা ইউজারের ডেটা ---------- */
$uid = (int) $me['id'];
$pdo = db();

$todayStart = date('Y-m-d') . ' 00:00:00';

$st = $pdo->prepare('SELECT COALESCE(SUM(points),0) FROM task_logs WHERE user_id = ? AND created_at >= ?');
$st->execute([$uid, $todayStart]);
$todayPoints = (int) $st->fetchColumn();

$st = $pdo->prepare('SELECT COUNT(*) FROM task_logs WHERE user_id = ? AND created_at >= ?');
$st->execute([$uid, $todayStart]);
$todayTasks = (int) $st->fetchColumn();

$checkedToday = ((string) $me['last_checkin'] === date('Y-m-d'));

$tasks = $pdo->query("SELECT * FROM tasks WHERE status = 'active' ORDER BY sort_order ASC, id DESC LIMIT 4")->fetchAll();

include __DIR__ . '/includes/header.php';
?>

<section class="balance-card">
  <div class="balance-head">
    <span class="muted">আপনার ব্যালেন্স</span>
    <span class="tag-online">সক্রিয়</span>
  </div>
  <div class="balance-amount">
    <?= e(num($me['points'])) ?>
    <span class="balance-unit"><?= e(setting('points_label', 'পয়েন্ট')) ?></span>
  </div>
  <div class="balance-foot">
    <div>
      <span class="muted small">মোট আয়</span>
      <strong><?= e(pts($me['total_earned'])) ?></strong>
    </div>
    <div>
      <span class="muted small">স্ট্রিক</span>
      <strong><?= e(bn((string) $me['streak'])) ?> দিন</strong>
    </div>
  </div>
</section>

<section class="quick-row">
  <div class="quick-card">
    <span class="muted small">আজকের আয়</span>
    <strong><?= e(pts($todayPoints)) ?></strong>
  </div>
  <div class="quick-card">
    <span class="muted small">আজকের টাস্ক</span>
    <strong><?= e(bn((string) $todayTasks)) ?> টি</strong>
  </div>
</section>

<section class="card checkin-card">
  <div class="checkin-left">
    <h2 class="card-title">ডেইলি চেক-ইন</h2>
    <p class="muted small">
      <?php if ($checkedToday): ?>
        আজ হয়ে গেছে ✓ কাল আবার আসুন।
      <?php else: ?>
        আজ চেক-ইন করলে <?= e(pts((int) setting('checkin_points', 10))) ?> পাবেন।
      <?php endif; ?>
    </p>
  </div>
  <?php if ($checkedToday): ?>
    <button class="btn btn-disabled" disabled>আজ সম্পন্ন</button>
  <?php else: ?>
    <form method="post">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="checkin">
      <button class="btn btn-primary" type="submit">চেক-ইন করুন</button>
    </form>
  <?php endif; ?>
</section>

<section class="section-head">
  <h2>আজকের টাস্ক</h2>
  <a class="link" href="<?= e(url('tasks.php')) ?>">সব দেখুন →</a>
</section>

<?php if (!$tasks): ?>
  <div class="card empty-card">এখন কোনো টাস্ক চালু নেই। একটু পরে আবার দেখুন।</div>
<?php else: ?>
  <div class="task-list">
    <?php foreach ($tasks as $task):
        $state  = task_state($task, $uid);
        $meta   = platform_meta((string) $task['platform']);
        $thumb  = task_thumb($task);
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
          <h3 class="task-title"><?= e(str_limit((string) $task['title'], 52)) ?></h3>
          <p class="task-sub">
            <?= e(bn((string) $task['watch_seconds'])) ?> সেকেন্ড · কুলডাউন <?= e(bn((string) $task['cooldown_hours'])) ?> ঘণ্টা
          </p>
        </div>
        <span class="task-cta <?= $state['ok'] ? '' : 'is-wait' ?>">
          <?= $state['ok'] ? 'দেখুন' : 'অপেক্ষা' ?>
        </span>
      </a>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<section class="card info-card">
  <h2 class="card-title">মনে রাখবেন</h2>
  <ul class="bullets">
    <li>ভিডিওটি পুরো সময় দেখার পরেই ক্লেইম বাটন সক্রিয় হবে।</li>
    <li>প্রতিটি টাস্কে কুলডাউন আছে — শেষ হলে আবার করতে পারবেন।</li>
    <li>ব্রাউজার বন্ধ করলেও আপনার পয়েন্ট অ্যাকাউন্টে সেভ থাকবে।</li>
  </ul>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
