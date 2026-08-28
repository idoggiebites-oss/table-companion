import { describe, expect, it } from "vitest";
import { advance, awaitingRolls, beginCombat, hasReaction, isSurprised, movementLeft, setInitiative, sortOrder, stageCombat, startCombat, type Combatant } from "../combat.js";

const pc = (id: string, initiative: number | null, extra: Partial<Combatant> = {}): Combatant => ({
  id, name: id, initiative,
  source: { kind: "character", characterId: id },
  controller: { kind: "player", characterId: id },
  disclosure: "exact",
  ...extra,
});

describe("rolling for initiative together", () => {
  it("starts with nobody having rolled", () => {
    const c = stageCombat([pc("a", null), pc("b", null)]);
    expect(c.phase).toBe("rolling");
    expect(awaitingRolls(c)).toHaveLength(2);
  });

  it("knows who the table is still waiting on", () => {
    let c = stageCombat([pc("a", null), pc("b", null)]);
    c = setInitiative(c, "a", 18);
    expect(awaitingRolls(c).map((x) => x.id)).toEqual(["b"]);
  });

  it("sorts unrolled last rather than as a zero", () => {
    // A half-rolled order still has to read correctly while people roll.
    const order = sortOrder([pc("a", null), pc("b", 3), pc("c", 20)]);
    expect(order.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("distinguishes a bad roll from no roll", () => {
    const order = sortOrder([pc("unrolled", null), pc("rolled-1", 1)]);
    expect(order[0]!.id).toBe("rolled-1");
  });

  it("has no active combatant until it begins", () => {
    const c = stageCombat([pc("a", null)]);
    expect(advance(c, 0)).toEqual(c);
  });

  it("drops anyone who never rolled rather than placing them arbitrarily", () => {
    let c = stageCombat([pc("a", null), pc("b", 12)]);
    c = beginCombat(c);
    expect(c.phase).toBe("active");
    expect(c.order.map((x) => x.id)).toEqual(["b"]);
  });

  it("settles the order highest first", () => {
    let c = stageCombat([pc("a", null), pc("b", null), pc("c", null)]);
    c = setInitiative(c, "a", 7);
    c = setInitiative(c, "b", 21);
    c = setInitiative(c, "c", 14);
    expect(beginCombat(c).order.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});

describe("surprise", () => {
  it("costs the first round only", () => {
    const c = beginCombat(setInitiative(stageCombat([pc("a", null, { surprised: true })]), "a", 10));
    expect(isSurprised(c, c.order[0]!)).toBe(true);
    expect(isSurprised({ ...c, round: 2 }, c.order[0]!)).toBe(false);
  });

  it("leaves everyone else alone", () => {
    const c = beginCombat(setInitiative(stageCombat([pc("a", null)]), "a", 10));
    expect(isSurprised(c, c.order[0]!)).toBe(false);
  });
});

describe("movement", () => {
  const start = () =>
    beginCombat(
      setInitiative(
        setInitiative(stageCombat([pc("a", null, { speed: 30 }), pc("b", null, { speed: 25 })]), "a", 20),
        "b", 10,
      ),
    );

  it("is untracked when a combatant has no speed", () => {
    const c = beginCombat(setInitiative(stageCombat([pc("a", null)]), "a", 5));
    expect(movementLeft(c, c.order[0]!)).toBe(null);
  });

  it("spends down", () => {
    const c = start();
    const moved = { ...c, moved: { a: 15 } };
    expect(movementLeft(moved, moved.order[0]!)).toBe(15);
  });

  it("lets a dash exceed the speed — the reason spend is signed", () => {
    const c = start();
    // Moved 15, then dashed: 15 left plus another 30.
    const dashed = { ...c, moved: { a: 15 - 30 } };
    expect(movementLeft(dashed, dashed.order[0]!)).toBe(45);
  });

  it("never reports less than nothing left", () => {
    const c = start();
    const spent = { ...c, moved: { a: 99 } };
    expect(movementLeft(spent, spent.order[0]!)).toBe(0);
  });

  it("comes back when your turn opens, like the economy", () => {
    const c = { ...start(), moved: { a: 30, b: 10 } };
    const next = advance(c, 0);
    expect(next.moved.b).toBeUndefined();
    // And the one who just acted keeps theirs until it comes round again.
    expect(next.moved.a).toBe(30);
  });

  it("clears the first combatant's when the round wraps", () => {
    const c = { ...start(), turn: 1, moved: { a: 30, b: 10 } };
    const next = advance(c, 1);
    expect(next.round).toBe(2);
    expect(next.moved.a).toBeUndefined();
  });
});

describe("a creature's reaction", () => {
  const cr = (id: string, initiative: number | null) => ({
    id, name: id, initiative,
    source: { kind: "creature" as const, maxHp: 10 },
    controller: { kind: "dm" as const },
    disclosure: "vague" as const,
  });
  const start = () =>
    beginCombat(
      setInitiative(setInitiative(stageCombat([pc("a", null), cr("g", null)]), "a", 20), "g", 10),
    );

  it("starts available", () => {
    expect(hasReaction(start(), "g")).toBe(true);
  });

  it("is spent once taken", () => {
    const c = { ...start(), reactions: { g: true } };
    expect(hasReaction(c, "g")).toBe(false);
  });

  it("comes back on its own turn, not on everyone else's", () => {
    const c = { ...start(), reactions: { g: true } };
    // Turn 0 is the character; advancing opens the creature's turn.
    const next = advance(c, 0);
    expect(hasReaction(next, "g")).toBe(true);
  });

  it("survives somebody else's turn opening", () => {
    const c = { ...start(), turn: 1, reactions: { g: true } };
    const next = advance(c, 1); // wraps to the character
    expect(hasReaction(next, "g")).toBe(false);
  });
});

/* --- Help expires off the HELPER's turn ----------------------------------

   `advance` cleared every stance tag on the creature whose turn was opening,
   which meant being helped and then having your go deleted the advantage one
   instant before it could apply. Help had never once worked, and nothing
   noticed because the sample table had one person in it. */
describe("help lasts until the helper's next turn", () => {
  const roll = (id: string, name: string, initiative: number) => ({
    id, name, initiative,
    source: { kind: "creature" as const, maxHp: 10 },
    controller: { kind: "dm" as const },
    disclosure: "exact" as const,
  });
  const staged = () => {
    const c = startCombat([roll("a", "Helper", 20), roll("b", "Helped", 15), roll("c", "Ogre", 5)]);
    return { ...c, tags: { b: ["helped"] as const }, helpedBy: { b: "a" } };
  };

  it("survives the helped creature's own turn, which is when it is used", () => {
    const after = advance(staged(), 0);
    expect(after.order[after.turn]?.name).toBe("Helped");
    expect(after.tags["b"]).toContain("helped");
  });

  it("and is gone by the time the helper goes again", () => {
    let c = advance(staged(), 0); // → Helped
    c = advance(c, 1); // → Ogre
    c = advance(c, 2); // → round 2, Helper
    expect(c.order[c.turn]?.name).toBe("Helper");
    expect(c.tags["b"] ?? []).not.toContain("helped");
  });

  /* Dodge is the one that DOES end on your own turn — "until the start of
     your next turn" — so the fix must not have made every tag permanent. */
  it("but dodge still ends when your turn opens", () => {
    const c = { ...startCombat([roll("a", "A", 20), roll("b", "B", 10)]), tags: { b: ["dodging"] as const } };
    const after = advance(c, 0);
    expect(after.tags["b"] ?? []).not.toContain("dodging");
  });
});

/* --- a creature's economy and its legendary actions ----------------------

   Creatures had a single boolean for the reaction, so a DM running six
   goblins tracked "has that one used its bonus action" in their head. And
   legendary actions come back at the START of the creature's turn, which is
   the rule and is also the only moment the app can hand them back. */
describe("what a creature gets back on its turn", () => {
  const roll = (id: string, name: string, initiative: number) => ({
    id, name, initiative,
    source: { kind: "creature" as const, maxHp: 10 },
    controller: { kind: "dm" as const },
    disclosure: "exact" as const,
  });
  const fight = () => ({
    ...startCombat([roll("a", "Dragon", 20), roll("b", "Goblin", 10)]),
    spent: { a: { action: true, bonus: true, reaction: true } },
    legendarySpent: { a: 3 },
  });

  it("hands back its action economy when its turn opens", () => {
    let c = advance(fight(), 0);   // → Goblin
    expect(c.spent["a"]).toBeDefined();
    c = advance(c, 1);             // → round 2, Dragon
    expect(c.order[c.turn]?.name).toBe("Dragon");
    expect(c.spent["a"]).toBeUndefined();
  });

  it("and its legendary actions with them", () => {
    let c = advance(fight(), 0);
    expect(c.legendarySpent["a"]).toBe(3);
    c = advance(c, 1);
    expect(c.legendarySpent["a"]).toBeUndefined();
  });

  /* Somebody else's turn opening must not refill the dragon — that would give
     it three legendary actions per creature rather than per round. */
  it("but nobody else's turn refills them", () => {
    const c = advance(fight(), 0);
    expect(c.order[c.turn]?.name).toBe("Goblin");
    expect(c.legendarySpent["a"]).toBe(3);
  });
});
