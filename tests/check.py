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
    for f in ['robots.txt', 'sitemap.xml', '404.html', 'hub/hub.js', 'hub/i18n.js', 'hub/hub.css', 'hub/img/og.png', 'hub/img/qr-btc.svg', 'hub/img/qr-binance.svg']:
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
            await pg.click('#region-list li:nth-child(4) button[data-k="2"]')
            await pg.click('#daily-done'); await pg.click('#tipped-btn')
            if await pg.evaluate('document.documentElement.scrollWidth > innerWidth'): out.append(f'{w}px: sideways scrolling')
            if touch:
                small = await pg.evaluate("""[...document.querySelectorAll('button, a.btn, .seg label, input[type=checkbox]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5 && !e.closest('.cell')) && e.type !== 'checkbox'; }).map(e => (e.id || e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height))""")
                out += [f'{w}px: small tap target {s}' for s in small]
            await pg.evaluate("document.getElementById('card-canvas').scrollIntoView()"); await pg.wait_for_timeout(500)
            if not await pg.evaluate("document.getElementById('card-canvas').toDataURL('image/png').length > 50000"): out.append(f'{w}px: the card did not paint')
            out += [f'{w}px: script error {e}' for e in errors]
            await ctx.close()
        # Spanish and Portuguese run longer than English: no script errors, no sideways scrolling, text translated.
        for lang, word in [('es', 'Herramientas'), ('pt', 'Ferramentas')]:
            ctx = await b.new_context(viewport={'width': 320, 'height': 780}, has_touch=True, is_mobile=True)
            pg = await ctx.new_page(); errors = []
            pg.on('pageerror', lambda e: errors.append(str(e)))
            await pg.goto(base + '?lang=' + lang); await pg.wait_for_timeout(300)
            if await pg.evaluate('document.documentElement.scrollWidth > innerWidth'): out.append(f'{lang}: sideways scrolling')
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
