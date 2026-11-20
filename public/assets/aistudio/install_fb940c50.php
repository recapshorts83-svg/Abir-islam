<?php
/**
 * Viral Video Pro — ইনস্টলার
 * একবার রান করে অ্যাডমিন অ্যাকাউন্ট বানান, তারপর এই ফাইলটা ডিলিট করুন।
 */
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/schema.php';

global $CONFIG;
$driver = $CONFIG['db']['driver'] ?? 'mysql';
$pdo = db();

$errors = [];
$done = false;

// টেবিল তৈরি / হালনাগাদ
try {
    install_schema($pdo, $driver);
    install_default_settings($pdo);
} catch (Throwable $e) {
    $errors[] = 'টেবিল তৈরি করা যায়নি: ' . $e->getMessage();
}

$adminExists = false;
try {
    $adminExists = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn() > 0;
} catch (Throwable $e) {
    $adminExists = false;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$adminExists) {
    csrf_verify();

    $name     = trim((string) ($_POST['name'] ?? ''));
    $username = strtolower(trim((string) ($_POST['username'] ?? '')));
    $email    = trim((string) ($_POST['email'] ?? ''));
    $pass     = (string) ($_POST['password'] ?? '');
    $pass2    = (string) ($_POST['password2'] ?? '');
    $sitename = trim((string) ($_POST['site_name'] ?? ''));
    $demo     = isset($_POST['demo']);

    if ($name === '' || strlen($name) < 2) {
        $errors[] = 'অ্যাডমিনের নাম লিখুন।';
    }
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $username)) {
        $errors[] = 'ইউজারনেম ৩–২০ অক্ষরের হতে হবে (ইংরেজি ছোট হাতের অক্ষর, সংখ্যা, _ )।';
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'ইমেইল ঠিকানা সঠিক নয়।';
    }
    if (strlen($pass) < 6) {
        $errors[] = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।';
    }
    if ($pass !== $pass2) {
        $errors[] = 'দুইবার লেখা পাসওয়ার্ড মিলছে না।';
    }

    if (!$errors) {
        try {
            $st = $pdo->prepare('SELECT COUNT(*) FROM users WHERE username = ?');
            $st->execute([$username]);
            if ((int) $st->fetchColumn() > 0) {
                $errors[] = 'এই ইউজারনেম আগেই নেওয়া হয়েছে।';
            } else {
                $ins = $pdo->prepare(
                    'INSERT INTO users (name, username, email, password, role, status, ref_code, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                $ins->execute([
                    $name,
                    $username,
                    $email !== '' ? $email : null,
                    password_hash($pass, PASSWORD_DEFAULT),
                    'admin',
                    'active',
                    strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)),
                    now(),
                    now(),
                ]);

                if ($sitename !== '') {
                    set_setting('site_name', $sitename);
                }
                if ($demo) {
                    install_demo_tasks($pdo);
                }

                $done = true;
                $adminExists = true;
            }
        } catch (Throwable $e) {
            $errors[] = 'অ্যাডমিন তৈরি করা যায়নি: ' . $e->getMessage();
        }
    }
}

$siteTitle = 'ইনস্টলেশন — ' . site_name();
?>
<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($siteTitle) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e(url('assets/css/style.css')) ?>">
</head>
<body class="auth-body">
<main class="auth-wrap">
  <div class="auth-card">
    <div class="brand-mark">V</div>
    <h1 class="auth-title"><?= e(site_name()) ?></h1>
    <p class="auth-sub">প্রথমবার সেটআপ — অ্যাডমিন অ্যাকাউন্ট তৈরি করুন</p>

    <?php foreach ($errors as $err): ?>
      <div class="alert alert-error"><?= e($err) ?></div>
    <?php endforeach; ?>

    <?php if ($done): ?>
      <div class="alert alert-success">
        সেটআপ সম্পন্ন! এখন অ্যাডমিন হিসেবে লগইন করতে পারেন।
      </div>
      <div class="stack">
        <a class="btn btn-primary btn-block" href="<?= e(url('login.php')) ?>">লগইন পেজে যান</a>
        <p class="muted small">নিরাপত্তার জন্য এখন <code>install.php</code> ফাইলটি সার্ভার থেকে ডিলিট করে দিন।</p>
      </div>
    <?php elseif ($adminExists): ?>
      <div class="alert alert-info">অ্যাডমিন অ্যাকাউন্ট আগেই তৈরি করা হয়েছে।</div>
      <a class="btn btn-primary btn-block" href="<?= e(url('login.php')) ?>">লগইন করুন</a>
    <?php else: ?>
      <form method="post" class="stack" autocomplete="off">
        <?= csrf_field() ?>
        <label class="field">
          <span>সাইটের নাম</span>
          <input type="text" name="site_name" value="Viral Video Pro" maxlength="60">
        </label>
        <label class="field">
          <span>আপনার নাম *</span>
          <input type="text" name="name" required maxlength="100" placeholder="যেমন: রফিকুল ইসলাম">
        </label>
        <label class="field">
          <span>অ্যাডমিন ইউজারনেম *</span>
          <input type="text" name="username" required maxlength="20" placeholder="admin">
        </label>
        <label class="field">
          <span>ইমেইল (ঐচ্ছিক)</span>
          <input type="email" name="email" maxlength="150" placeholder="you@example.com">
        </label>
        <label class="field">
          <span>পাসওয়ার্ড *</span>
          <input type="password" name="password" required minlength="6">
        </label>
        <label class="field">
          <span>পাসওয়ার্ড আবার *</span>
          <input type="password" name="password2" required minlength="6">
        </label>
        <label class="check">
          <input type="checkbox" name="demo" checked>
          <span>উদাহরণ হিসেবে ৫টি ডেমো টাস্ক যোগ করুন</span>
        </label>
        <button class="btn btn-primary btn-block" type="submit">সেটআপ সম্পন্ন করুন</button>
      </form>
    <?php endif; ?>
  </div>
  <p class="auth-foot">PHP <?= e(PHP_VERSION) ?> · <?= e($driver === 'sqlite' ? 'SQLite' : 'MySQL') ?></p>
</main>
</body>
</html>
