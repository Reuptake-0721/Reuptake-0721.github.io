/* ============================================================
   jirai — 客户端交互
   移动端菜单 / 回到顶部 / 阅读进度 / 图片灯箱 / 鼠标星屑
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.__JIRAI__ || {};
  var doc = document;

  /* ---------- 移动端菜单 ---------- */
  var toggle = doc.getElementById('nav-toggle');
  var links = doc.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) links.classList.remove('open');
    });
  }

  /* ---------- 回到顶部 + 阅读进度 ---------- */
  var toTop = doc.getElementById('to-top');
  var progress = doc.getElementById('read-progress');
  var postBody = doc.getElementById('post-body');

  function onScroll() {
    var y = window.pageYOffset || doc.documentElement.scrollTop;
    if (toTop) toTop.classList.toggle('show', y > 420);

    if (progress && postBody) {
      var start = postBody.offsetTop;
      var total = postBody.offsetHeight - window.innerHeight * 0.6;
      var ratio = total > 0 ? (y - start + 120) / total : 0;
      ratio = Math.max(0, Math.min(1, ratio));
      progress.style.width = (ratio * 100).toFixed(2) + '%';
    }
  }

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();

  /* ---------- 图片灯箱 ---------- */
  if (postBody) {
    postBody.addEventListener('click', function (e) {
      var img = e.target.closest('img');
      if (!img) return;
      var mask = doc.createElement('div');
      mask.className = 'lb-mask';
      var big = doc.createElement('img');
      big.src = img.getAttribute('data-src') || img.src;
      big.alt = img.alt || '';
      mask.appendChild(big);
      doc.body.appendChild(mask);
      doc.body.style.overflow = 'hidden';
      var close = function () {
        mask.remove();
        doc.body.style.overflow = '';
        doc.removeEventListener('keydown', onKey);
      };
      var onKey = function (ev) { if (ev.key === 'Escape') close(); };
      mask.addEventListener('click', close);
      doc.addEventListener('keydown', onKey);
    });
  }

  /* ---------- 鼠标粉色星屑 ---------- */
  if (cfg.cursorGlitter) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var last = 0;
    if (!reduce && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
      window.addEventListener('mousemove', function (e) {
        var now = Date.now();
        if (now - last < 90) return;
        last = now;
        var s = doc.createElement('span');
        s.className = 'spark';
        s.style.left = (e.clientX - 3) + 'px';
        s.style.top = (e.clientY - 3) + 'px';
        var colors = ['#ff2d78', '#ff7ab8', '#a855f7'];
        s.style.background = colors[Math.floor(Math.random() * colors.length)];
        doc.body.appendChild(s);
        window.setTimeout(function () { s.remove(); }, 780);
      }, { passive: true });
    }
  }

  /* ---------- 锚点偏移修正（fixed 导航栏） ---------- */
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    var target = doc.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    var top = target.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: top, behavior: 'smooth' });
    history.replaceState(null, '', a.getAttribute('href'));
  });
})();
