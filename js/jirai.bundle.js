/* ===== jirai-variant.js ===== */
/* ============================================================
   jirai-variant — 簡體 / 繁體（異體）即時切換
   在 DOM 文字節點上做逐字替換，可逆；偏好存 localStorage
   ============================================================ */
(function () {
  'use strict';

  var btn = document.getElementById('jirai-variant');
  var dataEl = document.getElementById('jirai-variant-map');
  if (!btn || !dataEl) return;

  var MAP;
  try { MAP = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!MAP || !MAP.c) return;

  var KEY = 'jirai-variant';
  var S2T = MAP.c;
  var PHRASES = MAP.p || {};

  /* --- 反查表（繁 → 簡），詞組優先、長度倒序 --- */
  var T2S_CHAR = {};
  Object.keys(S2T).forEach(function (k) {
    var v = S2T[k];
    if (!T2S_CHAR[v]) T2S_CHAR[v] = k;      /* 一對多時取第一個，足夠還原本站用字 */
  });
  var T2S_PHRASE = {};
  Object.keys(PHRASES).forEach(function (k) {
    var v = PHRASES[k];
    if (!T2S_PHRASE[v]) T2S_PHRASE[v] = k;
  });

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, KBD: 1, SAMP: 1 };

  function convert(text, phraseMap, charMap) {
    if (!text) return text;
    var keys = Object.keys(phraseMap).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k !== phraseMap[k] && text.indexOf(k) > -1) text = text.split(k).join(phraseMap[k]);
    }
    return text.replace(/[\u4e00-\u9fa5]/g, function (ch) { return charMap[ch] || ch; });
  }

  /* 收集原始文字（只做一次） */
  var store = [];
  function collect() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !/[\u4e00-\u9fa5]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        while (p && p !== document.body) {
          if (SKIP[p.nodeName] || (p.hasAttribute && p.hasAttribute('data-no-variant'))) {
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) store.push({ node: n, raw: n.nodeValue });
  }

  var applied = false;
  function apply(on) {
    if (on === applied) return;
    if (!store.length) collect();

    document.body.classList.add('variant-flash');
    setTimeout(function () { document.body.classList.remove('variant-flash'); }, 460);

    for (var i = 0; i < store.length; i++) {
      var item = store[i];
      if (!item.node.parentNode) continue;   /* 已被移除的節點跳過 */
      item.node.nodeValue = on
        ? convert(item.raw, PHRASES, S2T)
        : convert(item.raw, T2S_PHRASE, T2S_CHAR);
    }

    applied = on;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    document.documentElement.setAttribute('lang', on ? 'zh-Hant' : 'zh-Hans');
    try { window.localStorage.setItem(KEY, on ? 't' : 's'); } catch (e) { /* 忽略 */ }
  }

  var stored = null;
  try { stored = window.localStorage.getItem(KEY); } catch (e) { stored = null; }

  btn.addEventListener('click', function () { apply(!applied); });

  /* 快捷鍵切換 */
  document.addEventListener('keydown', function (e) {
    if (e.target !== document.body) return;
    if (e.altKey && (e.key === 'v' || e.key === 'V' || e.code === 'KeyV')) {
      e.preventDefault();
      apply(!applied);
    }
  });

  if (stored === 't') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { apply(true); });
    } else {
      apply(true);
    }
  }
})();
;
/* ===== jirai.js ===== */
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
;
/* ===== jirai-deco.js ===== */
/* ============================================================
   jirai-deco — 客户端装饰交互
   医疗十字光标 / 阅读 HUD / 吐司提示 / 心跳揭示 / 卡片星屑
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.__JIRAI__ || {};
  var doc = document;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------------------------------------- 医疗十字光标 */
  if (cfg.medCross && fine && !reduce) {
    var cur = doc.getElementById('med-cursor');
    if (cur) {
      var cx = -100, cy = -100, tx = -100, ty = -100, hot = false, raf = null;

      var loop = function () {
        cx += (tx - cx) * 0.2;
        cy += (ty - cy) * 0.2;
        cur.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
        if (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) {
          raf = requestAnimationFrame(loop);
        } else {
          raf = null;
        }
      };

      doc.addEventListener('mousemove', function (e) {
        tx = e.clientX; ty = e.clientY;
        cur.classList.add('on');
        if (!raf) raf = requestAnimationFrame(loop);
      }, { passive: true });

      doc.addEventListener('mouseleave', function () { cur.classList.remove('on'); });

      /* 悬停到可点区域时放大旋转 */
      doc.addEventListener('mouseover', function (e) {
        var hit = e.target.closest('a, button, summary, .tag-chip, .term, .card-title');
        if (hit && !hot) { hot = true; cur.classList.add('hot'); }
        else if (!hit && hot) { hot = false; cur.classList.remove('hot'); }
      }, { passive: true });

      /* 点击时来一次十字闪光 */
      doc.addEventListener('click', function (e) {
        if (!fine) return;
        cur.style.color = '#fff';
        setTimeout(function () { cur.style.color = ''; }, 140);
      });
    }
  }

  /* ---------------------------------------------- 阅读 HUD + 进度 */
  if (cfg.hud) {
    var pctEl = doc.getElementById('hud-pct');
    var fillEl = doc.getElementById('hud-fill');
    var postBody = doc.getElementById('post-body');
    var deco = doc.querySelector('.heart-beat');

    var update = function () {
      var y = window.pageYOffset || doc.documentElement.scrollTop;
      var docH = doc.documentElement.scrollHeight - window.innerHeight;
      var ratio = docH > 0 ? y / docH : 0;

      /* 文章页用正文区间计算，更贴近“读了多少” */
      if (postBody && postBody.offsetHeight > window.innerHeight) {
        var start = postBody.offsetTop - 80;
        var span = postBody.offsetHeight - window.innerHeight * 0.5;
        ratio = span > 0 ? (y - start) / span : 0;
      }
      ratio = Math.max(0, Math.min(1, ratio));
      var pct = Math.round(ratio * 100);

      if (pctEl) pctEl.textContent = pct;
      if (fillEl) fillEl.style.height = (ratio * 100).toFixed(1) + '%';

      /* 到达底部时心跳一下 */
      if (deco && ratio > 0.985 && !deco.classList.contains('reveal')) {
        deco.classList.add('reveal');
      }
    };

    var queued = false;
    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { update(); queued = false; });
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ---------------------------------------------- 吐司提示 */
  if (cfg.toast) {
    var toast = doc.getElementById('jirai-toast');
    if (toast) {
      var once = toast.getAttribute('data-once') !== 'false';
      var KEY = 'jirai-toast-seen';
      var seen = false;
      try { seen = once && window.localStorage.getItem(KEY) === '1'; } catch (err) { seen = false; }

      var hide = function () {
        toast.classList.remove('show');
        try { window.localStorage.setItem(KEY, '1'); } catch (err) { /* 忽略隐私模式报错 */ }
      };

      if (!seen) {
        setTimeout(function () { toast.classList.add('show'); }, 1400);
        var timer = setTimeout(hide, 9000);
        var x = doc.getElementById('toast-x');
        if (x) {
          x.addEventListener('click', function () {
            clearTimeout(timer);
            hide();
          });
        }
      } else {
        toast.remove();
      }
    }
  }

  /* ---------------------------------------------- 卡片星屑点击爆点 */
  if (!reduce) {
    doc.addEventListener('click', function (e) {
      var card = e.target.closest('.card');
      if (!card || e.target.closest('a, button')) return;
      for (var i = 0; i < 7; i++) {
        (function (i) {
          var s = doc.createElement('span');
          s.className = 'spark';
          var angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.6;
          var dist = 26 + Math.random() * 34;
          s.style.left = (e.clientX - 3) + 'px';
          s.style.top = (e.clientY - 3) + 'px';
          s.style.background = i % 2 ? '#a855f7' : '#ff2d78';
          s.style.animation = 'none';
          s.style.transition = 'transform .6s cubic-bezier(.2,.8,.3,1), opacity .6s ease';
          doc.body.appendChild(s);
          requestAnimationFrame(function () {
            s.style.transform = 'translate(' + (Math.cos(angle) * dist).toFixed(1) + 'px,'
                              + (Math.sin(angle) * dist).toFixed(1) + 'px) scale(.3) rotate(160deg)';
            s.style.opacity = '0';
          });
          setTimeout(function () { s.remove(); }, 700);
        })(i);
      }
    });
  }

  /* ---------------------------------------------- 卡片四角十字标记
     與蕾絲畫框、卡片左側霓虹條、懸停星屑功能重疊，預設關閉；
     需要時把 window.__JIRAI__.cornerMarks 設為 true 再開。 */
  if (cfg.cornerMarks && !reduce) {
    var marks = ['tl', 'tr', 'bl', 'br'];
    doc.querySelectorAll('.card, .widget, .term').forEach(function (el) {
      if (el.dataset.cornered) return;
      el.dataset.cornered = '1';
      marks.forEach(function (pos) {
        var s = doc.createElement('span');
        s.className = 'corner-mark ' + pos;
        s.setAttribute('aria-hidden', 'true');
        el.appendChild(s);
      });
    });
  }

  /* ---------------------------------------------- 名字心意彩蛋 */
  var nameEl = doc.querySelector('.profile .name');
  if (nameEl && !reduce) {
    var glyphs = ['♥', '♡', '✚', '†', '★'];
    nameEl.setAttribute('title', '点我一下？');
    nameEl.addEventListener('click', function (e) {
      nameEl.classList.remove('tapped');
      void nameEl.offsetWidth;
      nameEl.classList.add('tapped');

      for (var i = 0; i < 6; i++) {
        var h = doc.createElement('span');
        h.className = 'name-heart';
        h.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
        h.style.left = (e.clientX - 7 + (Math.random() * 26 - 13)) + 'px';
        h.style.top = (e.clientY - 10) + 'px';
        h.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(0) + 'px');
        h.style.setProperty('--rot', (Math.random() * 90 - 45).toFixed(0) + 'deg');
        h.style.animationDelay = (i * 70) + 'ms';
        doc.body.appendChild(h);
        (function (node) {
          setTimeout(function () { node.remove(); }, 1800 + i * 70);
        })(h);
      }
    });
  }

  /* ---------------------------------------------- 缎带暂停（长按） */
  var ribbon = doc.querySelector('.ribbon-track');
  if (ribbon) {
    ribbon.addEventListener('mouseenter', function () { ribbon.style.animationPlayState = 'paused'; });
    ribbon.addEventListener('mouseleave', function () { ribbon.style.animationPlayState = 'running'; });
  }
})();
;
/* ===== jirai-boom.js ===== */
/* ============================================================
   jirai-boom — 震撼层客户端
   开机自检 / 粒子画布 / 章节导航轨 / 氛围音 / 危险区反馈
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.__JIRAI__ || {};
  var doc = document;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ============================================================
     1. 开机自检动画
     ============================================================ */
  (function boot() {
    if (!cfg.boot) return;
    var el = doc.getElementById('jirai-boot');
    if (!el) return;

    var KEY = 'jirai-booted';
    var minMs = Number(el.getAttribute('data-min-ms')) || 1800;

    function hideNow() {
      el.classList.add('mask-hide');
      doc.documentElement.classList.add('boot-skip');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 620);
    }

    /* 已播过（同会话）→ 直接移除，不做任何动画 */
    var seen = false;
    try { seen = window.sessionStorage.getItem(KEY) === '1'; } catch (err) { seen = false; }
    if (seen) { hideNow(); return; }
    try { window.sessionStorage.setItem(KEY, '1'); } catch (err) { /* 忽略 */ }

    var lines = [].slice.call(el.querySelectorAll('.boot-line'));
    var fill = doc.getElementById('boot-fill');
    var pctEl = doc.getElementById('boot-pct');
    var finish = doc.getElementById('boot-finish');
    var skipBtn = doc.getElementById('boot-skip');

    /* 逐行打字机上屏，行里有 FAILED / WARNING 的标记成异常色 */
    var start = Date.now();
    var perLine = Math.max(120, Math.min(320, minMs / (lines.length + 1)));

    function markKind(node) {
      var t = (node.textContent || '').toUpperCase();
      if (t.indexOf('FAIL') > -1 || t.indexOf('ERROR') > -1) node.classList.add('bad');
      else if (t.indexOf('WARN') > -1 || t.indexOf('FOUND') > -1) node.classList.add('warn');
    }

    lines.forEach(function (node, i) {
      markKind(node);
      setTimeout(function () { node.classList.add('show'); }, 130 + i * perLine);
    });

    /* 进度条：用 rAF 平滑推进，保证在 minMs 内跑完 */
    var raf = null;
    var done = false;

    function tick() {
      var t = Math.min(1, (Date.now() - start) / minMs);
      var eased = t < 0.85 ? t : 0.85 + (t - 0.85) * 4;  /* 末尾假装卡顿再冲线 */
      var pct = Math.min(100, Math.round(Math.min(1, eased) * 100));
      if (fill) fill.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct;
      if (t >= 1) { complete(); return; }
      raf = requestAnimationFrame(tick);
    }

    var finished = false;
    function complete() {
      if (finished) return;
      finished = true;
      if (raf) cancelAnimationFrame(raf);
      if (fill) fill.style.width = '100%';
      if (pctEl) pctEl.textContent = '100';
      if (finish) finish.classList.add('show');

      setTimeout(function () {
        el.classList.add('flash');
        el.classList.add('open');
        setTimeout(hideNow, 900);
      }, 380);
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        start = Date.now() - minMs;
        complete();
      });
    }
    el.addEventListener('click', function () {
      start = Date.now() - minMs;
      complete();
    });

    if (reduce) { hideNow(); return; }
    raf = requestAnimationFrame(tick);
  })();

  /* ============================================================
     2. 全屏粒子星屑画布
     ============================================================ */
  (function particles() {
    if (!cfg.particles || reduce) return;
    var cv = doc.getElementById('jirai-particles');
    if (!cv || !cv.getContext) return;

    var ctx = cv.getContext('2d');
    var DPR = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0;

    var COUNT = Number(cv.getAttribute('data-count')) || 70;
    var TRAIL_ON = cv.getAttribute('data-trail') !== 'false';
    var TRAIL_MAX = Number(cv.getAttribute('data-trail-max')) || 26;
    var LINK = Number(cv.getAttribute('data-link')) || 0;
    var GRAV = parseFloat(cv.getAttribute('data-gravity'));
    if (!isFinite(GRAV)) GRAV = -0.012;

    var PALETTE = ['#ff2d78', '#ff7ab8', '#a855f7', '#ffffff', '#c9124f'];
    var dust = [];    /* 漂浮粒子 */
    var trail = [];   /* 鼠标拖尾 */

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.floor(W * DPR);
      cv.height = Math.floor(H * DPR);
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function seedDust() {
      dust = [];
      var n = W < 760 ? Math.round(COUNT * 0.55) : COUNT;
      for (var i = 0; i < n; i++) {
        dust.push({
          x: rnd(0, W), y: rnd(0, H),
          vx: rnd(-0.16, 0.16), vy: rnd(-0.28, -0.04),
          r: rnd(0.6, 2.1),
          life: rnd(0.25, 0.85),
          c: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          ph: rnd(0, Math.PI * 2)
        });
      }
    }

    /* 星形路径：jirai 的四角星 */
    function star(x, y, r, rot, alpha, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.22, -r * 0.22, r, 0);
      ctx.quadraticCurveTo(r * 0.22, r * 0.22, 0, r);
      ctx.quadraticCurveTo(-r * 0.22, r * 0.22, -r, 0);
      ctx.quadraticCurveTo(-r * 0.22, -r * 0.22, 0, -r);
      ctx.fill();
      ctx.restore();
    }

    var t = 0;
    function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);

      /* 漂尘 */
      for (var i = 0; i < dust.length; i++) {
        var p = dust[i];
        p.x += p.vx + Math.sin(t + p.ph) * 0.14;
        p.y += p.vy + GRAV * 60 * 0.016;
        p.vy += GRAV * 0.4;

        if (p.y < -12) { p.y = H + 10; p.x = rnd(0, W); p.vy = rnd(-0.28, -0.04); }
        if (p.x < -12) p.x = W + 10;
        if (p.x > W + 12) p.x = -10;

        var tw = 0.55 + Math.sin(t * 1.7 + p.ph) * 0.45;
        star(p.x, p.y, p.r, t * 0.4 + p.ph, p.life * tw, p.c);
      }

      /* 拖尾 */
      if (LINK === 0) { /* 连线关闭时不做 O(n^2) 计算 */ }
      if (LINK > 0) {
        for (var a = 0; a < trail.length; a++) {
          for (var b = a + 1; b < trail.length; b++) {
            var dx = trail[a].x - trail[b].x, dy = trail[a].y - trail[b].y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < LINK) {
              ctx.globalAlpha = (1 - d / LINK) * 0.18;
              ctx.strokeStyle = '#ff2d78';
              ctx.lineWidth = 0.7;
              ctx.beginPath();
              ctx.moveTo(trail[a].x, trail[a].y);
              ctx.lineTo(trail[b].x, trail[b].y);
              ctx.stroke();
            }
          }
        }
      }

      for (var k = trail.length - 1; k >= 0; k--) {
        var q = trail[k];
        q.x += q.vx; q.y += q.vy;
        q.vy += 0.02;
        q.vx *= 0.985;
        q.life -= 0.022;
        if (q.life <= 0) { trail.splice(k, 1); continue; }
        star(q.x, q.y, q.r * (0.4 + q.life), q.rot + t, q.life * 0.9, q.c);
      }

      requestAnimationFrame(frame);
    }

    if (TRAIL_ON && fine) {
      var lastT = 0;
      window.addEventListener('mousemove', function (e) {
        var now = performance.now();
        if (now - lastT < 22) return;
        lastT = now;
        if (trail.length > TRAIL_MAX) trail.shift();
        trail.push({
          x: e.clientX + rnd(-3, 3),
          y: e.clientY + rnd(-3, 3),
          vx: rnd(-0.7, 0.7),
          vy: rnd(-0.5, 0.9),
          r: rnd(1.2, 3),
          rot: rnd(0, 1),
          life: 1,
          c: PALETTE[Math.floor(Math.random() * 3)]
        });
      }, { passive: true });
    }

    var rt = null;
    window.addEventListener('resize', function () {
      if (rt) clearTimeout(rt);
      rt = setTimeout(function () { resize(); seedDust(); }, 180);
    }, { passive: true });

    /* 页面不可见时暂停，省电 */
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { clearTimeout(rt); }
    });

    resize();
    seedDust();
    requestAnimationFrame(frame);
  })();

  /* ============================================================
     3. 章节导航轨
     ============================================================ */
  (function rail() {
    var rail = doc.getElementById('jirai-rail');
    var list = doc.getElementById('rail-list');
    if (!rail || !list || !cfg.rail) return;

    var body = doc.getElementById('post-body');
    if (!body) { rail.remove(); return; }

    var heads = [].slice.call(body.querySelectorAll('h2, h3')).filter(function (h) {
      return h.textContent.trim().length > 0;
    });
    var minH = Number(rail.getAttribute('data-min')) || 3;
    if (heads.length < minH) { rail.remove(); return; }

    heads.forEach(function (h, i) {
      if (!h.id) h.id = 'jirai-h-' + i;
    });

    var items = heads.map(function (h) {
      var li = doc.createElement('li');
      var lvl = h.tagName === 'H3' ? 'lvl-3' : 'lvl-2';
      li.className = 'rail-item ' + lvl;
      var a = doc.createElement('a');
      a.href = '#' + h.id;

      var txt = doc.createElement('span');
      txt.className = 'rail-txt';
      var raw = h.textContent.trim();
      txt.textContent = raw.length > 18 ? raw.slice(0, 18) + '…' : raw;

      var dot = doc.createElement('span');
      dot.className = 'rail-dot';

      a.appendChild(txt);
      a.appendChild(dot);
      li.appendChild(a);
      list.appendChild(li);
      return { li: li, head: h };
    });

    /* 有导航轨就不再显示滚动 HUD，避免右侧信息打架 */
    doc.body.classList.add('has-rail');

    /* 点击平滑滚动（修正固定导航高度） */
    list.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      var target = doc.getElementById(a.getAttribute('href').slice(1));
      if (!target) return;
      var top = target.getBoundingClientRect().top + window.pageYOffset - 92;
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
    });

    /* 高亮：取当前视口内最靠上的标题 */
    var active = -1;
    function sync() {
      var y = window.pageYOffset + 150;
      var idx = 0;
      for (var i = 0; i < items.length; i++) {
        if (items[i].head.getBoundingClientRect().top + window.pageYOffset <= y) idx = i;
        else break;
      }
      if (idx === active) return;
      active = idx;
      items.forEach(function (it, i) { it.li.classList.toggle('active', i === idx); });
    }

    var queued = false;
    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { sync(); queued = false; });
    }, { passive: true });

    sync();
  })();

  /* ============================================================
     4. 氛围音（Web Audio 合成，无音频文件）
     ============================================================ */
  (function ambient() {
    var btn = doc.getElementById('jirai-ambient');
    if (!btn || !cfg.ambient) return;

    var VOLUME = parseFloat(btn.getAttribute('data-volume'));
    if (!isFinite(VOLUME)) VOLUME = 0.16;
    var STYLE = btn.getAttribute('data-style') || 'music-box';
    var BPM = Number(btn.getAttribute('data-bpm')) || 52;
    var AUTOPLAY = btn.getAttribute('data-autoplay') === 'true';
    var KEY = 'jirai-ambient';

    var ac = null, master = null, verb = null, send = null, timer = null, step = 0;
    var running = false;

    /* 八音盒式音阶（A 小调五声，带一点忧郁感） */
    var SCALE = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];
    var PROG = [
      [0, 2, 4, 6], [1, 3, 5, 7], [0, 2, 4, 5], [3, 1, 4, 2]
    ];

    function buildReverb() {
      var len = Math.floor(ac.sampleRate * 2.6);
      var buf = ac.createBuffer(2, len, ac.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch);
        for (var i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        }
      }
      var conv = ac.createConvolver();
      conv.buffer = buf;
      return conv;
    }

    function init() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);

      verb = buildReverb();
      verb.connect(master);
      send = ac.createGain();
      send.gain.value = 0.5;
      send.connect(verb);
      return true;
    }

    /* 单音：正弦 + 五度泛音 + 指数衰减 */
    function pluck(freq, when, gain, dur) {
      var o1 = ac.createOscillator();
      var o2 = ac.createOscillator();
      var g = ac.createGain();
      o1.type = 'sine';
      o1.frequency.value = freq;
      o2.type = 'triangle';
      o2.frequency.value = freq * 2.005;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(gain, when + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o1.connect(g); o2.connect(g);
      g.connect(master);
      g.connect(send);
      o1.start(when); o2.start(when);
      o1.stop(when + dur + 0.05);
      o2.stop(when + dur + 0.05);
    }

    /* 低频嗡鸣底噪（drone 模式） */
    var droneNodes = null;
    function droneOn() {
      if (droneNodes) return;
      var o1 = ac.createOscillator();
      var o2 = ac.createOscillator();
      var f = ac.createBiquadFilter();
      var g = ac.createGain();
      o1.type = 'sine'; o1.frequency.value = 55;
      o2.type = 'sine'; o2.frequency.value = 82.5;
      f.type = 'lowpass'; f.frequency.value = 240;
      g.gain.value = 0.35;
      o1.connect(f); o2.connect(f); f.connect(g);
      g.connect(master); g.connect(send);
      o1.start(); o2.start();
      droneNodes = { o1: o1, o2: o2, g: g };
    }
    function droneOff() {
      if (!droneNodes) return;
      try { droneNodes.o1.stop(); droneNodes.o2.stop(); } catch (e) { /* 忽略 */ }
      droneNodes = null;
    }

    var beat = 60 / BPM;
    function schedule() {
      if (!running) return;
      var now = ac.currentTime + 0.06;
      var chord = PROG[step % PROG.length];
      if (STYLE === 'drone') {
        droneOn();
        master.gain.setTargetAtTime(VOLUME, now, 0.6);
      } else {
        chord.forEach(function (deg, i) {
          var f = SCALE[deg % SCALE.length];
          pluck(f, now + i * beat * 0.25, 0.13 - i * 0.02, 2.4);
        });
        /* 偶尔一颗高音，像风铃 */
        if (Math.random() < 0.34) {
          pluck(SCALE[Math.floor(Math.random() * SCALE.length)] * 2, now + beat * 0.5, 0.05, 3.2);
        }
      }
      step++;
      timer = setTimeout(schedule, beat * 1000);
    }

    function start() {
      if (running) return;
      if (!ac && !init()) { btn.style.display = 'none'; return; }
      if (ac.state === 'suspended') ac.resume();
      running = true;
      step = 0;
      btn.setAttribute('aria-pressed', 'true');
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(VOLUME, ac.currentTime, 0.9);
      schedule();
      try { window.localStorage.setItem(KEY, 'on'); } catch (e) { /* 忽略 */ }
      toast('AMBIENT ON · 音が流れています');
    }

    function stop() {
      if (!running) return;
      running = false;
      clearTimeout(timer);
      if (ac) {
        master.gain.setTargetAtTime(0, ac.currentTime, 0.5);
        setTimeout(droneOff, 900);
      }
      btn.setAttribute('aria-pressed', 'false');
      try { window.localStorage.setItem(KEY, 'off'); } catch (e) { /* 忽略 */ }
      toast('AMBIENT OFF · 静かになりました');
    }

    /* 站内小提示 */
    var toastEl = doc.getElementById('jirai-toast');
    var toastTimer = null;
    function toast(msg) {
      if (!toastEl) return;
      var span = toastEl.querySelector('.toast-text');
      if (!span) return;
      toastEl.dataset.origin = toastEl.dataset.origin || span.textContent;
      span.textContent = msg;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toastEl.classList.remove('show');
        span.textContent = toastEl.dataset.origin;
      }, 3200);
    }

    btn.addEventListener('click', function () { running ? stop() : start(); });

    /* 尊重上次选择；未选择过则按 autoplay 配置 */
    var pref = null;
    try { pref = window.localStorage.getItem(KEY); } catch (e) { pref = null; }
    if (pref === 'on' || (pref === null && AUTOPLAY)) {
      var kick = function () {
        doc.removeEventListener('pointerdown', kick);
        doc.removeEventListener('keydown', kick);
        start();
      };
      doc.addEventListener('pointerdown', kick, { once: false });
      doc.addEventListener('keydown', kick, { once: false });
    }
  })();

  /* ============================================================
     5. 危险区反馈：快速上下猛拉时抖动 + 警示闪层
     ============================================================ */
  (function danger() {
    if (!cfg.danger || reduce) return;

    var veil = doc.createElement('div');
    veil.className = 'danger-veil';
    veil.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(veil);

    var hits = [], lastY = window.pageYOffset, lastT = performance.now();
    window.addEventListener('scroll', function () {
      var y = window.pageYOffset, now = performance.now();
      var dy = y - lastY, dt = now - lastT;
      lastY = y; lastT = now;
      if (dt <= 0 || dt > 240) return;

      /* 速度超过 3.4 px/ms 视为“猛拉” */
      if (Math.abs(dy) / dt > 3.4) {
        hits.push(now);
        hits = hits.filter(function (t) { return now - t < 1500; });
        if (hits.length >= 4) {
          hits = [];
          trigger();
        }
      }
    }, { passive: true });

    var stage = doc.querySelector('.wrap') || doc.body;
    var busy = false;
    function trigger() {
      if (busy) return;
      busy = true;
      stage.classList.add('shake');
      veil.classList.add('on');
      setTimeout(function () {
        stage.classList.remove('shake');
        veil.classList.remove('on');
        busy = false;
      }, 1300);
    }
  })();

  /* ============================================================
     6. 踩雷彩蛋：点导航栏的心形 Logo 会炸
     ============================================================ */
  (function landmine() {
    if (!cfg.danger || reduce) return;

    var brand = doc.querySelector('.brand .brand-mark') || doc.querySelector('.brand');
    var host = doc.querySelector('.brand');
    if (!brand || !host) return;

    var texts = ['地雷です ✚', 'BOOOOM !', '踩到了呢…', '取り扱い注意'];
    var veil = doc.querySelector('.danger-veil');
    if (!veil) {
      veil = doc.createElement('div');
      veil.className = 'danger-veil';
      veil.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(veil);
    }

    brand.style.cursor = 'pointer';
    brand.setAttribute('title', '踩一下试试？');
    host.setAttribute('title', '踩一下试试？');

    var cool = false;
    /* 绑在 <a class="brand"> 上：点击图标或站名都会触发；
       preventDefault 阻止跳回首页，让彩蛋不打断阅读 */
    host.addEventListener('click', function (e) {
      e.preventDefault();
      if (cool) return;
      cool = true;
      setTimeout(function () { cool = false; }, 2200);

      /* 1. 爆点扩散 */
      var b = brand.getBoundingClientRect();
      for (var i = 0; i < 2; i++) {
        var blast = doc.createElement('span');
        blast.className = 'lm-blast';
        blast.style.left = (b.left + b.width / 2 - 7) + 'px';
        blast.style.top = (b.top + b.height / 2 - 7) + 'px';
        blast.style.animationDelay = (i * 130) + 'ms';
        doc.body.appendChild(blast);
        (function (n, d) { setTimeout(function () { n.remove(); }, 1000 + d); })(blast, i * 130);
      }

      /* 2. 全屏抖动 + 警示闪层（抖 .wrap，不抖 body） */
      var stage = doc.querySelector('.wrap') || doc.body;
      stage.classList.add('shake');
      veil.classList.add('on');

      /* 3. 故障提示文字 */
      var msg = doc.createElement('div');
      msg.className = 'lm-message';
      msg.textContent = texts[Math.floor(Math.random() * texts.length)];
      doc.body.appendChild(msg);

      setTimeout(function () {
        stage.classList.remove('shake');
        veil.classList.remove('on');
      }, 900);
      setTimeout(function () { msg.remove(); }, 3400);

      /* 4. 大标题闪一下故障 */
      var title = doc.querySelector('.banner h1');
      if (title) {
        title.classList.add('glitch-once');
        setTimeout(function () { title.classList.remove('glitch-once'); }, 1100);
      }
    });
  })();
})();
;
/* ===== jirai-texture.js ===== */
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
;
/* ===== jirai-search.js ===== */
/* ============================================================
   jirai-search — 檢索台客戶端
   拉取 /search.json，做即時子串匹配（中文友好，無需分詞）
   支援 Ctrl/Cmd+K 開啟、↑↓ 選擇、Enter 開啟、Esc 關閉
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.__JIRAI__ || {};
  if (!cfg.search) return;

  var doc = document;
  var mask = doc.getElementById('jirai-search');
  var openBtn = doc.getElementById('jirai-search-btn');
  if (!mask || !openBtn) return;

  var input = doc.getElementById('search-input');
  var body = doc.getElementById('search-body');
  var countEl = doc.getElementById('search-count');
  var idleTpl = body ? body.innerHTML : '';

  var INDEX = null;
  var loading = false;
  var results = [];
  var active = -1;

  /* ---------------------------------------------- 索引載入 */
  function loadIndex() {
    if (INDEX && INDEX.ready) return Promise.resolve(INDEX);
    if (loading) return loading;
    var url = (cfg.root || '/') + 'search.json';
    loading = Promise.all([
      fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }),
      loadT2S()
    ])
      .then(function (res) {
        INDEX = res[0];
        prepareIndex();
        return INDEX;
      })
      .catch(function () {
        INDEX = { items: [], ready: true, failed: true };
        return INDEX;
      });
    return loading;
  }

  /* ---------------------------------------------- 繁→简归一
     索引是简体；读者可能打繁体（甚至开著繁体切换）。
     建索引时把每条的 t/x/h/g 也归一成简体，查询同样归一，
     两种写法都能命中。映射表由 OpenCC 生成，只含本站用字。 */
  var T2S_C = {};
  var T2S_P = {};
  var t2sReady = null;
  var t2sSorted = [];

  function normalize(s) {
    if (!s) return '';
    var out = String(s);
    for (var i = 0; i < t2sSorted.length; i++) {
      var k = t2sSorted[i];
      if (out.indexOf(k) > -1) out = out.split(k).join(T2S_P[k]);
    }
    return out.replace(/[\u4e00-\u9fa5]/g, function (ch) { return T2S_C[ch] || ch; });
  }

  function loadT2S() {
    if (t2sReady) return t2sReady;
    t2sReady = fetch((cfg.root || '/') + 'data/t2s-map.json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) {
        if (!m) return;
        T2S_C = m.c || {};
        T2S_P = m.p || {};
        t2sSorted = Object.keys(T2S_P).sort(function (a, b) { return b.length - a.length; });
      })
      .catch(function () { /* 拿不到就退化为精确匹配，不影响功能 */ });
    return t2sReady;
  }

  /* 索引里补一份归一化用小写字段，查询时零重复计算 */
  function prepareIndex() {
    INDEX.items.forEach(function (it) {
      it._t = normalize(it.t).toLowerCase();
      it._x = normalize(it.x).toLowerCase();
      it._n = it.n.toLowerCase();
      it._c = normalize(it.c || '').toLowerCase();
      it._g = (it.g || []).map(function (g) { return normalize(g).toLowerCase(); });
      it._h = (it.h || []).map(function (h) { return normalize(h).toLowerCase(); });
    });
    INDEX.ready = true;
  }

  /* ---------------------------------------------- 匹配与高亮 */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* 高亮：先转义，再在「归一化后的文本」上定位。
     归一化是逐字等长替换，所以位置能直接映射回原字符，
     即使读者打的是繁体，也能高亮出正文里的简体原字。 */
  function mark(text, q) {
    var safe = esc(text);
    if (!q) return safe;
    var hay = normalize(safe).toLowerCase();
    var ql = normalize(q).toLowerCase();
    if (!ql || hay.length !== safe.length) return safe;
    var out = '';
    var i = 0, at;
    while ((at = hay.indexOf(ql, i)) > -1) {
      out += safe.slice(i, at) + '<mark>' + safe.slice(at, at + ql.length) + '</mark>';
      i = at + ql.length;
    }
    return out + safe.slice(i);
  }
  /* 取命中位置周围的片段（简体坐标），而不是正文开头 */
  function snippet(text, q, span) {
    span = span || 64;
    if (!text) return '';
    var at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (at < 0) return text.slice(0, span * 2) + (text.length > span * 2 ? '……' : '');
    var from = Math.max(0, at - span);
    var to = Math.min(text.length, at + q.length + span);
    return (from > 0 ? '……' : '') + text.slice(from, to) + (to < text.length ? '……' : '');
  }

  /* ---------------------------------------------- 搜索 */
  function search(q) {
    if (!INDEX || !INDEX.ready) return [];
    var ql = normalize(q).toLowerCase();
    if (!ql) return [];
    var hits = [];

    INDEX.items.forEach(function (it) {
      var inTitle = it._t.indexOf(ql) > -1;
      var inNo = it._n.indexOf(ql) > -1;
      var inType = it._c.indexOf(ql) > -1;
      var inTags = it._g.some(function (g) { return g.indexOf(ql) > -1; });
      var inHead = it._h.some(function (h) { return h.indexOf(ql) > -1; });
      var inBody = it._x.indexOf(ql) > -1;

      if (!(inTitle || inNo || inType || inTags || inHead || inBody)) return;

      /* 排序权重：标题 > 档号 > 章节 > 标签/类型 > 正文 */
      var weight = 0;
      if (inTitle) weight += 100;
      if (inNo) weight += 60;
      if (inHead) weight += 40;
      if (inTags) weight += 25;
      if (inType) weight += 20;
      if (inBody) weight += 10;

      var hitText = '';
      if (inHead) {
        for (var i = 0; i < it._h.length; i++) {
          if (it._h[i].indexOf(ql) > -1) { hitText = it.h[i]; break; }
        }
      }
      if (!hitText && inBody) {
        /* 用归一化坐标取片段，再用原文显示 */
        var at = it._x.indexOf(ql);
        var from = Math.max(0, at - 64);
        var to = Math.min(it.x.length, at + ql.length + 64);
        hitText = (from > 0 ? '……' : '') + it.x.slice(from, to) + (to < it.x.length ? '……' : '');
      }

      hits.push({ it: it, weight: weight, snip: hitText });
    });

    return hits.sort(function (a, b) { return b.weight - a.weight; }).slice(0, 30);
  }

  /* ---------------------------------------------- 渲染 */
  function render(q) {
    if (!q) {
      results = [];
      active = -1;
      body.innerHTML = idleTpl;
      if (countEl) countEl.textContent = INDEX ? String(INDEX.items.length) : '—';
      return;
    }
    results = search(q);
    active = results.length ? 0 : -1;

    if (countEl) countEl.textContent = String(results.length);

    if (!results.length) {
      body.innerHTML = '<div class="search-empty">查無此件<br>NO MATCHING RECORD</div>';
      return;
    }

    body.innerHTML = results.map(function (r, i) {
      var it = r.it;
      return '<a class="sr-item' + (i === active ? ' active' : '') + '" href="' + esc(it.u) + '" data-i="' + i + '">'
        + '<div class="sr-top">'
        + '<span class="sr-no">' + esc(it.n) + '</span>'
        + '<span class="sr-date">' + esc(it.d) + '</span>'
        + (it.c ? '<span class="sr-type">' + esc(it.c) + '</span>' : '')
        + '</div>'
        + '<div class="sr-title">' + mark(it.t, q) + '</div>'
        + (r.snip ? '<div class="sr-snippet">' + mark(r.snip, q) + '</div>' : '')
        + '<div class="sr-meta">約 ' + it.m + ' 分鐘'
        + (it.g.length ? '<span class="sr-sep">·</span>' + esc(it.g.slice(0, 4).join(' / ')) : '')
        + '</div>'
        + '</a>';
    }).join('');
  }

  function setActive(i) {
    if (!results.length) return;
    active = (i + results.length) % results.length;
    var nodes = body.querySelectorAll('.sr-item');
    for (var k = 0; k < nodes.length; k++) nodes[k].classList.toggle('active', k === active);
    if (nodes[active]) {
      var n = nodes[active];
      var top = n.offsetTop, h = n.offsetHeight;
      if (top < body.scrollTop) body.scrollTop = top - 8;
      else if (top + h > body.scrollTop + body.clientHeight) body.scrollTop = top + h - body.clientHeight + 8;
    }
  }

  /* ---------------------------------------------- 开关 */
  var lastFocus = null;
  function open() {
    mask.classList.add('open');
    document.body.style.overflow = 'hidden';
    /* 记住来源焦点，关闭时归还 */
    if (!mask.contains(doc.activeElement)) lastFocus = doc.activeElement;
    /* 立即把焦点移入输入框 —— 原先写在 loadIndex().then() 里，
       索引加载完成前用户会先 Tab 过整条导航才够到对话框。
       但必须延到下一帧：遮罩初始为 visibility:hidden，在 hidden 元素上
       focus() 会被浏览器静默忽略；同任务内刚加的 .open 尚未参与样式解析
       （实测聚焦失败，activeElement 仍是 body）。 */
    focusInputNextFrame();
    loadIndex().then(function () {
      if (input && !input.value && countEl && INDEX) countEl.textContent = String(INDEX.items.length);
      if (input && input.value) render(input.value.trim());
    });
  }
  /* 把焦点移入输入框。
     踩过的两个坑：
       1) 遮罩初始 visibility:hidden，对 hidden 元素调用 focus() 会被
          浏览器静默忽略（不报错、activeElement 不变）。
       2) visibility 是随 .open 过渡的，实测约 60–70ms 才转为 visible。
          因此不能用固定延时 —— 60ms 时仍可能早几毫秒而失败。
     做法：轮询「计算样式确实可聚焦」再聚焦，rAF 与 setTimeout 双通道
     （后台标签页会节流 rAF，此时靠 setTimeout 推进），并设次数上限与兜底。 */
  function focusInputNextFrame() {
    if (!input) return;
    var tries = 0;

    function ready() {
      if (!mask.classList.contains('open')) return false;
      var cs = getComputedStyle(input);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    }

    function attempt() {
      tries++;
      if (doc.activeElement === input) return;
      if (ready()) { input.focus(); return; }
      if (tries < 40) step();
    }

    function step() {
      if (window.requestAnimationFrame) requestAnimationFrame(attempt);
      setTimeout(attempt, 16);
    }
    step();
  }
  function close() {
    mask.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }
  function toggle() {
    mask.classList.contains('open') ? close() : open();
  }

  openBtn.addEventListener('click', open);
  var closeBtn = doc.getElementById('search-close');
  if (closeBtn) closeBtn.addEventListener('click', close);

  mask.addEventListener('click', function (e) {
    if (e.target === mask) close();
  });

  /* ---------------------------------------------- 焦点陷阱
     对话框标了 aria-modal="true"，就必须把 Tab 关在里面 ——
     否则键盘用户会 Tab 到背后的页面内容上，屏读器也会读到那些内容，
     与「模态」的语义不符。 */
  mask.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var focusables = [].slice.call(
      mask.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) { return el.offsetParent !== null; });
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* 输入（防抖 90ms，索引很小所以很快） */
  var timer = null;
  if (input) {
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        render(input.value.trim());
      }, 90);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var node = body.querySelector('.sr-item.active');
        if (node) window.location.href = node.getAttribute('href');
      } else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  /* 点结果（阻止默认以便统一处理） */
  body.addEventListener('click', function (e) {
    var a = e.target.closest('.sr-item');
    if (a) close();
  });

  /* 全局快捷键：Ctrl/Cmd+K 或 '/' */
  doc.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      toggle();
      return;
    }
    if (e.key === '/' && !mask.classList.contains('open')) {
      var tag = (doc.activeElement && doc.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      open();
    }
    if (e.key === 'Escape' && mask.classList.contains('open')) close();
  });

  /* 预取索引：空闲时提前拉，打开就是瞬时 */
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(function () { loadIndex(); }, { timeout: 4000 });
  } else {
    setTimeout(function () { loadIndex(); }, 2500);
  }
})();

