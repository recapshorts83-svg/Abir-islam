  </main>

  <nav class="tabbar">
    <?php
    $tabs = [
        ['key' => 'home',        'label' => 'হোম',          'href' => url('index.php'),       'icon' => '⌂'],
        ['key' => 'tasks',       'label' => 'টাস্ক',         'href' => url('tasks.php'),       'icon' => '▶'],
        ['key' => 'leaderboard', 'label' => 'লিডারবোর্ড',    'href' => url('leaderboard.php'), 'icon' => '★'],
        ['key' => 'profile',     'label' => 'প্রোফাইল',      'href' => url('profile.php'),     'icon' => '☺'],
    ];
    foreach ($tabs as $tab):
        $isActive = ($ACTIVE ?? '') === $tab['key'];
        ?>
      <a class="tab <?= $isActive ? 'is-active' : '' ?>" href="<?= e($tab['href']) ?>">
        <span class="tab-icon"><?= $tab['icon'] ?></span>
        <span class="tab-label"><?= e($tab['label']) ?></span>
      </a>
    <?php endforeach; ?>
  </nav>

</div><!-- /app-shell -->

<script src="<?= e(url('assets/js/app.js')) ?>"></script>
</body>
</html>
