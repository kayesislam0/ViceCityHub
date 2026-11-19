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
    { id: 'gellhorn', color: '#C9A15B', name: 'Port Gellhorn', full: 'Port Gellhorn', label: [218, 206], two: true,
      d: outline(['-kG', 'gA', 'gGr', 'gCoast']) },
    { id: 'ambrosia', color: '#E8762C', name: 'Ambrosia', full: 'Ambrosia', label: [342, 224],
      d: outline(['-kA', 'aV', 'aGr', '-gA']) },
    { id: 'vice', color: '#FF5FA2', color2: '#3FD6E8', name: 'Vice City', full: 'Vice City', label: [500, 300],
      d: outline(['-kV', 'vCoast', '-vGr', '-aV']) },
    { id: 'grass', color: '#3FAE5A', name: 'Grassrivers', full: 'Grassrivers', label: [360, 452],
      d: outline(['-gGr', '-aGr', 'vGr', 'grCoast']) },
    { id: 'keys', color: '#19B5A5', name: 'Leonida Keys', full: 'Leonida Keys', label: [190, 690], out: true,
      hit: 'M112 642L512 628L516 724L112 724Z',
      d: ellipse(474, 652, 28, 10) + ellipse(424, 672, 24, 9) + ellipse(376, 688, 22, 9) + ellipse(328, 699, 20, 8) + ellipse(282, 707, 18, 8) }
  ];
  var LAKE = ellipse(368, 296, 24, 34);

  // Three colour schemes for the map and the card. Colour means progress only, one step per level, the same way in each:
  // fog = not seen, a tint = passed through, full colour = explored, gold = finished (gold is the reward in every scheme).
  //   Neon night (default): hot pink on near-black. Pink reads as positive and energising, and against black it is the
  //     most eye-catching colour on the page; it is also Vice City's nightlife colour.
  //   Golden hour: warm coral on deep plum. Orange-red is positive and high-energy: a Leonida sunset.
  //   Ocean drive: cyan on deep navy. Blue-green is positive and calm, and blue against gold is the pair colour-blind
  //     players tell apart most easily.
  // passed is the accent at 35% over the background, so all four levels step clearly in lightness as well as colour.
  var THEMES = {
    night:  { name: 'Neon night', bg: '#0E1311', bg2: '#0E1311', ink: '#F4F1EA', ink2: '#B4BDB8', accent: '#FF5FA2', passed: '#622E44', done: '#FFC35A',
              onFull: '#0E1311', edge: '#0E1311', lake: '#0F1F25', sea: '#0F1F25', line: 'rgba(244,241,234,.14)', fog: 'rgba(244,241,234,.09)', fill: ['#1A2420'] },
    sunset: { name: 'Golden hour', bg: '#2A0F22', bg2: '#4A1A2A', ink: '#FFF3E4', ink2: '#F2C9B0', accent: '#FF6B5B', passed: '#742F36', done: '#FFC35A',
              onFull: '#2A0F22', edge: '#2A0F22', lake: '#3A1630', sea: '#341429', line: 'rgba(255,243,228,.16)', fog: 'rgba(255,214,170,.10)', fill: ['#3A1A30'] },
    ocean:  { name: 'Ocean drive', bg: '#08151F', bg2: '#0B2233', ink: '#EEF7FA', ink2: '#A9C3CC', accent: '#3FD6E8', passed: '#1B5965', done: '#FFC35A',
              onFull: '#08151F', edge: '#08151F', lake: '#06111A', sea: '#0A1C29', line: 'rgba(238,247,250,.14)', fog: 'rgba(238,247,250,.09)', fill: ['#14232E'] }
  };
  function levelFill(T, l) { return [null, T.passed, T.accent, T.done][l]; }
  // Short level words on the map, so a label never runs past its region.
  var SHORT = ['', 'Passed', 'Explored', 'Finished'];

  // Ranks by steps (6 regions x 3 levels = 18). Small, frequent steps early, so the next rank is always close;
  // the last one is only for a fully finished map.
  var RANKS = [[0, 'Still in the menu'], [1, 'Fresh off the bus'], [3, 'Tourist'], [5, 'Weekend driver'], [7, 'Local'],
    [10, 'Street regular'], [13, 'Kingpin'], [16, 'Leonida legend'], [18, 'Owns the map']];

  // ---- storage (may be blocked: private mode, embedded previews) ----
  function load(key, fallback) { try { var v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* nothing to do */ } }

  // ---- keeping progress: ask the browser to keep this site's storage, restore from a progress link, warn when it won't stick ----
  var storageWorks = (function () { try { localStorage.setItem('vch.t', '1'); localStorage.removeItem('vch.t'); return true; } catch (e) { return false; } })();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* not supported */ }
  // In-app browsers (Instagram, Facebook, TikTok, Snapchat...) often throw away site data when you close them.
  var inApp = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|TikTok|musical_ly|Snapchat|Twitter|Pinterest|; wv\)/i.test(navigator.userAgent || '');
  function progressData() {
    var o = {};
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('vch.') === 0) o[k] = localStorage.getItem(k); } } catch (e) { /* blocked */ }
    return o;
  }
  function encodeProgress(o) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function progressCode() {
    var o = progressData();
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
  function toast(msg, action, run) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    if (action) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'toast__act'; b.textContent = action;
      b.addEventListener('click', function () { run(); t.classList.remove('is-in'); setTimeout(function () { t.hidden = true; }, 250); });
      t.appendChild(document.createTextNode(' ')); t.appendChild(b);
    }
    t.classList.remove('is-in'); void t.offsetWidth; t.classList.add('is-in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.hidden = true; }, 250); }, action ? 6000 : 3800);
  }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) { /* not supported */ } }

  // ---- the map ----
  var groups = [], labels = [], lakeEl = null, routeG = null, pctEl = null;
  // Where a region's route dot sits: just above its name, so the dot never covers the label.
  function anchorOf(r) { return [r.label[0], r.label[1] - 40]; }

  var fogBase = null, fogLine = null, seaEl = null;
  function buildMap() {
    var svg = $('map');
    var defs = el('defs', {}, svg);
    // Fog over regions you have not seen: fine diagonal lines, so "unknown" reads at a glance.
    var pat = el('pattern', { id: 'fog', width: 12, height: 12, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    fogBase = el('rect', { width: 12, height: 12 }, pat); fogLine = el('rect', { width: 3, height: 12 }, pat);
    seaEl = el('rect', { x: 0, y: 0, width: 600, height: 740, rx: 18 }, svg);
    // The coast: a faint line round the whole state, so its outline reads before anything is coloured in.
    var shelf = el('g', { 'pointer-events': 'none' }, svg);
    REGIONS.forEach(function (r) { el('path', { d: r.d, fill: 'none', stroke: 'rgba(143,179,191,.14)', 'stroke-width': 16, 'stroke-linejoin': 'round' }, shelf); });
    el('text', { class: 'map-title', x: 22, y: 40 }, svg).textContent = 'Leonida';
    pctEl = el('text', { class: 'map-pct', x: 578, y: 40 }, svg);
    REGIONS.forEach(function (r, i) {
      var g = el('g', { class: 'rg', tabindex: 0, role: 'button', 'data-i': i }, svg);
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
    lakeEl = el('path', { d: LAKE, class: 'lake', 'pointer-events': 'none' }, svg);
    el('text', { class: 'lake-name', x: 368, y: 300, 'text-anchor': 'middle', 'pointer-events': 'none' }, svg).textContent = tr('Lake');
    routeG = el('g', { 'pointer-events': 'none' }, svg);
    // Each label: the name, and under it the level in a short word. A finished region gets a tick in front of "Finished".
    REGIONS.forEach(function (r) {
      var lg = el('g', { class: 'rl' + (r.out ? ' out' : ''), 'pointer-events': 'none' }, svg);
      var lx = r.label[0], ly = r.label[1], lvlY;
      if (r.two) {
        var parts = r.name.split(' ');
        el('text', { x: lx, y: ly - 10, 'text-anchor': 'middle' }, lg).textContent = parts[0];
        el('text', { x: lx, y: ly + 16, 'text-anchor': 'middle' }, lg).textContent = parts.slice(1).join(' ');
        lvlY = ly + 38;
      } else {
        el('text', { x: lx, y: ly, 'text-anchor': 'middle' }, lg).textContent = r.name;
        lvlY = ly + 22;
      }
      el('text', { class: 'lvl', x: lx, y: lvlY, 'text-anchor': 'middle' }, lg);
      var bd = el('g', { class: 'badge' }, lg);
      el('circle', { r: 8 }, bd); el('path', { d: 'M-3.6 0.2l2.5 2.5 4.6-5' }, bd);
      labels.push(lg);
    });
    applyPalette();
  }
  // Paints the map in the chosen scheme: sea, fog, and the colours the key and the picker show.
  function applyPalette() {
    var T = THEMES[settings.theme], w = $('map-wrap');
    seaEl.setAttribute('fill', T.sea);
    fogBase.setAttribute('fill', T.fill[0]); fogLine.setAttribute('fill', T.fog);
    lakeEl.setAttribute('fill', T.lake); lakeEl.setAttribute('stroke', T.edge);
    [['--m-bg', T.bg], ['--m-edge', T.edge], ['--m-fog', T.fill[0]], ['--m-passed', T.passed], ['--m-accent', T.accent], ['--m-done', T.done], ['--m-on', T.onFull]]
      .forEach(function (v) { w.style.setProperty(v[0], v[1]); });
    document.querySelectorAll('input[name="theme"], input[name="map-theme"]').forEach(function (r) { r.checked = r.value === settings.theme; });
  }
  function setTheme(v) {
    if (!THEMES[v]) return;
    settings.theme = v; save('vch.theme', v);
    applyPalette(); render();
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
        b.addEventListener('click', function () { setLevel(i, k); });
      });
    });
  }

  // A map tap goes one step deeper and stops at Finished, so a stray tap never wipes a region. Every tap also
  // selects the region in the picker under the map, where any level (Not seen included) is one tap away.
  var picked = -1;
  function deeper(i) {
    picked = i;
    if (levels[i] < 3) setLevel(i, levels[i] + 1); else render();
  }
  function bindPick() {
    $('pick').querySelectorAll('.pick__steps button').forEach(function (b) {
      b.addEventListener('click', function () { if (picked >= 0) setLevel(picked, Number(b.dataset.k)); });
    });
    $('map-undo').addEventListener('click', undoMap);
  }
  function renderPick() {
    var box = $('pick'); if (!box) return;
    box.hidden = picked < 0;
    if (picked < 0) return;
    var l = levels[picked];
    $('pick-name').textContent = REGIONS[picked].full;
    $('pick-hint').textContent = l === 3 ? tr('Finished. Pick a level to change it') : tr('Tap again to go deeper, or pick a level');
    $('map-undo').hidden = !past.length;
    box.querySelectorAll('.pick__steps button').forEach(function (b) {
      var k = Number(b.dataset.k);
      b.setAttribute('aria-pressed', String(k === l));
      b.classList.toggle('is-reached', k > 0 && k < l);
      b.setAttribute('aria-label', REGIONS[picked].full + ': ' + tr(LEVELS[k] === 'Not yet' ? 'Not seen' : LEVELS[k]));
    });
  }

  var past = [];
  function remember() { past.push(code()); if (past.length > 30) past.shift(); }
  function undoMap() {
    if (!past.length) return;
    var was = code();
    levels = past.pop().split('').map(Number);
    save('vch.map', code()); render();
    for (var k = 0; k < 6; k++) if (was[k] !== code()[k]) { picked = k; break; }
    renderPick();
  }
  function setLevel(i, lvl) {
    if (levels[i] === lvl) { render(); return; }
    remember();
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
      g.querySelector('.shape').setAttribute('fill', lvl ? levelFill(THEMES[settings.theme], lvl) : 'url(#fog)');
      labels[i].dataset.level = lvl;
      labels[i].classList.toggle('start', start);
      var lt = labels[i].querySelector('.lvl');
      lt.textContent = lvl ? tr(SHORT[lvl]) : (start ? tr('Tap to start') : '');
      // The tick sits just left of "Finished", centred with it as one unit.
      if (lvl === 3) {
        var tw = 0; try { tw = lt.getComputedTextLength(); } catch (e) { tw = 60; }
        var cx = Number(lt.getAttribute('x')), cy = Number(lt.getAttribute('y')) - 5;
        lt.setAttribute('dx', 10);
        labels[i].querySelector('.badge').setAttribute('transform', 'translate(' + (cx - tw / 2 - 2) + ' ' + cy + ')');
      } else lt.removeAttribute('dx');
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
        bs[j].classList.toggle('is-reached', k > 0 && k < levels[i]);
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
    renderPick();
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
    $('vs-them').textContent = n;
    $('challenge-score').textContent = rival.pct + '%';
    $('vs-them-bar').style.transform = 'scaleX(' + rival.pct / 100 + ')';
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
    $('vs-you').textContent = mine + '%';
    $('vs-you-bar').style.transform = 'scaleX(' + mine / 100 + ')';
    $('challenge-msg').textContent = mine === 0 ? tr('Tap the regions you\'ve seen to answer')
      : mine < rival.pct ? tr('{n} points behind {name}. Keep going.', { n: rival.pct - mine, name: rival.name })
      : mine === rival.pct ? tr('Dead even with {name}. One more step wins it.', { name: rival.name })
      : tr('You beat {name}. Make your card and send it back.', { name: rival.name });
    $('challenge').classList.toggle('is-winning', mine > rival.pct);
    // Region by region: where each of you is ahead, so there is always a concrete next step.
    var ahead = 0, behind = [], even = 0;
    levels.forEach(function (l, i) { if (l > rival.levels[i]) ahead++; else if (l < rival.levels[i]) behind.push(tr(REGIONS[i].full)); else even++; });
    var line = mine === 0 ? '' : behind.length
      ? tr('Ahead in {a} of 6 regions. Catch up in {list}', { a: ahead, list: behind.slice(0, 3).join(', ') + (behind.length > 3 ? '…' : '') })
      : tr('Level with or ahead of {name} in every region', { name: rival.name });
    $('vs-regions').textContent = line; $('vs-regions').hidden = !line;
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
  if (settings.theme === 'highway') settings.theme = 'ocean'; // the old Highway look became Ocean drive
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
    // The colour scheme can be picked under the map or in the card options; both stay in step.
    document.querySelectorAll('input[name="theme"], input[name="map-theme"]').forEach(function (r) {
      r.checked = r.value === settings.theme;
      r.addEventListener('change', function () { if (r.checked) setTheme(r.value); });
    });
    document.querySelectorAll('input[name="kind"]').forEach(function (r) {
      r.checked = r.value === settings.kind;
      r.addEventListener('change', function () { settings.kind = r.value; if (r.value !== 'blend') save('vch.kind', r.value); drawSoon(); });
    });
    var dLabel = $('dayone').parentNode.querySelector('span');
    dLabel.textContent = tr('Show the day on my card: {day}', { day: startDay() === 0 ? tr('Day one') : tr('Day {n}', { n: startDay() + 1 }) });
    var d = $('dayone');
    d.checked = settings.dayone;
    d.addEventListener('change', function () { settings.dayone = d.checked; save('vch.dayone', d.checked ? '1' : '0'); drawSoon(); });
    var a = $('use-alias');
    a.checked = settings.useAlias;
    a.addEventListener('change', function () { settings.useAlias = a.checked; save('vch.useAlias', a.checked ? '1' : '0'); drawSoon(); });
  }

  // ---- street name: same name in, same street name out ----
  var ALIAS_FIRST = ['Neon', 'Midnight', 'Low-Tide', 'Sunburnt', 'Chrome', 'Palm', 'Two-Lane', 'Mangrove', 'Velvet', 'Saltwater',
    'Hurricane', 'Static', 'Backroad', 'Dockside', 'Golden', 'Swamp'];
  var ALIAS_TITLE = ['Gator', 'Flamingo', 'Pelican', 'Night Owl', 'Tow Truck', 'Heatwave', 'Undertow', 'Riptide', 'Toll Booth',
    'Swamp Rat', 'Dock Boss', 'Jet Ski', 'Sugar King', 'Lighthouse', 'Last Exit', 'Hubcap'];
  var ALIAS_KNOWN = ['never using the brakes', 'tipping in pocket change', 'driving with the hazards on', 'knowing every back road in Grassrivers',
    'still owing someone in Port Gellhorn', 'sleeping through every sunrise', 'owning a boat and no licence', 'getting lost on purpose',
    'parking on the sidewalk', 'blasting the radio at 3 AM', 'outrunning the rain', 'saying “one more mission, then bed”',
    'waving at every cop car', 'never skipping a cutscene', 'a suspiciously clean car', 'always taking the scenic route'];

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // "RafiVC" becomes RafiVC "Mangrove Gator": the tag stays, the street adds a nickname you can say out loud.
  function alias() {
    var name = (settings.tag || '').trim() || tr('Player');
    var h = hash(name.toLowerCase() + '#' + settings.aliasRoll);
    var nick = '“' + ALIAS_FIRST[h % 16] + ' ' + ALIAS_TITLE[(h >>> 4) % 16] + '”';
    return { tag: name, nick: nick, name: name + ' ' + nick, known: tr('Known for {x}.', { x: tr(ALIAS_KNOWN[(h >>> 8) % 16]) }) };
  }
  function renderAlias() {
    var a = alias();
    $('alias-aka').textContent = tr('{name}, known on the street as', { name: a.tag });
    $('alias-name').textContent = a.nick;
    $('alias-prev').hidden = settings.aliasRoll < 1;
    $('alias-known').textContent = a.known;
  }
  function bindAlias() {
    $('alias-prev').addEventListener('click', function () {
      if (settings.aliasRoll < 1) return;
      settings.aliasRoll -= 1; save('vch.aliasRoll', String(settings.aliasRoll));
      renderAlias(); drawSoon();
    });
    $('alias-roll').addEventListener('click', function () {
      settings.aliasRoll += 1; save('vch.aliasRoll', String(settings.aliasRoll));
      renderAlias(); drawSoon();
      var o = $('alias-out'); o.classList.remove('pop-in'); void o.offsetWidth; o.classList.add('pop-in');
    });
    $('alias-copy').addEventListener('click', function () {
      var a = alias();
      shareOrCopy(tr('My Leonida street name:') + ' ' + a.nick + '\n' + a.known + '\n' + tr('What\'s yours?') + ' ' + SITE,
        function (m) { toast(m); }, tr('Street name copied. Paste it in the group chat.'));
    });
  }

  // ---- launch-night bingo: 3 x 3 or 5 x 5, free centre, a different board for every player ----
  // 24 prompts: a 5 x 5 board uses all of them, a 3 x 3 board draws 8. Each size keeps its own ticks.
  var BINGO = ['Wanted in the first 10 minutes', 'Skipped a mission to explore', 'Crashed within a block of the start',
    'Changed outfit before anything else', 'Drove on the beach', 'Got lost in the swamp', 'Watched a sunset on purpose',
    'Stole a boat', 'Still playing at 3 AM', 'Lost a fight to a stranger', 'One radio station on repeat',
    'Followed the GPS into water', 'Fell off a roof', 'Hid from the cops in an alley', 'Texted the crew “it’s so good”',
    'Forgot to eat dinner', 'Drove to the Keys at night', 'Restarted a mission 3 times', '20 photos before mission 2',
    'Honked at every car', 'Parked in a silly spot', 'Swam when you should have driven', 'Ran out of money already',
    'Missed a turn on Ocean Drive'];
  // Rows, columns and both diagonals of an n x n board.
  function linesOf(n) {
    var out = [], d1 = [], d2 = [];
    for (var r = 0; r < n; r++) {
      var row = [], col = [];
      for (var c = 0; c < n; c++) { row.push(r * n + c); col.push(c * n + r); }
      out.push(row, col); d1.push(r * n + r); d2.push(r * n + (n - 1 - r));
    }
    return out.concat([d1, d2]);
  }
  // 5 x 5 needs a screen at least 360px wide for its words to fit whole; narrower phones play 3 x 3 (the 5 x 5 board and
  // its ticks stay saved for a wider screen).
  function fitsBig() { try { return !matchMedia('(max-width: 359px)').matches; } catch (e) { return true; } }
  var bingo = { size: load('vch.bingoSize', '3') === '5' && fitsBig() ? 5 : 3, seed: Number(load('vch.bingoSeed', '0')) || (Math.floor(Math.random() * 1e9) + 1) };
  function marksKey() { return bingo.size === 5 ? 'vch.bingoMarksBig' : 'vch.bingoMarks'; }
  function cellCount() { return bingo.size * bingo.size; }
  function centre() { return (cellCount() - 1) / 2; }
  function freshMarks() { var m = []; for (var i = 0; i < cellCount(); i++) m.push(i === centre() ? 1 : 0); return m; }
  function loadMarks() {
    var m = load(marksKey(), ''), n = cellCount();
    bingo.marks = new RegExp('^[01]{' + n + '}$').test(m) ? m.split('').map(Number) : freshMarks();
    bingo.marks[centre()] = 1;
  }
  function saveMarks() { save(marksKey(), bingo.marks.join('')); }
  loadMarks();
  save('vch.bingoSeed', String(bingo.seed));
  function LINES() { return linesOf(bingo.size); }

  function boardPrompts() {
    var idx = BINGO.map(function (_, i) { return i; });
    var s = bingo.seed;
    for (var i = idx.length - 1; i > 0; i--) { // seeded Fisher-Yates
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      var j = s % (i + 1); var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    var picks = idx.slice(0, cellCount() - 1).map(function (k) { return BINGO[k]; });
    picks.splice(centre(), 0, 'Free: played on launch night');
    return picks;
  }
  function bingoLines() { return LINES().filter(function (l) { return l.every(function (i) { return bingo.marks[i]; }); }).length; }
  // Ticks still needed for the closest unfinished line (0 when every line is done).
  function bingoNeed() {
    var need = bingo.size;
    LINES().forEach(function (l) { var k = l.filter(function (i) { return !bingo.marks[i]; }).length; if (k) need = Math.min(need, k); });
    return bingoLines() === LINES().length ? 0 : need;
  }
  function ticked() { return bingo.marks.reduce(function (a, b) { return a + b; }, 0) - 1; }
  function paintLines() {
    var on = {};
    LINES().forEach(function (l) { if (l.every(function (i) { return bingo.marks[i]; })) l.forEach(function (i) { on[i] = 1; }); });
    Array.prototype.forEach.call($('bingo').children, function (c, i) { c.classList.toggle('is-line', !!on[i]); });
  }

  function buildBingo() {
    var box = $('bingo'), c = centre();
    box.textContent = '';
    box.classList.toggle('is-big', bingo.size === 5);
    box.style.setProperty('--n', bingo.size);
    boardPrompts().forEach(function (text, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell' + (i === c ? ' cell--free' : '');
      b.textContent = tr(text);
      b.setAttribute('aria-pressed', String(Boolean(bingo.marks[i])));
      if (i === c) b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', function () {
        if (i === c) return;
        var before = bingoLines();
        bingo.marks[i] = bingo.marks[i] ? 0 : 1;
        saveMarks();
        b.setAttribute('aria-pressed', String(Boolean(bingo.marks[i])));
        var after = bingoLines();
        renderBingoScore();
        if (after > before) {
          buzz();
          toast(after === LINES().length ? tr('Every square ticked.') : tr(after === 1 ? 'Bingo: 1 line. Share your board.' : 'Bingo: {n} lines. Share your board.', { n: after }));
          box.classList.remove('win'); void box.offsetWidth; box.classList.add('win');
        }
        drawSoon();
      });
      box.appendChild(b);
    });
    document.querySelectorAll('input[name="bingo-size"]').forEach(function (r) { r.checked = Number(r.value) === bingo.size; });
    renderBingoScore();
  }
  function renderBingoScore() {
    var n = bingoLines(), need = bingoNeed();
    var next = need === 1 ? tr('1 more for the next bingo') : tr('{k} more for the next bingo', { k: need });
    var first = need === 1 ? tr('1 more for a bingo') : tr('{k} more for a bingo', { k: need });
    $('bingo-score').textContent = !n ? first : need === 0 ? tr('Full board. Every line is a bingo') : (n === 1 ? tr('1 bingo') : tr('{n} bingos', { n: n })) + ' · ' + next;
    $('bingo-score').classList.toggle('is-bingo', n > 0);
    paintLines();
  }
  function bingoText() {
    var rows = [];
    for (var r = 0; r < bingo.size; r++) {
      var row = '';
      for (var c = 0; c < bingo.size; c++) row += bingo.marks[r * bingo.size + c] ? '🟪' : '⬛';
      rows.push(row);
    }
    var n = bingoLines();
    var who = (settings.tag || '').trim();
    var head = (who ? tr('{name}\'s launch-night bingo', { name: who }) : tr('My launch-night bingo')) + ' (' + bingo.size + '×' + bingo.size + ') · ' + settings.platform + ' · ' +
      (n ? (n === 1 ? tr('1 bingo') : tr('{n} bingos', { n: n })) : tr('{k} of {m} ticked', { k: ticked(), m: cellCount() - 1 }));
    return head + '\n' + rows.join('\n') + '\n' + SITE + '#tools';
  }
  function bingoStatus(msg) { var s = $('bingo-status'); s.textContent = ''; setTimeout(function () { s.textContent = msg; }, 30); }
  function bindBingo() {
    $('bingo-copy').addEventListener('click', function () {
      shareOrCopy(bingoText(), bingoStatus, tr('Board copied. Paste it in the group chat.'));
    });
    // Size: switching keeps the ticks of each size, so going back to 3 x 3 finds your old board.
    document.querySelectorAll('input[name="bingo-size"]').forEach(function (r) {
      r.addEventListener('change', function () {
        bingo.size = Number(r.value) === 5 ? 5 : 3; save('vch.bingoSize', String(bingo.size));
        loadMarks(); buildBingo(); drawSoon(); $('bingo-status').textContent = '';
      });
    });
    $('bingo-new').addEventListener('click', function () {
      var undo = { seed: bingo.seed, marks: bingo.marks.slice(), size: bingo.size };
      bingo.seed = Math.floor(Math.random() * 1e9) + 1;
      bingo.marks = freshMarks();
      save('vch.bingoSeed', String(bingo.seed)); saveMarks();
      buildBingo(); drawSoon();
      var st = $('bingo-status');
      st.textContent = tr('New board.') + ' ';
      var u = document.createElement('button');
      u.type = 'button'; u.className = 'linklike'; u.textContent = tr('Undo');
      u.addEventListener('click', function () {
        bingo.seed = undo.seed; bingo.size = undo.size; bingo.marks = undo.marks;
        save('vch.bingoSeed', String(bingo.seed)); save('vch.bingoSize', String(bingo.size)); saveMarks();
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
  function untilMidnight() {
    var n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), mins = Math.max(1, Math.round((m - n) / 6e4));
    return Math.floor(mins / 60) ? tr('{h} h {m} min', { h: Math.floor(mins / 60), m: mins % 60 }) : tr('{m} min', { m: mins });
  }
  function renderDaily() {
    var d = dayIndex(), done = dailyDone.indexOf(d) >= 0, st = streak();
    $('daily-day').textContent = tr('Day {n}', { n: d + 1 });
    $('daily-task').textContent = tr(DAILY[d % DAILY.length]);
    $('daily-reset').textContent = done ? tr('Done. Next dare in {t}', { t: untilMidnight() }) : tr('Same dare for everyone. New one in {t}', { t: untilMidnight() });
    $('daily-streak-n').textContent = st;
    $('daily-streak').textContent = st === 1 ? tr('day streak') : tr('days streak');
    var best = Math.max(longestStreak(), st);
    $('daily-total').textContent = (dailyDone.length === 1 ? tr('1 dare done in total') : tr('{n} dares done in total', { n: dailyDone.length })) +
      ' · ' + (best === 1 ? tr('best 1 day') : tr('best {n} days', { n: best }));
    // Past dares: every day since launch, newest first, done or missed. Read only, so the streak stays honest.
    var pastList = $('daily-past'), wrap = $('daily-past-wrap');
    wrap.hidden = d === 0; pastList.textContent = '';
    for (var p = d - 1; p >= 0 && p >= d - 30; p--) {
      var li = document.createElement('li'), ok = dailyDone.indexOf(p) >= 0;
      li.className = ok ? 'is-on' : '';
      li.innerHTML = '<span class="past__day"></span><span class="past__task"></span><span class="past__mark"></span>';
      li.children[0].textContent = tr('Day {n}', { n: p + 1 });
      li.children[1].textContent = tr(DAILY[p % DAILY.length]);
      li.children[2].textContent = ok ? tr('done') : tr('missed');
      pastList.appendChild(li);
    }
    // The week row: the last 7 days, today last. Days before launch stay empty.
    var week = $('daily-week'); week.textContent = '';
    var names = [];
    try { var f = new Intl.DateTimeFormat(LANG, { weekday: 'narrow' }); for (var k = 6; k >= 0; k--) { var dt = new Date(); dt.setDate(dt.getDate() - k); names.push(f.format(dt)); } } catch (e) { names = ['', '', '', '', '', '', '']; }
    for (var i = 0; i < 7; i++) {
      var di = d - 6 + i, li = document.createElement('li'), on = di >= 0 && dailyDone.indexOf(di) >= 0;
      li.className = 'week__day' + (on ? ' is-on' : '') + (i === 6 ? ' is-today' : '') + (di < 0 ? ' is-before' : '');
      li.innerHTML = '<span class="week__dot" aria-hidden="true"></span><span class="week__name" aria-hidden="true"></span>';
      li.lastChild.textContent = names[i];
      li.setAttribute('aria-label', (i === 6 ? tr('Today') : tr('{n} days ago', { n: 6 - i })) + ': ' + (on ? tr('done') : tr('not done')));
      week.appendChild(li);
    }
    var b = $('daily-done'), s = $('daily-copy');
    b.setAttribute('aria-pressed', String(done));
    // Before: "I did it" leads. After: it goes away, sharing the streak leads, and undo is a separate, labelled link.
    b.hidden = done; $('daily-undo-line').hidden = !done;
    s.classList.toggle('btn--primary', done); s.classList.toggle('btn--quiet', !done);
    b.closest('.daily').classList.toggle('is-done', done);
  }
  function dailyText() {
    var d = dayIndex(), cells = '';
    for (var i = Math.max(0, d - 6); i <= d; i++) cells += dailyDone.indexOf(i) >= 0 ? '🟪' : '⬛';
    var st = streak();
    return tr('Leonida daily dare') + ' · ' + tr('Day {n}', { n: d + 1 }) + ' · ' + (st ? tr('{n}-day streak', { n: st }) : tr('starting my streak')) + '\n' + cells + '\n' + tr('Today\'s dare:') + ' ' + SITE + '#tools';
  }
  function bindDaily() {
    // Focus only moves for keyboard users (a keyboard "click" has detail 0), so touch never shows a stray focus ring.
    $('daily-done').addEventListener('click', function (e) {
      var d = dayIndex();
      if (dailyDone.indexOf(d) < 0) { dailyDone.push(d); buzz(); }
      save('vch.daily', dailyDone.join(','));
      renderDaily();
      if (!e.detail) $('daily-copy').focus({ preventScroll: true });
    });
    $('daily-undo').addEventListener('click', function (e) {
      var k = dailyDone.indexOf(dayIndex());
      if (k >= 0) dailyDone.splice(k, 1);
      save('vch.daily', dailyDone.join(','));
      renderDaily();
      if (!e.detail) $('daily-done').focus({ preventScroll: true });
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

  // ---- backup file: the whole run as a small JSON file; loading one goes through the same restore as a progress link ----
  function bindBackup() {
    var save_ = $('backup-save'), load_ = $('backup-load'), file = $('backup-file');
    if (!save_) return;
    save_.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ app: 'vicecityhub', v: 1, saved: new Date().toISOString(), data: progressData() }, null, 1)], { type: 'application/json' });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'vice-city-hub-backup.json'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast(tr('Backup saved. Load it on any browser to pick up where you left off.'));
    });
    load_.addEventListener('click', function () { file.value = ''; file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      if (f.size > 20000) { toast(tr('That file is not a Vice City Hub backup.')); return; }
      var r = new FileReader();
      r.onload = function () {
        try {
          var o = JSON.parse(r.result), d = o && o.app === 'vicecityhub' && o.data, clean = {};
          if (!d || typeof d !== 'object') throw new Error('not a backup');
          Object.keys(d).forEach(function (k) { if (/^vch\.[a-zA-Z]+$/.test(k) && typeof d[k] === 'string' && d[k].length < 400) clean[k] = d[k]; });
          if (!clean['vch.map']) throw new Error('no map');
          location.hash = 'p=' + encodeProgress(clean); location.reload();
        } catch (e) { toast(tr('That file is not a Vice City Hub backup.')); }
      };
      r.readAsText(f);
    });
  }

  // ---- the "saved" line: reassure, and offer a progress link that works in any browser ----
  function bindSaveLine() {
    document.querySelectorAll('[data-saveline]').forEach(function (line) {
      var note = line.querySelector('.saveline__note'), btn = line.querySelector('button');
      var iosSafari = /iPhone|iPad|iPod/.test(navigator.userAgent || '') && !inApp && !navigator.standalone;
      if (storageWorks && iosSafari) note.textContent = tr('Saved on this phone. Safari clears sites you skip for 7 days, so add the hub to your Home Screen or copy your progress link.');
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

  // ---- the cards, drawn only near the screen or when exported ----
  // One system for every card: wordmark row, who, the number, the rank on a highway sign, one line only this player
  // could have, the map with unseen regions under fog, and a dare band that says what to do next and where.
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
  // Wraps text into at most maxLines lines; the last line is shortened with an ellipsis if it still runs over.
  function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
    var words = String(text).split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] += '…'; }
    lines.forEach(function (l, k) {
      while (ctx.measureText(l).width > maxW && l.length > 2) l = l.slice(0, -2) + '…';
      ctx.fillText(l, x, y + k * lh);
    });
    return lines.length;
  }

  // Fits text into at most maxLines lines by stepping the size down, so a long line is never cut off with an ellipsis.
  function wrapFit(ctx, text, x, y, maxW, size, minSize, maxLines, weight) {
    for (var s = size; s >= minSize; s -= 2) {
      ctx.font = weight + ' ' + s + 'px "DM Sans", sans-serif';
      var words = String(text).split(' '), lines = 1, line = '';
      words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines++; line = w; } else line = t; });
      if (lines <= maxLines) return wrapText(ctx, text, x, y, maxW, Math.round(s * 1.22), maxLines);
    }
    return wrapText(ctx, text, x, y, maxW, Math.round(minSize * 1.22), maxLines);
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
    var story = settings.format === 'story';
    if (settings.kind === 'wrapped') return story ? drawWrappedStory(ctx, T, W, H) : drawWrappedSquare(ctx, T, W, H);
    if (settings.kind === 'blend' && rival) return story ? drawBlendStory(ctx, T, W, H) : drawBlendSquare(ctx, T, W, H);
    if (story) drawStory(ctx, T, W, H); else drawSquare(ctx, T, W, H);
  }

  // The % fills the width it is given: the number at full size, the % sign at half. At 100% it turns gold.
  function bigPct(ctx, T, p, x, y, maxW, maxS, color) {
    var s = maxS, num = String(p);
    var fit = function () { ctx.font = '400 ' + s + 'px Anton, sans-serif'; var a = ctx.measureText(num).width; ctx.font = '400 ' + Math.round(s / 2) + 'px Anton, sans-serif'; return a + 8 + ctx.measureText('%').width; };
    while (fit() > maxW && s > 60) s -= 6;
    ctx.save();
    ctx.fillStyle = color || (p === 100 ? '#FFC35A' : T.accent);
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

  // The hub's mark, from the same paths as the page logo (32 x 32), drawn at size s.
  var MARK = [['M7 19.6a9 9 0 0 1 18 0z', '#FF5FA2'], ['M7 13.4h18v1.3H7zM7 16.6h18v1.5H7z', '#0B6B3A'], ['M6.5 19.6h19v1.2h-19z', '#F4F1EA'],
    ['M15.2 20.8h1.6l8.4 6.6H6.8z', '#F4F1EA'], ['M15.7 21.9h.6v1.2h-.6zM15.55 24.1h.9v1.8h-.9z', '#0B6B3A']];
  function mark(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 32, s / 32);
    roundRect(ctx, 0, 0, 32, 32, 7); ctx.fillStyle = '#0B6B3A'; ctx.fill();
    roundRect(ctx, 2.3, 2.3, 27.4, 27.4, 5.2); ctx.strokeStyle = '#F4F1EA'; ctx.lineWidth = 1.5; ctx.stroke();
    MARK.forEach(function (m) { ctx.fillStyle = m[1]; ctx.fill(new Path2D(m[0])); });
    ctx.restore();
  }
  // Top row on every card: the wordmark on the left; platform, and the day if the visitor wants it, on the right.
  function topRow(ctx, T, W, y, s) {
    mark(ctx, 64, y, s);
    ctx.fillStyle = T.ink; ctx.font = '400 ' + Math.round(s * 0.84) + 'px Anton, sans-serif';
    ctx.fillText('Vice City Hub', 64 + s + 16, y + s * 0.8);
    var right = settings.platform + (settings.dayone ? '  ·  ' + (startDay() === 0 ? tr('Day one') : tr('Day {n}', { n: startDay() + 1 })) : '');
    ctx.textAlign = 'right'; ctx.fillStyle = T.ink2; ctx.font = '600 ' + Math.round(s * 0.66) + 'px "DM Sans", sans-serif';
    ctx.fillText(right, W - 64, y + s * 0.76);
    ctx.textAlign = 'left';
  }
  // A gold line for players who backed the hub, right under their name.
  function backed(ctx, T, x, y, size) {
    if (!tipped) return;
    ctx.fillStyle = T.done; ctx.font = '600 ' + size + 'px "DM Sans", sans-serif';
    ctx.fillText(tr('Backed the hub'), x, y);
  }
  // Every card ends on an exit sign, like the ones on Leonida's highways: what to do (large), then where. It sits
  // inside the card's margins with the same white inset border as the rank sign, so it reads as part of the world,
  // not as a banner pasted on. h is the space it takes from the bottom of the card.
  function dare(ctx, T, W, H, h, big) {
    var m = 40, x = m, y = H - h, w = W - m * 2, sh = h - m, r = 16;
    var green = T.signBg || '#0B6B3A';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    roundRect(ctx, x, y, w, sh, r); ctx.fillStyle = green; ctx.fill();
    ctx.restore();
    roundRect(ctx, x + 7, y + 7, w - 14, sh - 14, r - 6); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.stroke();
    // The exit arrow, top right, pointing up and to the right.
    var a = sh * 0.36, ax = x + w - 36 - a, ay = y + (sh - a) / 2;
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(6, sh * 0.075); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay + a); ctx.lineTo(ax + a, ay); ctx.moveTo(ax + a * 0.35, ay); ctx.lineTo(ax + a, ay); ctx.lineTo(ax + a, ay + a * 0.65); ctx.stroke();
    ctx.lineCap = 'butt';
    var tx = x + 36, tw = w - 36 - (a + 72);
    ctx.fillStyle = '#FFFFFF';
    fitText(ctx, big, tw, Math.round(sh * 0.4), '400 {s}px Anton, sans-serif');
    ctx.fillText(big, tx, y + sh * 0.52);
    ctx.fillStyle = '#E3F2E8';
    fitText(ctx, 'vicecityhub.okenshop.com', tw, Math.round(sh * 0.22), '600 {s}px "DM Sans", sans-serif');
    ctx.fillText('vicecityhub.okenshop.com', tx, y + sh * 0.8);
  }
  function mapDare(p) {
    return p === 0 ? tr('How much have you seen?') : p === 100 ? tr('100%. Can you match it?') : tr('Can you beat {n}%?', { n: p });
  }

  // One line only this player could have: what they have not seen yet, or how far they took it.
  function verdict(lv) {
    lv = lv || levels;
    var n = 0, done = 0, unseen = [];
    lv.forEach(function (l, i) { n += l; if (l === 3) done++; if (!l) unseen.push(tr(REGIONS[i].full)); });
    if (!n) return tr('Has not left the menu yet');
    if (n === 18) return tr('Finished every region of Leonida');
    if (unseen.length === 1) return tr('Has never set foot in {a}', { a: unseen[0] });
    if (unseen.length === 2) return tr('Has never been to {a} or {b}', { a: unseen[0], b: unseen[1] });
    if (unseen.length) return tr('{k} of 6 regions still under the fog', { k: unseen.length });
    return done ? tr('Been everywhere. Finished {k} of 6', { k: done }) : tr('Been everywhere. Finished none yet');
  }

  // Text on a region colour: dark on the bright colours, white on deep green.
  function inkOn(r) { return r.id === 'kalaga' ? '#FFFFFF' : '#0E1311'; }
  // The finished tick sits on a gold region, so it is drawn dark with a gold check.
  function tick(ctx, cx, cy, rad, T) {
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fillStyle = T.onFull; ctx.fill();
    ctx.strokeStyle = T.done; ctx.lineWidth = rad * 0.24; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx - rad * 0.45, cy + rad * 0.02); ctx.lineTo(cx - rad * 0.12, cy + rad * 0.36); ctx.lineTo(cx + rad * 0.48, cy - rad * 0.34); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // Diagonal stripes on a base colour: the fog over unseen regions, and in a Blend, regions both players explored.
  function stripes(ctx, base, line, gap) {
    var c = document.createElement('canvas'); c.width = c.height = gap;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, gap, gap);
    g.strokeStyle = line; g.lineWidth = gap * 0.28; g.beginPath();
    [-gap, 0, gap].forEach(function (o) { g.moveTo(o, gap); g.lineTo(o + gap, 0); });
    g.stroke();
    return ctx.createPattern(c, 'repeat');
  }

  // Minimal cards: who, one huge sharp number, the rank, one true line, the map. Nothing else competes.
  function drawSquare(ctx, T, W, H) {
    var n = steps(), p = pctOf(n);
    topRow(ctx, T, W, 56, 48);
    ctx.fillStyle = T.ink; var nm = cardName();
    fitText(ctx, nm, 470, 92, '400 {s}px Anton, sans-serif'); ctx.fillText(nm, 62, 236);
    backed(ctx, T, 64, 286, 34);
    bigPct(ctx, T, p, 50, 586, 480, 340);
    ctx.fillStyle = T.ink2; ctx.font = '600 40px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida seen'), 64, 642);
    rankSign(ctx, T, rank(n), 64, 676, 48);
    ctx.fillStyle = T.ink;
    wrapFit(ctx, verdict(), 64, 808, 460, 36, 28, 2, '600');
    drawMap(ctx, T, 548, 172, 0.82, null, { labels: true });
    dare(ctx, T, W, H, 172, mapDare(p));
  }
  function drawStory(ctx, T, W, H) {
    var n = steps(), p = pctOf(n);
    topRow(ctx, T, W, 96, 56);
    ctx.fillStyle = T.ink; var nm = cardName();
    fitText(ctx, nm, W - 128, 120, '400 {s}px Anton, sans-serif'); ctx.fillText(nm, 60, 320);
    backed(ctx, T, 64, 380, 40);
    bigPct(ctx, T, p, 46, 760, 952, 440);
    ctx.fillStyle = T.ink2; ctx.font = '600 52px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida seen'), 64, 834);
    rankSign(ctx, T, rank(n), 64, 876, 58);
    ctx.fillStyle = T.ink;
    wrapFit(ctx, verdict(), 64, 1036, 952, 44, 34, 2, '600');
    var sc = 0.82; drawMap(ctx, T, (W - 600 * sc) / 2, 1080, sc, null, { labels: true });
    dare(ctx, T, W, H, 210, mapDare(p));
  }

  // The map as drawn on the cards, at (x, y) and scale sc of its 600 x 740 layout. No frame: the state itself is the picture.
  // Unseen regions sit under fog. blend: { mine: [...], theirs: [...] } paints who explored each region instead.
  function drawMap(ctx, T, x, y, sc, blend, opts) {
    var labels = !!(opts && opts.labels);
    // Card label spots: Port Gellhorn and Ambrosia move apart so the bigger names never touch.
    var SPOT = { gellhorn: [188, 240], ambrosia: [388, 212], vice: [505, 318], grass: [384, 506] };
    var LV = blend ? blend.mine.map(function (m, i) { return Math.max(m, blend.theirs[i]); }) : levels;
    var fog = stripes(ctx, T.fill[0], T.fog, 22);
    var both = blend ? stripes(ctx, T.accent, T.done, 26) : null;
    var paint = function (r, i) {
      if (blend) {
        var me = blend.mine[i] > 0, them = blend.theirs[i] > 0;
        return me && them ? both : me ? T.accent : them ? T.done : fog;
      }
      return LV[i] ? levelFill(T, LV[i]) : fog;
    };
    ctx.save();
    ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.lineJoin = 'round';
    // one soft shadow under the whole state
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16; ctx.fillStyle = T.fill[0];
    REGIONS.forEach(function (r) { ctx.fill(new Path2D(r.d)); }); ctx.restore();
    REGIONS.forEach(function (r, i) {
      var path = new Path2D(r.d), seen = LV[i] > 0;
      ctx.fillStyle = paint(r, i); ctx.fill(path);
      // The Keys are thin islands: a fat stroke in their own fill keeps them visible at thumbnail size.
      if (r.id === 'keys') { ctx.strokeStyle = seen ? paint(r, i) : T.fill[0]; ctx.lineWidth = 10; ctx.stroke(path); }
    });
    REGIONS.forEach(function (r, i) {
      var path = new Path2D(r.d);
      ctx.strokeStyle = LV[i] ? T.edge : T.line; ctx.lineWidth = LV[i] ? 5 : 2.5; ctx.stroke(path);
    });
    ctx.fillStyle = T.lake; ctx.fill(new Path2D(LAKE));
    ctx.textAlign = 'center';
    REGIONS.forEach(function (r, i) {
      var lp = SPOT[r.id] || r.label;
      var lines = r.two ? [r.name.split(' ')[0], r.name.split(' ').slice(1).join(' ')] : [r.name];
      if (r.id === 'kalaga') lines = ['Mount Kalaga'];
      var fs = 46, lh = 44;
      if (labels) {
        ctx.font = '400 ' + fs + 'px Anton, sans-serif';
        lines.forEach(function (txt, k) {
          var ly = lp[1] + (r.two ? (k ? lh / 2 + 4 : -lh / 2 + 4) : 10);
          ctx.strokeStyle = 'rgba(14,19,17,.85)'; ctx.lineWidth = 10; ctx.strokeText(txt, lp[0], ly);
          ctx.fillStyle = LV[i] ? '#FFFFFF' : T.ink2; ctx.fillText(txt, lp[0], ly);
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
  function wrappedStats() {
    var best = longestStreak(), done100 = levels.filter(function (l) { return l === 3; }).length;
    return [
      [String(best), best === 1 ? tr('day best streak') : tr('days best streak')],
      [String(dailyDone.length), tr('dares done')],
      [done100 + '/6', tr('regions finished'), done100 ? 'done' : ''],
      [String(bingoLines()), bingoLines() === 1 ? tr('bingo line') : tr('bingo lines')]
    ];
  }
  function statCell(ctx, T, st, x, y, w, vs, ls) {
    ctx.fillStyle = st[2] === 'done' ? T.done : T.ink;
    fitText(ctx, st[0], w - 16, vs, '400 {s}px Anton, sans-serif'); ctx.fillText(st[0], x, y);
    ctx.fillStyle = T.ink2; fitText(ctx, st[1], w - 16, ls, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(st[1], x + 2, y + ls * 1.25);
  }
  function wrappedHead(ctx, T, x, y, size) {
    size = fitText(ctx, tr('Leonida') + ' ' + tr('Wrapped'), 1080 - 128, size, '400 {s}px Anton, sans-serif');
    ctx.fillStyle = T.ink; ctx.font = '400 ' + size + 'px Anton, sans-serif';
    var a = tr('Leonida'); ctx.fillText(a, x, y);
    var aw = ctx.measureText(a + ' ').width;
    ctx.fillStyle = T.accent; ctx.fillText(tr('Wrapped'), x + aw, y);
  }
  function wrappedSub() { return cardName() + '  ·  ' + tr('19 Nov – 10 Dec 2026'); }
  function drawWrappedSquare(ctx, T, W, H) {
    var n = steps(), p = pctOf(n);
    topRow(ctx, T, W, 56, 48);
    wrappedHead(ctx, T, 60, 236, 118);
    ctx.fillStyle = T.ink2; fitText(ctx, wrappedSub(), W - 128, 36, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(wrappedSub(), 64, 292);
    bigPct(ctx, T, p, 52, 560, 470, 260);
    ctx.fillStyle = T.ink2; ctx.font = '600 38px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida seen'), 64, 614);
    rankSign(ctx, T, rank(n), 64, 646, 46);
    drawMap(ctx, T, 596, 316, 0.62);
    ctx.fillStyle = T.line; ctx.fillRect(64, 746, W - 128, 2);
    wrappedStats().forEach(function (st, k) { statCell(ctx, T, st, 64 + k * 238, 830, 238, 72, 30); });
    dare(ctx, T, W, H, 156, tr('Get your Leonida Wrapped'));
  }
  function drawWrappedStory(ctx, T, W, H) {
    var n = steps(), p = pctOf(n);
    topRow(ctx, T, W, 96, 56);
    wrappedHead(ctx, T, 58, 320, 150);
    ctx.fillStyle = T.ink2; fitText(ctx, wrappedSub(), W - 128, 44, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(wrappedSub(), 64, 392);
    bigPct(ctx, T, p, 50, 760, 520, 360);
    ctx.fillStyle = T.ink2; ctx.font = '600 46px "DM Sans", sans-serif';
    ctx.fillText(tr('of Leonida seen'), 64, 826);
    rankSign(ctx, T, rank(n), 64, 864, 54);
    drawMap(ctx, T, 600, 470, 0.72);
    ctx.fillStyle = T.line; ctx.fillRect(64, 1060, W - 128, 2);
    wrappedStats().forEach(function (st, k) { statCell(ctx, T, st, 64 + (k % 2) * 476, 1230 + Math.floor(k / 2) * 250, 476, 140, 42); });
    dare(ctx, T, W, H, 210, tr('Get your Leonida Wrapped'));
  }

  // Leonida Blend: your map and a friend's (from their challenge link) on one card. Pink is you, gold is them,
  // stripes of both are the regions you share.
  function blendStats() {
    var cover = 0, diff = 0;
    levels.forEach(function (m, i) { cover += Math.max(m, rival.levels[i]); diff += Math.abs(m - rival.levels[i]); });
    var mine = steps(), theirs = rival.levels.reduce(function (a, b) { return a + b; }, 0);
    return { cover: pctOf(cover), match: Math.round(100 - diff / 18 * 100), carry: mine === theirs ? 0 : mine > theirs ? 1 : -1 };
  }
  function blendMe() { return (settings.tag || '').trim() || tr('You'); }
  function blendCarry(st) { return st.carry === 0 ? tr('Dead even') : tr('{name} carried', { name: st.carry > 0 ? blendMe() : rival.name }); }
  function blendKey(ctx, T, x, y, gap, size, row) {
    var keyFill = [[T.accent, blendMe()], [T.done, rival.name], [stripes(ctx, T.accent, T.done, 14), tr('Both of you')]];
    var cx = x;
    keyFill.forEach(function (l, k) {
      var kx = row ? cx : x, ky = row ? y : y + k * gap;
      roundRect(ctx, kx, ky - size * 0.8, size, size, 6); ctx.fillStyle = l[0]; ctx.fill();
      ctx.fillStyle = T.ink2; ctx.font = '600 ' + size + 'px "DM Sans", sans-serif';
      var label = l[1]; if (ctx.measureText(label).width > 300) label = label.slice(0, 14) + '…';
      ctx.fillText(label, kx + size + 14, ky);
      cx += size + 14 + ctx.measureText(label).width + 40;
    });
  }
  function blendHead(ctx, T, W, y, size, pairSize) {
    size = fitText(ctx, tr('Leonida') + ' ' + tr('Blend'), W - 128, size, '400 {s}px Anton, sans-serif');
    ctx.fillStyle = T.ink; ctx.font = '400 ' + size + 'px Anton, sans-serif';
    var a = tr('Leonida'); ctx.fillText(a, 60, y);
    ctx.fillStyle = T.accent; ctx.fillText(tr('Blend'), 60 + ctx.measureText(a + ' ').width, y);
    var pair = blendMe() + '  ×  ' + rival.name;
    ctx.fillStyle = T.ink; fitText(ctx, pair, W - 128, pairSize, '400 {s}px Anton, sans-serif'); ctx.fillText(pair, 62, y + pairSize * 1.1);
  }
  function drawBlendSquare(ctx, T, W, H) {
    var st = blendStats(), x = 600;
    topRow(ctx, T, W, 56, 48);
    blendHead(ctx, T, W, 222, 104, 60);
    drawMap(ctx, T, 56, 326, 0.78, { mine: levels, theirs: rival.levels }, { labels: true });
    bigPct(ctx, T, st.cover, x - 4, 520, 420, 200, T.ink);
    ctx.fillStyle = T.ink2; fitText(ctx, tr('of Leonida covered together'), 420, 34, '600 {s}px "DM Sans", sans-serif');
    ctx.fillText(tr('of Leonida covered together'), x, 566);
    ctx.fillStyle = T.ink; ctx.font = '400 72px Anton, sans-serif'; ctx.fillText(st.match + '%', x - 2, 664);
    ctx.fillStyle = T.ink2; ctx.font = '600 34px "DM Sans", sans-serif'; ctx.fillText(tr('map match'), x, 706);
    ctx.fillStyle = T.accent; fitText(ctx, blendCarry(st), 420, 56, '400 {s}px Anton, sans-serif'); ctx.fillText(blendCarry(st), x, 786);
    blendKey(ctx, T, x, 830, 40, 30, false);
    dare(ctx, T, W, H, 156, tr('Blend with me'));
  }
  function drawBlendStory(ctx, T, W, H) {
    var st = blendStats();
    topRow(ctx, T, W, 96, 56);
    blendHead(ctx, T, W, 320, 140, 76);
    var sc = 0.92; drawMap(ctx, T, (W - 600 * sc) / 2, 470, sc, { mine: levels, theirs: rival.levels }, { labels: true });
    blendKey(ctx, T, 64, 1210, 0, 34, true);
    ctx.fillStyle = T.line; ctx.fillRect(64, 1262, W - 128, 2);
    statCell(ctx, T, [st.cover + '%', tr('covered together')], 64, 1410, 476, 140, 42);
    statCell(ctx, T, [st.match + '%', tr('map match')], 540, 1410, 476, 140, 42);
    ctx.fillStyle = T.accent; fitText(ctx, blendCarry(st), W - 128, 96, '400 {s}px Anton, sans-serif'); ctx.fillText(blendCarry(st), 62, 1620);
    dare(ctx, T, W, H, 210, tr('Blend with me'));
  }

  // The day count since launch (19 Nov 2026 = Day one), on the visitor's own clock.
  function startDay() { return dayIndex(); }

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
    if (settings.kind === 'wrapped') return tr('My Leonida Wrapped: {n}% seen, {rank}. Get yours:', { n: score(), rank: rank() });
    return tr('{n}% of Leonida seen. Rank: {rank}. Can you beat me?', { n: score(), rank: rank() });
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
    var canCopyImage = false;
    try { canCopyImage = !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem && window.isSecureContext) && !matchMedia('(pointer: coarse)').matches; } catch (e) { /* old browser */ }
    $('copy-img').hidden = !canCopyImage;
    $('copy-img').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      navigator.clipboard.write([new ClipboardItem({ 'image/png': cardBlob() })])
        .then(function () { status(tr('Image copied. Paste it into Discord or any chat.')); showThanks(); },
          function () { status(tr('This browser would not copy the image, so use Download PNG.')); })
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
      if (!steps()) { toast(tr('Your map is already empty.')); return; }
      remember(); levels = [0, 0, 0, 0, 0, 0]; save('vch.map', code()); render();
      toast(tr('Map cleared.'), tr('Undo'), undoMap);
    });
  }

  // ---- start ----
  function start() {
    translatePage(); bindLang(); bindSaveLine();
    if (!$('map')) { bindCheats(); return; } // the cheat code page has only the cheat list
    buildMap(); bindList(); bindPick(); bindBackup(); bindSettings(); bindAlias(); bindBingo(); bindDaily(); bindTipped(); bindCheats(); bindActions(); readChallenge();
    if (steps() > 0) touched = true;
    buildBingo(); renderDaily(); renderTipped(); renderAlias(); render();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderDaily(); });
    setInterval(function () { if (!document.hidden) renderDaily(); }, 60000);
    var cv = $('card-canvas');
    if ('IntersectionObserver' in window) {
      // Away while you are still using the map, so the bar never covers a region you want to tap.
      new IntersectionObserver(function (es) { mapOnScreen = es[0].isIntersecting; updateNextbar(); }, { threshold: 0 }).observe($('map-wrap'));
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