/* ============================================================
   字級控制：存入 localStorage，下次造訪沿用
   ============================================================ */
(function () {
  var btn = document.getElementById('jirai-type');
  if (!btn) return;
  var KEY = 'jirai-type';
  var LEVELS = ['s', 'm', 'l', 'xl'];
  var LABEL = { s: '小', m: '標準', l: '大', xl: '特大' };

  function apply(level) {
    document.documentElement.setAttribute('data-type', level);
    var b = btn.querySelector('b');
    if (b) b.textContent = LABEL[level];
    try { window.localStorage.setItem(KEY, level); } catch (e) { /* 忽略 */ }
  }

  var cur = 'm';
  try { cur = window.localStorage.getItem(KEY) || 'm'; } catch (e) { cur = 'm'; }
  if (LEVELS.indexOf(cur) < 0) cur = 'm';
  apply(cur);

  btn.addEventListener('click', function () {
    var i = LEVELS.indexOf(document.documentElement.getAttribute('data-type') || 'm');
    apply(LEVELS[(i + 1) % LEVELS.length]);
  });
})();
;
/* ===== jirai-keys.js ===== */
/* ============================================================
   jirai-keys — 檔案館键盘導覽
   让「檔號」这套信息架构长出对应的操作方式：
     [ / ]   翻前一份 / 後一份卷宗
     G       跳到指定檔號（输入 8 / A8 / a-008 都识别）
     R       随机调阅一份
     E       回到檔案庫
     ?       快捷键一览
   设计原则：
     - 不劫持已有快捷键：Ctrl/⌘+K 与 / 仍归检索台
     - 输入框、可编辑区域内一律不响应
     - 弹出层打开时 Esc 只关自己那层
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.__JIRAI__ || {};
  if (!cfg.keynav) return;

  var doc = document;
  var root = doc.documentElement;

  /* ---------------------------------------------- 状态 */
  var CASES = null;      // { total, items:[{n,t,c,d,u}] }
  var loading = null;
  var CASE_RE = /^A-\d{3}$/;

  function loadCases() {
    if (CASES) return Promise.resolve(CASES);
    if (loading) return loading;
    loading = fetch((cfg.root || '/') + 'cases.json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { CASES = j || { total: 0, items: [] }; return CASES; })
      .catch(function () { CASES = { total: 0, items: [] }; return CASES; });
    return loading;
  }

  /* 当前页对应的档号（从 DOM 的书脊读取，避免多一次请求） */
  function currentCaseNo() {
    var el = doc.querySelector('.dossier-spine .sp-no');
    return el ? el.textContent.trim() : null;
  }
  function currentIndex() {
    var no = currentCaseNo();
    if (!no || !CASES) return -1;
    for (var i = 0; i < CASES.items.length; i++) {
      if (CASES.items[i].n === no) return i;
    }
    return -1;
  }

  /* ---------------------------------------------- 输入类对话框（G 跳档号） */
  var jumpEl = null;

  function closeJump() {
    if (!jumpEl) return;
    jumpEl.classList.remove('open');
    var node = jumpEl;
    jumpEl = null;
    setTimeout(function () { node.remove(); }, 200);
  }

  function openJump() {
    if (jumpEl) return;
    jumpEl = doc.createElement('div');
    jumpEl.className = 'kn-jump';
    jumpEl.setAttribute('role', 'dialog');
    jumpEl.setAttribute('aria-label', '跳到檔號');
    jumpEl.innerHTML =
      '<div class="kn-jump__panel">' +
      '  <div class="kn-jump__head"><span>跳至檔號</span>' +
      '    <button class="kn-jump__x" type="button" aria-label="關閉">✕</button></div>' +
      '  <div class="kn-jump__row"><span class="kn-jump__prompt">A-</span>' +
      '    <input class="kn-jump__input" type="text" inputmode="numeric" autocomplete="off" ' +
      '           placeholder="001 – ' + String((CASES && CASES.total) || 999).padStart(3, '0') + '"></div>' +
      '  <div class="kn-jump__hint" data-hint>輸入序號後回車 · Esc 取消</div>' +
      '</div>';
    doc.body.appendChild(jumpEl);
    requestAnimationFrame(function () { jumpEl.classList.add('open'); });

    var input = jumpEl.querySelector('.kn-jump__input');
    var hint = jumpEl.querySelector('[data-hint]');
    input.focus();

    jumpEl.querySelector('.kn-jump__x').addEventListener('click', closeJump);
    jumpEl.addEventListener('click', function (e) { if (e.target === jumpEl) closeJump(); });

    function resolve(raw) {
      /* 输入容错：8 / 08 / 008 / A8 / A-8 / a-008 都识别 */
      var digits = String(raw).replace(/[^0-9]/g, '');
      if (!digits) return null;
      var no = 'A-' + digits.padStart(3, '0');
      if (!CASE_RE.test(no)) return null;
      for (var i = 0; i < CASES.items.length; i++) {
        if (CASES.items[i].n === no) return CASES.items[i];
      }
      return false;   /* 格式对但不存在 */
    }

    input.addEventListener('input', function () {
      var r = resolve(input.value);
      if (r === null) { hint.textContent = '輸入序號後回車 · Esc 取消'; hint.className = 'kn-jump__hint'; }
      else if (r === false) { hint.textContent = '館內無此檔號'; hint.className = 'kn-jump__hint is-bad'; }
      else { hint.textContent = r.t + '  ·  ' + r.c; hint.className = 'kn-jump__hint is-ok'; }
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeJump(); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var r = resolve(input.value);
      if (r && r !== false) { window.location.href = r.u; }
      else if (r === false) {
        input.classList.add('shake-soft');
        setTimeout(function () { input.classList.remove('shake-soft'); }, 420);
      }
    });
  }

  /* ---------------------------------------------- 快捷键一览（?） */
  var helpEl = null;

  function closeHelp() {
    if (!helpEl) return;
    helpEl.classList.remove('open');
    var node = helpEl;
    helpEl = null;
    setTimeout(function () { node.remove(); }, 200);
  }

  function openHelp() {
    if (helpEl) return;
    var rows = [
      ['[', ']', '翻前一份 / 後一份卷宗'],
      ['G', '', '跳至指定檔號'],
      ['R', '', '隨機調閱一份'],
      ['E', '', '回到碎片檔案庫'],
      ['/', '', '打開檢索台'],
      ['Ctrl K', '', '打開檢索台'],
      ['Alt V', '', '切換簡體 / 繁體'],
      ['?', '', '顯示這份清單']
    ];
    helpEl = doc.createElement('div');
    helpEl.className = 'kn-help';
    helpEl.setAttribute('role', 'dialog');
    helpEl.setAttribute('aria-label', '快捷鍵');
    helpEl.innerHTML =
      '<div class="kn-help__panel">' +
      '  <div class="kn-help__head"><span>操作一覽</span>' +
      '    <button class="kn-help__x" type="button" aria-label="關閉">✕</button></div>' +
      '  <dl class="kn-help__list">' +
      rows.map(function (r) {
        var key = r[0] + (r[1] ? ' ' + r[1] : '');
        return '<div class="kn-help__item"><dt><kbd>' + key + '</kbd></dt><dd>' + r[2] + '</dd></div>';
      }).join('') +
      '  </dl>' +
      '  <div class="kn-help__foot">按 Esc 關閉</div>' +
      '</div>';
    doc.body.appendChild(helpEl);
    requestAnimationFrame(function () { helpEl.classList.add('open'); });
    helpEl.querySelector('.kn-help__x').addEventListener('click', closeHelp);
    helpEl.addEventListener('click', function (e) { if (e.target === helpEl) closeHelp(); });
  }

  /* ---------------------------------------------- 底部位置提示 */
  var hintEl = null;

  function ensureHint() {
    if (!cfg.keynavHint || hintEl) return hintEl;
    if (!doc.querySelector('.dossier')) return null;   /* 只在文章页显示 */
    hintEl = doc.createElement('div');
    hintEl.className = 'kn-hint';
    hintEl.innerHTML =
      '<kbd>[</kbd><kbd>]</kbd><span class="kn-hint__t">翻卷宗</span>' +
      '<kbd>G</kbd><span class="kn-hint__t">跳檔號</span>' +
      '<kbd>?</kbd><span class="kn-hint__t">全部</span>';
    doc.body.appendChild(hintEl);
    return hintEl;
  }

  /* ---------------------------------------------- 翻卷宗 */
  function go(delta) {
    loadCases().then(function () {
      if (!CASES.total) return;
      var i = currentIndex();
      if (i < 0) return;
      var next = i + delta;
      if (next < 0 || next >= CASES.items.length) {
        if (hintEl) {
          hintEl.classList.add('is-edge');
          setTimeout(function () { hintEl.classList.remove('is-edge'); }, 500);
        }
        return;
      }
      window.location.href = CASES.items[next].u;
    });
  }

  function randomCase() {
    loadCases().then(function () {
      if (!CASES.total) return;
      var i = currentIndex();
      var pick = i;
      /* 只有一份或只有两份时不至于选出当前页 */
      for (var guard = 0; guard < 12 && pick === i; guard++) {
        pick = Math.floor(Math.random() * CASES.items.length);
      }
      window.location.href = CASES.items[pick].u;
    });
  }

  /* ---------------------------------------------- 全局键盘 */
  function typingInField(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  doc.addEventListener('keydown', function (e) {
    /* 修饰键组合交还给浏览器与检索台 */
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (typingInField(doc.activeElement)) return;

    /* Esc 先关最上层弹层 */
    if (e.key === 'Escape') {
      if (jumpEl) { closeJump(); return; }
      if (helpEl) { closeHelp(); return; }
      if (hintEl) { hintEl.classList.add('is-gone'); return; }
      return;
    }
    if (jumpEl || helpEl) return;   /* 弹层打开时不响应其它单键 */

    var k = e.key;
    if (k === '[' || k === ']') {
      e.preventDefault();
      go(k === '[' ? -1 : 1);
    } else if (k === 'g' || k === 'G') {
      e.preventDefault();
      loadCases().then(openJump);
    } else if (k === 'r' || k === 'R') {
      e.preventDefault();
      randomCase();
    } else if (k === 'e' || k === 'E') {
      e.preventDefault();
      window.location.href = (cfg.root || '/');
    } else if (k === '?') {
      e.preventDefault();
      loadCases().then(openHelp);
    }
  });

  /* ---------------------------------------------- 位置提示的显示时机 */
  if (cfg.keynavHint) {
    var idle = null;
    function revealHint() {
      var h = ensureHint();
      if (!h || h.classList.contains('is-gone')) return;
      h.classList.add('is-on');
      clearTimeout(idle);
      idle = setTimeout(function () { h.classList.remove('is-on'); }, 3200);
    }
    /* 进入文章页 1.2s 后提示一次，之后随键盘活动再次出现 */
    if (doc.querySelector('.dossier')) {
      setTimeout(revealHint, 1200);
      doc.addEventListener('keydown', function (e) {
        if (['[', ']', 'g', 'G', 'r', 'R', '?'].indexOf(e.key) > -1) revealHint();
      });
    }
  }

  /* 预热档号索引：文章页空闲时拉取，按键即响应 */
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(function () { loadCases(); }, { timeout: 3500 });
  } else {
    setTimeout(function () { loadCases(); }, 2000);
  }
})();
;
/* ===== jirai-reveal.js ===== */
/* ============================================================
   jirai-reveal — 入场编排（JS）
   只负责给首屏元素编号（--rv-i），错落节奏由 CSS transition-delay 完成。
   动画本身见 jirai-reveal.css：用 @starting-style 让「元素首次渲染」
   成为过渡起点，因此不依赖本脚本的执行时机，也不会出现闪动。
   ============================================================ */
(function () {
  'use strict';
  var cfg = window.__JIRAI__ || {};
  if (cfg.reveal === false) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!document.documentElement.classList.contains('reveal-on')) return;

  var nodes = document.querySelectorAll(
    '.cabinet-head, .cabinet .cab-row, .dossier, .side .widget, .page-title'
  );
  var STAGGER_MAX = 6;
  var idx = 0;
  var vh = window.innerHeight;

  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    var r = el.getBoundingClientRect();
    /* 只编排首屏（含少量余量）；屏幕外的内容直接呈现，不延迟阅读 */
    if (r.top > vh * 1.1) continue;
    el.style.setProperty('--rv-i', idx % STAGGER_MAX);
    idx++;
  }
})();
