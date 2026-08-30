---
version: alpha
name: Table-Companion-design
description: "A lamplit table in a dark room. Near-black greens (#0f1211 ground, #161a18 panel) rather than neutral greys — the whole neutral ramp is biased toward the green in the ink, so nothing reads as machine grey. One chromatic accent, an old gold (#c9a227), reserved for whose turn it is and for the single control that moves the fight forward; it is never decorative. Everything else that carries colour carries MEANING: red is damage, green is healing, amber is bloodied, violet is concentration. Type is the operating system's own sans — no webfont is shipped, deliberately, because a table opens this on a phone with no signal — with a serif display face for names and a monospace for every number that has to line up. Cards are flat panels separated by hairlines rather than shadows; elevation is luminance, never a hue, because a hue in this app already means something."

colors:
  primary: "#c9a227"
  on-primary: "#0f1211"
  primary-dim: "#8a7220"
  primary-wash: "#1f1c14"
  primary-trim: "#6d5a1c"
  ink: "#e8ede9"
  ink-dim: "#a7b1ac"
  ink-muted: "#78837d"
  ink-faint: "#4c554f"
  canvas: "#0f1211"
  surface-1: "#161a18"
  surface-2: "#1e2320"
  hairline: "#272e2a"
  semantic-damage: "#d9534a"
  semantic-heal: "#4fa97a"
  semantic-unharmed: "#4fa97a"
  semantic-injured: "#8fa85e"
  semantic-bloodied: "#d4a03c"
  semantic-concentration: "#9887c9"
  semantic-steel: "#6e8fa8"

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

**One accent.** Old gold, `#c9a227`. It marks whose turn it is and the single
control that moves the fight forward. If a second thing on screen is gold, one
of them is wrong.

**The neutrals are green, not grey.** `#0f1211` → `#161a18` → `#1e2320`, with a
`#272e2a` hairline. A pure neutral ramp reads as unconsidered; this one is
biased toward the green in the ink so the whole surface feels lamplit.

**Every other colour means one thing and only that thing:**

| token | meaning |
|---|---|
| `#d9534a` | damage |
| `#4fa97a` | healing, and unharmed |
| `#8fa85e` | injured |
| `#d4a03c` | bloodied |
| `#9887c9` | concentration |
| `#6e8fa8` | disclosure — what the players are allowed to know |

Never reach for one of these because a screen needs a colour. A red border on
something that is not damage is a lie the table will read at speed.

**Elevation is luminance, never a hue.** The active row in the initiative order
is brighter, not tinted — red already means damage in that list.

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

## Layout

**Eight spacing steps: 2, 4, 6, 8, 10, 12, 16, 18.** Cards are padded 16;
rows gap 10. Prefer `gap` on a flex or grid parent over per-element margins.

**44px minimum on anything you tap.** This has been broken four separate times
and each time it was found by measuring, not by looking. A control that is
44px tall with generous padding is right; seven of them wrapped into a ragged
column is not — group them into one declared strip.

**Declare your bands.** A grid sized for the children it had when it was
written will silently push the next one onto an implicit row. State the rows,
and give a component one child that holds its controls, so the next control
added joins that strip instead of inventing a band.

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
