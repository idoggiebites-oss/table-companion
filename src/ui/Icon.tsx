/**
 * The icon set. SVG, never a glyph.
 *
 * Ported from V2, and extended to cover what this app actually draws: its
 * twelve standard actions and its thirteen class marks, which were Unicode.
 *
 * MEASURED, in this codebase, before any of it was drawn. Of the 25
 * codepoints shipped in the UI and in `domain/actions.ts` /
 * `domain/guidance.ts`, eight are `Extended_Pictographic` — and U+2728
 * SPARKLES, the wizard, has `Emoji_Presentation=Yes`, which means colour is
 * the DEFAULT and the U+FE0E text selector is a hint a platform may ignore.
 * A wizard's card has been rendering a colour sparkle on iOS and there is no
 * property that stops it. Seven more are the platform's choice — U+2692,
 * U+2694, U+2699, U+21AA, U+23F1, U+271D and U+262F — so they are correct
 * on the machine they were written on and a lottery everywhere else.
 * Named by codepoint rather than shown: this file must not be the one
 * exception to the rule it introduces.
 *
 * That is the argument for SVG, rather than taste:
 *
 *   - deterministic everywhere, with no font-fallback roulette
 *   - `stroke: currentColor`, so an icon inherits its token and can never
 *     arrive in a colour that means something else — a red sword in this
 *     palette is a lie the table reads at speed
 *   - no baseline, line-height or advance-width surprises inside a 44px target
 *
 * The glyphs that legitimately remain — chevrons, the middot, dashes, the
 * ✦/◇/− family — are text and stay text. `check-glyphs` holds the line.
 *
 * One viewBox and one stroke width, so they sit together in a row.
 */
export type IconName =
  /* classes */
  | "sword" | "staff" | "note" | "sun" | "leaf" | "fist" | "shield" | "bow"
  | "dagger" | "spark" | "pact" | "flask" | "moon"
  /* the twelve actions */
  | "guard" | "slip" | "dash" | "hide" | "help" | "shove" | "clock"
  | "search" | "hammer" | "cycle"
  /* the shell */
  | "person" | "list" | "book" | "eye" | "die" | "group" | "more" | "pack"
  | "map" | "diamond" | "pencil" | "page"
  /* the six worn slots */
  | "helm" | "cloak" | "pouch";

