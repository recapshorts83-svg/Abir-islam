<?php
require __DIR__ . '/includes/bootstrap.php';

if (current_user() !== null) {
    redirect(url('index.php'));
}

$errors = [];
$value  = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();

    $value    = trim((string) ($_POST['login'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    // সাধারণ ব্রুট-ফোর্স সুরক্ষা
    $attempts = (int) ($_SESSION['login_attempts'] ?? 0);
    $lockedAt = (int) ($_SESSION['login_locked_at'] ?? 0);

    if ($attempts >= 6 && (time() - $lockedAt) < 600) {
        $wait = ceil((600 - (time() - $lockedAt)) / 60);
        $errors[] = 'অনেকবার ভুল হয়েছে। ' . bn((string) $wait) . ' মিনিট পর আবার চেষ্টা করুন।';
    } elseif ($value === '' || $password === '') {
        $errors[] = 'ইউজারনেম ও পাসওয়ার্ড দুটোই দিন।';
    } else {
        $st = db()->prepare('SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1');
        $st->execute([$value, $value]);
        $user = $st->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            $_SESSION['login_attempts'] = $attempts + 1;
            $_SESSION['login_locked_at'] = time();
            $errors[] = 'ইউজারনেম বা পাসওয়ার্ড ভুল।';
        } elseif ($user['status'] !== 'active') {
            $errors[] = 'আপনার অ্যাকাউন্ট ব্লক করা হয়েছে। সাপোর্টে যোগাযোগ করুন।';
        } else {
            // নতুন সেশন আইডি (সেশন ফিক্সেশন প্রতিরোধ)
            session_regenerate_id(true);
            unset($_SESSION['login_attempts'], $_SESSION['login_locked_at']);
            $_SESSION['uid'] = (int) $user['id'];

            $to = $_SESSION['redirect_after'] ?? url('index.php');
            unset($_SESSION['redirect_after']);

            flash('success', 'স্বাগতম, ' . $user['name'] . '!');
            redirect($to);
        }
    }
}

$PAGE_TITLE = 'লগইন';
?>
<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0b1020">
<title><?= e($PAGE_TITLE) ?> · <?= e(site_name()) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e(url('assets/css/style.css')) ?>">
</head>
<body class="auth-body">
<main class="auth-wrap">
  <div class="auth-card">
    <a class="brand-mark" href="<?= e(url('index.php')) ?>">V</a>
    <h1 class="auth-title">আবার স্বাগতম</h1>
    <p class="auth-sub"><?= e(site_name()) ?>-এ লগইন করুন</p>

    <?php foreach ($errors as $err): ?>
      <div class="alert alert-error"><?= e($err) ?></div>
    <?php endforeach; ?>
    <?php foreach (take_flashes() as $f): ?>
      <div class="alert alert-<?= e($f['type'] === 'error' ? 'error' : 'success') ?>"><?= e($f['message']) ?></div>
    <?php endforeach; ?>

    <form method="post" class="stack" autocomplete="on">
      <?= csrf_field() ?>
      <label class="field">
        <span>ইউজারনেম বা ইমেইল</span>
        <input type="text" name="login" value="<?= e($value) ?>" required autofocus autocomplete="username">
      </label>
      <label class="field">
        <span>পাসওয়ার্ড</span>
        <input type="password" name="password" required autocomplete="current-password">
      </label>
      <button class="btn btn-primary btn-block" type="submit">লগইন</button>
    </form>

    <p class="auth-switch">
      অ্যাকাউন্ট নেই? <a href="<?= e(url('register.php')) ?>">রেজিস্ট্রেশন করুন</a>
    </p>
  </div>
  <p class="auth-foot">
    <a href="<?= e(url('index.php')) ?>">← হোমে ফিরে যান</a>
  </p>
</main>
<script src="<?= e(url('assets/js/app.js')) ?>"></script>
</body>
</html>
