/*
 * A second class is not a first one.
 */
import { describe, expect, it } from "vitest";
import { describeGrant, multiclassGrant } from "../multiclassing.js";

describe("what a second class brings", () => {
  it("a short list, not the class's full training", () => {
    // A fighter taken at creation has two skills off its list. Taken later
    // it has none — the book is explicit, and this is the difference.
    expect(multiclassGrant("fighter")?.skills).toBeUndefined();
    expect(multiclassGrant("fighter")?.proficiencies).toContain("martial weapons");
  });

  it("and for three classes, exactly one skill", () => {
    expect(multiclassGrant("rogue")?.skills?.choose).toBe(1);
    expect(multiclassGrant("ranger")?.skills?.choose).toBe(1);
    expect(multiclassGrant("bard")?.skills?.choose).toBe(1);
  });

  it("from its own list, except the bard's, which is any", () => {
    expect(multiclassGrant("bard")?.skills?.from).toEqual([]);
    expect(multiclassGrant("rogue")?.skills?.from).toContain("stealth");
    expect(multiclassGrant("rogue")?.skills?.from).not.toContain("arcana");
  });

  it("nothing at all for the two that only bring spells", () => {
    expect(multiclassGrant("wizard")?.proficiencies).toEqual([]);
    expect(multiclassGrant("sorcerer")?.skills).toBeUndefined();
  });

  it("and tools where the book says so", () => {
    expect(multiclassGrant("rogue")?.tools).toEqual(["thieves' tools"]);
    expect(multiclassGrant("artificer")?.tools).toContain("tinker's tools");
  });
});

describe("saying it in a line", () => {
  it("names what comes across", () => {
    expect(describeGrant("Rogue", multiclassGrant("rogue")!)).toBe(
      "Taken as a second class, Rogue brings light armour, thieves' tools and one skill from its list.",
    );
  });

  it("and says plainly when nothing does", () => {
    // "Wizard brings" followed by nothing is worse than a sentence.
    expect(describeGrant("Wizard", multiclassGrant("wizard")!)).toBe(
      "Wizard brings its spellcasting and nothing else — no armour, no weapons, no skills.",
    );
  });
});
