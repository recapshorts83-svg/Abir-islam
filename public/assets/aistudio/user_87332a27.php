<?php
require __DIR__ . '/../includes/bootstrap.php';

$adm = require_admin();
$pdo = db();

$userId = (int) ($_GET['id'] ?? 0);
if ($userId <= 0 && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = (int) ($_POST['user_id'] ?? 0);
}

$st = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
$st->execute([$userId]);
$user = $st->fetch();

if (!$user) {
    flash('error', 'ইউজার পাওয়া যায়নি।');
    redirect(url('admin/users.php'));
}

$isSelf = (int) $user['id'] === (int) $adm['id'];

/* ---------------- অ্যাকশন ---------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'points') {
        $amount = (int) ($_POST['amount'] ?? 0);
        $note   = trim((string) ($_POST['note'] ?? ''));

        if ($amount === 0) {
            flash('error', 'পয়েন্টের পরিমাণ লিখুন (মাইনাস দিলে কাটা যাবে)।');
        } else {
            $newBalance = (int) $user['points'] + $amount;
            if ($newBalance < 0) {
                flash('error', 'ইউজারের ব্যালেন্স শূন্যের নিচে নামানো যাবে না।');
            } else {
                add_transaction((int) $user['id'], 'admin', $amount, $note !== '' ? $note : 'অ্যাডমিন সমন্বয়');
                flash('success', 'পয়েন্ট আপডেট হয়েছে (' . ($amount > 0 ? '+' : '') . $amount . ')।');
            }
        }
    } elseif ($action === 'profile') {
        $name  = trim((string) ($_POST['name'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? ''));
        $phone = trim((string) ($_POST['phone'] ?? ''));
        $note  = trim((string) ($_POST['note'] ?? ''));
        $role  = (string) ($_POST['role'] ?? 'user');
        $status = (string) ($_POST['status'] ?? 'active');

        if (strlen($name) < 2) {
            flash('error', 'নাম কমপক্ষে ২ অক্ষরের হতে হবে।');
        } elseif ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            flash('error', 'ইমেইল ঠিকানা সঠিক নয়।');
        } else {
            // নিজের রোল/স্ট্যাটাস বদলে নিজেকে লক-আউট করা আটকানো
            if ($isSelf) {
                $role   = $user['role'];
                $status = 'active';
            }
            $pdo->prepare(
                'UPDATE users SET name = ?, email = ?, phone = ?, note = ?, role = ?, status = ?, updated_at = ? WHERE id = ?'
            )->execute([
                $name,
                $email !== '' ? $email : null,
                $phone !== '' ? $phone : null,
                $note !== '' ? $note : null,
                $role === 'admin' ? 'admin' : 'user',
                $status === 'blocked' ? 'blocked' : 'active',
                now(),
                (int) $user['id'],
            ]);
            flash('success', 'ইউজারের তথ্য আপডেট হয়েছে।');
        }
    } elseif ($action === 'password') {
        $newPass = (string) ($_POST['new_password'] ?? '');
        if (strlen($newPass) < 6) {
            flash('error', 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
        } else {
            $pdo->prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
                ->execute([password_hash($newPass, PASSWORD_DEFAULT), now(), (int) $user['id']]);
            flash('success', 'ইউজারের পাসওয়ার্ড রিসেট হয়েছে।');
        }
    } elseif ($action === 'delete') {
        if ($isSelf) {
            flash('error', 'নিজের অ্যাকাউন্ট ডিলিট করা যাবে না।');
        } else {
            $pdo->prepare('DELETE FROM task_logs WHERE user_id = ?')->execute([(int) $user['id']]);
            $pdo->prepare('DELETE FROM transactions WHERE user_id = ?')->execute([(int) $user['id']]);
            $pdo->prepare('DELETE FROM checkins WHERE user_id = ?')->execute([(int) $user['id']]);
            $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([(int) $user['id']]);
            flash('success', 'ইউজার ডিলিট করা হয়েছে।');
            redirect(url('admin/users.php'));
        }
    }

    redirect(url('admin/user.php?id=' . (int) $user['id']));
}

/* ---------------- তথ্য ---------------- */
$st = $pdo->prepare('SELECT * FROM task_logs WHERE user_id = ? ORDER BY id DESC LIMIT 12');
$st->execute([$userId]);
$logs = $st->fetchAll();

$st = $pdo->prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 15');
$st->execute([$userId]);
$txs = $st->fetchAll();

$st = $pdo->prepare('SELECT COUNT(*) FROM users WHERE referred_by = ?');
$st->execute([$userId]);
$refCount = (int) $st->fetchColumn();

$PAGE_TITLE   = 'ইউজার: ' . $user['name'];
$ADMIN_ACTIVE = 'users';

include __DIR__ . '/includes/header.php';
?>

<a class="back-link" href="<?= e(url('admin/users.php')) ?>">← ইউজার লিস্ট</a>

<section class="stat-cards">
  <div class="stat-card">
    <span class="stat-label">ব্যালেন্স</span>
    <strong><?= e(num($user['points'])) ?></strong>
    <span class="stat-note"><?= e(setting('points_label', 'পয়েন্ট')) ?></span>
  </div>
  <div class="stat-card">
    <span class="stat-label">মোট আয়</span>
    <strong><?= e(num($user['total_earned'])) ?></strong>
    <span class="stat-note">সর্বকালের</span>
  </div>
  <div class="stat-card">
    <span class="stat-label">স্ট্রিক</span>
    <strong><?= e(bn((string) $user['streak'])) ?></strong>
    <span class="stat-note">শেষ চেক-ইন: <?= e($user['last_checkin'] ? date('d/m/y', strtotime((string) $user['last_checkin'])) : 'নেই') ?></span>
  </div>
  <div class="stat-card">
    <span class="stat-label">রেফার</span>
    <strong><?= e(num($refCount)) ?></strong>
    <span class="stat-note">কোড: <?= e($user['ref_code'] ?: '—') ?></span>
  </div>
