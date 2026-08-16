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
