<?php
/** ইউজার অ্যাপের হেডার — ব্যবহারের আগে $PAGE_TITLE ও $ACTIVE সেট করুন */
$me       = current_user();
$ACTIVE   = $ACTIVE ?? '';
$PAGE_TITLE = $PAGE_TITLE ?? site_name();
$flashes  = take_flashes();
$notice   = (string) setting('notice', '');
?>
<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b1020">
<title><?= e($PAGE_TITLE) ?> · <?= e(site_name()) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e(url('assets/css/style.css')) ?>">
</head>
<body class="app-body">
<div class="app-shell">

  <header class="topbar">
    <a class="topbar-brand" href="<?= e(url('index.php')) ?>">
      <span class="brand-dot">V</span>
      <span class="brand-text"><?= e(site_name()) ?></span>
    </a>
    <?php if ($me): ?>
      <div class="topbar-right">
        <span class="pill"><?= e(pts($me['points'])) ?></span>
        <?php if ($me['role'] === 'admin'): ?>
          <a class="icon-link" href="<?= e(url('admin/index.php')) ?>" title="অ্যাডমিন প্যানেল">⚙</a>
        <?php endif; ?>
      </div>
    <?php else: ?>
      <a class="btn btn-ghost btn-sm" href="<?= e(url('login.php')) ?>">লগইন</a>
    <?php endif; ?>
  </header>

  <?php if ($notice !== ''): ?>
    <div class="notice"><?= e($notice) ?></div>
  <?php endif; ?>

  <?php if ($flashes): ?>
    <div class="flash-stack">
      <?php foreach ($flashes as $f): ?>
        <div class="alert alert-<?= e($f['type'] === 'success' ? 'success' : ($f['type'] === 'error' ? 'error' : 'info')) ?>">
          <?= e($f['message']) ?>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <main class="app-main">
