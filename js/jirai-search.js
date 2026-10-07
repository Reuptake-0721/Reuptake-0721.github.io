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
  /* 两次 rAF：确保 .open 生效、visibility 已转为 visible 再聚焦 */
  function focusInputNextFrame() {
    if (!input) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (mask.classList.contains('open') && doc.activeElement !== input) input.focus();
      });
    });
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
