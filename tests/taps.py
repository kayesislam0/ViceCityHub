"""Tap and untap every control on the hub, as a phone (real touch taps), a tablet and a desktop (mouse clicks):
map regions, the level picker and undo, the region list, card options, street name, bingo (both sizes), the daily dare
and its history, the tip toggle, copy and share buttons, backup files, clearing the map, and the cheat code ticks.
Every control is scrolled to the middle of the screen and checked for anything covering it before it is tapped.

    python3 tests/taps.py                      English
    python3 tests/taps.py "?lang=es&c=233101&n=Mia"   Spanish, opened from a friend's challenge link
"""
import asyncio, http.server, socketserver, threading, functools, sys, pathlib, tempfile, os

SITE = str(pathlib.Path(__file__).resolve().parent.parent / 'site')
QUERY = sys.argv[1] if len(sys.argv) > 1 else ''
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(H, directory=SITE))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/'

fails = []; count = [0]
def check(ok, what):
    count[0] += 1
    if not ok: fails.append(what); print('FAIL', what)

INTERIOR = """(i) => {
  const svg = document.getElementById('map');
  const g = svg.querySelector('.rg[data-i="' + i + '"]');
  const p = g.querySelector('.hit') || g.querySelector('.shape');
  const bb = p.getBBox(), pt = svg.createSVGPoint();
  const inside = (x, y) => { pt.x = x; pt.y = y; return p.isPointInFill(pt); };
  let best = null, bestD = -1;
  for (let y = bb.y; y < bb.y + bb.height; y += 5) for (let x = bb.x; x < bb.x + bb.width; x += 5) {
    if (!inside(x, y)) continue;
    let d = 0; while (d < 60 && inside(x + d, y) && inside(x - d, y) && inside(x, y + d) && inside(x, y - d)) d += 3;
    if (d > bestD) { bestD = d; best = [x, y]; }
  }
  pt.x = best[0]; pt.y = best[1];
  return [pt.x, pt.y];
}"""
TO_SCREEN = """([x, y]) => {
  const svg = document.getElementById('map'), pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
  let s = pt.matrixTransform(svg.getScreenCTM());
  window.scrollBy(0, s.y - innerHeight / 2);
  s = pt.matrixTransform(svg.getScreenCTM());
  return [s.x, s.y];
}"""

async def tap(pg, mob, x, y):
    if mob: await pg.touchscreen.tap(x, y)
    else: await pg.mouse.click(x, y)
    await pg.wait_for_timeout(60)

async def tap_el(pg, mob, sel):
    """Scroll the element to the middle of the screen, make sure nothing covers it, then tap its centre."""
    box = await pg.evaluate("""(sel) => { const e = document.querySelector(sel); if (!e) return null;
      e.scrollIntoView({ block: 'center' });
      // Sticky things (the desktop map) move with the page: nudge until the control really sits mid-screen, like a person scrolling.
      for (let k = 0; k < 4; k++) { const q = e.getBoundingClientRect(); const off = q.top + q.height / 2 - innerHeight / 2; if (Math.abs(off) < 40) break; window.scrollBy(0, off); }
      const r = e.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y);
      const ok = t && (e === t || e.contains(t) || (e.control && e.control === t) || (t.control && t.control === e) || (e.tagName === 'INPUT' && t === e.closest('label')));
      return [x, y, ok, t ? (t.id || t.className || t.tagName) : 'none']; }""", sel)
    if box is None: check(False, f'missing element {sel}'); return
    check(box[2], f'{sel} is covered by {box[3]}')
    await tap(pg, mob, box[0], box[1])

