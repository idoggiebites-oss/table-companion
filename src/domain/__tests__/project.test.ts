import { describe, expect, it } from "vitest";
import { makeEvent, type DomainEvent } from "../events.js";
import { project } from "../project.js";
import { kira } from "./fixtures.js";

const add = makeEvent({ type: "characterAdded", character: kira });

function run(...rest: DomainEvent[]) {
  const log = [add, ...rest];
  return { state: project(log), log };
}

const kiraState = (s: ReturnType<typeof project>) => s.characters.kira!;

describe("damage and healing", () => {
  it("starts at full health", () => {
    expect(kiraState(run().state).currentHp).toBe(52);
  });

  it("eats temporary hit points before real ones", () => {
    const { state } = run(
      makeEvent({ type: "tempHpGranted", who: "kira", amount: 7 }),
      makeEvent({ type: "damageApplied", who: "kira", amount: 10 }),
    );
    expect(kiraState(state).tempHp).toBe(0);
    expect(kiraState(state).currentHp).toBe(49);
  });

  it("does not stack temporary hit points", () => {
    const { state } = run(
      makeEvent({ type: "tempHpGranted", who: "kira", amount: 7 }),
      makeEvent({ type: "tempHpGranted", who: "kira", amount: 4 }),
    );
    expect(kiraState(state).tempHp).toBe(7);
  });

  it("never falls below zero or heals past the maximum", () => {
    const { state } = run(
      makeEvent({ type: "damageApplied", who: "kira", amount: 999 }),
      makeEvent({ type: "healingApplied", who: "kira", amount: 999 }),
    );
    expect(kiraState(state).currentHp).toBe(52);
  });

  it("drops concentration when you go down", () => {
    const { state } = run(
      makeEvent({ type: "concentrationStarted", who: "kira", on: "Hunter's Mark" }),
      makeEvent({ type: "damageApplied", who: "kira", amount: 52 }),
    );
    expect(kiraState(state).currentHp).toBe(0);
    expect(kiraState(state).concentratingOn).toBeNull();
  });
});

describe("death saves", () => {
  it("stabilises at three successes", () => {
    const s = makeEvent({ type: "deathSaveRecorded", who: "kira", result: "success" });
    const { state } = run(
      makeEvent({ type: "damageApplied", who: "kira", amount: 52 }),
      s,
      makeEvent({ type: "deathSaveRecorded", who: "kira", result: "success" }),
      makeEvent({ type: "deathSaveRecorded", who: "kira", result: "success" }),
    );
    expect(kiraState(state).stable).toBe(true);
    expect(kiraState(state).dead).toBe(false);
  });

  it("counts a natural 1 as two failures", () => {
    const { state } = run(
      makeEvent({ type: "damageApplied", who: "kira", amount: 52 }),
      makeEvent({ type: "deathSaveRecorded", who: "kira", result: "fumble" }),
      makeEvent({ type: "deathSaveRecorded", who: "kira", result: "failure" }),
    );
    expect(kiraState(state).deathSaves.failures).toBe(3);
    expect(kiraState(state).dead).toBe(true);
  });

  it("a natural 20 brings you back at one hit point", () => {
    const { state } = run(
      makeEvent({ type: "damageApplied", who: "kira", amount: 52 }),
      makeEvent({ type: "deathSaveRecorded", who: "kira", result: "failure" }),
      makeEvent({ type: "deathSaveRecorded", who: "kira", result: "critical" }),
    );
    expect(kiraState(state).currentHp).toBe(1);
    expect(kiraState(state).deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it("healing clears the death save track", () => {
    const { state } = run(
      makeEvent({ type: "damageApplied", who: "kira", amount: 52 }),
      makeEvent({ type: "deathSaveRecorded", who: "kira", result: "failure" }),
      makeEvent({ type: "healingApplied", who: "kira", amount: 5 }),
    );
    expect(kiraState(state).deathSaves.failures).toBe(0);
    expect(kiraState(state).currentHp).toBe(5);
  });
});

describe("hit dice", () => {
  it("spends one and heals the roll plus constitution", () => {
    const { state } = run(
      makeEvent({ type: "damageApplied", who: "kira", amount: 30 }),
      makeEvent({ type: "hitDiceSpent", who: "kira", rolled: 7, conMod: 2 }),
    );
    expect(kiraState(state).currentHp).toBe(31);
    expect(kiraState(state).spent.hitDice).toBe(1);
  });
});

describe("undo", () => {
  it("skips a reverted event instead of removing it", () => {
    const dmg = makeEvent({ type: "damageApplied", who: "kira", amount: 17 });
    const log = [add, dmg, makeEvent({ type: "reverted", target: dmg.id })];

    expect(kiraState(project(log)).currentHp).toBe(52);
    // Append-only: the mistake is still in the history.
    expect(log).toHaveLength(3);
    expect(log.some((e) => e.id === dmg.id)).toBe(true);
  });

  it("undoes an event in the middle of a log without disturbing the rest", () => {
    const a = makeEvent({ type: "damageApplied", who: "kira", amount: 10 });
    const b = makeEvent({ type: "damageApplied", who: "kira", amount: 5 });
    const c = makeEvent({ type: "damageApplied", who: "kira", amount: 3 });

    const all = project([add, a, b, c]);
    expect(kiraState(all).currentHp).toBe(34);

    const withoutB = project([add, a, b, c, makeEvent({ type: "reverted", target: b.id })]);
    expect(kiraState(withoutB).currentHp).toBe(39);
  });

  it("undoes a long rest by replaying without it, with no inverse operation", () => {
    const spendSlot = makeEvent({
      type: "resourceSpent", who: "kira", resource: "slot1", amount: 3,
    });
    const dmg = makeEvent({ type: "damageApplied", who: "kira", amount: 29 });
    const rest = makeEvent({ type: "longRestTaken", who: ["kira"] });

    const rested = project([add, spendSlot, dmg, rest]);
    expect(kiraState(rested).currentHp).toBe(52);
    expect(kiraState(rested).spent.slot1).toBe(0);

    const undone = project([
      add, spendSlot, dmg, rest, makeEvent({ type: "reverted", target: rest.id }),
    ]);
    expect(kiraState(undone).currentHp).toBe(23);
    expect(kiraState(undone).spent.slot1).toBe(3);
  });
});

describe("conditions", () => {
  it("adds once and removes cleanly", () => {
    const { state } = run(
      makeEvent({ type: "conditionAdded", who: "kira", condition: "prone" }),
      makeEvent({ type: "conditionAdded", who: "kira", condition: "prone" }),
      makeEvent({ type: "conditionAdded", who: "kira", condition: "frightened" }),
      makeEvent({ type: "conditionRemoved", who: "kira", condition: "prone" }),
    );
    expect(kiraState(state).conditions).toEqual(["frightened"]);
  });

  it("clamps exhaustion to the edition's table", () => {
    const { state } = run(
      makeEvent({ type: "exhaustionChanged", who: "kira", delta: 9 }),
    );
    expect(kiraState(state).exhaustion).toBe(6);
  });
});
