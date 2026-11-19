/* Vice City Hub: the Leonida map tracker, the shareable card, the street-name and bingo tools, the unlock clock.
   Everything runs on the visitor's device. No requests to other sites; progress is kept in localStorage. */
(function () {
  'use strict';

  var SITE = 'https://vicecityhub.okenshop.com/';
  var LEVELS = ['Not yet', 'Passed through', 'Explored', 'Done 100%'];

  function ellipse(cx, cy, rx, ry) {
    return 'M' + (cx - rx) + ' ' + cy + 'a' + rx + ' ' + ry + ' 0 1 0 ' + (2 * rx) + ' 0a' + rx + ' ' + ry + ' 0 1 0 ' + (-2 * rx) + ' 0Z';
  }

  // Our own sketch. Rockstar places Mount Kalaga on the northern border and Ambrosia in the heart of Leonida; the
  // other positions (Port Gellhorn west, Vice City southeast, Grassrivers southwest, the Keys south) follow fan maps.
  // viewBox 600 x 740. Every border is drawn once as an edge, smoothed into curves, and shared by the regions on both
  // sides, so neighbours always meet exactly. Coast edges carry more points so the shoreline wanders a little.
  var EDGES = {
    kWest:  [[150, 150], [100, 150], [62, 140], [44, 104], [30, 62]],
    kNorth: [[30, 62], [190, 50], [360, 56], [562, 50]],
    kEast:  [[562, 50], [566, 150]],
    kV:     [[566, 150], [470, 166], [360, 176]],
    kA:     [[360, 176], [305, 166], [250, 170]],
    kG:     [[250, 170], [200, 166], [150, 150]],
    gA:     [[250, 170], [296, 236], [290, 330]],
    gGr:    [[290, 330], [268, 352], [250, 360]],
    gCoast: [[250, 360], [234, 334], [214, 298], [196, 258], [176, 228], [140, 196], [128, 174], [150, 150]],
    aV:     [[360, 176], [418, 232], [430, 340]],
    aGr:    [[430, 340], [376, 398], [290, 330]],
    vGr:    [[430, 340], [452, 450], [486, 556], [544, 556]],
    vCoast: [[566, 150], [580, 222], [570, 300], [582, 372], [562, 440], [558, 500], [544, 556]],
    grCoast:[[544, 556], [506, 604], [458, 626], [410, 620], [368, 612], [332, 590], [304, 558], [290, 520], [276, 482], [264, 440], [250, 360]]
  };
  // Catmull-Rom through an edge's points, as cubic Bezier segments [start, c1, c2, end]; the ends stay fixed.
  function curve(pts) {
    var segs = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
      segs.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
    }
    return segs;
  }
  function r1(n) { return Math.round(n * 10) / 10; }
  // A region is a loop of edges; a leading "-" walks that edge backwards.
  function outline(names) {
    var d = '';
    names.forEach(function (nm, k) {
      var back = nm.charAt(0) === '-', segs = curve(EDGES[back ? nm.slice(1) : nm]);
      if (back) segs = segs.reverse().map(function (s) { return [s[3], s[2], s[1], s[0]]; });
      if (!k) d += 'M' + r1(segs[0][0][0]) + ' ' + r1(segs[0][0][1]);
      segs.forEach(function (s) { d += 'C' + [s[1], s[2], s[3]].map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join(' '); });
    });
    return d + 'Z';
  }
  var REGIONS = [
    { id: 'kalaga', name: 'Mount Kalaga', full: 'Mount Kalaga National Park', label: [300, 104],
      d: outline(['kWest', 'kNorth', 'kEast', 'kV', 'kA', 'kG']) },
    { id: 'gellhorn', name: 'Port Gellhorn', full: 'Port Gellhorn', label: [212, 238], two: true,
      d: outline(['-kG', 'gA', 'gGr', 'gCoast']) },
    { id: 'ambrosia', name: 'Ambrosia', full: 'Ambrosia', label: [345, 228],
      d: outline(['-kA', 'aV', 'aGr', '-gA']) },
    { id: 'vice', name: 'Vice City', full: 'Vice City', label: [505, 318],
      d: outline(['-kV', 'vCoast', '-vGr', '-aV']) },
    { id: 'grass', name: 'Grassrivers', full: 'Grassrivers', label: [384, 506],
      d: outline(['-gGr', '-aGr', 'vGr', 'grCoast']) },
    { id: 'keys', name: 'Leonida Keys', full: 'Leonida Keys', label: [190, 690],
      hit: 'M112 642L512 628L516 724L112 724Z',
      d: ellipse(474, 652, 28, 10) + ellipse(424, 672, 24, 9) + ellipse(376, 688, 22, 9) + ellipse(328, 699, 20, 8) + ellipse(282, 707, 18, 8) }
  ];
  var LAKE = ellipse(368, 296, 24, 34);

  var THEMES = {
    night:   { bg: '#0E1311', bg2: '#0E1311', sea: '#10232A', grid: 'rgba(244,241,234,.06)', ink: '#F4F1EA', ink2: '#B4BDB8', accent: '#FF5FA2', edge: '#0E1311',
               fill: ['#26302B', '#3E2B40', '#5E2F55', '#7D3B62'], onFull: '#0E1311', lake: '#10232A', darkFrom: 4, done: '#FFC35A', line: 'rgba(244,241,234,.14)' },
    sunset:  { bg: '#2A0F22', bg2: '#5E1F2C', sea: '#3A1630', grid: 'rgba(255,214,170,.07)', ink: '#FFF3E4', ink2: '#F2C9B0', accent: '#FFC35A', edge: '#2A0F22',
               fill: ['#47243A', '#8A3A3E', '#D46A3C', '#FFC35A'], onFull: '#2A0F22', lake: '#3A1630', darkFrom: 3, done: '#FFF3E4', line: 'rgba(255,243,228,.16)' },
    highway: { bg: '#0B6B3A', bg2: '#0B6B3A', sea: '#095A31', grid: 'rgba(255,255,255,.07)', ink: '#FFFFFF', ink2: '#D6EEDF', accent: '#FFFFFF', edge: '#0B6B3A',
               fill: ['#0F7F46', '#3E9A68', '#9FCDB2', '#FFFFFF'], onFull: '#0B6B3A', lake: '#095A31', darkFrom: 2, done: '#FFC35A', line: 'rgba(255,255,255,.2)' }
  };
  // Dusk to deep berry: each step reads as progress, and a finished region is calm to look at, with a gold edge as the reward.
  var MAP_FILL = ['#26302B', '#3E2B40', '#5E2F55', '#7D3B62'];

  // Ranks by steps (6 regions x 3 levels = 18).
  var RANKS = [[0, 'Still in the menu'], [1, 'Tourist'], [4, 'Local'], [9, 'Hustler'], [13, 'Kingpin'], [18, 'Leonida legend']];

  // ---- storage (may be blocked: private mode, embedded previews) ----
  function load(key, fallback) { try { var v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* nothing to do */ } }

  // ---- keeping progress: ask the browser to keep this site's storage, restore from a progress link, warn when it won't stick ----
  var storageWorks = (function () { try { localStorage.setItem('vch.t', '1'); localStorage.removeItem('vch.t'); return true; } catch (e) { return false; } })();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* not supported */ }
  // In-app browsers (Instagram, Facebook, TikTok, Snapchat...) often throw away site data when you close them.
  var inApp = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|TikTok|musical_ly|Snapchat|Twitter|Pinterest|; wv\)/i.test(navigator.userAgent || '');
  function progressCode() {
    var o = {};
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('vch.') === 0) o[k] = localStorage.getItem(k); } } catch (e) { /* blocked */ }
    return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function progressLink() { return location.origin + location.pathname + '#p=' + progressCode(); }
  // Opening a progress link (#p=...) copies that progress into this browser, then tidies the address.
  var restored = (function () {
    var m = /#p=([A-Za-z0-9_-]+)/.exec(location.hash || '');
    if (!m) return false;
    try {
      var o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      Object.keys(o).forEach(function (k) { if (/^vch\.[a-zA-Z]+$/.test(k) && typeof o[k] === 'string' && o[k].length < 400) save(k, o[k]); });
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    } catch (e) { return false; }
  })();

  var levels = (function () {
    var s = load('vch.map', '000000');
    return /^[0-3]{6}$/.test(s) ? s.split('').map(Number) : [0, 0, 0, 0, 0, 0];
  })();

  function code() { return levels.join(''); }
  function steps() { var t = 0; levels.forEach(function (l) { t += l; }); return t; }
  function pctOf(n) { return Math.round(n / 18 * 100); }
  function score() { return pctOf(steps()); }
  function visited() { return levels.filter(function (l) { return l > 0; }).length; }
  function rankIndex(n) { var r = 0; RANKS.forEach(function (x, i) { if (n >= x[0]) r = i; }); return r; }
  function rank(n) { return tr(RANKS[rankIndex(n === undefined ? steps() : n)][1]); }

  // ---- language: English by default; Spanish and Portuguese from ?lang=, a saved choice, or the browser ----
  // Translations load only for Spanish and Portuguese visitors (hub/i18n.js), so English pages stay light.
  var SUPPORTED = { en: 1, es: 1, pt: 1 };
  function dict() { return (window.VCH_I18N || {})[LANG] || {}; }
  var LANG = (function () {
    var q = '';
    try { q = (new URLSearchParams(location.search).get('lang') || '').toLowerCase(); } catch (e) { /* old browser */ }
    var saved = load('vch.lang', '');
    var nav = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').slice(0, 2).toLowerCase();
    var pick = [q, saved, nav].filter(function (l) { return SUPPORTED[l]; })[0] || 'en';
    if (q && SUPPORTED[q]) save('vch.lang', q);
    return pick;
  })();
  function tr(en, vars) {
    var out = (LANG !== 'en' && dict()[en]) || en;
    if (vars) for (var k in vars) out = out.split('{' + k + '}').join(vars[k]);
    return out;
  }
  // Swap the page's own English text for the chosen language: text nodes, then labels and placeholders.
  // A label like "Vice City: Explored" is translated part by part.
  function translatePage() {
    document.documentElement.lang = LANG;
    if (LANG === 'en') return;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n, todo = [];
    while ((n = w.nextNode())) todo.push(n);
    todo.forEach(function (node) {
      var raw = node.textContent, key = raw.replace(/\s+/g, ' ').trim();
      if (!key || !dict()[key]) return;
      node.textContent = raw.replace(raw.trim(), dict()[key]);
    });
    ['aria-label', 'placeholder', 'alt'].forEach(function (attr) {
      document.querySelectorAll('[' + attr + ']').forEach(function (e) {
        var v = e.getAttribute(attr);
        e.setAttribute(attr, v.split(': ').map(function (part) { return tr(part); }).join(': '));
      });
    });
    var tt = dict()['@title' + (document.body.dataset.page ? ':' + document.body.dataset.page : '')]; if (tt) document.title = tt;
  }
  function bindLang() {
    document.querySelectorAll('[data-lang]').forEach(function (a) {
      if (a.getAttribute('data-lang') === LANG) a.setAttribute('aria-current', 'true');
      a.addEventListener('click', function () { save('vch.lang', a.getAttribute('data-lang')); });
    });
  }

  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // ---- toast ----
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    t.classList.remove('is-in'); void t.offsetWidth; t.classList.add('is-in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.hidden = true; }, 250); }, 3800);
  }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) { /* not supported */ } }

  // ---- the map ----
  var groups = [], labels = [], lakeEl = null, routeG = null, pctEl = null;
  // Where a region's route dot sits: just above its name, so the dot never covers the label.
  function anchorOf(r) { return [r.label[0], r.label[1] - 40]; }

  function buildMap() {
    var svg = $('map');
    var defs = el('defs', {}, svg);
    var fog = el('pattern', { id: 'fog', width: 12, height: 12, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(40)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 12, stroke: 'rgba(244,241,234,.16)', 'stroke-width': 3 }, fog);
    var stip = el('pattern', { id: 'stipple', width: 14, height: 14, patternUnits: 'userSpaceOnUse' }, defs);
    el('circle', { cx: 3, cy: 3, r: 1.1, fill: 'rgba(143,179,191,.25)' }, stip);
    el('rect', { x: 0, y: 0, width: 600, height: 740, rx: 18, fill: '#0F1F25' }, svg);
    el('rect', { x: 0, y: 0, width: 600, height: 740, rx: 18, fill: 'url(#stipple)' }, svg);
    var grid = el('g', { stroke: 'rgba(244,241,234,.05)', 'stroke-width': 1 }, svg);
    for (var x = 50; x < 600; x += 50) el('line', { x1: x, y1: 0, x2: x, y2: 740 }, grid);
    for (var y = 50; y < 740; y += 50) el('line', { x1: 0, y1: y, x2: 600, y2: y }, grid);
    // The coastal shelf: a pale halo round the whole state, so its outline reads from across the room.
    var shelf = el('g', { 'pointer-events': 'none' }, svg);
    REGIONS.forEach(function (r) {
      el('path', { d: r.d, fill: 'rgba(143,179,191,.10)', stroke: 'rgba(143,179,191,.22)', 'stroke-width': 30, 'stroke-linejoin': 'round' }, shelf);
    });
    el('text', { class: 'map-title', x: 22, y: 40 }, svg).textContent = 'LEONIDA';
    pctEl = el('text', { class: 'map-pct', x: 578, y: 40 }, svg);
    REGIONS.forEach(function (r, i) {
      var g = el('g', { class: 'rg', tabindex: 0, role: 'button', 'data-i': i }, svg);
      el('path', { d: r.d, class: 'shape' }, g);
      el('path', { d: r.d, class: 'fog', fill: 'url(#fog)' }, g);
      if (r.hit) el('path', { d: r.hit, class: 'hit' }, g);
      g.addEventListener('click', function () { deeper(i); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); deeper(i); return; }
        // Arrow keys walk the regions in list order; Home and End jump to the first and last. Tab order is unchanged.
        var to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: REGIONS.length - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        groups[(to + REGIONS.length) % REGIONS.length].focus();
      });
      groups.push(g);
    });
    lakeEl = el('path', { d: LAKE, fill: '#0F1F25', stroke: '#0E1311', 'stroke-width': 3, 'pointer-events': 'none' }, svg);
    el('text', { x: 368, y: 300, 'text-anchor': 'middle', fill: '#8FB3BF', 'font-size': 12, 'font-family': 'DM Sans, sans-serif', 'font-weight': 600, 'pointer-events': 'none' }, svg).textContent = tr('Lake');
    routeG = el('g', { 'pointer-events': 'none' }, svg);
    // Names sit above the route, so the dotted line never runs through a label.
    REGIONS.forEach(function (r) {
      var lg = el('g', { class: 'rl', 'pointer-events': 'none' }, svg);
      var lx = r.label[0], ly = r.label[1];
      if (r.two) {
        var parts = r.name.split(' ');
        el('text', { x: lx, y: ly - 10, 'text-anchor': 'middle' }, lg).textContent = parts[0];
        el('text', { x: lx, y: ly + 14, 'text-anchor': 'middle' }, lg).textContent = parts.slice(1).join(' ');
        el('text', { class: 'lvl', x: lx, y: ly + 36, 'text-anchor': 'middle' }, lg);
      } else {
        el('text', { x: lx, y: ly, 'text-anchor': 'middle' }, lg).textContent = r.name;
        el('text', { class: 'lvl', x: lx, y: ly + 22, 'text-anchor': 'middle' }, lg);
      }
      labels.push(lg);
    });
    var cp = el('g', { class: 'compass', transform: 'translate(552 684)' }, svg);
    el('circle', { r: 24, fill: 'rgba(15,31,37,.85)', stroke: 'rgba(244,241,234,.35)', 'stroke-width': 1.5 }, cp);
    el('path', { d: 'M0 -18L6 0L0 -4L-6 0Z', fill: '#FF5FA2' }, cp);
    el('path', { d: 'M0 18L6 0L0 4L-6 0Z', fill: 'rgba(244,241,234,.5)' }, cp);
    el('text', { x: 0, y: -30, 'text-anchor': 'middle' }, cp).textContent = 'N';
  }

  // Your route: a dashed neon line through every region you have touched, in map order.
  function drawRoute() {
    while (routeG.firstChild) routeG.removeChild(routeG.firstChild);
    var pts = [];
    levels.forEach(function (l, i) { if (l) pts.push(anchorOf(REGIONS[i])); });
    if (pts.length > 1) el('polyline', { class: 'route', points: pts.map(function (p) { return p.join(','); }).join(' ') }, routeG);
    pts.forEach(function (p) { el('circle', { class: 'route-dot', cx: p[0], cy: p[1], r: 6 }, routeG); });
  }

  function bindList() {
    var rows = $('region-list').children;
    Array.prototype.forEach.call(rows, function (li, i) {
      li.querySelectorAll('button').forEach(function (b) {
        var k = Number(b.dataset.k);
        b.addEventListener('click', function () { setLevel(i, levels[i] === k ? k - 1 : k); });
      });
    });
  }

  // A map tap goes one step deeper and stops at 100%, so a stray tap never wipes a finished region.
  function deeper(i) {
    if (levels[i] === 3) { toast(tr('{name} is already 100%. To lower it, use the list.', { name: REGIONS[i].full })); return; }
    setLevel(i, levels[i] + 1);
  }

  function setLevel(i, lvl) {
    var before = steps();
    levels[i] = lvl;
    save('vch.map', code());
    render();
    var p = groups[i].querySelector('.shape');
    p.classList.remove('pop'); void p.getBoundingClientRect(); p.classList.add('pop');
    var after = steps();
    if (rankIndex(after) > rankIndex(before)) {
      buzz();
      toast(after === 18 ? tr('Rank up: Leonida legend. You have seen it all.') : tr('Rank up: {rank}. {n}% of Leonida seen.', { rank: rank(after), n: score() }));
      var m = $('meter'); m.classList.remove('flash'); void m.offsetWidth; m.classList.add('flash');
    }
  }

  function render() {
    var n = steps(), p = pctOf(n), ri = rankIndex(n);
    groups.forEach(function (g, i) {
      var lvl = levels[i];
      var start = n === 0 && REGIONS[i].id === 'vice';
      g.dataset.level = lvl;
      g.querySelector('.shape').setAttribute('fill', MAP_FILL[lvl]);
      labels[i].dataset.level = lvl;
      labels[i].classList.toggle('start', start);
      labels[i].querySelector('.lvl').textContent = lvl ? tr(LEVELS[lvl]) : (start ? tr('Tap to start') : '');
      g.classList.toggle('start', start);
      if (start && g.nextSibling !== lakeEl) g.parentNode.insertBefore(g, lakeEl); // dashed outline drawn above its neighbours
      g.setAttribute('aria-label', tr('{name}, {level}. Select to raise the level.', { name: REGIONS[i].full, level: tr(LEVELS[lvl]) }));
    });
    var rows = $('region-list').children;
    for (var i = 0; i < rows.length; i++) {
      rows[i].dataset.level = levels[i];
      var bs = rows[i].querySelectorAll('button');
      for (var j = 0; j < bs.length; j++) {
        var k = Number(bs[j].dataset.k);
        bs[j].setAttribute('aria-pressed', String(k === levels[i]));
        bs[j].classList.toggle('is-reached', k < levels[i]);
      }
    }
    $('pct').textContent = p;
    pctEl.textContent = tr('{n}% seen', { n: p });
    drawRoute();
    $('rank').textContent = tr(RANKS[ri][1]);
    $('meter-sub').textContent = tr('{v} of 6 regions · {n} of 18 steps', { v: visited(), n: n });
    var next = RANKS[ri + 1];
    var from = RANKS[ri][0];
    $('xp').style.transform = 'scaleX(' + (next ? (n - from) / (next[0] - from) : 1) + ')';
    $('next-rank').textContent = next ? tr(next[0] - n === 1 ? '1 step to {rank}' : '{n} steps to {rank}', { n: next[0] - n, rank: tr(next[1]) }) : tr('Every region done. Respect.');
    updateChallenge();
    drawSoon();
  }

  // ---- a friend's challenge (?c=320100&n=Name) ----
  var rival = null;
  function readChallenge() {
    var q = new URLSearchParams(location.search);
    var c = q.get('c');
    if (!c || !/^[0-3]{6}$/.test(c)) return;
    var t = 0; c.split('').forEach(function (d) { t += Number(d); });
    var n = (q.get('n') || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || tr('Your friend');
    rival = { name: n, pct: pctOf(t), levels: c.split('').map(Number) };
    $('challenge-name').textContent = n;
    $('challenge-score').textContent = rival.pct + '%';
    $('challenge').hidden = false;
    $('kind-blend').hidden = false;
    $('blend-go').addEventListener('click', function () {
      settings.kind = 'blend';
      document.querySelectorAll('input[name="kind"]').forEach(function (r) { r.checked = r.value === 'blend'; });
      drawSoon();
      $('card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  function updateChallenge() {
    if (!rival) return;
    var mine = score();
    $('challenge-you').textContent = mine + '%';
    $('challenge-msg').textContent = mine === 0 ? tr('Mark your regions and beat their score.')
      : mine < rival.pct ? tr('{n} points behind {name}. Keep going.', { n: rival.pct - mine, name: rival.name })
      : mine === rival.pct ? tr('Dead even with {name}. One more step wins it.', { name: rival.name })
      : tr('You beat {name}. Make your card and send it back.', { name: rival.name });
    $('challenge').classList.toggle('is-winning', mine > rival.pct);
  }

  // ---- card settings ----
  var settings = {
    tag: load('vch.tag', ''),
    platform: load('vch.platform', 'PS5'),
    theme: load('vch.theme', 'night'),
    dayone: load('vch.dayone', '1') === '1',
    useAlias: load('vch.useAlias', '0') === '1',
    aliasRoll: Number(load('vch.aliasRoll', '0')) || 0,
    // From 7 December the card opens on Wrapped, unless the visitor picked a card themselves.
    kind: load('vch.kind', Date.now() >= new Date(2026, 11, 7).getTime() ? 'wrapped' : 'map')
  };
  if (settings.kind !== 'wrapped') settings.kind = 'map'; // Blend is chosen per visit, from a friend's link
  if (!THEMES[settings.theme]) settings.theme = 'night';
  if (settings.platform !== 'PS5' && settings.platform !== 'Xbox Series') settings.platform = 'PS5';

  function setTag(v, from) {
    settings.tag = v.replace(/^\s+/, '').slice(0, 24);
    save('vch.tag', settings.tag);
    if (from !== 'tag') $('tag').value = settings.tag;
    if (from !== 'alias') $('alias-input').value = settings.tag;
    renderAlias();
    drawSoon();
  }

  function bindSettings() {
    $('tag').value = settings.tag;
    $('alias-input').value = settings.tag;
    $('tag').addEventListener('input', function () { setTag(this.value, 'tag'); });
    $('alias-input').addEventListener('input', function () { setTag(this.value, 'alias'); });
    document.querySelectorAll('input[name="platform"]').forEach(function (r) {
      r.checked = r.value === settings.platform;
      r.addEventListener('change', function () { settings.platform = r.value; save('vch.platform', r.value); drawSoon(); });
    });
    document.querySelectorAll('input[name="theme"]').forEach(function (r) {
      r.checked = r.value === settings.theme;
      r.addEventListener('change', function () { settings.theme = r.value; save('vch.theme', r.value); drawSoon(); });
    });
    document.querySelectorAll('input[name="kind"]').forEach(function (r) {
      r.checked = r.value === settings.kind;
      r.addEventListener('change', function () { settings.kind = r.value; if (r.value !== 'blend') save('vch.kind', r.value); drawSoon(); });
    });
    var dLabel = $('dayone').parentNode.querySelector('span');
    dLabel.textContent = tr('Add today\'s stamp: {day}, {date}', { day: startDay() === 0 ? tr('Day one') : tr('Day {n}', { n: startDay() + 1 }), date: stampDate() });
    var d = $('dayone');
    d.checked = settings.dayone;
    d.addEventListener('change', function () { settings.dayone = d.checked; save('vch.dayone', d.checked ? '1' : '0'); drawSoon(); });
    var a = $('use-alias');
    a.checked = settings.useAlias;
    a.addEventListener('change', function () { settings.useAlias = a.checked; save('vch.useAlias', a.checked ? '1' : '0'); drawSoon(); });
  }

  // ---- street name: same name in, same street name out ----
  var ALIAS_FIRST = ['Neon', 'Midnight', 'Low-Tide', 'Sunburnt', 'Chrome', 'Palm Tree', 'Two-Lane', 'Mangrove', 'High-Tide', 'Saltwater',
    'Velvet', 'Static', 'Golden Hour', 'Hurricane', 'Backroad', 'Dockside'];
  var ALIAS_TITLE = ['Gator', 'Flamingo', 'Pelican', 'Night Owl', 'Tow Truck', 'Heatwave', 'Undertow', 'Riptide', 'Toll Booth',
    'Swamp Rat', 'Dock Boss', 'Jet Wash', 'Sugar King', 'Lighthouse', 'Last Exit', 'Hot Wheel'];
  var ALIAS_KNOWN = ['never using the brakes', 'tipping in pocket change', 'driving with the hazards on', 'knowing every back road in Grassrivers',
    'still owing someone in Port Gellhorn', 'sleeping through every sunrise', 'owning a boat and no licence', 'getting lost on purpose',
    'parking on the sidewalk', 'blasting the radio at 3 AM', 'outrunning the rain', 'saying “one more mission, then bed”',
    'waving at every cop car', 'never skipping a cutscene', 'a suspiciously clean car', 'always taking the scenic route'];

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function alias() {
    var name = (settings.tag || '').trim() || 'Player';
    var h = hash(name.toLowerCase() + '#' + settings.aliasRoll);
    return {
      name: ALIAS_FIRST[h % 16] + ' ' + name + ', the ' + ALIAS_TITLE[(h >>> 4) % 16],
      known: tr('Known for {x}.', { x: tr(ALIAS_KNOWN[(h >>> 8) % 16]) })
    };
  }
  function renderAlias() {
    var a = alias();
    $('alias-name').textContent = a.name;
    $('alias-known').textContent = a.known;
  }
  function bindAlias() {
    $('alias-roll').addEventListener('click', function () {
      settings.aliasRoll += 1; save('vch.aliasRoll', String(settings.aliasRoll));
      renderAlias(); drawSoon();
      var o = $('alias-out'); o.classList.remove('pop-in'); void o.offsetWidth; o.classList.add('pop-in');
    });
    $('alias-copy').addEventListener('click', function () {
      var a = alias();
      copy(tr('My Leonida street name: {name}. {known} Get yours:', { name: a.name, known: a.known }) + ' ' + SITE).then(
        function () { toast(tr('Street name copied. Drop it in the group chat.')); },
        function () { toast(tr('Copy is blocked here. Select the name to copy it.')); });
    });
  }

  // ---- day-one bingo: 3 x 3, free centre, a different board for every player ----
  var BINGO = ['Wanted in the first 10 minutes', 'Skipped a mission to explore', 'Crashed within a block of the start',
    'Changed outfit before anything else', 'Drove on the beach', 'Got lost in the swamp', 'Watched a sunset on purpose',
    'Stole a boat', 'Still playing at 3 AM', 'Lost a fight to a stranger', 'One radio station on repeat',
    'Followed the GPS into water', 'Fell off something tall', 'Hid from the cops in an alley', 'Texted the crew “it’s so good”',
    'Forgot to eat dinner', 'Drove to the Keys at night', 'Restarted a mission 3 times', 'Took 20 screenshots before mission 2',
    'Honked at everything', 'Parked somewhere ridiculous', 'Swam when you should have driven', 'Ran out of money already',
    'Missed a turn on Ocean Drive'];
  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  var bingo = {
    seed: Number(load('vch.bingoSeed', '0')) || (Math.floor(Math.random() * 1e9) + 1),
    marks: (function () { var m = load('vch.bingoMarks', '000010000'); return /^[01]{9}$/.test(m) ? m.split('').map(Number) : [0, 0, 0, 0, 1, 0, 0, 0, 0]; })()
  };
  bingo.marks[4] = 1;
  save('vch.bingoSeed', String(bingo.seed));

  function boardPrompts() {
    var idx = BINGO.map(function (_, i) { return i; });
    var s = bingo.seed;
    for (var i = idx.length - 1; i > 0; i--) { // seeded Fisher-Yates
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      var j = s % (i + 1); var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    var picks = idx.slice(0, 8).map(function (k) { return BINGO[k]; });
    picks.splice(4, 0, 'Unlocked it on day one');
    return picks;
  }
  function bingoLines() { return LINES.filter(function (l) { return l.every(function (i) { return bingo.marks[i]; }); }).length; }

  function buildBingo() {
    var box = $('bingo');
    box.textContent = '';
    boardPrompts().forEach(function (text, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell' + (i === 4 ? ' cell--free' : '');
      b.textContent = tr(text);
      b.setAttribute('aria-pressed', String(Boolean(bingo.marks[i])));
      if (i === 4) b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', function () {
        if (i === 4) return;
        var before = bingoLines();
        bingo.marks[i] = bingo.marks[i] ? 0 : 1;
        save('vch.bingoMarks', bingo.marks.join(''));
        b.setAttribute('aria-pressed', String(Boolean(bingo.marks[i])));
        var after = bingoLines();
        renderBingoScore();
        if (after > before) {
          buzz();
          toast(after === 8 ? tr('Blackout. You did it all on night one.') : tr(after === 1 ? 'BINGO! 1 line. Copy your board for the chat.' : 'BINGO! {n} lines. Copy your board for the chat.', { n: after }));
          box.classList.remove('win'); void box.offsetWidth; box.classList.add('win');
        }
        drawSoon();
      });
      box.appendChild(b);
    });
    renderBingoScore();
  }
  function renderBingoScore() {
    var n = bingoLines(), ticked = bingo.marks.reduce(function (a, b) { return a + b; }, 0) - 1;
    $('bingo-score').textContent = n ? tr('Bingo ×{n} · {k} of 8 ticked', { n: n, k: ticked }) : tr('{k} of 8 ticked · no line yet', { k: ticked });
  }
  function bingoText() {
    var rows = [0, 3, 6].map(function (r) {
      return [0, 1, 2].map(function (c) { return bingo.marks[r + c] ? '🟪' : '⬛'; }).join('');
    });
    var n = bingoLines(), ticked = bingo.marks.reduce(function (a, b) { return a + b; }, 0) - 1;
    var who = (settings.tag || '').trim();
    var head = (who ? tr('{name}\'s Leonida day-one bingo', { name: who }) : tr('My Leonida day-one bingo')) + ' · ' + settings.platform + ' · ' + (n ? 'Bingo ×' + n : tr('no line yet')) + ' · ' + tr('{k} of 8 ticked', { k: ticked });
    return head + '\n' + rows.join('\n') + '\n' + SITE;
  }
  function bingoStatus(msg) { var s = $('bingo-status'); s.textContent = ''; setTimeout(function () { s.textContent = msg; }, 30); }
  function bindBingo() {
    $('bingo-copy').addEventListener('click', function () {
      shareOrCopy(bingoText(), bingoStatus, tr('Board copied. Paste it in the group chat.'));
    });
    $('bingo-new').addEventListener('click', function () {
      var undo = { seed: bingo.seed, marks: bingo.marks.slice() };
      bingo.seed = Math.floor(Math.random() * 1e9) + 1;
      bingo.marks = [0, 0, 0, 0, 1, 0, 0, 0, 0];
      save('vch.bingoSeed', String(bingo.seed)); save('vch.bingoMarks', bingo.marks.join(''));
      buildBingo(); drawSoon();
      var st = $('bingo-status');
      st.textContent = tr('New board.') + ' ';
      var u = document.createElement('button');
      u.type = 'button'; u.className = 'linklike'; u.textContent = tr('Undo');
      u.addEventListener('click', function () {
        bingo.seed = undo.seed; bingo.marks = undo.marks;
        save('vch.bingoSeed', String(bingo.seed)); save('vch.bingoMarks', bingo.marks.join(''));
        buildBingo(); drawSoon(); st.textContent = tr('Old board back.');
      });
      st.appendChild(u);
    });
  }

  // ---- Leonida Daily: one shared task per local day, from launch day ----
  var DAILY = ['Drive the whole length of Ocean Drive without crashing', 'Watch a full sunset from a beach in Vice City',
    'Reach the Keys by boat', 'Lose a five-star chase without changing cars', 'Spend a whole in-game day on foot',
    'Find the highest point you can reach on Mount Kalaga', 'Cross Grassrivers without touching a road',
    'Get a photo of an alligator', 'Drive from Port Gellhorn to Vice City in one go', 'Do a mission using only the radio station you hate most',
    'Park a car somewhere a car should never be', 'Spend no money for an hour', 'Find the strangest stranger in Ambrosia',
    'Outrun the cops on a bicycle', 'Swim between two islands in the Keys', 'Take the scenic route: no GPS for a whole mission',
    'Visit all six regions in one session', 'Win a fight without a weapon', 'Go back to where you started on day one',
    'Show a friend your favourite spot in Leonida', 'Do the one thing you said you would do on launch day'];
  var LAUNCH = new Date(2026, 10, 19).getTime();
  function dayIndex() {
    var n = new Date(); n = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    return Math.max(0, Math.round((n - LAUNCH) / 864e5));
  }
  var dailyDone = (function () { var v = load('vch.daily', ''); return v ? v.split(',').map(Number).filter(function (x) { return x >= 0; }) : []; })();
  function streak() {
    var d = dayIndex(), s = 0;
    if (dailyDone.indexOf(d) < 0) d--;
    while (d >= 0 && dailyDone.indexOf(d) >= 0) { s++; d--; }
    return s;
  }
  function renderDaily() {
    var d = dayIndex(), done = dailyDone.indexOf(d) >= 0, st = streak();
    $('daily-day').textContent = tr('Day {n} in Leonida', { n: d + 1 });
    $('daily-task').textContent = tr(DAILY[d % DAILY.length]);
    $('daily-streak').textContent = (st ? tr('{n}-day streak', { n: st }) : tr('No streak yet')) + ' · ' + tr('{n} done in total', { n: dailyDone.length });
    var b = $('daily-done');
    b.setAttribute('aria-pressed', String(done));
    b.querySelector('span').textContent = done ? tr('Done today') : tr('I did it');
    b.closest('.daily').classList.toggle('is-done', done);
  }
  function dailyText() {
    var d = dayIndex(), cells = '';
    for (var i = Math.max(0, d - 6); i <= d; i++) cells += dailyDone.indexOf(i) >= 0 ? '🟪' : '⬛';
    var st = streak();
    return 'Leonida Daily · ' + tr('Day {n}', { n: d + 1 }) + ' · ' + (st ? tr('{n}-day streak', { n: st }) : tr('starting my streak')) + '\n' + cells + '\n' + SITE;
  }
  function bindDaily() {
    $('daily-done').addEventListener('click', function () {
      var d = dayIndex(), k = dailyDone.indexOf(d);
      if (k >= 0) dailyDone.splice(k, 1); else { dailyDone.push(d); buzz(); toast(streak() > 1 ? tr('{n}-day streak. Copy it for the chat.', { n: streak() }) : tr('Done. Come back tomorrow for the next one.')); }
      save('vch.daily', dailyDone.join(','));
      renderDaily();
    });
    $('daily-copy').addEventListener('click', function () {
      shareOrCopy(dailyText(), function (m) { $('daily-status').textContent = m; }, tr('Streak copied. Paste it in the group chat.'));
    });
  }

  // ---- "I sent a tip": honour system, adds a gold line to the card ----
  var tipped = load('vch.tipped', '') === '1';
  function renderTipped() {
    var b = $('tipped-btn');
    b.setAttribute('aria-pressed', String(tipped));
    b.querySelector('span').textContent = tipped ? tr('Thank you!') : tr('I sent a tip');
    $('tipped-msg').textContent = tipped
      ? tr('You kept the hub running. Your map card now carries a gold Backed the hub line. Tap again to remove it.')
      : tr('Sent one? Tap here and your map card gets a gold Backed the hub line. We trust you, so there is nothing to check.');
  }
  function bindTipped() {
    $('tipped-btn').addEventListener('click', function () {
      tipped = !tipped; save('vch.tipped', tipped ? '1' : '');
      if (tipped) { buzz(); toast(tr('Thank you. That keeps the lights on in Leonida.')); }
      renderTipped(); drawSoon();
    });
  }

  // ---- cheat codes: search, type filter, "known code only", and a personal unlocked checklist ----
  function bindCheats() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#cheat-rows tr'));
    if (!rows.length) return;
    var got = load('vch.cheats', '').split(',').filter(Boolean);
    var cat = 'all';
    var norm = function (x) { return x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
    function count() {
      $('cheat-count').textContent = tr('{n} of {m} unlocked', { n: got.length, m: rows.length });
    }
    function apply() {
      var q = norm($('cheat-q').value.trim()), known = $('cheat-known').checked, shown = 0;
      rows.forEach(function (tr_) {
        var ok = (cat === 'all' || tr_.dataset.cat === cat) && (!known || q || tr_.hasAttribute('data-code')) &&
          (!q || norm(tr_.textContent).indexOf(q) >= 0);
        tr_.hidden = !ok; if (ok) shown++;
      });
      $('cheat-empty').hidden = shown > 0;
      $('cheat-more').hidden = !known || !!q;
    }
    rows.forEach(function (tr_) {
      var box = tr_.querySelector('input'), id = tr_.dataset.id;
      box.checked = got.indexOf(id) >= 0;
      tr_.classList.toggle('is-got', box.checked);
      box.addEventListener('change', function () {
        got = got.filter(function (g) { return g !== id; });
        if (box.checked) { got.push(id); buzz(); }
        tr_.classList.toggle('is-got', box.checked);
        save('vch.cheats', got.join(','));
        count();
      });
    });
    $('cheat-q').addEventListener('input', apply);
    $('cheat-known').addEventListener('change', apply);
    $('cheat-more').addEventListener('click', function () { $('cheat-known').checked = false; apply(); });
    document.querySelectorAll('.chips .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        cat = b.dataset.cat;
        document.querySelectorAll('.chips .chip').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        apply();
      });
    });
    count(); apply();
  }

  // ---- the "saved" line: reassure, and offer a progress link that works in any browser ----
  function bindSaveLine() {
    document.querySelectorAll('[data-saveline]').forEach(function (line) {
      var note = line.querySelector('.saveline__note'), btn = line.querySelector('button');
      if (!storageWorks || inApp) {
        line.classList.add('is-warn');
        note.textContent = inApp ? tr('This in-app browser may forget your progress. Copy your progress link, or open the hub in Safari or Chrome.')
          : tr('This browser is not keeping your progress. Copy your progress link to keep it.');
      }
      btn.addEventListener('click', function () {
        copy(progressLink()).then(function () { toast(tr('Progress link copied. Open it on any browser or phone to pick up where you left off.')); },
          function () { toast(tr('Copy is blocked here. Bookmark this page after tapping again.')); location.hash = 'p=' + progressCode(); });
      });
    });
    if (restored) toast(tr('Progress restored from your link.'));
  }

  // ---- the card (1080 x 1350), drawn only near the screen or when exported ----
  var pending = false, cardVisible = false, cardDirty = true;
  function drawSoon() {
    cardDirty = true;
    if (!cardVisible || pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; draw(); });
  }

  function fitText(ctx, text, max, size, font) {
    var s = size;
    ctx.font = font.replace('{s}', s);
    while (ctx.measureText(text).width > max && s > 20) { s -= 2; ctx.font = font.replace('{s}', s); }
    return s;
  }

  function draw() {
    cardDirty = false;
    var cv = $('card-canvas');
    var ctx = cv.getContext('2d');
    var W = 1080, H = 1350, T = THEMES[settings.theme];
    // The card is laid out at 1080 x 1350 and painted at twice that, so downloads stay sharp on any phone.
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, T.bg); bg.addColorStop(1, T.bg2);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (settings.kind === 'wrapped') { drawWrapped(ctx, T, W, H); return; }
    if (settings.kind === 'blend' && rival) { drawBlend(ctx, T, W, H); return; }

    ctx.fillStyle = T.ink2;
    ctx.font = '600 38px "DM Sans", sans-serif';
    ctx.fillText(tr('Greetings from'), 64, 112);
    ctx.fillStyle = T.ink;
    ctx.font = '400 196px Anton, sans-serif';
    ctx.fillText('LEONIDA', 56, 304);

    drawMap(ctx, T, 44, 344, 0.96);

    var cx = 640, n = steps(), p = pctOf(n);
    ctx.fillStyle = T.accent;
    ctx.font = '400 230px Anton, sans-serif';
    var num = String(p);
    ctx.fillText(num, cx, 600);
    var nw = ctx.measureText(num).width;
    ctx.font = '400 110px Anton, sans-serif';
    ctx.fillText('%', cx + nw + 6, 600);
    ctx.fillStyle = T.ink2;
    ctx.font = '600 32px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida seen'), cx + 4, 650);
    ctx.fillStyle = T.ink;
    fitText(ctx, rank(n), 400, 66, '400 {s}px Anton, sans-serif');
    ctx.fillText(rank(n), cx, 744);

    var ty = 812;
    REGIONS.forEach(function (r, i) {
      for (var k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(cx + 12 + k * 30, ty - 10, 10, 0, Math.PI * 2);
        if (k < levels[i]) { ctx.fillStyle = levels[i] === 3 ? T.done : T.accent; ctx.fill(); }
        else { ctx.strokeStyle = T.ink2; ctx.lineWidth = 2.5; ctx.stroke(); }
      }
      ctx.fillStyle = levels[i] ? T.ink : T.ink2;
      ctx.font = '600 28px "DM Sans", sans-serif';
      ctx.fillText(r.name, cx + 110, ty);
      ty += 52;
    });

    var tag = (settings.tag || '').trim() || tr('Player one');
    var title = settings.useAlias ? alias().name : tag;
    ctx.fillStyle = T.ink;
    fitText(ctx, title, W - 128, 84, '400 {s}px Anton, sans-serif');
    ctx.fillText(title, 64, 1196);
    ctx.fillStyle = T.ink2;
    ctx.font = '600 32px "DM Sans", sans-serif';
    var lines = bingoLines();
    var meta = tr('Plays on {p}', { p: settings.platform }) + ' · GTA VI' + (lines ? ' · Bingo ×' + lines : '');
    ctx.fillText(meta, 64, 1246);
    if (tipped) { var fs = ctx.fillStyle; ctx.fillStyle = '#FFC35A'; ctx.fillText(' · ' + tr('Backed the hub'), 64 + ctx.measureText(meta).width, 1246); ctx.fillStyle = fs; }

    ctx.fillStyle = T.accent;
    ctx.fillRect(0, H - 64, W, 64);
    ctx.fillStyle = T.onFull;
    ctx.font = '600 30px "DM Sans", sans-serif';
    ctx.fillText(tr('How much have you seen?') + ' vicecityhub.okenshop.com', 64, H - 22);

    if (settings.dayone) stamp(ctx, 940, 170, T);
  }

  // The map as drawn on both cards, at (x, y) and scale sc of its 600 x 740 layout.
  // blend: { mine: [...], theirs: [...] } paints who explored each region instead of one player's levels.
  function drawMap(ctx, T, x, y, sc, blend) {
    var LV = blend ? blend.mine.map(function (m, i) { return Math.max(m, blend.theirs[i]); }) : levels;
    // The card map uses the same layers as the page map: sea, stipple, grid, coastal shelf, fog of war, route, compass.
    ctx.save();
    ctx.translate(x, y); ctx.scale(sc, sc);
    roundRect(ctx, 0, 0, 600, 740, 22); ctx.fillStyle = T.sea; ctx.fill();
    ctx.save(); roundRect(ctx, 0, 0, 600, 740, 22); ctx.clip();
    // The card is built to survive social-media compression: no fine dots or hairlines, only shapes and bold lines
    // that JPEG re-encoding on Instagram, X or WhatsApp can't smear. A soft sea gradient and a wide grid give depth.
    var sea = ctx.createRadialGradient(300, 300, 40, 300, 360, 520);
    sea.addColorStop(0, 'rgba(143,179,191,.10)'); sea.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = sea; ctx.fillRect(0, 0, 600, 740);
    ctx.strokeStyle = T.grid; ctx.lineWidth = 2;
    for (var x = 100; x < 600; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 740); ctx.stroke(); }
    for (var y = 100; y < 740; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke(); }
    REGIONS.forEach(function (r) { // coastal shelf
      var sp = new Path2D(r.d);
      ctx.fillStyle = 'rgba(143,179,191,.10)'; ctx.fill(sp);
      ctx.strokeStyle = 'rgba(143,179,191,.22)'; ctx.lineWidth = 30; ctx.lineJoin = 'round'; ctx.stroke(sp);
    });
    ctx.restore();
    // Unexplored regions: wide, bold diagonal bands (low detail, so they stay clean after compression).
    var fog = patternTile(26, function (p) { p.strokeStyle = 'rgba(244,241,234,.11)'; p.lineWidth = 6; p.lineCap = 'square'; [-26, 0, 26].forEach(function (o) { p.beginPath(); p.moveTo(o - 2, 28); p.lineTo(o + 28, -2); p.stroke(); }); });
    REGIONS.forEach(function (r, i) {
      var path = new Path2D(r.d);
      ctx.fillStyle = T.fill[blend ? (blend.mine[i] && blend.theirs[i] ? 3 : LV[i] ? 2 : 0) : LV[i]]; ctx.fill(path);
      if (LV[i]) { var sh = ctx.createLinearGradient(0, 40, 0, 720); sh.addColorStop(0, 'rgba(255,255,255,.10)'); sh.addColorStop(1, 'rgba(0,0,0,.14)'); ctx.fillStyle = sh; ctx.fill(path); }
      if (!LV[i] && fog) { ctx.fillStyle = fog; ctx.fill(path); }
      ctx.strokeStyle = T.edge; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke(path);
      if (blend) {
        // Only you: your accent. Only them: gold. Both of you: white.
        var me = blend.mine[i] > 0, them = blend.theirs[i] > 0;
        if (me || them) { ctx.strokeStyle = me && them ? T.ink : me ? T.accent : T.done; ctx.lineWidth = 4; ctx.stroke(path); }
      } else {
        if (LV[i] === 2) { ctx.strokeStyle = T.accent; ctx.lineWidth = 3; ctx.stroke(path); }
        if (LV[i] === 3) { ctx.strokeStyle = T.done; ctx.lineWidth = 4; ctx.stroke(path); }
      }
    });
    var lake = new Path2D(LAKE);
    ctx.fillStyle = T.lake; ctx.fill(lake); ctx.strokeStyle = T.edge; ctx.lineWidth = 4; ctx.stroke(lake);
    // your route
    var pts = [];
    if (!blend) levels.forEach(function (l, i) { if (l) pts.push(anchorOf(REGIONS[i])); });
    if (pts.length > 1) {
      ctx.save(); ctx.strokeStyle = T.accent; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.setLineDash([1, 12]);
      ctx.beginPath(); pts.forEach(function (p, k) { k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke(); ctx.restore();
    }
    pts.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, Math.PI * 2); ctx.fillStyle = T.sea; ctx.fill(); ctx.strokeStyle = T.accent; ctx.lineWidth = 3.5; ctx.stroke(); });
    // labels above the route, outlined so they read at feed size
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    REGIONS.forEach(function (r, i) {
      var dark = (blend ? (blend.mine[i] && blend.theirs[i] ? 3 : LV[i] ? 2 : 0) : LV[i]) >= T.darkFrom && r.id !== 'keys';
      ctx.font = '400 30px Anton, sans-serif';
      ctx.lineWidth = 6; ctx.strokeStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(14,19,17,.6)';
      ctx.fillStyle = dark ? T.onFull : T.ink;
      var lines = r.two ? [r.name.split(' ')[0], r.name.split(' ').slice(1).join(' ')] : [r.name];
      lines.forEach(function (txt, k) {
        var ly = r.label[1] + (r.two ? (k ? 20 : -12) : 0);
        ctx.strokeText(txt, r.label[0], ly); ctx.fillText(txt, r.label[0], ly);
      });
    });
    // compass
    ctx.save(); ctx.translate(552, 684);
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fillStyle = 'rgba(15,31,37,.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(244,241,234,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = T.accent; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(6, 0); ctx.lineTo(0, -4); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(244,241,234,.5)'; ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(6, 0); ctx.lineTo(0, 4); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = T.ink; ctx.font = '600 18px "DM Sans", sans-serif'; ctx.fillText('N', 0, -34);
    ctx.restore();
    ctx.restore();
    ctx.textAlign = 'left';
  }

  // Leonida Wrapped: the whole launch run on one card. Same drawing, same device, nothing uploaded.
  function longestStreak() {
    var days = dailyDone.slice().sort(function (a, b) { return a - b; }), best = 0, run = 0;
    days.forEach(function (d, k) { run = k && d === days[k - 1] + 1 ? run + 1 : (k && d === days[k - 1] ? run : 1); best = Math.max(best, run); });
    return best;
  }
  function drawWrapped(ctx, T, W, H) {
    ctx.fillStyle = T.ink2; ctx.font = '600 38px "DM Sans", sans-serif';
    ctx.fillText(tr('My launch run in'), 64, 112);
    ctx.fillStyle = T.ink; ctx.font = '400 172px Anton, sans-serif';
    ctx.fillText(tr('LEONIDA'), 56, 284);
    ctx.fillStyle = T.accent;
    ctx.fillText(tr('WRAPPED'), 56, 452);
    ctx.fillStyle = T.ink2; ctx.font = '600 30px "DM Sans", sans-serif';
    ctx.fillText(tr('19 Nov – 10 Dec 2026'), 64, 512);

    drawMap(ctx, T, 636, 572, 0.6);

    var n = steps(), done100 = levels.filter(function (l) { return l === 3; }).length, best = longestStreak();
    ctx.fillStyle = T.accent;
    fitText(ctx, pctOf(n) + '%', 560, 168, '400 {s}px Anton, sans-serif');
    ctx.fillText(pctOf(n) + '%', 58, 742);
    ctx.fillStyle = T.ink2; ctx.font = '600 30px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida seen'), 64, 792);
    ctx.fillStyle = T.ink;
    fitText(ctx, rank(n), 540, 88, '400 {s}px Anton, sans-serif');
    ctx.fillText(rank(n), 62, 910);
    ctx.fillStyle = T.ink2; ctx.font = '600 30px "DM Sans", sans-serif';
    ctx.fillText(tr('final rank'), 64, 956);

    ctx.fillStyle = T.line; ctx.fillRect(64, 1030, W - 128, 2);
    var stats = [
      [best === 1 ? tr('1 day') : tr('{n} days').replace('{n}', best), tr('best daily streak'), T.ink],
      [String(dailyDone.length), tr('daily tasks done'), T.ink],
      [done100 + '/6', tr('regions at 100%'), done100 ? T.done : T.ink]
    ];
    stats.forEach(function (st, k) {
      var x = 64 + k * 330;
      ctx.fillStyle = st[2];
      fitText(ctx, st[0], 300, 76, '400 {s}px Anton, sans-serif');
      ctx.fillText(st[0], x, 1124);
      ctx.fillStyle = T.ink2; ctx.font = '600 26px "DM Sans", sans-serif';
      ctx.fillText(st[1], x + 2, 1162);
    });

    var tag = (settings.tag || '').trim() || tr('Player one');
    var title = settings.useAlias ? alias().name : tag;
    ctx.fillStyle = T.ink;
    fitText(ctx, title, W - 128, 64, '400 {s}px Anton, sans-serif');
    ctx.fillText(title, 64, 1250);

    ctx.fillStyle = T.accent;
    ctx.fillRect(0, H - 64, W, 64);
    ctx.fillStyle = T.onFull;
    ctx.font = '600 30px "DM Sans", sans-serif';
    ctx.fillText(tr('Make yours:') + ' vicecityhub.okenshop.com', 64, H - 22);
  }

  // Leonida Blend: your map and a friend's (from their challenge link) on one card, Spotify-Blend style.
  function blendStats() {
    var cover = 0, diff = 0;
    levels.forEach(function (m, i) { cover += Math.max(m, rival.levels[i]); diff += Math.abs(m - rival.levels[i]); });
    var mine = steps(), theirs = rival.levels.reduce(function (a, b) { return a + b; }, 0);
    return { cover: pctOf(cover), match: Math.round(100 - diff / 18 * 100), carry: mine === theirs ? 0 : mine > theirs ? 1 : -1 };
  }
  function drawBlend(ctx, T, W, H) {
    var st = blendStats(), me = (settings.tag || '').trim() || tr('You');
    ctx.fillStyle = T.ink2; ctx.font = '600 38px "DM Sans", sans-serif';
    ctx.fillText(tr('Our Leonida'), 64, 112);
    ctx.fillStyle = T.accent; ctx.font = '400 196px Anton, sans-serif';
    ctx.fillText(tr('BLEND'), 56, 304);
    ctx.fillStyle = T.ink;
    var pair = me + '  ×  ' + rival.name;
    fitText(ctx, pair, W - 128, 64, '400 {s}px Anton, sans-serif');
    ctx.fillText(pair, 64, 404);

    drawMap(ctx, T, 40, 470, 0.84, { mine: levels, theirs: rival.levels });

    var x = 600;
    ctx.fillStyle = T.accent;
    fitText(ctx, st.cover + '%', 420, 170, '400 {s}px Anton, sans-serif');
    ctx.fillText(st.cover + '%', x - 4, 640);
    ctx.fillStyle = T.ink2; ctx.font = '600 28px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida covered'), x, 686);
    ctx.fillText(tr('together'), x, 722);
    ctx.fillStyle = T.ink; ctx.font = '400 104px Anton, sans-serif';
    ctx.fillText(st.match + '%', x - 2, 852);
    ctx.fillStyle = T.ink2; ctx.font = '600 28px "DM Sans", sans-serif';
    ctx.fillText(tr('map match'), x, 894);
    ctx.fillStyle = T.ink;
    var carry = st.carry === 0 ? tr('Dead even') : tr('{name} carried', { name: st.carry > 0 ? me : rival.name });
    fitText(ctx, carry, 420, 56, '400 {s}px Anton, sans-serif');
    ctx.fillText(carry, x, 990);
    // legend
    [[T.accent, me], [T.done, rival.name], [T.ink, tr('Both of you')]].forEach(function (l, k) {
      var ly = 1060 + k * 48;
      ctx.strokeStyle = l[0]; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, ly - 10); ctx.lineTo(x + 40, ly - 10); ctx.stroke();
      ctx.fillStyle = T.ink2; ctx.font = '600 26px "DM Sans", sans-serif';
      fitText(ctx, l[1], 360, 26, '600 {s}px "DM Sans", sans-serif');
      ctx.fillText(l[1], x + 56, ly);
    });

    ctx.fillStyle = T.accent;
    ctx.fillRect(0, H - 64, W, 64);
    ctx.fillStyle = T.onFull;
    ctx.font = '600 30px "DM Sans", sans-serif';
    ctx.fillText(tr('Blend with me:') + ' vicecityhub.okenshop.com', 64, H - 22);
  }

  // The date stamp: today's date and the day count since launch (19 Nov 2026 = Day one), on the visitor's own clock.
  function startDay() { return dayIndex(); }
  function stampLabel() { var d = startDay(); return d === 0 ? tr('DAY ONE') : tr('DAY {n}', { n: d + 1 }); }
  // Day-month-year in every language ("19 Nov 2026"), upper case on the stamp itself.
  function stampDate(upper) {
    var dt = new Date(), out;
    try { out = new Intl.DateTimeFormat(LANG === 'en' ? 'en-GB' : LANG, { day: 'numeric', month: 'short', year: 'numeric' }).format(dt).replace(/\./g, ''); }
    catch (e) { out = dt.toDateString().slice(4); }
    return upper ? out.toUpperCase() : out;
  }
  function stamp(ctx, x, y, T) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.21);
    ctx.strokeStyle = T.accent; ctx.fillStyle = T.accent;
    ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center';
    var lab = stampLabel();
    fitText(ctx, lab, 140, 48, '400 {s}px Anton, sans-serif'); ctx.fillText(lab, 0, 14);
    var dt = stampDate(true);
    fitText(ctx, dt, 120, 20, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(dt, 0, 46);
    ctx.font = '600 20px "DM Sans", sans-serif'; ctx.fillText(tr('LEONIDA'), 0, -38);
    ctx.restore();
  }

  function patternTile(size, paint) {
    try {
      // Tiles are painted at the card's pixel density, then scaled back so they stay crisp.
      var k = $('card-canvas').width / 1080;
      var c = document.createElement('canvas'); c.width = size * k; c.height = size * k;
      var g = c.getContext('2d'); g.scale(k, k); paint(g);
      var pat = $('card-canvas').getContext('2d').createPattern(c, 'repeat');
      if (pat && pat.setTransform && window.DOMMatrix) pat.setTransform(new DOMMatrix([1 / k, 0, 0, 1 / k, 0, 0]));
      return pat;
    } catch (e) { return null; }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---- share, download, copy ----
  function status(msg) { var s = $('card-status'); s.textContent = ''; setTimeout(function () { s.textContent = msg; }, 30); }
  // The tip ask appears once, right after the visitor got something for free (their card), never before.
  function showThanks() {
    var t = $('thanks');
    if (!t.hidden) return;
    t.hidden = false;
    t.classList.add('pop-in');
  }

  function cardBlob() {
    return new Promise(function (resolve, reject) {
      if (cardDirty) draw();
      $('card-canvas').toBlob(function (b) { b ? resolve(b) : reject(new Error('no image')); }, 'image/png');
    });
  }
  function fileName() { return settings.kind === 'blend' && rival ? 'leonida-blend.png' : settings.kind === 'wrapped' ? 'leonida-wrapped.png' : 'leonida-' + score() + '-percent.png'; }

  function challengeUrl() {
    var u = SITE + '?c=' + code();
    var t = (settings.tag || '').trim();
    if (t) u += '&n=' + encodeURIComponent(t);
    return u;
  }
  function shareText() {
    if (settings.kind === 'blend' && rival) {
      var b = blendStats();
      return tr('Our Leonida Blend with {name}: {c}% covered together, {m}% match. Blend with me:', { name: rival.name, c: b.cover, m: b.match });
    }
    return tr('I have seen {n}% of Leonida ({rank}). How much have you seen?', { n: score(), rank: rank() });
  }

  function download(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }
  // On phones, open the share sheet (WhatsApp, Discord, Messages) instead of only copying. A cancelled share does
  // nothing; anywhere the share sheet is missing or fails, fall back to copying.
  function shareOrCopy(text, say, copied) {
    var coarse = false;
    try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) { /* old browser */ }
    var fallback = function () {
      return copy(text).then(function () { say(copied); }, function () { say(tr('Copy is blocked in this browser.')); });
    };
    if (coarse && navigator.share) {
      return navigator.share({ text: text }).then(function () { say(tr('Shared.')); }, function (e) {
        if (e && e.name === 'AbortError') return;
        return fallback();
      });
    }
    return fallback();
  }
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      ok ? resolve() : reject(new Error('copy blocked'));
    });
  }

  function bindActions() {
    $('share').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      cardBlob().then(function (blob) {
        var file = new File([blob], fileName(), { type: 'image/png' });
        var data = { files: [file], title: 'My Leonida card', text: shareText() + ' ' + challengeUrl() };
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share(data).then(function () { status(tr('Shared. Now see if your crew can beat it.')); showThanks(); }, function (e) {
            if (e && e.name === 'AbortError') return;
            download(blob); status(tr('Sharing is blocked here, so the card was downloaded instead.')); showThanks();
          });
        }
        download(blob); showThanks();
        return copy(shareText() + ' ' + challengeUrl()).then(
          function () { status(tr('Card downloaded and the challenge text copied. Post both.')); },
          function () { status(tr('Card downloaded. Post it with your challenge link.')); });
      }).catch(function () { status('The card could not be made in this browser. Try another browser.'); })
        .then(function () { btn.disabled = false; });
    });
    $('download').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      cardBlob().then(function (b) { download(b); status(tr('Card downloaded:') + ' ' + fileName()); showThanks(); },
        function () { status('The card could not be made in this browser. Try another browser.'); })
        .then(function () { btn.disabled = false; });
    });
    $('copy-link').addEventListener('click', function () {
      copy(shareText() + ' ' + challengeUrl()).then(function () { status(tr('Challenge copied. Paste it in your group chat.')); showThanks(); },
        function () { status(tr('Copy is blocked here. Your link:') + ' ' + challengeUrl()); });
    });
    document.querySelectorAll('[data-copy]').forEach(function (b) {
      var label = b.textContent;
      b.addEventListener('click', function () {
        copy(b.dataset.copy).then(function () { b.textContent = tr(b.dataset.done || 'Copied'); },
          function () { b.textContent = tr('Select the address above to copy'); })
          .then(function () { setTimeout(function () { b.textContent = label; }, 2500); });
      });
    });
    $('reset').addEventListener('click', function () {
      levels = [0, 0, 0, 0, 0, 0]; save('vch.map', code()); render(); toast(tr('Map cleared.'));
    });
  }

  // ---- unlock clock ----
  // PS5 PlayStation Store windows reported from GTAVice.net's scrape (15 windows, 63 countries); the main 11.
  var PLACES = [
    ['New Zealand', '2026-11-18T11:00:00Z'], ['Australia', '2026-11-18T13:00:00Z'], ['Japan, South Korea', '2026-11-18T15:00:00Z'],
    ['Hong Kong, Malaysia, Singapore, Taiwan', '2026-11-18T16:00:00Z'], ['Indonesia', '2026-11-18T17:00:00Z'],
    ['India', '2026-11-18T18:30:00Z'], ['UAE', '2026-11-18T20:00:00Z'], ['Mainland Europe', '2026-11-18T23:00:00Z'],
    ['UK and Ireland', '2026-11-19T00:00:00Z'], ['USA and Canada', '2026-11-19T05:00:00Z'], ['Mexico, Central America', '2026-11-19T06:00:00Z']
  ];
  var NA_ET = Date.parse('2026-11-19T05:00:00Z');
  var LAST = Date.parse('2026-11-19T06:00:00Z'); // the last listed window

  function myUnlock() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* older browsers */ }
    // The USA and Canada share one window at midnight Eastern; everywhere else, local midnight.
    var na = /^America\/(New_York|Detroit|Chicago|Denver|Phoenix|Boise|Los_Angeles|Anchorage|Juneau|Indiana|Kentucky|North_Dakota|Menominee|Adak|Sitka|Nome|Yakutat|Metlakatla|Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Regina|Halifax|St_Johns|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Dawson|Yellowknife|Iqaluit|Rankin_Inlet|Cambridge_Bay|Swift_Current|Atikokan|Creston|Fort_Nelson|Dawson_Creek|Inuvik|Resolute|Nipigon|Thunder_Bay|Rainy_River|Pangnirtung|Blanc-Sablon|Puerto_Rico)/.test(tz) || tz === 'Pacific/Honolulu';
    return na ? NA_ET : new Date(2026, 10, 19, 0, 0, 0).getTime();
  }
  var timeFmt;
  function fmtTime(t) {
    try { timeFmt = timeFmt || new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }); return timeFmt.format(new Date(t)); }
    catch (e) { return new Date(t).toLocaleString(); }
  }
  function fmtLeft(ms) {
    var m = Math.ceil(ms / 60000), h = Math.floor(m / 60);
    return h ? h + 'h ' + (m % 60) + 'm' : m + 'm';
  }

  function tick() {
    var now = Date.now(), ul = $('clock');
    var mine = myUnlock();
    var rows = PLACES.map(function (p) { return { place: p[0], t: Date.parse(p[1]) }; });
    var out = rows.filter(function (r) { return now >= r.t; });
    var soon = rows.filter(function (r) { return now < r.t; });
    $('clock-out').textContent = now >= LAST
      ? tr('Out in every PlayStation Store region with a listed time.')
      : out.length ? tr('Out in {n} of these {m} windows:', { n: out.length, m: rows.length }) + ' ' + out.map(function (r) { return tr(r.place); }).join(', ') + '.'
      : tr('Not out anywhere yet. New Zealand goes first.');
    var youLabel = mine === NA_ET ? tr('You (USA and Canada window)') : tr('Midnight where you are');
    var list = soon.concat([{ place: youLabel, t: mine, you: true }]).sort(function (a, b) { return a.t - b.t || (a.you ? -1 : 1); });
    var frag = document.createDocumentFragment();
    list.forEach(function (r) {
      var li = document.createElement('li');
      var live = now >= r.t;
      li.className = (live ? 'is-live' : '') + (r.you ? ' is-you' : '');
      var a = document.createElement('span'); a.className = 'place'; a.textContent = r.you ? r.place : tr(r.place);
      var b = document.createElement('span'); b.className = 'when';
      b.textContent = live ? tr('Out since {t}', { t: fmtTime(r.t) }) : tr('In {d}', { d: fmtLeft(r.t - now) }) + ' · ' + fmtTime(r.t);
      li.appendChild(a); li.appendChild(b); frag.appendChild(li);
    });
    ul.textContent = ''; ul.appendChild(frag);
    // After the last window everything is out: the per-window list has nothing left to count down.
    ul.hidden = now >= LAST; $('clock-title').hidden = now >= LAST;
    Array.prototype.forEach.call(document.querySelectorAll('.markets .when[data-at]'), function (el) {
      var t = Date.parse(el.getAttribute('data-at'));
      el.textContent = now >= t ? tr('Out since {t}', { t: fmtTime(t) }) : tr('In {d}', { d: fmtLeft(t - now) }) + ' · ' + fmtTime(t);
      el.parentNode.parentNode.className = now >= t ? 'is-live' : '';
    });
    $('live-line').textContent = now >= LAST ? tr('GTA VI is out in every listed store. Leonida is open.')
      : now >= mine ? (mine === NA_ET ? tr('The USA and Canada window is open. Leonida is open.') : tr('It’s past midnight where you are. If your store region matches, Leonida is open.'))
      : tr(mine === NA_ET ? 'The USA and Canada window opens in {d}. Plan your route now.' : 'Midnight where you are is in {d}. Plan your route now.', { d: fmtLeft(mine - now) });
  }

  // ---- start ----
  function start() {
    translatePage(); bindLang(); bindSaveLine();
    if (!$('map')) { bindCheats(); return; } // the cheat code page has only the cheat list
    buildMap(); bindList(); bindSettings(); bindAlias(); bindBingo(); bindDaily(); bindTipped(); bindCheats(); bindActions(); readChallenge();
    buildBingo(); renderDaily(); renderTipped(); renderAlias(); render(); tick();
    var clock = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', function () {
      clearInterval(clock);
      if (!document.hidden) { tick(); renderDaily(); clock = setInterval(tick, 30000); }
    });
    var cv = $('card-canvas');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        cardVisible = es[0].isIntersecting;
        if (cardVisible && cardDirty) drawSoon();
      }, { rootMargin: '400px 0px' }).observe(cv);
    } else { cardVisible = true; drawSoon(); }
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('400 40px Anton'), document.fonts.load('600 20px "DM Sans"')]).then(drawSoon, drawSoon);
    }
  }
  function boot() {
    if (LANG === 'en' || window.VCH_I18N) { start(); return; }
    var sc = document.createElement('script');
    sc.src = '/hub/i18n.js'; sc.onload = start; sc.onerror = start;
    document.head.appendChild(sc);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
