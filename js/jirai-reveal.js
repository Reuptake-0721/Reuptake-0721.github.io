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