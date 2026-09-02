---
version: alpha
name: Table-Companion-design
description: "Two real themes, not one filtered into the other. Light is parchment on a lit table: a warm off-white ground (#faf7f2) with white cards lifted by shadow, near-black ink, and an old gold that only ever appears twice on a screen. Dark is the lamplit room this app was first drawn for, kept, and now neutral rather than green-biased so that one warm ink reads on both; there elevation goes back to luminance and hairlines, because a shadow on a near-black ground is invisible work. One accent, old gold, split into four tokens because a single gold cannot fill, outline and write on a light ground — it is 2.29:1 as text there. Everything else that carries colour carries MEANING: red is damage, green is healing, amber is bloodied, violet is concentration, steel is disclosure. Type is the operating system's own sans — no webfont is shipped, deliberately, because a table opens this on a phone with no signal — with a serif display face for names and a monospace for every number that has to line up. Every pair on this page is measured by npm run lint, not chosen."

colors:
  # Light is the default. Dark is the second column, and the two blocks in
  # app.css that carry it are asserted identical by check-contrast.mjs.
  #                          light      dark
  primary:                 "#c8a04d"  # #c8a04d — gold as a FILL
  on-primary:              "#1e1f22"  # #1e1f22 — the label on that fill, 6.74:1
  primary-ink:             "#856527"  # #d5b570 — gold as TEXT
  primary-edge:            "#a87f31"  # #c8a04d — gold as a BORDER or bar
  primary-wash:            "#faf3e4"  # #241f16 — the ground under something chosen
  ink:                     "#1e1f22"  # #f1ede4
  ink-dim:                 "#686c73"  # #9ba1a9
  ink-faint:               "#878680"  # #727880 — placeholder and disabled only
  canvas:                  "#faf7f2"  # #131416
  surface-1:               "#ffffff"  # #1e1f22
  surface-2:               "#f1ede4"  # #26282c — every button and every field
  hairline:                "#e6e2da"  # #33363b
  semantic-damage:         "#b03a3a"  # #e0706b
  semantic-heal:           "#2b765e"  # #5fbe97
  semantic-unharmed:       "#2b765e"  # #5fbe97
  semantic-injured:        "#7a6a2e"  # #a9b872
  semantic-bloodied:       "#856527"  # #d8ae5e
  semantic-concentration:  "#6b5ba8"  # #a899da
  semantic-steel:          "#4f6e86"  # #7fa3be

typography:
  display:
    fontFamily: '"Iowan Old Style", "Hoefler Text", "Palatino Linotype", Palatino, Georgia, serif'
    fontSize: 3.2rem
    fontWeight: 400
    lineHeight: 1.1
  hero-number:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, monospace
    fontSize: 3rem
    fontWeight: 500
    lineHeight: 1.0
  title:
    fontFamily: '"Iowan Old Style", "Hoefler Text", Palatino, Georgia, serif'
    fontSize: 1.5rem
    fontWeight: 400
    lineHeight: 1.2
  card-title:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: 1.2rem
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: 1.0rem
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: 0.94rem
    fontWeight: 400
    lineHeight: 1.45
  note:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: 0.84rem
    fontWeight: 400
    lineHeight: 1.45
  aside:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: 0.8rem
    fontWeight: 400
  label:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: 0.66rem
    fontWeight: 500
    letterSpacing: 0.08em
    textTransform: uppercase
  micro:
    fontFamily: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    fontSize: 0.54rem
    fontWeight: 500
    letterSpacing: 0.08em
    textTransform: uppercase

spacing:
  scale: [2, 4, 6, 8, 10, 12, 16, 18]
  card-padding: 16px
  row-gap: 10px

shape:
  card: 12px
  control: 8px
  pill: 999px

targets:
  minimum-tap: 44px
---

## Overview

A companion for a D&D table playing in person. Six people are holding phones in
a dim room, half of them have never played, and the app is a thing you glance
at between saying words out loud. It is not a virtual tabletop and it never
rolls a die — it asks for the number.

Everything below follows from that. Legibility at arm's length beats density.
Colour is information, not decoration. Nothing loads from a network mid-session.

## Colors

Ported from V2, whose values came from a mockup and were measured rather than
picked. Every pair below is asserted by `scripts/check-contrast.mjs` on every
`npm run lint`: body text at 4.5:1, and a non-text indicator that carries
meaning — a border marking the active row, a bar fill — at 3:1.

