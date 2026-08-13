/**
 * Encounters.
 *
 * Difficulty is OPTIONAL here, and deliberately so. The thresholds and the
 * multiplier are Dungeon Master's Guide content rather than SRD — see
 * dmg-tables.ts, which is the only file that holds them and the only one that
 * would have to go before this app could be shared publicly. Everything in
 * THIS file works without a budget: pass one and you get a band, pass nothing
 * and you get totals.
 *
 * The arithmetic is the part worth automating either way — summing XP across
 * instances is what nobody enjoys and what nobody gets wrong twice.
 */

import type { CharacterId } from "./build.js";
import type { Disclosure } from "./combat.js";

export type HpMode = "average" | "rolled";

export interface EncounterEntry {
  /** Statblock id, or a homebrew id. */
  readonly statblockId: string;
  readonly name: string;
  readonly count: number;
  readonly xpEach: number;
  readonly hpMode: HpMode;
  /** What players see when this group reaches initiative. */
  readonly disclosure: Disclosure;
}

export interface Encounter {
  readonly id: string;
  readonly name: string;
  readonly entries: readonly EncounterEntry[];
}

/** Easy/medium/hard/deadly, summed across the party. */
export interface DifficultyBudget {
  readonly easy: number;
  readonly medium: number;
  readonly hard: number;
  readonly deadly: number;
}

export type DifficultyBand = "trivial" | "easy" | "medium" | "hard" | "deadly";

export interface EncounterTotals {
  readonly creatures: number;
  /** What the party earns. Never adjusted — see awardableXp. */
  readonly rawXp: number;
  /** Raw XP split evenly, which is how it is handed out. */
  readonly perCharacter: number;
  /** Raw XP times the count multiplier. Estimates danger; never earned. */
  readonly adjustedXp: number;
  readonly multiplier: number;
  readonly band: DifficultyBand | null;
}

export function creatureCount(e: Encounter): number {
  return e.entries.reduce((n, x) => n + x.count, 0);
}

export function rawXp(e: Encounter): number {
  return e.entries.reduce((n, x) => n + x.xpEach * x.count, 0);
}

/**
 * XP is awarded RAW. Any multiplier a table applies is for estimating how
 * dangerous a fight will be, and is never earned — getting that backwards
 * roughly doubles a party's progression over a campaign.
 */
export function awardableXp(e: Encounter): number {
  return rawXp(e);
}

function bandFor(xp: number, budget: DifficultyBudget): DifficultyBand {
  if (xp >= budget.deadly) return "deadly";
  if (xp >= budget.hard) return "hard";
  if (xp >= budget.medium) return "medium";
  if (xp >= budget.easy) return "easy";
  return "trivial";
}

export function totals(
  e: Encounter,
  partySize: number,
  budget?: DifficultyBudget | null,
  multiplier = 1,
): EncounterTotals {
  const raw = rawXp(e);
  const heads = Math.max(1, partySize);
  const adjusted = Math.round(raw * multiplier);
  return {
    creatures: creatureCount(e),
    rawXp: raw,
    perCharacter: Math.floor(raw / heads),
    adjustedXp: adjusted,
    multiplier,
    // The band is judged on the ADJUSTED total; the award is not.
    band: budget ? bandFor(adjusted, budget) : null,
  };
}

/** A budget is only usable if it is in ascending order and positive. */
export function isUsableBudget(b: Partial<DifficultyBudget>): b is DifficultyBudget {
  const { easy, medium, hard, deadly } = b;
  if ([easy, medium, hard, deadly].some((n) => typeof n !== "number" || n <= 0)) return false;
  return easy! < medium! && medium! < hard! && hard! < deadly!;
}

export const EMPTY_ENCOUNTER: Encounter = { id: "", name: "", entries: [] };

export function addEntry(e: Encounter, entry: EncounterEntry): Encounter {
  const existing = e.entries.find((x) => x.statblockId === entry.statblockId);
  return {
    ...e,
    entries: existing
      ? e.entries.map((x) =>
          x.statblockId === entry.statblockId ? { ...x, count: x.count + entry.count } : x,
        )
      : [...e.entries, entry],
  };
}

export function setCount(e: Encounter, statblockId: string, count: number): Encounter {
  return {
    ...e,
    entries: e.entries
      .map((x) => (x.statblockId === statblockId ? { ...x, count } : x))
      .filter((x) => x.count > 0),
  };
}

export function patchEntry(
  e: Encounter,
  statblockId: string,
  part: Partial<EncounterEntry>,
): Encounter {
  return {
    ...e,
    entries: e.entries.map((x) => (x.statblockId === statblockId ? { ...x, ...part } : x)),
  };
}

/** Party size is a fact about the campaign, not something to type in. */
export function partySizeOf(characterIds: readonly CharacterId[]): number {
  return characterIds.length;
}
