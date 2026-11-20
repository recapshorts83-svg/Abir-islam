<?php
require __DIR__ . '/includes/bootstrap.php';

$me  = require_login();
$uid = (int) $me['id'];
$pdo = db();

$PAGE_TITLE = 'প্রোফাইল';
$ACTIVE     = 'profile';

/* ---------- পাসওয়ার্ড পরিবর্তন ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'password') {
    csrf_verify();

    $current = (string) ($_POST['current'] ?? '');
    $new     = (string) ($_POST['new'] ?? '');
    $new2    = (string) ($_POST['new2'] ?? '');

    if (!password_verify($current, (string) $me['password'])) {
        flash('error', 'বর্তমান পাসওয়ার্ড ভুল।');
    } elseif (strlen($new) < 6) {
        flash('error', 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
    } elseif ($new !== $new2) {
        flash('error', 'নতুন পাসওয়ার্ড দুইবার একই লিখুন।');
    } else {
        $pdo->prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
            ->execute([password_hash($new, PASSWORD_DEFAULT), now(), $uid]);
        flash('success', 'পাসওয়ার্ড পরিবর্তন হয়েছে।');
    }
    redirect(url('profile.php'));
}

$todayStart = date('Y-m-d') . ' 00:00:00';

$st = $pdo->prepare('SELECT COUNT(*) FROM task_logs WHERE user_id = ?');
$st->execute([$uid]);
$totalTasks = (int) $st->fetchColumn();

$st = $pdo->prepare('SELECT COUNT(*) FROM task_logs WHERE user_id = ? AND created_at >= ?');
$st->execute([$uid, $todayStart]);
$todayTasks = (int) $st->fetchColumn();

$st = $pdo->prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 15');
$st->execute([$uid]);
$txs = $st->fetchAll();

$refEnabled = (string) setting('referral_enabled', '0') === '1';
$refLink    = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://')
    . ($_SERVER['HTTP_HOST'] ?? 'localhost') . url('register.php') . '?ref=' . urlencode((string) $me['ref_code']);

$refCount = 0;
if ($refEnabled) {
    $st = $pdo->prepare('SELECT COUNT(*) FROM users WHERE referred_by = ?');
    $st->execute([$uid]);
    $refCount = (int) $st->fetchColumn();
}

include __DIR__ . '/includes/header.php';
?>

<section class="profile-card">
  <span class="profile-avatar"><?= e(strtoupper(substr((string) $me['name'], 0, 1))) ?></span>
  <div class="profile-info">
    <h1><?= e($me['name']) ?></h1>
    <p class="muted small">@<?= e($me['username']) ?> · যোগ দিয়েছেন <?= e(date('d M Y', strtotime((string) $me['created_at']))) ?></p>
  </div>
  <span class="pill"><?= e(pts($me['points'])) ?></span>
</section>

<section class="stat-grid">
  <div class="quick-card"><span class="muted small">মোট আয়</span><strong><?= e(pts($me['total_earned'])) ?></strong></div>
  <div class="quick-card"><span class="muted small">স্ট্রিক</span><strong><?= e(bn((string) $me['streak'])) ?> দিন</strong></div>
  <div class="quick-card"><span class="muted small">আজকের টাস্ক</span><strong><?= e(bn((string) $todayTasks)) ?></strong></div>
  <div class="quick-card"><span class="muted small">সর্বমোট টাস্ক</span><strong><?= e(bn((string) $totalTasks)) ?></strong></div>
</section>

<?php if ($refEnabled): ?>
<section class="card">
  <h2 class="card-title">রেফারেল</h2>
  <p class="muted small">
    আপনার লিংক শেয়ার করুন — কেউ জয়েন করলে <?= e(bn((string) setting('referral_commission', 10))) ?>% কমিশন পাবেন।
    এখন পর্যন্ত <?= e(bn((string) $refCount)) ?> জন জয়েন করেছেন।
  </p>
  <div class="copy-row">
    <input type="text" class="copy-input" id="refLink" value="<?= e($refLink) ?>" readonly>
    <button class="btn btn-primary btn-sm" type="button" data-copy="#refLink">কপি</button>
  </div>
  <p class="muted small">আপনার কোড: <strong><?= e($me['ref_code']) ?></strong></p>
</section>
<?php endif; ?>

<section class="card">
  <h2 class="card-title">সাম্প্রতিক কার্যক্রম</h2>
  <?php if (!$txs): ?>
    <p class="muted small">এখনো কোনো কার্যক্রম নেই। প্রথম টাস্ক সম্পন্ন করুন।</p>
  <?php else: ?>
    <ul class="tx-list">
      <?php foreach ($txs as $tx):
          $icons = ['task' => '▶', 'checkin' => '✓', 'admin' => '⚙', 'referral' => '👥', 'bonus' => '🎁'];
          $icon  = $icons[$tx['type']] ?? '•';
          ?>
        <li class="tx-row">
          <span class="tx-icon"><?= $icon ?></span>
          <span class="tx-main">
            <strong><?= e($tx['note'] ?: ucfirst((string) $tx['type'])) ?></strong>
            <small><?= e(date('d M, h:i A', strtotime((string) $tx['created_at']))) ?></small>
          </span>
          <span class="tx-amount <?= (int) $tx['amount'] < 0 ? 'is-minus' : '' ?>">
            <?= (int) $tx['amount'] < 0 ? '' : '+' ?><?= e(pts($tx['amount'])) ?>
          </span>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
</section>

<section class="card">
  <h2 class="card-title">পাসওয়ার্ড পরিবর্তন</h2>
  <form method="post" class="stack" autocomplete="off">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="password">
    <label class="field"><span>বর্তমান পাসওয়ার্ড</span><input type="password" name="current" required></label>
    <label class="field"><span>নতুন পাসওয়ার্ড</span><input type="password" name="new" required minlength="6"></label>
    <label class="field"><span>নতুন পাসওয়ার্ড আবার</span><input type="password" name="new2" required minlength="6"></label>
    <button class="btn btn-ghost btn-block" type="submit">আপডেট করুন</button>
  </form>
</section>

<section class="card">
  <div class="row-between">
    <?php $support = (string) setting('support_link', ''); ?>
    <?php if ($support !== ''): ?>
      <a class="btn btn-ghost btn-sm" href="<?= e($support) ?>" target="_blank" rel="noopener">সাপোর্ট</a>
    <?php endif; ?>
    <?php if ($me['role'] === 'admin'): ?>
      <a class="btn btn-ghost btn-sm" href="<?= e(url('admin/index.php')) ?>">অ্যাডমিন প্যানেল</a>
    <?php endif; ?>
    <a class="btn btn-danger btn-sm" href="<?= e(url('logout.php')) ?>">লগআউট</a>
  </div>
</section>

<p class="center muted small" style="padding-bottom:8px"><?= e(setting('footer_text', '')) ?></p>

<?php include __DIR__ . '/includes/footer.php'; ?>
