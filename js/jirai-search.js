/* ============================================================
   jirai-search — 檢索台客戶端
   拉取 /search.json，按空白分隔的關鍵詞組合匹配（中文友好）
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
  var countLabel = doc.getElementById('search-count-label');
  var statusEl = doc.getElementById('search-status');
  var clearBtn = doc.getElementById('search-clear');
  var idleTpl = body ? body.innerHTML : '';
  if (!input || !body) return;
  openBtn.setAttribute('aria-controls', mask.id);
  openBtn.setAttribute('aria-expanded', 'false');

  var INDEX = null;
  var loading = false;
  var results = [];
  var active = -1;
  var renderedQuery = null;

  /* ---------------------------------------------- 索引載入 */
  function loadIndex() {
    if (INDEX && INDEX.ready) return Promise.resolve(INDEX);
    if (loading) return loading;
    var url = (cfg.root || '/') + 'search.json';
    loading = Promise.all([
      fetch(url, { credentials: 'same-origin', cache: 'no-cache' }).then(function (r) {
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
      }).then(function (index) {
        loading = false;
        return index;
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
    var out = String(s).replace(/\u3000/g, ' ').replace(/[\uff01-\uff5e]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 65248);
    });
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

  function queryTerms(q) {
    var seen = Object.create(null);
    return normalize(q).toLowerCase().trim().split(/\s+/).filter(function (term) {
      return !!term;
    }).map(function (term) {
      var no = /^a-?(\d{1,3})$/.exec(term);
      return no ? 'a-' + no[1].padStart(3, '0') : term;
    }).filter(function (term) {
      if (seen[term]) return false;
      seen[term] = true;
      return true;
    });
  }

  /* 高亮：在原文的归一化副本上定位，每个输出片段单独转义。
     归一化是逐字等长替换，所以位置能直接映射回原字符，
     即使读者打的是繁体，也能高亮出正文里的简体原字。 */
  function mark(text, q) {
    text = String(text);
    if (!q) return esc(text);
    var hay = normalize(text).toLowerCase();
    var terms = queryTerms(q);
    if (!terms.length || hay.length !== text.length) return esc(text);
    var ranges = [];
    terms.forEach(function (term) {
      var from = 0, at;
      while ((at = hay.indexOf(term, from)) > -1) {
        ranges.push([at, at + term.length]);
        from = at + 1;
      }
    });
    ranges.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var merged = [];
    ranges.forEach(function (range) {
      var last = merged[merged.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push(range);
    });
    var out = '';
    var i = 0;
    merged.forEach(function (range) {
      out += esc(text.slice(i, range[0])) + '<mark>' + esc(text.slice(range[0], range[1])) + '</mark>';
      i = range[1];
    });
    return out + esc(text.slice(i));
  }

  /* ---------------------------------------------- 搜索 */
  function search(q) {
    if (!INDEX || !INDEX.ready) return [];
    var terms = queryTerms(q);
    if (!terms.length) return [];
    var hits = [];

    INDEX.items.forEach(function (it) {
      /* 排序权重：标题 > 档号 > 章节 > 标签/类型 > 正文 */
      var weight = 0;
      var headIndex = -1, bodyAt = -1, bodyTerm = '';
      var matches = terms.every(function (term) {
        var inTitle = it._t.indexOf(term) > -1;
        var inNo = it._n.indexOf(term) > -1;
        var inType = it._c.indexOf(term) > -1;
        var inTags = it._g.some(function (g) { return g.indexOf(term) > -1; });
        var inHead = false;
        for (var i = 0; i < it._h.length; i++) {
          if (it._h[i].indexOf(term) > -1) {
            inHead = true;
            if (headIndex < 0) headIndex = i;
            break;
          }
        }
        var at = it._x.indexOf(term);
        var inBody = at > -1;
        if (!(inTitle || inNo || inType || inTags || inHead || inBody)) return false;
        if (inTitle) weight += 100;
        if (inNo) weight += 60;
        if (inHead) weight += 40;
        if (inTags) weight += 25;
        if (inType) weight += 20;
        if (inBody) weight += 10;
        if (inBody && (bodyAt < 0 || at < bodyAt)) { bodyAt = at; bodyTerm = term; }
        return true;
      });
      if (!matches) return;
      var hitText = '';
      if (headIndex >= 0) hitText = it.h[headIndex];
      if (!hitText && bodyAt >= 0) {
        /* 用归一化坐标取片段，再用原文显示 */
        var from = Math.max(0, bodyAt - 24);
        var to = Math.min(it.x.length, bodyAt + bodyTerm.length + 64);
        hitText = (from > 0 ? '……' : '') + it.x.slice(from, to) + (to < it.x.length ? '……' : '');
      }

      hits.push({ it: it, weight: weight, snip: hitText });
    });

    return hits.sort(function (a, b) { return b.weight - a.weight; }).slice(0, 30);
  }

  /* ---------------------------------------------- 渲染 */
  function replaceBody(html, resetScroll) {
    body.innerHTML = html;
    if (resetScroll) body.scrollTop = 0;
  }

  function render(q, resetScroll) {
    var signature = queryTerms(q).slice().sort().join('\u0000');
    var sameQuery = signature === renderedQuery;
    var selectedUrl = sameQuery && active >= 0 && results[active] ? results[active].it.u : null;
    resetScroll = resetScroll || !sameQuery;
    renderedQuery = signature;
    if (clearBtn) clearBtn.hidden = !input.value;
    if (countLabel) countLabel.textContent = q ? '命中' : '館藏';
    body.setAttribute('aria-busy', !INDEX || !INDEX.ready ? 'true' : 'false');
    if (statusEl) statusEl.textContent = '';
    if (!INDEX || !INDEX.ready || INDEX.failed) {
      results = []; active = -1;
      if (countEl) countEl.textContent = '—';
      if (INDEX && INDEX.failed) {
        if (statusEl) statusEl.textContent = '暂未载入';
        replaceBody('<div class="search-empty"><strong>暂时无法读取档案</strong>请检查网络后再试一次。<br><button class="search-retry" type="button">重新加载</button></div>', resetScroll);
      } else {
        if (statusEl) statusEl.textContent = '载入中';
        replaceBody('<div class="search-empty"><strong>正在读取档案…</strong>马上就好。</div>', resetScroll);
      }
      return;
    }
    if (!q) {
      results = [];
      active = -1;
      replaceBody(idleTpl, resetScroll);
      if (countEl) countEl.textContent = INDEX ? String(INDEX.items.length) : '—';
      return;
    }
    results = search(q);
    active = results.length ? 0 : -1;
    if (selectedUrl) {
      for (var selected = 0; selected < results.length; selected++) {
        if (results[selected].it.u === selectedUrl) { active = selected; break; }
      }
    }

    if (countEl) countEl.textContent = String(results.length);

    if (!results.length) {
      replaceBody('<div class="search-empty"><strong>未找到「' + esc(q) + '」</strong>试试更短的关键词，或输入档号。</div>', resetScroll);
      return;
    }

    replaceBody(results.map(function (r, i) {
      var it = r.it;
      var tags = (it.g || []).filter(function (tag) {
        return normalize(tag).toLowerCase().trim() !== normalize(it.c || '').toLowerCase().trim();
      }).slice(0, 4);
      return '<a class="sr-item' + (i === active ? ' active' : '') + '" href="' + esc(it.u) + '" data-i="' + i + '">'
        + '<div class="sr-top">'
        + '<span class="sr-no">' + mark(it.n, q) + '</span>'
        + '<span class="sr-date">' + esc(it.d) + '</span>'
        + (it.c ? '<span class="sr-type">' + mark(it.c, q) + '</span>' : '')
        + '</div>'
        + '<div class="sr-title">' + mark(it.t, q) + '</div>'
        + (r.snip ? '<div class="sr-snippet">' + mark(r.snip, q) + '</div>' : '')
        + '<div class="sr-meta">約 ' + it.m + ' 分鐘'
        + (tags.length ? '<span class="sr-sep">·</span>' + mark(tags.join(' / '), q) : '')
        + '</div>'
        + '</a>';
    }).join(''), resetScroll);
  }

  function setActive(i) {
    if (!results.length) return;
    active = (i + results.length) % results.length;
    var nodes = body.querySelectorAll('.sr-item');
    for (var k = 0; k < nodes.length; k++) nodes[k].classList.toggle('active', k === active);
    if (nodes[active]) {
      var n = nodes[active];
      var nr = n.getBoundingClientRect(), br = body.getBoundingClientRect();
      if (nr.top < br.top) body.scrollTop -= br.top - nr.top + 8;
      else if (nr.bottom > br.bottom) body.scrollTop += nr.bottom - br.bottom + 8;
    }
  }

  /* ---------------------------------------------- 开关 */
  var lastFocus = null;
  var previousOverflow = '';
  function open() {
    if (mask.classList.contains('open')) return;
    lastFocus = doc.activeElement;
    previousOverflow = doc.body.style.overflow;
    mask.classList.add('open');
    mask.setAttribute('aria-hidden', 'false');
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    /* .open 的 visibility 立即生效，后台标签页也能同步获得输入焦点。 */
    input.focus({preventScroll: true});
    render(input.value.trim());
    loadIndex().then(function () {
      if (mask.classList.contains('open')) render(input.value.trim());
    });
  }
  function close() {
    if (!mask.classList.contains('open')) return;
    clearTimeout(timer);
    timer = null;
    mask.classList.remove('open');
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = previousOverflow;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    mask.setAttribute('aria-hidden', 'true');
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
  var composing = false;
  function queueSearch() {
    if (clearBtn) clearBtn.hidden = !input.value;
    clearTimeout(timer);
    timer = null;
    if (!composing) timer = setTimeout(function () { timer = null; render(input.value.trim()); }, 90);
  }
  if (clearBtn) clearBtn.addEventListener('click', function () {
    clearTimeout(timer); timer = null; input.value = ''; render('', true); input.focus({preventScroll: true});
  });
  if (input) {
    input.addEventListener('compositionstart', function () { composing = true; clearTimeout(timer); timer = null; });
    input.addEventListener('compositionend', function () { composing = false; queueSearch(); });
    input.addEventListener('input', queueSearch);

    input.addEventListener('keydown', function (e) {
      if (e.isComposing || composing || e.keyCode === 229) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (timer !== null) { clearTimeout(timer); timer = null; render(input.value.trim()); }
        var node = body.querySelector('.sr-item.active');
        if (node) window.location.href = node.getAttribute('href');
      } else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  /* 点结果（阻止默认以便统一处理） */
  body.addEventListener('click', function (e) {
    if (e.target.closest('.search-retry')) {
      INDEX = null;
      render(input.value.trim(), true);
      loadIndex().then(function () { if (mask.classList.contains('open')) render(input.value.trim()); });
      input.focus({preventScroll: true});
      return;
    }
    var a = e.target.closest('.sr-item');
    if (a) close();
  });

  /* 全局快捷键：Ctrl/Cmd+K 或 '/' */
  doc.addEventListener('keydown', function (e) {
    if (e.isComposing || composing || e.keyCode === 229) return;
    if (doc.querySelector('dialog[open], .kn-help.open, .kn-jump.open')) return;
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
