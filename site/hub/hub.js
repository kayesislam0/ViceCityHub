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
  // other positions (Port Gellhorn west, Vice City southeast, Grassrivers southwest, the Keys south) follow fan maps. viewBox 600 x 740. Order matches the list in index.html.
  var REGIONS = [
    { id: 'kalaga', name: 'Mount Kalaga', full: 'Mount Kalaga National Park', label: [300, 104],
      d: 'M30 62L190 48L360 56L562 50L566 150L470 168L360 176L250 170L150 150L60 142Z' },
    { id: 'gellhorn', name: 'Port Gellhorn', full: 'Port Gellhorn', label: [212, 238], two: true,
      d: 'M150 150L250 170L300 230L290 330L250 360L218 300L184 236L128 178Z' },
    { id: 'ambrosia', name: 'Ambrosia', full: 'Ambrosia', label: [345, 228],
      d: 'M250 170L360 176L420 230L430 340L370 400L290 330L300 230Z' },
    { id: 'vice', name: 'Vice City', full: 'Vice City', label: [505, 318],
      d: 'M360 176L470 168L566 150L572 300L562 440L544 556L482 560L452 450L430 340L420 230Z' },
    { id: 'grass', name: 'Grassrivers', full: 'Grassrivers', label: [384, 506],
      d: 'M250 360L290 330L370 400L430 340L452 450L482 560L544 556L502 608L412 622L332 592L292 522L266 440Z' },
    { id: 'keys', name: 'Leonida Keys', full: 'Leonida Keys', label: [190, 690],
      hit: 'M112 642L512 628L516 724L112 724Z',
      d: ellipse(474, 652, 28, 10) + ellipse(424, 672, 24, 9) + ellipse(376, 688, 22, 9) + ellipse(328, 699, 20, 8) + ellipse(282, 707, 18, 8) }
  ];
  var LAKE = ellipse(368, 296, 24, 34);

  var THEMES = {
    night:   { bg: '#0E1311', bg2: '#0E1311', sea: '#10232A', grid: 'rgba(244,241,234,.06)', ink: '#F4F1EA', ink2: '#B4BDB8', accent: '#FF5FA2', edge: '#0E1311',
               fill: ['#26302B', '#3E2B40', '#5E2F55', '#7D3B62'], onFull: '#0E1311', lake: '#10232A', darkFrom: 4, done: '#FFC35A' },
    sunset:  { bg: '#2A0F22', bg2: '#5E1F2C', sea: '#3A1630', grid: 'rgba(255,214,170,.07)', ink: '#FFF3E4', ink2: '#F2C9B0', accent: '#FFC35A', edge: '#2A0F22',
               fill: ['#47243A', '#8A3A3E', '#D46A3C', '#FFC35A'], onFull: '#2A0F22', lake: '#3A1630', darkFrom: 3, done: '#FFF3E4' },
    highway: { bg: '#0B6B3A', bg2: '#0B6B3A', sea: '#095A31', grid: 'rgba(255,255,255,.07)', ink: '#FFFFFF', ink2: '#D6EEDF', accent: '#FFFFFF', edge: '#0B6B3A',
               fill: ['#0F7F46', '#3E9A68', '#9FCDB2', '#FFFFFF'], onFull: '#0B6B3A', lake: '#095A31', darkFrom: 2, done: '#FFC35A' }
  };
  // Dusk to deep berry: each step reads as progress, and a finished region is calm to look at, with a gold edge as the reward.
  var MAP_FILL = ['#26302B', '#3E2B40', '#5E2F55', '#7D3B62'];

  // Ranks by steps (6 regions x 3 levels = 18).
  var RANKS = [[0, 'Still in the menu'], [1, 'Tourist'], [4, 'Local'], [9, 'Hustler'], [13, 'Kingpin'], [18, 'Leonida legend']];

  // ---- storage (may be blocked: private mode, embedded previews) ----
  function load(key, fallback) { try { var v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* nothing to do */ } }

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
  function rank(n) { return RANKS[rankIndex(n === undefined ? steps() : n)][1]; }

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
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); deeper(i); }
      });
      groups.push(g);
    });
    lakeEl = el('path', { d: LAKE, fill: '#0F1F25', stroke: '#0E1311', 'stroke-width': 3, 'pointer-events': 'none' }, svg);
    el('text', { x: 368, y: 300, 'text-anchor': 'middle', fill: '#8FB3BF', 'font-size': 12, 'font-family': 'DM Sans, sans-serif', 'font-weight': 600, 'pointer-events': 'none' }, svg).textContent = 'Lake';
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
    if (levels[i] === 3) { toast(REGIONS[i].full + ' is already 100%. To lower it, use the list.'); return; }
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
      toast(after === 18 ? 'Rank up: Leonida legend. You have seen it all.' : 'Rank up: ' + rank(after) + '. ' + score() + '% of Leonida seen.');
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
      labels[i].querySelector('.lvl').textContent = lvl ? LEVELS[lvl] : (start ? 'Tap to start' : '');
      g.classList.toggle('start', start);
      if (start && g.nextSibling !== lakeEl) g.parentNode.insertBefore(g, lakeEl); // dashed outline drawn above its neighbours
      g.setAttribute('aria-label', REGIONS[i].full + ', ' + LEVELS[lvl] + '. Select to raise the level.');
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
    pctEl.textContent = p + '% seen';
    drawRoute();
    $('rank').textContent = RANKS[ri][1];
    $('meter-sub').textContent = visited() + ' of 6 regions · ' + n + ' of 18 steps';
    var next = RANKS[ri + 1];
    var from = RANKS[ri][0];
    $('xp').style.transform = 'scaleX(' + (next ? (n - from) / (next[0] - from) : 1) + ')';
    $('next-rank').textContent = next ? (next[0] - n) + (next[0] - n === 1 ? ' step' : ' steps') + ' to ' + next[1] : 'Every region done. Respect.';
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
    var n = (q.get('n') || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || 'Your friend';
    rival = { name: n, pct: pctOf(t) };
    $('challenge-name').textContent = n;
    $('challenge-score').textContent = rival.pct + '%';
    $('challenge').hidden = false;
  }
  function updateChallenge() {
    if (!rival) return;
    var mine = score();
    $('challenge-you').textContent = mine + '%';
    $('challenge-msg').textContent = mine === 0 ? 'Mark your regions and beat their score.'
      : mine < rival.pct ? (rival.pct - mine) + ' points behind ' + rival.name + '. Keep going.'
      : mine === rival.pct ? 'Dead even with ' + rival.name + '. One more step wins it.'
      : 'You beat ' + rival.name + '. Make your card and send it back.';
    $('challenge').classList.toggle('is-winning', mine > rival.pct);
  }

  // ---- card settings ----
  var settings = {
    tag: load('vch.tag', ''),
    platform: load('vch.platform', 'PS5'),
    theme: load('vch.theme', 'night'),
    dayone: load('vch.dayone', Date.now() < Date.UTC(2026, 10, 22) ? '1' : '0') === '1',
    useAlias: load('vch.useAlias', '0') === '1',
    aliasRoll: Number(load('vch.aliasRoll', '0')) || 0
  };
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
      known: 'Known for ' + ALIAS_KNOWN[(h >>> 8) % 16] + '.'
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
      copy('My Leonida street name: ' + a.name + '. ' + a.known + ' Get yours: ' + SITE).then(
        function () { toast('Street name copied. Drop it in the group chat.'); },
        function () { toast('Copy is blocked here. Select the name to copy it.'); });
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
      b.textContent = text;
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
          toast(after === 8 ? 'Blackout. You did it all on night one.' : 'BINGO! ' + after + (after === 1 ? ' line' : ' lines') + '. Copy your board for the chat.');
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
    $('bingo-score').textContent = n ? 'Bingo ×' + n + ' · ' + ticked + ' of 8 ticked' : ticked + ' of 8 ticked · no line yet';
  }
  function bingoText() {
    var rows = [0, 3, 6].map(function (r) {
      return [0, 1, 2].map(function (c) { return bingo.marks[r + c] ? '🟪' : '⬛'; }).join('');
    });
    var n = bingoLines(), ticked = bingo.marks.reduce(function (a, b) { return a + b; }, 0) - 1;
    var who = (settings.tag || '').trim();
    var head = (who ? who + '\'s ' : 'My ') + 'Leonida day-one bingo · ' + settings.platform + ' · ' + (n ? 'Bingo ×' + n : 'no line yet') + ' · ' + ticked + ' of 8 ticked';
    return head + '\n' + rows.join('\n') + '\n' + SITE;
  }
  function bingoStatus(msg) { var s = $('bingo-status'); s.textContent = ''; setTimeout(function () { s.textContent = msg; }, 30); }
  function bindBingo() {
    $('bingo-copy').addEventListener('click', function () {
      copy(bingoText()).then(function () { bingoStatus('Board copied. Paste it in the group chat.'); },
        function () { bingoStatus('Copy is blocked in this browser.'); });
    });
    $('bingo-new').addEventListener('click', function () {
      var undo = { seed: bingo.seed, marks: bingo.marks.slice() };
      bingo.seed = Math.floor(Math.random() * 1e9) + 1;
      bingo.marks = [0, 0, 0, 0, 1, 0, 0, 0, 0];
      save('vch.bingoSeed', String(bingo.seed)); save('vch.bingoMarks', bingo.marks.join(''));
      buildBingo(); drawSoon();
      var st = $('bingo-status');
      st.textContent = 'New board. ';
      var u = document.createElement('button');
      u.type = 'button'; u.className = 'linklike'; u.textContent = 'Undo';
      u.addEventListener('click', function () {
        bingo.seed = undo.seed; bingo.marks = undo.marks;
        save('vch.bingoSeed', String(bingo.seed)); save('vch.bingoMarks', bingo.marks.join(''));
        buildBingo(); drawSoon(); st.textContent = 'Old board back.';
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
    $('daily-day').textContent = 'Day ' + (d + 1) + ' in Leonida';
    $('daily-task').textContent = DAILY[d % DAILY.length];
    $('daily-streak').textContent = (st ? st + '-day streak' : 'No streak yet') + ' · ' + dailyDone.length + ' done in total';
    var b = $('daily-done');
    b.setAttribute('aria-pressed', String(done));
    b.querySelector('span').textContent = done ? 'Done today' : 'I did it';
    b.closest('.daily').classList.toggle('is-done', done);
  }
  function dailyText() {
    var d = dayIndex(), cells = '';
    for (var i = Math.max(0, d - 6); i <= d; i++) cells += dailyDone.indexOf(i) >= 0 ? '🟪' : '⬛';
    var st = streak();
    return 'Leonida Daily · Day ' + (d + 1) + ' · ' + (st ? st + '-day streak' : 'starting my streak') + '\n' + cells + '\n' + SITE;
  }
  function bindDaily() {
    $('daily-done').addEventListener('click', function () {
      var d = dayIndex(), k = dailyDone.indexOf(d);
      if (k >= 0) dailyDone.splice(k, 1); else { dailyDone.push(d); buzz(); toast(streak() > 1 ? streak() + '-day streak. Copy it for the chat.' : 'Done. Come back tomorrow for the next one.'); }
      save('vch.daily', dailyDone.join(','));
      renderDaily();
    });
    $('daily-copy').addEventListener('click', function () {
      var s = $('daily-status');
      copy(dailyText()).then(function () { s.textContent = 'Streak copied. Paste it in the group chat.'; },
        function () { s.textContent = 'Copy is blocked in this browser.'; });
    });
  }

  // ---- "I sent a tip": honour system, adds a gold line to the card ----
  var tipped = load('vch.tipped', '') === '1';
  function renderTipped() {
    var b = $('tipped-btn');
    b.setAttribute('aria-pressed', String(tipped));
    b.querySelector('span').textContent = tipped ? 'Thank you!' : 'I sent a tip';
    $('tipped-msg').textContent = tipped
      ? 'You kept the hub running. Your map card now says "Backed the hub" in gold. Tap again to remove it.'
      : 'Sent one? Tap this and your map card gets a gold "Backed the hub" line. We don\'t check, we trust you.';
  }
  function bindTipped() {
    $('tipped-btn').addEventListener('click', function () {
      tipped = !tipped; save('vch.tipped', tipped ? '1' : '');
      if (tipped) { buzz(); toast('Thank you. That keeps the lights on in Leonida.'); }
      renderTipped(); drawSoon();
    });
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

    ctx.fillStyle = T.ink2;
    ctx.font = '600 38px "DM Sans", sans-serif';
    ctx.fillText('Greetings from', 64, 112);
    ctx.fillStyle = T.ink;
    ctx.font = '400 196px Anton, sans-serif';
    ctx.fillText('LEONIDA', 56, 304);

    // The card map uses the same layers as the page map: sea, stipple, grid, coastal shelf, fog of war, route, compass.
    ctx.save();
    ctx.translate(44, 344); ctx.scale(0.96, 0.96);
    roundRect(ctx, 0, 0, 600, 740, 22); ctx.fillStyle = T.sea; ctx.fill();
    ctx.save(); roundRect(ctx, 0, 0, 600, 740, 22); ctx.clip();
    var stip = patternTile(14, function (p) { p.fillStyle = 'rgba(143,179,191,.22)'; p.beginPath(); p.arc(3, 3, 1.2, 0, Math.PI * 2); p.fill(); });
    if (stip) { ctx.fillStyle = stip; ctx.fillRect(0, 0, 600, 740); }
    ctx.strokeStyle = T.grid; ctx.lineWidth = 1;
    for (var x = 50; x < 600; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 740); ctx.stroke(); }
    for (var y = 50; y < 740; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke(); }
    REGIONS.forEach(function (r) { // coastal shelf
      var sp = new Path2D(r.d);
      ctx.fillStyle = 'rgba(143,179,191,.10)'; ctx.fill(sp);
      ctx.strokeStyle = 'rgba(143,179,191,.22)'; ctx.lineWidth = 30; ctx.lineJoin = 'round'; ctx.stroke(sp);
    });
    ctx.restore();
    var fog = patternTile(12, function (p) { p.strokeStyle = 'rgba(244,241,234,.16)'; p.lineWidth = 3; p.beginPath(); p.moveTo(-2, 14); p.lineTo(14, -2); p.stroke(); p.beginPath(); p.moveTo(-2, 2); p.lineTo(2, -2); p.stroke(); p.beginPath(); p.moveTo(10, 14); p.lineTo(14, 10); p.stroke(); });
    REGIONS.forEach(function (r, i) {
      var path = new Path2D(r.d);
      ctx.fillStyle = T.fill[levels[i]]; ctx.fill(path);
      if (levels[i]) { var sh = ctx.createLinearGradient(0, 40, 0, 720); sh.addColorStop(0, 'rgba(255,255,255,.10)'); sh.addColorStop(1, 'rgba(0,0,0,.14)'); ctx.fillStyle = sh; ctx.fill(path); }
      if (!levels[i] && fog) { ctx.fillStyle = fog; ctx.fill(path); }
      ctx.strokeStyle = T.edge; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke(path);
      if (levels[i] === 2) { ctx.strokeStyle = T.accent; ctx.lineWidth = 3; ctx.stroke(path); }
      if (levels[i] === 3) { ctx.strokeStyle = T.done; ctx.lineWidth = 4; ctx.stroke(path); }
    });
    var lake = new Path2D(LAKE);
    ctx.fillStyle = T.lake; ctx.fill(lake); ctx.strokeStyle = T.edge; ctx.lineWidth = 4; ctx.stroke(lake);
    // your route
    var pts = [];
    levels.forEach(function (l, i) { if (l) pts.push(anchorOf(REGIONS[i])); });
    if (pts.length > 1) {
      ctx.save(); ctx.strokeStyle = T.accent; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.setLineDash([1, 12]);
      ctx.beginPath(); pts.forEach(function (p, k) { k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke(); ctx.restore();
    }
    pts.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, Math.PI * 2); ctx.fillStyle = T.sea; ctx.fill(); ctx.strokeStyle = T.accent; ctx.lineWidth = 3.5; ctx.stroke(); });
    // labels above the route, outlined so they read at feed size
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    REGIONS.forEach(function (r, i) {
      var dark = levels[i] >= T.darkFrom && r.id !== 'keys';
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
    ctx.fillStyle = T.ink; ctx.font = '600 14px "DM Sans", sans-serif'; ctx.fillText('N', 0, -32);
    ctx.restore();
    ctx.restore();
    ctx.textAlign = 'left';

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
    ctx.fillText('of Leonida seen', cx + 4, 650);
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

    var tag = (settings.tag || '').trim() || 'Player one';
    var title = settings.useAlias ? alias().name : tag;
    ctx.fillStyle = T.ink;
    fitText(ctx, title, W - 128, 84, '400 {s}px Anton, sans-serif');
    ctx.fillText(title, 64, 1196);
    ctx.fillStyle = T.ink2;
    ctx.font = '600 32px "DM Sans", sans-serif';
    var lines = bingoLines();
    ctx.fillText('Plays on ' + settings.platform + ' · GTA VI' + (lines ? ' · Bingo ×' + lines : ''), 64, 1246);
    if (tipped) { var pw = ctx.measureText('Plays on ' + settings.platform + ' · GTA VI' + (lines ? ' · Bingo ×' + lines : '') + ' · ').width; var fs = ctx.fillStyle; ctx.fillStyle = '#FFC35A'; ctx.fillText(' · Backed the hub', 64 + pw - ctx.measureText(' · ').width, 1246); ctx.fillStyle = fs; }

    ctx.fillStyle = T.accent;
    ctx.fillRect(0, H - 64, W, 64);
    ctx.fillStyle = T.onFull;
    ctx.font = '600 30px "DM Sans", sans-serif';
    ctx.fillText('How much have you seen? vicecityhub.okenshop.com', 64, H - 22);

    if (settings.dayone) stamp(ctx, 940, 170, T);
  }

  function stamp(ctx, x, y, T) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.21);
    ctx.strokeStyle = T.accent; ctx.fillStyle = T.accent;
    ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '400 48px Anton, sans-serif'; ctx.fillText('DAY ONE', 0, 12);
    ctx.font = '600 20px "DM Sans", sans-serif'; ctx.fillText('19 NOV 2026', 0, 44);
    ctx.fillText('LEONIDA', 0, -38);
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
  function fileName() { return 'leonida-' + score() + '-percent.png'; }

  function challengeUrl() {
    var u = SITE + '?c=' + code();
    var t = (settings.tag || '').trim();
    if (t) u += '&n=' + encodeURIComponent(t);
    return u;
  }
  function shareText() { return 'I have seen ' + score() + '% of Leonida (' + rank() + '). How much have you seen?'; }

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
          return navigator.share(data).then(function () { status('Shared. Now see if your crew can beat it.'); showThanks(); }, function (e) {
            if (e && e.name === 'AbortError') return;
            download(blob); status('Sharing is blocked here, so the card was downloaded instead.'); showThanks();
          });
        }
        download(blob); showThanks();
        return copy(shareText() + ' ' + challengeUrl()).then(
          function () { status('Card downloaded and the challenge text copied. Post both.'); },
          function () { status('Card downloaded. Post it with your challenge link.'); });
      }).catch(function () { status('The card could not be made in this browser. Try another browser.'); })
        .then(function () { btn.disabled = false; });
    });
    $('download').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      cardBlob().then(function (b) { download(b); status('Card downloaded: ' + fileName()); showThanks(); },
        function () { status('The card could not be made in this browser. Try another browser.'); })
        .then(function () { btn.disabled = false; });
    });
    $('copy-link').addEventListener('click', function () {
      copy(shareText() + ' ' + challengeUrl()).then(function () { status('Challenge copied. Paste it in your group chat.'); showThanks(); },
        function () { status('Copy is blocked here. Your link: ' + challengeUrl()); });
    });
    document.querySelectorAll('[data-copy]').forEach(function (b) {
      var label = b.textContent;
      b.addEventListener('click', function () {
        copy(b.dataset.copy).then(function () { b.textContent = b.dataset.done || 'Copied'; },
          function () { b.textContent = 'Select the address above to copy'; })
          .then(function () { setTimeout(function () { b.textContent = label; }, 2500); });
      });
    });
    $('reset').addEventListener('click', function () {
      levels = [0, 0, 0, 0, 0, 0]; save('vch.map', code()); render(); toast('Map cleared.');
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
      ? 'Out in every PlayStation Store region with a listed time.'
      : out.length ? 'Out in ' + out.length + ' of these ' + rows.length + ' windows: ' + out.map(function (r) { return r.place; }).join(', ') + '.'
      : 'Not out anywhere yet. New Zealand goes first.';
    var youLabel = mine === NA_ET ? 'You (USA and Canada window)' : 'Midnight where you are';
    var list = soon.concat([{ place: youLabel, t: mine, you: true }]).sort(function (a, b) { return a.t - b.t || (a.you ? -1 : 1); });
    var frag = document.createDocumentFragment();
    list.forEach(function (r) {
      var li = document.createElement('li');
      var live = now >= r.t;
      li.className = (live ? 'is-live' : '') + (r.you ? ' is-you' : '');
      var a = document.createElement('span'); a.className = 'place'; a.textContent = r.place;
      var b = document.createElement('span'); b.className = 'when';
      b.textContent = live ? 'Out since ' + fmtTime(r.t) : 'In ' + fmtLeft(r.t - now) + ' · ' + fmtTime(r.t);
      li.appendChild(a); li.appendChild(b); frag.appendChild(li);
    });
    ul.textContent = ''; ul.appendChild(frag);
    Array.prototype.forEach.call(document.querySelectorAll('.markets .when[data-at]'), function (el) {
      var t = Date.parse(el.getAttribute('data-at'));
      el.textContent = now >= t ? 'Out since ' + fmtTime(t) : 'In ' + fmtLeft(t - now) + ' · ' + fmtTime(t);
      el.parentNode.parentNode.className = now >= t ? 'is-live' : '';
    });
    $('live-line').textContent = now >= LAST ? 'GTA VI is out in every listed store. Leonida is open.'
      : now >= mine ? (mine === NA_ET ? 'The USA and Canada window is open. Leonida is open.' : 'It’s past midnight where you are. If your store region matches, Leonida is open.')
      : (mine === NA_ET ? 'The USA and Canada window opens in ' : 'Midnight where you are is in ') + fmtLeft(mine - now) + '. Plan your route now.';
  }

  // ---- start ----
  function start() {
    buildMap(); bindList(); bindSettings(); bindAlias(); bindBingo(); bindDaily(); bindTipped(); bindActions(); readChallenge();
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
