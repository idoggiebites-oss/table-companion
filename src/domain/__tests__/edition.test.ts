/**
 * The seam guard from the build plan.
 *
 * v1 ships the 2014 rules and nothing reads the 2024 tables. These tests are
 * the only thing that does, deliberately: if a 2024 rule cannot be expressed
 * in the same shapes as a 2014 one, the abstraction is wrong and this is the
 * cheapest possible moment to discover it.
 */

import { describe, expect, it } from "vitest";
import { EDITIONS, exhaustionAt, isKnownCondition, rulesFor } from "../edition.js";

describe("exhaustion fits one schema in both editions", () => {
  it("2014 gives each level a distinct effect", () => {
    expect(exhaustionAt("2014", 1)?.disadvantage).toEqual(["abilityChecks"]);
    expect(exhaustionAt("2014", 2)?.speedMultiplier).toBe(0.5);
    expect(exhaustionAt("2014", 4)?.hpMaxMultiplier).toBe(0.5);
    expect(exhaustionAt("2014", 6)?.death).toBe(true);
  });

  it("2024 gives a flat penalty that stacks — same fields, no schema change", () => {
    expect(exhaustionAt("2024", 1)?.d20Penalty).toBe(-2);
    expect(exhaustionAt("2024", 3)?.d20Penalty).toBe(-6);
    expect(exhaustionAt("2024", 5)?.speedPenaltyFeet).toBe(-25);
    expect(exhaustionAt("2024", 6)?.death).toBe(true);
  });

  it("is stored as an integer level in both, never as an enum of effects", () => {
    for (const edition of EDITIONS) {
      expect(exhaustionAt(edition, 0)).toBeNull();
      expect(rulesFor(edition).maxExhaustion).toBe(6);
      for (let level = 1; level <= 6; level++) {
        expect(exhaustionAt(edition, level)?.level).toBe(level);
      }
    }
  });

  it("clamps a level past the end of the table rather than throwing", () => {
    expect(exhaustionAt("2014", 99)?.death).toBe(true);
  });
});

describe("conditions are data, not a union type", () => {
  it("validates against the campaign's edition", () => {
    expect(isKnownCondition("2014", "frightened")).toBe(true);
    expect(isKnownCondition("2014", "hexed")).toBe(false);
  });
});

describe("2024-only rules are absent rather than empty in 2014", () => {
  it("marks weapon mastery only where it exists", () => {
    expect(rulesFor("2014").weaponMastery).toBeUndefined();
    expect(rulesFor("2024").weaponMastery).toBe(true);
  });
});
