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
