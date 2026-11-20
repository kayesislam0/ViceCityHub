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
- Radii: controls 10px, cards 14px, the QR frame 10px.
- Minimum tap target 44px.

## Components

| Component | States | Notes |
|---|---|---|
| Button (`.btn`, `.btn--primary`) | default, hover, focus, disabled | Primary is neon with asphalt text. Secondary is raised with a hairline. |
| Region step (`.steps button`) | off, pressed (`aria-pressed`), focus | Three steps: Passed, Explored, Finished. |
| Highway sign (`.sign`) | static | Region names. |
| Tip card (`.way`) | static | Green sign, white QR on a white frame. |
| Live line (`.live`) | static | "GTA 6 is out." with a neon dot. |
| Map picker (`.pick`) | hidden, shown after the first map tap | The selected region and four levels. |

## Motion

One curve and short durations: colour and border changes take .2s, the segmented buttons .2s. Respect `prefers-reduced-motion` (already set at the end of `hub.css`).

## Accessibility

- Every interactive control has a visible focus ring.
- Region state is shown by text under each name and in the list, not only by colour.
- Touch targets are at least 44px. `tests/check.py` enforces this.

## Handoff: map and tools

### Map region levels and colour schemes

Colour on the map means progress, nothing else. Region names say which region is which; the fill says how far you got.

| Level | Label (short word under the name) | Fill | Name colour |
|---|---|---|---|
| 0 | none ("Tap to start" on Vice City at 0%) | Fog: fine diagonal lines | Light, thin dark outline |
| 1 | Passed | The accent at 35% over the background | Light |
| 2 | Explored | The accent | Dark |
| 3 | Finished, with a tick in front | Gold #FFC35A | Dark |

No glows and no per-region colours. The Keys label sits on the sea, so it stays light. Labels sit at each region's
roomiest spot (computed from the shapes), names in Anton 24, levels in DM Sans 600 15.

Three colour schemes, picked under the map or in the card's Colours option (kept in step). Gold is Finished in all three.

| Scheme | Accent | Background | Why |
|---|---|---|---|
| Neon night (default) | #FF5FA2 | #0E1311 | Pink reads as positive and energising, and against near-black it is the most eye-catching colour here; it is also Vice City's nightlife colour |
| Golden hour | #FF6B5B | #2A0F22 | Warm coral: positive, high-energy, a Leonida sunset |
| Ocean drive | #3FD6E8 | #08151F | Cyan: positive and calm; blue against gold is the pair colour-blind players tell apart best |

Text on the accent and on gold is the scheme's dark background colour (6:1 or more).

### Card

