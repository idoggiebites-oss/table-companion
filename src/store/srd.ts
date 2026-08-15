/**
 * Loading the shipped SRD data.
 *
 * Fetched rather than bundled: 525 KB of monsters has no business in the main
 * chunk when most sessions never open the reference. The service worker
 * precaches it, so the second visit — and every visit in a basement — has it
 * already. That only works because "json" was added to the precache globs;
 * it is not in the plugin's default set.
 */

import type { Statblock } from "../domain/statblock.js";

export interface ConditionDescription {
  readonly id: string;
  readonly name: string;
  readonly desc: readonly string[];
}

export interface RaceEntry {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  readonly speed: number;
  readonly abilityBonuses: Readonly<Record<string, number>>;
  readonly languages?: readonly string[];
  readonly traits?: readonly { readonly name: string; readonly desc: string }[];
  readonly subraces: readonly {
    readonly id: string;
    readonly name: string;
    readonly abilityBonuses: Readonly<Record<string, number>>;
  }[];
  /** Set on anything that did not ship with the app. */
  readonly extra?: true;
}

import type { Item } from "../domain/items.js";
import type { CompendiumFeat, CompendiumSpell } from "../import/compendium.js";
import { proficiencyBonus } from "../domain/abilities.js";
import { deriveClass } from "../domain/classes-from-compendium.js";
import { consolidateRaces } from "../domain/races.js";
import { loadBundled } from "./bundled.js";
import { mergeById, readContent } from "./content.js";

export interface ClassLevel {
  readonly level: number;
  readonly profBonus: number;
  readonly slots: readonly number[];
  readonly cantrips: number;
  readonly known: number;
  readonly features: readonly string[];
  readonly asi: boolean;
}
export type ClassLevels = Readonly<Record<string, readonly ClassLevel[]>>;

export interface ClassEntry {
  readonly id: string;
  readonly name: string;
  readonly hitDie: number;
  readonly saves: readonly string[];
  readonly skillChoices?: { readonly choose: number; readonly from: readonly string[] };
  readonly proficiencies: readonly string[];
  readonly equipment: readonly string[];
  readonly equipmentChoices: readonly string[];
  /** Compendium classes only: starting wealth, where there is no kit. */
  readonly wealth?: string;
  /**
   * Set on anything that did not ship with the app. The builder puts the
   * twelve familiar classes first — alphabetical order buried Fighter under
   * a wall of "Auxiliary Level: …" entries nobody was looking for.
   */
  readonly extra?: true;
  readonly spellcasting?: {
    readonly ability?: string;
    readonly cantrips: number;
    readonly known: number;
    readonly slots: readonly number[];
  };
  readonly features: readonly string[];
}

let monsters: Promise<Statblock[]> | null = null;
let races: Promise<RaceEntry[]> | null = null;
let classes: Promise<ClassEntry[]> | null = null;
let classLevels: Promise<ClassLevels> | null = null;
let equipment: Promise<Item[]> | null = null;
let backgrounds: Promise<BackgroundEntry[]> | null = null;
let spells: Promise<CompendiumSpell[]> | null = null;
let featsList: Promise<CompendiumFeat[]> | null = null;
let conditions: Promise<ConditionDescription[]> | null = null;

async function load<T>(path: string): Promise<T[]> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T[];
}

export function loadMonsters(): Promise<Statblock[]> {
  monsters ??= Promise.all([
    load<Statblock>("/srd/monsters.json"),
    loadBundled("monster"),
    readContent("monster").catch(() => [] as Statblock[]),
  ]).then(([srd, shipped, imported]) => mergeById(mergeById(srd, shipped), imported));
  return monsters;
}

export function loadRaces(): Promise<RaceEntry[]> {
  races ??= Promise.all([
    load<RaceEntry>("/srd/races.json"),
    Promise.all([loadBundled("race"), readContent("race").catch(() => [])]).then(
      ([shipped, mine]) => [...shipped, ...mine],
    ),
  ]).then(([srd, imported]) =>
    // A compendium lists "Halfling, Lightfoot" as its own race, where the SRD
    // nests it as a subrace. Folded together so the same person appears once,
    // with the second dropdown the builder already has.
    consolidateRaces(
      srd,
      imported.map((r) => ({
        id: r.id,
        name: r.name,
        size: r.size,
        speed: r.speed,
        abilityBonuses: r.abilityBonuses,
        traits: r.traits.map((t) => ({ name: t.name, desc: t.text })),
      })),
    ) as RaceEntry[],
  );
  return races;
}

export interface BackgroundEntry {
  readonly id: string;
  readonly name: string;
  readonly skills: readonly string[];
  readonly traits: readonly { readonly name: string; readonly desc: string }[];
}

