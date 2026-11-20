<?php
require __DIR__ . '/includes/bootstrap.php';

$me  = require_login();
$uid = (int) $me['id'];
$pdo = db();

$PAGE_TITLE = 'লিডারবোর্ড';
$ACTIVE     = 'leaderboard';

$period = (string) ($_GET['p'] ?? 'all');

if ($period === 'week') {
    $sql = "SELECT u.id, u.name, u.username,
                   COALESCE((SELECT SUM(t.amount) FROM transactions t
                             WHERE t.user_id = u.id AND t.amount > 0
                               AND t.created_at >= :since), 0) AS score
            FROM users u
            WHERE u.role = 'user' AND u.status = 'active'
            ORDER BY score DESC, u.id ASC
            LIMIT 25";
    $st = $pdo->prepare($sql);
    $st->execute([':since' => date('Y-m-d 00:00:00', strtotime('-6 days'))]);
} else {
    $sql = "SELECT u.id, u.name, u.username, u.total_earned AS score
            FROM users u
            WHERE u.role = 'user' AND u.status = 'active'
            ORDER BY u.total_earned DESC, u.id ASC
            LIMIT 25";
    $st = $pdo->query($sql);
}

$leaders = $st->fetchAll();

$myRank = null;
foreach ($leaders as $i => $row) {
    if ((int) $row['id'] === $uid) {
        $myRank = $i + 1;
        break;
    }
}

include __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>লিডারবোর্ড</h1>
    <p class="muted small">সর্বোচ্চ পয়েন্টকারীদের তালিকা</p>
  </div>
  <?php if ($myRank): ?>
    <span class="pill">আপনার র‍্যাংক #<?= e(bn((string) $myRank)) ?></span>
  <?php endif; ?>
</section>

<div class="chip-row">
  <a class="chip <?= $period === 'all' ? 'is-active' : '' ?>" href="<?= e(url('leaderboard.php')) ?>">সর্বকালের</a>
  <a class="chip <?= $period === 'week' ? 'is-active' : '' ?>" href="<?= e(url('leaderboard.php?p=week')) ?>">শেষ ৭ দিন</a>
</div>

<?php if ($leaders): ?>
  <div class="leader-list">
    <?php foreach ($leaders as $i => $row):
        $rank = $i + 1;
        $isMe = (int) $row['id'] === $uid;
        ?>
      <div class="leader-row <?= $isMe ? 'is-me' : '' ?>">
        <span class="leader-rank <?= $rank <= 3 ? 'top' . $rank : '' ?>">
          <?= $rank <= 3 ? ['', '🥇', '🥈', '🥉'][$rank] : e(bn((string) $rank)) ?>
        </span>
        <span class="leader-avatar"><?= e(strtoupper(substr((string) $row['name'], 0, 1))) ?></span>
        <span class="leader-name">
          <?= e($row['name']) ?>
          <?php if ($isMe): ?><em class="you-tag">আপনি</em><?php endif; ?>
          <small>@<?= e($row['username']) ?></small>
        </span>
        <span class="leader-score"><?= e(pts($row['score'])) ?></span>
      </div>
    <?php endforeach; ?>
  </div>
<?php else: ?>
  <div class="card empty-card">এখনো কোনো ইউজার নেই।</div>
<?php endif; ?>

<?php include __DIR__ . '/includes/footer.php'; ?>
