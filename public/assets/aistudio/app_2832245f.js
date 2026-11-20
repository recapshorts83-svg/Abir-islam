/* ===============================================================
   Viral Video Pro — ফ্রন্টএন্ড স্ক্রিপ্ট
   =============================================================== */
(function () {
  'use strict';

  var BN = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

  function bn(str) {
    return String(str).replace(/[0-9]/g, function (d) {
      return BN[+d];
    });
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* ------------------------- টোস্ট ------------------------- */
  var toastEl = null;
  var toastTimer = null;

  function toast(message, type) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.className = 'toast is-show' + (type === 'ok' ? ' is-ok' : type === 'err' ? ' is-err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-show');
    }, 2600);
  }
  window.vvpToast = toast;

  /* ------------------------- কুলডাউন টেক্সট ------------------------- */
  function formatRemaining(seconds) {
    if (seconds <= 0) return 'এখনই করা যাবে';
    var d = Math.floor(seconds / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (d > 0) return bn(d) + ' দিন ' + bn(h) + ' ঘণ্টা পর';
    if (h > 0) return bn(h) + ' ঘণ্টা ' + bn(m) + ' মিনিট পর';
    if (m > 0) return bn(m) + ' মিনিট ' + bn(s) + ' সেকেন্ড পর';
    return bn(s) + ' সেকেন্ড পর';
  }

  function tickCountdowns() {
    var nodes = document.querySelectorAll('[data-countdown]');
    if (!nodes.length) return;

    var now = Math.floor(Date.now() / 1000);

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var target = parseInt(el.getAttribute('data-countdown'), 10) || 0;
      var left = target - now;

      if (left <= 0) {
        el.textContent = 'এখনই করা যাবে';
        el.classList.remove('wait-text');
        continue;
      }

      if (el.classList.contains('big-countdown')) {
        el.textContent = formatRemaining(left);
      } else {
        el.textContent = formatRemaining(left);
      }
    }
  }

  /* ------------------------- ভিডিও টাইমার ------------------------- */
  function initWatchTimer() {
    var box = document.getElementById('watchBox');
    var btn = document.getElementById('claimBtn');
    if (!box || !btn) return;

    var total = parseInt(box.getAttribute('data-remaining'), 10) || 10;
    var left = total;
    var textEl = document.getElementById('timerText');
    var hintEl = document.getElementById('timerHint');
    var ringEl = box.querySelector('.timer-ring');
    var done = false;

    function paint() {
      var ratio = total > 0 ? (total - left) / total : 1;
      if (ringEl) {
        ringEl.style.setProperty('--deg', Math.round(ratio * 360) + 'deg');
      }
      if (textEl) {
        textEl.textContent = bn(left);
      }
    }

    paint();

    var timer = setInterval(function () {
      left -= 1;

      if (left <= 0) {
        clearInterval(timer);
        if (textEl) textEl.textContent = '০';
        if (ringEl) ringEl.style.setProperty('--deg', '360deg');
        if (hintEl) hintEl.textContent = 'সময় শেষ — এখন ক্লেইম করুন ✓';
        btn.disabled = false;
        done = true;
        toast('ভিডিও দেখার সময় শেষ, ক্লেইম করতে পারেন', 'ok');
        return;
      }

      paint();
    }, 1000);

    /* --------------------- ক্লেইম --------------------- */
    btn.addEventListener('click', function () {
      if (!done) {
        toast('আগে ভিডিওটি দেখুন', 'err');
        return;
      }

      var taskId = btn.getAttribute('data-task');
      var token = btn.getAttribute('data-csrf');
      var msgEl = document.getElementById('claimMsg');

      btn.disabled = true;
      btn.textContent = 'যাচাই হচ্ছে…';

      var body = new URLSearchParams();
      body.append('task_id', taskId);
      body.append('_csrf', token);

      fetch('claim.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'same-origin',
        body: body.toString()
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { status: res.status, data: data };
          });
        })
        .then(function (out) {
          var data = out.data || {};
          if (data.ok) {
            btn.textContent = '✓ সম্পন্ন';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-disabled');
            if (msgEl) msgEl.textContent = data.message;
            toast(data.message, 'ok');

            var pill = document.querySelector('.topbar .pill');
            if (pill && typeof data.points === 'number') {
              pill.textContent = bn(data.points.toLocaleString('en-US')) + ' পয়েন্ট';
            }

            setTimeout(function () {
              window.location.href = 'tasks.php';
            }, 1400);
          } else {
            btn.disabled = false;
            btn.textContent = 'ক্লেইম করুন';
            if (msgEl) msgEl.textContent = data.message || '';
            toast(data.message || 'সমস্যা হয়েছে', 'err');
            if (data.redirect) {
              setTimeout(function () {
                window.location.href = data.redirect;
              }, 1500);
            }
          }
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'ক্লেইম করুন';
          toast('নেটওয়ার্ক সমস্যা, আবার চেষ্টা করুন', 'err');
        });
    });
  }

  /* ------------------------- কপি বাটন ------------------------- */
  function initCopy() {
    var buttons = document.querySelectorAll('[data-copy]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        var sel = this.getAttribute('data-copy');
        var input = document.querySelector(sel);
        if (!input) return;

        var text = input.value;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            toast('কপি হয়েছে', 'ok');
          });
        } else {
          input.select();
          document.execCommand('copy');
          toast('কপি হয়েছে', 'ok');
        }
      });
    }
  }

  /* ------------------------- ফ্ল্যাশ মেসেজ ------------------------- */
  function initFlashes() {
    var items = document.querySelectorAll('.flash-stack .alert');
    if (!items.length) return;
    setTimeout(function () {
      for (var i = 0; i < items.length; i++) {
        items[i].style.transition = 'opacity .4s ease';
        items[i].style.opacity = '0';
      }
    }, 5000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    tickCountdowns();
    setInterval(tickCountdowns, 1000);
    initWatchTimer();
    initCopy();
    initFlashes();
  });
})();
