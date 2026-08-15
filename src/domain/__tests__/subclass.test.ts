import { describe, expect, it } from "vitest";
import { choicesBy, featuresOf, findChoices, grantedBy } from "../subclass.js";

// Shaped exactly as a compendium writes a cleric.
const cleric = [
  { level: 1, name: "Spellcasting" },
  { level: 1, name: "Divine Domain" },
  { level: 2, name: "Channel Divinity (1/rest)" },
  { level: 2, name: "Channel Divinity: Turn Undead" },
  { level: 1, name: "Divine Domain: Knowledge Domain" },
  { level: 1, name: "Divine Domain: Life Domain" },
  { level: 1, name: "Blessings of Knowledge (Knowledge Domain)" },
  { level: 6, name: "Potent Spellcasting (Knowledge Domain)" },
  { level: 1, name: "Disciple of Life (Life Domain)" },
];

describe("finding what a class asks you", () => {
  it("reads a subclass out of the feature list", () => {
    const found = findChoices(cleric);
    expect(found.map((c) => c.of)).toEqual(["Divine Domain"]);
    expect(found[0]!.options.map((o) => o.name)).toEqual(["Knowledge Domain", "Life Domain"]);
  });

  it("knows when it is asked", () => {
    expect(findChoices(cleric)[0]!.level).toBe(1);
  });

  it("ignores a heading with only one answer", () => {
    // "Channel Divinity: Turn Undead" looks like a decision and is not one.
    expect(findChoices(cleric).some((c) => c.of === "Channel Divinity")).toBe(false);
  });

  it("ignores a heading the class never asks as a plain feature", () => {
    const noQuestion = [
      { level: 1, name: "Restriction: One" },
      { level: 1, name: "Restriction: Two" },
    ];
    expect(findChoices(noQuestion)).toEqual([]);
  });

  it("covers fighting styles and metamagic, which are written the same way", () => {
    const fighter = [
      { level: 1, name: "Fighting Style" },
      { level: 1, name: "Fighting Style: Archery" },
      { level: 1, name: "Fighting Style: Defense" },
      { level: 3, name: "Martial Archetype" },
      { level: 3, name: "Martial Archetype: Champion" },
      { level: 3, name: "Martial Archetype: Battle Master" },
    ];
    const found = findChoices(fighter);
    expect(found.map((c) => [c.of, c.level])).toEqual([
      ["Fighting Style", 1],
      ["Martial Archetype", 3],
    ]);
  });
});

describe("what a choice has been asked by now", () => {
  it("leaves out what has not come up yet", () => {
    const points = findChoices([
      { level: 1, name: "Fighting Style" },
      { level: 1, name: "Fighting Style: Archery" },
      { level: 1, name: "Fighting Style: Defense" },
      { level: 3, name: "Martial Archetype" },
      { level: 3, name: "Martial Archetype: Champion" },
      { level: 3, name: "Martial Archetype: Battle Master" },
    ]);
    expect(choicesBy(points, 1).map((c) => c.of)).toEqual(["Fighting Style"]);
    expect(choicesBy(points, 3)).toHaveLength(2);
  });
});

describe("what an option grants", () => {
  it("reads the suffix the compendium uses", () => {
    expect(grantedBy("Blessings of Knowledge (Knowledge Domain)")).toBe("Knowledge Domain");
    expect(grantedBy("Spellcasting")).toBe(null);
  });

  it("lists only what that option gives, up to this level", () => {
    expect(featuresOf(cleric, "Knowledge Domain", 5).map((f) => f.name))
      .toEqual(["Blessings of Knowledge (Knowledge Domain)"]);
    expect(featuresOf(cleric, "Knowledge Domain", 6)).toHaveLength(2);
  });
});
