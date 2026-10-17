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
  function preview(img) {
    if (!img || img.closest('a') || doc.querySelector('.lb-mask')) return;
    var readingX = scrollX, readingY = scrollY;
    var mask = doc.createElement('dialog'), full = doc.createElement('img'), button = doc.createElement('button');
    mask.className = 'lb-mask';
    mask.setAttribute('aria-label', '图片预览');
    full.src = img.getAttribute('data-src') || img.src; full.alt = img.alt || '文章中的聊天记录';
    button.type = 'button'; button.className = 'lb-close'; button.textContent = '×'; button.setAttribute('aria-label', '关闭图片预览');
    var hint = doc.createElement('span'); hint.className = 'lb-hint'; hint.textContent = '点击空白处或按 Esc 关闭';
    mask.append(button, full, hint);
    var previousOverflow = doc.body.style.overflow, closing = false;
    doc.body.appendChild(mask); mask.showModal(); doc.body.style.overflow = 'hidden'; button.focus({preventScroll: true});
    function close() {
      if (closing) return;
      closing = true; mask.classList.add('is-closing');
      setTimeout(function () {
        mask.close(); mask.remove(); doc.body.style.overflow = previousOverflow; img.focus({preventScroll: true});
        scrollTo({left: readingX, top: readingY, behavior: 'instant'});
      }, reduce.matches ? 0 : 140);
    }
    mask.addEventListener('click', function (e) { if (e.target !== full) close(); });
    mask.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    mask.addEventListener('keydown', function (e) { e.stopPropagation(); });
  }
  if (body) {
    body.querySelectorAll('img').forEach(function (img) {
      if (img.closest('a')) return;
      img.tabIndex = 0; img.setAttribute('role', 'button'); img.setAttribute('aria-label', '放大图片' + (img.alt ? '：' + img.alt : ''));
    });
    body.addEventListener('click', function (e) { preview(e.target.closest('img')); });
    body.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'IMG' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); e.stopPropagation(); preview(e.target);
      }
    });
  }
})();
