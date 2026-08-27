/*
 * Two of a thing, and a third arriving late.
 */
import { describe, expect, it } from "vitest";
import { joinCombat, numberDuplicates, stageCombat, beginCombat, setInitiative } from "../combat.js";
import type { Combatant } from "../combat.js";
import { project } from "../project.js";

const creature = (id: string, name: string, initiative: number | null = null): Combatant => ({
  id, name, initiative,
  source: { kind: "creature", maxHp: 22 },
  controller: { kind: "dm" },
  disclosure: "vague",
  surprised: false,
  speed: 30,
});
const player = (id: string, name: string, initiative: number | null = null): Combatant => ({
  id, name, initiative,
  source: { kind: "character", characterId: id },
  controller: { kind: "player", characterId: id },
  disclosure: "exact",
  surprised: false,
  speed: 30,
});

describe("telling two ghouls apart", () => {
  it("numbers them", () => {
    const out = numberDuplicates([creature("a", "Ghoul"), creature("b", "Ghoul")]);
    expect(out.map((c) => c.name)).toEqual(["Ghoul 1", "Ghoul 2"]);
  });

  it("and leaves a lone one alone", () => {
    // "Ghoul 1" when there is one ghoul is worse than no number at all.
    expect(numberDuplicates([creature("a", "Ghoul")])[0]?.name).toBe("Ghoul");
  });

  it("touching only the ones that collide", () => {
    const out = numberDuplicates([
      creature("a", "Ghoul"), creature("b", "Ghast"), creature("c", "Ghoul"),
    ]);
    expect(out.map((c) => c.name)).toEqual(["Ghoul 1", "Ghast", "Ghoul 2"]);
  });

  it("from the moment the fight is staged", () => {
    const c = stageCombat([creature("a", "Ghoul"), creature("b", "Ghoul")]);
    expect(c.order.map((x) => x.name)).toEqual(["Ghoul 1", "Ghoul 2"]);
    expect(Object.keys(c.creatureHp).sort()).toEqual(["a", "b"]);
  });
});

describe("something arrives on round three", () => {
  const running = () => {
    let c = stageCombat([player("p1", "Kira", 18), creature("g1", "Ghoul", 12)]);
    c = setInitiative(c, "p1", 18);
    c = setInitiative(c, "g1", 12);
    return beginCombat(c);
  };

  it("drops into the order at its own initiative", () => {
    const c = joinCombat(running(), creature("g2", "Ghast", 15));
    expect(c.order.map((x) => x.name)).toEqual(["Kira", "Ghast", "Ghoul"]);
  });

  it("with its hit points, so it can be hurt", () => {
    const c = joinCombat(running(), creature("g2", "Ghast", 15));
    expect(c.creatureHp.g2).toBe(22);
  });

  it("without skipping the turn that was in progress", () => {
    /*
     * Arriving ahead of whoever is up moves them down the list. Leaving the
     * pointer where it was would silently hand the turn to the newcomer and
     * skip the person who was mid-sentence.
     */
    const before = running();
    expect(before.order[before.turn]?.name).toBe("Kira");
    const after = joinCombat(before, creature("g2", "Ghast", 20));
    expect(after.order[after.turn]?.name).toBe("Kira");
    expect(after.order[0]?.name).toBe("Ghast");
  });

  it("and numbers it if it shares a name with what is already there", () => {
    const c = joinCombat(running(), creature("g2", "Ghoul", 9));
    expect(c.order.map((x) => x.name)).toEqual(["Kira", "Ghoul 1", "Ghoul 2"]);
  });
});

describe("healing a creature back", () => {
  it("stops at what it started with", () => {
    // Healing is a negative damage event on the DM's row. Without a ceiling
    // a ghoul patched up twice reads 30/22, which is not a state the game has.
    const staged = stageCombat([creature("g1", "Ghoul", 12)]);
    const events = [
      { id: "e1", by: "dm", at: 1, type: "combatStaged", combatants: staged.order },
      { id: "e2", by: "dm", at: 2, type: "creatureDamaged", combatantId: "g1", amount: 9 },
      { id: "e3", by: "dm", at: 3, type: "creatureDamaged", combatantId: "g1", amount: -20 },
    ] as never;
    expect(project(events).combat?.creatureHp.g1).toBe(22);
  });

  it("and at zero going the other way", () => {
    const staged = stageCombat([creature("g1", "Ghoul", 12)]);
    const events = [
      { id: "e1", by: "dm", at: 1, type: "combatStaged", combatants: staged.order },
      { id: "e2", by: "dm", at: 2, type: "creatureDamaged", combatantId: "g1", amount: 99 },
    ] as never;
    expect(project(events).combat?.creatureHp.g1).toBe(0);
  });
});
