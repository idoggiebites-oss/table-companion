/**
 * Fight Club 5e character XML → the canonical build.
 *
 * SCHEMA PROVENANCE. Fight Club's character export has no published spec. The
 * element names below were taken from a working third-party parser of real
 * Lion's Den exports, which reads:
 *
 *   character/name · character/hpMax · character/xp
 *   character/abilities                     (comma-separated scores)
 *   character/race/{name,mod,proficiency,feat}
 *   character/class/{name,level,proficiency,feat}
 *   character/background/{name,proficiency,feat}
 *
 * Armour class, speed, hit die and spell slots are NOT in that set. This
 * adapter therefore does not invent them — it reports them as gaps and hands
 * the character to the manual form with everything it did find already filled
 * in. Guessing an armour class that is wrong by two is worse than asking.
 *
 * The parser is deliberately tolerant: an unknown or missing element becomes
 * an issue, never an exception. A real export that disagrees with the shape
 * above should still produce a usable, honestly-annotated character.
 */

import { ABILITIES, SKILL_IDS, type Ability, type SkillId } from "../domain/abilities.js";
import type { BuildBase, ClassEntry } from "../domain/build.js";
import { classIdFrom, HIT_DIE, SPELLCASTERS } from "../domain/classes.js";
import type { ClassId, DieSize } from "../domain/resources.js";

export type IssueKind = "missing" | "unmapped" | "assumed";

export interface ImportIssue {
  readonly kind: IssueKind;
  readonly field: string;
  readonly detail: string;
}

export interface ImportResult {
  readonly base: BuildBase;
  readonly issues: readonly ImportIssue[];
}

export class ImportError extends Error {}

const FULL_NAME: Record<Ability, string> = {
  str: "strength", dex: "dexterity", con: "constitution",
  int: "intelligence", wis: "wisdom", cha: "charisma",
};

/** "Sleight of Hand", "sleight_of_hand", "SleightOfHand" all collapse alike. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

const SKILL_BY_NORM = new Map<string, SkillId>(SKILL_IDS.map((s) => [norm(s), s]));
const ABILITY_BY_NORM = new Map<string, Ability>([
  ...ABILITIES.map((a) => [norm(FULL_NAME[a]), a] as const),
  ...ABILITIES.map((a) => [a, a] as const),
]);

function text(el: Element | null | undefined): string {
  return el?.textContent?.trim() ?? "";
}

function firstChild(parent: Element, tag: string): Element | null {
  for (const el of Array.from(parent.children)) if (el.tagName === tag) return el;
  return null;
}

function childrenNamed(parent: Element, tag: string): Element[] {
  return Array.from(parent.children).filter((el) => el.tagName === tag);
}

/**
 * A proficiency line is a bare name that may be a skill or a saving throw —
 * the format does not distinguish them, so they are told apart by matching.
 */
function classifyProficiency(
  raw: string,
): { skill: SkillId } | { save: Ability } | null {
  const cleaned = raw.replace(/saving\s*throws?/i, "");
  const key = norm(cleaned);
  if (!key) return null;
  const skill = SKILL_BY_NORM.get(key);
  if (skill) return { skill };
  const save = ABILITY_BY_NORM.get(key);
  if (save) return { save };
  return null;
}

