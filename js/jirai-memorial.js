/* 留念页只启用阅读进度、回顶与图片预览。 */
(function () {
  'use strict';
  var doc = document, body = doc.getElementById('post-body');
  var progress = doc.getElementById('read-progress'), topButton = doc.getElementById('to-top');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function update() {
    var y = scrollY;
    if (topButton) topButton.classList.toggle('show', y > 500);
    if (body && progress) {
      var start = body.getBoundingClientRect().top + y;
      var extent = body.scrollHeight - innerHeight * .55;
      var ratio = extent > 0 ? (y - start + 80) / extent : 1;
      progress.style.width = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(2) + '%';
    }
  }
  var scheduled = false;
  addEventListener('scroll', function () {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () { update(); scheduled = false; });
  }, {passive: true});
  addEventListener('resize', update, {passive: true});
  if (topButton) topButton.addEventListener('click', function () {
    scrollTo({top: 0, behavior: reduce.matches ? 'instant' : 'smooth'});
  });
  update();
  if (body) body.addEventListener('click', function (e) {
    var img = e.target.closest('img');
    if (!img || img.closest('a')) return;
    var mask = doc.createElement('div'), full = doc.createElement('img'), button = doc.createElement('button');
    mask.className = 'lb-mask';
    mask.setAttribute('role', 'dialog'); mask.setAttribute('aria-modal', 'true'); mask.setAttribute('aria-label', '图片预览');
    full.src = img.getAttribute('data-src') || img.src; full.alt = img.alt || '文章中的聊天记录';
    button.type = 'button'; button.className = 'lb-close'; button.textContent = '×'; button.setAttribute('aria-label', '关闭图片预览');
    mask.append(button, full);
    var previousFocus = doc.activeElement, previousOverflow = doc.body.style.overflow;
    doc.body.appendChild(mask); doc.body.style.overflow = 'hidden'; button.focus();
    function close() {
      mask.remove(); doc.body.style.overflow = previousOverflow;
      if (previousFocus && previousFocus.focus) previousFocus.focus();
    }
    mask.addEventListener('click', close);
    mask.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') { event.preventDefault(); button.focus(); }
    });
  });
})();
