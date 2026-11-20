/* Vice City Hub: the Leonida map tracker, the shareable card, the street-name and bingo tools.
   Everything runs on the visitor's device. No requests to other sites; progress is kept in localStorage. */
(function () {
  'use strict';

  var SITE = 'https://vicecityhub0.vercel.app/';
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
  // Lake Leonida sits between Ambrosia and Mount Kalaga, on the border between them, as on Rockstar's map.
  var LAKE_X = 305, LAKE_Y = 172, LAKE = ellipse(LAKE_X, LAKE_Y, 40, 19);

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
              onFull: '#0E1311', edge: '#0E1311', lake: '#2C6E86', sea: '#0F1F25', sky: ['#0B0714', '#2A0E36', '#7A1E5A'], sun: ['#FFD27A', '#FF5FA2'], water: ['#1A0C26', '#07060B'], line: 'rgba(244,241,234,.14)', fog: 'rgba(244,241,234,.09)', fill: ['#1A2420'] },
    sunset: { name: 'Golden hour', bg: '#2A0F22', bg2: '#4A1A2A', ink: '#FFF3E4', ink2: '#F2C9B0', accent: '#FF6B5B', passed: '#742F36', done: '#FFC35A',
              onFull: '#2A0F22', edge: '#2A0F22', lake: '#3B6C8C', sea: '#341429', sky: ['#1A0714', '#4A1430', '#C2413F'], sun: ['#FFE6A0', '#FF6B5B'], water: ['#2A0D1E', '#0E050C'], line: 'rgba(255,243,228,.16)', fog: 'rgba(255,214,170,.10)', fill: ['#3A1A30'] },
    ocean:  { name: 'Ocean drive', bg: '#08151F', bg2: '#0B2233', ink: '#EEF7FA', ink2: '#A9C3CC', accent: '#3FD6E8', passed: '#1B5965', done: '#FFC35A',
              onFull: '#08151F', edge: '#08151F', lake: '#2A6F93', sea: '#0A1C29', sky: ['#030B12', '#0A2A40', '#1F7A8C'], sun: ['#FFE7A0', '#FF8A5B'], water: ['#062030', '#02080D'], line: 'rgba(238,247,250,.14)', fog: 'rgba(238,247,250,.09)', fill: ['#14232E'] }
  };
  function levelFill(T, l) { return [null, T.passed, T.accent, T.done][l]; }
  // Short level words on the map, so a label never runs past its region.
  var SHORT = ['', 'Passed', 'Explored', 'Finished'];

  // Ranks by steps (6 regions x 3 levels = 18). Small, frequent steps early, so the next rank is always close;
  // the last one is only for a fully finished map.
  var RANKS = [[0, 'Still in the menu'], [1, 'Fresh off the bus'], [3, 'Tourist'], [5, 'Weekend driver'], [7, 'Local'],
    [10, 'Street regular'], [13, 'Kingpin'], [16, 'Leonida legend'], [18, 'Owns the map']];

  // ---- storage (may be blocked: private mode, embedded previews) ----
  // Every real change to progress stamps vch.updated, so a progress link or a backup can tell whether it is older than
  // what this browser already has. Keys that are not progress (language, the one-time move flag) leave the stamp alone,
  // and saving a value that did not change is skipped, so opening a page never makes old progress look new.
  var META = { 'vch.updated': 1, 'vch.moved': 1, 'vch.lang': 1 };
  function load(key, fallback) { try { var v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function rawSave(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* nothing to do */ } }
  function stamp() { rawSave('vch.updated', String(Date.now())); }
  function save(key, value) {
    try {
      if (localStorage.getItem(key) === value) return;
      localStorage.setItem(key, value);
      if (!META[key]) stamp();
    } catch (e) { /* nothing to do */ }
  }
  function drop(key) {
    try { if (localStorage.getItem(key) === null) return; localStorage.removeItem(key); if (!META[key]) stamp(); } catch (e) { /* blocked */ }
  }

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
  function progressCode() { return encodeProgress(progressData()); }
  function progressLink() { return location.origin + location.pathname + '#p=' + progressCode(); }
  function validKey(k, v) { return /^vch\.[a-zA-Z]+$/.test(k) && typeof v === 'string' && v.length < 400; }
  function hasProgress() { return Object.keys(progressData()).some(function (k) { return !META[k]; }); }

  // ---- moving from the old address: each browser keeps progress per address, so the old one carries it over once ----
  var OLD_HOSTS = { 'vicecityhub.okenshop.com': 1, 'www.vicecityhub.okenshop.com': 1 };
  if (OLD_HOSTS[location.hostname]) {
    var dest = SITE.replace(/\/$/, '') + location.pathname + location.search;
    var frag = location.hash || '';
    var data = progressData(); delete data['vch.moved'];
    // A progress link (#p=) travels as it is. Otherwise local progress moves once, as #m=, keeping any section anchor.
    if (!/^#[pb]=/.test(frag) && load('vch.moved', '') !== '1' && Object.keys(data).length) {
      var anchor = /^#[A-Za-z][\w-]*$/.test(frag) ? '.' + frag.slice(1) : '';
      frag = '#m=' + encodeProgress(data) + anchor;
    }
    save('vch.moved', '1');
    location.replace(dest + frag);
    return;
  }

  // Opening a progress link (#p=...) copies that progress into this browser, then tidies the address. It never quietly
  // replaces newer progress: a link older than this browser's progress changes nothing until the visitor says so, and a
  // link that does replace progress offers Undo. A backup file sets a one-time flag, because loading one is on purpose.
  // A move from the old address (#m=...) only fills what this browser doesn't have yet, so it never undoes newer progress.
  var beforeRestore = null, olderLink = null;
  function applyProgress(o) {
    beforeRestore = progressData();
    Object.keys(o).forEach(function (k) { if (k !== 'vch.updated' && validKey(k, o[k])) rawSave(k, o[k]); });
    stamp(); // what this browser now holds is its newest progress
  }
  // Undo: exactly the progress from before, nothing from the link left behind.
  function replaceProgress(o) {
    try { Object.keys(progressData()).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* blocked */ }
    Object.keys(o).forEach(function (k) { rawSave(k, o[k]); });
  }
  function takeForce() {
    try { var f = sessionStorage.getItem('vch-force') === '1'; sessionStorage.removeItem('vch-force'); return f; } catch (e) { return false; }
  }
  function openWithProgress(o, force) {
    if (force) { try { sessionStorage.setItem('vch-force', '1'); } catch (e) { /* blocked */ } }
    location.hash = 'p=' + encodeProgress(o); location.reload();
  }
  var restored = (function () {
    var m = /^#([pm])=([A-Za-z0-9_-]+)(?:\.([A-Za-z][\w-]*))?$/.exec(location.hash || '');
    if (!m) return false;
    var force = takeForce();
    try {
      var o = JSON.parse(decodeURIComponent(escape(atob(m[2].replace(/-/g, '+').replace(/_/g, '/')))));
      if (!o || typeof o !== 'object') return false;
      history.replaceState(null, '', location.pathname + location.search + (m[3] ? '#' + m[3] : ''));
      if (m[3]) document.addEventListener('DOMContentLoaded', function () { var el = document.getElementById(m[3]); if (el) el.scrollIntoView(); });
      if (m[1] === 'm') {
        var n = 0;
        Object.keys(o).forEach(function (k) { if (!validKey(k, o[k]) || load(k, null) !== null) return; rawSave(k, o[k]); n++; });
        if (n && load('vch.updated', null) === null) stamp();
        return n ? 'moved' : false;
      }
      var linkTime = Number(o['vch.updated']) || 0, localTime = Number(load('vch.updated', '')) || 0, had = hasProgress();
      if (!force && had && localTime > linkTime) { olderLink = o; return 'older'; }
      applyProgress(o);
      return had ? 'replaced' : 'restored';
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
  var groups = [], labels = [], lakeEl = null, pctEl = null;

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
    el('text', { class: 'lake-name', x: LAKE_X, y: LAKE_Y + 4, 'text-anchor': 'middle', 'pointer-events': 'none' }, svg).textContent = tr('Lake');
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
    if (!before && after) { toast(tr('Your card is ready.'), tr('See it'), function () { var c = $('card'); if (c) c.scrollIntoView({ behavior: 'smooth' }); }); return; }
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
    $('rank').textContent = tr(RANKS[ri][1]);
    $('meter-sub').textContent = tr('{n} of 18 steps', { n: n });
    var next = RANKS[ri + 1];
    var from = RANKS[ri][0];
    $('xp').style.transform = 'scaleX(' + (next ? (n - from) / (next[0] - from) : 1) + ')';
    var st = $('start');
    if (st) { st.textContent = n ? tr('Make my card') : tr('Mark where you\'ve been'); st.setAttribute('href', n ? '#card' : '#map-wrap'); }
    $('next-rank').textContent = next ? tr(next[0] - n === 1 ? '1 step to {rank}' : '{n} steps to {rank}', { n: next[0] - n, rank: tr(next[1]) }) : tr('Top rank reached.');
    updateChallenge();
    renderBoard();
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
  // ---- friends board: scores travel inside challenge links and merge on each device ----
  // Up to 8 friends, self-reported, kept as "name~code|name~code" (codes are the 6-digit map). One entry per name
  // (case-insensitive); when the same name arrives twice, the higher score stays, so passing old links around never
  // lowers anyone. You are never stored in your own board: your row is drawn live from your map.
  var BOARD_MAX = 8;
  function cleanName(s) { return String(s || '').replace(/[\u0000-\u001f\u007f|~]/g, '').trim().slice(0, 24); }
  function stepsOf(c) { var t = 0; c.split('').forEach(function (d) { t += Number(d); }); return t; }
  function parseBoard(s) {
    var out = [];
    String(s || '').split('|').forEach(function (p) {
      // A link cut short by a chat app can carry broken %-escapes: skip that entry instead of failing the page.
      var kv = p.split('~'), raw = kv[0] || '', n, c = kv[1] || '';
      try { n = cleanName(decodeURIComponent(raw)); } catch (e) { n = cleanName(raw.replace(/%/g, '')); }
      if (n && /^[0-3]{6}$/.test(c)) out.push({ n: n, c: c });
    });
    return out;
  }
  function boardString(list) {
    var s = list.map(function (e) { return encodeURIComponent(e.n) + '~' + e.c; }).join('|');
    while (s.length > 380 && list.length) { list = list.slice(0, -1); s = boardString(list); }
    return s;
  }
  var board = [];
  try { board = parseBoard(load('vch.board', '')); } catch (e) { board = []; }
  function myName() { return cleanName(settings.tag); }
  function mergeBoard(entries) {
    var me = myName().toLowerCase();
    entries.forEach(function (e) {
      if (me && e.n.toLowerCase() === me) return;
      var hit = board.filter(function (x) { return x.n.toLowerCase() === e.n.toLowerCase(); })[0];
      if (hit) { if (stepsOf(e.c) > stepsOf(hit.c)) hit.c = e.c; } else board.push({ n: e.n, c: e.c });
    });
    board.sort(function (a, b) { return stepsOf(b.c) - stepsOf(a.c); });
    board = board.slice(0, BOARD_MAX);
    save('vch.board', boardString(board));
  }
  // The board as shown and as sent: your friends (never you, even if your name came back in a link) plus your live row.
  // Ties go to the friend, so you always see a step you can still take. One function, so the text you send always
  // says the same position as the board on your screen.
  function boardRows() {
    var me = myName().toLowerCase();
    var rows = board.filter(function (e) { return !me || e.n.toLowerCase() !== me; })
      .map(function (e) { return { n: e.n, s: stepsOf(e.c), me: false }; });
    if (!rows.length) return rows;
    rows.push({ n: myName() || tr('You'), s: steps(), me: true });
    rows.sort(function (a, b) { return b.s - a.s || (a.me ? 1 : 0) - (b.me ? 1 : 0); });
    return rows;
  }
  function renderBoard() {
    var box = $('board'); if (!box) return;
    var rows = boardRows(), mine = steps();
    box.hidden = !rows.length;
    if (!rows.length) return;
    var list = $('board-list'); list.textContent = '';
    var myPos = 0;
    rows.forEach(function (r, i) {
      if (r.me) myPos = i;
      var li = document.createElement('li');
      li.className = 'board__row' + (r.me ? ' is-me' : '');
      li.innerHTML = '<span class="board__pos"></span><span class="board__who"></span><span class="board__bar" aria-hidden="true"><i></i></span><b class="board__pct"></b>';
      li.children[0].textContent = i + 1;
      li.children[1].textContent = r.me ? (myName() ? tr('{name} (you)', { name: r.n }) : tr('You')) : r.n;
      li.querySelector('i').style.transform = 'scaleX(' + pctOf(r.s) / 100 + ')';
      li.children[3].textContent = pctOf(r.s) + '%';
      list.appendChild(li);
    });
    // One concrete next step, never a loss screen.
    var gap;
    if (myPos === 0) {
      var second = rows[1], lead = mine - second.s;
      gap = lead === 0 ? tr('Level with {name}. One more step takes the lead.', { name: second.n })
        : lead === 1 ? tr('You lead {name} by 1 step. Send the board and make them chase.', { name: second.n })
        : tr('You lead {name} by {k} steps. Send the board and make them chase.', { name: second.n, k: lead });
    } else {
      var ahead = rows[myPos - 1], k = ahead.s - mine + 1;
      gap = k === 1 ? tr('1 step to pass {name}.', { name: ahead.n }) : tr('{k} steps to pass {name}.', { k: k, name: ahead.n });
      if (myPos === rows.length - 1 && mine === 0) gap = tr('Everyone starts somewhere. Tap one region to get on the board.');
    }
    $('board-gap').textContent = gap;
    $('board-name').hidden = !!myName();
  }
  function bindBoard() {
    if (!$('board')) return;
    $('board-tag').addEventListener('input', function () {
      settings.tag = $('board-tag').value.slice(0, 24); save('vch.tag', settings.tag);
      if ($('tag')) $('tag').value = settings.tag;
      if ($('alias-input')) $('alias-input').value = settings.tag;
      renderBoard(); drawSoon();
    });
    $('board-send').addEventListener('click', function () {
      if (!myName()) { $('board-name').hidden = false; $('board-tag').focus(); toast(tr('Add your name first, so friends see who you are.')); return; }
      var rows = boardRows(), pos = 1;
      rows.forEach(function (r, i) { if (r.me) pos = i + 1; });
      var text = tr('Our Leonida board: I am #{p} of {n} with {pct}%. Your move:', { p: pos, n: Math.max(1, rows.length), pct: score() }) + ' ' + challengeUrl();
      shareOrCopy(text, function (m) { toast(m); }, tr('Board link copied. Paste it in the group chat.'));
    });
    $('board-clear').addEventListener('click', function () {
      var undo = board.slice();
      board = []; save('vch.board', ''); renderBoard();
      toast(tr('Board cleared.'), tr('Undo'), function () { board = undo; save('vch.board', boardString(board)); renderBoard(); });
    });
  }

  function readChallenge() {
    var q = new URLSearchParams(location.search);
    var c = q.get('c');
    if (!c || !/^[0-3]{6}$/.test(c)) return;
    var t = 0; c.split('').forEach(function (d) { t += Number(d); });
    var given = cleanName(q.get('n')), n = given || tr('Your friend');
    rival = { name: n, pct: pctOf(t), levels: c.split('').map(Number) };
    // Only a named sender joins the board: unnamed links would all land on one "Your friend" row and overwrite each other.
    mergeBoard((given ? [{ n: given, c: c }] : []).concat(parseBoard(q.get('b'))));
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
  // Rematch: send your updated score back, so the challenge keeps going.
  function bindRematch() {
    var b = $('rematch'); if (!b) return;
    b.addEventListener('click', function () {
      var text = tr('Your move, {name}. I am on {n}% now.', { name: rival.name, n: score() }) + ' ' + challengeUrl();
      shareOrCopy(text, function (m) { toast(m); }, tr('Link copied. Send it back to {name}.', { name: rival.name }));
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
    $('rematch').hidden = mine === 0;
  }

  // ---- card settings ----
  var settings = {
    tag: load('vch.tag', ''),
    platform: load('vch.platform', 'PS5'),
    theme: load('vch.theme', 'night'),
    useAlias: load('vch.useAlias', '0') === '1',
    aliasRoll: Number(load('vch.aliasRoll', '0')) || 0,
    format: load('vch.format', 'square') === 'story' ? 'story' : 'square',
    // From 7 December the card opens on Wrapped, unless the visitor picked a card themselves.
    kind: load('vch.kind', Date.now() >= new Date(2026, 11, 7).getTime() ? 'wrapped' : 'map')
  };
  if (settings.kind !== 'wrapped') settings.kind = 'map'; // Blend is chosen per visit, from a friend's link
  if (settings.theme === 'highway') settings.theme = 'ocean'; // the old Highway look became Ocean drive
  if (!THEMES[settings.theme]) settings.theme = 'night';
  // GTA 6 is on PS5 and Xbox Series X|S. Older saves said 'Xbox Series'.
  if (settings.platform === 'Xbox Series') { settings.platform = 'Xbox Series X|S'; save('vch.platform', settings.platform); }
  if (settings.platform !== 'PS5' && settings.platform !== 'Xbox Series X|S') settings.platform = 'PS5';

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

  // ---- Leonida Bingo: one 5 x 5 card a month, the same card for everyone, so friends can read each other's grid ----
  // Each square belongs to one of four themes; which themes you tick (not how many) gives your label.
  var BTHEME = {
    chaos:  { name: 'Chaos', label: 'Florida Man', color: '#FF5A5F', emoji: '🟥' },
    cruise: { name: 'Cruising', label: 'Keys Drifter', color: '#3FA9F5', emoji: '🟦' },
    local:  { name: 'Local life', label: 'Bodega Regular', color: '#FFC35A', emoji: '🟨' },
    myth:   { name: 'Secrets', label: 'Swamp Myth-Hunter', color: '#4CC38A', emoji: '🟩' }
  };
  var BORDER = ['chaos', 'cruise', 'local', 'myth'];
  // [full text, short text for phones under 360px, theme]. 16 staples on every card, 8 that change each month.
  // No story beats, and secrets are named without saying where they are.
  var STAPLES = [
    ['Survived a 6-star chase', '6 stars', 'chaos'], ['Lost the cops on foot', 'Foot chase', 'chaos'],
    ['Tried to steal a jet', 'Jet theft', 'chaos'], ['Followed the GPS into water', 'GPS swim', 'chaos'],
    ['Watched a sunset on purpose', 'Sunset', 'cruise'], ['Drove to the Keys at night', 'Keys night', 'cruise'],
    ['Crossed Leonida without a crash', 'Clean drive', 'cruise'], ['Took a boat instead of a car', 'Boat ride', 'cruise'],
    ['Played past 3 AM', '3 AM', 'local'], ['Changed outfit for no reason', 'New fit', 'local'],
    ['Scrolled the in-game feed', 'Feed scroll', 'local'], ['One radio station on repeat', 'Radio loop', 'local'],
    ['Found a nest with painted eggs', 'Egg nest', 'myth'], ['Chased a rumour you read online', 'Rumour', 'myth'],
    ['Got close to an alligator', 'Gator', 'myth'], ['Reached the highest point you could find', 'Summit', 'myth']
  ];
  // A new card goes live on the 1st of its month (local time). Cards are s1, s2, s3... one per month from November 2026,
  // in order. Months after the last card written here get one automatically (see seasonAt).
  var SEASONS = [
    { id: 's1', month: '2026-11', squares: [
      ['Wanted in the first 10 minutes', 'Fast wanted', 'chaos'], ['Crashed within a block of the start', 'Early crash', 'chaos'],
      ['Jet ski at full speed', 'Jet ski', 'cruise'], ['Drove on the beach', 'Beach drive', 'cruise'],
      ['Petted a bodega cat', 'Bodega cat', 'local'], ['Played a game on the in-game console', 'Console', 'local'],
      ['Met a dog on a jet ski', 'Cool dog', 'myth'], ['Got lost in the swamp', 'Swamp lost', 'myth']] },
    { id: 's2', month: '2026-12', squares: [
      ['Escaped 5 stars by boat', 'Boat escape', 'chaos'], ['Wrecked a car you just bought', 'New wreck', 'chaos'],
      ['Flew over Vice City', 'Fly-over', 'cruise'], ['Drove coast to coast', 'Coast run', 'cruise'],
      ['Repainted a room', 'Repaint', 'local'], ['Took 20 photos in one session', '20 photos', 'local'],
      ['Explored a spot with no map marker', 'No marker', 'myth'], ['Saw an animal you could not name', 'Odd animal', 'myth']] },
    { id: 's3', month: '2027-01', squares: [
      ['Lost a fight to a stranger', 'Lost fight', 'chaos'], ['Bailed out of a moving car', 'Bailed out', 'chaos'],
      ['Sailed to the Keys', 'Sailed', 'cruise'], ['Drove the coast at sunrise', 'Sunrise', 'cruise'],
      ['Spent a whole day on foot', 'On foot', 'local'], ['Bought something you will never use', 'Splurged', 'local'],
      ['Found a view nobody talks about', 'Hidden view', 'myth'], ['Followed a strange noise', 'Odd noise', 'myth']] }
  ];
  var FREE = ['Played this month', 'Played', 'free'];
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
  var LINES5 = linesOf(5), MID = 12;
  // Months since November 2026 on the visitor's clock (0 = November 2026, never below 0).
  function monthIndex() { var d = new Date(); return Math.max(0, (d.getFullYear() - 2026) * 12 + d.getMonth() - 10); }
  // After the written cards run out, each month still gets its own card: the monthly squares of an earlier card, taken
  // in turn, in a new layout (cardOf seeds the layout with the card's id). The same for everyone, and already translated.
  function seasonAt(k) {
    if (k < SEASONS.length) return SEASONS[k];
    var d = new Date(2026, 10 + k, 1);
    return { id: 's' + (k + 1), month: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2), squares: SEASONS[k % SEASONS.length].squares };
  }
  // A card id from a link or from storage: a written card, or an automatic one whose month has already started.
  function seasonOf(id) {
    var m = /^s(\d{1,3})$/.exec(id || ''), k = m ? Number(m[1]) - 1 : -1;
    if (k < 0) return null;
    return k < SEASONS.length || k <= monthIndex() ? seasonAt(k) : null;
  }
  function currentSeason() { return seasonAt(monthIndex()); }
  function monthName(se) {
    var p = se.month.split('-');
    try { return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString(LANG, { month: 'long', year: 'numeric' }).replace(/^./, function (c) { return c.toUpperCase(); }); }
    catch (e) { return se.month; }
  }
  // The card layout is fixed per season (a seeded shuffle of its id), so every player sees the same grid.
  function cardOf(se) {
    var all = STAPLES.concat(se.squares), s = 0, i;
    for (i = 0; i < se.id.length; i++) s = (Math.imul(s, 31) + se.id.charCodeAt(i)) >>> 0;
    s = s || 1;
    for (i = all.length - 1; i > 0; i--) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      var j = s % (i + 1), t = all[i]; all[i] = all[j]; all[j] = t;
    }
    all.splice(MID, 0, FREE);
    return all;
  }
  // 24 ticks are 24 bits: 4 URL-safe characters. Saved as "s1:Az9f,s2:...." in one key, and used in compare links.
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function maskOut(m) {
    var bits = 0, k = 0, out = '', i;
    for (i = 0; i < 25; i++) { if (i === MID) continue; if (m[i]) bits |= (1 << k); k++; }
    for (i = 0; i < 4; i++) out += B64.charAt((bits >> (6 * i)) & 63);
    return out;
  }
  function maskIn(str) {
    if (!/^[A-Za-z0-9_-]{4}$/.test(str || '')) return null;
    var bits = 0, m = [], k = 0, i;
    for (i = 0; i < 4; i++) bits |= B64.indexOf(str.charAt(i)) << (6 * i);
    for (i = 0; i < 25; i++) { if (i === MID) { m.push(1); continue; } m.push((bits >> k) & 1); k++; }
    return m;
  }
  function cardsSaved() {
    var o = {};
    load('vch.bingoCards', '').split(',').forEach(function (p) { var kv = p.split(':'); if (seasonOf(kv[0]) && maskIn(kv[1])) o[kv[0]] = kv[1]; });
    return o;
  }
  function marksFor(id) { return maskIn(cardsSaved()[id]) || maskIn('AAAA'); }
  function saveCard() {
    var o = cardsSaved(); o[bingo.season.id] = maskOut(bingo.marks);
    save('vch.bingoCards', Object.keys(o).map(function (k) { return k + ':' + o[k]; }).join(','));
  }
  var bingo = { season: currentSeason(), friend: null };
  bingo.squares = cardOf(bingo.season); bingo.marks = marksFor(bingo.season.id);

  function linesIn(m) { return LINES5.filter(function (l) { return l.every(function (i) { return m[i]; }); }).length; }
  function tickedIn(m) { var n = 0; m.forEach(function (v, i) { if (v && i !== MID) n++; }); return n; }
  function bingoLines() { return linesIn(bingo.marks); }
  function bingoNeed() {
    var need = 5;
    LINES5.forEach(function (l) { var k = l.filter(function (i) { return !bingo.marks[i]; }).length; if (k) need = Math.min(need, k); });
    return bingoLines() === LINES5.length ? 0 : need;
  }
  // The label comes from the theme you ticked the biggest share of. Self-reported, never ranked against anyone.
  function bingoLabel(m, sq) {
    var per = {}, total = tickedIn(m);
    BORDER.forEach(function (t) { per[t] = [0, 0]; });
    sq.forEach(function (q, i) { if (i === MID) return; per[q[2]][1]++; if (m[i]) per[q[2]][0]++; });
    if (total === 24) return { label: tr('Blackout'), why: tr('Every square on the card'), theme: null, per: per };
    if (total < 3) return { label: tr('Fresh card'), why: tr('Tick 3 squares to get your label'), theme: null, per: per };
    var order = BORDER.slice().sort(function (a, b) { return per[b][0] / per[b][1] - per[a][0] / per[a][1]; });
    var top = order[0], gap = per[top][0] / per[top][1] - per[order[1]][0] / per[order[1]][1];
    if (total >= 8 && gap < 0.17) return { label: tr('Leonida All-Rounder'), why: tr('An even spread across all four themes'), theme: null, per: per };
    return { label: tr(BTHEME[top].label), why: tr('{k} of {n} {theme} squares', { k: per[top][0], n: per[top][1], theme: tr(BTHEME[top].name) }), theme: top, per: per };
  }
  function paintLines() {
    var on = {};
    LINES5.forEach(function (l) { if (l.every(function (i) { return bingo.marks[i]; })) l.forEach(function (i) { on[i] = 1; }); });
    Array.prototype.forEach.call($('bingo').children, function (c, i) { c.classList.toggle('is-line', !!on[i]); });
  }

  function buildBingo() {
    var box = $('bingo'), f = bingo.friend && bingo.friend.season === bingo.season.id ? bingo.friend.marks : null;
    box.textContent = '';
    $('bingo-month').textContent = monthName(bingo.season);
    bingo.squares.forEach(function (q, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell cell--' + q[2] + (i === MID ? ' cell--free' : '') + (f && f[i] && i !== MID ? ' is-theirs' : '');
      var full = document.createElement('span'); full.className = 'cell__t'; full.textContent = tr(q[0]);
      var short = document.createElement('span'); short.className = 'cell__s'; short.textContent = tr(q[1]); short.setAttribute('aria-hidden', 'true');
      b.appendChild(full); b.appendChild(short);
      b.setAttribute('aria-pressed', String(Boolean(bingo.marks[i])));
      if (i === MID) b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', function () {
        if (i === MID) return;
        var before = bingoLines();
        bingo.marks[i] = bingo.marks[i] ? 0 : 1;
        saveCard();
        b.setAttribute('aria-pressed', String(Boolean(bingo.marks[i])));
        $('bingo-said').textContent = (bingo.marks[i] ? '✓ ' : '') + tr(q[0]);
        var after = bingoLines();
        renderBingoScore();
        if (after > before) {
          buzz();
          toast(after === LINES5.length ? tr('Blackout. Every square ticked.') : tr(after === 1 ? 'Bingo: 1 line. Share your card.' : 'Bingo: {n} lines. Share your card.', { n: after }));
          box.classList.remove('win'); void box.offsetWidth; box.classList.add('win');
        }
        drawSoon();
      });
      box.appendChild(b);
    });
    renderBingoScore(); renderPast();
  }
  function scoreLine(m) {
    var n = linesIn(m);
    return tickedIn(m) + '/24 · ' + (n === 1 ? tr('1 line') : tr('{n} lines', { n: n }));
  }
  function renderBingoScore() {
    var n = bingoLines(), need = bingoNeed(), L = bingoLabel(bingo.marks, bingo.squares);
    $('bingo-score').textContent = scoreLine(bingo.marks) + (need ? ' · ' + (need === 1 ? tr('1 more for the next line') : tr('{k} more for the next line', { k: need })) : '');
    $('bingo-score').classList.toggle('is-bingo', n > 0);
    $('bingo-label').textContent = L.label;
    $('bingo-why').textContent = L.why;
    paintLines(); renderFriend();
  }
  // Past cards: earlier months stay readable, and the launch-night board from the first two days is kept as a keepsake.
  function renderPast() {
    var list = $('bingo-past'), saved = cardsSaved(), rows = [];
    for (var k = 0; k <= Math.max(monthIndex(), SEASONS.length - 1); k++) {
      var se = seasonAt(k);
      if (se.id === bingo.season.id || !saved[se.id]) continue;
      var m = maskIn(saved[se.id]);
      rows.push(monthName(se) + ': ' + scoreLine(m) + ' · ' + bingoLabel(m, cardOf(se)).label);
    }
    var old = load('vch.bingoMarksBig', '') || load('vch.bingoMarks', '');
    if (/^[01]+$/.test(old) && old.replace(/0/g, '').length > 1) rows.push(tr('Launch night 2026: {n} squares ticked', { n: old.replace(/0/g, '').length - 1 }));
    list.textContent = '';
    rows.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; list.appendChild(li); });
    $('bingo-past-wrap').hidden = !rows.length;
  }

  // ---- compare: a friend's link (#b=s1.Az9f~Name) shows their ticks on your card ----
  function readBingoLink() {
    var m = /^#b=(s\d{1,3})\.([A-Za-z0-9_-]{4})(?:~(.*))?$/.exec(location.hash || '');
    if (!m || !seasonOf(m[1])) return;
    var name = '';
    try { name = cleanName(decodeURIComponent(m[3] || '')).slice(0, 16); } catch (e) { name = ''; }
    bingo.friend = { season: m[1], marks: maskIn(m[2]), name: name || tr('Your friend') };
    try { history.replaceState(null, '', location.pathname + location.search + '#bingo-title'); } catch (e) { /* old browser */ }
  }
  function renderFriend() {
    var box = $('bingo-vs'), f = bingo.friend;
    if (!f) { box.hidden = true; return; }
    box.hidden = false;
    var se = seasonOf(f.season);
    if (f.season !== bingo.season.id) {
      $('bingo-vs-head').textContent = tr('{name} sent their {month} card: {score}', { name: f.name, month: monthName(se), score: scoreLine(f.marks) });
      $('bingo-vs-text').textContent = tr('This month has a new card. Tick yours and send it back.');
      return;
    }
    var both = 0, me = 0, them = 0;
    for (var i = 0; i < 25; i++) { if (i === MID) continue; if (f.marks[i] && bingo.marks[i]) both++; else if (bingo.marks[i]) me++; else if (f.marks[i]) them++; }
    $('bingo-vs-head').textContent = tr('{name}: {score} · {label}', { name: f.name, score: scoreLine(f.marks), label: bingoLabel(f.marks, bingo.squares).label });
    $('bingo-vs-text').textContent = tr('You both did {b}. Only you: {m}. Only {name}: {t}. Their squares have a dashed edge.', { b: both, m: me, t: them, name: f.name });
  }
  function bingoUrl() {
    var t = cleanName(settings.tag || '').slice(0, 16);
    return SITE + '#b=' + bingo.season.id + '.' + maskOut(bingo.marks) + (t ? '~' + encodeURIComponent(t) : '');
  }
  function bingoText() {
    var rows = [], L = bingoLabel(bingo.marks, bingo.squares);
    for (var r = 0; r < 5; r++) {
      var row = '';
      for (var c = 0; c < 5; c++) { var i = r * 5 + c; row += i === MID ? '⭐' : bingo.marks[i] ? BTHEME[bingo.squares[i][2]].emoji : '⬛'; }
      rows.push(row);
    }
    return tr('Leonida Bingo') + ' · ' + monthName(bingo.season) + ' · ' + scoreLine(bingo.marks) + ' · ' + L.label + '\n' + rows.join('\n') + '\n' + tr('Beat my card:') + ' ' + bingoUrl();
  }

  // The share image: 1080 x 1350, label on top, the coloured grid (shape only, no words) and the score beside it.
  function drawBingoCard(cv) {
    var W = 1080, H = 1350, T = THEMES[settings.theme] || THEMES.night, L = bingoLabel(bingo.marks, bingo.squares);
    cv.width = W * 2; cv.height = H * 2;
    var ctx = cv.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    scene(ctx, T, W, H, 470, 880, 140, true);
    topRow(ctx, T, W, 64, 44);
    lift(ctx, true);
    ctx.fillStyle = T.ink; fitText(ctx, L.label, 680, 100, '400 {s}px Anton, sans-serif'); ctx.fillText(L.label, 60, 258);
    var sub = tr('Leonida Bingo') + ' · ' + monthName(bingo.season);
    ctx.fillStyle = T.sun[0]; fitText(ctx, sub, 680, 38, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(sub, 64, 320);
    ctx.fillStyle = T.ink2; fitText(ctx, L.why, 680, 34, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(L.why, 64, 372);
    lift(ctx, false);
    var gx = 64, gy = 520, cs = 100, gap = 10, on = {};
    LINES5.forEach(function (l) { if (l.every(function (i) { return bingo.marks[i]; })) l.forEach(function (i) { on[i] = 1; }); });
    bingo.squares.forEach(function (q, i) {
      var x = gx + (i % 5) * (cs + gap), y = gy + Math.floor(i / 5) * (cs + gap);
      roundRect(ctx, x, y, cs, cs, 16);
      ctx.fillStyle = i === MID ? T.done : bingo.marks[i] ? BTHEME[q[2]].color : T.fill[0];
      ctx.fill();
      if (!bingo.marks[i]) { ctx.strokeStyle = T.line; ctx.lineWidth = 2; ctx.stroke(); }
      if (on[i]) { roundRect(ctx, x + 5, y + 5, cs - 10, cs - 10, 12); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.stroke(); }
      if (i === MID) star(ctx, x + cs / 2, y + cs / 2, 26, T.onFull);
      else if (bingo.marks[i]) {
        ctx.strokeStyle = 'rgba(0,0,0,.72)'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x + cs * 0.3, y + cs * 0.52); ctx.lineTo(x + cs * 0.44, y + cs * 0.66); ctx.lineTo(x + cs * 0.71, y + cs * 0.36); ctx.stroke();
        ctx.lineCap = 'butt';
      }
    });
    var rx = 664, n = tickedIn(bingo.marks), ln = bingoLines();
    ctx.fillStyle = T.ink; ctx.font = '400 128px Anton, sans-serif'; ctx.fillText(String(n), rx, 636);
    var nw = ctx.measureText(String(n)).width;
    ctx.fillStyle = T.ink2; ctx.font = '400 60px Anton, sans-serif'; ctx.fillText('/24', rx + nw + 10, 636);
    ctx.font = '600 32px "DM Sans", sans-serif'; ctx.fillText(tr('squares ticked'), rx + 2, 682);
    ctx.fillStyle = ln ? T.sun[0] : T.ink; ctx.font = '400 92px Anton, sans-serif';
    ctx.fillText(ln === 1 ? tr('1 line') : tr('{n} lines', { n: ln }), rx, 800);
    BORDER.forEach(function (t, k) {
      var y = 880 + k * 54, c = L.per[t];
      roundRect(ctx, rx, y - 28, 32, 32, 7); ctx.fillStyle = BTHEME[t].color; ctx.fill();
      ctx.fillStyle = T.ink2; fitText(ctx, tr(BTHEME[t].name) + '  ' + c[0] + '/' + c[1], 1016 - rx - 48, 34, '600 {s}px "DM Sans", sans-serif');
      ctx.fillText(tr(BTHEME[t].name) + '  ' + c[0] + '/' + c[1], rx + 48, y);
    });
    dare(ctx, T, W, H, 0, n === 24 ? tr('Blackout. Can you match it?') : tr('Beat my bingo card'));
    grain(ctx, W, H);
  }
  function star(ctx, cx, cy, r, color) {
    ctx.beginPath();
    for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function bingoBlob() {
    return new Promise(function (resolve, reject) {
      var cv = document.createElement('canvas'); exporting = true;
      try { drawBingoCard(cv); } finally { exporting = false; }
      cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('no image')); }, 'image/png');
    });
  }
  function bingoStatus(msg) { var s = $('bingo-status'); s.textContent = ''; setTimeout(function () { s.textContent = msg; }, 30); }
  function bindRemind() { var b = $('daily-remind'); if (b) b.addEventListener('click', remindTomorrow); }
  function bindBingo() {
    readBingoLink();
    $('bingo-share').addEventListener('click', function () {
      var btn = this, name = 'leonida-bingo-' + bingo.season.month + '.png'; btn.disabled = true;
      bingoBlob().then(function (blob) {
        var file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: tr('Leonida Bingo'), text: bingoText() }).then(function () { bingoStatus(tr('Shared.')); }, function (e) {
            if (e && e.name === 'AbortError') return;
            downloadAs(blob, name); bingoStatus(tr('Sharing is blocked here, so the card was downloaded instead.'));
          });
        }
        downloadAs(blob, name);
        return copy(bingoText()).then(function () { bingoStatus(tr('Card downloaded and your grid copied. Post both.')); },
          function () { bingoStatus(tr('Card downloaded.')); });
      }).catch(function () { bingoStatus(tr('The card could not be made in this browser. Try another browser.')); })
        .then(function () { btn.disabled = false; });
    });
    $('bingo-copy').addEventListener('click', function () {
      shareOrCopy(bingoText(), bingoStatus, tr('Grid and link copied. Paste it in the group chat.'));
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
  // Day stamps and start dates were removed; clear what older versions saved, without touching the progress stamp.
  try { localStorage.removeItem('vch.dayone'); localStorage.removeItem('vch.since'); } catch (err) { /* blocked */ }
  var dailyDone = (function () { var v = load('vch.daily', ''); return v ? v.split(',').map(Number).filter(function (x) { return x >= 0; }) : []; })();
  // The streak counts back from today (or yesterday, if today isn't done yet). A shield covers one missed day in any
  // 7 days, automatically, so one busy evening never wipes a run. shieldUsed tells the page whether it kicked in.
  var shieldUsed = false;
  function streak() {
    var d = dayIndex(), s = 0, shieldAt = null;
    shieldUsed = false;
    if (dailyDone.indexOf(d) < 0) d--;
    while (d >= 0) {
      if (dailyDone.indexOf(d) >= 0) { s++; d--; continue; }
      // A single missed day, with a done day before it, and no other shield in the 7 days after it.
      var single = d - 1 >= 0 && dailyDone.indexOf(d - 1) >= 0;
      if (single && (shieldAt === null || shieldAt - d >= 7)) { if (shieldAt === null && dayIndex() - d < 7) shieldUsed = true; shieldAt = d; d--; continue; }
      break;
    }
    return s;
  }
  // A past dare's date, like "20 Nov" in the visitor's language.
  function dateOf(day) {
    var d = new Date(LAUNCH + day * 864e5 + 432e5);
    try { return d.toLocaleDateString(LANG, { day: 'numeric', month: 'short' }); } catch (e) { return d.getDate() + '/' + (d.getMonth() + 1); }
  }
  function untilMidnight() {
    var n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), mins = Math.max(1, Math.round((m - n) / 6e4));
    // Non-breaking spaces keep "9 h 57 min" on one line.
    return (Math.floor(mins / 60) ? tr('{h} h {m} min', { h: Math.floor(mins / 60), m: mins % 60 }) : tr('{m} min', { m: mins })).replace(/ /g, '\u00a0');
  }
  function renderDaily() {
    var d = dayIndex(), done = dailyDone.indexOf(d) >= 0, st = streak();
    $('daily-task').textContent = tr(DAILY[d % DAILY.length]);
    $('daily-reset').textContent = done ? tr('Done. Next dare in {t}', { t: untilMidnight() }) : tr('Same dare for everyone. New one in {t}', { t: untilMidnight() });
    $('daily-streak-n').textContent = st;
    // English says "0 day streak" and "5 day streak"; Spanish and Portuguese need the plural.
    $('daily-streak').textContent = (st === 1 || LANG === 'en') ? tr('day streak') : tr('days streak');
    var best = Math.max(longestStreak(), st);
    $('daily-total').textContent = (best === 1 ? tr('Best: 1 day') : tr('Best: {n} days', { n: best })) + ' · ' + (dailyDone.length === 1 ? tr('1 done') : tr('{n} done', { n: dailyDone.length }));
    $('daily-shield').textContent = shieldUsed ? tr('A missed day was forgiven this week') : tr('Miss a day? One a week is forgiven');
    // Past dares: every day since launch, newest first, done or missed. Read only, so the streak stays honest.
    var pastList = $('daily-past'), wrap = $('daily-past-wrap');
    wrap.hidden = d === 0; pastList.textContent = '';
    for (var p = d - 1; p >= 0 && p >= d - 30; p--) {
      var li = document.createElement('li'), ok = dailyDone.indexOf(p) >= 0;
      li.className = ok ? 'is-on' : '';
      li.innerHTML = '<span class="past__day"></span><span class="past__task"></span><span class="past__mark"></span>';
      li.children[0].textContent = dateOf(p);
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
  // Remind me tomorrow: a calendar event for 8 pm tomorrow, made on the device. No account, nothing sent anywhere.
  function remindTomorrow() {
    var t = new Date(); t.setDate(t.getDate() + 1); t.setHours(20, 0, 0, 0);
    var pad = function (n) { return ('0' + n).slice(-2); };
    var stamp = function (d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z'; };
    var end = new Date(t.getTime() + 15 * 6e4);
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vice City Hub//Daily dare//EN', 'BEGIN:VEVENT',
      'UID:dare-' + stamp(t) + '@vicecityhub0.vercel.app', 'DTSTAMP:' + stamp(new Date()), 'DTSTART:' + stamp(t), 'DTEND:' + stamp(end),
      'SUMMARY:' + tr('Leonida daily dare'), 'DESCRIPTION:' + tr('Today\'s dare:') + ' ' + SITE + '#tools', 'URL:' + SITE + '#tools',
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:' + tr('Leonida daily dare'), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    downloadAs(new Blob([ics], { type: 'text/calendar' }), 'leonida-daily-dare.ics');
    var st = $('daily-status'); st.textContent = ''; setTimeout(function () { st.textContent = tr('Calendar event downloaded. Open it to add the reminder.'); }, 30);
  }
  function dailyText() {
    var d = dayIndex(), cells = '';
    for (var i = Math.max(0, d - 6); i <= d; i++) cells += dailyDone.indexOf(i) >= 0 ? '🟪' : '⬛';
    var st = streak();
    return tr('Leonida daily dare') + ' · ' + (st ? tr('{n}-day streak', { n: st }) : tr('starting my streak')) + '\n' + cells + '\n' + tr('Today\'s dare:') + ' ' + SITE + '#tools';
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
    b.querySelector('span').textContent = tipped ? tr('Tip sent') : tr('Already tipped?');
    $('tipped-msg').textContent = tipped
      ? tr('Your card now shows a gold Backed the hub line. Tap again to remove it.')
      : tr('Honor system: we can\'t see who tips. Tap to add a gold "Backed the hub" line to your card as a thank-you.');
  }
  function bindTipped() {
    $('tipped-btn').addEventListener('click', function () {
      tipped = !tipped; save('vch.tipped', tipped ? '1' : '');
      if (tipped) { buzz(); toast(tr('Thank you. Your card now shows Backed the hub.')); }
      renderTipped(); drawSoon();
    });
  }

  // ---- cheat codes: search, type filter, "known code only", and a personal unlocked checklist ----
  // ---- 100% checklist: one count per category, saved as "key:n,key:n" (short enough for backups and progress links) ----
  function bindHundred() {
    var box = $('hundred'); if (!box) return;
    var saved = {};
    load('vch.hundred', '').split(',').forEach(function (p) { var kv = p.split(':'); if (kv[1]) saved[kv[0]] = Number(kv[1]) || 0; });
    var inputs = Array.prototype.slice.call(box.querySelectorAll('[data-h]'));
    function val(inp) { return inp.type === 'checkbox' ? (inp.checked ? 1 : 0) : Math.max(0, Math.min(Number(inp.max) || 999, Math.floor(Number(inp.value) || 0))); }
    function paint() {
      var done = 0, out = [];
      inputs.forEach(function (inp) {
        var li = inp.closest('.hitem'), req = Number(li.dataset.req), v = val(inp), ok = v >= req;
        if (inp.type !== 'checkbox' && String(v) !== inp.value) inp.value = v;
        li.classList.toggle('is-done', ok);
        li.querySelector('.hbar i').style.transform = 'scaleX(' + Math.min(1, v / req) + ')';
        if (ok) done++;
        if (v) out.push(inp.dataset.h + ':' + v);
      });
      box.querySelectorAll('.hgroup').forEach(function (g) {
        var items = g.querySelectorAll('.hitem'), d = g.querySelectorAll('.hitem.is-done').length;
        g.querySelector('[data-group-count]').textContent = tr('{d} of {n}', { d: d, n: items.length });
      });
      $('h-done').textContent = done; $('h-total').textContent = inputs.length;
      box.classList.toggle('only-left', $('h-left').checked);
      save('vch.hundred', out.join(','));
      return done;
    }
    inputs.forEach(function (inp) {
      if (inp.type === 'checkbox') inp.checked = !!saved[inp.dataset.h]; else inp.value = saved[inp.dataset.h] || 0;
      inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', function () {
        var was = box.querySelectorAll('.hitem.is-done').length, now = paint();
        if (now > was) { buzz(); toast(now === inputs.length ? tr('Every category done. That is 100%.') : tr('Category done: {n} of {t}', { n: now, t: inputs.length })); }
      });
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-inc],[data-dec]'); if (!b) return;
      var k = b.dataset.inc || b.dataset.dec, inp = box.querySelector('input[data-h="' + k + '"]');
      inp.value = val(inp) + (b.dataset.inc ? 1 : -1);
      inp.dispatchEvent(new Event('input'));
    });
    $('h-left').addEventListener('change', paint);
    paint();
  }
  // ---- Chapter 1 checklist on the help page ----
  function bindChapterOne() {
    var boxes = document.querySelectorAll('[data-c1]'); if (!boxes.length) return;
    var got = load('vch.chapterOne', '').split(',').filter(Boolean);
    boxes.forEach(function (b) {
      b.checked = got.indexOf(b.dataset.c1) >= 0;
      b.addEventListener('change', function () {
        got = Array.prototype.filter.call(boxes, function (x) { return x.checked; }).map(function (x) { return x.dataset.c1; });
        save('vch.chapterOne', got.join(','));
        if (got.length === boxes.length) toast(tr('All set. Chapter 1 can end.'));
      });
    });
  }

  function bindCheats() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#cheat-rows tr'));
    if (!rows.length) return;
    var got = load('vch.cheats', '').split(',').filter(Boolean);
    var cat = 'all';
    var norm = function (x) { return x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
    // Count only cheats on this page, so an old saved id (a renamed or removed cheat) can't push it past the total.
    var ids = rows.map(function (r) { return r.dataset.id; });
    function count() {
      var n = got.filter(function (g, k) { return ids.indexOf(g) >= 0 && got.indexOf(g) === k; }).length;
      $('cheat-count').textContent = tr('{n} of {m} unlocked', { n: n, m: rows.length });
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
          // Any backup with at least one valid entry loads: a player who only used the dare, bingo or cheat list has no map yet.
          Object.keys(d).forEach(function (k) { if (validKey(k, d[k])) clean[k] = d[k]; });
          if (!Object.keys(clean).some(function (k) { return !META[k]; })) throw new Error('empty backup');
          openWithProgress(clean, true);
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
    if (restored === 'moved') toast(tr('Your map moved here from the old address. Bookmark this one.'));
    else if (restored === 'older') toast(tr('This progress link is older than the progress in this browser, so nothing changed.'), tr('Use it anyway'), function () { openWithProgress(olderLink, true); });
    else if (restored === 'replaced') toast(tr('Progress restored from your link.'), tr('Undo'), function () { replaceProgress(beforeRestore); location.reload(); });
    else if (restored) toast(tr('Progress restored from your link.'));
  }

  // ---- the cards, drawn only near the screen or when exported ----
  // One system for every card: wordmark row, who, the number, the playstyle or rank, one line only this player could
  // have, the map, and a footer that says what to do next and where.
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

  // Card sizes: Post 4:5 for feeds, Story 9:16 for Stories, TikTok and Shorts. Painted at twice the layout size.
  // 'square' is the stored name of the feed post, now 4:5 (1080 x 1350): the size feeds show largest, and the one
  // Instagram's profile grid crops least. Stories are 9:16 with nothing important in the top 250 or bottom 310 px.
  var FORMATS = { square: [1080, 1350], story: [1080, 1920] };
  // The preview is painted at the size it is shown on this screen (no grain, which only matters once a feed recompresses
  // the file); the shared and downloaded image is painted separately at full 2x quality. On a slow phone this makes a
  // change to the card about four times cheaper.
  var exporting = false;
  function previewScale(W) {
    var cv = $('card-canvas'), shown = cv.getBoundingClientRect().width || 480;
    return Math.min(2, Math.max(0.5, Math.ceil(shown * (window.devicePixelRatio || 1) / W * 4) / 4));
  }
  function draw() {
    cardDirty = false;
    // A 0% map card says so, with a way to fix it, before anyone shares an empty map.
    var hint = $('card-hint'); if (hint) hint.hidden = steps() > 0 || settings.kind === 'blend';
    var cv = $('card-canvas');
    cv.classList.toggle('is-story', settings.format === 'story');
    paint(cv, previewScale((FORMATS[settings.format] || FORMATS.square)[0]));
  }
  function paint(cv, k) {
    var F = FORMATS[settings.format] || FORMATS.square, W = F[0], H = F[1], T = THEMES[settings.theme];
    var cw = Math.round(W * k), ch = Math.round(H * k);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
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
  // A playstyle from where you went most, not how much: everyone gets a label they'd post.
  var STYLES = { kalaga: 'Mountain goat', gellhorn: 'Dockside drifter', ambrosia: 'Small-town legend', vice: 'City slicker', grass: 'Swamp rat', keys: 'Beach bum' };
  function playstyle(lv) {
    lv = lv || levels;
    var n = lv.reduce(function (a, b) { return a + b; }, 0), max = Math.max.apply(null, lv);
    if (!n) return tr('Still in the menu');
    if (n === 18) return tr('Owns the map');
    var top = []; lv.forEach(function (l, i) { if (l === max) top.push(i); });
    if (Math.min.apply(null, lv) >= 2) return tr('Road tripper');
    if (top.length > 2) return tr('Explorer');
    return tr(STYLES[REGIONS[top[0]].id]);
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
    var right = settings.platform;
    ctx.textAlign = 'right'; ctx.fillStyle = T.ink2; ctx.font = '600 ' + Math.round(s * 0.66) + 'px "DM Sans", sans-serif';
    ctx.fillText(right, W - 64, y + s * 0.76);
    // Players who tipped get a gold "Backed the hub" before the platform, on every card.
    if (tipped) { var rw = ctx.measureText(right + '   ').width; ctx.fillStyle = T.done; ctx.fillText(tr('Backed the hub') + '  ·', W - 64 - rw, y + s * 0.76); }
    ctx.textAlign = 'left';
  }
  // Every card ends the same way: a hairline, what to do in plain words, the address in the accent colour, and an
  // exit arrow in a ring. Feeds keep it 76 px from the bottom; stories keep it above Instagram's reply bar.
  function footY(H) { return H > 1500 ? 1440 : H - 200; }
  function dare(ctx, T, W, H, h, big) {
    var y = footY(H), story = H > 1500, cs = story ? 56 : 50, us = story ? 38 : 34, r = story ? 44 : 40;
    ctx.fillStyle = T.line; ctx.fillRect(64, y, W - 128, 2);
    var tw = W - 128 - r * 2 - 32;
    ctx.fillStyle = T.ink; fitText(ctx, big, tw, cs, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(big, 62, y + (story ? 80 : 72));
    ctx.fillStyle = T.accent; fitText(ctx, 'vicecityhub0.vercel.app', tw, us, '600 {s}px "DM Sans", sans-serif');
    ctx.fillText('vicecityhub0.vercel.app', 64, y + (story ? 134 : 122));
    var cx = W - 64 - r, cy = y + (story ? 92 : 84), a = r * 0.42;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = T.accent; ctx.fill();
    ctx.strokeStyle = T.onFull; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx - a, cy + a); ctx.lineTo(cx + a, cy - a); ctx.moveTo(cx - a * 0.2, cy - a); ctx.lineTo(cx + a, cy - a); ctx.lineTo(cx + a, cy + a * 0.2); ctx.stroke();
    ctx.lineCap = 'butt';
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

  // ---- the scene behind every card: Leonida at dusk, from the hub's own mark (a striped sun setting over the road) ----
  // A sky in the theme's colours, the sun half under the horizon with the mark's bands cut through it, the sea with
  // the sun's reflection, and a fine grain so gradients never band when a feed recompresses the image.
  var grainTile = null;
  function grain(ctx, W, H) {
    if (!exporting) return;
    if (!grainTile) {
      grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 160;
      var g = grainTile.getContext('2d'), d = g.createImageData(160, 160), seed = 7;
      for (var i = 0; i < d.data.length; i += 4) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        var v = (seed >>> 24) & 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 14;
      }
      g.putImageData(d, 0, 0);
    }
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(grainTile, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function scene(ctx, T, W, H, hy, sx, sr, still) {
    var sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, T.sky[0]); sky.addColorStop(0.62, T.sky[1]); sky.addColorStop(1, T.sky[2]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy);
    // a soft glow where the sun sits
    var glow = ctx.createRadialGradient(sx, hy, sr * 0.4, sx, hy, sr * 2.4);
    glow.addColorStop(0, hexA(T.sun[1], 0.45)); glow.addColorStop(1, hexA(T.sun[1], 0));
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, hy);
    // the sun, drawn on its own layer so the mark's bands cut only the sun, never the glow behind it
    var sc = document.createElement('canvas'), d = Math.ceil(sr * 2) + 4;
    sc.width = d * 2; sc.height = Math.ceil(sr) * 2 + 4;
    var g = sc.getContext('2d'); g.scale(2, 2);
    var sun = g.createLinearGradient(0, 0, 0, sr);
    sun.addColorStop(0, T.sun[0]); sun.addColorStop(1, T.sun[1]);
    g.beginPath(); g.arc(d / 2, sr + 1, sr, Math.PI, 0); g.fillStyle = sun; g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (var k = 0; k < 5; k++) g.fillRect(0, sr * 0.48 + k * sr * 0.105, d, 4 + k * 3.2);
    ctx.drawImage(sc, sx - d / 2, hy - sr - 1, d, sr + 2);
    // the sea
    var sea = ctx.createLinearGradient(0, hy, 0, H);
    sea.addColorStop(0, T.water[0]); sea.addColorStop(1, T.water[1]);
    ctx.fillStyle = sea; ctx.fillRect(0, hy, W, H - hy);
    // the sun's reflection: short bright dashes that thin out towards the viewer
    ctx.fillStyle = hexA(T.sun[1], 0.55);
    for (var r = 0; r < (still ? 0 : 9); r++) {
      var ry = hy + 10 + r * r * 4.2, rw = sr * (1.1 - r * 0.1), rh = 3 + r * 0.6;
      if (rw <= 8) break;
      ctx.globalAlpha = 0.75 - r * 0.07; roundRect(ctx, sx - rw / 2, ry, rw, rh, rh / 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = hexA(T.sun[0], 0.7); ctx.fillRect(0, hy - 1, W, 2);
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  // Text over the sky gets a soft dark shadow so it holds on every part of the gradient.
  function lift(ctx, on) { if (on) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4; } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; } }

  // Map cards: a poster. The number in the sky, the playstyle under it, Leonida rising from the sea in front of the sun.
  function drawSquare(ctx, T, W, H) {
    var n = steps(), p = pctOf(n);
    scene(ctx, T, W, H, 700, 806, 196);
    topRow(ctx, T, W, 64, 44);
    lift(ctx, true);
    ctx.fillStyle = T.ink; var nm = cardName();
    fitText(ctx, nm, 520, 46, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(nm, 64, 200);
    bigPct(ctx, T, p, 54, 506, 520, 280, p === 100 ? T.done : T.ink);
    ctx.fillStyle = T.ink2; ctx.font = '600 40px "DM Sans", sans-serif'; ctx.fillText(tr('of Leonida seen'), 64, 566);
    ctx.fillStyle = T.sun[0]; fitText(ctx, playstyle(), 500, 76, '400 {s}px Anton, sans-serif'); ctx.fillText(playstyle(), 62, 664);
    lift(ctx, false);
    drawMap(ctx, T, 592, 606, 0.7, null);
    ctx.fillStyle = T.ink; wrapFit(ctx, verdict(), 64, 800, 470, 42, 32, 3, '600');
    dare(ctx, T, W, H, 0, mapDare(p));
    grain(ctx, W, H);
  }
  function drawStory(ctx, T, W, H) {
    var n = steps(), p = pctOf(n);
    scene(ctx, T, W, H, 990, 806, 220);
    topRow(ctx, T, W, 250, 52);
    lift(ctx, true);
    ctx.fillStyle = T.ink; var nm = cardName();
    fitText(ctx, nm, W - 128, 54, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(nm, 64, 408);
    bigPct(ctx, T, p, 52, 770, W - 128, 340, p === 100 ? T.done : T.ink);
    ctx.fillStyle = T.ink2; ctx.font = '600 48px "DM Sans", sans-serif'; ctx.fillText(tr('of Leonida seen'), 64, 840);
    ctx.fillStyle = T.sun[0]; fitText(ctx, playstyle(), 500, 88, '400 {s}px Anton, sans-serif'); ctx.fillText(playstyle(), 62, 950);
    lift(ctx, false);
    drawMap(ctx, T, 572, 880, 0.74, null, { labels: true });
    ctx.fillStyle = T.ink; wrapFit(ctx, verdict(), 64, 1100, 460, 46, 34, 3, '600');
    dare(ctx, T, W, H, 0, mapDare(p));
    grain(ctx, W, H);
  }

  // The lake reads as water: a blue pool with a dark shore and two light ripples, never a black hole.
  function drawLake(ctx, T) {
    var lake = new Path2D(LAKE);
    ctx.fillStyle = T.lake; ctx.fill(lake);
    ctx.strokeStyle = T.edge; ctx.lineWidth = 3; ctx.stroke(lake);
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    [[-16, LAKE_Y - 4], [-4, LAKE_Y + 6]].forEach(function (w) {
      ctx.beginPath(); ctx.moveTo(LAKE_X + w[0] - 6, w[1]); ctx.quadraticCurveTo(LAKE_X + w[0], w[1] - 5, LAKE_X + w[0] + 6, w[1]);
      ctx.quadraticCurveTo(LAKE_X + w[0] + 12, w[1] + 5, LAKE_X + w[0] + 18, w[1]); ctx.stroke();
    });
    ctx.lineCap = 'butt';
  }

  // Finds where a region's name fits: the largest size (32 down to 18) at the spot nearest its label point where every
  // edge of every line, and the tick under it, sits inside the region with a margin and away from the lake.
  var fitCache = {}, fitCtx = null;
  function fitLabel(r, labels, done) {
    var lines = r.two ? r.name.split(' ') : [r.id === 'kalaga' ? 'Mount Kalaga' : r.name];
    var key = r.id + '|' + labels + '|' + done + '|' + lines.join(' ');
    if (fitCache[key]) return fitCache[key];
    if (!fitCtx) { var c = document.createElement('canvas'); c.width = 600; c.height = 740; fitCtx = c.getContext('2d'); }
    var g = fitCtx, path = new Path2D(r.d), lake = new Path2D(LAKE), pad = 4, TR = 16;
    function ok(px, py) {
      return g.isPointInPath(path, px, py) && !g.isPointInPath(lake, px, py) &&
        !g.isPointInPath(lake, px - pad, py) && !g.isPointInPath(lake, px + pad, py) && !g.isPointInPath(lake, px, py - pad) && !g.isPointInPath(lake, px, py + pad);
    }
    function boxOk(x0, y0, x1, y1) {
      for (var t = 0; t <= 4; t++) {
        var fx = x0 + (x1 - x0) * t / 4, fy = y0 + (y1 - y0) * t / 4;
        if (!ok(fx, y0) || !ok(fx, y1) || !ok(x0, fy) || !ok(x1, fy)) return false;
      }
      return true;
    }
    var offs = [];
    for (var dx = -48; dx <= 48; dx += 6) for (var dy = -40; dy <= 40; dy += 6) offs.push([dx, dy]);
    offs.sort(function (a, b) { return (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]); });
    var best = null;
    for (var fs = labels ? 32 : 0; fs >= (labels ? 18 : 0) && !best; fs -= 2) {
      g.font = '400 ' + fs + 'px Anton, sans-serif';
      var widths = lines.map(function (t) { return g.measureText(t).width; });
      var lh = fs * 0.92, cap = fs * 0.78, blockH = labels ? (lines.length - 1) * lh + cap : 0;
      for (var o = 0; o < offs.length && !best; o++) {
        var cx = r.label[0] + offs[o][0], cy = r.label[1] + offs[o][1] - (done && labels ? 14 : 0);
        var top = cy - blockH / 2, base = [], fits = true;
        for (var k = 0; k < (labels ? lines.length : 0) && fits; k++) {
          var b = top + cap + k * lh; base.push(b);
          fits = boxOk(cx - widths[k] / 2 - pad, b - cap - pad, cx + widths[k] / 2 + pad, b + pad);
        }
        var ty = labels ? top + blockH + 10 + TR : cy;
        if (fits && done) {
          for (var a = 0; a < 12 && fits; a++) fits = ok(cx + Math.cos(a * Math.PI / 6) * (TR + 4), ty + Math.sin(a * Math.PI / 6) * (TR + 4));
        }
        if (fits) best = { x: cx, base: base, fs: fs, lines: lines, tickY: ty };
      }
    }
    // Never expected (every region has room at 18px), but keep the old spot rather than drawing nothing.
    if (!best) best = { x: r.label[0], base: lines.map(function (t, k) { return r.label[1] + k * 20; }), fs: 18, lines: lines, tickY: r.label[1] + lines.length * 20 + 10 };
    return (fitCache[key] = best);
  }

  // The map as drawn on the cards, at (x, y) and scale sc of its 600 x 740 layout. No frame: the state itself is the picture.
  // Unseen regions sit under fog. blend: { mine: [...], theirs: [...] } paints who explored each region instead.
  function drawMap(ctx, T, x, y, sc, blend, opts) {
    var labels = !!(opts && opts.labels);
    var LV = blend ? blend.mine.map(function (m, i) { return Math.max(m, blend.theirs[i]); }) : levels;
    var fog = T.fill[0];
    var both = blend ? stripes(ctx, T.accent, T.done, 34) : null;
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
    drawLake(ctx, T);
    ctx.textAlign = 'center';
    // Every name is fitted inside its own region (and clear of the lake) at the largest size that fits; a finished
    // region gets its tick centred under the name, also kept inside the region.
    REGIONS.forEach(function (r, i) {
      var done = !blend && LV[i] === 3;
      if (r.out) {
        // The Keys' name sits on the sea, so its tick goes right after the name instead of on the mainland.
        ctx.font = '400 32px Anton, sans-serif';
        if (labels) { ctx.fillStyle = LV[i] ? '#FFFFFF' : T.ink2; ctx.fillText(r.name, r.label[0], r.label[1]); }
        if (done) { if (labels) tick(ctx, r.label[0] + ctx.measureText(r.name).width / 2 + 26, r.label[1] - 12, 16, T); else tick(ctx, 449, 632, 16, T); }
        return;
      }
      var fit = fitLabel(r, labels, done);
      if (labels) {
        // No outline effect: dark ink on bright fills, light ink on dark ones.
        var bright = blend ? LV[i] > 0 : LV[i] >= 2;
        ctx.fillStyle = bright ? T.onFull : LV[i] ? '#FFFFFF' : T.ink2;
        ctx.font = '400 ' + fit.fs + 'px Anton, sans-serif';
        fit.lines.forEach(function (txt, k) { ctx.fillText(txt, fit.x, fit.base[k]); });
      }
      if (done) tick(ctx, fit.x, fit.tickY, 16, T);
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
  // Only what happened makes the card: a stat that is still 0 is left out, so a recap never reads as empty.
  function wrappedStats() {
    var best = longestStreak(), done100 = levels.filter(function (l) { return l === 3; }).length, lines = bingoLines();
    var out = [[done100 + '/6', tr('regions finished'), done100 ? 'done' : '']];
    if (best) out.push([String(best), best === 1 ? tr('day best streak') : tr('days best streak')]);
    if (dailyDone.length) out.push([String(dailyDone.length), dailyDone.length === 1 ? tr('dare done') : tr('dares done')]);
    if (lines) out.push([String(lines), lines === 1 ? tr('bingo line') : tr('bingo lines')]);
    return out;
  }
  function statCell(ctx, T, st, x, y, w, vs, ls) {
    ctx.fillStyle = st[2] === 'done' ? T.done : T.ink;
    fitText(ctx, st[0], w - 24, vs, '400 {s}px Anton, sans-serif'); ctx.fillText(st[0], x, y);
    ctx.fillStyle = T.ink2; fitText(ctx, st[1], w - 24, ls, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(st[1], x + 2, y + ls * 1.4);
  }
  function wrappedHead(ctx, T, x, y, size) {
    size = fitText(ctx, tr('Leonida') + ' ' + tr('Wrapped'), 1080 - 128, size, '400 {s}px Anton, sans-serif');
    ctx.fillStyle = T.ink; ctx.font = '400 ' + size + 'px Anton, sans-serif';
    var a = tr('Leonida'); ctx.fillText(a, x, y);
    var aw = ctx.measureText(a + ' ').width;
    ctx.fillStyle = T.accent; ctx.fillText(tr('Wrapped'), x + aw, y);
  }
  function wrappedSub() { return cardName(); }
  function wrappedGrid(ctx, T, st, x, y, cw, rh, vs, ls) {
    st.forEach(function (c, k) { statCell(ctx, T, c, x + (k % 2) * cw, y + Math.floor(k / 2) * rh, cw, vs, ls); });
  }
  function drawWrappedSquare(ctx, T, W, H) {
    var n = steps(), p = pctOf(n), st = wrappedStats();
    scene(ctx, T, W, H, 700, 806, 196);
    topRow(ctx, T, W, 64, 44);
    lift(ctx, true);
    wrappedHead(ctx, T, 60, 236, 100);
    ctx.fillStyle = T.ink2; fitText(ctx, wrappedSub(), W - 128, 36, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(wrappedSub(), 64, 296);
    bigPct(ctx, T, p, 54, 530, 520, 220, p === 100 ? T.done : T.ink);
    ctx.fillStyle = T.ink2; ctx.font = '600 38px "DM Sans", sans-serif'; ctx.fillText(tr('of Leonida seen'), 64, 592);
    ctx.fillStyle = T.sun[0]; fitText(ctx, rank(n), 500, 70, '400 {s}px Anton, sans-serif'); ctx.fillText(rank(n), 62, 680);
    lift(ctx, false);
    drawMap(ctx, T, 592, 606, 0.7, null);
    wrappedGrid(ctx, T, st, 64, 812, 250, 160, 72, 30);
    dare(ctx, T, W, H, 0, tr('Get your Leonida Wrapped'));
    grain(ctx, W, H);
  }
  function drawWrappedStory(ctx, T, W, H) {
    var n = steps(), p = pctOf(n), st = wrappedStats();
    scene(ctx, T, W, H, 990, 806, 220);
    topRow(ctx, T, W, 250, 52);
    lift(ctx, true);
    wrappedHead(ctx, T, 58, 450, 128);
    ctx.fillStyle = T.ink2; fitText(ctx, wrappedSub(), W - 128, 42, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(wrappedSub(), 64, 522);
    bigPct(ctx, T, p, 54, 800, 520, 280, p === 100 ? T.done : T.ink);
    ctx.fillStyle = T.ink2; ctx.font = '600 46px "DM Sans", sans-serif'; ctx.fillText(tr('of Leonida seen'), 64, 870);
    ctx.fillStyle = T.sun[0]; fitText(ctx, rank(n), 500, 84, '400 {s}px Anton, sans-serif'); ctx.fillText(rank(n), 62, 966);
    lift(ctx, false);
    drawMap(ctx, T, 572, 880, 0.74, null);
    wrappedGrid(ctx, T, st, 64, 1120, 250, 168, 84, 34);
    dare(ctx, T, W, H, 0, tr('Get your Leonida Wrapped'));
    grain(ctx, W, H);
  }

  // Leonida Blend: your map and a friend's (from their challenge link) on one card. Your colour is you, gold is them,
  // stripes of both are the regions you share.
  function blendStats() {
    var cover = 0, diff = 0;
    levels.forEach(function (m, i) { cover += Math.max(m, rival.levels[i]); diff += Math.abs(m - rival.levels[i]); });
    var mine = steps(), theirs = rival.levels.reduce(function (a, b) { return a + b; }, 0);
    return { cover: pctOf(cover), match: Math.round(100 - diff / 18 * 100), carry: mine === theirs ? 0 : mine > theirs ? 1 : -1 };
  }
  function blendMe() { return (settings.tag || '').trim() || tr('You'); }
  function blendCarry(st) { return st.carry === 0 ? tr('Dead even') : tr('{name} carried', { name: st.carry > 0 ? blendMe() : rival.name }); }
  function blendKey(ctx, T, x, y, size, maxW) {
    var keyFill = [[T.accent, blendMe()], [T.done, rival.name], [stripes(ctx, T.accent, T.done, 14), tr('Both of you')]];
    keyFill.forEach(function (l, k) {
      var ky = y + k * size * 1.6;
      roundRect(ctx, x, ky - size * 0.82, size, size, 6); ctx.fillStyle = l[0]; ctx.fill();
      ctx.fillStyle = T.ink2; fitText(ctx, l[1], maxW - size - 14, size, '600 {s}px "DM Sans", sans-serif');
      ctx.fillText(l[1], x + size + 14, ky);
    });
  }
  function blendHead(ctx, T, W, y, size, pairSize) {
    size = fitText(ctx, tr('Leonida') + ' ' + tr('Blend'), W - 128, size, '400 {s}px Anton, sans-serif');
    ctx.fillStyle = T.ink; ctx.font = '400 ' + size + 'px Anton, sans-serif';
    var a = tr('Leonida'); ctx.fillText(a, 60, y);
    ctx.fillStyle = T.accent; ctx.fillText(tr('Blend'), 60 + ctx.measureText(a + ' ').width, y);
    var pair = blendMe() + '  ×  ' + rival.name;
    ctx.fillStyle = T.ink2; fitText(ctx, pair, W - 128, pairSize, '600 {s}px "DM Sans", sans-serif'); ctx.fillText(pair, 64, y + pairSize * 1.5);
  }
  function drawBlendSquare(ctx, T, W, H) {
    var st = blendStats();
    scene(ctx, T, W, H, 700, 806, 196);
    topRow(ctx, T, W, 64, 44);
    lift(ctx, true);
    blendHead(ctx, T, W, 236, 100, 40);
    bigPct(ctx, T, st.cover, 54, 520, 500, 200, T.ink);
    ctx.fillStyle = T.ink2; fitText(ctx, tr('of Leonida covered together'), 500, 36, '600 {s}px "DM Sans", sans-serif');
    ctx.fillText(tr('of Leonida covered together'), 64, 580);
    ctx.fillStyle = T.sun[0]; fitText(ctx, blendCarry(st), 500, 68, '400 {s}px Anton, sans-serif'); ctx.fillText(blendCarry(st), 62, 672);
    lift(ctx, false);
    drawMap(ctx, T, 592, 606, 0.7, { mine: levels, theirs: rival.levels });
    statCell(ctx, T, [st.match + '%', tr('map match')], 64, 820, 480, 72, 32);
    blendKey(ctx, T, 64, 960, 32, 480);
    dare(ctx, T, W, H, 0, tr('Blend with me'));
    grain(ctx, W, H);
  }
  function drawBlendStory(ctx, T, W, H) {
    var st = blendStats();
    scene(ctx, T, W, H, 990, 806, 220);
    topRow(ctx, T, W, 250, 52);
    lift(ctx, true);
    blendHead(ctx, T, W, 450, 128, 48);
    bigPct(ctx, T, st.cover, 54, 800, 520, 280, T.ink);
    ctx.fillStyle = T.ink2; fitText(ctx, tr('of Leonida covered together'), 520, 44, '600 {s}px "DM Sans", sans-serif');
    ctx.fillText(tr('of Leonida covered together'), 64, 866);
    ctx.fillStyle = T.sun[0]; fitText(ctx, blendCarry(st), 500, 84, '400 {s}px Anton, sans-serif'); ctx.fillText(blendCarry(st), 62, 962);
    lift(ctx, false);
    drawMap(ctx, T, 572, 880, 0.74, { mine: levels, theirs: rival.levels }, { labels: true });
    statCell(ctx, T, [st.match + '%', tr('map match')], 64, 1110, 480, 84, 36);
    blendKey(ctx, T, 64, 1262, 34, 480);
    dare(ctx, T, W, H, 0, tr('Blend with me'));
    grain(ctx, W, H);
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

  // The file people share: always painted fresh at full 2x quality with the grain, whatever the preview shows.
  function cardBlob() {
    return new Promise(function (resolve, reject) {
      var cv = document.createElement('canvas');
      exporting = true;
      try { paint(cv, 2); } catch (e) { exporting = false; reject(e); return; }
      exporting = false;
      cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('no image')); }, 'image/png');
    });
  }
  function fileName() { return settings.kind === 'blend' && rival ? 'leonida-blend.png' : settings.kind === 'wrapped' ? 'leonida-wrapped.png' : 'leonida-' + score() + '-percent.png'; }

  function challengeUrl() {
    var u = SITE + '?c=' + code();
    var t = (settings.tag || '').trim();
    if (t) u += '&n=' + encodeURIComponent(t);
    var b = boardString(board);
    if (b) u += '&b=' + encodeURIComponent(b);
    return u;
  }
  function shareText() {
    if (settings.kind === 'blend' && rival) {
      var b = blendStats();
      return tr('Our Leonida Blend with {name}: {c}% covered together, {m}% match. Blend with me:', { name: rival.name, c: b.cover, m: b.match });
    }
    if (settings.kind === 'wrapped') return tr('My Leonida Wrapped: {n}% seen, {rank}. Get yours:', { n: score(), rank: rank() });
    return tr('{n}% of Leonida seen. I play like a {style}. Can you beat me?', { n: score(), style: playstyle() });
  }

  function download(blob) { downloadAs(blob, fileName()); }
  function downloadAs(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
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
        var data = { files: [file], title: tr('My Leonida card'), text: shareText() + ' ' + challengeUrl() };
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
      }).catch(function () { status(tr('The card could not be made in this browser. Try another browser.')); })
        .then(function () { btn.disabled = false; });
    });
    $('download').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      cardBlob().then(function (b) { download(b); status(tr('Card downloaded:') + ' ' + fileName()); showThanks(); },
        function () { status(tr('The card could not be made in this browser. Try another browser.')); })
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
    // Open in wallet: a bitcoin: link always means BTC on the Bitcoin network, and the phone offers the wallet apps
    // that accept it. Many apps (exchanges included) don't take these links, so the address is copied first, and if no
    // wallet opens, the next step is shown instead of nothing happening.
    var wallet = $('wallet-open'), help = $('wallet-help');
    if (wallet && help) wallet.addEventListener('click', function () {
      var left = false, addr = wallet.getAttribute('href').replace(/^bitcoin:/, '').split('?')[0];
      function away() { left = true; }
      window.addEventListener('blur', away, { once: true });
      document.addEventListener('visibilitychange', away, { once: true });
      help.hidden = true;
      copy(addr).then(function () { return true; }, function () { return false; }).then(function (copied) {
        setTimeout(function () {
          window.removeEventListener('blur', away); document.removeEventListener('visibilitychange', away);
          if (left || document.hidden) return;
          help.textContent = tr(copied ? 'No wallet app opened. The address is copied: open your wallet, tap Send, choose Bitcoin (BTC) as the coin and the Bitcoin network, then paste.'
            : 'No wallet app opened. Copy the address above, then in your wallet tap Send, choose Bitcoin (BTC) and the Bitcoin network, and paste it.');
          help.hidden = false;
        }, 1500);
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
    if (!$('map')) { bindCheats(); bindHundred(); bindChapterOne(); return; } // cheat, checklist and help pages
    buildMap(); bindList(); bindPick(); bindBackup(); bindSettings(); bindAlias(); bindBingo(); bindRemind(); bindDaily(); bindTipped(); bindCheats(); bindActions(); bindBoard(); readChallenge(); bindRematch();
    if (steps() > 0) touched = true;
    buildBingo(); renderDaily(); renderTipped(); renderAlias(); render();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderDaily(); });
    // The preview is painted for its on-screen size, so repaint it after a rotation or resize (at most once per frame).
    window.addEventListener('resize', function () { drawSoon(); });
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
      }, { rootMargin: '1200px 0px' }).observe(cv);
    } else { cardVisible = true; drawSoon(); }
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('400 40px Anton'), document.fonts.load('600 20px "DM Sans"')]).then(drawSoon, drawSoon);
    }
  }
  function boot() {
    if (LANG === 'en' || window.VCH_I18N) { start(); return; }
    var sc = document.createElement('script');
    sc.src = '/hub/i18n.js?v=20261120h'; sc.onload = start; sc.onerror = start;
    document.head.appendChild(sc);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
