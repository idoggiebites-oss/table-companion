/**
 * What a compendium is telling you in parentheses.
 *
 * A complete compendium is mostly not the game — 1,820 of its 3,443 spells
 * are marked (HB), 756 of its 850 feats carry a marker of some kind, and
 * alphabetically all of it lands on top. Every parenthetical in the file is
 * provenance, and nothing from the game carries one, so the rule is this
 * simple and it is checked against the shipped file rather than assumed.
 *
 * Shared because the problem is: any list drawn from a compendium is two
 * thirds somebody else's material, and the person choosing from it came for
 * the other third.
 */

/** The marker, or null. "Acid Splash (Alt) (HB)" → "Alt". */
export function nameMark(name: string): string | null {
  return /\(([^)]{1,20})\)/.exec(name ?? "")?.[1] ?? null;
}

/** Every parenthetical in the name, in order — some names carry two. */
export function nameMarks(name: string): string[] {
  return [...(name ?? "").matchAll(/\(([^()]{1,30})\)/g)].map((m) => m[1]!);
}

/**
 * Parentheses that are a CHOICE rather than a source.
 *
 * Feats are the only list where this happens, and it happens a lot: the file
 * ships "Resilient (Constitution)" rather than Resilient with a dropdown. An
 * ability or a damage type in brackets is an axis; everything else is where
 * the thing came from.
 */
const AXES = new Set([
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
  "acid", "cold", "fire", "lightning", "thunder", "necrotic", "radiant",
  "poison", "psychic", "force", "proficient", "proficient in both",
]);

export function isAxis(mark: string): boolean {
  return AXES.has(mark.trim().toLowerCase());
}

/**
 * Where this came from, if it came from outside the game — "HB", "TP", "UA",
 * "Ixalan", "Legacy". Null for the game's own.
 *
 * One question asked the same way of every list, because a person who does
 * not want other people's material does not want it a class at a time. It is
 * 81% of the races, 89% of the feats and 65% of the spells: hiding it is the
 * difference between choosing and scrolling.
 */
export function sourceMark(name: string): string | null {
  return nameMarks(name).find((m) => !isAxis(m)) ?? null;
}

/** Nothing in brackets that is not a choice. */
export function isCore(name: string): boolean {
  return sourceMark(name) === null;
}
