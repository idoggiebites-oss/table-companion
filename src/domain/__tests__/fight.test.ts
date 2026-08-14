import { describe, expect, it } from "vitest";
import {
  advance, awaitingRolls, beginCombat, isSurprised, movementLeft,
  setInitiative, sortOrder, stageCombat, type Combatant,
} from "../combat.js";

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
