/* Revenue Bench custom cursor — gold dot + trailing ring.
   Desktop pointer devices only; respects prefers-reduced-motion.
   Self-contained: injects its own styles, no CSS file changes needed. */
(function () {
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!fine.matches || reduced.matches) return;

  var style = document.createElement('style');
  style.textContent =
    'html.has-custom-cursor, html.has-custom-cursor * { cursor: none; }' +
    'html.has-custom-cursor input, html.has-custom-cursor textarea,' +
    'html.has-custom-cursor [contenteditable="true"] { cursor: auto; }' +
    '.rb-cursor { position: fixed; inset: 0; z-index: 9999; pointer-events: none;' +
    '  opacity: 0; transition: opacity 0.2s; }' +
    '.rb-cursor.is-visible { opacity: 1; }' +
    '.rb-cursor-ring { position: absolute; width: 32px; height: 32px;' +
    '  margin: -16px 0 0 -16px; border-radius: 50%;' +
    '  border: 1.5px solid rgba(156, 111, 30, 0.9);' +
    '  background: rgba(156, 111, 30, 0); opacity: 0.8;' +
    '  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),' +
    '    opacity 0.25s, background-color 0.25s; }' +
    '.rb-cursor-dot { position: absolute; width: 6px; height: 6px;' +
    '  margin: -3px 0 0 -3px; border-radius: 50%; background: #9C6F1E;' +
    '  transition: transform 0.15s, opacity 0.15s; }' +
    '.rb-cursor.is-hover .rb-cursor-ring { transform: scale(1.6); opacity: 1;' +
    '  background: rgba(156, 111, 30, 0.14); }' +
    '.rb-cursor.is-hover .rb-cursor-dot { opacity: 0; }' +
    '.rb-cursor.is-down .rb-cursor-ring { transform: scale(0.8); }' +
    '.rb-cursor.is-down .rb-cursor-dot { transform: scale(0.5); }';
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.className = 'rb-cursor';
  root.setAttribute('aria-hidden', 'true');
  var ring = document.createElement('div');
  ring.className = 'rb-cursor-ring';
  var dot = document.createElement('div');
  dot.className = 'rb-cursor-dot';
  root.appendChild(ring);
  root.appendChild(dot);
  document.body.appendChild(root);
  document.documentElement.classList.add('has-custom-cursor');

  // Target = raw mouse position (dot). Ring chases it with spring physics.
  var tx = -100, ty = -100;      // target
  var rx = -100, ry = -100;      // ring position
  var vx = 0, vy = 0;            // ring velocity
  var STIFFNESS = 350, DAMPING = 28, MASS = 0.4;
  var last = null;

  function frame(now) {
    if (last === null) last = now;
    var dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    var ax = (-STIFFNESS * (rx - tx) - DAMPING * vx) / MASS;
    var ay = (-STIFFNESS * (ry - ty) - DAMPING * vy) / MASS;
    vx += ax * dt; vy += ay * dt;
    rx += vx * dt; ry += vy * dt;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
    dot.style.left = tx + 'px';
    dot.style.top = ty + 'px';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  var INTERACTIVE = "a, button, [role='button'], input, textarea, select, label, summary";

  window.addEventListener('mousemove', function (e) {
    tx = e.clientX; ty = e.clientY;
    root.classList.add('is-visible');
  });
  window.addEventListener('mouseover', function (e) {
    var t = e.target;
    root.classList.toggle('is-hover', !!(t && t.closest && t.closest(INTERACTIVE)));
  });
  window.addEventListener('mousedown', function () { root.classList.add('is-down'); });
  window.addEventListener('mouseup', function () { root.classList.remove('is-down'); });
  document.addEventListener('mouseleave', function () { root.classList.remove('is-visible'); });
})();
