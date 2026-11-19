# Vice City Hub: design system

Fan tool for USA and European players. Character: fast, bold, honest. World: a highway sign and a neon night over Leonida. Everything here is read from `site/hub/hub.css`.

## Colour

| Token | Value | Role | Contrast on its text |
|---|---|---|---|
| `--asphalt` | #0E1311 | Page background | chalk 17:1 |
| `--asphalt-2` | #161D1A | Raised panels, live map card | chalk 15:1 |
| `--asphalt-3` | #212A26 | Controls (inputs, segmented buttons) | chalk 13:1 |
| `--chalk` | #F4F1EA | Primary text, headlines | 17:1 on asphalt |
| `--chalk-2` | #B4BDB8 | Secondary text | 9.6:1 on asphalt |
| `--line` | chalk at 14% | Hairlines | decorative |
| `--line-strong` | chalk at 32% | Control borders, market dots when upcoming | decorative |
| `--sign` | #0B6B3A | Highway-sign green: tip cards, region signs | white 6.6:1 |
| `--neon` | #FF5FA2 | The one accent: primary action, explored regions, live state | asphalt on neon 7.2:1 |
| `--sun` | #FFC35A | Reward gold: a region done 100% (map edge, label, list button), and the Bitcoin network warning | asphalt on sun 11:1 |

Rules: one accent. Neon marks the primary action and the live state. Surfaces stay neutral.

## Type

- **Display:** Anton 400, for headlines, sign labels, the meter number and map labels. Line height 1.02, no letter spacing.
- **Text:** DM Sans 400 and 600. Body 16px / 1.55. Secondary text 14 to 17px.
- No weight above 600. No italic. No gradient text.
- Sentence case everywhere.

## Space and shape

- 4px grid. Section padding `clamp(56px, 8vw, 104px)`. Page gutter `clamp(16px, 4vw, 48px)`.
- Radii: controls 10px, cards 14px, the QR frame 10px, the highway sign 8px.
- Minimum tap target 44px.

## Components

| Component | States | Notes |
|---|---|---|
| Button (`.btn`, `.btn--primary`) | default, hover, focus, disabled | Primary is neon with asphalt text. Secondary is raised with a hairline. |
| Region step (`.steps button`) | off, pressed (`aria-pressed`), focus | Three steps: Passed, Explored, 100%. |
| Market row (`.markets li`) | upcoming (muted dot), out (neon dot and neon time) | The dot and the time are set live from the visitor's clock. |
| Highway sign (`.sign`) | static | Region names. |
| Tip card (`.way`) | static | Green sign, white QR on a white frame. |
| Live line (`.live`) | static, live | A neon dot aligned to the first line. |

## Motion

One curve and short durations: colour and border changes take .2s, the segmented buttons .2s. Respect `prefers-reduced-motion` (already set at the end of `hub.css`).

## Accessibility

- Every interactive control has a visible focus ring.
- Market state is shown by text, not only by colour (the time reads "Out since" or "In …").
- Touch targets are at least 44px. `tests/check.py` enforces this.

## Handoff: map and tools

### Map region levels

| Level | Label | Fill | Edge | Label colour | Why |
|---|---|---|---|---|---|
| 0 | (none) | #26302B with a diagonal hatch (`#fog`) | asphalt 3px | chalk | Fog of war: unexplored |
| 1 | Passed through | #3E2B40 dusk plum | asphalt 3px | chalk | First step, quiet |
| 2 | Explored | #5E2F55 | neon 3px | chalk | Lit edge shows progress |
| 3 | Done 100% | #7D3B62 deep berry | sun 3.5px | chalk name, sun level | Calm to look at over a large area; gold edge is the reward |

Contrast: chalk on #7D3B62 is 6.9:1; sun on #7D3B62 is 4.8:1.

The share card draws the same map layers (stipple sea, coastal shelf, fog hatch on level 0, neon edge on level 2, gold edge on level 3, dotted route, compass) on a 1080 x 1350 canvas. Its labels are 30px Anton with a 6px dark outline so they read in a social feed. In the side list, a finished region's three dots are gold.

Layers, bottom to top: sea, stipple, grid, coastal shelf, region shapes and fog, lake, route, labels, compass. Labels sit above the route and carry a 4px dark outline (`paint-order: stroke`) so the dotted route never cuts through text.

### Interactions

| Element | Action | Result |
|---|---|---|
| Map region | Tap, Enter or Space | One step deeper. At 100% it stays, and a toast says to use the list to lower it |
| List step button | Tap a step | Region goes to that step. Steps below it show as reached (pink tint) |
| List step button | Tap the current step | Region goes back one step |
| Street name: Copy | Tap | Copies the name, the "known for" line, your unlock time and the link |
| Street name: New name | Tap | Next name for the same input |
| Street name: Show it on my map card | Check | The card title uses the street name |
| Bingo cell | Tap | Ticks or unticks; the centre is free and fixed |
| Bingo: Copy my board | Tap | Copies your name, platform, score and an emoji grid |
| Bingo: New board | Tap | New prompts, with Undo in the status line |
| Card: Share card | Tap | Native share with the PNG where supported, otherwise download and copy the challenge text |
| Card: challenge link | Tap (text button) | Copies the challenge text and link |

### Responsive

| Width | Changes |
|---|---|
| < 400px | Region rows stack: name above three full-width steps |
| < 620px | Top nav shows only Tip the hub |
| ≥ 900px | Hero is two columns with the map sticky; card maker and tools are two columns |

### Edge cases

- Name of only spaces is ignored; the card falls back to "Player one", the street name to "Player".
- Storage blocked (private mode): everything works, nothing is remembered.
- No Web Share: the card downloads and the challenge text is copied.
- Reduced motion: all animation and transitions are off.
