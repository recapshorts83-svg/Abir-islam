<?php
require __DIR__ . '/../includes/bootstrap.php';

$adm = require_admin();
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();
    $action = (string) ($_POST['action'] ?? '');
    $taskId = (int) ($_POST['task_id'] ?? 0);

    $st = $pdo->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
    $st->execute([$taskId]);
    $task = $st->fetch();

    if (!$task) {
        flash('error', 'টাস্ক পাওয়া যায়নি।');
    } elseif ($action === 'toggle') {
        $new = $task['status'] === 'active' ? 'paused' : 'active';
        $pdo->prepare('UPDATE tasks SET status = ? WHERE id = ?')->execute([$new, $taskId]);
        flash('success', $new === 'active' ? 'টাস্ক চালু করা হয়েছে।' : 'টাস্ক বন্ধ (পজ) করা হয়েছে।');
    } elseif ($action === 'delete') {
        $pdo->prepare('DELETE FROM task_logs WHERE task_id = ?')->execute([$taskId]);
        $pdo->prepare('DELETE FROM tasks WHERE id = ?')->execute([$taskId]);
        flash('success', 'টাস্ক ডিলিট করা হয়েছে।');
    } elseif ($action === 'up' || $action === 'down') {
        $delta = $action === 'up' ? -1 : 1;
        $pdo->prepare('UPDATE tasks SET sort_order = sort_order + ? WHERE id = ?')
            ->execute([$delta * 3, $taskId]);
        flash('success', 'ক্রম বদলানো হয়েছে।');
    }

    redirect(url('admin/tasks.php'));
}

$PAGE_TITLE   = 'টাস্ক ম্যানেজমেন্ট';
$ADMIN_ACTIVE = 'tasks';

$tasks = $pdo->query('SELECT * FROM tasks ORDER BY sort_order ASC, id DESC')->fetchAll();

include __DIR__ . '/includes/header.php';
?>

<section class="panel">
  <div class="panel-head">
    <h2>সব টাস্ক (<?= e(num(count($tasks))) ?>)</h2>
    <div class="quick-actions">
      <a class="btn btn-primary btn-sm" href="<?= e(url('admin/task-edit.php')) ?>">+ নতুন টাস্ক</a>
    </div>
  </div>

  <div class="table-wrap">
    <table class="admin-table">
      <thead>
        <tr>
          <th>ক্রম</th>
          <th>শিরোনাম</th>
          <th>প্ল্যাটফর্ম</th>
          <th>রিওয়ার্ড</th>
          <th>দেখার সময়</th>
          <th>কুলডাউন</th>
          <th>দৈনিক</th>
          <th>অবস্থা</th>
          <th>অ্যাকশন</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($tasks as $t): $meta = platform_meta((string) $t['platform']); ?>
          <tr>
            <td class="muted"><?= e(num($t['sort_order'])) ?></td>
            <td>
              <a class="link" href="<?= e(url('admin/task-edit.php?id=' . (int) $t['id'])) ?>"><?= e(str_limit((string) $t['title'], 40)) ?></a>
            </td>
            <td><span class="platform" style="--accent: <?= e($meta['color']) ?>"><?= e($meta['label']) ?></span></td>
            <td><strong><?= e(num($t['reward'])) ?></strong></td>
            <td class="muted"><?= e(bn((string) $t['watch_seconds'])) ?> সে.</td>
            <td class="muted"><?= e(bn((string) $t['cooldown_hours'])) ?> ঘ.</td>
            <td class="muted"><?= e(bn((string) $t['daily_limit'])) ?></td>
            <td>
              <span class="badge <?= $t['status'] === 'active' ? 'badge-ok' : 'badge-warn' ?>">
                <?= $t['status'] === 'active' ? 'চালু' : 'পজ' ?>
              </span>
            </td>
            <td class="action-cell">
              <a class="btn btn-ghost btn-xs" href="<?= e(url('admin/task-edit.php?id=' . (int) $t['id'])) ?>">এডিট</a>
              <form method="post" class="inline-form">
                <?= csrf_field() ?>
                <input type="hidden" name="task_id" value="<?= (int) $t['id'] ?>">
                <button class="btn btn-ghost btn-xs" name="action" value="up" type="submit" title="উপরে">↑</button>
                <button class="btn btn-ghost btn-xs" name="action" value="down" type="submit" title="নিচে">↓</button>
                <button class="btn btn-ghost btn-xs" name="action" value="toggle" type="submit">
                  <?= $t['status'] === 'active' ? 'পজ' : 'চালু' ?>
                </button>
                <button class="btn btn-danger btn-xs" name="action" value="delete" type="submit"
                        onclick="return confirm('টাস্কটি এবং এর সব হিস্ট্রি মুছে যাবে। নিশ্চিত?');">মুছুন</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$tasks): ?>
          <tr><td colspan="9" class="muted">কোনো টাস্ক নেই। "নতুন টাস্ক" থেকে শুরু করুন।</td></tr>
        <?php endif; ?>
      </tbody>
    </table>
  </div>
</section>

<section class="panel">
  <div class="panel-head"><h2>টিপস</h2></div>
  <ul class="bullets">
    <li><strong>দেখার সময়</strong> হলো ইউজারকে কত সেকেন্ড অপেক্ষা করতে হবে — এর আগে ক্লেইম করা যাবে না।</li>
    <li><strong>কুলডাউন</strong> ঘণ্টায় নির্ধারণ করুন — যেমন ২৪ মানে প্রতিদিন একবার।</li>
    <li>ইউটিউব লিংক দিলে ভিডিও সরাসরি সাইটের ভেতরে প্লে হবে; অন্য লিংকে নতুন ট্যাবে খুলবে।</li>
    <li>ক্রম উপরে-নিচে সাজিয়ে হোমপেজে প্রথমে কোন টাস্ক দেখাবে তা ঠিক করুন।</li>
  </ul>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