**Two themes, and light is the default.** This file used to say "dark only, by
constraint — tables are dimly lit". That was withdrawn deliberately: the light
ground is the one that was drawn, and a phone at a table is as often on a lit
one. Three states, not two — "system" is the default and is the ABSENCE of a
`data-theme` attribute. See `ui/useTheme.ts`.

**One accent, in four tokens.** Old gold. It marks whose turn it is and the
single control that moves the fight forward. If a second thing on screen is
gold, one of them is wrong. It needs four tokens because one gold cannot do
four jobs on a light ground: `#c8a04d` measures **2.29:1 as text** there, so it
fills and outlines but never writes. There is deliberately no `--gold`, because
the whole point of splitting it is that the wrong one cannot be reached for by
habit — and 49 rules in this stylesheet had reached for it.

| token | job |
|---|---|
| `--gold-fill` | a filled button, an active row |
| `--on-gold` | the label on that fill — ink, never white, which is 2.48:1 |
| `--gold-ink` | gold used as text |
| `--gold-edge` | underlines, borders, bar fills |
| `--gold-wash` | the ground under something chosen |

**Five of V2's light values did not survive this app**, and this is the useful
part of the port to remember. V2 uses `--surface-2` sparingly; V1 puts **every
button and every input** on it. `--ink-dim`, `--gold-ink`, `--gold-edge`,
`--heal` and `--bloodied` all passed on canvas and on white and failed on the
one ground V2 never tested them against. They are V2's colours nudged until
they pass on all three. The lesson is in the check, not the values: a pair
table that omits a ground is a contrast check that agrees with you.

**Every other colour means one thing and only that thing:**

| meaning | light | dark |
|---|---|---|
| damage | `#b03a3a` | `#e0706b` |
| healing, and unharmed | `#2b765e` | `#5fbe97` |
| injured | `#7a6a2e` | `#a9b872` |
| bloodied | `#856527` | `#d8ae5e` |
| concentration | `#6b5ba8` | `#a899da` |
| disclosure — what the players are allowed to know | `#4f6e86` | `#7fa3be` |

Never reach for one of these because a screen needs a colour. A red border on
something that is not damage is a lie the table will read at speed.

**Elevation is shadow on light and luminance on dark** — never a hue, since a
hue in this app already means something. `--lift-1` is a resting card and
`--lift-2` is anything over the page; on dark both are `none` and
`--panel-border` carries the separation instead. Two levels of depth is all
this app has. The active row in the initiative order is brighter or washed,
never tinted — red already means damage in that list.

## Icons, and why none of them are characters

Nothing in this app draws an icon with a Unicode character, and
`scripts/check-glyphs.mjs` refuses one at lint time.

Measured here before the rule was written. Of the **25 codepoints the UI
shipped**, across three tables — the twelve standard actions in
`domain/actions.ts`, the thirteen class marks in `domain/guidance.ts`, the six
worn slots in `domain/slots.ts`, plus the chrome — **eight are
`Extended_Pictographic`**, and three of those have `Emoji_Presentation=Yes`,
which means colour is the *default* and the U+FE0E text selector is a hint a
platform may ignore:

| always colour, unstoppable | the platform's choice |
|---|---|
| U+2728 sparkles — the **wizard** | U+2694 swords · U+2699 gear |
| U+1F5E1 dagger — the **off hand** | U+2692 hammer · U+21AA hook arrow |
| U+26D1 helm — the **head slot** | U+271D cross · U+262F yin-yang |

A wizard's class card was rendering a colour sparkle on iOS and no CSS
property stops it. The worn figure drew three of its six slots as pictures.
The other seven were correct on the machine they were written on and a lottery
everywhere else.

So the set is SVG — one viewBox, one stroke width, `stroke: currentColor`.
That last part is the contract: an icon inherits the token of wherever it
sits, so it can never arrive in a colour that means something else, which in
this palette would be a lie the table reads at speed.

**What legitimately remains is text and stays text:** chevrons, the middot,
dashes, and the `✦ / ◇ / − / ✕` family. None of those are pictographic. The
one exception made deliberately was the header's three dots — U+22EF was never
at risk, but a lone character among SVG neighbours sits on a different
baseline at a different weight, and that is visible in a row.

The lint cannot reach imported content: a homebrew statblock may carry an
emoji in its name. That is the content author's, and it renders as they wrote
it — the app does not police a table's own words.

