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
| Region step (`.steps button`) | off, pressed (`aria-pressed`), focus | Three steps: Passed, Explored, Finished. |
| Highway sign (`.sign`) | static | Region names. |
| Tip card (`.way`) | static | Green sign, white QR on a white frame. |
| Live line (`.live`) | static | "GTA 6 is out." with a neon dot. |

## Motion

One curve and short durations: colour and border changes take .2s, the segmented buttons .2s. Respect `prefers-reduced-motion` (already set at the end of `hub.css`).

## Accessibility

- Every interactive control has a visible focus ring.
- Region state is shown by text under each name and in the list, not only by colour.
- Touch targets are at least 44px. `tests/check.py` enforces this.

## Handoff: map and tools

### Map region levels

Each region has its own colour: Vice City #FF5FA2 to #3FD6E8 (top to bottom), Leonida Keys #19B5A5, Grassrivers #3FAE5A,
Port Gellhorn #C9A15B, Ambrosia #E8762C, Mount Kalaga #1F7A4D. A legend under the map shows the four states.

| Level | Label | Fill | Edge | Extra |
|---|---|---|---|---|
| 0 | Not seen | #26302B | chalk at 28%, 1.5px (dim outline) | none |
| 1 | Passed through | region colour at 50% | asphalt 3px | none |
| 2 | Explored | region colour | asphalt 3px | glow in the region colour |
| 3 | Finished | region colour | sun 5px | gold badge with a tick by the name |

Map labels are white Anton with a dark outline (`paint-order: stroke`), so they read on every region colour.

### Card

Two sizes: Square 1:1 (1080 x 1080) and Story 9:16 (1080 x 1920), painted at 2x. A feed shows a card at about a third
of its size, so no text on a card is below 40px (about 13px in a feed); key text is 50px and up.

- Weight order: the % (Anton, 330 to 480px, theme accent with a soft glow), the name (Anton 100 to 130px), the rank on a
  green highway sign.
- Square: % and rank left, map right without labels, then six region tiles (3 x 2). Tile states: outline only, region
  colour at 45%, full colour, full colour with a gold edge and tick. Dark text on bright tiles, white on Mount Kalaga.
- Story: rank sign, %, name, platform, then a large map with 46px region names and gold ticks.
- The card map has no frame: one soft shadow, unseen regions outlined, the Keys drawn with a thick stroke.
- Every card ends with a band in the accent: "Make yours in 20 seconds" and vicecityhub.okenshop.com.
- Wrapped and Blend keep their 1080 x 1350 layout, fitted and centred; their smallest text is 36px.
- Contrast on cards: lowest pair is white on Mount Kalaga at 5.3:1; all others 6:1 or more.

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

### Flow helpers

| Element | Behaviour |
|---|---|
| Next-step bar (`.nextbar`) | Phones only. Appears after the first map tap (or on return with progress): your %, rank and "Make my card". Slides away while the card section is on screen. |
| Card maker | Name, Size, Share, Download, Copy challenge link up front. Card type, platform, look and date stamp sit in "More options" (`details.more`). |
| Region list | Folded under "Edit regions as a list" (`details.list-toggle`). The map is the main control. |

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
