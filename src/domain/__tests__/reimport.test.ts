/**
 * The riskiest assumption in phase 4, tested before the feature was built:
 * a re-import must not replay a level the incoming file already contains.
 */
import { describe, expect, it } from "vitest";
import {
  appendLevel, effectiveBuild, reconcileImport, type BuildDelta,
} from "../build.js";
import { kiraBase } from "./fixtures.js";

const delta = (toTotalLevel: number, hpGain = 8): BuildDelta => ({
  kind: "levelGained", classId: "ranger", toTotalLevel, hpGain, at: "2026-08-13",
});

/** Kira is imported at 8 and levelled twice in the app, to 10. */
const levelledInApp = { base: kiraBase, deltas: [delta(9), delta(10)] };

describe("levelling in the app", () => {
  it("numbers each level from where the character is", () => {
    const c = appendLevel(appendLevel({ base: kiraBase, deltas: [] }, "ranger", 8, "x"), "ranger", 7, "x");
    expect(c.deltas.map((d) => d.toTotalLevel)).toEqual([9, 10]);
    expect(effectiveBuild(c).totalLevel).toBe(10);
  });

  it("carries the hit points and the cascade with it", () => {
    const b = effectiveBuild(levelledInApp);
    expect(b.maxHp).toBe(52 + 8 + 8);
    expect(b.proficiencyBonus).toBe(4);          // +3 at 8, +4 at 9
    expect(b.skillMods.stealth).toBe(8);         // dex 4 + prof 4
  });
});

describe("re-importing", () => {
  it("keeps app level-ups the file does not know about", () => {
    // The builder still has her at 8; both in-app levels are still news.
    const c = reconcileImport(kiraBase, levelledInApp.deltas);
    expect(c.deltas.map((d) => d.toTotalLevel)).toEqual([9, 10]);
    expect(effectiveBuild(c).totalLevel).toBe(10);
  });

  it("drops a level the incoming file already contains", () => {
    // They levelled to 9 in their builder too, and re-imported.
    const at9 = { ...kiraBase, classes: [{ classId: "ranger" as const, level: 9 }], maxHp: 60 };
    const c = reconcileImport(at9, levelledInApp.deltas);
    expect(c.deltas.map((d) => d.toTotalLevel)).toEqual([10]);
    // 9 from the file plus the one level the app still owns — not 11.
    expect(effectiveBuild(c).totalLevel).toBe(10);
    expect(effectiveBuild(c).maxHp).toBe(68);
  });

  it("drops every superseded level at once", () => {
    const at10 = { ...kiraBase, classes: [{ classId: "ranger" as const, level: 10 }], maxHp: 68 };
    const c = reconcileImport(at10, levelledInApp.deltas);
    expect(c.deltas).toEqual([]);
    expect(effectiveBuild(c).totalLevel).toBe(10);
    // The decisive number: 68, not 68 + 16.
    expect(effectiveBuild(c).maxHp).toBe(68);
  });

  it("is idempotent — importing the same file twice changes nothing", () => {
    const at10 = { ...kiraBase, classes: [{ classId: "ranger" as const, level: 10 }], maxHp: 68 };
    const once = reconcileImport(at10, levelledInApp.deltas);
    const twice = reconcileImport(at10, once.deltas);
    expect(twice).toEqual(once);
  });

  it("keeps a level the file overshot past", () => {
    // Builder jumped straight to 12; both app deltas are covered.
    const at12 = { ...kiraBase, classes: [{ classId: "ranger" as const, level: 12 }], maxHp: 84 };
    const c = reconcileImport(at12, levelledInApp.deltas);
    expect(c.deltas).toEqual([]);
    expect(effectiveBuild(c).totalLevel).toBe(12);
  });

  it("replaces the base wholesale, so a rebuild in the builder wins", () => {
    const rebuilt = {
      ...kiraBase,
      abilities: { ...kiraBase.abilities, dex: 20 },
      skillProficiencies: ["stealth"] as const,
    };
    const c = reconcileImport(rebuilt, []);
    const b = effectiveBuild(c);
    expect(b.abilityMods.dex).toBe(5);
    // Proficiencies came from the file, not merged with what was there.
    expect(b.skillMods.perception).toBe(3);
  });
});
