import { describe, expect, it } from "vitest";
import { makeEvent, type DomainEvent } from "../events.js";
import { project } from "../project.js";
import { hitDiceRegainedOnLongRest, previewRest } from "../rest.js";
import { characterOf, kira } from "./fixtures.js";

const add = makeEvent({ type: "characterAdded", character: kira });
const run = (...rest: DomainEvent[]) => project([add, ...rest]);
const k = (s: ReturnType<typeof project>) => s.characters.kira!;

describe("hit dice on a long rest", () => {
  it("returns half your total, rounded down, minimum one", () => {
    expect(hitDiceRegainedOnLongRest(8)).toBe(4);
    expect(hitDiceRegainedOnLongRest(9)).toBe(4);
    expect(hitDiceRegainedOnLongRest(1)).toBe(1);
    expect(hitDiceRegainedOnLongRest(2)).toBe(1);
  });

  it("does not refill the pool the way everything else does", () => {
    const state = run(
      makeEvent({ type: "resourceSpent", who: "kira", resource: "hitDice", amount: 5 }),
      makeEvent({ type: "longRestTaken", who: ["kira"] }),
    );
    // Five spent, four back — the rule tables get wrong.
    expect(k(state).spent.hitDice).toBe(1);
  });
});

describe("long rest", () => {
  const before = run(
    makeEvent({ type: "damageApplied", who: "kira", amount: 29 }),
    makeEvent({ type: "tempHpGranted", who: "kira", amount: 7 }),
    makeEvent({ type: "resourceSpent", who: "kira", resource: "slot1", amount: 2 }),
    makeEvent({ type: "resourceSpent", who: "kira", resource: "hitDice", amount: 5 }),
    makeEvent({ type: "exhaustionChanged", who: "kira", delta: 2 }),
  );

  it("previews exactly what the commit will do", () => {
    const [p] = previewRest(before, "long", ["kira"]);
    expect(p!.hp).toEqual({ from: 23, to: 52 });
    expect(p!.tempHpLost).toBe(7);
    expect(p!.exhaustion).toEqual({ from: 2, to: 1 });
    expect(p!.resources.find((r) => r.id === "slot1")).toMatchObject({
      spentBefore: 2, spentAfter: 0,
    });
    expect(p!.resources.find((r) => r.id === "hitDice")).toMatchObject({
      spentBefore: 5, spentAfter: 1,
    });
  });

  it("commits what it previewed", () => {
    const after = project([
      add,
      makeEvent({ type: "damageApplied", who: "kira", amount: 29 }),
      makeEvent({ type: "tempHpGranted", who: "kira", amount: 7 }),
      makeEvent({ type: "resourceSpent", who: "kira", resource: "slot1", amount: 2 }),
      makeEvent({ type: "resourceSpent", who: "kira", resource: "hitDice", amount: 5 }),
      makeEvent({ type: "exhaustionChanged", who: "kira", delta: 2 }),
      makeEvent({ type: "longRestTaken", who: ["kira"] }),
    ]);
    expect(k(after).currentHp).toBe(52);
    expect(k(after).tempHp).toBe(0); // temp HP does not survive a long rest
    expect(k(after).exhaustion).toBe(1); // steps down by one, not to zero
    expect(k(after).spent.slot1).toBe(0);
    expect(k(after).spent.hitDice).toBe(1);
  });

  it("clears the death save track", () => {
    const state = run(
      makeEvent({ type: "damageApplied", who: "kira", amount: 52 }),
      makeEvent({ type: "deathSaveRecorded", who: "kira", result: "failure" }),
      makeEvent({ type: "longRestTaken", who: ["kira"] }),
    );
    expect(k(state).deathSaves).toEqual({ successes: 0, failures: 0 });
  });
});

describe("short rest", () => {
  it("leaves hit points and long-rest pools alone", () => {
    const state = run(
      makeEvent({ type: "damageApplied", who: "kira", amount: 29 }),
      makeEvent({ type: "resourceSpent", who: "kira", resource: "slot1", amount: 2 }),
      makeEvent({ type: "shortRestTaken", who: ["kira"] }),
    );
    expect(k(state).currentHp).toBe(23);
    expect(k(state).spent.slot1).toBe(2);
  });

  it("restores short-rest pools", () => {
    const fighter = characterOf("fighter", 5);
    const log = [
      makeEvent({ type: "characterAdded", character: fighter }),
      makeEvent({
        type: "resourceSpent", who: fighter.base.id, resource: "actionSurge", amount: 1,
      }),
      makeEvent({ type: "shortRestTaken", who: [fighter.base.id] }),
    ];
    expect(project(log).characters[fighter.base.id]!.spent.actionSurge).toBe(0);
  });

  it("restores warlock pact slots, which no other slot does", () => {
    const warlock = characterOf("warlock", 5, {
      pactSlots: { count: 2, level: 3 }, spellSlots: [],
    });
    const log = [
      makeEvent({ type: "characterAdded", character: warlock }),
      makeEvent({
        type: "resourceSpent", who: warlock.base.id, resource: "pactSlots", amount: 2,
      }),
      makeEvent({ type: "shortRestTaken", who: [warlock.base.id] }),
    ];
    expect(project(log).characters[warlock.base.id]!.spent.pactSlots).toBe(0);
  });

  it("reports nothing to do when nothing is spent", () => {
    const [p] = previewRest(run(), "short", ["kira"]);
    expect(p!.noop).toBe(true);
  });
});

describe("bard, whose recharge changes at level 5", () => {
  const spendAndRest = (level: number) => {
    const bard = characterOf("bard", level, { spellSlots: [] });
    const log = [
      makeEvent({ type: "characterAdded", character: bard }),
      makeEvent({
        type: "resourceSpent", who: bard.base.id, resource: "bardicInspiration", amount: 1,
      }),
      makeEvent({ type: "shortRestTaken", who: [bard.base.id] }),
    ];
    return project(log).characters[bard.base.id]!.spent.bardicInspiration;
  };

  it("does not restore on a short rest at level 4", () => {
    expect(spendAndRest(4)).toBe(1);
  });

  it("restores on a short rest from level 5, with no code branch", () => {
    expect(spendAndRest(5)).toBe(0);
  });
});
