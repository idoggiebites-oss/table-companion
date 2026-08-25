/*
 * The one place the app made the DM do arithmetic.
 */
import { describe, expect, it } from "vitest";
import type { AttackClaim } from "../attackflow.js";
import { describeClaim, onSave } from "../attackflow.js";
import type { DomainEvent } from "../events.js";
import { project } from "../project.js";
import type { CastableSpell } from "../spellcast.js";
import { halvesOnSave } from "../spellcast.js";

const spell = (text: string): CastableSpell =>
  ({ name: "x", level: 1, time: "1 action", text, rolls: [] });

const claim = (over: Partial<AttackClaim> = {}): AttackClaim => ({
  id: "cl1", who: "b1", whoName: "Kira", targetId: "cr1", targetName: "Goblin",
  weapon: "Fireball", toHit: null, damage: 25, damageType: "fire",
  at: 1, ...over,
});

describe("reading the rule off the spell", () => {
  it("finds the sentence that halves it", () => {
    expect(halvesOnSave(spell(
      "Each creature must make a Dexterity saving throw. A creature takes "
      + "8d6 fire damage on a failed save, or half as much damage on a successful one.",
    ))).toBe(true);
  });

  it("and does not invent it where it is absent", () => {
    // Sacred Flame: a success takes nothing at all.
    expect(halvesOnSave(spell(
      "The target must succeed on a Dexterity saving throw or take 1d8 radiant damage.",
    ))).toBe(false);
    expect(halvesOnSave(spell(""))).toBe(false);
  });
});

describe("what a successful save costs", () => {
  it("half, rounded down", () => {
    expect(onSave(claim({ damage: 25, save: { ability: "dex", dc: 15, half: true } }))).toBe(12);
  });

  it("nothing, when the spell does not say otherwise", () => {
    expect(onSave(claim({ damage: 25, save: { ability: "dex", dc: 15, half: false } }))).toBe(0);
    expect(onSave(claim({ damage: 25 }))).toBe(0);
  });
});

describe("what the DM's row says", () => {
  it("names the save and what a success costs", () => {
    // "they save or they do not" is true and useless: it tells the DM
    // neither what to roll against nor what a success is worth.
    expect(describeClaim(claim({ save: { ability: "dex", dc: 15, half: true } }), 12))
      .toBe("DEX 15 — half on a save");
    expect(describeClaim(claim({ save: { ability: "wis", dc: 13, half: false } }), 12))
      .toBe("WIS 13 — nothing on a save");
  });

  it("and still reads a swing against armour", () => {
    expect(describeClaim(claim({ toHit: 18 }), 15)).toBe("18 against 15 — hits");
  });
});

describe("half landing on the creature", () => {
  let n = 0;
  const ev = (b: object): DomainEvent =>
    ({ id: `e${++n}`, by: "dm", at: Date.now(), ...b }) as DomainEvent;
  const staged = ev({
    type: "combatStaged",
    combatants: [{
      id: "cr1", name: "Goblin", initiative: null,
      source: { kind: "creature", maxHp: 30 },
      controller: { kind: "dm" }, disclosure: "vague", surprised: false, speed: 30,
    }],
  });
  const claimed = ev({
    type: "attackClaimed",
    claim: claim({ save: { ability: "dex", dc: 15, half: true } }),
  });

  it("spends the amount the DM chose, not the claim's own number", () => {
    const s = project([
      staged, claimed,
      ev({ type: "attackResolved", claimId: "cl1", applied: true, amount: 12 }),
    ]);
    expect(s.combat?.creatureHp.cr1).toBe(18);
    expect(s.claims).toHaveLength(0);
  });

  it("and the whole claim when no amount is named", () => {
    const s = project([
      staged, claimed,
      ev({ type: "attackResolved", claimId: "cl1", applied: true }),
    ]);
    expect(s.combat?.creatureHp.cr1).toBe(5);
  });

  it("a save that avoids it takes nothing and still clears the queue", () => {
    const s = project([
      staged, claimed,
      ev({ type: "attackResolved", claimId: "cl1", applied: false }),
    ]);
    expect(s.combat?.creatureHp.cr1).toBe(30);
    expect(s.claims).toHaveLength(0);
  });
});
