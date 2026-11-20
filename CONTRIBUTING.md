# Contributing to Vice City Hub

Thanks for helping. Fixes and small improvements from anyone are welcome, and every pull request gets a review.

## Before you start

- **Small fix?** Just open a pull request.
- **Bigger change** (a new tool, a new section, a redesign)? Open an [idea issue](https://vicecityhub0.vercel.app/idea) first, so you don't spend an evening on something that won't fit.
- Looking for something to do? Try the [`good first issue`](https://vicecityhub0.vercel.app/good-first-issues) label.

## Set up

```sh
git clone <your fork>
cd ViceCityHub/site
python3 -m http.server 8000      # open http://localhost:8000
```

No framework, no build step, no package install. Edit, refresh, look.

## Check your change

```sh
pip install playwright && python3 -m playwright install chromium
python3 tests/check.py
```

The same checks run on your pull request. Please also look at your change on a phone-sized window (about 390 px wide):
most visitors are on phones.

## What makes a pull request easy to accept

- **One change per pull request**, with a title that says what it does: "Fix the challenge banner overlapping the menu on iPhone SE".
- **A screenshot or short clip** for anything you can see.
- **Fits the design.** Colours, type and spacing come from [DESIGN.md](DESIGN.md): one neon pink accent, Anton for display, DM Sans for text, 44 px tap targets.
- **Stays fast and private.** No frameworks, trackers, analytics, ad scripts, external fonts or requests to other sites. The page's security policy blocks them anyway.
- **Accurate about the game.** No made-up regions, places or features. Name a source for any new game fact.
- **No Rockstar artwork, logos or fonts.**

## What won't be merged

- Changes to the tip details (the Binance Pay link, the Bitcoin address or their QR codes).
- Anything that adds ads, tracking, accounts or a server.
- Content that copies Rockstar's assets.

## Licence

By opening a pull request you agree that your contribution is released under this project's [MIT licence](LICENSE).

## Be decent

Everyone here is a fan with a few spare hours. See the [code of conduct](CODE_OF_CONDUCT.md).
