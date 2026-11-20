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
    for want in ['<link rel="canonical" href="https://vicecityhub.okenshop.com/">', BTC, BINANCE, '"@type":"FAQPage"', 'og:image']:
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
