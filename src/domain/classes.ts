/**
 * The class facts every adapter needs and no import format reliably carries.
 *
 * Hit die in particular is never in a character export because it is implied
 * by the class — so manual entry, Fight Club XML and the future builder all
 * derive it from here rather than each keeping their own table.
 */

import type { ClassId, DieSize } from "./resources.js";
import { CLASS_IDS } from "./resources.js";

export const HIT_DIE: Record<ClassId, DieSize> = {
  barbarian: 12,
  bard: 8,
  cleric: 8,
  druid: 8,
  fighter: 10,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6,
};

/** Classes that get spell slots at all — used to flag an import that lost them. */
export const SPELLCASTERS: ReadonlySet<ClassId> = new Set<ClassId>([
  "bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard",
]);

/** Matches a class name from an import, which arrives in any capitalisation. */
export function classIdFrom(raw: string): ClassId | null {
  const key = raw.trim().toLowerCase();
  return (CLASS_IDS as string[]).includes(key) ? (key as ClassId) : null;
}
