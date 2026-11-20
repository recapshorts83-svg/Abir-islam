<?php
require __DIR__ . '/../includes/bootstrap.php';

$adm = require_admin();
$pdo = db();

/* ---------------- অ্যাকশন ---------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = (string) ($_POST['action'] ?? '');
    $userId = (int) ($_POST['user_id'] ?? 0);

    $st = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $st->execute([$userId]);
    $target = $st->fetch();

    if (!$target) {
        flash('error', 'ইউজার পাওয়া যায়নি।');
    } elseif ($action === 'block' || $action === 'unblock') {
        if ((int) $target['id'] === (int) $adm['id']) {
            flash('error', 'নিজের অ্যাকাউন্ট ব্লক করা যাবে না।');
        } else {
            $newStatus = $action === 'block' ? 'blocked' : 'active';
            $pdo->prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
                ->execute([$newStatus, now(), $userId]);
            flash('success', $newStatus === 'active' ? 'ইউজার আবার সক্রিয় করা হয়েছে।' : 'ইউজার ব্লক করা হয়েছে।');
        }
    } elseif ($action === 'delete') {
        if ((int) $target['id'] === (int) $adm['id']) {
            flash('error', 'নিজের অ্যাকাউন্ট ডিলিট করা যাবে না।');
        } else {
            $pdo->prepare('DELETE FROM task_logs WHERE user_id = ?')->execute([$userId]);
            $pdo->prepare('DELETE FROM transactions WHERE user_id = ?')->execute([$userId]);
            $pdo->prepare('DELETE FROM checkins WHERE user_id = ?')->execute([$userId]);
            $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
            flash('success', 'ইউজার ও তার ডেটা ডিলিট করা হয়েছে।');
        }
    }

    redirect(url('admin/users.php?' . http_build_query([
        'q' => $_POST['return_q'] ?? '',
        's' => $_POST['return_s'] ?? '',
        'p' => $_POST['return_p'] ?? 1,
    ])));
}

$PAGE_TITLE   = 'ইউজার ম্যানেজমেন্ট';
$ADMIN_ACTIVE = 'users';

$q      = trim((string) ($_GET['q'] ?? ''));
$status = (string) ($_GET['s'] ?? '');
$page   = max(1, (int) ($_GET['p'] ?? 1));
$per    = 20;
$offset = ($page - 1) * $per;

$where  = [];
$params = [];

if ($q !== '') {
    $where[] = '(name LIKE ? OR username LIKE ? OR email LIKE ? OR phone LIKE ?)';
    $like = '%' . $q . '%';
    array_push($params, $like, $like, $like, $like);
}
if ($status === 'active' || $status === 'blocked') {
    $where[] = 'status = ?';
    $params[] = $status;
}
if ($status === 'admin') {
    $where[] = "role = 'admin'";
}

$whereSql = $where ? (' WHERE ' . implode(' AND ', $where)) : '';

$st = $pdo->prepare('SELECT COUNT(*) FROM users' . $whereSql);
$st->execute($params);
$total = (int) $st->fetchColumn();
$pages = max(1, (int) ceil($total / $per));

$st = $pdo->prepare('SELECT * FROM users' . $whereSql . ' ORDER BY id DESC LIMIT ' . $per . ' OFFSET ' . $offset);
$st->execute($params);
$users = $st->fetchAll();

include __DIR__ . '/includes/header.php';
?>

<section class="panel">
  <form class="filter-row" method="get">
    <input type="text" name="q" value="<?= e($q) ?>" placeholder="নাম, ইউজারনেম, ইমেইল বা ফোন">
    <select name="s">
      <option value="">সব ইউজার</option>
      <option value="active"  <?= $status === 'active' ? 'selected' : '' ?>>সক্রিয়</option>
      <option value="blocked" <?= $status === 'blocked' ? 'selected' : '' ?>>ব্লক করা</option>
      <option value="admin"   <?= $status === 'admin' ? 'selected' : '' ?>>শুধু অ্যাডমিন</option>
    </select>
    <button class="btn btn-primary" type="submit">খুঁজুন</button>
    <a class="btn btn-ghost" href="<?= e(url('admin/export.php?type=users')) ?>">CSV</a>
  </form>
</section>

<section class="panel">
  <div class="panel-head">
    <h2>ইউজার তালিকা</h2>
    <span class="muted small">মোট <?= e(num($total)) ?> জন · পেজ <?= e(bn((string) $page)) ?>/<?= e(bn((string) $pages)) ?></span>
  </div>

  <div class="table-wrap">
    <table class="admin-table">
      <thead>
        <tr>
          <th>#</th>
          <th>নাম</th>
          <th>ইউজারনেম</th>
          <th>পয়েন্ট</th>
          <th>মোট আয়</th>
          <th>স্ট্রিক</th>
          <th>অবস্থা</th>
          <th>যোগদান</th>
          <th>অ্যাকশন</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($users as $u): ?>
          <tr>
            <td class="muted"><?= e(num($u['id'])) ?></td>
            <td>
              <a class="link" href="<?= e(url('admin/user.php?id=' . (int) $u['id'])) ?>"><?= e($u['name']) ?></a>
              <?php if ($u['role'] === 'admin'): ?><span class="badge badge-info">অ্যাডমিন</span><?php endif; ?>
            </td>
            <td class="muted">@<?= e($u['username']) ?></td>
            <td><strong><?= e(num($u['points'])) ?></strong></td>
            <td class="muted"><?= e(num($u['total_earned'])) ?></td>
            <td class="muted"><?= e(bn((string) $u['streak'])) ?></td>
            <td>
              <span class="badge <?= $u['status'] === 'active' ? 'badge-ok' : 'badge-bad' ?>">
                <?= $u['status'] === 'active' ? 'সক্রিয়' : 'ব্লক' ?>
              </span>
            </td>
            <td class="muted small"><?= e(date('d/m/y', strtotime((string) $u['created_at']))) ?></td>
            <td class="action-cell">
              <a class="btn btn-ghost btn-xs" href="<?= e(url('admin/user.php?id=' . (int) $u['id'])) ?>">এডিট</a>
              <form method="post" class="inline-form" onsubmit="return confirm('নিশ্চিত?');">
                <?= csrf_field() ?>
                <input type="hidden" name="user_id" value="<?= (int) $u['id'] ?>">
                <input type="hidden" name="return_q" value="<?= e($q) ?>">
                <input type="hidden" name="return_s" value="<?= e($status) ?>">
                <input type="hidden" name="return_p" value="<?= (int) $page ?>">
                <?php if ($u['status'] === 'active'): ?>
                  <button class="btn btn-ghost btn-xs" name="action" value="block" type="submit">ব্লক</button>
                <?php else: ?>
                  <button class="btn btn-ghost btn-xs" name="action" value="unblock" type="submit">আনব্লক</button>
                <?php endif; ?>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$users): ?>
          <tr><td colspan="9" class="muted">কোনো ইউজার পাওয়া যায়নি।</td></tr>
        <?php endif; ?>
      </tbody>
    </table>
  </div>

  <?php if ($pages > 1): ?>
    <div class="pager">
      <?php for ($i = 1; $i <= $pages; $i++): ?>
        <a class="pager-link <?= $i === $page ? 'is-active' : '' ?>"
           href="<?= e(url('admin/users.php?' . http_build_query(['q' => $q, 's' => $status, 'p' => $i]))) ?>">
          <?= e(bn((string) $i)) ?>
        </a>
      <?php endfor; ?>
    </div>
  <?php endif; ?>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
