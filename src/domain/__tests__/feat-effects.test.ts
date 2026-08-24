/*
 * A half-feat's +1, and Resilient's saving throw, through the model.
 */
import { describe, expect, it } from "vitest";
import { assemble } from "../creation.js";
import { appendLevel, effectiveBuild } from "../build.js";

const base = {
  name: "Bel", level: 4, classSkills: [],
  baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  race: { id: "human", name: "Human", speed: 30, abilityBonuses: {} },
  klass: { id: "fighter", name: "Fighter", hitDie: 10, saves: ["str", "con"], spellSlots: [] },
  background: { name: "Soldier", skills: [], tools: [] },
} as never;

describe("a feat taken in the builder", () => {
  it("moves the number it says it moves", () => {
    const plain = assemble(base);
    const withFeat = assemble({
      ...(base as object),
      improvements: [{ feat: { id: "actor", name: "Actor" }, abilities: { cha: 1 } }],
    } as never);
    expect(plain.abilities.cha).toBe(8);
    expect(withFeat.abilities.cha).toBe(9);
  });

  it("hands over a saving throw where the feat does", () => {
    // The whole reason anybody takes Resilient.
    const b = assemble({
      ...(base as object),
      improvements: [
        { feat: { id: "resilient-wisdom", name: "Resilient (Wisdom)" }, abilities: { wis: 1 }, save: "wis" },
      ],
    } as never);
    expect(b.saveProficiencies).toContain("wis");
    expect(b.saveProficiencies).toContain("str");
    expect(b.abilities.wis).toBe(11);
  });

  it("and does not repeat one the class already had", () => {
    const b = assemble({
      ...(base as object),
      improvements: [
        { feat: { id: "resilient-con", name: "Resilient (Constitution)" }, abilities: { con: 1 }, save: "con" },
      ],
    } as never);
    expect(b.saveProficiencies.filter((s) => s === "con")).toHaveLength(1);
  });
});

describe("a feat taken at the table", () => {
  it("reaches the sheet through the level delta", () => {
    const character = { base: assemble(base), deltas: [] };
    const after = appendLevel(character, "fighter" as never, 6, "2026-08-23", {
      feat: { id: "resilient-dex", name: "Resilient (Dexterity)" },
      abilities: { dex: 1 },
      save: "dex",
    });
    const before = effectiveBuild(character as never);
    const build = effectiveBuild(after);
    expect(build.abilities.dex).toBe(15);
    // The number the feat was taken FOR: proficiency now applies to the save.
    expect(build.saveMods.dex).toBe(build.abilityMods.dex + build.proficiencyBonus);
    expect(build.saveMods.dex).toBeGreaterThan(before.saveMods.dex);
    expect(build.feats.map((f) => f.name)).toContain("Resilient (Dexterity)");
  });

  it("and survives a replay, because it is a delta like any other", () => {
    const character = { base: assemble(base), deltas: [] };
    const once = appendLevel(character, "fighter" as never, 6, "2026-08-23", {
      feat: { id: "resilient-dex", name: "Resilient (Dexterity)" },
      abilities: { dex: 1 },
      save: "dex",
    });
    expect(effectiveBuild(once).saveMods).toEqual(effectiveBuild({ ...once }).saveMods);
  });
});
