<?php
require __DIR__ . '/../includes/bootstrap.php';

$adm = require_admin();
$pdo = db();

$taskId = (int) ($_GET['id'] ?? ($_POST['id'] ?? 0));
$isEdit = $taskId > 0;

$task = [
    'id'             => 0,
    'title'          => '',
    'description'    => '',
    'platform'       => 'youtube',
    'video_url'      => '',
    'thumb'          => '',
    'reward'         => 20,
    'watch_seconds'  => 20,
    'cooldown_hours' => 24,
    'daily_limit'    => 1,
    'status'         => 'active',
    'sort_order'     => 10,
];

if ($isEdit) {
    $st = $pdo->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
    $st->execute([$taskId]);
    $found = $st->fetch();
    if (!$found) {
        flash('error', 'টাস্ক পাওয়া যায়নি।');
        redirect(url('admin/tasks.php'));
    }
    $task = $found;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();

    $data = [
        'title'          => trim((string) ($_POST['title'] ?? '')),
        'description'    => trim((string) ($_POST['description'] ?? '')),
        'platform'       => (string) ($_POST['platform'] ?? 'other'),
        'video_url'      => trim((string) ($_POST['video_url'] ?? '')),
        'thumb'          => trim((string) ($_POST['thumb'] ?? '')),
        'reward'         => max(0, (int) ($_POST['reward'] ?? 0)),
        'watch_seconds'  => max(3, (int) ($_POST['watch_seconds'] ?? 15)),
        'cooldown_hours' => max(0, (int) ($_POST['cooldown_hours'] ?? 24)),
        'daily_limit'    => max(0, (int) ($_POST['daily_limit'] ?? 1)),
        'status'         => ($_POST['status'] ?? 'active') === 'paused' ? 'paused' : 'active',
        'sort_order'     => (int) ($_POST['sort_order'] ?? 10),
    ];

    $errors = [];
    if (strlen($data['title']) < 4) {
        $errors[] = 'টাস্কের শিরোনাম কমপক্ষে ৪ অক্ষরের দিন।';
    }
    if ($data['video_url'] !== '' && !filter_var($data['video_url'], FILTER_VALIDATE_URL)) {
        $errors[] = 'ভিডিও লিংকটি সঠিক URL নয় (https:// দিয়ে শুরু হতে হবে)।';
    }
    if ($data['reward'] <= 0) {
        $errors[] = 'রিওয়ার্ড পয়েন্ট ০-এর বেশি হতে হবে।';
    }

    if ($errors) {
        foreach ($errors as $err) {
            flash('error', $err);
        }
        $task = array_merge($task, $data);
    } else {
        if ($isEdit) {
            $pdo->prepare(
                'UPDATE tasks SET title = ?, description = ?, platform = ?, video_url = ?, thumb = ?, reward = ?,
                 watch_seconds = ?, cooldown_hours = ?, daily_limit = ?, status = ?, sort_order = ? WHERE id = ?'
            )->execute([
                $data['title'], $data['description'], $data['platform'], $data['video_url'], $data['thumb'],
                $data['reward'], $data['watch_seconds'], $data['cooldown_hours'], $data['daily_limit'],
                $data['status'], $data['sort_order'], $taskId,
            ]);
            flash('success', 'টাস্ক আপডেট হয়েছে।');
        } else {
            $pdo->prepare(
                'INSERT INTO tasks (title, description, platform, video_url, thumb, reward, watch_seconds,
                 cooldown_hours, daily_limit, status, sort_order, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $data['title'], $data['description'], $data['platform'], $data['video_url'], $data['thumb'],
                $data['reward'], $data['watch_seconds'], $data['cooldown_hours'], $data['daily_limit'],
                $data['status'], $data['sort_order'], now(),
            ]);
            flash('success', 'নতুন টাস্ক যোগ হয়েছে।');
        }
        redirect(url('admin/tasks.php'));
    }
}

$PAGE_TITLE   = $isEdit ? 'টাস্ক সম্পাদনা' : 'নতুন টাস্ক';
$ADMIN_ACTIVE = 'tasks';

