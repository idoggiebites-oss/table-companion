/**
 * Building a character at level one.
 *
 * The builder is not a second subsystem — it is another adapter into the same
 * canonical model that Fight Club XML and manual entry write. That is what
 * makes a partial builder safe: anything it produces is structurally valid,
 * and manual entry stays underneath for whatever it cannot express yet.
 *
 * The SRD ships exactly one background, which would make a fixed list
 * embarrassing. But a background is mechanically only two skill
 * proficiencies, two tools or languages, and some gear — none of it
 * protectable; only the prose is. So the builder offers a custom one
 * outright, which is both legally clean and what experienced players want.
 */

import { ABILITIES, abilityModifier, type Ability, type SkillId } from "./abilities.js";
import type { BuildBase } from "./build.js";
import type { ClassId, DieSize } from "./resources.js";

export type ScoreMethod = "array" | "pointBuy" | "rolled";

export interface RaceChoice {
  readonly id: string;
  readonly name: string;
  readonly speed: number;
  readonly abilityBonuses: Readonly<Partial<Record<Ability, number>>>;
  readonly subraceName?: string;
  readonly subraceBonuses?: Readonly<Partial<Record<Ability, number>>>;
}

export interface ClassChoice {
  readonly id: ClassId;
  readonly name: string;
  readonly hitDie: DieSize;
  readonly saves: readonly Ability[];
  readonly spellSlots: readonly number[];
}

/** Two skills, two tools or languages, and a name. That is the whole thing. */
export interface BackgroundChoice {
  readonly name: string;
  readonly skills: readonly SkillId[];
  readonly tools: readonly string[];
}

export interface CreationChoices {
  readonly name: string;
  readonly race: RaceChoice;
  readonly klass: ClassChoice;
  readonly background: BackgroundChoice;
  /** Before racial bonuses — what the player assigned. */
  readonly baseScores: Readonly<Record<Ability, number>>;
  readonly classSkills: readonly SkillId[];
  /** Unarmoured unless the player says otherwise; equipment comes later. */
  readonly armourClass?: number;
}

/** Racial and subracial bonuses land on top of what was assigned. */
export function finalScores(
  base: Readonly<Record<Ability, number>>,
  race: RaceChoice,
): Record<Ability, number> {
  const out = { ...base } as Record<Ability, number>;
  for (const a of ABILITIES) {
    out[a] = base[a] + (race.abilityBonuses[a] ?? 0) + (race.subraceBonuses?.[a] ?? 0);
  }
  return out;
}

/** At level one you take the full hit die — never a roll. */
export function startingHp(hitDie: DieSize, conMod: number): number {
  return Math.max(1, hitDie + conMod);
}

export function assemble(choices: CreationChoices, id = `c${Date.now().toString(36)}`): BuildBase {
  const abilities = finalScores(choices.baseScores, choices.race);
  const conMod = abilityModifier(abilities.con);
  const dexMod = abilityModifier(abilities.dex);

  // Class and background skills are a set — picking Perception in both is a
  // wasted choice rather than a doubled bonus, and the model should not
  // pretend otherwise.
  const skills = [...new Set([...choices.classSkills, ...choices.background.skills])];

  return {
    id,
    name: choices.name.trim() || "Unnamed",
    edition: "2014",
    source: "builder",
    classes: [{ classId: choices.klass.id, level: 1 }],
    race: choices.race.subraceName
      ? `${choices.race.subraceName} ${choices.race.name}`
      : choices.race.name,
    abilities,
    maxHp: startingHp(choices.klass.hitDie, conMod),
    hitDie: choices.klass.hitDie,
    armourClass: choices.armourClass ?? 10 + dexMod,
    speed: choices.race.speed,
    saveProficiencies: choices.klass.saves,
    skillProficiencies: skills,
    spellSlots: choices.klass.spellSlots,
    attacks: [],
  };
}

/** What is still missing before this character can be played. */
export function missing(choices: Partial<CreationChoices>): string[] {
  const gaps: string[] = [];
  if (!choices.klass) gaps.push("class");
  if (!choices.race) gaps.push("race");
  if (!choices.baseScores) gaps.push("ability scores");
  if (choices.background && choices.background.skills.length < 2) {
    gaps.push("two background skills");
  }
  return gaps;
}
