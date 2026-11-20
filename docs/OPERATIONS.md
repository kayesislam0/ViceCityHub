# Running the live site

For the owner. Contributors don't need any of this.

## Put it live (once)

1. Vercel → Add New → Project → import this repository.
2. Framework preset: Other. Build and install commands: empty. Output directory: `site`. Root directory: the repository root.
3. Settings → Domains → add `vicecityhub0.vercel.app`.
4. At your DNS provider keep (or add) the record Vercel shows, usually `CNAME vicecityhub → cname.vercel-dns.com`.

## Take it down

Delete the Vercel project, remove the `vicecityhub` DNS record, then archive or delete this repository. Nothing else depends on it.


## Reviewing pull requests

- The **Checks** workflow runs `tests/check.py` on every pull request. Merge only when it is green.
- Vercel builds a preview of every pull request. Open it on a phone before merging anything visual.
- Never merge a change to the tip details (`site/index.html` tip section, `site/hub/img/qr-*.svg`, `tests/check.py`
  constants).
- In Settings → Branches, protect `main`: require a pull request and the **check** status before merging.

## Change the tip details

Edit the tip section in `site/index.html`, regenerate both QR SVGs from the exact address and link, and update `BTC`
and `BINANCE` in `tests/check.py`. The checks fail if any of the three disagree.

## Keeping your username off the public pages

Every link on the site and in the docs goes through short addresses on the hub's own domain (`/source`, `/report`,
`/idea`, `/issues`, `/good-first-issues`, `/security-report`), set in `vercel.json`. If the repository moves, change
only those redirects. GitHub itself always shows the owner in the repository address; to hide it there too, create a
GitHub organization (for example `vicecityhub`) and transfer the repository to it (Settings → Transfer ownership).