/**
 * There is exactly one SRD background, so this list is empty until something
 * is imported — which is why the builder offers a custom one either way.
 */
export function loadBackgrounds(): Promise<BackgroundEntry[]> {
  backgrounds ??= Promise.all([loadBundled("background"), readContent("background")])
    .then(([shipped, mine]) => mergeById(shipped, mine))
    .then((rows) =>
      rows.map((b) => ({
        id: b.id,
        name: b.name,
        skills: b.skills,
        traits: b.traits.map((t) => ({ name: t.name, desc: t.text })),
      })),
    )
    .catch(() => []);
  return backgrounds;
}

/**
 * SRD first and SRD wins. Both sources describe the same twelve, but only the
 * shipped data carries starting equipment — a compendium fighter cannot be
 * handed their chain mail. The classes only a compendium knows are added
 * after, with wealth instead of a kit.
 */
export function loadClasses(): Promise<ClassEntry[]> {
  classes ??= Promise.all([
    load<ClassEntry>("/srd/classes.json"),
    Promise.all([loadBundled("class"), readContent("class")]).then(([a, b]) =>
      mergeById(a, b),
    ),
  ]).then(([srd, extra]) => {
    const have = new Set(srd.map((c) => c.id));
    const byName = (a: ClassEntry, b: ClassEntry) => a.name.localeCompare(b.name);
    // Shipped first, each half alphabetical within itself.
    return [
      ...[...srd].sort(byName),
      ...extra
        .filter((c) => !have.has(c.id))
        .map((c) => ({ ...deriveClass(c), extra: true }) as ClassEntry)
        .sort(byName),
    ];
  });
  return classes;
}

/** The per-level table, extended with anything a compendium brought. */
export function loadClassLevels(): Promise<ClassLevels> {
  classLevels ??= Promise.all([
    fetch("/srd/class-levels.json").then((r) => {
      if (!r.ok) throw new Error(`class-levels: HTTP ${r.status}`);
      return r.json() as Promise<ClassLevels>;
    }),
    Promise.all([loadBundled("class"), readContent("class")]).then(([a, b]) =>
      mergeById(a, b),
    ),
  ]).then(([srd, extra]) => {
    const out: Record<string, readonly ClassLevel[]> = { ...srd };
    for (const c of extra) {
      const shipped = out[c.id];
      if (shipped) {
        /*
         * The shipped table has the better slots and proficiency bonus, but
         * knows nothing about subclasses — 5e-database keeps those in their
         * own file. A compendium writes them into the feature list, which is
         * where the builder reads a cleric's domains from, so the NAMES are
         * merged in while the numbers are left alone.
         */
        out[c.id] = shipped.map((row) => {
          const also = c.features
            .filter((f) => f.level === row.level)
            .map((f) => f.name)
            .filter((n) => !row.features.includes(n));
          return also.length > 0 ? { ...row, features: [...row.features, ...also] } : row;
        });
        continue;
      }
      out[c.id] = Array.from({ length: 20 }, (_, i) => ({
        level: i + 1,
        profBonus: proficiencyBonus(i + 1),
        slots: (c.slots[i] ?? []).filter((_, j) => j < 9),
        cantrips: 0,
        known: 0,
        features: c.features.filter((f) => f.level === i + 1).map((f) => f.name),
        asi: [4, 8, 12, 16, 19].includes(i + 1),
      }));
    }
    return out;
  });
  return classLevels;
}

export function loadEquipment(): Promise<Item[]> {
  equipment ??= Promise.all([
    fetch("/srd/equipment.json").then((r) => {
      if (!r.ok) throw new Error(`equipment: HTTP ${r.status}`);
      return r.json() as Promise<Item[]>;
    }),
    loadBundled("item"),
    readContent("item").catch(() => [] as Item[]),
  ]).then(([srd, shipped, imported]) => mergeById(mergeById(srd, shipped), imported));
  return equipment;
}

/** Called after an import, so the next read picks the new content up. */
export function forgetLoaded(): void {
  equipment = null;
  monsters = null;
  races = null;
  backgrounds = null;
  classes = null;
  classLevels = null;
  spells = null;
  featsList = null;
}

export function loadSpells(): Promise<CompendiumSpell[]> {
  spells ??= Promise.all([loadBundled("spell"), readContent("spell")]).then(
    ([shipped, mine]) => mergeById(shipped, mine),
  );
  return spells;
}

export function loadFeats(): Promise<CompendiumFeat[]> {
  featsList ??= Promise.all([loadBundled("feat"), readContent("feat")]).then(
    ([shipped, mine]) => mergeById(shipped, mine),
  );
  return featsList;
}

export function loadConditions(): Promise<ConditionDescription[]> {
  conditions ??= load<ConditionDescription>("/srd/conditions.json");
  return conditions;
}