const PATHS: Record<IconName, string> = {
  sword: "M14.5 3.5 17 6l-7.5 7.5-2.5-2.5L14.5 3.5ZM7 13l-2 4 4-2M5.5 15.5 3 18",
  staff: "M14 3 6 19M11 6h6M4 10h5",
  note: "M8 16V5l8-2v11M8 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM16 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  sun: "M10 4v2M10 14v2M4 10h2M14 10h2M6 6l1.5 1.5M14 6l-1.5 1.5M6 14l1.5-1.5M14 14l-1.5-1.5M12.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  leaf: "M4 16C4 9 9 4 16 4c0 7-5 12-12 12ZM7 13l6-6",
  fist: "M6 9V6.5a1.5 1.5 0 0 1 3 0V9m0 0V5.5a1.5 1.5 0 0 1 3 0V9m0 0V6.5a1.5 1.5 0 0 1 3 0V12a5 5 0 0 1-5 5H9a5 5 0 0 1-3-2l-2-3",
  shield: "M10 3 4 5.5v4.8c0 3.6 2.4 6.8 6 7.7 3.6-.9 6-4.1 6-7.7V5.5L10 3Z",
  bow: "M5 3c6 2 9 6 10 14M5 3l3 6M5 3l6 3M15 17l-9-4",
  dagger: "M10 3v9M7 12h6l-3 5-3-5ZM6 9h8",
  spark: "M10 3v14M3 10h14M5.5 5.5l9 9M14.5 5.5l-9 9",
  pact: "M10 17s-6-3.6-6-8a3.4 3.4 0 0 1 6-2 3.4 3.4 0 0 1 6 2c0 4.4-6 8-6 8Z",
  flask: "M8 3h4M9 3v5l-4 7a1.6 1.6 0 0 0 1.4 2.4h7.2A1.6 1.6 0 0 0 15 15l-4-7V3M6.5 13h7",
  /* The monk. A crescent rather than a yin-yang, which is emoji-capable and
     which no stroke-only drawing can honestly render anyway. */
  moon: "M13.5 3.6A7 7 0 1 0 16.4 12 5.6 5.6 0 0 1 13.5 3.6Z",

  /* Dodge: a guard raised, not a shield — Paladin already owns the shield. */
  guard: "M10 3 4 5.5v4.8c0 3.6 2.4 6.8 6 7.7 3.6-.9 6-4.1 6-7.7V5.5L10 3ZM7.5 10l1.8 1.8L13 8",
  /* Disengage: stepping out from between two things. */
  slip: "M4 4v12M16 10H8M11 6.5 14.5 10 11 13.5",
  /* Dash: motion lines behind a stride. */
  dash: "M3 6h6M3 10h4M3 14h6M11 4l4 6-4 6",
  hide: "M3 3l14 14M8 5.2A6.9 6.9 0 0 1 10 5c5 0 8 5 8 5a13 13 0 0 1-2.4 2.9M12 12a2 2 0 0 1-2.8-2.8M5.6 6.6A13 13 0 0 0 2 10s3 5 8 5a7.6 7.6 0 0 0 2.4-.4",
  /* Help: a hand offered to another. */
  help: "M10 17s-6-3.6-6-8a3.4 3.4 0 0 1 6-2 3.4 3.4 0 0 1 6 2c0 4.4-6 8-6 8ZM7.5 9.5 10 12l2.5-2.5",
  /* Shove: pushed away, and off its feet. */
  shove: "M3 5v10M6 10h8M11 6.5 14.5 10 11 13.5M17 5v10",
  clock: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM10 6v4l2.5 2",
  search: "M13.5 8.5a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM12.2 12.2 17 17",
  hammer: "M4 16 12 8M9.5 5.5 14 10M12.5 2.5 17.5 7.5M9.5 5.5l3-3M14 10l3.5-2.5",
  /* Off-hand: the second swing, coming round. */
  cycle: "M16 6v4h-4M4 14v-4h4M5.2 7.6A6 6 0 0 1 16 8M14.8 12.4A6 6 0 0 1 4 12",

  person: "M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 17c0-3.3 2.7-5 6-5s6 1.7 6 5",
  list: "M4 5.5h12M4 10h12M4 14.5h7",
  book: "M4 4.5A2 2 0 0 1 6 3h9v13H6a2 2 0 0 0-2 1.5V4.5ZM15 16v2H6",
  eye: "M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5ZM12 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  die: "M4 6.5 10 3l6 3.5v7L10 17l-6-3.5v-7ZM4 6.5 10 10l6-3.5M10 10v7",
  /*
   * The table: the room and who is at it.
   *
   * This was a cog, twice, and a cog is wrong twice over. At 20px a stroked
   * circle with radial teeth IS the sun glyph — which this set also has, and
   * the two sat four pixels apart in the header. And the button does not open
   * settings: it opens the room, its code, its members, and the way out. Two
   * heads say that; a cog says "preferences".
   */
  group: "M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 16.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5M13.2 4.4a2.5 2.5 0 0 1 0 4.7M14.5 12.4c1.9.5 3 1.9 3 4.1",
  /* Three dots. The one glyph replaced here that was NOT at risk — U+22EF is
     text-only — but a lone character among SVG neighbours sits on a different
     baseline and at a different weight, and that is visible in a row. */
  more: "M5 10h.01M10 10h.01M15 10h.01",
  /* Gear, the tab: what you carry, not what you configure. */
  pack: "M6.5 6V4.5a3.5 3.5 0 0 1 7 0V6M4 6h12l-1 10.5a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 3 16.5L4 6Z",
  /* Notes. A written page, because `pencil` next to `sword` in a six-tab
     row was two diagonal strokes of the same length two tabs apart. */
  page: "M5 2.5h6.5L15.5 6.5V17.5H5V2.5ZM11.5 2.5V6.5H15.5M7.5 10h5M7.5 13.5h5",
  pencil: "M4 16h2.5L16 6.5a1.8 1.8 0 0 0-2.5-2.5L4 13.5V16ZM12.5 5.5 14.5 7.5",
  map: "M3 5.5 7.5 4v11L3 16.5v-11ZM7.5 4 12.5 5.5v11L7.5 15V4ZM12.5 5.5 17 4v11l-4.5 1.5v-11Z",
  /* What the app knows about a class it has never heard of: nothing useful. */
  diamond: "M10 3.5 15 10l-5 6.5L5 10l5-6.5Z",

  helm: "M4 12V9a6 6 0 0 1 12 0v3M4 12h12v3.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15.5V12ZM10 12v5",
  cloak: "M7 3.5 10 6l3-2.5M7 3.5C4.5 5 3 9 3 13v3.5h14V13c0-4-1.5-8-4-9.5M10 6v10.5",
  pouch: "M6 8V6.5a4 4 0 0 1 8 0V8M4.5 8h11l.8 6.6A2 2 0 0 1 14.3 17H5.7a2 2 0 0 1-2-2.4L4.5 8Z",
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      className="ico"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * The brand marks. Larger and more detailed than the interface icons, so they
 * live apart from the 20x20 set — a crest for the header, a shield for a level.
 * These name their tokens rather than inheriting, because they are the one
 * place the accent is deliberate rather than borrowed.
 */
export function Crest({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 3 34.7 11.5v17L20 37 5.3 28.5v-17z" stroke="var(--gold-edge)"
            strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M20 3 27 20l-7 17-7-17z M5.3 11.5 20 20l14.7-8.5 M5.3 28.5 20 20l14.7 8.5"
            stroke="var(--gold-edge)" strokeWidth="0.9" strokeLinejoin="round" opacity="0.65" />
      <text x="20" y="24" textAnchor="middle" fontSize="10" fontWeight="600"
            fill="var(--gold-ink)" fontFamily="var(--mono)">20</text>
    </svg>
  );
}

export function LevelShield({ level, size = 44 }: { level: number; size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 40 46" fill="none" aria-hidden="true">
      <path d="M20 2 37 8v18c0 9-8 15.5-17 18C11 41.5 3 35 3 26V8z" fill="var(--gold-wash)"
            stroke="var(--gold-edge)" strokeWidth="1.4" strokeLinejoin="round" />
      <text x="20" y="30" textAnchor="middle" fontSize="19" fontWeight="600"
            fill="var(--gold-ink)" fontFamily="var(--mono)">{level}</text>
    </svg>
  );
}
