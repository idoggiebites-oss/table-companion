/**
 * Levelling.
 *
 * The XP thresholds below ARE SRD content — the Character Advancement table,
 * SRD 5.1 page 56, which also gives the proficiency bonus progression that
 * abilities.ts already implements. Unlike the encounter-building tables in
 * dmg-tables.ts, these ship under CC BY like the rest of the reference.
 *
 * A campaign advances by experience or by the DM's judgement, and that is a
 * setting rather than a preference: in a milestone campaign there are no
 * totals and no thresholds anywhere, because a number nobody is tracking is
 * worse than no number.
 */

export type Progression = "xp" | "milestone";

/** Total XP required to reach each level, index 0 being level 1. */
const ADVANCEMENT: readonly number[] = [
  0, 300, 900, 2_700, 6_500, 14_000, 23_000, 34_000, 48_000, 64_000,
  85_000, 100_000, 120_000, 140_000, 165_000, 195_000, 225_000, 265_000,
  305_000, 355_000,
];

export const MAX_LEVEL = ADVANCEMENT.length;

/** XP needed to reach a level, or null past the top of the table. */
export function xpForLevel(level: number): number | null {
  if (level < 1 || level > MAX_LEVEL) return null;
  return ADVANCEMENT[level - 1]!;
}

/** The level a total earns. Never drops anyone below the level they hold. */
export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < ADVANCEMENT.length; i++) {
    if (xp >= ADVANCEMENT[i]!) level = i + 1;
  }
  return level;
}

export function xpToNextLevel(xp: number): { next: number; needed: number } | null {
  const level = levelForXp(xp);
  const next = xpForLevel(level + 1);
  return next === null ? null : { next: level + 1, needed: next - xp };
}