## Typography

No webfont is shipped, deliberately. A table opens this on a phone in a
basement with no signal, and a font that arrives late is a layout that moves
while somebody is reading it.

Three families, each with a job:

- **Serif display** for names — a character, a creature, a place. The one
  romantic gesture in the app.
- **System sans** for everything you read.
- **Monospace for every number.** Hit points, initiative, modifiers, damage.
  Numbers that change must not reflow the row they live in.

The scale is twelve steps and nothing between them: `0.54 0.6 0.66 0.72 0.78
0.8 0.84 0.88 0.94 1.0 1.1 1.2` rem, plus display sizes `1.4 1.5 1.6 2 3 3.2`.
It got there from 43 hand-picked sizes, three of which sat within a third of a
pixel of each other on one screen. That does not read as hierarchy; it reads as
blur.

Weights: 400, 500, 600. Nothing else.

**A button says a sentence; a label shouts.** Every control was 0.78rem
tracked uppercase — the treatment a section *label* gets — so a hundred and
forty things you press were set in the same voice as the words naming the
boxes they sat in, and none of them read as the thing to do next. Controls are
sentences at `--t-sm` now. Tracked caps survive on `.label`, and nowhere else.

A consequence worth knowing: `innerText` returns RENDERED text, so a browser
assertion written against `"0 OF 3"` broke when the transform came off, while
the source had said `"0 of 3"` all along. Assert the words, not the
typography.

## Layout

**Eight spacing steps: 2, 4, 6, 8, 10, 12, 16, 18.** Cards are padded 16;
rows gap 10. Prefer `gap` on a flex or grid parent over per-element margins.

**The shell: five declared bands, and one of them scrolls.**

    header            pinned    who you are, where you are, the two ways in
    band              pinned    the offline notice, the seat, a step rail
    ── scroll ──                the only thing that moves
    actions           pinned    the control that ends the turn
    band              pinned    the turn bar, then the tab bar

This was a scrolling DOCUMENT with the chrome riding at the top and the tab
bar fixed over the bottom of it. That works right up until the control you
must press is below the fold — and at a table the scroll happens while five
people wait. `document.body.scrollHeight` is now the height of the phone, and
anything measuring the app's height measures `.sh-scroll`.

Heights are `dvh`, never `vh`: `100vh` on iOS counts browser chrome that is
not there, and a pinned footer then sits below the bottom of the screen.

**Five children are always rendered, empty or not.** A grid sized for the
children it happens to have hands the scroller an `auto` row instead of `1fr`
the moment one goes missing — and then the middle stops scrolling and the page
grows instead. The empty bands and the `:empty` action bar are that rule.

**The pinned bar is a portal, not a prop.** The control that ends a turn
belongs to the screen that knows when it is allowed — whether a DM may
advance, whether a rest is offered, how many picks are still owed. Passing
that up would give every one of those rules a second home in `App` and let the
two drift. A screen renders its own controls *down* into the bar with
`<Actions>`.

**The header has equal slots on both sides, always rendered.** `flex: 1` on
the title centres it in what is LEFT OVER, so a lead button with no trailing
one puts every title half a tap target right of centre — visible on a phone
and invisible in every test. The slots are the width the buttons already
claim, so an empty one costs nothing that was not already spent.

The header is also the one place on every screen reserved for saying *where
you are*, which is what let the creation rail stop being fourteen labelled
pills that had to be swiped and become a run of dots on one rule.

**One navigation, and it is the bottom bar.** Decided 2 Sep 2026, against the
concept, deliberately.

The concept's sheet carries a segmented row — Overview, Combat, Inventory,
Notes — under a bottom bar of Sheet, Characters and Log. That is the same
split this app already makes, expressed one level lower: our bar IS
Combat / Sheet / Spells / Gear / Notes / Log for a player and
Combat / Party / Prep / Book / Log for a DM. Adding the segments on top would
put two navigations on one screen, which is the thing the concept itself
deleted from its own hub.

Its three-tab bar works because it has no DM. Party, Prep and Book have
nowhere to go in a bar of three, and the concept has no answer for them
because it has never had to.

Nor can the two seats share one bar: the union is nine entries, which measures
**43px each on a 390px phone** — under the floor, on the rule this app has
broken four times already.

