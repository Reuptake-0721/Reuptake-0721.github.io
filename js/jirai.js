/* ============================================================
   jirai — 客户端交互
   移动端菜单 / 回到顶部 / 阅读进度 / 图片灯箱 / 鼠标星屑
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.__JIRAI__ || {};
  var doc = document;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 移动端菜单 ---------- */
  var toggle = doc.getElementById('nav-toggle');
  var links = doc.getElementById('nav-links');
  if (toggle && links) {
    function setMenu(open, focus) {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
      if (focus) toggle.focus({preventScroll: true});
    }
    toggle.addEventListener('click', function () {
      setMenu(!links.classList.contains('open'));
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        setMenu(false);
      }
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('open')) {
        setMenu(false, true);
      }
    });
    doc.addEventListener('click', function (e) {
      if (links.classList.contains('open') && !e.target.closest('#site-nav')) setMenu(false);
    });
    window.matchMedia('(max-width: 980px)').addEventListener('change', function () { setMenu(false); });
  }

  /* ---------- 回到顶部 + 阅读进度 ---------- */
  var toTop = doc.getElementById('to-top');
  var progress = doc.getElementById('read-progress');
  var postBody = doc.getElementById('post-body');

  function onScroll() {
    var y = window.pageYOffset || doc.documentElement.scrollTop;
    if (toTop) toTop.classList.toggle('show', y > 420);

    if (progress && postBody) {
      var start = postBody.getBoundingClientRect().top + y;
      var total = postBody.offsetHeight - window.innerHeight * 0.6;
      var ratio = total > 0 ? (y - start + 120) / total : 0;
      ratio = Math.max(0, Math.min(1, ratio));
      progress.style.width = (ratio * 100).toFixed(2) + '%';
    }
  }

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'instant' : 'smooth' });
    });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', onScroll, {passive: true});
  onScroll();

  /* ---------- 图片灯箱 ---------- */
  if (postBody) {
    function preview(img) {
      if (!img || img.closest('a') || img.classList.contains('inline-ico') || doc.querySelector('.lb-mask')) return;
      var readingX = window.scrollX, readingY = window.scrollY;
      var mask = doc.createElement('dialog');
      mask.className = 'lb-mask';
      mask.setAttribute('aria-label', '图片预览');
      var big = doc.createElement('img');
      big.src = img.getAttribute('data-src') || img.src;
      big.alt = img.alt || '';
      var button = doc.createElement('button');
      button.type = 'button'; button.className = 'lb-close'; button.textContent = '×';
      button.setAttribute('aria-label', '关闭图片预览');
      var hint = doc.createElement('span');
      hint.className = 'lb-hint'; hint.textContent = '点击空白处或按 Esc 关闭';
      mask.append(button, big, hint);
      var overflow = doc.body.style.overflow;
      doc.body.appendChild(mask);
      mask.showModal();
      doc.body.style.overflow = 'hidden';
      var closing = false;
      function close() {
        if (closing) return;
        closing = true; mask.classList.add('is-closing');
        setTimeout(function () {
          mask.close(); mask.remove(); doc.body.style.overflow = overflow;
          img.focus({preventScroll: true});
          window.scrollTo({left: readingX, top: readingY, behavior: 'instant'});
        }, reduce.matches ? 0 : 140);
      }
      mask.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
      mask.addEventListener('keydown', function (e) { e.stopPropagation(); });
      mask.addEventListener('click', function (e) { if (e.target !== big) close(); });
      button.focus({preventScroll: true});
    }
    postBody.querySelectorAll('img').forEach(function (img) {
      if (img.closest('a') || img.classList.contains('inline-ico')) return;
      img.tabIndex = 0; img.setAttribute('role', 'button');
      img.setAttribute('aria-label', '放大图片' + (img.alt ? '：' + img.alt : ''));
    });
    postBody.addEventListener('click', function (e) { preview(e.target.closest('img')); });
    postBody.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'IMG' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); e.stopPropagation(); preview(e.target);
      }
    });
  }

  /* ---------- 鼠标粉色星屑 ---------- */
  if (cfg.cursorGlitter) {
    var glitterReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var last = 0;
    if (!glitterReduce && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
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
    var id = a.getAttribute('href').slice(1);
    try { id = decodeURIComponent(id); } catch (err) { /* 保留原始锚点 */ }
    var target = doc.getElementById(id);
    if (!target) return;
    e.preventDefault();
    var nav = doc.getElementById('site-nav');
    var top = target.getBoundingClientRect().top + window.pageYOffset - (nav ? nav.offsetHeight + 24 : 24);
    window.scrollTo({ top: top, behavior: reduce.matches ? 'instant' : 'smooth' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({preventScroll: true});
    history.replaceState(null, '', a.getAttribute('href'));
  });
})();
