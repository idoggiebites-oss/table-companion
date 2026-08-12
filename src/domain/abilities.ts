/**
 * Abilities, skills, and the arithmetic everything else derives from.
 *
 * These are identical in the 2014 and 2024 rules, so nothing here is
 * edition-sensitive and nothing here needs a lookup — see edition.ts for
 * the handful of rules that do.
 */

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];

export type AbilityScores = Record<Ability, number>;

/** The eighteen skills, each tied to the ability its checks use. */
export const SKILLS = {
  acrobatics: "dex",
  animalHandling: "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  sleightOfHand: "dex",
  stealth: "dex",
  survival: "wis",
} as const satisfies Record<string, Ability>;

export type SkillId = keyof typeof SKILLS;

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

/** Score 10-11 is +0, and every full 2 points either side is a step. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Proficiency bonus is a pure function of total character level — never of
 * class. This is the number whose increase silently rewrites eighteen skill
 * modifiers, six saves, and every attack bonus, which is why it lives in one
 * place and is never stored on a character.
 */
export function proficiencyBonus(level: number): number {
  if (level < 1) throw new RangeError(`character level ${level} is below 1`);
  if (level > 20) throw new RangeError(`character level ${level} is above 20`);
  return 2 + Math.floor((level - 1) / 4);
}

/** Renders a modifier the way a sheet does: always signed. */
export function formatModifier(mod: number): string {
  return mod < 0 ? `−${Math.abs(mod)}` : `+${mod}`;
}
