import { describe, expect, it } from "vitest";
import { concentrationDc } from "../concentration.js";
import { makeEvent, type DomainEvent } from "../events.js";
import { project } from "../project.js";
import { kira } from "./fixtures.js";

const add = makeEvent({ type: "characterAdded", character: kira });
const run = (...rest: DomainEvent[]) => project([add, ...rest]);
const k = (s: ReturnType<typeof project>) => s.characters.kira!;

const concentrate = makeEvent({
  type: "concentrationStarted", who: "kira", on: "Hunter's Mark",
});

describe("the DC nobody computes correctly at the table", () => {
  it("is half the damage, or 10, whichever is higher", () => {
    expect(concentrationDc(4)).toBe(10);
    expect(concentrationDc(20)).toBe(10);
    expect(concentrationDc(22)).toBe(11);
    expect(concentrationDc(41)).toBe(20);
  });

  it("rounds down", () => {
    expect(concentrationDc(23)).toBe(11);
  });
});

describe("damage owes a save", () => {
  it("queues one when a concentrating character is hit", () => {
    const s = run(concentrate, makeEvent({ type: "damageApplied", who: "kira", amount: 22 }));
    expect(k(s).concentrationChecks).toEqual([{ dc: 11, fromDamage: 22 }]);
  });

  it("owes nothing when not concentrating", () => {
    const s = run(makeEvent({ type: "damageApplied", who: "kira", amount: 22 }));
    expect(k(s).concentrationChecks).toEqual([]);
  });

  it("queues one save per instance of damage", () => {
    const s = run(
      concentrate,
      makeEvent({ type: "damageApplied", who: "kira", amount: 22 }),
      makeEvent({ type: "damageApplied", who: "kira", amount: 6 }),
    );
    expect(k(s).concentrationChecks.map((c) => c.dc)).toEqual([11, 10]);
  });

  it("owes nothing when the damage dropped you — concentration is already gone", () => {
    const s = run(concentrate, makeEvent({ type: "damageApplied", who: "kira", amount: 52 }));
    expect(k(s).concentratingOn).toBeNull();
    expect(k(s).concentrationChecks).toEqual([]);
  });
});

describe("resolving a save", () => {
  const hit = makeEvent({ type: "damageApplied", who: "kira", amount: 22 }); // DC 11

  it("holds concentration when the total meets the DC", () => {
    const s = run(concentrate, hit, makeEvent({
      type: "concentrationChecked", who: "kira", mode: "normal", dice: [9], modifier: 2,
    }));
    expect(k(s).concentratingOn).toBe("Hunter's Mark");
    expect(k(s).concentrationChecks).toEqual([]);
  });

  it("drops it when the total misses", () => {
    const s = run(concentrate, hit, makeEvent({
      type: "concentrationChecked", who: "kira", mode: "normal", dice: [3], modifier: 2,
    }));
    expect(k(s).concentratingOn).toBeNull();
  });

  it("compares against the DC of the hit that owed it, not the latest", () => {
    // 41 damage owes DC 20; a later 4 owes DC 10. A 15 total must fail the first.
    const s = run(
      concentrate,
      makeEvent({ type: "damageApplied", who: "kira", amount: 41 }),
      makeEvent({ type: "damageApplied", who: "kira", amount: 4 }),
      makeEvent({ type: "concentrationChecked", who: "kira", mode: "normal", dice: [13], modifier: 2 }),
    );
    expect(k(s).concentratingOn).toBeNull();
  });

  it("resolves the queue one save at a time", () => {
    const pass = { type: "concentrationChecked", who: "kira", mode: "normal", dice: [18], modifier: 2 } as const;
    const s = run(
      concentrate,
      makeEvent({ type: "damageApplied", who: "kira", amount: 22 }),
      makeEvent({ type: "damageApplied", who: "kira", amount: 6 }),
      makeEvent(pass),
    );
    expect(k(s).concentrationChecks).toHaveLength(1);
    expect(k(s).concentratingOn).toBe("Hunter's Mark");
  });

  it("clears every remaining save on a failure, since concentration is gone", () => {
    const s = run(
      concentrate,
      makeEvent({ type: "damageApplied", who: "kira", amount: 22 }),
      makeEvent({ type: "damageApplied", who: "kira", amount: 6 }),
      makeEvent({ type: "concentrationChecked", who: "kira", mode: "normal", dice: [1], modifier: 2 }),
    );
    expect(k(s).concentrationChecks).toEqual([]);
    expect(k(s).concentratingOn).toBeNull();
  });

  it("takes advantage into account", () => {
    const s = run(concentrate, hit, makeEvent({
      type: "concentrationChecked", who: "kira", mode: "advantage", dice: [2, 17], modifier: 2,
    }));
    expect(k(s).concentratingOn).toBe("Hunter's Mark");
  });

  it("ignores a resolution when nothing is owed", () => {
    const s = run(concentrate, makeEvent({
      type: "concentrationChecked", who: "kira", mode: "normal", dice: [1], modifier: 2,
    }));
    expect(k(s).concentratingOn).toBe("Hunter's Mark");
  });
});

describe("starting and stopping", () => {
  it("clears anything owed when concentration is dropped by hand", () => {
    const s = run(
      concentrate,
      makeEvent({ type: "damageApplied", who: "kira", amount: 22 }),
      makeEvent({ type: "concentrationEnded", who: "kira" }),
    );
    expect(k(s).concentrationChecks).toEqual([]);
  });

  it("clears anything owed when a new spell takes over", () => {
    const s = run(
      concentrate,
      makeEvent({ type: "damageApplied", who: "kira", amount: 22 }),
      makeEvent({ type: "concentrationStarted", who: "kira", on: "Spike Growth" }),
    );
    expect(k(s).concentratingOn).toBe("Spike Growth");
    expect(k(s).concentrationChecks).toEqual([]);
  });
});

describe("undo", () => {
  it("un-owes a save when the damage that caused it is reverted", () => {
    const hit = makeEvent({ type: "damageApplied", who: "kira", amount: 22 });
    const s = project([
      add, concentrate, hit, makeEvent({ type: "reverted", target: hit.id }),
    ]);
    expect(k(s).concentrationChecks).toEqual([]);
    expect(k(s).currentHp).toBe(52);
  });

  it("brings concentration back when a failed save is reverted", () => {
    const hit = makeEvent({ type: "damageApplied", who: "kira", amount: 22 });
    const failed = makeEvent({
      type: "concentrationChecked", who: "kira", mode: "normal", dice: [3], modifier: 2,
    });
    const s = project([
      add, concentrate, hit, failed, makeEvent({ type: "reverted", target: failed.id }),
    ]);
    expect(k(s).concentratingOn).toBe("Hunter's Mark");
    expect(k(s).concentrationChecks).toHaveLength(1);
  });
});
