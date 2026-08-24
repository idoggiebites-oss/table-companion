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

import {
  ABILITIES, abilityModifier, type Ability, type AbilityScores, type SkillId,
} from "./abilities.js";
import type { BuildBase, Identity } from "./build.js";
import { hasSenses, type Senses } from "./senses.js";
import { gather } from "./proficiencies.js";
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
  readonly languages?: readonly string[];
}

export interface CreationChoices {
  readonly name: string;
  /** Defaults to 1. Above that, the character is joining mid-campaign. */
  readonly level?: number;
  /** Rolled hit points for levels 2..N; missing entries take the average. */
  readonly hpRolls?: readonly number[];
  /** Spell slots at this level, from the class table. */
  readonly spellSlots?: readonly number[];
  /**
   * Improvements already earned by starting above level 1. A character made
   * at 8 has passed 4 and 8 and should arrive with both spent — the builder
   * was stating the points owed and giving nowhere to spend them.
   */
  /** A domain, a patron, a fighting style — whatever the class asked. */
  readonly picks?: readonly { readonly of: string; readonly name: string }[];
  readonly improvements?: readonly {
    readonly abilities?: Partial<Record<Ability, number>>;
    readonly feat?: { readonly id: string; readonly name: string };
    /** Resilient, and only Resilient: a save the feat made them good at. */
    readonly save?: Ability;
  }[];
  /** What the race lets them see. */
  readonly senses?: Senses;
  /** Who they are. Never required — a blank one is a character too. */
  readonly identity?: Identity;
  /** Everything they ended up speaking, from every source, already merged. */
  readonly languages?: readonly string[];
  /** Everything they can use, likewise. */
  readonly tools?: readonly string[];
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

/** Levels after the first take half the die rounded up, or a roll. */
export function averagePerLevel(hitDie: DieSize): number {
  return Math.floor(hitDie / 2) + 1;
}

/**
 * Hit points for a character created ABOVE level one — someone joining a
 * campaign already in progress.
 *
 * Level one is always the full die; every level after it is the average
 * unless a roll is supplied for it. Constitution applies to every level, not
 * just the first, which is the arithmetic people most often shortcut.
 */
export function hpAtLevel(
  hitDie: DieSize,
  conMod: number,
  level: number,
  rolls: readonly number[] = [],
): number {
  const levels = Math.max(1, Math.min(20, Math.round(level)));
  let total = hitDie + conMod;
  for (let i = 1; i < levels; i++) {
    total += (rolls[i - 1] ?? averagePerLevel(hitDie)) + conMod;
  }
  return Math.max(levels, total);
}

/**
 * Ability score points a character has to spend by a given level. Each
 * improvement is +2 to distribute, and which levels grant one is per class —
 * fighters get extra ones at 6 and 14, rogues at 10.
 */
export function asiPoints(asiLevels: readonly number[], level: number): number {
  return asiLevels.filter((l) => l <= level).length * 2;
}

/** Racial bonuses first, then anything earned on the way up, capped at 20. */
export function withImprovements(
  scores: AbilityScores,
  improvements: CreationChoices["improvements"],
): AbilityScores {
  let out = scores;
  for (const step of improvements ?? []) {
    if (!step.abilities) continue;
    out = Object.fromEntries(
      ABILITIES.map((a) => [a, Math.min(20, out[a] + (step.abilities?.[a] ?? 0))]),
    ) as AbilityScores;
  }
  return out;
}

/** Whether anything was actually written, so an empty one is not stored. */
function hasAny(id: Identity | undefined): id is Identity {
  return id !== undefined && Object.values(id).some((v) => (v ?? "").trim() !== "");
}

export function assemble(choices: CreationChoices, id = `c${Date.now().toString(36)}`): BuildBase {
  const abilities = withImprovements(
    finalScores(choices.baseScores, choices.race),
    choices.improvements,
  );
  const conMod = abilityModifier(abilities.con);
  const dexMod = abilityModifier(abilities.dex);

  // Class and background skills are a set — picking Perception in both is a
  // wasted choice rather than a doubled bonus, and the model should not
  // pretend otherwise.
  const skills = [...new Set([...choices.classSkills, ...choices.background.skills])];
  const level = Math.max(1, Math.min(20, Math.round(choices.level ?? 1)));

  return {
    id,
    name: choices.name.trim() || "Unnamed",
    edition: "2014",
    source: "builder",
    classes: [{ classId: choices.klass.id, level }],
    race: choices.race.subraceName
      ? `${choices.race.subraceName} ${choices.race.name}`
      : choices.race.name,
    abilities,
    maxHp: hpAtLevel(choices.klass.hitDie, conMod, level, choices.hpRolls ?? []),
    hitDie: choices.klass.hitDie,
    armourClass: choices.armourClass ?? 10 + dexMod,
    speed: choices.race.speed,
    ...(( choices.improvements ?? []).some((i) => i.feat)
      ? {
          feats: (choices.improvements ?? [])
            .flatMap((i) => (i.feat ? [i.feat] : [])),
        }
      : {}),
    ...(choices.picks?.length ? { choices: choices.picks } : {}),
    ...(hasAny(choices.identity) ? { identity: choices.identity } : {}),
    ...(choices.senses && hasSenses(choices.senses) ? { senses: choices.senses } : {}),
    /*
     * A feat can hand over a saving throw. Resilient is the only one in the
     * game that does, and it is the reason anybody takes it — leaving it
     * unapplied would make the sheet quietly wrong about the number the
     * player took the feat FOR.
     */
    saveProficiencies: [
      ...new Set([
        ...choices.klass.saves,
        ...(choices.improvements ?? []).flatMap((i) => (i.save ? [i.save] : [])),
      ]),
    ],
    skillProficiencies: skills,
    // Race, class and background all hand these out, and Common arrives from
    // more than one of them.
    ...(gather(choices.languages, choices.background.languages).length > 0
      ? { languages: gather(choices.languages, choices.background.languages) }
      : {}),
    ...(gather(choices.tools, choices.background.tools).length > 0
      ? { toolProficiencies: gather(choices.tools, choices.background.tools) }
      : {}),
    spellSlots: choices.spellSlots ?? choices.klass.spellSlots,
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
