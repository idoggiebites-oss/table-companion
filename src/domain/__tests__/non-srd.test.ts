/**
 * Guards on transcribed tables. A wrong digit in a threshold row is invisible
 * in use — it just quietly mis-rates every fight — so the shape is asserted
 * even though the values themselves can only be checked against the book.
 */
import { describe, expect, it } from "vitest";
import { budgetForParty, encounterMultiplier, thresholdsForLevel } from "../non-srd.js";
import { totals, type Encounter } from "../encounter.js";

describe("thresholds", () => {
  it("rises with level in every column", () => {
    for (let lvl = 2; lvl <= 20; lvl++) {
      const prev = thresholdsForLevel(lvl - 1);
      const now = thresholdsForLevel(lvl);
      for (const k of ["easy", "medium", "hard", "deadly"] as const) {
        expect(now[k], `level ${lvl} ${k}`).toBeGreaterThanOrEqual(prev[k]);
      }
    }
  });

  it("is ascending within every row", () => {
    for (let lvl = 1; lvl <= 20; lvl++) {
      const t = thresholdsForLevel(lvl);
      expect(t.easy, `level ${lvl}`).toBeLessThan(t.medium);
      expect(t.medium, `level ${lvl}`).toBeLessThan(t.hard);
      expect(t.hard, `level ${lvl}`).toBeLessThan(t.deadly);
    }
  });

  it("clamps rather than falling off the table", () => {
    expect(thresholdsForLevel(0)).toEqual(thresholdsForLevel(1));
    expect(thresholdsForLevel(99)).toEqual(thresholdsForLevel(20));
  });
});

describe("the party budget is computed, not typed", () => {
  it("sums across the characters", () => {
    const one = thresholdsForLevel(8);
    const four = budgetForParty([8, 8, 8, 8])!;
    expect(four.medium).toBe(one.medium * 4);
  });

  it("handles a party at mixed levels", () => {
    const mixed = budgetForParty([5, 8])!;
    expect(mixed.easy).toBe(thresholdsForLevel(5).easy + thresholdsForLevel(8).easy);
  });

  it("is null with nobody imported", () => {
    expect(budgetForParty([])).toBeNull();
  });
});

describe("the multiplier", () => {
  it("steps with creature count", () => {
    expect([1, 2, 3, 6, 7, 10, 11, 14, 15, 30].map(encounterMultiplier))
      .toEqual([1, 1.5, 2, 2, 2.5, 2.5, 3, 3, 4, 4]);
  });

  it("never decreases as creatures are added", () => {
    for (let n = 2; n <= 40; n++) {
      expect(encounterMultiplier(n)).toBeGreaterThanOrEqual(encounterMultiplier(n - 1));
    }
  });

  it("is the step people forget: one more creature can outweigh its XP", () => {
    const goblin = { statblockId: "g", name: "Goblin", count: 6, xpEach: 50,
      hpMode: "average" as const, disclosure: "vague" as const };
    const six: Encounter = { id: "e", name: "", entries: [goblin] };
    const seven: Encounter = { id: "e", name: "", entries: [{ ...goblin, count: 7 }] };
    const a = totals(six, 4, null, encounterMultiplier(6));
    const b = totals(seven, 4, null, encounterMultiplier(7));
    expect(b.rawXp - a.rawXp).toBe(50);          // one goblin's worth
    expect(b.adjustedXp - a.adjustedXp).toBe(275); // but a bracket was crossed
  });
});

describe("band uses the adjusted total, the award uses the raw one", () => {
  const enc: Encounter = {
    id: "e", name: "", entries: [
      { statblockId: "g", name: "Goblin", count: 6, xpEach: 50,
        hpMode: "average", disclosure: "vague" },
    ],
  };

  it("rates a swarm above its raw XP", () => {
    const budget = budgetForParty([1, 1, 1, 1])!;
    const flat = totals(enc, 4, budget, 1);
    const real = totals(enc, 4, budget, encounterMultiplier(6));
    expect(real.adjustedXp).toBe(600);
    expect(flat.adjustedXp).toBe(300);
    expect(real.band).not.toBe(flat.band);
  });

  it("still hands out only the raw total", () => {
    expect(totals(enc, 4, budgetForParty([8, 8, 8, 8]), 2).rawXp).toBe(300);
  });
});
