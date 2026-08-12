import type { Character } from "../domain/build.js";

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
