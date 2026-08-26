/*
 * Only what this character actually has.
 */
import { describe, expect, it } from "vitest";
import { answers, ownFeatures } from "../subclass.js";

/** A ranger table as a complete compendium writes one, cut down. */
const RANGER = [
  {
    level: 1,
    features: [
      "Favored Enemy (1 type)", "Natural Explorer (1 terrain type)",
      "Starting Ranger", "Multiclass Ranger", "Favored Enemy",
    ],
  },
  {
    level: 2,
    features: ["Fighting Style", "Spellcasting", "Fighting Style: Archery"],
  },
  {
    level: 3,
    features: [
      "Ranger Archetype",
      "Ranger Archetype: Hunter", "Hunter's Prey (Hunter)",
      "Ranger Archetype: Beast Master", "Ranger's Companion (Beast Master)",
      "Ranger Archetype: Trophy Hunter (HB)", "Trophy (Trophy Hunter (HB))",
    ],
  },
  { level: 4, features: ["Ability Score Improvement"] },
];

const names = (rows: { level: number; names: string[] }[]) =>
  rows.flatMap((r) => r.names);

describe("a ranger who took Hunter", () => {
  const got = ownFeatures(RANGER, { level: 4, answered: ["hunter"] });

  it("has their own archetype's features", () => {
    expect(names(got)).toContain("Hunter's Prey (Hunter)");
  });

  it("and none of the archetypes they did not take", () => {
    expect(names(got)).not.toContain("Ranger's Companion (Beast Master)");
    // "Trophy Hunter" ends in the same word. It is not the same archetype.
    expect(names(got)).not.toContain("Trophy (Trophy Hunter (HB))");
  });

  it("keeps the class's own features", () => {
    expect(names(got)).toEqual(
      expect.arrayContaining(["Fighting Style", "Spellcasting", "Ability Score Improvement"]),
    );
  });

  it("drops the question, keeping what answering it granted", () => {
    // "Ranger Archetype: Hunter" is the choice being recorded, not a feature.
    expect(names(got)).not.toContain("Ranger Archetype: Hunter");
    expect(names(got)).toContain("Ranger Archetype");
  });

  it("drops the options of a choice, which are not things you have", () => {
    expect(names(got)).not.toContain("Fighting Style: Archery");
  });

  it("and the compendium's own scaffolding", () => {
    expect(names(got)).not.toContain("Starting Ranger");
    expect(names(got)).not.toContain("Multiclass Ranger");
  });

  it("saying each thing once, however many files said it", () => {
    // "Favored Enemy (1 type)" from the SRD, "Favored Enemy" from the
    // compendium. The first wins: it carries the detail.
    const first = got.find((r) => r.level === 1)?.names ?? [];
    expect(first).toContain("Favored Enemy (1 type)");
    expect(first).not.toContain("Favored Enemy");
  });

  it("stopping at the level they have reached", () => {
    const short = ownFeatures(RANGER, { level: 2, answered: ["hunter"] });
    expect(short.map((r) => r.level)).toEqual([1, 2]);
  });
});

describe("a ranger who has not chosen yet", () => {
  it("gets the class's features and nobody's archetype", () => {
    const got = names(ownFeatures(RANGER, { level: 4, answered: [] }));
    expect(got).toContain("Ranger Archetype");
    expect(got).not.toContain("Hunter's Prey (Hunter)");
    expect(got).not.toContain("Ranger's Companion (Beast Master)");
  });
});

describe("how an answer is matched to an option", () => {
  it("exactly", () => {
    expect(answers("Hunter", "Hunter")).toBe(true);
    expect(answers("hunter", "HUNTER")).toBe(true);
  });

  it("through a trailing label, because that is how domains are written", () => {
    expect(answers("life", "Life Domain")).toBe(true);
    expect(answers("Life Domain", "Life")).toBe(true);
  });

  it("and across an 'of', because that is how schools and circles are", () => {
    expect(answers("Evocation", "School of Evocation")).toBe(true);
    expect(answers("Moon", "Circle of the Moon")).toBe(true);
  });

  it("but never on a shared last word alone", () => {
    // The rule that would hand a Hunter every Trophy Hunter feature.
    expect(answers("Hunter", "Trophy Hunter")).toBe(false);
    expect(answers("Champion", "Planar Champion")).toBe(false);
    expect(answers("life", "Lifegiver")).toBe(false);
  });

  it("and nothing answers nothing", () => {
    expect(answers("", "Hunter")).toBe(false);
    expect(answers("Hunter", "  ")).toBe(false);
  });
});