So: one bar, contents by seat, no segments. What DID change is the order —
**each bar leads with that seat's home**. This app already decides where you
land ("a player's home is their sheet; a DM's is the party they are looking
after") and both bars led with Combat anyway, so the first tab was never the
one you were standing on. The eye starts at the left of a bar.

The **tab bar is a band at the foot**, with an icon and a word on each entry.
It was six words across the top under three other bars, and at six entries it
overflowed a 390px phone and scrolled sideways — a tab you have to swipe to is
a tab a first-timer never finds. The icon is what makes six fit where six
words did not.

**The things that own the bottom, in order.** The tab bar is lowest: it is the
resting state. The turn bar stands ON it, because a player mid-turn is exactly
the person who wants to check their own sheet. The roll pad and any sheet
cover both — those are moments you are part-way through answering, and
navigating away is not what the thumb is there for.

**44px minimum on anything you tap.** This has been broken four separate times
and each time it was found by measuring, not by looking. A control that is
44px tall with generous padding is right; seven of them wrapped into a ragged
column is not — group them into one declared strip.

**Declare your bands.** A grid sized for the children it had when it was
written will silently push the next one onto an implicit row. State the rows,
and give a component one child that holds its controls, so the next control
added joins that strip instead of inventing a band.

## Pictures

The app ships no art and no webfont, and that is not going to change. The one
picture that can appear is a **portrait the player supplies**, on their own
sheet.

It is device-local, and never an event. The log replays on every phone at the
table and every event can be taken back — so an image in it is weight on every
device forever, whether or not that device shows the character, and undo has
to carry it too. This app already says where a picture goes: characters,
content and seats live on the device; the log lives in the room.

The cost is real, and the app should never pretend otherwise: **a portrait
does not travel.** The player who set it sees it; the DM does not. Making it
travel needs somewhere to put bytes that is not the log, which is the same
unanswered question as the map screen.

Nothing is stored as it arrived. A phone camera hands over three to eight
megabytes and `localStorage` has about five for everything this device owns,
so the file is drawn to a canvas at **256px, centre-cropped** — a face
stretched to a square is worse than one with its edges trimmed — and written
as JPEG at 0.82, which lands around two kilobytes.

## Screen order

A screen is ordered by the questions it raises, not by the order its features
were built — that second order is invisible to whoever wrote it and obvious to
everyone else. Top to bottom:

1. **What is waiting on me?** A save owed, a reaction offered, a roll asked for.
2. **What can I do about it?** The actions this moment allows.
3. **What is true right now?** Hit points, conditions, whose turn it is.
4. **What am I?** The reference you looked up once and glance at since.

A card that is none of those four — a description with nothing on the other end
of it — does not belong on a play screen at all.

## Components

**Card.** Flat panel, `#161a18`, 12px radius, hairline border, 16px padding.
A header row of an uppercase label on the left and a muted fact on the right.
No shadows.

**Label.** Uppercase, 0.66rem, letter-spaced, muted. It names the card or the
block. Uppercase is a CSS transform — remember that `innerText` then returns
the rendered case and the accessible name keeps the source case.

**Row.** Flex, 10px gap, wrapping, vertically centred. `.tight` for 8px.

**Number.** Monospace, always. `font-variant-numeric: tabular-nums` wherever
digits stack.

**Note / aside.** The two shapes of small print: `.note` is a 0.84rem
paragraph, `.aside` is 0.8rem inline. Both take their colour from `.faint`
rather than setting one — one class, one job.

## Do's and Don'ts

- **Do** put a literal size or margin in the stylesheet, on the scale. **Don't**
  put one in JSX — `check-inline` refuses it.
- **Do** define every custom property you reference. **Don't** trust that a
  `var()` resolves: CSS fails silently and it fails WHOLE, so
  `border: 1px solid var(--typo)` is not a wrong colour, it is no border.
  `check-css` refuses an undefined one.
- **Do** give a component its own class. **Don't** borrow another's because it
  looks right — `check-selectors` exists because that broke a test suite a long
  way from the cause.
- **Do** use colour to carry meaning. **Don't** use it to carry emphasis.
- **Do** let the layout do the spacing. **Don't** stack per-element margins.

## Known gaps

- `padding` is still hand-picked and not on a scale. It is load-bearing for the
  44px tap targets, so snapping it blind is how those break a fifth time.
- 43 browser-suite selectors are ambiguous, baselined in
  `scripts/selector-baseline.txt`. The list is meant to shrink.
