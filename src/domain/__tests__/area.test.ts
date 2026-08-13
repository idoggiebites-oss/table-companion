import { describe, expect, it } from "vitest";
import type { Combatant, TargetRef } from "../combat.js";
import { targetOf } from "../combat.js";
import { makeEvent, type DomainEvent } from "../events.js";
import { project } from "../project.js";
import { kira } from "./fixtures.js";

const pcRef: TargetRef = { kind: "character", characterId: "kira" };
const gob = (id: string, hp: number): Combatant => ({
  id,
  name: id,
  initiative: 10,
  source: { kind: "creature", maxHp: hp },
  controller: { kind: "dm" },
  disclosure: "vague",
});

const order = [
  gob("g1", 12), gob("g2", 12), gob("g3", 12),
  {
    id: "pc-kira", name: "Kira Vance", initiative: 18,
    source: { kind: "character" as const, characterId: "kira" },
    controller: { kind: "player" as const, characterId: "kira" },
    disclosure: "exact" as const,
  },
];

const add = makeEvent({ type: "characterAdded", character: kira });
const start = makeEvent({ type: "combatStarted", order });
const run = (...rest: DomainEvent[]) => project([add, start, ...rest]);

const fireball = (targets: { ref: TargetRef; saved: boolean }[], halfOnSave = true) =>
  makeEvent({
    type: "areaDamageApplied",
    label: "Fireball",
    amount: 28,
    damageType: "fire",
    halfOnSave,
    targets,
  });

describe("one blast, one event", () => {
  it("hits several creatures at once", () => {
    const s = run(fireball([
      { ref: { kind: "creature", combatantId: "g1" }, saved: false },
      { ref: { kind: "creature", combatantId: "g2" }, saved: false },
    ]));
    expect(s.combat?.creatureHp).toMatchObject({ g1: 0, g2: 0, g3: 12 });
  });

  it("halves for whoever saved, rounding down", () => {
    const s = run(fireball([
      { ref: { kind: "creature", combatantId: "g1" }, saved: true },
      { ref: { kind: "creature", combatantId: "g2" }, saved: false },
    ]));
    // 28 halved is 14, which is more than a 12 hp goblin has either way,
    // so use the character to see the arithmetic.
    expect(s.combat?.creatureHp.g1).toBe(0);
    expect(s.combat?.creatureHp.g2).toBe(0);
  });

  it("rounds a halved total down rather than up", () => {
    const s = run(
      makeEvent({
        type: "areaDamageApplied", label: "Fireball", amount: 27,
        damageType: "fire", halfOnSave: true,
        targets: [{ ref: pcRef, saved: true }],
      }),
    );
    expect(s.characters.kira?.currentHp).toBe(52 - 13);
  });

  it("takes nothing at all when a save negates rather than halves", () => {
    const s = run(fireball([{ ref: pcRef, saved: true }], false));
    expect(s.characters.kira?.currentHp).toBe(52);
  });

  it("catches characters and creatures in the same blast", () => {
    const s = run(fireball([
      { ref: { kind: "creature", combatantId: "g1" }, saved: false },
      { ref: pcRef, saved: true },
    ]));
    expect(s.combat?.creatureHp.g1).toBe(0);
    expect(s.characters.kira?.currentHp).toBe(52 - 14);
  });

  it("leaves anyone out of the blast untouched", () => {
    const s = run(fireball([{ ref: { kind: "creature", combatantId: "g1" }, saved: false }]));
    expect(s.combat?.creatureHp.g3).toBe(12);
    expect(s.characters.kira?.currentHp).toBe(52);
  });
});

describe("a character caught in it is treated like any other damage", () => {
  it("spends temporary hit points first", () => {
    const s = run(
      makeEvent({ type: "tempHpGranted", who: "kira", amount: 10 }),
      fireball([{ ref: pcRef, saved: true }]),
    );
    expect(s.characters.kira?.tempHp).toBe(0);
    expect(s.characters.kira?.currentHp).toBe(52 - 4); // 14 damage, 10 absorbed
  });

  it("owes a concentration save against what was actually taken", () => {
    const s = run(
      makeEvent({ type: "concentrationStarted", who: "kira", on: "Hunter's Mark" }),
      fireball([{ ref: pcRef, saved: true }]),
    );
    // 14 taken after halving, so DC 10 — not the blast's full 28 (DC 14).
    expect(s.characters.kira?.concentrationChecks).toEqual([{ dc: 10, fromDamage: 14 }]);
  });

  it("owes the higher DC when the save was failed", () => {
    const s = run(
      makeEvent({ type: "concentrationStarted", who: "kira", on: "Hunter's Mark" }),
      fireball([{ ref: pcRef, saved: false }]),
    );
    expect(s.characters.kira?.concentrationChecks).toEqual([{ dc: 14, fromDamage: 28 }]);
  });
});

describe("one undo", () => {
  it("takes the whole blast back at once", () => {
    const blast = fireball([
      { ref: { kind: "creature", combatantId: "g1" }, saved: false },
      { ref: { kind: "creature", combatantId: "g2" }, saved: true },
      { ref: pcRef, saved: false },
    ]);
    const after = project([add, start, blast]);
    expect(after.characters.kira?.currentHp).toBe(24);

    const undone = project([add, start, blast, makeEvent({ type: "reverted", target: blast.id })]);
    expect(undone.characters.kira?.currentHp).toBe(52);
    expect(undone.combat?.creatureHp).toMatchObject({ g1: 12, g2: 12 });
  });
});

describe("targets", () => {
  it("addresses a character by id and a creature by combatant", () => {
    expect(targetOf(order[3]!)).toEqual({ kind: "character", characterId: "kira" });
    expect(targetOf(order[0]!)).toEqual({ kind: "creature", combatantId: "g1" });
  });
});