export function parseFightClubXml(xml: string, id = `fc${Date.now().toString(36)}`): ImportResult {
  const doc = new DOMParser().parseFromString(xml, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new ImportError("That file isn't valid XML.");

  // The root varies — exports have been seen wrapped in <compendium> and bare.
  const character =
    doc.documentElement?.tagName === "character"
      ? doc.documentElement
      : doc.querySelector("character");
  if (!character) {
    throw new ImportError("No <character> element — is this a compendium rather than a character?");
  }

  const issues: ImportIssue[] = [];
  const miss = (field: string, detail: string) => issues.push({ kind: "missing", field, detail });

  const name = text(firstChild(character, "name")) || "Unnamed";
  if (name === "Unnamed") miss("name", "No <name>, so the character is unnamed.");

  // ---- classes and levels ----
  const classes: ClassEntry[] = [];
  for (const el of childrenNamed(character, "class")) {
    const raw = text(firstChild(el, "name"));
    const classId = classIdFrom(raw);
    const level = Number.parseInt(text(firstChild(el, "level")), 10);
    if (!classId) {
      issues.push({
        kind: "unmapped",
        field: "class",
        detail: `"${raw || "(blank)"}" isn't an SRD class, so it was skipped.`,
      });
      continue;
    }
    classes.push({ classId, level: Number.isFinite(level) && level > 0 ? level : 1 });
    if (!Number.isFinite(level)) {
      issues.push({ kind: "assumed", field: "level", detail: `No level for ${raw}; assumed 1.` });
    }
  }
  if (classes.length === 0) {
    classes.push({ classId: "fighter", level: 1 });
    miss("class", "No recognisable class; defaulted to Fighter 1 — change it before playing.");
  }

  // ---- ability scores ----
  const abilities: Record<Ability, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const rawScores = text(firstChild(character, "abilities"));
  const parts = rawScores.split(",").map((p) => Number.parseInt(p.trim(), 10));
  if (parts.length === ABILITIES.length && parts.every((n) => Number.isFinite(n))) {
    ABILITIES.forEach((a, i) => {
      abilities[a] = parts[i]!;
    });
  } else {
    miss("abilities", `Could not read six scores from "${rawScores}"; all set to 10.`);
  }

  // Racial modifiers are exported separately, and whether <abilities> already
  // includes them is not knowable from the file. Applying them blind would be
  // wrong by two on a bad guess, so they are reported instead.
  const race = firstChild(character, "race");
  const raceMods = race ? childrenNamed(race, "mod").map(text).filter(Boolean) : [];
  if (raceMods.length > 0) {
    issues.push({
      kind: "assumed",
      field: "abilities",
      detail: `Scores taken as final. Racial modifiers (${raceMods.join(", ")}) were NOT added — check them.`,
    });
  }

  // ---- proficiencies, from every source that carries them ----
  const skillProficiencies = new Set<SkillId>();
  const saveProficiencies = new Set<Ability>();
  const unmapped: string[] = [];

  for (const source of ["race", "class", "background"] as const) {
    for (const parent of childrenNamed(character, source)) {
      for (const p of childrenNamed(parent, "proficiency")) {
        for (const piece of text(p).split(",")) {
          const trimmed = piece.trim();
          if (!trimmed) continue;
          const hit = classifyProficiency(trimmed);
          if (hit === null) unmapped.push(trimmed);
          else if ("skill" in hit) skillProficiencies.add(hit.skill);
          else saveProficiencies.add(hit.save);
        }
      }
    }
  }
  if (unmapped.length > 0) {
    issues.push({
      kind: "unmapped",
      field: "proficiencies",
      detail: `Not skills or saves, so ignored: ${[...new Set(unmapped)].join(", ")}.`,
    });
  }

  // ---- things the format does not carry ----
  const hpMax = Number.parseInt(text(firstChild(character, "hpMax")), 10);
  const maxHp = Number.isFinite(hpMax) && hpMax > 0 ? hpMax : 1;
  if (!Number.isFinite(hpMax)) miss("maxHp", "No <hpMax>; set to 1 — fix before playing.");

  const primary = classes[0]!;
  const hitDie: DieSize = HIT_DIE[primary.classId];

  issues.push({
    kind: "missing",
    field: "armourClass",
    detail: "Not in the export — defaulted to 10.",
  });
  issues.push({
    kind: "missing",
    field: "speed",
    detail: "Not in the export — defaulted to 30 ft.",
  });
  issues.push({
    kind: "missing",
    field: "attacks",
    detail: "Weapons are not in the export — add them by hand.",
  });
  if (classes.some((c) => SPELLCASTERS.has(c.classId as ClassId))) {
    issues.push({
      kind: "missing",
      field: "spellSlots",
      detail: "Not in the export, and this character casts — enter slots by hand.",
    });
  }

  const base: BuildBase = {
    id,
    name,
    edition: "2014",
    source: "fightclub",
    classes,
    race: text(race ? firstChild(race, "name") : null),
    abilities,
    maxHp,
    hitDie,
    armourClass: 10,
    speed: 30,
    saveProficiencies: [...saveProficiencies],
    skillProficiencies: [...skillProficiencies],
    spellSlots: [],
    attacks: [],
  };

  return { base, issues };
}
