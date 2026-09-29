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
