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

export interface ConditionEntry {
  readonly id: string;
  readonly name: string;
  readonly desc: readonly string[];
}

let monsters: Promise<Statblock[]> | null = null;
let conditions: Promise<ConditionEntry[]> | null = null;

async function load<T>(path: string): Promise<T[]> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T[];
}

export function loadMonsters(): Promise<Statblock[]> {
  monsters ??= load<Statblock>("/srd/monsters.json");
  return monsters;
}

export function loadConditions(): Promise<ConditionEntry[]> {
  conditions ??= load<ConditionEntry>("/srd/conditions.json");
  return conditions;
}
