<?php
require __DIR__ . '/includes/bootstrap.php';

if (current_user() !== null) {
    redirect(url('index.php'));
}

$refEnabled = (string) setting('referral_enabled', '0') === '1';
$errors     = [];
$old        = ['name' => '', 'username' => '', 'email' => '', 'phone' => '', 'ref_code' => trim((string) ($_GET['ref'] ?? ''))];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();

    $old['name']     = trim((string) ($_POST['name'] ?? ''));
    $old['username'] = strtolower(trim((string) ($_POST['username'] ?? '')));
    $old['email']    = trim((string) ($_POST['email'] ?? ''));
    $old['phone']    = trim((string) ($_POST['phone'] ?? ''));
    $old['ref_code'] = strtoupper(trim((string) ($_POST['ref_code'] ?? '')));

    $password  = (string) ($_POST['password'] ?? '');
    $password2 = (string) ($_POST['password2'] ?? '');

    if (strlen($old['name']) < 2) {
        $errors[] = 'আপনার নাম লিখুন (কমপক্ষে ২ অক্ষর)।';
    }
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $old['username'])) {
        $errors[] = 'ইউজারনেম ৩–২০ অক্ষরের হতে হবে — ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও আন্ডারস্কোর (_)।';
    }
    if ($old['email'] !== '' && !filter_var($old['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'ইমেইল ঠিকানা সঠিক নয়।';
    }
    if (strlen($password) < 6) {
        $errors[] = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।';
    }
    if ($password !== $password2) {
        $errors[] = 'দুইবার লেখা পাসওয়ার্ড মিলছে না।';
    }

    $referrerId = null;
    if ($refEnabled && $old['ref_code'] !== '') {
        $st = db()->prepare('SELECT id FROM users WHERE ref_code = ? LIMIT 1');
        $st->execute([$old['ref_code']]);
        $referrerId = $st->fetchColumn() ?: null;
        if ($referrerId === null) {
            $errors[] = 'রেফারেল কোডটি সঠিক নয়।';
        }
    }

    if (!$errors) {
        $st = db()->prepare('SELECT COUNT(*) FROM users WHERE username = ?');
        $st->execute([$old['username']]);
        if ((int) $st->fetchColumn() > 0) {
            $errors[] = 'এই ইউজারনেম আগেই নেওয়া হয়েছে, অন্যটা বেছে নিন।';
        }
    }

    if (!$errors) {
        $refCode = strtoupper(bin2hex(random_bytes(4)));
        // ইউনিক কোড নিশ্চিত করা
        for ($i = 0; $i < 5; $i++) {
            $st = db()->prepare('SELECT COUNT(*) FROM users WHERE ref_code = ?');
            $st->execute([$refCode]);
            if ((int) $st->fetchColumn() === 0) {
                break;
            }
            $refCode = strtoupper(bin2hex(random_bytes(4)));
        }

        $ins = db()->prepare(
            'INSERT INTO users (name, username, email, phone, password, role, status, ref_code, referred_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $ins->execute([
            $old['name'],
            $old['username'],
            $old['email'] !== '' ? $old['email'] : null,
            $old['phone'] !== '' ? $old['phone'] : null,
            password_hash($password, PASSWORD_DEFAULT),
            'user',
            'active',
            $refCode,
            $referrerId ? (int) $referrerId : null,
            now(),
            now(),
        ]);

        $newId = (int) db()->lastInsertId();
        session_regenerate_id(true);
        $_SESSION['uid'] = $newId;

        flash('success', 'অ্যাকাউন্ট তৈরি হয়েছে। এখন টাস্ক শুরু করুন!');
        redirect(url('index.php'));
    }
}

$PAGE_TITLE = 'রেজিস্ট্রেশন';
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
    <h1 class="auth-title">অ্যাকাউন্ট খুলুন</h1>
    <p class="auth-sub">কোনো টাকা লাগবে না — শুধু ভিডিও দেখে পয়েন্ট</p>

    <?php foreach ($errors as $err): ?>
      <div class="alert alert-error"><?= e($err) ?></div>
    <?php endforeach; ?>

    <form method="post" class="stack" autocomplete="off">
      <?= csrf_field() ?>
      <label class="field">
        <span>আপনার নাম *</span>
        <input type="text" name="name" value="<?= e($old['name']) ?>" required maxlength="100" placeholder="যেমন: রফিকুল ইসলাম">
      </label>
      <label class="field">
        <span>ইউজারনেম *</span>
        <input type="text" name="username" value="<?= e($old['username']) ?>" required maxlength="20" placeholder="rafiq123" pattern="[a-zA-Z0-9_]{3,20}">
      </label>
      <label class="field">
        <span>ইমেইল (ঐচ্ছিক)</span>
        <input type="email" name="email" value="<?= e($old['email']) ?>" maxlength="150" placeholder="you@example.com">
      </label>
      <label class="field">
        <span>মোবাইল নম্বর (ঐচ্ছিক)</span>
        <input type="text" name="phone" value="<?= e($old['phone']) ?>" maxlength="30" placeholder="017XXXXXXXX">
      </label>
      <?php if ($refEnabled): ?>
        <label class="field">
          <span>রেফারেল কোড (ঐচ্ছিক)</span>
          <input type="text" name="ref_code" value="<?= e($old['ref_code']) ?>" maxlength="20" placeholder="A1B2C3D4">
        </label>
      <?php endif; ?>
      <label class="field">
        <span>পাসওয়ার্ড *</span>
        <input type="password" name="password" required minlength="6" autocomplete="new-password">
      </label>
      <label class="field">
        <span>পাসওয়ার্ড আবার *</span>
        <input type="password" name="password2" required minlength="6" autocomplete="new-password">
      </label>
      <button class="btn btn-primary btn-block" type="submit">রেজিস্ট্রেশন সম্পন্ন করুন</button>
    </form>

    <p class="auth-switch">
      আগেই অ্যাকাউন্ট আছে? <a href="<?= e(url('login.php')) ?>">লগইন করুন</a>
    </p>
  </div>
  <p class="auth-foot"><a href="<?= e(url('index.php')) ?>">← হোমে ফিরে যান</a></p>
</main>
<script src="<?= e(url('assets/js/app.js')) ?>"></script>
</body>
</html>
