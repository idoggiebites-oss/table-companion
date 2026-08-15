import { describe, expect, it } from "vitest";
import { ABILITIES } from "../abilities.js";
import {
  ABILITY_BLURB, abilityName, CLASS_BLURB, describePriority, mattersMost,
} from "../guidance.js";

describe("what a class is like to play", () => {
  it("covers every class the app ships", () => {
    for (const id of [
      "barbarian", "bard", "cleric", "druid", "fighter", "monk",
      "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
    ]) {
      expect(CLASS_BLURB[id]).toBeDefined();
    }
  });

  it("says nothing about a class it does not know", () => {
    // A compendium brings fifty-five more. Absent is honest; invented is not.
    expect(CLASS_BLURB["blood-hunter"]).toBeUndefined();
  });

  it("stays to one sentence", () => {
    for (const [id, text] of Object.entries(CLASS_BLURB)) {
      expect(text.length, id).toBeLessThan(110);
    }
  });
});

describe("what an ability does", () => {
  it("covers all six", () => {
    for (const a of ABILITIES) expect(ABILITY_BLURB[a]).toBeDefined();
  });

  it("leads with what it changes rather than what it is", () => {
    expect(ABILITY_BLURB.con).toMatch(/^Hit points/);
    expect(ABILITY_BLURB.dex).toMatch(/^Armour class/);
  });
});

describe("advice, not enforcement", () => {
  it("names the two that matter most", () => {
    expect(mattersMost(["str", "con", "dex", "wis", "cha", "int"])).toEqual(["str", "con"]);
  });

  it("says so in a sentence", () => {
    expect(describePriority("Fighter", ["str", "con", "dex"]))
      .toBe("Strength and Constitution matter most for a fighter.");
  });

  it("says nothing when there is no opinion to give", () => {
    // Imported classes have no priority order, and a guess would homogenise
    // exactly what the builder refuses to place for you.
    expect(describePriority("Blood Hunter", undefined)).toBe(null);
    expect(mattersMost(undefined)).toEqual([]);
  });

  it("spells the abilities out, because STR is jargon", () => {
    expect(abilityName("cha")).toBe("Charisma");
  });
});
