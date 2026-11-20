<?php
require __DIR__ . '/../includes/bootstrap.php';

$adm = require_admin();

$PAGE_TITLE   = 'সাইট সেটিংস';
$ADMIN_ACTIVE = 'set';

/* ---------------- সেভ ---------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verify();

    $text = ['site_name', 'site_tagline', 'points_label', 'footer_text', 'support_link', 'notice',
             'checkin_points', 'checkin_streak_bonus', 'daily_task_limit',
             'referral_commission', 'currency_rate', 'currency_label', 'min_withdraw'];

    foreach ($text as $key) {
        if (array_key_exists($key, $_POST)) {
            set_setting($key, trim((string) $_POST[$key]));
        }
    }

    // চেকবক্সগুলো
    foreach (['bn_digits', 'referral_enabled', 'currency_enabled', 'maintenance'] as $key) {
        set_setting($key, isset($_POST[$key]) ? '1' : '0');
    }

    flash('success', 'সেটিংস সেভ হয়েছে।');
    redirect(url('admin/settings.php'));
}

include __DIR__ . '/includes/header.php';
?>

<form method="post" class="panel-grid">
  <?= csrf_field() ?>

  <section class="panel">
    <div class="panel-head"><h2>সাধারণ</h2></div>
    <div class="stack">
      <label class="field">
        <span>সাইটের নাম</span>
        <input type="text" name="site_name" value="<?= e(setting('site_name', '')) ?>" maxlength="60">
      </label>
      <label class="field">
        <span>ট্যাগলাইন</span>
        <input type="text" name="site_tagline" value="<?= e(setting('site_tagline', '')) ?>" maxlength="120">
      </label>
      <label class="field">
        <span>পয়েন্টের নাম</span>
        <input type="text" name="points_label" value="<?= e(setting('points_label', 'পয়েন্ট')) ?>" maxlength="30">
      </label>
      <label class="field">
        <span>নোটিশ (হোমপেজে উপরে দেখাবে — খালি রাখলে কিছু দেখাবে না)</span>
        <input type="text" name="notice" value="<?= e(setting('notice', '')) ?>" maxlength="200">
      </label>
      <label class="field">
        <span>সাপোর্ট লিংক (টেলিগ্রাম/হোয়াটসঅ্যাপ)</span>
        <input type="text" name="support_link" value="<?= e(setting('support_link', '')) ?>" maxlength="200">
      </label>
      <label class="field">
        <span>ফুটার টেক্সট</span>
        <input type="text" name="footer_text" value="<?= e(setting('footer_text', '')) ?>" maxlength="200">
      </label>
      <label class="check">
        <input type="checkbox" name="bn_digits" <?= setting('bn_digits', '1') === '1' ? 'checked' : '' ?>>
        <span>সংখ্যা বাংলায় দেখাও (০১২৩…)</span>
      </label>
      <label class="check">
        <input type="checkbox" name="maintenance" <?= setting('maintenance', '0') === '1' ? 'checked' : '' ?>>
        <span>মেইনটেন্যান্স মোড (ইউজার অ্যাপ বন্ধ থাকবে, অ্যাডমিন চলবে)</span>
      </label>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>রিওয়ার্ড ও লিমিট</h2></div>
    <div class="stack">
      <div class="form-grid">
        <label class="field">
          <span>ডেইলি চেক-ইন পয়েন্ট</span>
          <input type="number" name="checkin_points" value="<?= e(setting('checkin_points', '10')) ?>" min="0">
        </label>
        <label class="field">
          <span>স্ট্রিক বোনাস (প্রতি দিন)</span>
          <input type="number" name="checkin_streak_bonus" value="<?= e(setting('checkin_streak_bonus', '5')) ?>" min="0">
        </label>
        <label class="field">
          <span>দিনে সর্বোচ্চ টাস্ক (০ = লিমিট নেই)</span>
          <input type="number" name="daily_task_limit" value="<?= e(setting('daily_task_limit', '20')) ?>" min="0">
        </label>
      </div>
      <p class="muted small">
        উদাহরণ: চেক-ইন ১০ + স্ট্রিক বোনাস ৫ হলে — ১ম দিন ১০, ২য় দিন ১৫, ৩য় দিন ২০…
        (সর্বোচ্চ ৭ দিন পর্যন্ত বোনাস ধরা হয়)
      </p>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>রেফারেল</h2></div>
    <div class="stack">
      <label class="check">
        <input type="checkbox" name="referral_enabled" <?= setting('referral_enabled', '0') === '1' ? 'checked' : '' ?>>
        <span>রেফারেল সিস্টেম চালু (ডিফল্ট বন্ধ)</span>
      </label>
      <label class="field">
        <span>কমিশন (%)</span>
        <input type="number" name="referral_commission" value="<?= e(setting('referral_commission', '10')) ?>" min="0" max="100">
      </label>
      <p class="muted small">চালু করলে প্রোফাইল পেজে ইউজারের রেফারেল লিংক দেখা যাবে।</p>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>টাকা / উইথড্র (ঐচ্ছিক)</h2></div>
    <div class="stack">
      <label class="check">
        <input type="checkbox" name="currency_enabled" <?= setting('currency_enabled', '0') === '1' ? 'checked' : '' ?>>
        <span>পয়েন্টের টাকা-মূল্য দেখাও</span>
      </label>
      <div class="form-grid">
        <label class="field">
          <span>কত পয়েন্ট = ১ একক</span>
          <input type="number" name="currency_rate" value="<?= e(setting('currency_rate', '100')) ?>" min="1">
        </label>
        <label class="field">
          <span>মুদ্রা চিহ্ন</span>
          <input type="text" name="currency_label" value="<?= e(setting('currency_label', '৳')) ?>" maxlength="5">
        </label>
        <label class="field">
          <span>সর্বনিম্ন উইথড্র (পয়েন্ট)</span>
          <input type="number" name="min_withdraw" value="<?= e(setting('min_withdraw', '5000')) ?>" min="0">
        </label>
      </div>
      <p class="muted small">
        আপনি "টাকা থাকবে না" বেছে নিয়েছেন, তাই এটি বন্ধ রাখাই ভালো।
        পরে দরকার হলে চালু করতে পারবেন।
      </p>
    </div>
  </section>

  <div class="panel">
    <button class="btn btn-primary btn-block btn-lg" type="submit">সব সেটিংস সেভ করুন</button>
  </div>
</form>

<section class="panel">
  <div class="panel-head"><h2>সিস্টেম তথ্য</h2></div>
  <div class="table-wrap">
    <table class="admin-table">
      <tbody>
        <tr><td>PHP ভার্সন</td><td class="muted"><?= e(PHP_VERSION) ?></td></tr>
        <tr><td>ডেটাবেস</td><td class="muted"><?= e(strtoupper((string) db()->getAttribute(PDO::ATTR_DRIVER_NAME))) ?></td></tr>
        <tr><td>সময় অঞ্চল</td><td class="muted"><?= e(date_default_timezone_get()) ?></td></tr>
        <tr><td>বর্তমান সময়</td><td class="muted"><?= e(date('d M Y, h:i A')) ?></td></tr>
        <tr><td>অ্যাপ ভার্সন</td><td class="muted">v<?= e(APP_VERSION) ?></td></tr>
      </tbody>
    </table>
  </div>
  <p class="muted small" style="margin-top:10px">
    ইনস্টল শেষ হলে <code>install.php</code> ফাইলটি ডিলিট করে দিন।
  </p>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
