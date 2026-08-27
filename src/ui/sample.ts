import type { Character } from "../domain/build.js";

/*
 * Two characters, loadable separately.
 *
 * Help is a thing you do FOR somebody, and a table of one has nobody to do
 * it for — so it was not only untested but unreachable. Bram is a fighter on
 * purpose: no spells, no slots, nothing that overlaps with what Kira
 * exercises. He is here to be somebody else.
 */

/** The Ranger 8 the screen studies are drawn around, for trying things quickly. */
export function kiraSample(): Character {
  return {
    base: {
      id: `kira-${Date.now().toString(36)}`,
      name: "Kira Vance",
      edition: "2014",
      source: "manual",
      classes: [{ classId: "ranger", level: 8, subclass: "hunter" }],
      race: "Wood elf",
      abilities: { str: 10, dex: 18, con: 14, int: 11, wis: 16, cha: 12 },
      maxHp: 52,
      hitDie: 10,
      armourClass: 16,
      speed: 35,
      saveProficiencies: ["str", "dex"],
      skillProficiencies: ["athletics", "nature", "perception", "stealth", "survival"],
      spellSlots: [4, 3],
      attacks: [
        {
          name: "Longbow",
          ability: "dex",
          proficient: true,
          bonus: 0,
          damage: { count: 1, die: 8, addAbility: true },
          damageType: "piercing",
          notes: "150/600 ft",
        },
        {
          name: "Shortsword",
          ability: "finesse",
          proficient: true,
          bonus: 0,
          damage: { count: 1, die: 6, addAbility: true },
          damageType: "piercing",
          notes: "finesse, light",
        },
        {
          name: "Shortsword, off-hand",
          ability: "finesse",
          proficient: true,
          bonus: 0,
          damage: { count: 1, die: 6, addAbility: false },
          damageType: "piercing",
          notes: "no ability modifier",
        },
      ],
    },
    deltas: [],
  };
}

/** Somebody to stand next to. A Fighter 8: no spells, nothing to collide. */
export function bramSample(): Character {
  return {
    base: {
      id: `bram-${Date.now().toString(36)}`,
      name: "Bram Holt",
      edition: "2014",
      source: "manual",
      classes: [{ classId: "fighter", level: 8, subclass: "champion" }],
      race: "Human",
      abilities: { str: 18, dex: 12, con: 16, int: 10, wis: 12, cha: 10 },
      maxHp: 68,
      hitDie: 10,
      armourClass: 18,
      speed: 30,
      saveProficiencies: ["str", "con"],
      skillProficiencies: ["athletics", "insight", "intimidation", "perception"],
      spellSlots: [],
      attacks: [
        {
          name: "Greatsword",
          ability: "str",
          proficient: true,
          bonus: 0,
          damage: { count: 2, die: 6, addAbility: true },
          damageType: "slashing",
          notes: "heavy, two-handed",
        },
        {
          name: "Handaxe",
          ability: "str",
          proficient: true,
          bonus: 0,
          damage: { count: 1, die: 6, addAbility: true },
          damageType: "slashing",
          range: "ranged",
          notes: "thrown 20/60 ft",
        },
      ],
    },
    deltas: [],
  };
}

/*
 * Deliberately not folded into `kiraSample`. "Load the sample" means one
 * known character on twenty screens and in fifty browser suites; making it
 * two quietly changes what every one of them is looking at — a third
 * combatant in initiative, a different turn count, a different label on the
 * button that starts the fight. The ally is a separate press.
 */
