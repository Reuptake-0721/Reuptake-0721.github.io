/* ============================================================
   jirai-texture — 質感層客戶端
   心電監護條插入 / 朱印多態 / 墨滲 / 網紋開關
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.__JIRAI__ || {};
  var doc = document;
  var body = doc.body;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------- 複寫紙網紋 */
  if (cfg.crosshatch) body.classList.add('crosshatch');
  if (cfg.bandageHr) body.classList.add('bandage-hr');

  /* ---------------------------------------------- 心電監護條 */
  (function ecg() {
    var tpl = doc.getElementById('jirai-ecg-tpl');
    var postBody = doc.getElementById('post-body');
    if (!tpl || !postBody || !cfg.ecg) return;

    var heads = [].slice.call(postBody.querySelectorAll('h2, h3'));
    if (heads.length < 2) return;

    /* 每隔 2 個標題插一條，且不插在最後一個標題之後 */
    var made = 0;
    heads.forEach(function (h, i) {
      if (i === 0 || i % 2 !== 0) return;
      if (i >= heads.length - 1) return;
      var node = tpl.content.firstElementChild.cloneNode(true);
      h.parentNode.insertBefore(node, h);
      made++;
    });
    if (!made) return;

    /* 進入視窗才開始跑動畫，省電 */
    if ('IntersectionObserver' in window) {
      var strips = [].slice.call(doc.querySelectorAll('.ecg-strip svg'));
      strips.forEach(function (svg) { svg.style.animationPlayState = 'paused'; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var svg = e.target.querySelector('svg');
          if (svg) svg.style.animationPlayState = e.isIntersecting ? 'running' : 'paused';
        });
      }, { rootMargin: '80px' });
      [].slice.call(doc.querySelectorAll('.ecg-strip')).forEach(function (s) { io.observe(s); });
    }
  })();

  /* ---------------------------------------------- 朱印多態 */
  (function seal() {
    if (!cfg.seal) return;
    var seal = doc.querySelector('.seal-mark');
    if (!seal) return;

    /* 已自帶狀態的頁面（例如 404 的「未編目」）不覆蓋 */
    if (seal.classList.contains('seal-fixed')) return;

    var title = (doc.querySelector('.dossier h1') || {}).textContent || '';
    var bodyText = (doc.getElementById('post-body') || {}).textContent || '';
    var hasUnfinished = !!doc.querySelector('.unfinished');

    /* 條件優先：未完 > 短篇 > 日常 > 長篇 > 預設 */
    var variant = '已閱';
    var sub = '';
    if (hasUnfinished) {
      variant = '未完';
      sub = '未校';
      seal.classList.add('seal-draft');
    } else if (bodyText.length < 220) {
      variant = '斷片';
      sub = '残';
    } else if (title.indexOf('日常') > -1 || title.indexOf('切片') > -1) {
      variant = '閱畢';
      sub = '抄錄';
    } else if (bodyText.length > 4000) {
      variant = '封存';
      sub = '密';
      seal.classList.add('seal-private');
    }

    var status = seal.querySelector('.seal-status');
    if (status) status.textContent = variant;

    if (sub) {
      var s = doc.createElement('span');
      s.className = 'seal-sub';
      s.textContent = sub;
      seal.appendChild(s);
    }
  })();

  /* ---------------------------------------------- 標題墨滲 */
  (function ink() {
    if (reduce) return;
    var targets = [].slice.call(doc.querySelectorAll('.dossier h1, .ch-title, .cabinet-head .ch-title'));

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('show');
          io.unobserve(e.target);
        });
      }, { rootMargin: '-40px' });
      targets.forEach(function (t) { io.observe(t); });
    } else {
      targets.forEach(function (t) { t.classList.add('show'); });
    }
  })();

  /* ---------------------------------------------- 側帶：隨捲動淡入淡出 */
  (function sideTab() {
    var tab = doc.querySelector('.sidetab');
    if (!tab) return;
    tab.style.transition = 'opacity .5s ease';
    var idle = null;
    function show() {
      tab.style.opacity = '1';
      clearTimeout(idle);
      idle = setTimeout(function () { tab.style.opacity = '.35'; }, 2200);
    }
    window.addEventListener('scroll', show, { passive: true });
    show();
  })();

  /* ---------------------------------------------- 列印 / 無障礙開關 */
  if (cfg.textureOff) {
    ['laceframe', 'sidetab', 'ecg-strip'].forEach(function (cls) {
      [].slice.call(doc.querySelectorAll('.' + cls)).forEach(function (n) { n.remove(); });
    });
    body.classList.remove('crosshatch', 'bandage-hr');
  }
})();
