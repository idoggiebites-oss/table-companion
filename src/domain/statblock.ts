/**
 * Monster statblocks, and the distinction the design notes called most of the
 * encounter builder's actual work: a statblock is a TEMPLATE, and four goblins
 * in a fight are four instances of it, each with its own label, hit points and
 * conditions.
 *
 * Getting that wrong produces a "goblin ×4" that shares one hit point pool,
 * which is wrong the first time one of them dies.
 */

import type { Ability } from "./abilities.js";
import type { DieSize } from "./resources.js";

export interface StatblockAction {
  readonly name: string;
  readonly desc: string;
  readonly attackBonus?: number;
  readonly damage?: readonly { readonly dice: string; readonly type?: string }[];
  readonly usage?: string;
}

export interface Statblock {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  readonly type: string;
  readonly subtype?: string;
  readonly alignment: string;
  readonly ac: number;
  readonly acNote?: string;
  /** The average, which is what a statblock prints. */
  readonly hp: number;
  /** "2d6", "7d10+21" — what to roll if you want this one to differ. */
  readonly hitDice: string;
  readonly speed: Readonly<Record<string, string>>;
  readonly cr: number;
  readonly xp: number;
  readonly abilities: Readonly<Record<Ability, number>>;
  readonly proficiencyBonus?: number;
  readonly saves?: Readonly<Record<string, number>>;
  readonly skills?: Readonly<Record<string, number>>;
  readonly senses?: Readonly<Record<string, string | number>>;
  readonly languages?: string;
  readonly resistances?: readonly string[];
  readonly immunities?: readonly string[];
  readonly vulnerabilities?: readonly string[];
  readonly conditionImmunities?: readonly string[];
  readonly traits: readonly StatblockAction[];
  readonly actions: readonly StatblockAction[];
  readonly reactions: readonly StatblockAction[];
  readonly legendary: readonly StatblockAction[];
  /** Absent for SRD content; set for anything the DM wrote. */
  readonly homebrew?: true;
}

/** Challenge ratings below 1 print as fractions, and are read aloud that way. */
export function formatCr(cr: number): string {
  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";
  return String(cr);
}

/** "2d6+3" → the parts, or null if it isn't a dice expression. */
export function parseDice(
  expr: string,
): { count: number; die: DieSize; bonus: number } | null {
  const m = /^\s*(\d+)d(\d+)\s*([+-]\s*\d+)?\s*$/.exec(expr);
  if (!m) return null;
  const die = Number(m[2]) as DieSize;
  if (![4, 6, 8, 10, 12, 20].includes(die)) return null;
  return {
    count: Number(m[1]),
    die,
    bonus: m[3] ? Number(m[3].replace(/\s+/g, "")) : 0,
  };
}

/**
 * Rolling hit points at prep time is the point of the "rolled" option: 2d6 per
 * goblin is a minute of nothing during a session and one tap beforehand, and
 * it makes "the one on the left is nearly down" a true statement.
 */
export function rollHp(expr: string, rand: () => number = Math.random): number {
  const d = parseDice(expr);
  if (!d) return 1;
  let total = d.bonus;
  for (let i = 0; i < d.count; i++) total += 1 + Math.floor(rand() * d.die);
  return Math.max(1, total);
}

/** Instance labels: Goblin 1, Goblin 2 … never a bare stack of four. */
export function instanceLabel(name: string, index: number, total: number): string {
  return total > 1 ? `${name} ${index + 1}` : name;
}

/** Average hit points for a dice expression — what a statblock prints. */
export function averageHp(expr: string): number {
  const d = parseDice(expr);
  if (!d) return 1;
  return Math.max(1, Math.floor(d.count * ((d.die + 1) / 2)) + d.bonus);
}

/**
 * Suggests an XP value for a homebrew creature by looking at what SRD
 * creatures of the same challenge rating are worth.
 *
 * Deliberately derived from data already in hand rather than transcribed from
 * a CR-to-XP table, which is not SRD content. It is a suggestion the DM can
 * overwrite, not an authority.
 */
export function suggestXp(all: readonly Statblock[], cr: number): number | null {
  // Zero means "this source did not say", not "worth nothing". A compendium
  // carries no XP at all, so counting its zeroes as answers makes the most
  // common value nothing at every challenge rating.
  const at = all
    .filter((m) => m.cr === cr && !m.homebrew && m.xp > 0)
    .map((m) => m.xp);
  if (at.length === 0) return null;
  const counts = new Map<number, number>();
  for (const xp of at) counts.set(xp, (counts.get(xp) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

/** SRD and homebrew in one list, homebrew first so your own work is findable. */
export function mergeStatblocks(
  srd: readonly Statblock[],
  homebrew: Readonly<Record<string, Statblock>>,
): Statblock[] {
  return [...Object.values(homebrew), ...srd];
}

export interface SearchQuery {
  readonly text?: string;
  readonly minCr?: number;
  readonly maxCr?: number;
  readonly type?: string;
}

export function searchStatblocks(
  all: readonly Statblock[],
  q: SearchQuery,
): Statblock[] {
  const text = q.text?.trim().toLowerCase() ?? "";
  return all.filter((m) => {
    if (text && !m.name.toLowerCase().includes(text) && !m.type.toLowerCase().includes(text)) {
      return false;
    }
    if (q.minCr !== undefined && m.cr < q.minCr) return false;
    if (q.maxCr !== undefined && m.cr > q.maxCr) return false;
    if (q.type && m.type !== q.type) return false;
    return true;
  });
}
