import { describe, expect, it } from "vitest";
import {
  advance, controls, mayEndTurn, sortOrder, startCombat, turnsUntil, visibleTo,
  type Combatant, type Seat,
} from "../combat.js";
import { makeEvent, type DomainEvent } from "../events.js";
import { project } from "../project.js";
import { kira } from "./fixtures.js";

const pc = (id: string, initiative: number): Combatant => ({
  id: `c-${id}`,
  name: id,
  initiative,
  source: { kind: "character", characterId: id },
  controller: { kind: "player", characterId: id },
  disclosure: "exact",
});

const creature = (id: string, initiative: number, over: Partial<Combatant> = {}): Combatant => ({
  id,
  name: id,
  initiative,
  source: { kind: "creature", maxHp: 12 },
  controller: { kind: "dm" },
  disclosure: "vague",
  ...over,
});

const order = [pc("kira", 18), creature("goblin", 16), pc("aldric", 21)];

describe("ordering", () => {
  it("is highest initiative first", () => {
    expect(sortOrder(order).map((c) => c.name)).toEqual(["aldric", "kira", "goblin"]);
  });

  it("breaks ties by the order given, so every device agrees", () => {
    const tied = [creature("a", 16), creature("b", 16), creature("c", 16)];
    expect(sortOrder(tied).map((c) => c.name)).toEqual(["a", "b", "c"]);
    // Reversing the input reverses the result — the DM's order is the rule,
    // and nothing device-local ever enters the comparison.
    expect(sortOrder([...tied].reverse()).map((c) => c.name)).toEqual(["c", "b", "a"]);
  });

  it("gives creatures their hit points when combat starts", () => {
    expect(startCombat(order).creatureHp).toEqual({ goblin: 12 });
  });
});

describe("advancing", () => {
  const combat = startCombat(order);

  it("moves to the next combatant", () => {
    expect(advance(combat, 0).turn).toBe(1);
  });

  it("wraps and increments the round", () => {
    const last = { ...combat, turn: 2 };
    expect(advance(last, 2)).toMatchObject({ turn: 0, round: 2 });
  });

  it("ignores a request that names a turn already passed", () => {
    // Two devices press at the same instant: the server orders both, every
    // client replays both, and only the first one moves anything.
    const once = advance(combat, 0);
    const twice = advance(once, 0);
    expect(once.turn).toBe(1);
    expect(twice.turn).toBe(1);
  });

  it("ignores a request from the future too", () => {
    expect(advance(combat, 5).turn).toBe(0);
  });
});

describe("who may end a turn", () => {
  const combat = startCombat(order); // aldric is up
  const dm: Seat = { kind: "dm" };
  const asKira: Seat = { kind: "player", characterId: "kira" };
  const asAldric: Seat = { kind: "player", characterId: "aldric" };

  it("lets the DM advance whatever is up", () => {
    expect(mayEndTurn(dm, combat)).toBe(true);
    expect(mayEndTurn(dm, { ...combat, turn: 2 })).toBe(true);
  });

  it("lets a player end their own turn", () => {
    expect(mayEndTurn(asAldric, combat)).toBe(true);
  });

  it("does not let a player end somebody else's", () => {
    expect(mayEndTurn(asKira, combat)).toBe(false);
  });

  it("lets a player end their summon's turn, with no special case", () => {
    const wolf = creature("wolf", 9, {
      controller: { kind: "player", characterId: "kira" },
    });
    const withWolf = startCombat([...order, wolf]);
    const onWolf = { ...withWolf, turn: 3 };
    expect(mayEndTurn(asKira, onWolf)).toBe(true);
    expect(mayEndTurn(asAldric, onWolf)).toBe(false);
  });

  it("is decided by the controller field, not by what kind of thing it is", () => {
    expect(controls({ kind: "dm" }, { kind: "dm" })).toBe(true);
    expect(controls(asKira, { kind: "player", characterId: "kira" })).toBe(true);
    expect(controls(asKira, { kind: "player", characterId: "aldric" })).toBe(false);
  });
});

describe("turn distance", () => {
  const combat = startCombat(order); // aldric, kira, goblin

  it("is zero when it is your turn", () => {
    expect(turnsUntil(combat, "aldric")).toBe(0);
  });

  it("counts forward and wraps", () => {
    expect(turnsUntil(combat, "kira")).toBe(1);
    expect(turnsUntil({ ...combat, turn: 2 }, "kira")).toBe(2);
  });

  it("is null for someone not in the fight", () => {
    expect(turnsUntil(combat, "nessa")).toBeNull();
  });
});

describe("disclosure", () => {
  it("hides a hidden creature from players but never from the DM", () => {
    const ambusher = creature("ambusher", 20, { disclosure: "hidden" });
    expect(visibleTo({ kind: "dm" }, ambusher)).toBe(true);
    expect(visibleTo({ kind: "player", characterId: "kira" }, ambusher)).toBe(false);
  });

  it("is orthogonal to who controls the creature", () => {
    const openPet = creature("bear", 10, {
      controller: { kind: "dm" },
      disclosure: "exact",
    });
    expect(visibleTo({ kind: "player", characterId: "kira" }, openPet)).toBe(true);
  });
});

describe("through the log", () => {
  const add = makeEvent({ type: "characterAdded", character: kira });
  const start = makeEvent({ type: "combatStarted", order });
  const run = (...rest: DomainEvent[]) => project([add, start, ...rest]);

  it("puts combat into campaign state", () => {
    const s = run();
    expect(s.combat?.round).toBe(1);
    expect(s.combat?.order.map((c) => c.name)).toEqual(["aldric", "kira", "goblin"]);
  });

  it("advances once when two devices ask against the same turn", () => {
    const s = run(
      makeEvent({ type: "turnAdvanced", from: 0 }),
      makeEvent({ type: "turnAdvanced", from: 0 }),
    );
    expect(s.combat?.turn).toBe(1);
  });

  it("advances twice when the second request names the new turn", () => {
    const s = run(
      makeEvent({ type: "turnAdvanced", from: 0 }),
      makeEvent({ type: "turnAdvanced", from: 1 }),
    );
    expect(s.combat?.turn).toBe(2);
  });

  it("damages a creature down to zero and no further", () => {
    const s = run(
      makeEvent({ type: "creatureDamaged", combatantId: "goblin", amount: 5 }),
      makeEvent({ type: "creatureDamaged", combatantId: "goblin", amount: 99 }),
    );
    expect(s.combat?.creatureHp.goblin).toBe(0);
  });

  it("raises disclosure without touching anything else", () => {
    const s = run(makeEvent({ type: "disclosureSet", combatantId: "goblin", level: "exact" }));
    expect(s.combat?.order.find((c) => c.id === "goblin")?.disclosure).toBe("exact");
    expect(s.combat?.turn).toBe(0);
  });

  it("ends combat and leaves characters alone", () => {
    const s = run(
      makeEvent({ type: "damageApplied", who: "kira", amount: 10 }),
      makeEvent({ type: "combatEnded" }),
    );
    expect(s.combat).toBeNull();
    expect(s.characters.kira?.currentHp).toBe(42);
  });

  it("undoes an advance by replaying without it", () => {
    const first = makeEvent({ type: "turnAdvanced", from: 0 });
    const s = project([
      add, start, first,
      makeEvent({ type: "turnAdvanced", from: 1 }),
      makeEvent({ type: "reverted", target: first.id }),
    ]);
    // Without the first advance the second names a turn that never arrived,
    // so the guard drops it too and the fight is back at the top.
    expect(s.combat?.turn).toBe(0);
  });
});
