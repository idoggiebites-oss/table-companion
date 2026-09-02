/**
 * !! NOT SRD CONTENT. NOT REDISTRIBUTABLE.
 *
 * Everything outside SRD 5.1 lives here and nowhere else, so the app has one
 * file standing between it and being shareable. Each table was checked
 * against the SRD PDF rather than assumed, using terms known to be in the
 * SRD ("Goblin", "Fireball") as controls so that a failed text extraction
 * could not be mistaken for an absent table.
 *
 *   Encounter building (DMG): "XP Threshold", "Encounter Difficulty",
 *   "Encounter Multipliers", "Adventuring Day" — absent from every page.
 *
 *   Ability score generation (PHB): "15, 14, 13, 12, 10, 8", "standard set"
 *   and "Variant: Customizing Ability Scores" — absent from every page.
 *   The SRD covers what ability scores DO, not how you first pick them.
 *
 * They are here because this app is for one private table whose DM owns the
 * book. That is a deliberate decision, and it is the ONE thing in this
 * codebase that would have to change before the app could be shared publicly
 * or published in any form.
 *
 * Everything needed to make that change is contained in this file:
 *   - delete it,
 *   - drop the `budget` argument at its two call sites in encounter.ts,
 *   - and the app falls back to raw XP totals with no difficulty band, which
 *     is the fully-licensed behaviour.
 *
 * Nothing else imports it. Keep it that way.
 *
 * CAVEAT: these numbers are transcribed, and a wrong digit in a threshold
 * table is invisible — it just quietly mis-rates every fight. Spot-check them
 * against the book before trusting the bands.
 */

import type { Ability } from "./abilities.js";
import type { DifficultyBudget } from "./encounter.js";

/** Per character, by level: easy, medium, hard, deadly. */
const THRESHOLDS: readonly (readonly [number, number, number, number])[] = [
  [25, 50, 75, 100],        // 1
  [50, 100, 150, 200],      // 2
  [75, 150, 225, 400],      // 3
  [125, 250, 375, 500],     // 4
  [250, 500, 750, 1100],    // 5
  [300, 600, 900, 1400],    // 6
  [350, 750, 1100, 1700],   // 7
  [450, 900, 1400, 2100],   // 8
  [550, 1100, 1600, 2400],  // 9
  [600, 1200, 1900, 2800],  // 10
  [800, 1600, 2400, 3600],  // 11
  [1000, 2000, 3000, 4500], // 12
  [1100, 2200, 3400, 5100], // 13
  [1250, 2500, 3800, 5700], // 14
  [1400, 2800, 4300, 6400], // 15
  [1600, 3200, 4800, 7200], // 16
  [2000, 3900, 5900, 8800], // 17
  [2100, 4200, 6300, 9500], // 18
  [2400, 4900, 7300, 10900],// 19
  [2800, 5700, 8500, 12700],// 20
];

export function thresholdsForLevel(level: number): DifficultyBudget {
  const row = THRESHOLDS[Math.max(1, Math.min(20, Math.round(level))) - 1]!;
  return { easy: row[0], medium: row[1], hard: row[2], deadly: row[3] };
}

/**
 * The party's budget is the sum over its characters, so it is computed from
 * the imported party rather than typed in — which is the one thing every
 * other encounter calculator makes you do by hand.
 */
export function budgetForParty(levels: readonly number[]): DifficultyBudget | null {
  if (levels.length === 0) return null;
  return levels.reduce<DifficultyBudget>(
    (acc, lvl) => {
      const t = thresholdsForLevel(lvl);
      return {
        easy: acc.easy + t.easy,
        medium: acc.medium + t.medium,
        hard: acc.hard + t.hard,
        deadly: acc.deadly + t.deadly,
      };
    },
    { easy: 0, medium: 0, hard: 0, deadly: 0 },
  );
}

/**
 * Grows with the NUMBER of creatures, because six weak things are far more
 * dangerous than one thing worth the same XP. This is the step everyone
 * forgets, which is why the app shows the working rather than only the band.
 */
export function encounterMultiplier(creatures: number): number {
  if (creatures <= 0) return 0;
  if (creatures === 1) return 1;
  if (creatures === 2) return 1.5;
  if (creatures <= 6) return 2;
  if (creatures <= 10) return 2.5;
  if (creatures <= 14) return 3;
  return 4;
}

