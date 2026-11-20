<?php
/** অ্যাডমিন হেডার — ব্যবহারের আগে $PAGE_TITLE ও $ADMIN_ACTIVE সেট করুন */
$adm     = require_admin();
$ACTIVE_ADMIN = $ADMIN_ACTIVE ?? '';
$PAGE_TITLE   = $PAGE_TITLE ?? 'অ্যাডমিন';
$flashes      = take_flashes();

$nav = [
    ['key' => 'dash',  'label' => 'ড্যাশবোর্ড', 'href' => url('admin/index.php'),        'icon' => '▤'],
    ['key' => 'users', 'label' => 'ইউজার',      'href' => url('admin/users.php'),        'icon' => '☺'],
    ['key' => 'tasks', 'label' => 'টাস্ক',      'href' => url('admin/tasks.php'),        'icon' => '▶'],
    ['key' => 'tx',    'label' => 'লেনদেন',     'href' => url('admin/transactions.php'), 'icon' => '≡'],
    ['key' => 'set',   'label' => 'সেটিংস',     'href' => url('admin/settings.php'),     'icon' => '⚙'],
];
?>
<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0b1020">
<title><?= e($PAGE_TITLE) ?> · অ্যাডমিন · <?= e(site_name()) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e(url('assets/css/style.css')) ?>">
<link rel="stylesheet" href="<?= e(url('assets/css/admin.css')) ?>">
</head>
<body class="admin-body">
<div class="admin-layout">

  <aside class="admin-side">
    <a class="admin-brand" href="<?= e(url('admin/index.php')) ?>">
      <span class="brand-dot">V</span>
      <span>
        <strong><?= e(site_name()) ?></strong>
        <small>অ্যাডমিন প্যানেল</small>
      </span>
    </a>

    <nav class="admin-nav">
      <?php foreach ($nav as $item): ?>
        <a class="admin-nav-link <?= $ACTIVE_ADMIN === $item['key'] ? 'is-active' : '' ?>"
           href="<?= e($item['href']) ?>">
          <span class="admin-nav-icon"><?= $item['icon'] ?></span>
          <?= e($item['label']) ?>
        </a>
      <?php endforeach; ?>
    </nav>

    <div class="admin-side-foot">
      <a class="admin-nav-link" href="<?= e(url('index.php')) ?>" target="_blank">↗ সাইট দেখুন</a>
      <a class="admin-nav-link" href="<?= e(url('logout.php')) ?>">⇤ লগআউট</a>
      <p class="muted small">v<?= e(APP_VERSION) ?> · <?= e($adm['name']) ?></p>
    </div>
  </aside>

  <div class="admin-main">
    <header class="admin-top">
      <h1><?= e($PAGE_TITLE) ?></h1>
      <div class="admin-top-right">
        <span class="pill"><?= e(pts($adm['points'])) ?></span>
      </div>
    </header>

    <?php if ($flashes): ?>
      <?php foreach ($flashes as $f): ?>
        <div class="alert alert-<?= e($f['type'] === 'success' ? 'success' : ($f['type'] === 'error' ? 'error' : 'info')) ?>">
          <?= e($f['message']) ?>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>

    <div class="admin-content">
