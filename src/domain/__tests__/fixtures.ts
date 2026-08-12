import type { BuildBase, Character } from "../build.js";
import type { ClassId } from "../resources.js";

/** Kira Vance — the Ranger 8 the screen studies are drawn around. */
export const kiraBase: BuildBase = {
  id: "kira",
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
};

export const kira: Character = { base: kiraBase, deltas: [] };

export function characterOf(
  classId: ClassId,
  level: number,
  over: Partial<BuildBase> = {},
): Character {
  return {
    base: {
      ...kiraBase,
      id: `${classId}${level}`,
      name: `${classId} ${level}`,
      classes: [{ classId, level }],
      spellSlots: [],
      attacks: [],
      ...over,
    },
    deltas: [],
  };
}
