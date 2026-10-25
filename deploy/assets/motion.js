/* Revenue Bench motion layer (2026-10 refresh).
   Marketing pages only; the guides do not load it.
   Adds html.mo, which is the switch site.css uses for every pinned or animated
   state, so without this script each page is complete and static.
   Pieces: headline word reveal, card spotlight, roles band loop, the failure
   curve on the homepage, the navy fade into the Bench, and the nav colour over
   a navy hero. Reduced motion keeps the content and drops the movement. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('mo');

  function clamp(v) { return Math.max(0, Math.min(1, v)); }

  /* headline word reveal: wrap each word in .w > .wi, keeping inner markup */
  function splitWords(el) {
    var i = 0;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var parts = node.nodeValue.split(/(\s+)/);
      var frag = document.createDocumentFragment();
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
        var w = document.createElement('span'); w.className = 'w';
        var wi = document.createElement('span'); wi.className = 'wi';
        wi.style.setProperty('--i', i++);
        wi.textContent = p; w.appendChild(wi); frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
  }
  var heads = [].slice.call(document.querySelectorAll('h1, h2.h-lg, h2.h-xl, .cta-grid h2, .cand h2'));
  if (!reduce && 'IntersectionObserver' in window) {
    heads.forEach(splitWords);
    var hio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('wr-play'); hio.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    heads.forEach(function (h) { hio.observe(h); });
  }

  /* card spotlight: a soft light follows the pointer */
  [].forEach.call(document.querySelectorAll('.bench-card, .card, .proof-card, .serve-card, .step'), function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* roles band: duplicate once so the loop has no seam */
  var track = document.querySelector('.roleband-track');
  if (track) {
    [].slice.call(track.children).forEach(function (li) {
      var c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c);
    });
  }

  /* failure curve: 100 hires; coral dots are first-year failures */
  var curve = document.getElementById('failure-curve');
  var setStage = function () {};
  if (curve) {
    var dotsEl = curve.querySelector('.dots'), big = curve.querySelector('.bignum');
    var stageBtns = [].slice.call(curve.querySelectorAll('.stage'));
    var counts = [33, 9, 4];
    var labels = ['33%', '9%', 'under 5%'];
    var subs = ['fail in year one', 'fail when assessed first', 'fail when assessed and coached'];
    var order = [], seed = 7, i, j, tmp;
    for (i = 0; i < 100; i++) order.push(i);
    for (i = 99; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; j = Math.floor(seed / 233280 * (i + 1)); tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    var rank = []; order.forEach(function (v, idx) { rank[v] = idx; });
    var dots = [];
    for (i = 0; i < 100; i++) { var d = document.createElement('i'); d.style.setProperty('--d', (rank[i] % 33) * 14 + 'ms'); dotsEl.appendChild(d); dots.push(d); }
    var cur = -1;
    setStage = function (s) {
      if (s === cur) return; cur = s;
      dots.forEach(function (d, idx) { d.classList.toggle('f', rank[idx] < counts[s]); });
      big.innerHTML = labels[s] + '<small>' + subs[s] + '</small>';
      stageBtns.forEach(function (b, bi) { b.classList.toggle('on', bi === s); b.setAttribute('aria-pressed', bi === s ? 'true' : 'false'); });
    };
    setStage(0);
    stageBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var s = +b.getAttribute('data-stage');
        var top = curve.getBoundingClientRect().top + window.scrollY;
        var span = curve.offsetHeight - window.innerHeight;
        if (span > 0) window.scrollTo({ top: top + span * (s / 3 + 0.12), behavior: reduce ? 'auto' : 'smooth' });
        setStage(s);
      });
    });
  }

  var wash = document.querySelector('.wash');
  var nav = document.querySelector('.site-nav');
  var darkHero = document.body.classList.contains('dark-top') ? document.querySelector('.hero') : null;

  function onScroll() {
    var vh = window.innerHeight;
    if (curve) {
      var r = curve.getBoundingClientRect(), span = curve.offsetHeight - vh;
      if (span > 0 && r.top <= 0 && r.bottom >= vh) { var p = clamp(-r.top / span); setStage(p < 0.36 ? 0 : p < 0.7 ? 1 : 2); }
      else if (r.top > 0) setStage(0);
    }
    if (wash) {
      var t = reduce ? 1 : clamp((vh - wash.getBoundingClientRect().top) / (vh * 0.5));
      wash.style.setProperty('--wt', t.toFixed(3));
    }
    if (nav && darkHero) nav.classList.toggle('scrolled', darkHero.getBoundingClientRect().bottom < 72);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
})();
