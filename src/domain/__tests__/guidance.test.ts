import { describe, expect, it } from "vitest";
import { ABILITIES } from "../abilities.js";
import {
  ABILITY_BLURB, abilityName, blurbFor, CLASS_BLURB, describePriority,
  featureOf, mattersMost, mechanicalTraits,
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

describe("races and backgrounds, where there are hundreds", () => {
  const traits = [
    { name: "Description", desc: "To be greeted with stares. And whispers besides." },
    { name: "Infernal Legacy", desc: "You know the thaumaturgy cantrip." },
    { name: "Suggested Characteristics", desc: "Tieflings are shaped by…" },
  ];

  it("prefers a line written for the ones we ship", () => {
    expect(blurbFor("halfling", traits)).toMatch(/lucky and brave/i);
  });

  it("falls back to the file's own first sentence for the rest", () => {
    // Two hundred and sixty imported races cannot be hand-written, and their
    // own description beats an invented one.
    expect(blurbFor("aasimar-fallen-hb", traits)).toBe("To be greeted with stares.");
  });

  it("says nothing when there is nothing to say", () => {
    expect(blurbFor("unknown", [])).toBe(null);
    expect(blurbFor("unknown", undefined)).toBe(null);
  });

  it("separates what it GIVES you from the prose about it", () => {
    expect(mechanicalTraits(traits).map((t) => t.name)).toEqual(["Infernal Legacy"]);
  });

  it("finds a background's one mechanical line", () => {
    const bg = [
      { name: "Description", desc: "You served a temple." },
      { name: "Feature: Shelter of the Faithful", desc: "You command respect." },
    ];
    expect(featureOf(bg)?.name).toBe("Feature: Shelter of the Faithful");
    expect(featureOf([{ name: "Description", desc: "x" }])).toBe(null);
  });
});
