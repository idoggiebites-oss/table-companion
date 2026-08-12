/**
 * The phase 1 risk test.
 *
 * The plan's riskiest assumption is that recharge tags genuinely cover the
 * SRD classes, and that a rest can be "restore everything with this tag"
 * rather than twelve special cases. These tests tag all twelve deliberately
 * early, so that if the model is wrong it fails here rather than in phase 4.
 */

import { describe, expect, it } from "vitest";
import { abilityModifier } from "../abilities.js";
import {
  CLASS_IDS,
  CLASS_RESOURCES,
  HIT_DICE_RECHARGE,
  resolveMax,
  restoredAmount,
  restoredBy,
  specAt,
} from "../resources.js";

describe("recharge semantics", () => {
  it("a long rest restores anything a short rest would", () => {
    // 5e says "a short or long rest", so long is never worse than short.
    expect(restoredBy("long", { on: "short" })).toBe(true);
    expect(restoredBy("short", { on: "short" })).toBe(true);
  });

  it("a short rest does not restore long-rest resources", () => {
    expect(restoredBy("short", { on: "long" })).toBe(false);
    expect(restoredBy("long", { on: "long" })).toBe(true);
  });

  it("never and dawn are restored by neither", () => {
    for (const rest of ["short", "long"] as const) {
      expect(restoredBy(rest, { on: "never" })).toBe(false);
      expect(restoredBy(rest, { on: "dawn" })).toBe(false);
    }
  });
});

describe("finding 1 — a bare tag does not cover hit dice", () => {
  it("hit dice come back at half, minimum one", () => {
    expect(restoredAmount(8, HIT_DICE_RECHARGE)).toBe(4);
    expect(restoredAmount(9, HIT_DICE_RECHARGE)).toBe(4);
    expect(restoredAmount(1, HIT_DICE_RECHARGE)).toBe(1);
    expect(restoredAmount(20, HIT_DICE_RECHARGE)).toBe(10);
  });

  it("everything else comes back in full", () => {
    expect(restoredAmount(3, { on: "short" })).toBe(3);
    expect(restoredAmount(17, { on: "long" })).toBe(17);
  });
});

describe("finding 2 — recharge can change with level", () => {
  const bardic = CLASS_RESOURCES.bard[0]!;

  it("bardic inspiration is long-rest before level 5", () => {
    expect(specAt(bardic, 4)?.recharge.on).toBe("long");
  });

  it("font of inspiration flips it to short-rest at level 5", () => {
    expect(specAt(bardic, 5)?.recharge.on).toBe("short");
    expect(specAt(bardic, 20)?.recharge.on).toBe("short");
  });
});

describe("finding 3 — classes with no pool resources are legal", () => {
  it("ranger and rogue have none in the SRD", () => {
    expect(CLASS_RESOURCES.ranger).toHaveLength(0);
    expect(CLASS_RESOURCES.rogue).toHaveLength(0);
  });
});

describe("all twelve classes, every level", () => {
  const mods = { str: 0, dex: 4, con: 2, int: 0, wis: 3, cha: 1 };
  const modOf = (a: keyof typeof mods) => mods[a];

  it("covers twelve classes", () => {
    expect(CLASS_IDS).toHaveLength(12);
  });

  it("resolves a sane maximum at every level without a code branch", () => {
    for (const classId of CLASS_IDS) {
      for (let level = 1; level <= 20; level++) {
        for (const spec of CLASS_RESOURCES[classId]) {
          const variant = specAt(spec, level);
          if (!variant) continue; // not unlocked yet — legitimate
          const max = resolveMax(variant.max, level, modOf);
          expect(
            Number.isInteger(max),
            `${classId} ${spec.id} at level ${level} gave ${max}`,
          ).toBe(true);
          expect(max).toBeGreaterThanOrEqual(0);
          expect(["short", "long", "dawn", "never"]).toContain(variant.recharge.on);
        }
      }
    }
  });

  it("unlocks resources at the right level and not before", () => {
    const actionSurge = CLASS_RESOURCES.fighter.find((r) => r.id === "actionSurge")!;
    expect(specAt(actionSurge, 1)).toBeNull();
    expect(resolveMax(specAt(actionSurge, 2)!.max, 2, modOf)).toBe(1);
    expect(resolveMax(specAt(actionSurge, 17)!.max, 17, modOf)).toBe(2);
  });

  it("scales pools that key off class level", () => {
    const ki = CLASS_RESOURCES.monk[0]!;
    expect(resolveMax(specAt(ki, 5)!.max, 5, modOf)).toBe(5);

    const layOnHands = CLASS_RESOURCES.paladin.find((r) => r.id === "layOnHands")!;
    expect(resolveMax(specAt(layOnHands, 8)!.max, 8, modOf)).toBe(40);
  });

  it("floors ability-derived pools at their minimum", () => {
    const bardic = CLASS_RESOURCES.bard[0]!;
    const dump = { ...mods, cha: abilityModifier(8) }; // −1
    const max = resolveMax(specAt(bardic, 3)!.max, 3, (a) => dump[a]);
    expect(max).toBe(1);
  });
});
