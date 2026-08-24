/**
 * A compendium class, in the shape the builder needs.
 *
 * The two sources describe a class differently. The SRD data ships saving
 * throws as ability ids and skill choices as a structured list; a compendium
 * writes one line — "Strength, Constitution, Acrobatics, Athletics, …" — with
 * the saves first and the skills after, and puts the count in numSkills.
 *
 * That line is recoverable because the six ability names are a closed set:
 * anything in it is a save, anything else is a skill. Checked against the
 * Fighter, whose SRD entry says exactly str/con and those eight skills.
 *
 * WHAT DOES NOT SURVIVE is starting equipment: a compendium carries none. So
 * the SRD entry wins for the twelve classes both describe — it is the one
 * that can hand a fighter their chain mail — and the classes only a
 * compendium knows come with starting wealth instead of a kit, which is a
 * real route the builder already offers.
 */

import { SKILL_IDS, type Ability } from "./abilities.js";

const ABILITY_BY_NAME: Record<string, Ability> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

export interface CompendiumClassLike {
  readonly id: string;
  readonly name: string;
  readonly hitDie: number;
  readonly numSkills: number;
  readonly armor: string;
  readonly weapons: string;
  readonly tools: string;
  readonly wealth: string;
  readonly spellAbility: string;
  readonly proficiency: string;
  readonly slots: readonly (readonly number[])[];
}

export interface DerivedClass {
  readonly id: string;
  readonly name: string;
  readonly hitDie: number;
  /** "4d4x10" — the only starting resource a compendium class has. */
  readonly wealth?: string;
  readonly saves: readonly Ability[];
  /** The class's tool line, verbatim: "Thieves' Tools", "None". */
  readonly tools?: string;
  readonly proficiencies: readonly string[];
  readonly skillChoices?: { readonly choose: number; readonly from: readonly string[] };
  readonly equipment: readonly string[];
  readonly equipmentChoices: readonly string[];
  readonly spellcasting?: {
    readonly ability?: string;
    readonly cantrips: number;
    readonly known: number;
    readonly slots: readonly number[];
  };
}

const known = new Set(SKILL_IDS.map((s) => s.toLowerCase()));

/** A skill the app can score, by its printed name. */
function isSkill(label: string): boolean {
  return known.has(label.toLowerCase().replace(/\s+/g, ""));
}

/**
 * Splits the one proficiency line into saves and skills. Anything that is
 * neither — "Thieves' Tools" appears in some — is dropped from the choices
 * rather than offered as a skill the sheet cannot score.
 */
export function splitProficiency(line: string | undefined): {
  saves: Ability[];
  skills: string[];
  other: string[];
} {
  const saves: Ability[] = [];
  const skills: string[] = [];
  const other: string[] = [];
  // Content built by an older version of the importer has no proficiency
  // line at all. Missing is not malformed: the class still works, it just
  // offers no saves or skills until the content is rebuilt.
  for (const raw of (line ?? "").split(",")) {
    const label = raw.trim();
    if (!label) continue;
    const ability = ABILITY_BY_NAME[label.toLowerCase()];
    if (ability && !saves.includes(ability)) saves.push(ability);
    else if (isSkill(label)) skills.push(label);
    else other.push(label);
  }
  return { saves, skills, other };
}

export function deriveClass(c: CompendiumClassLike): DerivedClass {
  const { saves, skills } = splitProficiency(c.proficiency);
  const profs = [c.armor ?? "", c.weapons ?? "", c.tools ?? ""]
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toLowerCase() !== "none");

  const first = c.slots?.[0] ?? [];
  const casts = first.some((n) => n > 0);

  return {
    id: c.id,
    name: c.name,
    hitDie: c.hitDie,
    ...(c.wealth ? { wealth: c.wealth } : {}),
    saves,
    // Kept apart from armour and weapons: a tool proficiency is something a
    // player chooses and the sheet lists, and flattened in with the rest it
    // was indistinguishable from "Light Armor".
    ...(c.tools && c.tools.toLowerCase() !== "none" ? { tools: c.tools } : {}),
    proficiencies: profs,
    ...(skills.length > 0
      ? { skillChoices: { choose: Math.max(0, c.numSkills), from: skills } }
      : {}),
    // A compendium has no starting kit. Wealth is the honest alternative and
    // the builder already offers it.
    equipment: [],
    equipmentChoices: [],
    ...(casts
      ? {
          spellcasting: {
            ...(c.spellAbility ? { ability: c.spellAbility.slice(0, 3).toLowerCase() } : {}),
            cantrips: 0,
            known: 0,
            slots: first.filter((n) => n > 0),
          },
        }
      : {}),
  };
}
