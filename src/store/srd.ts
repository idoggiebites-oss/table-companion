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
}

import type { Item } from "../domain/items.js";
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
let conditions: Promise<ConditionDescription[]> | null = null;

async function load<T>(path: string): Promise<T[]> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T[];
}

export function loadMonsters(): Promise<Statblock[]> {
  monsters ??= Promise.all([
    load<Statblock>("/srd/monsters.json"),
    readContent("monster").catch(() => [] as Statblock[]),
  ]).then(([srd, imported]) => mergeById(srd, imported));
  return monsters;
}

export function loadRaces(): Promise<RaceEntry[]> {
  races ??= load<RaceEntry>("/srd/races.json");
  return races;
}

export function loadClasses(): Promise<ClassEntry[]> {
  classes ??= load<ClassEntry>("/srd/classes.json");
  return classes;
}

export function loadClassLevels(): Promise<ClassLevels> {
  classLevels ??= fetch("/srd/class-levels.json").then((r) => {
    if (!r.ok) throw new Error(`class-levels: HTTP ${r.status}`);
    return r.json() as Promise<ClassLevels>;
  });
  return classLevels;
}

export function loadEquipment(): Promise<Item[]> {
  equipment ??= Promise.all([
    fetch("/srd/equipment.json").then((r) => {
      if (!r.ok) throw new Error(`equipment: HTTP ${r.status}`);
      return r.json() as Promise<Item[]>;
    }),
    readContent("item").catch(() => [] as Item[]),
  ]).then(([srd, imported]) => mergeById(srd, imported));
  return equipment;
}

/** Called after an import, so the next read picks the new content up. */
export function forgetLoaded(): void {
  equipment = null;
  monsters = null;
}

export function loadConditions(): Promise<ConditionDescription[]> {
  conditions ??= load<ConditionDescription>("/srd/conditions.json");
  return conditions;
}
