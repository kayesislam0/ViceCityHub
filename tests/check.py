"""Checks for Vice City Hub. Run: python3 tests/check.py  (needs Python Playwright with Chromium).

Static: required files, exact tip details, no inline script (the security policy blocks it).
Browser: no script errors, no sideways scrolling, 44 px tap targets on phones, the card paints."""
import asyncio, functools, http.server, socketserver, sys, threading
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / 'site'
BTC = '1M16Rp5Hx7b5ax6w5knKmCNYQEfF3S5KeF'
BINANCE = 'https://app.binance.com/uni-qr/K6RZ4d5G'

def static():
    out = []
    html = (SITE / 'index.html').read_text(encoding='utf-8')
    for want in ['<link rel="canonical" href="https://vicecityhub0.vercel.app/">', BTC, BINANCE, '"@type":"FAQPage"', 'og:image']:
        if want not in html: out.append(f'index.html is missing {want}')
    if '<script>' in html: out.append('inline script (the security policy blocks it)')
    for f in ['robots.txt', 'sitemap.xml', '404.html', 'legal.html', 'gta-6-cheat-codes.html', 'gta-6-100-percent-checklist.html', 'gta-6-guide.html', 'site.webmanifest', 'hub/img/icon-192.png', 'hub/img/icon-512.png', 'hub/hub.js', 'hub/i18n.js', 'hub/hub.css', 'hub/img/og.png', 'hub/img/qr-btc.svg', 'hub/img/qr-binance.svg']:
        if not (SITE / f).is_file(): out.append(f'{f} is missing')
    return out

def serve():
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(H, directory=str(SITE)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}/'

