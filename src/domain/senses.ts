/**
 * What a character can see, and what light does to them.
 *
 * 310 of the 605 races carry a Darkvision trait and 36 carry Sunlight
 * Sensitivity — the same mechanic pointing the other way. The app showed both
 * as prose in a trait list and knew neither, so it could not answer the
 * question a table actually asks: it is dark, what do I roll?
 *
 * Captured now, used shortly. A DM setting the light in a room is the point
 * of this file; the parsing has to exist first, and it has to be right, or
 * the environment control would be built on a guess.
 */

/** How far they see in the dark, and whether daylight hurts. */
export interface Senses {
  /** Feet of darkvision. 0 for none, 60 usual, 120 for superior. */
  readonly darkvision: number;
  /** Drow and their kin: disadvantage in direct sunlight. */
  readonly sunlightSensitivity: boolean;
  /** Rarer, and rarely mechanised: kept because the sheet should say it. */
  readonly blindsight: number;
  readonly tremorsense: number;
  readonly truesight: number;
}

export const NO_SENSES: Senses = {
  darkvision: 0, sunlightSensitivity: false,
  blindsight: 0, tremorsense: 0, truesight: 0,
};

export interface TraitLike {
  readonly name: string;
  readonly desc?: string;
  readonly text?: string;
}

/** "…within 60 feet of you…" — the number is always stated in the trait. */
function feetIn(text: string, fallback: number): number {
  const m = /(\d{2,3})\s*(?:feet|ft)/i.exec(text ?? "");
  return m ? Number(m[1]) : fallback;
}

/**
 * Read off the traits, because that is where the file puts it — there is no
 * structured field for any of this in any compendium the app reads.
 *
 * A range that cannot be found falls back to the rulebook's usual rather than
 * to zero: a race whose trait says "Darkvision" and nothing parseable still
 * has darkvision, and saying 0 would be worse than saying 60.
 */
export function sensesFrom(traits: readonly TraitLike[] | undefined): Senses {
  let out = { ...NO_SENSES };
  for (const t of traits ?? []) {
    const name = (t.name ?? "").toLowerCase();
    const text = t.desc ?? t.text ?? "";

    if (/superior darkvision/.test(name)) {
      out = { ...out, darkvision: Math.max(out.darkvision, feetIn(text, 120)) };
    } else if (/darkvision/.test(name)) {
      out = { ...out, darkvision: Math.max(out.darkvision, feetIn(text, 60)) };
    }
    if (/sunlight sensitivity|light sensitivity/.test(name)) {
      out = { ...out, sunlightSensitivity: true };
    }
    if (/blindsight/.test(name)) out = { ...out, blindsight: feetIn(text, 10) };
    if (/tremorsense/.test(name)) out = { ...out, tremorsense: feetIn(text, 30) };
    if (/truesight/.test(name)) out = { ...out, truesight: feetIn(text, 30) };
  }
  return out;
}

/** Whether anything here is worth a line on the sheet. */
export function hasSenses(s: Senses): boolean {
  return s.darkvision > 0 || s.sunlightSensitivity
    || s.blindsight > 0 || s.tremorsense > 0 || s.truesight > 0;
}

/** One line, the way a statblock prints it. */
export function describeSenses(s: Senses): string {
  const parts: string[] = [];
  if (s.truesight > 0) parts.push(`truesight ${s.truesight} ft`);
  if (s.blindsight > 0) parts.push(`blindsight ${s.blindsight} ft`);
  if (s.tremorsense > 0) parts.push(`tremorsense ${s.tremorsense} ft`);
  if (s.darkvision > 0) parts.push(`darkvision ${s.darkvision} ft`);
  if (s.sunlightSensitivity) parts.push("sunlight sensitivity");
  return parts.join(" · ");
}