async def run(b, w, mob):
    tag = f'{w}px'
    ctx = await b.new_context(viewport={'width': w, 'height': 844}, has_touch=mob, is_mobile=mob)
    await ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script("""Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });""")
    await pg.goto(BASE + QUERY); await pg.add_style_tag(content='html{scroll-behavior:auto!important}'); await pg.wait_for_timeout(300)
    mapv = lambda: pg.evaluate("localStorage.getItem('vch.map') || '000000'")

    # Map: four taps on each region go 1, 2, 3 and stay at 3; the picker brings it back to Not seen.
    for i in range(6):
        p = await pg.evaluate(INTERIOR, i)
        seq = []
        for k in range(4):
            sx, sy = await pg.evaluate(TO_SCREEN, p)
            hit = await pg.evaluate(f"(() => {{ const e = document.elementFromPoint({sx}, {sy}); const g = e && e.closest('.rg'); return g ? g.dataset.i : (e ? (e.id || e.getAttribute('class') || e.tagName) : 'none'); }})()")
            check(hit == str(i), f'{tag} map region {i}: tap lands on {hit}')
            await tap(pg, mob, sx, sy)
            seq.append((await mapv())[i])
        check(seq == ['1', '2', '3', '3'], f'{tag} map region {i}: taps gave {seq}')
        check(await pg.evaluate(f"document.getElementById('pick-name').textContent") != '', f'{tag} picker empty')
        await tap_el(pg, mob, '#pick button[data-k="0"]')
        check((await mapv())[i] == '0', f'{tag} picker Not seen on region {i}')
    # The lake belongs to Ambrosia.
    lake = await pg.evaluate(TO_SCREEN, [368, 296])
    hit = await pg.evaluate(f"(() => {{ const e = document.elementFromPoint({lake[0]}, {lake[1]}); const g = e && e.closest('.rg'); return g ? g.dataset.i : 'none'; }})()")
    check(hit == '2', f'{tag} lake tap lands on {hit}')

    # Picker: every level, on and off.
    for k in ['1', '2', '3', '0', '3', '1']:
        await tap_el(pg, mob, f'#pick button[data-k="{k}"]')
        lv = await pg.evaluate("(() => { const n = document.getElementById('pick-name').textContent; return n; })()")
        pressed = await pg.evaluate("[...document.querySelectorAll('#pick button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.k).join()")
        check(pressed == k, f'{tag} picker pressed {pressed} after {k}')

    # List: open it, set every level of every row, tapping the current level keeps it.
    await tap_el(pg, mob, 'details.list-toggle > summary')
    for r in range(1, 7):
        for k in ['3', '3', '1', '0', '0', '2']:
            await tap_el(pg, mob, f'#region-list li:nth-child({r}) button[data-k="{k}"]')
            got = await pg.evaluate(f"(() => {{ const li = document.querySelector('#region-list li:nth-child({r})'); return li.dataset.level + '|' + [...li.querySelectorAll('button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.k).join(); }})()")
            check(got == f'{k}|{k}', f'{tag} list row {r} level {k} shows {got}')
    # Keyboard on the map: Enter raises, arrows move focus.
    if not mob:
        await pg.evaluate("document.querySelector('#map .rg[data-i=\"0\"]').focus()")
        before = (await mapv())[0]
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(50)
        check((await mapv())[0] == str(min(3, int(before) + 1)), f'{tag} Enter on a region')
        await pg.keyboard.press('ArrowRight')
        check(await pg.evaluate("document.activeElement.dataset.i") == '1', f'{tag} arrow keys between regions')

    # Card options: every radio and checkbox, on and off.
    await pg.evaluate("document.querySelector('details.more').open = true")
    for name, vals in [('format', ['story', 'square']), ('kind', ['wrapped', 'map']), ('platform', ['Xbox Series', 'PS5']), ('theme', ['sunset', 'highway', 'night'])]:
        for v in vals:
            await tap_el(pg, mob, f'input[name="{name}"][value="{v}"]')
            check(await pg.evaluate(f"document.querySelector('input[name=\"{name}\"][value=\"{v}\"]').checked"), f'{tag} card option {name}={v}')
    for cb in ['#dayone', '#use-alias']:
        for want in [True, False]:
            await tap_el(pg, mob, cb)
            check(await pg.evaluate(f"document.querySelector('{cb}').checked") == want, f'{tag} checkbox {cb} -> {want}')

    # Street name: type, roll, and the output changes.
    await pg.fill('#alias-input', 'Rafi'); a1 = await pg.evaluate("document.getElementById('alias-name').textContent")
    await tap_el(pg, mob, '#alias-roll'); a2 = await pg.evaluate("document.getElementById('alias-name').textContent")
    check(a1 != a2, f'{tag} street name did not change on reroll')
    check(await pg.evaluate("document.getElementById('tag').value") == 'Rafi', f'{tag} street name tag not synced to the card name')

    # Bingo: every square on, then off; the free square never changes.
    for i in range(await pg.evaluate("document.querySelectorAll('#bingo .cell').length")):
        free = await pg.evaluate(f"document.querySelectorAll('#bingo .cell')[{i}].classList.contains('cell--free')")
        for want in ([True, False] if not free else [True, True]):
            await tap_el(pg, mob, f'#bingo .cell:nth-child({i + 1})')
            got = await pg.evaluate(f"document.querySelectorAll('#bingo .cell')[{i}].getAttribute('aria-pressed')")
            check(got == ('true' if want else 'false'), f'{tag} bingo square {i} -> {got}, wanted {want}')
    marks = await pg.evaluate("localStorage.getItem('vch.bingoMarks')")
    check(marks is not None and marks.replace('0', '') in ('1',), f'{tag} bingo marks after on/off: {marks}')
    # New board, then undo.
    seed = await pg.evaluate("localStorage.getItem('vch.bingoSeed')")
    await tap_el(pg, mob, '#bingo-new')
    check(await pg.evaluate("localStorage.getItem('vch.bingoSeed')") != seed, f'{tag} new board')
    await tap_el(pg, mob, '#bingo-status .linklike')
    check(await pg.evaluate("localStorage.getItem('vch.bingoSeed')") == seed, f'{tag} bingo undo')

    # Daily dare: done, undo, done.
    for sel, want in [('#daily-done', True), ('#daily-undo', False), ('#daily-done', True)]:
        await tap_el(pg, mob, sel)
        v = await pg.evaluate("localStorage.getItem('vch.daily') || ''")
        check((v != '') == want, f'{tag} daily {sel} -> {v!r}')

    # Tip toggle on and off.
    for want in ['true', 'false']:
        await tap_el(pg, mob, '#tipped-btn')
        check(await pg.evaluate("document.getElementById('tipped-btn').getAttribute('aria-pressed')") == want, f'{tag} tip toggle {want}')

    # Copy and share buttons say something.
    for sel, out in [('#copy-link', '#card-status'), ('#bingo-copy', '#bingo-status'), ('#daily-copy', '#daily-status')]:
        await tap_el(pg, mob, sel)
        try: await pg.wait_for_function(f"document.querySelector('{out}').textContent.trim() !== ''", timeout=5000); ok = True
        except Exception: ok = False
        check(ok, f'{tag} {sel} gave no feedback')

    # Map undo: change a region twice, undo twice, and the map is back where it was.
    start = await mapv()
    cur = int(await pg.evaluate("[...document.querySelectorAll('#pick .pick__steps button')].find(b => b.getAttribute('aria-pressed') === 'true').dataset.k"))
    await tap_el(pg, mob, f'#pick button[data-k="{(cur + 1) % 4}"]'); await tap_el(pg, mob, f'#pick button[data-k="{(cur + 2) % 4}"]')
    await tap_el(pg, mob, '#map-undo'); await tap_el(pg, mob, '#map-undo')
    check(await mapv() == start, f'{tag} map undo gave {await mapv()} not {start}')

    # Clear my map, then undo it from the message.
    before = await mapv()
    await tap_el(pg, mob, '#reset')
    check(await mapv() == '000000', f'{tag} clear map')
    if before != '000000':
        await tap_el(pg, mob, '#toast .toast__act')
        check(await mapv() == before, f'{tag} clear map undo')
        await tap_el(pg, mob, '#reset')

    # Street name: Previous goes back to the name before the reroll.
    n1 = await pg.evaluate("document.getElementById('alias-name').textContent")
    await tap_el(pg, mob, '#alias-roll'); await tap_el(pg, mob, '#alias-prev')
    check(await pg.evaluate("document.getElementById('alias-name').textContent") == n1, f'{tag} street name Previous')

    # Bingo 5 x 5: every square on and off, and the 3 x 3 ticks survive the size switch.
    await tap_el(pg, mob, '#bingo .cell:nth-child(1)')
    small = await pg.evaluate("localStorage.getItem('vch.bingoMarks')")
    await tap_el(pg, mob, 'input[name="bingo-size"][value="5"]')
    check(await pg.evaluate("document.querySelectorAll('#bingo .cell').length") == 25, f'{tag} 5x5 board has 25 squares')
    for i in range(25):
        free = i == 12
        for want in ([True, False] if not free else [True]):
            await tap_el(pg, mob, f'#bingo .cell:nth-child({i + 1})')
            got = await pg.evaluate(f"document.querySelectorAll('#bingo .cell')[{i}].getAttribute('aria-pressed')")
            check(got == ('true' if want else 'false'), f'{tag} 5x5 square {i} -> {got}')
    for i in [0, 6, 18, 24]: await tap_el(pg, mob, f'#bingo .cell:nth-child({i + 1})')
    check('1 bingo' in await pg.evaluate("document.getElementById('bingo-score').textContent"), f'{tag} 5x5 diagonal bingo not detected')
    await tap_el(pg, mob, 'input[name="bingo-size"][value="3"]')
    check(await pg.evaluate("localStorage.getItem('vch.bingoMarks')") == small, f'{tag} 3x3 ticks lost after switching size')
    check(await pg.evaluate("document.querySelectorAll('#bingo .cell[aria-pressed=\"true\"]').length") == small.count('1'), f'{tag} 3x3 board shows the wrong ticks')

    # Copy image (desktop only).
    if not mob:
        await pg.evaluate("document.getElementById('card-status').textContent = ''")
        await tap_el(pg, mob, '#copy-img')
        try: await pg.wait_for_function("document.getElementById('card-status').textContent.length > 5 && !document.getElementById('copy-img').disabled", timeout=8000); ok = True
        except Exception: ok = False
        check(ok, f'{tag} copy image')
        check(await pg.evaluate("navigator.clipboard.read().then(items => items.some(i => i.types.includes('image/png')))"), f'{tag} copy image: no PNG on the clipboard')

    # Backup: save the file, change the map, load the file, and the map comes back.
    if not mob:
        saved = await mapv()
        async with pg.expect_download() as dl: await tap_el(pg, mob, '#backup-save')
        path = await (await dl.value).path()
        await tap_el(pg, mob, '#pick button[data-k="0"]'); await tap_el(pg, mob, '#pick button[data-k="3"]')
        async with pg.expect_navigation(): await pg.set_input_files('#backup-file', path)
        await pg.wait_for_timeout(400)
        check(await mapv() == saved, f'{tag} backup restore gave {await mapv()} not {saved}')
        await pg.add_style_tag(content='html{scroll-behavior:auto!important}')
        bad = os.path.join(tempfile.gettempdir(), 'not-a-backup.json'); open(bad, 'w').write('{"hello": 1}')
        await pg.set_input_files('#backup-file', bad)
        try: await pg.wait_for_function("!document.getElementById('toast').hidden", timeout=5000)
        except Exception: pass
        check(await pg.evaluate("!document.getElementById('toast').hidden && document.getElementById('toast').textContent.length > 10"), f'{tag} bad backup file message')
        check(await mapv() == saved, f'{tag} a bad backup file changed the map')

    # Friend challenge: the region line appears once you have progress.
    if 'c=' in QUERY:
        await pg.evaluate("document.querySelector('details.list-toggle').open = true")
        await tap_el(pg, mob, '#region-list li:nth-child(4) button[data-k="2"]')
        check(await pg.evaluate("!document.getElementById('vs-regions').hidden && document.getElementById('vs-regions').textContent.length > 10"), f'{tag} challenge region line')

    for e in errs: check(False, f'{tag} script error {e}')
    await ctx.close()

    # Past dares, three days after launch, with day 2 done.
    ctx = await b.new_context(viewport={'width': w, 'height': 844}, has_touch=mob, is_mobile=mob)
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.clock.install(time='2026-11-22T12:00:00')
    await pg.add_init_script("try { localStorage.setItem('vch.daily', '0,1') } catch (e) {}")
    await pg.goto(BASE + QUERY); await pg.add_style_tag(content='html{scroll-behavior:auto!important}'); await pg.wait_for_timeout(300)
    await tap_el(pg, mob, '#daily-past-wrap > summary')
    items = await pg.evaluate("[...document.querySelectorAll('#daily-past li')].map(l => l.className)")
    check(items == ['', 'is-on', 'is-on'], f'{tag} past dares {items}')
    check((await pg.evaluate("document.getElementById('daily-day').textContent")).endswith('4'), f'{tag} day number')
    for e in errs: check(False, f'{tag} script error (past dares) {e}')
    await ctx.close()

    # Cheat code page: tick and untick.
    ctx = await b.new_context(viewport={'width': w, 'height': 844}, has_touch=mob, is_mobile=mob)
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(BASE + 'gta-6-cheat-codes.html'); await pg.add_style_tag(content='html{scroll-behavior:auto!important}'); await pg.wait_for_timeout(300)
    for want in [True, False]:
        await tap_el(pg, mob, '#cheat-rows tr:nth-child(3) .got input')
        check(await pg.evaluate("document.querySelector('#cheat-rows tr:nth-child(3) .got input').checked") == want, f'{tag} cheat tick {want}')
    await tap_el(pg, mob, '.chips .chip:nth-child(2)')
    check(await pg.evaluate("document.querySelector('.chips .chip:nth-child(2)').getAttribute('aria-pressed')") == 'true', f'{tag} cheat filter chip')
    for e in errs: check(False, f'{tag} cheat page script error {e}')
    await ctx.close()

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, mob in [(390, True), (768, True), (1440, False)]:
            await run(b, w, mob)
        await b.close()
    print(f'{count[0]} checks.', f'{len(fails)} failure(s)' if fails else 'Every tap and untap behaved.')
asyncio.run(main())
sys.exit(1 if fails else 0)