async def browser():
    from playwright.async_api import async_playwright
    out = []; httpd, base = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in [320, 390, 768, 1440]:
            touch = w < 1024
            ctx = await b.new_context(viewport={'width': w, 'height': 844}, has_touch=touch, is_mobile=touch and w < 700)
            pg = await ctx.new_page(); errors = []
            pg.on('pageerror', lambda e: errors.append(str(e)))
            await pg.goto(base); await pg.wait_for_timeout(300)
            await pg.click('details.list-toggle > summary')
            await pg.click('#region-list li:nth-child(4) button[data-k="2"]')
            # Marking: tapping the current level keeps it; the map picker sets an exact level; the daily dare only undoes on purpose.
            await pg.click('#region-list li:nth-child(4) button[data-k="2"]')
            if await pg.evaluate("localStorage.getItem('vch.map')[3]") != '2': out.append(f'{w}px: tapping the current level changed it')
            await pg.evaluate("document.querySelector('#map .rg[data-i=\"3\"]').dispatchEvent(new MouseEvent('click', {bubbles: true}))")
            await pg.click('#pick button[data-k="0"]')
            if await pg.evaluate("localStorage.getItem('vch.map')[3]") != '0': out.append(f'{w}px: the map picker did not set Not seen')
            if await pg.evaluate("getComputedStyle(document.getElementById('toast')).pointerEvents") != 'none': out.append(f'{w}px: the toast can block taps')
            await pg.click('#daily-done')
            if not await pg.evaluate("document.getElementById('daily-done').hidden"): out.append(f'{w}px: "I did it" still shows after marking')
            await pg.click('#daily-undo')
            if await pg.evaluate("localStorage.getItem('vch.daily')"): out.append(f'{w}px: daily undo did not clear today')
            await pg.click('#daily-done'); await pg.click('#tipped-btn')
            if await pg.evaluate(f'document.documentElement.scrollWidth > {w}'): out.append(f'{w}px: sideways scrolling')
            if touch:
                small = await pg.evaluate("""[...document.querySelectorAll('button, a.btn, .seg label, input[type=checkbox]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5 && !e.closest('.cell')) && e.type !== 'checkbox'; }).map(e => (e.id || e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height))""")
                out += [f'{w}px: small tap target {s}' for s in small]
            await pg.evaluate("document.getElementById('card-canvas').scrollIntoView()"); await pg.wait_for_timeout(500)
            if not await pg.evaluate("document.getElementById('card-canvas').toDataURL('image/png').length > 50000"): out.append(f'{w}px: the card did not paint')
            out += [f'{w}px: script error {e}' for e in errors]
            await ctx.close()
        # Moving from the old address: progress travels once, a section anchor survives, newer progress is never undone.
        cm = await b.new_context(viewport={'width': 390, 'height': 844})
        async def local(route):
            from urllib.parse import urlparse
            path = urlparse(route.request.url).path.lstrip('/') or 'index.html'
            f = SITE / path
            if not f.is_file() and (SITE / (path + '.html')).is_file(): f = SITE / (path + '.html')
            if not f.is_file(): return await route.fulfill(status=404, body='')
            ct = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff'}.get(f.suffix, 'application/octet-stream')
            await route.fulfill(status=200, body=f.read_bytes(), headers={'content-type': ct})
        await cm.route('https://vicecityhub.okenshop.com/**', local); await cm.route('https://vicecityhub0.vercel.app/**', local)
        pm = await cm.new_page(); em = []; pm.on('pageerror', lambda e: em.append(str(e)))
        await cm.add_init_script("if (location.hostname === 'vicecityhub.okenshop.com' && !localStorage.getItem('vch.moved')) { localStorage.setItem('vch.map', '321000'); localStorage.setItem('vch.tag', 'Rafi'); }")
        await pm.goto('https://vicecityhub.okenshop.com/#tools'); await pm.wait_for_url('https://vicecityhub0.vercel.app/**'); await pm.wait_for_timeout(400)
        if await pm.evaluate("localStorage.getItem('vch.map')") != '321000': out.append('move: the map did not come over from the old address')
        if await pm.evaluate("location.hash") != '#tools': out.append('move: the section anchor was lost')
        await pm.evaluate("localStorage.setItem('vch.map', '333000')")
        await pm.goto('https://vicecityhub.okenshop.com/gta-6-cheat-codes'); await pm.wait_for_url('https://vicecityhub0.vercel.app/gta-6-cheat-codes'); await pm.wait_for_timeout(300)
        await pm.goto('https://vicecityhub0.vercel.app/'); await pm.wait_for_timeout(300)
        if await pm.evaluate("localStorage.getItem('vch.map')") != '333000': out.append('move: a second visit to the old address undid newer progress')
        out += [f'move: script error {e}' for e in em]
        await cm.close()
        # Cheat codes: all 61 rows are in the page itself (search engines read it), and the search filters them.
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(base + 'gta-6-cheat-codes.html'); await pg.wait_for_timeout(300)
        out += [f'cheat page: script error {e}' for e in errs]
        if await pg.evaluate('document.documentElement.scrollWidth > 390'): out.append('cheat page: sideways scrolling')
        # 100% checklist: + and - change the count, a full count marks the category done, and it survives a reload.
        c3 = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        p3 = await c3.new_page(); e3 = []; p3.on('pageerror', lambda e: e3.append(str(e)))
        await p3.goto(base + 'gta-6-100-percent-checklist.html'); await p3.wait_for_timeout(200)
        for _ in range(3): await p3.click('[data-inc="vaults"]')
        await p3.click('[data-dec="vaults"]')
        await p3.fill('input[data-h="playlists"]', '2'); await p3.dispatch_event('input[data-h="playlists"]', 'input')
        await p3.reload(); await p3.wait_for_timeout(200)
        if await p3.input_value('input[data-h="vaults"]') != '2': out.append('100% checklist: + and - did not keep the count')
        if await p3.evaluate("document.getElementById('h-done').textContent") != '1': out.append('100% checklist: a full count did not mark the category done')
        await p3.goto(base + 'gta-6-guide.html'); await p3.wait_for_timeout(200)
        await p3.click('[data-c1="cash"]'); await p3.reload(); await p3.wait_for_timeout(200)
        if not await p3.is_checked('[data-c1="cash"]'): out.append('Chapter 1 checklist: a tick was not saved')
        out += [f'checklist or help page script error: {e}' for e in e3]
        await c3.close()
        # Friends board: a link passed Rafi -> Mia -> Sam carries both friends; old links never lower a score; clear has undo.
        async def person(tag, mp):
            cx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            await cx.add_init_script(f"try {{ if (!localStorage.getItem('vch.tag')) {{ localStorage.setItem('vch.tag', '{tag}'); localStorage.setItem('vch.map', '{mp}') }} }} catch (e) {{}}")
            pp = await cx.new_page(); return cx, pp
        def link_of(pp): return pp.evaluate("(() => { const u = new URL(location.href); return u.search; })()")
        cr, pr = await person('Rafi', '321100'); await pr.goto(base); await pr.wait_for_timeout(150)
        if not await pr.evaluate("document.getElementById('board').hidden"): out.append('board: shows with no friends')
        rafi = await pr.evaluate("'?c=' + '321100' + '&n=Rafi'")
        cm, pm = await person('Mia', '332210'); await pm.goto(base + rafi); await pm.wait_for_timeout(200)
        rows = await pm.evaluate("[...document.querySelectorAll('#board-list .board__who')].map(e => e.textContent)")
        if rows != ['Mia (you)', 'Rafi']: out.append(f'board: Mia sees {rows}')
        mia_board = await pm.evaluate("encodeURIComponent(localStorage.getItem('vch.board'))")
        cs, ps = await person('Sam', '100000'); await ps.goto(base + '?c=332210&n=Mia&b=' + mia_board); await ps.wait_for_timeout(200)
        rows = await ps.evaluate("[...document.querySelectorAll('#board-list .board__who')].map(e => e.textContent)")
        if rows != ['Mia', 'Rafi', 'Sam (you)']: out.append(f'board: Sam sees {rows}')
        gap = await ps.evaluate("document.getElementById('board-gap').textContent")
        if 'Rafi' not in gap: out.append(f'board: gap line {gap!r}')
        await ps.goto(base + '?c=100000&n=Rafi'); await ps.wait_for_timeout(200)
        if '~321100' not in await ps.evaluate("localStorage.getItem('vch.board')"): out.append('board: an old link lowered a score')
        await ps.click('#board-clear')
        if not await ps.evaluate("document.getElementById('board').hidden"): out.append('board: clear did not clear')
        await ps.click('#toast .toast__act')
        if await ps.evaluate("document.getElementById('board').hidden"): out.append('board: undo did not restore')
        for cx in (cr, cm, cs): await cx.close()
        # Broken or hostile challenge links never stop the page from working.
        for q in ['?c=123012&b=%%%', '?c=123012&n=%E0%A4&b=%E0%A4~111111', '?c=999999', '?b=' + 'x~111111|' * 80]:
            c4 = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            p4 = await c4.new_page(); e4 = []; p4.on('pageerror', lambda e: e4.append(str(e)))
            await p4.goto(base + q); await p4.wait_for_timeout(200)
            if e4: out.append(f'challenge link {q[:30]}: {e4[0]}')
            if not await p4.evaluate("document.querySelectorAll('#map .rg').length === 6"): out.append(f'challenge link {q[:30]}: the map did not load')
            await c4.close()
        # Every page, at the smallest phone, in every language: nothing scrolls sideways.
        for page in ['', 'gta-6-cheat-codes.html', 'gta-6-100-percent-checklist.html', 'gta-6-guide.html', 'legal.html', '404.html']:
            for lang in ['en', 'es', 'pt']:
                c2 = await b.new_context(viewport={'width': 320, 'height': 780}, has_touch=True, is_mobile=True)
                p2 = await c2.new_page(); await p2.goto(base + page + '?lang=' + lang); await p2.wait_for_timeout(200)
                sw = await p2.evaluate('document.documentElement.scrollWidth')
                if sw > 320: out.append(f'{page or "home"} ({lang}) at 320px: {sw}px wide, scrolls sideways')
                await c2.close()
        if await pg.evaluate("document.querySelectorAll('#cheat-rows tr').length") != 61: out.append('cheats: expected 61 rows')
        await pg.fill('#cheat-q', 'ammo')
        if await pg.evaluate("[...document.querySelectorAll('#cheat-rows tr')].filter(r => !r.hidden).length") != 3: out.append('cheats: search for "ammo" should show 3')
        await ctx.close()
        # Bingo squares: every word of every prompt fits whole in its square, and nothing spills, on small phones, at
        # both sizes, in every language. Measured after the webfont has loaded, so a slow machine measures the real font.
        WORDS = """async () => { await document.fonts.ready;
          const cells = [...document.querySelectorAll('#bingo .cell')], c = cells[0], st = getComputedStyle(c);
          const room = c.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
          const cv = document.createElement('canvas').getContext('2d'); cv.font = st.fontWeight + ' ' + st.fontSize + ' ' + st.fontFamily;
          const tight = [];
          cells.forEach(x => x.textContent.split(/\\s+/).forEach(w => { if (cv.measureText(w).width > room - 2) tight.push(w); }));
          const spill = cells.filter(x => x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1).map(x => x.textContent);
          return { n: cells.length, tight, spill }; }"""
        for lang in ['en', 'es', 'pt']:
            for w, size in [(320, '3'), (320, '5'), (360, '5'), (390, '5')]:
                ctx = await b.new_context(viewport={'width': w, 'height': 780}, has_touch=True, is_mobile=True)
                pg = await ctx.new_page()
                for seed in ['11', '222', '3333']:
                    await pg.goto(base + '?lang=' + lang)
                    await pg.evaluate(f"localStorage.setItem('vch.bingoSize', '{size}'); localStorage.setItem('vch.bingoSeed', '{seed}')")
                    await pg.reload(); await pg.wait_for_timeout(100)
                    r = await pg.evaluate(WORDS)
                    want = 9 if (size == '3' or w < 360) else 25
                    if r['n'] != want: out.append(f'{lang} {w}px: bingo should show {want} squares, shows {r["n"]}')
                    out += [f'{lang} {w}px bingo: "{x}" spills out of its square' for x in r['spill']]
                    out += [f'{lang} {w}px bingo: the word "{x}" does not fit whole in its square' for x in sorted(set(r['tight']))]
                await ctx.close()
        # Spanish and Portuguese run longer than English: no script errors, no sideways scrolling, text translated.
        for lang, word in [('es', 'Herramientas'), ('pt', 'Ferramentas')]:
            ctx = await b.new_context(viewport={'width': 320, 'height': 780}, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); errors = []
            pg.on('pageerror', lambda e: errors.append(str(e)))
            await pg.goto(base + '?lang=' + lang); await pg.wait_for_timeout(300)
            if await pg.evaluate('document.documentElement.scrollWidth > 320'): out.append(f'{lang}: sideways scrolling')
            if word not in await pg.evaluate('document.body.textContent'): out.append(f'{lang}: page not translated')
            if await pg.evaluate('document.documentElement.lang') != lang: out.append(f'{lang}: html lang not set')
            out += [f'{lang}: script error {e}' for e in errors]
            await ctx.close()
        await b.close()
    httpd.shutdown()
    return out

problems = static() + asyncio.run(browser())
for p in problems: print('-', p)
print('All checks passed.' if not problems else f'{len(problems)} problem(s).')
sys.exit(1 if problems else 0)
