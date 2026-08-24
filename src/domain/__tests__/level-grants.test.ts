/*
 * A level gives more than hit points.
 */
import { describe, expect, it } from "vitest";
import { appendLevel, effectiveBuild } from "../build.js";
import { assemble } from "../creation.js";
import { outerParen, ownerOf } from "../subclass.js";

const base = assemble({
  name: "Bel", level: 2, classSkills: [],
  baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  race: { id: "human", name: "Human", speed: 30, abilityBonuses: {} },
  klass: { id: "cleric", name: "Cleric", hitDie: 8, saves: ["wis", "cha"], spellSlots: [] },
  background: { name: "Acolyte", skills: [], tools: [] },
} as never);

describe("a subclass chosen at the table", () => {
  it("reaches the sheet", () => {
    // Build at 1, reach 3, and nothing ever asked. This is that question.
    const after = appendLevel({ base, deltas: [] }, "cleric" as never, 5, "2026-08-23", {
      picks: [{ of: "Divine Domain", name: "Life Domain" }],
    });
    expect(effectiveBuild(after).choices).toEqual([
      { of: "Divine Domain", name: "Life Domain" },
    ]);
  });

  it("is taken back with the level that granted it", () => {
    // The whole reason it rides on the delta rather than its own event.
    const character = { base, deltas: [] };
    const after = appendLevel(character, "cleric" as never, 5, "2026-08-23", {
      picks: [{ of: "Divine Domain", name: "Life Domain" }],
    });
    expect(effectiveBuild(after).choices).toHaveLength(1);
    expect(effectiveBuild(character as never).choices).toHaveLength(0);
  });

  it("does not ask twice for the same thing", () => {
    const one = appendLevel({ base, deltas: [] }, "cleric" as never, 5, "2026-08-23", {
      picks: [{ of: "Divine Domain", name: "Life Domain" }],
    });
    const two = appendLevel(one, "cleric" as never, 5, "2026-08-24", {
      picks: [{ of: "Divine Domain", name: "War Domain" }],
    });
    // The first answer stands; a level cannot quietly rewrite it.
    expect(effectiveBuild(two).choices).toEqual([
      { of: "Divine Domain", name: "Life Domain" },
    ]);
  });
});

describe("whose feature is whose", () => {
  const options = new Set(["Champion", "Purple Dragon Knight", "Life Domain"]);

  it("reads the outermost parenthetical, not the innermost", () => {
    // "Banneret" matches no option, so reading the last group made a
    // subclass feature look class-wide — a hundred and fifty of them.
    expect(outerParen("Rallying Cry (Purple Dragon Knight (Banneret))"))
      .toBe("Purple Dragon Knight (Banneret)");
    expect(outerParen("Action Surge (one use)")).toBe("one use");
    expect(outerParen("Martial Archetype")).toBe(null);
  });

  it("only calls it an owner when it names one", () => {
    expect(ownerOf("Rallying Cry (Purple Dragon Knight (Banneret))", options))
      .toBe("Purple Dragon Knight");
    expect(ownerOf("Improved Critical (Champion)", options)).toBe("Champion");
    // The one that matters: a real class feature keeps its parenthetical.
    expect(ownerOf("Action Surge (one use)", options)).toBe(null);
    expect(ownerOf("Martial Archetype", options)).toBe(null);
  });
});
