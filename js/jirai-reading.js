/* Optional, device-local reading checkpoints for ordinary articles. */
(function () {
  'use strict';
  var doc = document;
  var article = doc.querySelector('article[data-reading-key]');
  var body = article && article.querySelector('#post-body');
  var bar = doc.getElementById('reading-resume');
  if (!article || !body || !bar) return;

  var STORAGE = 'jirai-reading-v1';
  var MAX_AGE = 90 * 24 * 60 * 60 * 1000;
  var key = article.getAttribute('data-reading-key');
  var revision = article.getAttribute('data-reading-revision');
  var records;
  var timer = null;
  var tracking = false;
  var enabled = true;
  var previous = null;
  var navigation = window.performance && window.performance.getEntriesByType ? window.performance.getEntriesByType('navigation')[0] : null;
  var historyVisit = !!navigation && navigation.type === 'back_forward';

  function finite(n) { return typeof n === 'number' && Number.isFinite(n); }
  function clamp(n) { return Math.max(0, Math.min(1, n)); }
  function readRecords() {
    var result = Object.create(null);
    var raw, parsed;
    try { raw = window.localStorage.getItem(STORAGE); } catch (e) { return null; }
    try { parsed = raw && raw.length < 65536 ? JSON.parse(raw) : {}; } catch (e) { return result; }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.keys(parsed).forEach(function (path) {
        var r = parsed[path];
        if (path.charAt(0) !== '/' || !r || typeof r !== 'object') return;
        if (!finite(r.at) || Date.now() - r.at > MAX_AGE || r.at > Date.now() + 86400000) return;
        if (!finite(r.ratio) || r.ratio <= 0 || r.ratio >= 1 || typeof r.revision !== 'string') return;
        if (typeof r.anchor !== 'string' || !finite(r.sectionRatio) || r.sectionRatio < 0 || r.sectionRatio > 1) return;
        result[path] = r;
      });
    }
    return result;
  }
  records = readRecords();
  if (!records) return;
  previous = records[key] && records[key].revision === revision ? records[key] : null;
  if (!previous) delete records[key];

  function persist() {
    if (!enabled) return;
    try {
      // Merge only this article into the latest store, preserving other open tabs' work.
      var current = records[key];
      var latest = readRecords();
      if (!latest) { enabled = false; bar.hidden = true; return; }
      records = latest;
      if (current) records[key] = current;
      else delete records[key];
      var paths = Object.keys(records).sort(function (a, b) { return records[b].at - records[a].at; });
      paths.slice(30).forEach(function (path) { delete records[path]; });
      window.localStorage.setItem(STORAGE, JSON.stringify(records));
    } catch (e) { enabled = false; bar.hidden = true; }
  }
  function blocked() {
    return doc.body.style.overflow === 'hidden' || !!doc.querySelector('dialog[open], .search-mask.open, .kn-help.open, .kn-jump.open');
  }
  function line() {
    var nav = doc.getElementById('site-nav');
    return (nav ? nav.getBoundingClientRect().height : 0) + 24;
  }
  function sections() { return [].slice.call(body.querySelectorAll('h2[id], h3[id], h4[id]')); }

  function save() {
    clearTimeout(timer);
    if (!enabled || !tracking || blocked()) return;
    var rect = body.getBoundingClientRect();
    if (rect.height < window.innerHeight * 1.5) return;
    var position = line() - rect.top;
    if (position < 120) return;
    if (rect.bottom <= window.innerHeight * .85) {
      if (records[key]) { delete records[key]; persist(); }
      return;
    }
    var ratio = clamp(position / rect.height);
    if (ratio < .03 || ratio > .95) return;
    var heads = sections(), anchor = '', sectionRatio = 0;
    for (var i = heads.length - 1; i >= 0; i--) {
      var top = heads[i].getBoundingClientRect().top;
      if (top <= line()) {
        var end = heads[i + 1] ? heads[i + 1].getBoundingClientRect().top : rect.bottom;
        anchor = heads[i].id;
        sectionRatio = clamp((line() - top) / Math.max(1, end - top));
        break;
      }
    }
    records[key] = { revision: revision, ratio: ratio, anchor: anchor, sectionRatio: sectionRatio, at: Date.now() };
    persist();
  }
  function offer() {
    if (!previous || historyVisit || window.location.hash || blocked()) return;
    var rect = body.getBoundingClientRect();
    if (rect.height < window.innerHeight * 1.5 || rect.top < line() - 60) return;
    bar.querySelector('[data-reading-percent]').textContent = String(Math.round(previous.ratio * 100));
    bar.hidden = false;
  }

  bar.querySelector('[data-reading-continue]').addEventListener('click', function () {
    if (!previous) return;
    bar.hidden = true;
    tracking = true;
    window.requestAnimationFrame(function () {
      var rect = body.getBoundingClientRect();
      var target = rect.top + window.scrollY + previous.ratio * rect.height - line();
      var heads = sections();
      var anchor = doc.getElementById(previous.anchor);
      var focus = body;
      var index = heads.indexOf(anchor);
      if (index >= 0) {
        var start = anchor.getBoundingClientRect().top + window.scrollY;
        var end = heads[index + 1] ? heads[index + 1].getBoundingClientRect().top + window.scrollY : rect.bottom + window.scrollY;
        target = start + previous.sectionRatio * Math.max(1, end - start) - line();
        focus = anchor;
      }
      if (!focus.hasAttribute('tabindex')) focus.setAttribute('tabindex', '-1');
      focus.focus({ preventScroll: true });
      window.scrollTo({ top: Math.max(0, target), behavior: 'instant' });
    });
  });
  bar.querySelector('[data-reading-clear]').addEventListener('click', function () {
    clearTimeout(timer);
    delete records[key];
    previous = null;
    tracking = false;
    bar.hidden = true;
    persist();
    var title = article.querySelector('h1');
    if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
  });

  // A real reading action arms saving. Initial layout, modal focus and history restoration do not.
  function intent() { if (!blocked()) tracking = true; }
  window.addEventListener('wheel', intent, { passive: true });
  window.addEventListener('touchmove', intent, { passive: true });
  doc.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || !e.target.closest || e.target.closest('a, button, input, textarea, select, [contenteditable], [role="button"]')) return;
    intent();
  }, { passive: true });
  doc.addEventListener('keydown', function (e) {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    var el = doc.activeElement;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName))) return;
    if (['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', ' '].indexOf(e.key) >= 0) intent();
  });
  doc.addEventListener('click', function (e) {
    if (e.target.closest('a[href^="#"]')) intent();
  });
  window.addEventListener('scroll', function () {
    if (!tracking || blocked()) return;
    clearTimeout(timer);
    timer = window.setTimeout(save, 700);
  }, { passive: true });
  window.addEventListener('pagehide', save);
  doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') save(); });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { clearTimeout(timer); tracking = false; bar.hidden = true; }
    else offer();
  });
  if (doc.readyState === 'complete') offer();
})();
