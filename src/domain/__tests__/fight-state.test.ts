/*
 * The fight's new memory: what is wrong with a creature, what people did on
 * their turns, what they are holding, and a question the DM has asked.
 */
import { describe, expect, it } from "vitest";
import { advance, startCombat, type Combatant } from "../combat.js";

const creature = (id: string, name: string): Combatant =>
  ({
    id, name, initiative: 10,
    source: { kind: "creature", maxHp: 10, statblockId: "x" },
    controller: { kind: "dm" }, disclosure: "exact",
  }) as Combatant;

const twoUp = () => {
  const c = startCombat([
    { ...creature("a", "Kira"), initiative: 20 },
    creature("b", "Goblin"),
  ]);
  return c;
};

describe("a fight starts with none of it", () => {
  it("has no conditions, tags, offers or readied actions", () => {
    const c = twoUp();
    expect(c.creatureConditions).toEqual({});
    expect(c.tags).toEqual({});
    expect(c.offer).toBe(null);
    expect(c.readied).toEqual({});
    expect(c.shove).toBe(null);
  });
});

describe("what expires when your turn comes round", () => {
  it("drops your dodge, because Dodge lasts until your next turn", () => {
    const c = { ...twoUp(), turn: 1, tags: { a: ["dodging"] as const, b: ["helped"] as const } };
    const next = advance(c, 1);
    expect(next.tags.a).toBeUndefined();
    // Someone else's is not yours to lose.
    expect(next.tags.b).toEqual(["helped"]);
  });

  it("kills an unanswered offer with the turn that raised it", () => {
    // Answering a question about a moment that has passed is worse than
    // never being asked.
    const c = {
      ...twoUp(),
      offer: { to: ["a"], because: "it is leaving", from: "Goblin", declined: [] },
    };
    expect(advance(c, 0).offer).toBe(null);
  });

  it("leaves a readied action alone — it is waiting on a trigger, not a turn", () => {
    const c = { ...twoUp(), readied: { a: "when it opens the door" } };
    expect(advance(c, 0).readied).toEqual({ a: "when it opens the door" });
  });
});
