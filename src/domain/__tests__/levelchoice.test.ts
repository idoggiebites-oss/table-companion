import { describe, expect, it } from "vitest";
import { appendLevel, effectiveBuild, type BuildBase, type Character } from "../build.js";

const base: BuildBase = {
  id: "kira", name: "Kira", source: "manual", edition: "2014", race: "Human",
  classes: [{ classId: "fighter", level: 3 }],
  abilities: { str: 16, dex: 14, con: 15, int: 10, wis: 12, cha: 8 },
  maxHp: 28, hitDie: 10, armourClass: 16, speed: 30,
  saveProficiencies: ["str", "con"], skillProficiencies: [],
  attacks: [], spellSlots: [],
};
const start: Character = { base, deltas: [] };

describe("an ability score improvement", () => {
  it("raises the score it was spent on", () => {
    const next = appendLevel(start, "fighter", 6, "now", { abilities: { str: 2 } });
    expect(effectiveBuild(next).abilities.str).toBe(18);
  });

  it("splits across two when that is the choice", () => {
    const next = appendLevel(start, "fighter", 6, "now", { abilities: { dex: 1, con: 1 } });
    const b = effectiveBuild(next);
    expect([b.abilities.dex, b.abilities.con]).toEqual([15, 16]);
  });

  it("moves the modifier with it, and everything derived from it", () => {
    const before = effectiveBuild(start);
    const next = effectiveBuild(appendLevel(start, "fighter", 6, "now", { abilities: { dex: 2 } }));
    expect(before.abilityMods.dex).toBe(2);
    expect(next.abilityMods.dex).toBe(3);
    expect(next.armourClass).toBe(before.armourClass); // stored AC is not derived from dex
  });

  it("stops at 20", () => {
    const high: Character = { base: { ...base, abilities: { ...base.abilities, str: 19 } }, deltas: [] };
    expect(effectiveBuild(appendLevel(high, "fighter", 6, "now", { abilities: { str: 2 } })).abilities.str)
      .toBe(20);
  });

  it("replays on top of a re-imported base rather than being baked in", () => {
    // The whole reason improvements are deltas: an import brings new scores
    // and the improvement still applies.
    const withAsi = appendLevel(start, "fighter", 6, "now", { abilities: { str: 2 } });
    const reimported: Character = {
      base: { ...base, abilities: { ...base.abilities, str: 12 } },
      deltas: withAsi.deltas,
    };
    expect(effectiveBuild(reimported).abilities.str).toBe(14);
  });
});

describe("a feat taken instead", () => {
  it("is recorded by name", () => {
    const next = appendLevel(start, "fighter", 6, "now", {
      feat: { id: "alert", name: "Alert" },
    });
    expect(effectiveBuild(next).feats).toEqual([{ id: "alert", name: "Alert" }]);
  });

  it("changes no numbers, because the app cannot know what it does", () => {
    const before = effectiveBuild(start);
    const after = effectiveBuild(
      appendLevel(start, "fighter", 6, "now", { feat: { id: "alert", name: "Alert" } }),
    );
    expect(after.abilities).toEqual(before.abilities);
  });

  it("accumulates over several levels", () => {
    let c = appendLevel(start, "fighter", 6, "now", { feat: { id: "alert", name: "Alert" } });
    c = appendLevel(c, "fighter", 6, "now", { feat: { id: "lucky", name: "Lucky" } });
    expect(effectiveBuild(c).feats.map((f) => f.name)).toEqual(["Alert", "Lucky"]);
  });
});

describe("levelling without a choice", () => {
  it("still adds the level and the hit points", () => {
    const next = effectiveBuild(appendLevel(start, "fighter", 7, "now"));
    expect(next.totalLevel).toBe(4);
    expect(next.maxHp).toBe(35);
    expect(next.feats).toEqual([]);
  });
});