</section>

<div class="panel-grid">
  <section class="panel">
    <div class="panel-head"><h2>তথ্য সম্পাদনা</h2></div>
    <form method="post" class="stack">
      <?= csrf_field() ?>
      <input type="hidden" name="user_id" value="<?= (int) $user['id'] ?>">
      <div class="form-grid">
        <label class="field"><span>নাম</span><input type="text" name="name" value="<?= e($user['name']) ?>" required></label>
        <label class="field"><span>ইউজারনেম</span><input type="text" value="<?= e($user['username']) ?>" disabled></label>
        <label class="field"><span>ইমেইল</span><input type="email" name="email" value="<?= e((string) $user['email']) ?>"></label>
        <label class="field"><span>মোবাইল</span><input type="text" name="phone" value="<?= e((string) $user['phone']) ?>"></label>
        <label class="field">
          <span>রোল</span>
          <select name="role" <?= $isSelf ? 'disabled' : '' ?>>
            <option value="user"  <?= $user['role'] === 'user' ? 'selected' : '' ?>>ইউজার</option>
            <option value="admin" <?= $user['role'] === 'admin' ? 'selected' : '' ?>>অ্যাডমিন</option>
          </select>
        </label>
        <label class="field">
          <span>স্ট্যাটাস</span>
          <select name="status" <?= $isSelf ? 'disabled' : '' ?>>
            <option value="active"  <?= $user['status'] === 'active' ? 'selected' : '' ?>>সক্রিয়</option>
            <option value="blocked" <?= $user['status'] === 'blocked' ? 'selected' : '' ?>>ব্লক</option>
          </select>
        </label>
      </div>
      <label class="field"><span>অ্যাডমিন নোট</span><input type="text" name="note" value="<?= e((string) $user['note']) ?>" placeholder="শুধু অ্যাডমিন দেখবে"></label>
      <button class="btn btn-primary" type="submit" name="action" value="profile">সেভ করুন</button>
    </form>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>পয়েন্ট যোগ / কাটা</h2></div>
    <form method="post" class="stack">
      <?= csrf_field() ?>
      <input type="hidden" name="user_id" value="<?= (int) $user['id'] ?>">
      <input type="hidden" name="action" value="points">
      <label class="field">
        <span>পরিমাণ (মাইনাস দিলে কাটবে)</span>
        <input type="number" name="amount" value="50" step="1" required>
      </label>
      <label class="field">
        <span>কারণ</span>
        <input type="text" name="note" placeholder="যেমন: বোনাস / ভুল সংশোধন">
      </label>
      <button class="btn btn-primary" type="submit">আপডেট করুন</button>
    </form>

    <hr class="sep">

    <div class="panel-head"><h2>পাসওয়ার্ড রিসেট</h2></div>
    <form method="post" class="stack">
      <?= csrf_field() ?>
      <input type="hidden" name="user_id" value="<?= (int) $user['id'] ?>">
      <input type="hidden" name="action" value="password">
      <label class="field"><span>নতুন পাসওয়ার্ড</span><input type="text" name="new_password" minlength="6" required></label>
      <button class="btn btn-ghost" type="submit">রিসেট করুন</button>
    </form>

    <?php if (!$isSelf): ?>
      <hr class="sep">
      <form method="post" onsubmit="return confirm('এই ইউজার এবং তার সব ডেটা মুছে যাবে। নিশ্চিত?');">
        <?= csrf_field() ?>
        <input type="hidden" name="user_id" value="<?= (int) $user['id'] ?>">
        <button class="btn btn-danger btn-block" type="submit" name="action" value="delete">ইউজার ডিলিট করুন</button>
      </form>
    <?php endif; ?>
  </section>
</div>

<div class="panel-grid">
  <section class="panel">
    <div class="panel-head"><h2>সাম্প্রতিক টাস্ক</h2></div>
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>টাস্ক</th><th>পয়েন্ট</th><th>সময়</th></tr></thead>
        <tbody>
          <?php foreach ($logs as $log):
              $t = $pdo->prepare('SELECT title FROM tasks WHERE id = ?');
              $t->execute([$log['task_id']]);
              $tTitle = (string) ($t->fetchColumn() ?: '—');
              ?>
            <tr>
              <td><?= e(str_limit($tTitle, 34)) ?></td>
              <td><?= e(num($log['points'])) ?></td>
              <td class="muted small"><?= e(date('d/m/y H:i', strtotime((string) $log['created_at']))) ?></td>
            </tr>
          <?php endforeach; ?>
          <?php if (!$logs): ?><tr><td colspan="3" class="muted">কোনো টাস্ক নেই।</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>লেনদেন</h2></div>
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>ধরন</th><th>পরিমাণ</th><th>বিবরণ</th><th>সময়</th></tr></thead>
        <tbody>
          <?php foreach ($txs as $tx): ?>
            <tr>
              <td><?= e($tx['type']) ?></td>
              <td class="<?= (int) $tx['amount'] < 0 ? 'text-bad' : 'text-ok' ?>">
                <?= (int) $tx['amount'] > 0 ? '+' : '' ?><?= e(num($tx['amount'])) ?>
              </td>
              <td class="muted small"><?= e(str_limit((string) $tx['note'], 30)) ?></td>
              <td class="muted small"><?= e(date('d/m/y H:i', strtotime((string) $tx['created_at']))) ?></td>
            </tr>
          <?php endforeach; ?>
          <?php if (!$txs): ?><tr><td colspan="4" class="muted">কোনো লেনদেন নেই।</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
  </section>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
