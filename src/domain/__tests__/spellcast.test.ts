import { describe, expect, it } from "vitest";
import {
  castingAbility, costOf, damageFor, damageTypeFrom, kindOf, resolveDice,
  spellAttackBonus, spellSaveDc, type CastableSpell,
} from "../spellcast.js";

const spell = (o: Partial<CastableSpell> & { name: string }): CastableSpell => ({
  level: 0, time: "1 action", text: "", rolls: [], ...o,
});

describe("what it costs", () => {
  it("reads the action off the file", () => {
    expect(costOf("1 action")).toBe("action");
    expect(costOf("1 bonus action")).toBe("bonus");
    expect(costOf("1 reaction, which you take when…")).toBe("reaction");
  });

  it("calls anything longer than a turn what it is", () => {
    // A fight has no room for these, and offering them mid-combat is a lie.
    expect(costOf("1 minute")).toBe("long");
    expect(costOf("8 hours")).toBe("long");
    expect(costOf("10 minutes")).toBe("long");
  });
});

describe("whether you roll or they do", () => {
  it("spots an attack spell", () => {
    expect(kindOf(spell({ name: "Fire Bolt", text: "Make a ranged spell attack against the target." })))
      .toEqual({ kind: "attack" });
    expect(kindOf(spell({ name: "Shocking Grasp", text: "Make a melee spell attack." })))
      .toEqual({ kind: "attack" });
  });

  it("spots a save, and which one", () => {
    expect(kindOf(spell({ name: "Fireball", text: "must make a Dexterity saving throw" })))
      .toEqual({ kind: "save", ability: "dex" });
    expect(kindOf(spell({ name: "Sacred Flame", text: "must succeed on a Dexterity saving throw" })))
      .toEqual({ kind: "save", ability: "dex" });
  });

  it("asks for nothing when the spell rolls nothing", () => {
    // Magic Missile always hits; Bless is not aimed at all.
    expect(kindOf(spell({ name: "Bless", text: "You bless up to three creatures." })))
      .toEqual({ kind: "none" });
  });
});

describe("the numbers", () => {
  it("builds the attack bonus and the save DC from the same two things", () => {
    expect(spellAttackBonus(3, 4)).toBe(7);
    expect(spellSaveDc(3, 4)).toBe(15);
  });

  it("takes a casting ability from the class when the sheet does not say", () => {
    expect(castingAbility(["wizard"])).toBe("int");
    expect(castingAbility(["cleric"])).toBe("wis");
    expect(castingAbility(["fighter"])).toBe("int"); // unknown, rather than refusing
    expect(castingAbility(["fighter"], "Charisma")).toBe("cha");
  });
});

describe("how much damage", () => {
  const fireBolt = spell({
    name: "Fire Bolt", level: 0,
    rolls: [
      { description: "Fire Damage", level: 0, dice: "1d10" },
      { description: "Fire Damage", level: 5, dice: "2d10" },
      { description: "Fire Damage", level: 11, dice: "3d10" },
      { description: "Fire Damage", level: 17, dice: "4d10" },
    ],
  });
  const fireball = spell({
    name: "Fireball", level: 3,
    rolls: [
      { description: "Fire Damage", level: 3, dice: "8d6" },
      { description: "Fire Damage", level: 4, dice: "9d6" },
      { description: "Fire Damage", level: 5, dice: "10d6" },
    ],
  });

  it("scales a cantrip with the CASTER's level", () => {
    expect(damageFor(fireBolt, { slotLevel: 0, characterLevel: 1 })?.dice).toBe("1d10");
    expect(damageFor(fireBolt, { slotLevel: 0, characterLevel: 5 })?.dice).toBe("2d10");
    expect(damageFor(fireBolt, { slotLevel: 0, characterLevel: 10 })?.dice).toBe("2d10");
    expect(damageFor(fireBolt, { slotLevel: 0, characterLevel: 17 })?.dice).toBe("4d10");
  });

  it("and a levelled spell with the SLOT it went into", () => {
    // The rule people get wrong by hand: a level 9 wizard casting Fireball
    // from a 3rd-level slot still does 8d6.
    expect(damageFor(fireball, { slotLevel: 3, characterLevel: 9 })?.dice).toBe("8d6");
    expect(damageFor(fireball, { slotLevel: 5, characterLevel: 9 })?.dice).toBe("10d6");
  });

  it("never falls below the lowest entry", () => {
    expect(damageFor(fireball, { slotLevel: 1, characterLevel: 1 })?.dice).toBe("8d6");
  });

  it("uses a flat roll when the spell does not scale", () => {
    const mm = spell({ name: "Magic Missile", level: 1, rolls: [{ description: "Force Damage", dice: "1d4+1" }] });
    expect(damageFor(mm, { slotLevel: 3, characterLevel: 9 })?.dice).toBe("1d4+1");
  });

  it("has nothing to say about a spell that deals none", () => {
    expect(damageFor(spell({ name: "Bless" }), { slotLevel: 1, characterLevel: 1 })).toBe(null);
  });

  it("fills in the modifier the file leaves as a placeholder", () => {
    // Left alone, a player is handed the literal text "1d8+%0".
    expect(resolveDice("1d8+%0", 3)).toBe("1d8+3");
    expect(resolveDice("2d8", 3)).toBe("2d8");
  });

  it("names the damage type the way a person would", () => {
    expect(damageTypeFrom("Fire Damage")).toBe("fire");
    expect(damageTypeFrom("Radiant Damage")).toBe("radiant");
    expect(damageTypeFrom("Heal")).toBe("heal");
  });
});