Two sizes: Post 4:5 (1080 x 1350, the size feeds show largest and Instagram's profile grid crops least) and Story 9:16
(1080 x 1920), painted at 2x. In stories nothing important sits in the top 250 or bottom 310 px, where Instagram puts
its own bars. Every card type (Map, Wrapped, Blend, Bingo) has its own layout in both sizes; nothing is letterboxed. A
feed shows a card at about a third of its size, so no text on a card is under 30px, and key text is 46px and up.
Cards are checked after a 1080px resize and JPEG at quality 70, the way feeds recompress them.

Every card is a poster of Leonida at dusk, grown from the hub's own mark (a striped sun setting over the road): a sky in
the theme's colours, the sun half under the horizon with the mark's five bands cut through it, the sea with the sun's
reflection, and the map rising from the sea in front of the sun like the land itself. A fine grain over everything
keeps the gradients from banding after a feed recompresses the image. Each theme has `sky`, `sun` and `water` colours.
The big number sits in the open sky in white (gold at 100%); the playstyle, rank or Blend result in the sun's light
gold under it; everything below the horizon sits on the dark sea. Anton is for the number, the card title and that
gold line; everything else is DM Sans 600. No small grey label above a heading.

Every card reads in the same order:

1. **Top row:** the hub mark and "Vice City Hub" on the left; platform (and the day, if chosen) on the right.
2. **Who:** the player's name or street name (DM Sans). A gold "Backed the hub" line under it for players who tipped.
3. **The number:** the % in the theme accent, Anton, as large as the column allows. At 100% it turns gold.
4. **The playstyle** (map card), **rank** (Wrapped) or **who carried** (Blend), in Anton and the sun's gold, just above the horizon.
5. **The verdict:** one true line only this player could have ("Has never set foot in Grassrivers",
   "4 of 6 regions still under the fog", "Finished every region of Leonida").
6. **The map**, rising from the sea in front of the sun. Seen regions in their level colour; unseen regions a flat dark
   fill (fine stripes turn to mush once a feed recompresses the image). Names on the story map and Blend story only,
   where they are large enough to read.
7. **The footer:** a hairline, what to do in plain words ("Can you beat 50%?", "Get your Leonida Wrapped",
   "Blend with me"), the address in the accent colour, and an exit arrow in an accent ring.
8. **Wrapped stats** show only what happened: a streak, dares or bingo lines that are still 0 are left out.

Blend paints the map by who explored it: you in the accent, your friend in gold, regions you both explored in stripes
of both. The site has no server, so cards never claim percentiles or "top X% of players"; the only comparison is the
friend's own score from their link.

### Interactions

| Element | Action | Result |
|---|---|---|
| Map region | Tap, Enter or Space | One step deeper (stops at Finished) and selects the region in the picker under the map |
| Map picker | Tap a level | The selected region goes to exactly that level, Not seen included |
| List level button | Tap a level | Region goes to exactly that level. Tapping the current level does nothing; levels below it show as reached (pink tint) |
| Street name: Share my name | Tap | Share sheet on phones, otherwise copies the nickname, the "known for" line and the link |
| Street name: Another one | Tap | Next nickname for the same tag |
| Street name: Put it on my card | Check | The card title uses the tag and nickname |
| Bingo cell | Tap | Ticks or unticks; the centre is free and fixed. Ticked squares take their theme colour, finished lines get a white edge, and the line under the card names the square you tapped |
| Bingo: Share my card | Tap | Shares the 1080×1350 card image (label, coloured grid, score); without a share sheet it downloads the image and copies the text grid and compare link |
| Bingo: Copy as text | Tap | Shares or copies the summary line, an emoji grid in theme colours and the compare link (`#b=s1.XXXX~Name`) |
| Daily dare: I did it | Tap | Marks today; the button goes away, the 7-day row fills, Share my streak becomes the primary button, and an Undo link appears under it |
| Card: Share card | Tap | Native share with the PNG where supported, otherwise download and copy the challenge text |
| Card: challenge link | Tap (text button) | Copies the challenge text and link |
| Map picker: Undo | Tap | Takes back the last map change (up to 30), from the map, the picker or the list |
| Clear my map | Tap | Clears the map; the message offers Undo for 6 seconds. On an empty map it only says so |
| Street name: Previous | Tap | Goes back one name; shown only after Another one |
| Daily dare: Past dares | Open | Every day since launch, newest first, done or missed. Read only, so the streak stays honest |
| Card: Copy image | Tap (desktop) | Copies the PNG to the clipboard for Discord and chats; hidden on touch screens and where the browser can't |
| Save a backup / Load a backup | Tap (footer) | Saves the whole run as a small JSON file; loading one restores it through the progress-link restore |

### Flow helpers

| Element | Behaviour |
|---|---|
| Next-step bar (`.nextbar`) | Phones and tablets. After the first map tap: your %, rank and "Make my card". Hidden while the map or the card is on screen, and after the card. |
| Card maker | Name, Size, Share, Download, Copy challenge link up front. Card type, platform, look and date stamp sit in "More options" (`details.more`). |
| Region list | Folded under "Edit regions as a list" (`details.list-toggle`). The map is the main control. |

### Responsive

| Width | Changes |
|---|---|
| < 400px | Region rows stack: name above three full-width steps |
| < 440px | Header hides the Regions link, so Spanish and Portuguese fit at 320px |
| ≥ 900px | Hero is two columns with the map sticky; card maker and tools are two columns |

### Edge cases

- Name of only spaces is ignored; the card falls back to "Player one", the street name to "Player".
- Storage blocked (private mode): everything works, nothing is remembered.
- No Web Share: the card downloads and the challenge text is copied.
- Reduced motion: all animation and transitions are off.

### Touch

- No tap-highlight flash, and no text selection on the map, game squares, level buttons or buttons.
- The toast never takes taps (`pointer-events: none`), so it can't swallow a tap on the map.
- The phone next-step bar hides whenever any part of the map is on screen.
- Bingo squares grow taller instead of spilling text; on phones the card uses the full width with 10px words, under 360px each square shows its short name, and
  long words never break. `tests/check.py` checks every monthly card in every language at 320, 360 and 390px.
- `tests/taps.py` taps and untaps every control as a phone, a tablet and a desktop (nearly 1,000 checks) and runs on
  every pull request, in English and in Spanish from a challenge link.

### 100% checklist, launch help, tips

- `/gta-6-100-percent-checklist`: 31 categories with required counts from GTABase (checked 20 Nov 2026), a −/+ stepper
  and a number field per category, a progress bar that turns gold when the requirement is met, "Show only what's left",
  and a sticky total. Saved as `vch.hundred` ("key:n,…"), so backups and progress links carry it.
- `/gta-6-guide`: This week in Leonida (dated, updated weekly), the Chapter 1 checklist (`vch.chapterOne`), saving,
  known issues and community settings tips, money by chapter, getting around. Every section names its source.
- Card sign shows a playstyle (where you went most), not a rank. Daily streak has an automatic shield: one missed day in
  any 7 doesn't break it. Friend challenge has "Send it back".
- Tips: what tips pay for, that they buy nothing, a "Stay safe" box (only these two ways, we never DM, never ask for a
  recovery phrase), and an honor-system "Already tipped?" thank-you line.

### Friends board

Under the score in the hero, shown once a challenge link has brought at least one friend. Up to 8 friends, labelled
"Self-reported". Names and maps travel in challenge links (`b=name~code|…`) and merge on each device (`vch.board`):
one entry per name, the higher score wins, so old links never lower anyone. Your own row is drawn live from your map.
One line on top gives the next step ("2 steps to pass Mia"; ties go to the friend). "Send the board" shares the link;
"Clear board" has Undo. A name is asked for before sending.