/* ---- ability score generation (PHB) ------------------------------------- */

/** The fixed spread most tables use, highest first. */
export const STANDARD_ARRAY: readonly number[] = [15, 14, 13, 12, 10, 8];

/** Points to buy each score, and the budget to spend. */
const POINT_COST: Readonly<Record<number, number>> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

export function pointCost(score: number): number | null {
  return POINT_COST[score] ?? null;
}

export function pointsSpent(scores: Readonly<Record<Ability, number>>): number {
  return Object.values(scores).reduce((n, s) => n + (POINT_COST[s] ?? 0), 0);
}

/** Whether a score can move without leaving the range or overspending. */
export function canAfford(
  scores: Readonly<Record<Ability, number>>,
  ability: Ability,
  next: number,
): boolean {
  if (next < POINT_BUY_MIN || next > POINT_BUY_MAX) return false;
  const cost = POINT_COST[next];
  const current = POINT_COST[scores[ability]];
  if (cost === undefined || current === undefined) return false;
  return pointsSpent(scores) - current + cost <= POINT_BUY_BUDGET;
}

/**
 * Starting wealth by class — PHB p.143, NOT SRD. The alternative to taking
 * the class kit: roll this many d4 and multiply, then buy your own.
 *
 * The monk is the one that catches people out: 5d4 with no multiplier, so a
 * monk starts with pocket change rather than fifty gold.
 */
export const STARTING_WEALTH: Record<string, { dice: number; times: number }> = {
  barbarian: { dice: 2, times: 10 },
  bard: { dice: 5, times: 10 },
  cleric: { dice: 5, times: 10 },
  druid: { dice: 2, times: 10 },
  fighter: { dice: 5, times: 10 },
  monk: { dice: 5, times: 1 },
  paladin: { dice: 5, times: 10 },
  ranger: { dice: 5, times: 10 },
  rogue: { dice: 4, times: 10 },
  sorcerer: { dice: 3, times: 10 },
  warlock: { dice: 4, times: 10 },
  wizard: { dice: 4, times: 10 },
};

/**
 * Both return COPPER, like every other amount in the app. It also keeps the
 * average exact: 5d4 averages 12.5, and a monk taking the average has 12 gp
 * 5 sp rather than whatever rounding a whole-gold answer would have eaten.
 */
export function averageWealth(classId: string): number {
  const w = STARTING_WEALTH[classId];
  if (!w) return 0;
  return w.dice * 250 * w.times; // 2.5 average per d4, in copper
}

export function rollWealth(
  classId: string,
  roll: () => number = () => 1 + Math.floor(Math.random() * 4),
): number {
  const w = STARTING_WEALTH[classId];
  if (!w) return 0;
  let total = 0;
  for (let i = 0; i < w.dice; i++) total += roll();
  return total * w.times * 100;
}

/**
 * A compendium writes starting wealth as "4d4x10" or "5d4". Parsed rather
 * than looked up, because the table above only knows the twelve SRD classes
 * and a Blood Hunter has to start with something.
 */
export function parseWealth(notation: string): { dice: number; times: number } | null {
  const m = /^\s*(\d+)d4\s*(?:x\s*(\d+))?\s*$/i.exec(notation);
  if (!m) return null;
  return { dice: Number(m[1]), times: m[2] ? Number(m[2]) : 1 };
}

/** Copper, from either source: the SRD table first, then the notation. */
export function wealthFor(classId: string, notation?: string): number {
  const known = averageWealth(classId);
  if (known > 0) return known;
  const parsed = notation ? parseWealth(notation) : null;
  return parsed ? parsed.dice * 250 * parsed.times : 0;
}

export function describeWealthFor(classId: string, notation?: string): string {
  const known = describeWealth(classId);
  if (known) return known;
  const parsed = notation ? parseWealth(notation) : null;
  if (!parsed) return "";
  return parsed.times === 1 ? `${parsed.dice}d4 gp` : `${parsed.dice}d4 × ${parsed.times} gp`;
}

export function describeWealth(classId: string): string {
  const w = STARTING_WEALTH[classId];
  if (!w) return "";
  return w.times === 1 ? `${w.dice}d4 gp` : `${w.dice}d4 × ${w.times} gp`;
}
