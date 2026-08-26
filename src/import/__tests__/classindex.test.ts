/*
 * The slim class file: what a sheet reads, without what it never reads.
 */
import { describe, expect, it } from "vitest";
import { classIndex, type CompendiumClass } from "../compendium.js";

const wizard: CompendiumClass = {
  id: "wizard", name: "Wizard", hitDie: 6, numSkills: 2,
  armor: "", weapons: "Daggers", tools: "None", wealth: "4d4x10",
  spellAbility: "Intelligence", proficiency: "Intelligence, Wisdom, Arcana",
  slots: [[2, 2], [3, 3]],
  features: [
    { level: 1, name: "Spellcasting", text: "A very long description ".repeat(200) },
    { level: 1, name: "Arcane Recovery", text: "Another long one ".repeat(200) },
    { level: 2, name: "Arcane Tradition", text: "And another ".repeat(200) },
  ],
};

describe("what the index keeps", () => {
  it("every feature, at its level, in order", () => {
    const [row] = classIndex([wizard]);
    expect(row?.features).toEqual([
      { level: 1, name: "Spellcasting" },
      { level: 1, name: "Arcane Recovery" },
      { level: 2, name: "Arcane Tradition" },
    ]);
  });

  it("and the slot table, which is numbers rather than prose", () => {
    expect(classIndex([wizard])[0]?.slots).toEqual([[2, 2], [3, 3]]);
  });

  it("with the id and name the merge keys on", () => {
    const [row] = classIndex([wizard]);
    expect(row?.id).toBe("wizard");
    expect(row?.name).toBe("Wizard");
    expect(row?.hitDie).toBe(6);
  });
});

describe("what it drops", () => {
  it("the descriptions, which are the whole reason the file is 6MB", () => {
    const before = JSON.stringify([wizard]).length;
    const after = JSON.stringify(classIndex([wizard])).length;
    expect(after).toBeLessThan(before / 20);
    expect(JSON.stringify(classIndex([wizard]))).not.toContain("long description");
  });

  it("without dropping a class that has no features at all", () => {
    // A compendium row can be a stub. Losing it here would take a whole class
    // off the per-level table, which is worse than an empty list.
    expect(classIndex([{ ...wizard, features: [] }])).toHaveLength(1);
  });
});
