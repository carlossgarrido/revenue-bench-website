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

  /* card fly-ins: any card group that starts below the fold arrives card by card */
  if (!reduce && 'IntersectionObserver' in window) {
    var groups = [].slice.call(document.querySelectorAll('.grid-2, .grid-3, .steps, .practices, .cadence, .role-grid, .ev-band, .omgband, .trust, .read-cards'))
      .filter(function (g) { return !g.classList.contains('bench-grid') && g.children.length > 1 && g.getBoundingClientRect().top > window.innerHeight * 0.9; });
    var fio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('fly-go'); fio.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    groups.forEach(function (g) {
      [].forEach.call(g.children, function (c, k) {
        c.classList.add('fly'); c.style.setProperty('--k', k);
        c.style.setProperty('--fr', ((k % 2 ? 1 : -1) * 1.6).toFixed(1) + 'deg');
      });
      g.classList.add('fly-arm'); fio.observe(g);
    });
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

  /* the Bench arrives one of two ways, picked at random per visit:
     "fade", the page darkens into navy as the section arrives, or
     "float", the cards float into place and draw a line to their practice */
  var wash = document.querySelector('.wash');
  var bench = document.getElementById('bench');
  var forced = (location.search.match(/bench=(fade|float)/) || [])[1];
  var benchMode = forced || (Math.random() < 0.5 ? 'fade' : 'float');
  if (bench && !reduce) {
    bench.setAttribute('data-bench', benchMode);
    if (benchMode === 'float') {
      if (wash) { wash.style.setProperty('--wt', '1'); wash = null; }
      var bgrid = bench.querySelector('.bench-grid');
      var bcards = bgrid ? [].slice.call(bgrid.querySelectorAll('.bench-card')) : [];
      bcards.forEach(function (c, k) {
        c.style.setProperty('--k', k);
        c.style.setProperty('--rot', ((k % 2 ? 1 : -1) * (1.5 + Math.random() * 2)).toFixed(1) + 'deg');
      });
      var drawLinks = function (animate) {
        var box = bench.querySelector('.container');
        var old = box.querySelector('.bench-links'); if (old) old.remove();
        if (window.innerWidth <= 920) return;
        var nodes = {};
        [].forEach.call(bench.querySelectorAll('.bench-nodes span'), function (n) { nodes[n.className] = n; });
        var b0 = box.getBoundingClientRect();
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg'); svg.setAttribute('class', 'bench-links'); svg.setAttribute('aria-hidden', 'true');
        bcards.forEach(function (c, k) {
          var prac = (c.className.match(/p-(sell|gtm|lead)/) || [])[0]; var n = nodes[prac]; if (!n) return;
          var nr = n.getBoundingClientRect(), cr = c.getBoundingClientRect();
          var x1 = nr.left + nr.width / 2 - b0.left, y1 = nr.bottom - b0.top;
          var x2 = cr.left + cr.width / 2 - b0.left, y2 = cr.top - b0.top + 2;
          var my = y1 + (y2 - y1) * 0.5;
          var path = document.createElementNS(ns, 'path');
          path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2);
          path.setAttribute('stroke', getComputedStyle(c).getPropertyValue('--pc').trim() || '#fff');
          svg.appendChild(path);
          if (animate) {
            var len = path.getTotalLength ? 0 : 0;
            requestAnimationFrame(function () {
              len = path.getTotalLength();
              path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
              path.getBoundingClientRect();
              path.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1) ' + (k * 110 + 350) + 'ms';
              path.style.strokeDashoffset = 0;
            });
          }
        });
        box.insertBefore(svg, box.firstChild);
      };
      if (bgrid && 'IntersectionObserver' in window) {
        var bio = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) {
              bgrid.classList.add('floated'); bio.disconnect();
              setTimeout(function () { drawLinks(true); }, 900);
              var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { drawLinks(false); }, 150); });
            }
          });
        }, { threshold: 0.2 });
        bio.observe(bgrid);
      } else if (bgrid) bgrid.classList.add('floated');
    }
  }

  /* the nine pillars: as the page scrolls, talent flows out along the base from the
     center pillar and fills each pillar in turn, nearest first, lifting it to Revenue */
  var nine = document.querySelector('.ninecol');
  var pillarsSec = document.querySelector('.pillars-sec');
  var setPillars = function () {};
  if (nine && pillarsSec) {
    var pcols = [].slice.call(nine.querySelectorAll('.col'));
    var mid = pcols.findIndex(function (c) { return c.classList.contains('talent'); });
    if (reduce) { nine.classList.add('up'); }
    else {
      pillarsSec.classList.add('pin');
      pcols.forEach(function (c) { if (!c.classList.contains('talent')) c.style.setProperty('--f', '0'); });
      nine.style.setProperty('--s', '0');
      var track = pillarsSec.querySelector('.pillars-track');
      setPillars = function (vh) {
        var r = track.getBoundingClientRect(), span = track.offsetHeight - vh;
        var p = span > 0 ? clamp(-r.top / span) : 1;
        nine.style.setProperty('--s', clamp(p / 0.5).toFixed(3));
        pcols.forEach(function (c, i) {
          if (i === mid) return;
          var d = Math.abs(i - mid);
          var start = 0.04 + (d - 1) * 0.12;
          c.style.setProperty('--f', clamp((p - start) / 0.3).toFixed(3));
        });
        nine.classList.toggle('up', p > 0.86);
      };
    }
  }

  /* About: the city skylines draw themselves in */
  var sky = document.querySelector('.skylines');
  if (sky) {
    if (reduce || !('IntersectionObserver' in window)) sky.classList.add('drawn');
    else {
      var sio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { sky.classList.add('drawn'); sio.disconnect(); } });
      }, { threshold: 0.3 });
      sio.observe(sky);
    }
  }

  /* closing cylinder: the words ride round a slowly turning drum */
  var cyl = document.querySelector('.cylinder');
  if (cyl && !reduce) {
    var build = function () {
      var text = cyl.getAttribute('data-text') || '';
      var probe = document.createElement('span');
      var ring = document.createElement('div'); ring.className = 'cyl-ring';
      ring.appendChild(probe); cyl.appendChild(ring);
      var chars = text.split(''), widths = [], total = 0;
      chars.forEach(function (ch) { probe.textContent = ch === ' ' ? ' ' : ch; var w = probe.getBoundingClientRect().width; widths.push(w); total += w; });
      ring.removeChild(probe);
      var R = total / (2 * Math.PI), acc = 0, spans = [], angles = [];
      var tint = function (i) {
        var before = text.slice(0, i + 1);
        var word = text.slice(text.lastIndexOf(' ', i) + 1, text.indexOf(' ', i) === -1 ? text.length : text.indexOf(' ', i));
        if (word === 'Sell') return 't-sell'; if (word === 'GTM') return 't-gtm'; if (word === 'Lead') return 't-lead'; return '';
      };
      chars.forEach(function (ch, i) {
        var s = document.createElement('span');
        s.textContent = ch === ' ' ? ' ' : ch;
        var cls = tint(i); if (cls) s.className = cls;
        var a = (acc + widths[i] / 2) / total * 360; acc += widths[i];
        s.style.transform = 'rotateY(' + a + 'deg) translateZ(' + R + 'px) translate(-50%,-50%)';
        ring.appendChild(s); spans.push(s); angles.push(a);
      });
      var st = cyl.querySelector('.cyl-static'); if (st) st.style.display = 'none';
      var turn = 0, last = null, running = false;
      function tick(now) {
        if (!running) { last = null; return; }
        if (last !== null) turn = (turn + (now - last) * 0.012) % 360;
        last = now;
        ring.style.transform = 'rotateX(-8deg) rotateY(' + (-turn) + 'deg)';
        for (var i = 0; i < spans.length; i++) {
          var f = Math.cos((angles[i] - turn) * Math.PI / 180);
          spans[i].style.opacity = (0.1 + 0.9 * Math.max(0, f)).toFixed(2);
        }
        requestAnimationFrame(tick);
      }
      var cio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !running) { running = true; requestAnimationFrame(tick); }
          else if (!e.isIntersecting) running = false;
        });
      });
      cio.observe(cyl);
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build); else build();
  }

  /* people hero: the artwork drifts a little slower than the page */
  var heroArt = document.querySelector('.hero-art');

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
    setPillars(vh);
    if (heroArt && !reduce && window.scrollY < vh * 1.2) heroArt.style.transform = 'translate3d(0,' + (window.scrollY * 0.14).toFixed(1) + 'px,0)';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
})();
