/* Revenue Bench custom cursor, v2 (2026-10 refresh): a dot plus a spring ring
   that says what a click will do.
   - Buttons (.btn): the button leans toward the pointer and the ring wraps it.
   - Cards with data-cursor="Label": the ring becomes a pill with that label,
     in the card's practice colour (--pc).
   - Guide cards (.rel): a "Read guide" pill.
   - Any other link: the ring grows and fills violet, so a link always reads as a link.
   - Dark sections: the dot inverts on its own (mix-blend-mode), the ring turns light.
   Desktop pointer devices only; respects prefers-reduced-motion; off on the
   guides (/guides/), which are reading pages. Self-contained: injects its own
   styles. One <script defer src="assets/cursor.js"> per page. */
(function () {
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!fine.matches || reduced.matches) return;
  if (/\/guides\//.test(location.pathname)) return;

  var style = document.createElement('style');
  style.textContent =
    'html.has-custom-cursor, html.has-custom-cursor * { cursor: none; }' +
    'html.has-custom-cursor input, html.has-custom-cursor textarea, html.has-custom-cursor select,' +
    'html.has-custom-cursor [contenteditable="true"] { cursor: auto; }' +
    '.rb-cursor { position: fixed; inset: 0; z-index: 9999; pointer-events: none; opacity: 0; transition: opacity .2s; }' +
    '.rb-cursor.is-visible { opacity: 1; }' +
    '.rb-cursor-ring { position: absolute; left: 0; top: 0; width: 34px; height: 34px; border-radius: 999px;' +
    '  border: 1.5px solid rgba(14,23,38,.5); display: flex; align-items: center; justify-content: center;' +
    '  transition: width .35s cubic-bezier(.2,.8,.2,1), height .35s cubic-bezier(.2,.8,.2,1), border-radius .35s,' +
    '    background-color .3s, border-color .3s, opacity .3s; will-change: transform; }' +
    '.rb-cursor-ring span { font: 600 12px/1 Inter, system-ui, sans-serif; color: #fff; white-space: nowrap; opacity: 0; transition: opacity .2s; }' +
    '.rb-cursor-dot { position: absolute; left: 0; top: 0; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%;' +
    '  background: #fff; mix-blend-mode: difference; transition: transform .2s, opacity .2s; }' +
    '.rb-cursor.on-dark .rb-cursor-ring { border-color: rgba(255,255,255,.55); }' +
    '.rb-cursor.is-label .rb-cursor-ring { border-color: transparent; background: var(--cc, #0B1A2E); }' +
    '.rb-cursor.is-label .rb-cursor-ring span { opacity: 1; }' +
    '.rb-cursor.is-label .rb-cursor-dot { opacity: 0; }' +
    '.rb-cursor.is-magnet .rb-cursor-ring { border-color: var(--cb, rgba(14,23,38,.6)); }' +
    '.rb-cursor.is-magnet .rb-cursor-dot { transform: scale(.5); }' +
    '.rb-cursor.is-down .rb-cursor-dot { transform: scale(.5); }' +
    '.rb-cursor.is-field .rb-cursor-ring, .rb-cursor.is-field .rb-cursor-dot { opacity: 0; }' +
    '.rb-cursor.is-link .rb-cursor-ring { border-color: #7B6CF0; background: rgba(123,108,240,.16); }' +
    '.rb-cursor.is-link.on-dark .rb-cursor-ring { border-color: #A79CF8; background: rgba(167,156,248,.2); }' +
    '.rb-cursor.is-link .rb-cursor-dot { transform: scale(1.5); }';
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.className = 'rb-cursor';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<div class="rb-cursor-ring"><span></span></div><div class="rb-cursor-dot"></div>';
  document.body.appendChild(root);
  document.documentElement.classList.add('has-custom-cursor');
  var ring = root.firstChild, label = ring.firstChild, dot = root.lastChild;

  var DARK = '.bg-navy, .cta-band, .footer, .statline, .guarantee, .wash';
  var mx = -100, my = -100, rx = -100, ry = -100;
  var mode = '', magnet = null;

  function release() { if (magnet) { magnet.style.transform = ''; magnet = null; } }

  window.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    root.classList.add('is-visible');
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    root.classList.toggle('on-dark', !!t.closest(DARK));
    var field = t.closest('input, textarea, select, [contenteditable="true"]');
    var btn = t.closest('.btn');
    var lab = t.closest('[data-cursor], .rel');
    var link = t.closest('a, button, [role="button"], summary, label');
    root.classList.toggle('is-field', !!field);
    if (btn && !field) {
      mode = 'magnet';
      if (magnet !== btn) { release(); magnet = btn; }
      var dark = !!btn.closest(DARK) && !btn.closest('.form');
      root.style.setProperty('--cb', dark ? 'rgba(255,255,255,.75)' : 'rgba(14,23,38,.6)');
    } else {
      release();
      if (lab) {
        mode = 'label';
        label.textContent = lab.getAttribute('data-cursor') || 'Read guide';
        var pc = getComputedStyle(lab).getPropertyValue('--pc').trim();
        root.style.setProperty('--cc', pc && !lab.classList.contains('rel') ? pc : '#0B1A2E');
      } else mode = link ? 'link' : '';
    }
    root.classList.toggle('is-magnet', mode === 'magnet');
    root.classList.toggle('is-label', mode === 'label');
    root.classList.toggle('is-link', mode === 'link');
  });
  window.addEventListener('mousedown', function () { root.classList.add('is-down'); });
  window.addEventListener('mouseup', function () { root.classList.remove('is-down'); });
  document.addEventListener('mouseleave', function () { root.classList.remove('is-visible'); release(); });

  function frame() {
    var tx = mx, ty = my, w = '', h = '', rad = '', k = 0.2;
    if (mode === 'magnet' && magnet) {
      var b = magnet.getBoundingClientRect();
      var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      var dx = mx - cx, dy = my - cy;
      magnet.style.transform = 'translate(' + (dx * 0.18).toFixed(1) + 'px,' + (dy * 0.28).toFixed(1) + 'px)';
      tx = cx + dx * 0.18; ty = cy + dy * 0.28;
      w = (b.width + 12) + 'px'; h = (b.height + 12) + 'px'; rad = (b.height / 2 + 6) + 'px'; k = 0.25;
    } else if (mode === 'link') {
      w = '50px'; h = '50px'; rad = '999px'; k = 0.3;
    } else if (mode === 'label') {
      w = Math.max(96, label.offsetWidth + 30) + 'px'; h = '34px'; rad = '17px'; k = 0.22;
    }
    rx += (tx - rx) * k; ry += (ty - ry) * k;
    ring.style.width = w; ring.style.height = h; ring.style.borderRadius = rad;
    ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-50%)';
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