$platforms = [
    'youtube'   => 'YouTube',
    'facebook'  => 'Facebook',
    'tiktok'    => 'TikTok',
    'instagram' => 'Instagram',
    'telegram'  => 'Telegram',
    'website'   => 'ওয়েবসাইট',
    'other'     => 'অন্যান্য',
];

$previewThumb = task_thumb($task);

include __DIR__ . '/includes/header.php';
?>

<a class="back-link" href="<?= e(url('admin/tasks.php')) ?>">← টাস্ক লিস্ট</a>

<form method="post" class="panel-grid">
  <?= csrf_field() ?>
  <input type="hidden" name="id" value="<?= (int) $taskId ?>">

  <section class="panel">
    <div class="panel-head"><h2>মূল তথ্য</h2></div>
    <div class="stack">
      <label class="field">
        <span>শিরোনাম *</span>
        <input type="text" name="title" value="<?= e($task['title']) ?>" required maxlength="150" placeholder="যেমন: আজকের ভাইরাল ভিডিও">
      </label>
      <label class="field">
        <span>বর্ণনা</span>
        <textarea name="description" placeholder="ইউজারকে কী করতে হবে তা লিখুন"><?= e((string) $task['description']) ?></textarea>
      </label>
      <div class="form-grid">
        <label class="field">
          <span>প্ল্যাটফর্ম</span>
          <select name="platform">
            <?php foreach ($platforms as $key => $label): ?>
              <option value="<?= e($key) ?>" <?= $task['platform'] === $key ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label class="field">
          <span>অবস্থা</span>
          <select name="status">
            <option value="active" <?= $task['status'] === 'active' ? 'selected' : '' ?>>চালু</option>
            <option value="paused" <?= $task['status'] === 'paused' ? 'selected' : '' ?>>পজ</option>
          </select>
        </label>
      </div>
      <label class="field">
        <span>ভিডিও / লিংক</span>
        <input type="url" name="video_url" value="<?= e((string) $task['video_url']) ?>" placeholder="https://www.youtube.com/watch?v=...">
      </label>
      <label class="field">
        <span>কাস্টম থাম্বনেইল (ঐচ্ছিক)</span>
        <input type="url" name="thumb" value="<?= e((string) $task['thumb']) ?>" placeholder="https://.../image.jpg">
      </label>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>রিওয়ার্ড ও নিয়ম</h2></div>
    <div class="stack">
      <div class="form-grid">
        <label class="field">
          <span>রিওয়ার্ড (পয়েন্ট) *</span>
          <input type="number" name="reward" value="<?= (int) $task['reward'] ?>" min="1" required>
        </label>
        <label class="field">
          <span>দেখার সময় (সেকেন্ড) *</span>
          <input type="number" name="watch_seconds" value="<?= (int) $task['watch_seconds'] ?>" min="3" required>
        </label>
        <label class="field">
          <span>কুলডাউন (ঘণ্টা)</span>
          <input type="number" name="cooldown_hours" value="<?= (int) $task['cooldown_hours'] ?>" min="0">
        </label>
        <label class="field">
          <span>দৈনিক লিমিট (বার)</span>
          <input type="number" name="daily_limit" value="<?= (int) $task['daily_limit'] ?>" min="0">
        </label>
        <label class="field">
          <span>ক্রম (ছোট সংখ্যা আগে)</span>
          <input type="number" name="sort_order" value="<?= (int) $task['sort_order'] ?>" step="1">
        </label>
      </div>

      <div class="preview-box">
        <span class="muted small">প্রিভিউ</span>
        <?php if ($previewThumb !== ''): ?>
          <img class="preview-thumb" src="<?= e($previewThumb) ?>" alt="">
        <?php endif; ?>
        <p class="muted small">ইউটিউব লিংক দিলে ভিডিও সাইটেই প্লে হবে। অন্যগুলো নতুন ট্যাবে খুলবে।</p>
      </div>

      <button class="btn btn-primary btn-block btn-lg" type="submit">
        <?= $isEdit ? 'পরিবর্তন সেভ করুন' : 'টাস্ক যোগ করুন' ?>
      </button>
    </div>
  </section>
</form>

<?php include __DIR__ . '/includes/footer.php'; ?>
