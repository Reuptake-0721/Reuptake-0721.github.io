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
