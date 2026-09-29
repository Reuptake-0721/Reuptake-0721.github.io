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
