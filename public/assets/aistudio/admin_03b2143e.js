/* Viral Video Pro — অ্যাডমিন ছোট স্ক্রিপ্ট */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // ফিল্টার ফরমে ড্রপডাউন বদলালেই সাবমিট হবে
    var selects = document.querySelectorAll('.filter-row select');
    for (var i = 0; i < selects.length; i++) {
      selects[i].addEventListener('change', function () {
        if (this.form) this.form.submit();
      });
    }

    // সংখ্যার ইনপুটে নেগেটিভ ভ্যালু হলে সতর্কবার্তা
    var nums = document.querySelectorAll('input[type="number"][min="0"]');
    for (var j = 0; j < nums.length; j++) {
      nums[j].addEventListener('change', function () {
        if (parseFloat(this.value) < 0) {
          this.value = 0;
          if (window.vvpToast) window.vvpToast('ঋণাত্মক সংখ্যা গ্রহণযোগ্য নয়', 'err');
        }
      });
    }
  });
})();
