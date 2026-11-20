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
    # Every page loads the same version of the script and styles, so a browser never mixes an old file with a new one.
    import re
    stamps = set()
    for f in ['index.html', '404.html', 'legal.html', 'gta-6-cheat-codes.html', 'gta-6-100-percent-checklist.html', 'gta-6-guide.html']:
        t = (SITE / f).read_text(encoding='utf-8')
        for m in re.findall(r'hub/hub\.(?:js|css)(\?v=[\w-]+)?"', t):
            if not m: out.append(f'{f}: hub.js or hub.css has no ?v= version')
            stamps.add(m)
    js = (SITE / 'hub/hub.js').read_text(encoding='utf-8')
    stamps.update(re.findall(r"i18n\.js(\?v=[\w-]+)'", js))
    if len(stamps) != 1: out.append(f'pages load different versions of the hub files: {sorted(stamps)}')
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
            # The region list starts open on wide screens (beside the map) and folded on phones.
            if (w >= 960) != await pg.evaluate("document.querySelector('details.list-toggle').open"): out.append(f'{w}px: the region list should start ' + ('open' if w >= 960 else 'folded'))
            await pg.evaluate("document.querySelector('details.list-toggle').open = true")
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
        # Open in wallet: a BTC-only bitcoin: link; with no wallet app it copies the address and says what to do next.
        cw = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, permissions=['clipboard-read', 'clipboard-write'])
        pw = await cw.new_page(); ew = []; pw.on('pageerror', lambda e: ew.append(str(e)))
        await pw.goto(base); await pw.wait_for_timeout(300)
        if await pw.get_attribute('#wallet-open', 'href') != f'bitcoin:{BTC}?label=Vice%20City%20Hub': out.append('wallet: the link is not a BTC payment link')
        await pw.click('#wallet-open'); await pw.wait_for_timeout(2000)
        if not await pw.is_visible('#wallet-help'): out.append('wallet: nothing happened when no wallet app opened')
        if await pw.evaluate('navigator.clipboard.readText()') != BTC: out.append('wallet: the address was not copied')
        out += [f'wallet: script error {e}' for e in ew]
        await cw.close()
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
        # Bingo squares: every visible word fits whole in its square and nothing spills, on small phones, for every monthly
        # card, in every language. Measured after the webfont has loaded, so a slow machine measures the real font.
        WORDS = """async () => { await document.fonts.ready;
          const cells = [...document.querySelectorAll('#bingo .cell')], c = cells[0], st = getComputedStyle(c);
          const room = c.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
          const cv = document.createElement('canvas').getContext('2d'); cv.font = st.fontWeight + ' ' + st.fontSize + ' ' + st.fontFamily;
          const tight = [];
          cells.forEach(x => x.innerText.split(/\\s+/).forEach(w => { if (w && cv.measureText(w).width > room - 2) tight.push(w); }));
          const spill = cells.filter(x => x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1).map(x => x.innerText);
          return { n: cells.length, tight, spill }; }"""
        for lang in ['en', 'es', 'pt']:
            for w in [320, 360, 390]:
                ctx = await b.new_context(viewport={'width': w, 'height': 780}, has_touch=True, is_mobile=True)
                for month in [(2026, 10, 20), (2026, 11, 5), (2027, 0, 10), (2027, 2, 10)]:
                    await ctx.clear_cookies()
                    pg = await ctx.new_page()
                    await pg.add_init_script("(() => { const R = Date, t = new R(%d, %d, %d, 12).getTime(); window.Date = class extends R { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } }; })()" % month)
                    await pg.goto(base + '?lang=' + lang); await pg.wait_for_timeout(100)
                    r = await pg.evaluate(WORDS)
                    if r['n'] != 25: out.append(f'{lang} {w}px: bingo should show 25 squares, shows {r["n"]}')
                    out += [f'{lang} {w}px {month[1] + 1}/{month[0]} bingo: "{x}" spills out of its square' for x in r['spill']]
                    out += [f'{lang} {w}px {month[1] + 1}/{month[0]} bingo: the word "{x}" does not fit whole in its square' for x in sorted(set(r['tight']))]
                    await pg.close()
                await ctx.close()
        # No day stamps or start dates anywhere: the controls are gone, the card never prints a day, and what older
        # versions saved is cleared.
        def clock(y, m, d): return "(() => { const R = Date, t = new R(%d, %d, %d, 12).getTime(); window.Date = class extends R { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } }; })()" % (y, m, d)
        cs = await b.new_context(viewport={'width': 390, 'height': 844})
        ps = await cs.new_page()
        await ps.add_init_script(clock(2026, 10, 25))
        await ps.add_init_script("localStorage.setItem('vch.dayone', '1'); localStorage.setItem('vch.since', '1')")
        await ps.goto(base); await ps.wait_for_timeout(300)
        for sel in ['#dayone', '#since', '#daily-day']:
            if await ps.query_selector(sel): out.append(f'day removal: {sel} is still on the page')
        if await ps.evaluate("localStorage.getItem('vch.dayone') || localStorage.getItem('vch.since')"): out.append('day removal: old day settings were not cleared')
        if 'Day ' in await ps.evaluate("document.getElementById('daily-task').closest('.daily').innerText"): out.append('day removal: the daily dare still shows a day number')
        await cs.close()
        # Progress links never quietly replace newer progress; a link that does replace it offers Undo.
        cp = await b.new_context(viewport={'width': 390, 'height': 844})
        pp = await cp.new_page(); ep = []; pp.on('pageerror', lambda e: ep.append(str(e)))
        enc = "(o => btoa(JSON.stringify(o)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, ''))"
        await pp.goto(base); await pp.wait_for_timeout(200)
        await pp.evaluate("localStorage.setItem('vch.map', '333333'); localStorage.setItem('vch.updated', String(Date.now()))")
        old = await pp.evaluate(enc + "({'vch.map': '100000', 'vch.updated': String(Date.now() - 864e5)})")
        await pp.goto('about:blank'); await pp.goto(base + '#p=' + old); await pp.wait_for_timeout(300)
        if await pp.evaluate("localStorage.getItem('vch.map')") != '333333': out.append('progress link: an older link replaced newer progress')
        async def act(what):
            if not await pp.is_visible('#toast .toast__act'): out.append(f'progress link: no {what} button'); return False
            await pp.click('#toast .toast__act'); await pp.wait_for_timeout(400); return True
        if await act('"Use it anyway"') and await pp.evaluate("localStorage.getItem('vch.map')") != '100000': out.append('progress link: "Use it anyway" did not load the older link')
        if await act('Undo') and await pp.evaluate("localStorage.getItem('vch.map')") != '333333': out.append('progress link: Undo did not bring the earlier progress back')
        legacy = await pp.evaluate(enc + "({'vch.map': '200000'})")
        await pp.evaluate("localStorage.removeItem('vch.updated')")
        await pp.goto('about:blank'); await pp.goto(base + '#p=' + legacy); await pp.wait_for_timeout(300)
        if await pp.evaluate("localStorage.getItem('vch.map')") != '200000': out.append('progress link: an old-style link did not restore over old-style progress')
        if not await pp.is_visible('#toast .toast__act'): out.append('progress link: replacing progress offered no Undo')
        # A backup from a player who never touched the map still loads.
        import json, tempfile, os
        bk = os.path.join(tempfile.mkdtemp(), 'backup.json')
        open(bk, 'w').write(json.dumps({'app': 'vicecityhub', 'v': 1, 'data': {'vch.daily': '0,1', 'vch.cheats': 'x'}}))
        await pp.set_input_files('#backup-file', bk); await pp.wait_for_timeout(600)
        if await pp.evaluate("localStorage.getItem('vch.daily')") != '0,1': out.append('backup: a backup without a map was refused')
        # Cheat counter: a saved id that is not on the page does not count.
        await pp.evaluate("localStorage.setItem('vch.cheats', 'gone,gone,also-gone')")
        await pp.goto(base + 'gta-6-cheat-codes.html'); await pp.wait_for_timeout(200)
        if await pp.evaluate("document.getElementById('cheat-count').textContent") != '0 of 61 unlocked': out.append('cheats: unknown saved ids were counted')
        out += [f'progress link: script error {e}' for e in ep]
        await cp.close()
        # Friends board: an unnamed challenge link does not add a row; the text you send gives the position on screen.
        cf = await b.new_context(viewport={'width': 1200, 'height': 844}, permissions=['clipboard-read', 'clipboard-write'])
        pf = await cf.new_page()
        await pf.goto(base + '?c=111000'); await pf.wait_for_timeout(200)
        await pf.goto(base + '?c=333000'); await pf.wait_for_timeout(200)
        if await pf.evaluate("localStorage.getItem('vch.board')"): out.append('board: an unnamed challenge link added a row')
        await pf.evaluate("localStorage.setItem('vch.tag', 'Sam'); localStorage.setItem('vch.map', '100000'); localStorage.setItem('vch.board', 'Mia~100000|Sam~333333')")
        await pf.goto(base); await pf.wait_for_timeout(200)
        await pf.click('#board-send'); await pf.wait_for_timeout(200)
        sent = await pf.evaluate('navigator.clipboard.readText()')
        if 'I am #2 of 2' not in sent: out.append(f'board: the sent position does not match the board: {sent[:60]!r}')
        await cf.close()
        # Bingo keeps a fresh card each month after the written ones run out.
        cb2 = await b.new_context(viewport={'width': 390, 'height': 844})
        pb2 = await cb2.new_page(); await pb2.add_init_script(clock(2027, 2, 10))
        await pb2.goto(base); await pb2.wait_for_timeout(200)
        if 'March 2027' not in await pb2.evaluate("document.getElementById('bingo-month').textContent"): out.append('bingo: March 2027 has no card of its own')
        await pb2.evaluate("document.querySelector('#bingo .cell').click()")
        if 's5:' not in (await pb2.evaluate("localStorage.getItem('vch.bingoCards')") or ''): out.append('bingo: the March 2027 card is not saved as its own card')
        await cb2.close()
        # Bingo compare link: a friend's card shows on yours, and a broken link is ignored.
        cb = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        pb = await cb.new_page(); eb = []; pb.on('pageerror', lambda e: eb.append(str(e)))
        await pb.add_init_script("(() => { const R = Date, t = new R(2026, 10, 20, 12).getTime(); window.Date = class extends R { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } }; })()")
        await pb.goto(base + '#b=s1.____~Mia'); await pb.wait_for_timeout(300)
        if await pb.is_hidden('#bingo-vs'): out.append('bingo: a friend link did not show their card')
        if await pb.evaluate("document.querySelectorAll('#bingo .cell.is-theirs').length") != 24: out.append('bingo: a full friend card should mark 24 squares')
        await pb.goto(base + '#b=s9.%%~x'); await pb.reload(); await pb.wait_for_timeout(300)
        if not await pb.is_hidden('#bingo-vs'): out.append('bingo: a broken link showed a friend card')
        out += [f'bingo link: script error {e}' for e in eb]
        await cb.close()
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
