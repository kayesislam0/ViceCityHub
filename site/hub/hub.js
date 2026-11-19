/* Vice City Hub: the Leonida map tracker, the shareable card, the street-name and bingo tools.
   Everything runs on the visitor's device. No requests to other sites; progress is kept in localStorage. */
(function () {
  'use strict';

  var SITE = 'https://vicecityhub.okenshop.com/';
  var LEVELS = ['Not yet', 'Passed through', 'Explored', 'Finished'];

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
    { id: 'kalaga', color: '#1F7A4D', name: 'Mount Kalaga', full: 'Mount Kalaga National Park', label: [300, 104],
      d: outline(['kWest', 'kNorth', 'kEast', 'kV', 'kA', 'kG']) },
    { id: 'gellhorn', color: '#C9A15B', name: 'Port Gellhorn', full: 'Port Gellhorn', label: [212, 238], two: true,
      d: outline(['-kG', 'gA', 'gGr', 'gCoast']) },
    { id: 'ambrosia', color: '#E8762C', name: 'Ambrosia', full: 'Ambrosia', label: [364, 226],
      d: outline(['-kA', 'aV', 'aGr', '-gA']) },
    { id: 'vice', color: '#FF5FA2', color2: '#3FD6E8', name: 'Vice City', full: 'Vice City', label: [505, 318],
      d: outline(['-kV', 'vCoast', '-vGr', '-aV']) },
    { id: 'grass', color: '#3FAE5A', name: 'Grassrivers', full: 'Grassrivers', label: [384, 506],
      d: outline(['-gGr', '-aGr', 'vGr', 'grCoast']) },
    { id: 'keys', color: '#19B5A5', name: 'Leonida Keys', full: 'Leonida Keys', label: [190, 690],
      hit: 'M112 642L512 628L516 724L112 724Z',
      d: ellipse(474, 652, 28, 10) + ellipse(424, 672, 24, 9) + ellipse(376, 688, 22, 9) + ellipse(328, 699, 20, 8) + ellipse(282, 707, 18, 8) }
  ];
  var LAKE = ellipse(368, 296, 24, 34);

  var THEMES = {
    night:   { bg: '#0E1311', bg2: '#0E1311', sea: '#10232A', grid: 'rgba(244,241,234,.06)', ink: '#F4F1EA', ink2: '#B4BDB8', accent: '#FF5FA2', edge: '#0E1311',
               fill: ['#26302B', '#3E2B40', '#5E2F55', '#7D3B62'], onFull: '#0E1311', lake: '#10232A', darkFrom: 4, done: '#FFC35A', line: 'rgba(244,241,234,.14)' },
    sunset:  { bg: '#2A0F22', bg2: '#5E1F2C', sea: '#3A1630', grid: 'rgba(255,214,170,.07)', ink: '#FFF3E4', ink2: '#F2C9B0', accent: '#FFC35A', edge: '#2A0F22',
               fill: ['#47243A', '#8A3A3E', '#D46A3C', '#FFC35A'], onFull: '#2A0F22', lake: '#3A1630', darkFrom: 3, done: '#FFF3E4', line: 'rgba(255,243,228,.16)' },
    highway: { bg: '#0B6B3A', bg2: '#0B6B3A', sea: '#063F22', grid: 'rgba(255,255,255,.07)', ink: '#FFFFFF', ink2: '#D6EEDF', accent: '#FFFFFF', edge: '#0B6B3A',
               fill: ['#0E5434', '#3E9A68', '#9FCDB2', '#FFFFFF'], onFull: '#0B6B3A', lake: '#063F22', darkFrom: 2, done: '#FFC35A', line: 'rgba(255,255,255,.2)' }
  };
  // Dusk to deep berry: each step reads as progress, and a finished region is calm to look at, with a gold edge as the reward.
  var MAP_FILL = ['#26302B', '#3E2B40', '#5E2F55', '#7D3B62'];

  // Ranks by steps (6 regions x 3 levels = 18).
  var RANKS = [[0, 'Still in the menu'], [1, 'Tourist'], [6, 'Local'], [13, 'Legend']];

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
    // Each region has its own colour; Vice City runs from neon pink to cyan.
    var vg = el('linearGradient', { id: 'g-vice', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#FF5FA2' }, vg); el('stop', { offset: '1', 'stop-color': '#3FD6E8' }, vg);
    el('rect', { x: 0, y: 0, width: 600, height: 740, rx: 18, fill: '#0F1F25' }, svg);
    // The coastal shelf: a pale halo round the whole state, so its outline reads from across the room.
    var shelf = el('g', { 'pointer-events': 'none' }, svg);
    REGIONS.forEach(function (r) {
      el('path', { d: r.d, fill: 'rgba(143,179,191,.10)', stroke: 'rgba(143,179,191,.22)', 'stroke-width': 30, 'stroke-linejoin': 'round' }, shelf);
    });
    el('text', { class: 'map-title', x: 22, y: 40 }, svg).textContent = 'LEONIDA';
    pctEl = el('text', { class: 'map-pct', x: 578, y: 40 }, svg);
    REGIONS.forEach(function (r, i) {
      var g = el('g', { class: 'rg', tabindex: 0, role: 'button', 'data-i': i }, svg);
      g.style.setProperty('--c', r.color);
      el('path', { d: r.d, class: 'shape' }, g);
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
        el('text', { x: lx, y: ly + 16, 'text-anchor': 'middle' }, lg).textContent = parts.slice(1).join(' ');
        el('text', { class: 'lvl', x: lx, y: ly + 40, 'text-anchor': 'middle' }, lg);
      } else {
        el('text', { x: lx, y: ly, 'text-anchor': 'middle' }, lg).textContent = r.name;
        el('text', { class: 'lvl', x: lx, y: ly + 26, 'text-anchor': 'middle' }, lg);
      }
      // Finished badge: a gold disc with a tick, just right of the name.
      var bx = lx + (r.two ? 58 : r.name.length * 6.4 + 20), by = (r.two ? ly - 18 : ly - 8);
      var bd = el('g', { class: 'badge', transform: 'translate(' + bx + ' ' + by + ')' }, lg);
      el('circle', { r: 11 }, bd); el('path', { d: 'M-5 0.5l3.4 3.4 6.2-7' }, bd);
      labels.push(lg);
    });
  }

  // Your route: a dashed neon line through every region you have touched, in map order.
  function drawRoute() {
    return; // the page map stays calm: colour and labels carry the state
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
    if (levels[i] === 3) { toast(tr('{name} is already finished. To lower it, use the list.', { name: REGIONS[i].full })); return; }
    setLevel(i, levels[i] + 1);
  }

  function setLevel(i, lvl) {
    touched = true;
    var before = steps();
    levels[i] = lvl;
    save('vch.map', code());
    render();
    var p = groups[i].querySelector('.shape');
    p.classList.remove('pop'); void p.getBoundingClientRect(); p.classList.add('pop');
    var after = steps();
    if (rankIndex(after) > rankIndex(before)) {
      buzz();
      toast(after === 18 ? tr('Every region finished. You have seen all of Leonida.') : tr('Rank up: {rank}. {n}% of Leonida seen.', { rank: rank(after), n: score() }));
      var m = $('meter'); m.classList.remove('flash'); void m.offsetWidth; m.classList.add('flash');
    }
  }

  function render() {
    var n = steps(), p = pctOf(n), ri = rankIndex(n);
    groups.forEach(function (g, i) {
      var lvl = levels[i];
      var start = n === 0 && REGIONS[i].id === 'vice';
      g.dataset.level = lvl;
      g.querySelector('.shape').setAttribute('fill', lvl ? (REGIONS[i].color2 ? 'url(#g-vice)' : REGIONS[i].color) : MAP_FILL[0]);
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
    $('meter-sub').textContent = tr('{n} of 18 steps', { n: n });
    var next = RANKS[ri + 1];
    var from = RANKS[ri][0];
    $('xp').style.transform = 'scaleX(' + (next ? (n - from) / (next[0] - from) : 1) + ')';
    $('next-rank').textContent = next ? tr(next[0] - n === 1 ? '1 step to {rank}' : '{n} steps to {rank}', { n: next[0] - n, rank: tr(next[1]) }) : tr('Top rank reached.');
    updateChallenge();
    updateNextbar();
    drawSoon();
  }

  // ---- next-step bar: shown on phones once the map has progress, hidden while the card is on screen ----
  var cardOnScreen = false, mapOnScreen = true, touched = false;
  function updateNextbar() {
    var nb = $('nextbar'); if (!nb) return;
    var n = steps();
    $('nb-pct').textContent = pctOf(n) + '%';
    $('nb-rank').textContent = rank(n);
    nb.hidden = !(n > 0 && touched);
    nb.classList.toggle('is-away', cardOnScreen || mapOnScreen);
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
    $('challenge-msg').textContent = mine === 0 ? tr('Beat it.')
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
    dayone: load('vch.dayone', '0') === '1',
    useAlias: load('vch.useAlias', '0') === '1',
    aliasRoll: Number(load('vch.aliasRoll', '0')) || 0,
    format: load('vch.format', 'square') === 'story' ? 'story' : 'square',
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
    document.querySelectorAll('input[name="format"]').forEach(function (r) {
      r.checked = r.value === settings.format;
      r.addEventListener('change', function () { settings.format = r.value; save('vch.format', r.value); drawSoon(); });
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
      shareOrCopy(tr('My Leonida street name:') + '\n' + a.name + '\n' + a.known + '\n' + tr('Get yours:') + ' ' + SITE,
        function (m) { toast(m); }, tr('Street name copied. Paste it in the group chat.'));
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
          toast(after === 8 ? tr('Every square ticked.') : tr(after === 1 ? 'Bingo: 1 line. Share your board.' : 'Bingo: {n} lines. Share your board.', { n: after }));
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
    b.querySelector('span').textContent = tipped ? tr('Tip sent') : tr('I sent a tip');
    $('tipped-msg').textContent = tipped
      ? tr('Your card now shows a gold Backed the hub line. Tap again to remove it.')
      : tr('Sent a tip? Tap here to add a gold "Backed the hub" line to your card.');
  }
  function bindTipped() {
    $('tipped-btn').addEventListener('click', function () {
      tipped = !tipped; save('vch.tipped', tipped ? '1' : '');
      if (tipped) { buzz(); toast(tr('Thank you. Your card now shows Backed the hub.')); }
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

  // Card sizes: Square 1:1 for feeds, Story 9:16 for Stories, TikTok and Shorts. Painted at twice the layout size.
  var FORMATS = { square: [1080, 1080], story: [1080, 1920] };
  function draw() {
    cardDirty = false;
    var cv = $('card-canvas');
    var F = FORMATS[settings.format] || FORMATS.square, W = F[0], H = F[1], T = THEMES[settings.theme];
    if (cv.width !== W * 2 || cv.height !== H * 2) { cv.width = W * 2; cv.height = H * 2; }
    cv.classList.toggle('is-story', settings.format === 'story');
    var ctx = cv.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, T.bg); bg.addColorStop(1, T.bg2);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // Wrapped and Blend keep their 1080 x 1350 layout, fitted into the chosen size.
    if (settings.kind === 'wrapped' || (settings.kind === 'blend' && rival)) {
      var k = Math.min(W / 1080, H / 1350), ox = (W - 1080 * k) / 2, oy = (H - 1350 * k) / 2;
      ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k);
      if (settings.kind === 'wrapped') drawWrapped(ctx, T, 1080, 1350); else drawBlend(ctx, T, 1080, 1350);
      ctx.restore();
      return;
    }
    if (settings.format === 'story') drawStory(ctx, T, W, H); else drawSquare(ctx, T, W, H);
  }

  // The % fills the width it is given: the number at full size, the % sign at half.
  function bigPct(ctx, T, p, x, y, maxW, maxS) {
    var s = maxS, num = String(p);
    var fit = function () { ctx.font = '400 ' + s + 'px Anton, sans-serif'; var a = ctx.measureText(num).width; ctx.font = '400 ' + Math.round(s / 2) + 'px Anton, sans-serif'; return a + 8 + ctx.measureText('%').width; };
    while (fit() > maxW && s > 60) s -= 6;
    ctx.save();
    ctx.fillStyle = T.accent;
    ctx.font = '400 ' + s + 'px Anton, sans-serif'; ctx.fillText(num, x, y);
    var nw = ctx.measureText(num).width;
    ctx.font = '400 ' + Math.round(s / 2) + 'px Anton, sans-serif'; ctx.fillText('%', x + nw + 8, y);
    ctx.restore();
  }
  // The rank on a green highway sign: the hub's one signature detail.
  function rankSign(ctx, T, text, x, y, size) {
    ctx.font = '400 ' + size + 'px Anton, sans-serif';
    var w = ctx.measureText(text).width + size * 0.9, h = size * 1.5;
    roundRect(ctx, x, y, w, h, 10); ctx.fillStyle = '#0B6B3A'; ctx.fill();
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 7); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.fillText(text, x + size * 0.45, y + h / 2 + size * 0.36);
    return w;
  }
  function cardName() { var tag = (settings.tag || '').trim() || tr('Player one'); return settings.useAlias ? alias().name : tag; }
  function metaLine() {
    var lines = bingoLines();
    return tr('Plays on {p}', { p: settings.platform }) + (lines ? '  ' + 'Bingo ×' + lines : '');
  }
  // Every card ends with the same band: what to do, then where. Sized to read at a third of its size in a feed.
  function footer(ctx, T, W, H, h) {
    ctx.fillStyle = T.accent; ctx.fillRect(0, H - h, W, h);
    ctx.fillStyle = T.onFull;
    ctx.font = '400 ' + Math.round(h * 0.4) + 'px Anton, sans-serif';
    ctx.fillText(tr('Make yours in 20 seconds'), 64, H - h * 0.48);
    ctx.font = '600 ' + Math.round(h * 0.28) + 'px "DM Sans", sans-serif';
    ctx.fillText('vicecityhub.okenshop.com', 64, H - h * 0.14);
  }
  // Text on a region colour: dark on the bright colours, white on deep green.
  function inkOn(r) { return r.id === 'kalaga' ? '#FFFFFF' : '#0E1311'; }
  function regionPaint(ctx, r, x, w) {
    if (!r.color2) return r.color;
    var g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, r.color); g.addColorStop(1, r.color2); return g;
  }
  function tick(ctx, cx, cy, rad, T) {
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fillStyle = T.done; ctx.fill();
    ctx.strokeStyle = '#0E1311'; ctx.lineWidth = rad * 0.24; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx - rad * 0.45, cy + rad * 0.02); ctx.lineTo(cx - rad * 0.12, cy + rad * 0.36); ctx.lineTo(cx + rad * 0.48, cy - rad * 0.34); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // Six region tiles: empty outline, half colour, full colour, full colour with a gold edge and tick.
  function regionTiles(ctx, T, x, y, w, h, gap) {
    var tw = (w - gap * 2) / 3;
    REGIONS.forEach(function (r, i) {
      var tx = x + (i % 3) * (tw + gap), ty = y + Math.floor(i / 3) * (h + gap), l = levels[i];
      roundRect(ctx, tx, ty, tw, h, 14);
      if (l) { ctx.globalAlpha = l === 1 ? 0.45 : 1; ctx.fillStyle = regionPaint(ctx, r, tx, tw); ctx.fill(); ctx.globalAlpha = 1; }
      else { ctx.strokeStyle = T.line; ctx.lineWidth = 3; ctx.stroke(); }
      if (l === 3) { roundRect(ctx, tx + 3, ty + 3, tw - 6, h - 6, 12); ctx.strokeStyle = T.done; ctx.lineWidth = 6; ctx.stroke(); }
      var name = r.id === 'kalaga' ? 'Mt Kalaga' : r.name;
      ctx.fillStyle = l >= 2 ? inkOn(r) : l === 1 ? '#FFFFFF' : T.ink2;
      fitText(ctx, name, tw - (l === 3 ? 92 : 40), 44, '400 {s}px Anton, sans-serif');
      ctx.fillText(name, tx + 20, ty + h / 2 + 16);
      if (l === 3) tick(ctx, tx + tw - 40, ty + h / 2, 22, T);
    });
  }
  // Minimal cards: one huge, sharp number; the name; the rank; the map. Nothing else competes.
  function drawSquare(ctx, T, W, H) {
    var n = steps(), p = pctOf(n);
    rankSign(ctx, T, rank(n), 64, 64, 54);
    drawMap(ctx, T, 572, 52, 0.76);
    bigPct(ctx, T, p, 50, 700, 620, 480);
    ctx.fillStyle = T.ink2; ctx.font = '600 46px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida seen'), 64, 772);
    ctx.fillStyle = T.ink;
    var nm = cardName(); fitText(ctx, nm, W - 128, 104, '400 {s}px Anton, sans-serif'); ctx.fillText(nm, 60, 900);
    if (settings.dayone) { ctx.save(); ctx.translate(430, 215); ctx.scale(0.62, 0.62); stamp(ctx, 0, 0, T); ctx.restore(); }
    footer(ctx, T, W, H, 124);
  }
  function drawStory(ctx, T, W, H) {
    var n = steps(), p = pctOf(n);
    rankSign(ctx, T, rank(n), 64, 120, 60);
    bigPct(ctx, T, p, 48, 800, 960, 620);
    ctx.fillStyle = T.ink2; ctx.font = '600 56px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida seen'), 64, 890);
    ctx.fillStyle = T.ink;
    var nm = cardName(); fitText(ctx, nm, W - 128, 132, '400 {s}px Anton, sans-serif'); ctx.fillText(nm, 60, 1060);
    var sc = 0.86; drawMap(ctx, T, (W - 600 * sc) / 2, 1110, sc, null, { labels: true });
    if (settings.dayone) stamp(ctx, 930, 190, T);
    footer(ctx, T, W, H, 150);
  }

  // The map as drawn on the cards, at (x, y) and scale sc of its 600 x 740 layout. No frame: the state itself is the picture.
  // blend: { mine: [...], theirs: [...] } paints who explored each region. opts.labels: region names (Story and Blend).
  function drawMap(ctx, T, x, y, sc, blend, opts) {
    var labels = !!(opts && opts.labels);
    // Card label spots: Port Gellhorn and Ambrosia move apart so the bigger names never touch.
    var SPOT = { gellhorn: [188, 240], ambrosia: [388, 212] };
    var LV = blend ? blend.mine.map(function (m, i) { return Math.max(m, blend.theirs[i]); }) : levels;
    var tone = function (i) { return blend ? (LV[i] ? 2 : 0) : LV[i]; };
    var paint = function (r, t) {
      if (!t) return T.fill[0];
      if (!r.color2) return r.color;
      var g = ctx.createLinearGradient(0, 160, 0, 560); g.addColorStop(0, r.color); g.addColorStop(1, r.color2); return g;
    };
    ctx.save();
    ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.lineJoin = 'round';
    // one soft shadow under the whole state
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16; ctx.fillStyle = T.fill[0];
    REGIONS.forEach(function (r) { ctx.fill(new Path2D(r.d)); }); ctx.restore();
    REGIONS.forEach(function (r, i) {
      var path = new Path2D(r.d), t = tone(i);
      ctx.globalAlpha = t === 1 ? 0.5 : 1; ctx.fillStyle = paint(r, t); ctx.fill(path);
      // The Keys are thin islands: a fat stroke in their own colour keeps them visible at thumbnail size.
      if (r.id === 'keys') { ctx.strokeStyle = t ? (r.color) : T.fill[0]; ctx.lineWidth = 12; ctx.stroke(path); }
      ctx.globalAlpha = 1;
    });
    REGIONS.forEach(function (r, i) {
      var path = new Path2D(r.d);
      ctx.strokeStyle = tone(i) ? T.bg : T.line; ctx.lineWidth = tone(i) ? 5 : 3; ctx.stroke(path);
    });
    REGIONS.forEach(function (r, i) {
      var path = new Path2D(r.d), col = null;
      if (blend) { var me = blend.mine[i] > 0, them = blend.theirs[i] > 0; if (me || them) col = me && them ? T.ink : me ? T.accent : T.done; }
      else if (LV[i] === 3) col = T.done;
      if (col) { ctx.strokeStyle = col; ctx.lineWidth = r.id === 'keys' ? 6 : 9; ctx.stroke(path); }
    });
    ctx.fillStyle = T.bg; ctx.fill(new Path2D(LAKE));
    ctx.textAlign = 'center';
    REGIONS.forEach(function (r, i) {
      var lp = SPOT[r.id] || r.label;
      var t = tone(i), lines = r.two ? [r.name.split(' ')[0], r.name.split(' ').slice(1).join(' ')] : [r.name];
      if (r.id === 'kalaga') lines = ['Mount Kalaga'];
      var fs = 46, lh = 44;
      if (labels) {
        ctx.font = '400 ' + fs + 'px Anton, sans-serif';
        lines.forEach(function (txt, k) {
          var ly = lp[1] + (r.two ? (k ? lh / 2 + 4 : -lh / 2 + 4) : 10);
          ctx.strokeStyle = 'rgba(14,19,17,.85)'; ctx.lineWidth = 10; ctx.strokeText(txt, lp[0], ly);
          ctx.fillStyle = t ? '#FFFFFF' : T.ink2; ctx.fillText(txt, lp[0], ly);
        });
      }
      if (!blend && LV[i] === 3) {
        // With names: the tick sits right of the name if it fits, otherwise under it. Without names: on the label spot.
        var bx = lp[0], by = lp[1];
        if (labels) {
          ctx.font = '400 ' + fs + 'px Anton, sans-serif';
          var tw = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; }));
          if (lp[0] + tw / 2 + 64 < 600) { bx = lp[0] + tw / 2 + 36; by = lp[1] - 6; } else { by = lp[1] + (r.two ? lh + 36 : 62); }
        }
        if (r.id === 'keys') { bx = 470; by = labels ? 600 : 610; }
        tick(ctx, bx, by, 26, T);
      }
    });
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
    ctx.fillStyle = T.ink2; ctx.font = '600 36px "DM Sans", sans-serif';
    ctx.fillText(tr('19 Nov – 10 Dec 2026'), 64, 512);

    drawMap(ctx, T, 636, 572, 0.6);

    var n = steps(), done100 = levels.filter(function (l) { return l === 3; }).length, best = longestStreak();
    ctx.fillStyle = T.accent;
    fitText(ctx, pctOf(n) + '%', 560, 168, '400 {s}px Anton, sans-serif');
    ctx.fillText(pctOf(n) + '%', 58, 742);
    ctx.fillStyle = T.ink2; ctx.font = '600 36px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida seen'), 64, 792);
    ctx.fillStyle = T.ink;
    fitText(ctx, rank(n), 540, 88, '400 {s}px Anton, sans-serif');
    ctx.fillText(rank(n), 62, 910);
    ctx.fillStyle = T.ink2; ctx.font = '600 36px "DM Sans", sans-serif';
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
      ctx.fillStyle = T.ink2; ctx.font = '600 36px "DM Sans", sans-serif';
      ctx.fillText(st[1], x + 2, 1162);
    });

    var tag = (settings.tag || '').trim() || tr('Player one');
    var title = settings.useAlias ? alias().name : tag;
    ctx.fillStyle = T.ink;
    fitText(ctx, title, W - 128, 64, '400 {s}px Anton, sans-serif');
    ctx.fillText(title, 64, 1250);

    ctx.fillStyle = T.accent;
    ctx.fillRect(0, H - 84, W, 84);
    ctx.fillStyle = T.onFull;
    fitText(ctx, tr('Make yours in 20 seconds') + '  vicecityhub.okenshop.com', W - 128, 42, '600 {s}px "DM Sans", sans-serif');
    ctx.fillText(tr('Make yours in 20 seconds') + '  vicecityhub.okenshop.com', 64, H - 28);
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
    ctx.fillStyle = T.ink2; ctx.font = '600 36px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida covered'), x, 686);
    ctx.fillText(tr('together'), x, 722);
    ctx.fillStyle = T.ink; ctx.font = '400 104px Anton, sans-serif';
    ctx.fillText(st.match + '%', x - 2, 852);
    ctx.fillStyle = T.ink2; ctx.font = '600 36px "DM Sans", sans-serif';
    ctx.fillText(tr('map match'), x, 894);
    ctx.fillStyle = T.ink;
    var carry = st.carry === 0 ? tr('Dead even') : tr('{name} carried', { name: st.carry > 0 ? me : rival.name });
    fitText(ctx, carry, 420, 56, '400 {s}px Anton, sans-serif');
    ctx.fillText(carry, x, 990);
    // legend
    [[T.accent, me], [T.done, rival.name], [T.ink, tr('Both of you')]].forEach(function (l, k) {
      var ly = 1060 + k * 48;
      ctx.strokeStyle = l[0]; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, ly - 10); ctx.lineTo(x + 40, ly - 10); ctx.stroke();
      ctx.fillStyle = T.ink2; ctx.font = '600 36px "DM Sans", sans-serif';
      fitText(ctx, l[1], 360, 36, '600 {s}px "DM Sans", sans-serif');
      ctx.fillText(l[1], x + 56, ly);
    });

    ctx.fillStyle = T.accent;
    ctx.fillRect(0, H - 84, W, 84);
    ctx.fillStyle = T.onFull;
    fitText(ctx, tr('Blend with me:') + ' vicecityhub.okenshop.com', W - 128, 42, '600 {s}px "DM Sans", sans-serif');
    ctx.fillText(tr('Blend with me:') + ' vicecityhub.okenshop.com', 64, H - 28);
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

  // ---- start ----
  function start() {
    translatePage(); bindLang(); bindSaveLine();
    if (!$('map')) { bindCheats(); return; } // the cheat code page has only the cheat list
    buildMap(); bindList(); bindSettings(); bindAlias(); bindBingo(); bindDaily(); bindTipped(); bindCheats(); bindActions(); readChallenge();
    if (steps() > 0) touched = true;
    buildBingo(); renderDaily(); renderTipped(); renderAlias(); render();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderDaily(); });
    var cv = $('card-canvas');
    if ('IntersectionObserver' in window) {
      // Away while you are still using the map, so the bar never covers a region you want to tap.
      new IntersectionObserver(function (es) { mapOnScreen = es[0].intersectionRatio > 0.25; updateNextbar(); }, { threshold: [0, 0.25, 0.5] }).observe($('map-wrap'));
      // Away once the card is on screen or already scrolled past, so the bar never covers the tools, tips or footer.
      new IntersectionObserver(function (es) { var e = es[0]; cardOnScreen = e.isIntersecting || e.boundingClientRect.top < 0; updateNextbar(); }, { threshold: 0.15 }).observe($('card'));
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
