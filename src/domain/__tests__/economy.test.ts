import { describe, expect, it } from "vitest";
import type { Combatant } from "../combat.js";
import { makeEvent, type DomainEvent } from "../events.js";
import { project } from "../project.js";
import { kira } from "./fixtures.js";

const kiraC: Combatant = {
  id: "pc-kira", name: "Kira Vance", initiative: 18,
  source: { kind: "character", characterId: "kira" },
  controller: { kind: "player", characterId: "kira" },
  disclosure: "exact",
};
const gob: Combatant = {
  id: "g1", name: "Goblin", initiative: 21,
  source: { kind: "creature", maxHp: 12 },
  controller: { kind: "dm" },
  disclosure: "vague",
};

const add = makeEvent({ type: "characterAdded", character: kira });
// Goblin is up first, so Kira starts the fight waiting.
const start = makeEvent({ type: "combatStarted", order: [kiraC, gob] });
const run = (...rest: DomainEvent[]) => project([add, start, ...rest]);
const eco = (s: ReturnType<typeof project>) => s.characters.kira!.economy;

describe("spending", () => {
  it("starts with everything available", () => {
    expect(eco(run())).toEqual({ action: false, bonus: false, reaction: false });
  });

  it("marks what was used", () => {
    const s = run(makeEvent({ type: "economySpent", who: "kira", kind: "bonus" }));
    expect(eco(s)).toMatchObject({ bonus: true, action: false });
  });
});

describe("the reaction is the one you spend off-turn", () => {
  it("can be spent while somebody else is acting", () => {
    // The goblin is up; an opportunity attack is still available to Kira.
    const s = run(makeEvent({ type: "economySpent", who: "kira", kind: "reaction" }));
    expect(s.combat?.order[0]?.name).toBe("Goblin");
    expect(eco(s).reaction).toBe(true);
  });

  it("stays spent across somebody else's whole turn", () => {
    const s = run(
      makeEvent({ type: "economySpent", who: "kira", kind: "reaction" }),
      makeEvent({ type: "turnAdvanced", from: 0 }), // now Kira is up
    );
    // ...and comes back the moment her turn begins, like everything else.
    expect(eco(s).reaction).toBe(false);
  });
});

describe("a turn beginning refills its owner", () => {
  it("clears everything when your turn comes round", () => {
    const s = run(
      makeEvent({ type: "turnAdvanced", from: 0 }),                       // Kira up
      makeEvent({ type: "economySpent", who: "kira", kind: "action" }),
      makeEvent({ type: "economySpent", who: "kira", kind: "bonus" }),
      makeEvent({ type: "turnAdvanced", from: 1 }),                       // goblin up
      makeEvent({ type: "turnAdvanced", from: 0 }),                       // Kira up again
    );
    expect(eco(s)).toEqual({ action: false, bonus: false, reaction: false });
  });

  it("does not refill somebody whose turn it is not", () => {
    const s = run(
      makeEvent({ type: "turnAdvanced", from: 0 }),                     // Kira up
      makeEvent({ type: "economySpent", who: "kira", kind: "action" }),
      makeEvent({ type: "turnAdvanced", from: 1 }),                     // goblin up
    );
    expect(eco(s).action).toBe(true);
  });

  it("does not refill when the guard refused the advance", () => {
    const s = run(
      makeEvent({ type: "turnAdvanced", from: 0 }),                     // Kira up
      makeEvent({ type: "economySpent", who: "kira", kind: "action" }),
      makeEvent({ type: "turnAdvanced", from: 0 }),                     // stale, ignored
    );
    expect(s.combat?.turn).toBe(1);
    expect(eco(s).action).toBe(true);
  });

  it("refills whoever is first when a fight starts", () => {
    const s = project([
      add,
      makeEvent({ type: "economySpent", who: "kira", kind: "action" }),
      makeEvent({ type: "combatStarted", order: [kiraC] }),
    ]);
    expect(s.characters.kira?.economy.action).toBe(false);
  });
});

describe("out of combat", () => {
  it("has nothing to have spent", () => {
    const s = run(
      makeEvent({ type: "economySpent", who: "kira", kind: "reaction" }),
      makeEvent({ type: "combatEnded" }),
    );
    expect(eco(s)).toEqual({ action: false, bonus: false, reaction: false });
  });
});
