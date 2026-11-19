# Vice City Hub (vicecityhub.okenshop.com)

A free fan tool for GTA VI players: mark the Leonida regions you have explored, get a shareable map card, challenge
friends with a link (live you-vs-them score), get a Leonida street name, play day-one bingo, and tip the hub in crypto. Plain HTML, CSS and JavaScript, no build step, no requests to other sites.
It is its own small site in its own repository, with no connection to the okenshop shop.

```
  vercel.json        Host settings for this site only: published folder (site/), security headers, caching
  site/
    index.html       The page, its title, description, sharing image and FAQ markup
    404.html         Not-found page
    robots.txt, sitemap.xml, favicon.ico
    hub/hub.css      Styles (Leonida roadside at night: asphalt, sign green, one neon pink)
    hub/hub.js       The map, scoring, the card (canvas), share/download/copy, the unlock clock
    hub/fonts/       Anton and DM Sans, subset to Latin (SIL Open Font License, licences included)
    hub/img/         QR codes (generated from the address and link, no logos), icons, og.png
tests/check.py       Checks: files, exact tip details, no script errors, no sideways scrolling, tap targets, the card
```

## Put it live (once)

1. Vercel → Add New → Project → import `kayesislam0/ViceCity-Hub`.
2. Root Directory: leave as the repository root. Framework preset: Other. Leave build and install commands empty.
3. Settings → Domains → add `vicecityhub.okenshop.com`.
4. At your DNS provider keep (or add) the record Vercel shows, usually `CNAME vicecityhub → cname.vercel-dns.com`.

## Take it down

Delete the Vercel project, remove the `vicecityhub` DNS record, then archive or delete this repository. Nothing else depends on it.

## Change things

| To change | Edit |
|---|---|
| Tip details | `site/index.html` (tip section) and regenerate both QR SVGs from the exact text; `tests/check.py` checks the address and link |
| Regions, map shapes, ranks, card looks | `site/hub/hub.js` (`REGIONS`, `RANKS`, `THEMES`) |
| Street-name words, bingo prompts | `ALIAS_FIRST` / `ALIAS_TITLE` / `ALIAS_KNOWN`, `BINGO` in `site/hub/hub.js` |
| Unlock times | `PLACES` in `site/hub/hub.js` |
| Title, description, FAQ | `site/index.html` head and the FAQ section (keep the JSON-LD answers identical to the visible ones) |

`python3 tests/check.py` (needs Python Playwright with Chromium) checks the files, the exact tip details, script errors,
sideways scrolling, 44 px tap targets and that the card paints.

Not affiliated with Rockstar Games or Take-Two. No Rockstar artwork, logos or fonts are used; the map is our own sketch.
