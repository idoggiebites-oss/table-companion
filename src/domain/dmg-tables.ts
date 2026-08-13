/**
 * ⚠ NOT SRD CONTENT. NOT REDISTRIBUTABLE.
 *
 * The encounter-building tables below are from the Dungeon Master's Guide.
 * They are not in SRD 5.1 — verified against the SRD PDF, where "XP
 * Threshold", "Encounter Difficulty", "Encounter Multipliers" and
 * "Adventuring Day" appear on no page, while controls like "Goblin" and
 * "Fireball" appear on many.
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
