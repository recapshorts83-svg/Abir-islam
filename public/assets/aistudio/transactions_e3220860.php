<?php
require __DIR__ . '/../includes/bootstrap.php';

$adm = require_admin();
$pdo = db();

$PAGE_TITLE   = 'লেনদেন';
$ADMIN_ACTIVE = 'tx';

$type = (string) ($_GET['type'] ?? '');
$user = trim((string) ($_GET['u'] ?? ''));
$page = max(1, (int) ($_GET['p'] ?? 1));
$per  = 30;
$offset = ($page - 1) * $per;

$where  = [];
$params = [];

if (in_array($type, ['task', 'checkin', 'admin', 'referral', 'bonus'], true)) {
    $where[] = 't.type = ?';
    $params[] = $type;
}
if ($user !== '') {
    $where[] = '(u.username LIKE ? OR u.name LIKE ?)';
    $like = '%' . $user . '%';
    array_push($params, $like, $like);
}

$whereSql = $where ? (' WHERE ' . implode(' AND ', $where)) : '';

$st = $pdo->prepare('SELECT COUNT(*) FROM transactions t LEFT JOIN users u ON u.id = t.user_id' . $whereSql);
$st->execute($params);
$total = (int) $st->fetchColumn();
$pages = max(1, (int) ceil($total / $per));

$st = $pdo->prepare(
    'SELECT t.*, u.name AS user_name, u.username
     FROM transactions t LEFT JOIN users u ON u.id = t.user_id'
    . $whereSql . ' ORDER BY t.id DESC LIMIT ' . $per . ' OFFSET ' . $offset
);
$st->execute($params);
$rows = $st->fetchAll();

$st = $pdo->prepare('SELECT COALESCE(SUM(amount),0) FROM transactions t LEFT JOIN users u ON u.id = t.user_id' . $whereSql);
$st->execute($params);
$sum = (int) $st->fetchColumn();

if (isset($_GET['export'])) {
    $all = $pdo->query(
        'SELECT t.id, u.username, t.type, t.amount, t.note, t.created_at
         FROM transactions t LEFT JOIN users u ON u.id = t.user_id ORDER BY t.id DESC LIMIT 5000'
    )->fetchAll(PDO::FETCH_NUM);
    csv_download('transactions-' . date('Ymd') . '.csv', array_merge([['ID', 'ইউজার', 'ধরন', 'পরিমাণ', 'বিবরণ', 'সময়']], $all));
}

include __DIR__ . '/includes/header.php';
?>

<section class="panel">
  <form class="filter-row" method="get">
    <input type="text" name="u" value="<?= e($user) ?>" placeholder="ইউজারনেম বা নাম">
    <select name="type">
      <option value="">সব ধরন</option>
      <option value="task"     <?= $type === 'task' ? 'selected' : '' ?>>টাস্ক</option>
      <option value="checkin"  <?= $type === 'checkin' ? 'selected' : '' ?>>চেক-ইন</option>
      <option value="admin"    <?= $type === 'admin' ? 'selected' : '' ?>>অ্যাডমিন সমন্বয়</option>
      <option value="referral" <?= $type === 'referral' ? 'selected' : '' ?>>রেফারেল</option>
      <option value="bonus"    <?= $type === 'bonus' ? 'selected' : '' ?>>বোনাস</option>
    </select>
    <button class="btn btn-primary" type="submit">ফিল্টার</button>
    <a class="btn btn-ghost" href="<?= e(url('admin/transactions.php?export=1')) ?>">CSV</a>
  </form>
</section>

<section class="panel">
  <div class="panel-head">
    <h2>লেনদেনের তালিকা</h2>
    <span class="muted small">
      মোট <?= e(num($total)) ?> · যোগফল <?= e(num($sum)) ?> · পেজ <?= e(bn((string) $page)) ?>/<?= e(bn((string) $pages)) ?>
    </span>
  </div>

  <div class="table-wrap">
    <table class="admin-table">
      <thead>
        <tr><th>#</th><th>ইউজার</th><th>ধরন</th><th>পরিমাণ</th><th>বিবরণ</th><th>সময়</th></tr>
      </thead>
      <tbody>
        <?php foreach ($rows as $r): ?>
          <tr>
            <td class="muted"><?= e(num($r['id'])) ?></td>
            <td>
              <?php if ($r['username']): ?>
                <a class="link" href="<?= e(url('admin/user.php?id=' . (int) $r['user_id'])) ?>">
                  <?= e($r['user_name']) ?>
                </a>
                <small class="muted">@<?= e($r['username']) ?></small>
              <?php else: ?>
                <span class="muted">ডিলিট করা ইউজার</span>
              <?php endif; ?>
            </td>
            <td><span class="badge badge-info"><?= e($r['type']) ?></span></td>
            <td class="<?= (int) $r['amount'] < 0 ? 'text-bad' : 'text-ok' ?>">
              <?= (int) $r['amount'] > 0 ? '+' : '' ?><?= e(num($r['amount'])) ?>
            </td>
            <td class="muted small"><?= e(str_limit((string) $r['note'], 44)) ?></td>
            <td class="muted small"><?= e(date('d/m/y H:i', strtotime((string) $r['created_at']))) ?></td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$rows): ?>
          <tr><td colspan="6" class="muted">কোনো লেনদেন পাওয়া যায়নি।</td></tr>
        <?php endif; ?>
      </tbody>
    </table>
  </div>

  <?php if ($pages > 1): ?>
    <div class="pager">
      <?php for ($i = 1; $i <= min($pages, 12); $i++): ?>
        <a class="pager-link <?= $i === $page ? 'is-active' : '' ?>"
           href="<?= e(url('admin/transactions.php?' . http_build_query(['type' => $type, 'u' => $user, 'p' => $i]))) ?>">
          <?= e(bn((string) $i)) ?>
        </a>
      <?php endfor; ?>
    </div>
  <?php endif; ?>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
