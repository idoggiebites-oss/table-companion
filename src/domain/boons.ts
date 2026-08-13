/**
 * Boons — blessings, buffs, the effect of a magic item somebody drank.
 *
 * The app holds them and SHOWS them; it never applies them. That is the same
 * decision as everywhere else here: the level-up names the die and holds the
 * modifier while a person rolls it, and a boon does the same. Folding +1d4
 * into a printed attack bonus would produce a number that disagrees with the
 * table's own arithmetic and no way to see why.
 *
 * A boon is scoped to the rolls it touches, so a Bless surfaces on an attack
 * and on a saving throw but stays out of the way on a skill check. Getting
 * this wrong in the other direction — showing every boon on every roll — is
 * how a prompt becomes noise that people learn to ignore.
 *
 * Conditions are a closed set from the rules; boons are open, because the next
 * one is whatever the DM just invented.
 */

/** Which rolls a boon has anything to say about. */
export type BoonScope = "attack" | "damage" | "save" | "check" | "ac";

export const BOON_SCOPES: readonly BoonScope[] = [
  "attack",
  "damage",
  "save",
  "check",
  "ac",
];

export interface Boon {
  readonly id: string;
  readonly name: string;
  /** Shown verbatim: "+1d4", "+2", "advantage". Never parsed, never added. */
  readonly modifier?: string;
  readonly applies: readonly BoonScope[];
  /** What it is and when it ends — free text, because durations vary wildly. */
  readonly note?: string;
}

/**
 * A handful of common ones so granting a Bless is one tap rather than four
 * fields. All SRD. The list is a convenience, not a vocabulary — anything
 * typed by hand is equally real.
 */
export const COMMON_BOONS: readonly Omit<Boon, "id">[] = [
  {
    name: "Bless",
    modifier: "+1d4",
    applies: ["attack", "save"],
    note: "Concentration, up to 1 minute",
  },
  {
    name: "Guidance",
    modifier: "+1d4",
    applies: ["check"],
    note: "Concentration, up to 1 minute",
  },
  {
    name: "Bardic Inspiration",
    modifier: "+1d6",
    applies: ["attack", "save", "check"],
    note: "Once, within 10 minutes",
  },
  {
    name: "Shield of Faith",
    modifier: "+2",
    applies: ["ac"],
    note: "Concentration, up to 10 minutes",
  },
  {
    name: "Aid",
    modifier: "+5 max HP",
    applies: [],
    note: "8 hours",
  },
  {
    name: "Advantage",
    modifier: "advantage",
    applies: ["attack"],
    note: "Until used",
  },
];

export function boonsFor(
  boons: readonly Boon[],
  scope: BoonScope,
): readonly Boon[] {
  return boons.filter((b) => b.applies.includes(scope));
}

/** "Bless +1d4" — one line for a chip or a roll prompt. */
export function describeBoon(b: Boon): string {
  return b.modifier ? `${b.name} ${b.modifier}` : b.name;
}

/**
 * Boons that touch armour class, summarised for the sheet. Deliberately NOT
 * added to the derived value: the same reasoning as everywhere else, and a
 * shown "+2 from Shield of Faith" is something a player can argue with.
 */
export function acBoons(boons: readonly Boon[]): readonly Boon[] {
  return boonsFor(boons, "ac");
}
