/**
 * What a big creature does between everybody else's turns.
 *
 * Legendary actions are the most-forgotten thing on a statblock. Three a
 * round, spent after somebody ELSE's turn, back at the start of the
 * creature's own — a DM running a dragon has to hold all of that while also
 * holding the fiction, and the usual outcome is that the dragon never uses
 * them at all. 702 of the creatures shipped with this app have them.
 *
 * A lair action is the same shape one layer out: it belongs to the PLACE, it
 * fires on initiative count 20, and it is not any creature's turn. That is
 * why it lives on the fight rather than on a combatant.
 *
 * All of it is read out of the statblock's own words, which are
 * near-boilerplate. The block mixes the actions themselves with pages of lair
 * description and regional effects, so most of the work here is telling those
 * apart — a DM tapping "Regional Effects" expecting a tail attack is worse
 * than not offering the list.
 */

import type { Statblock, StatblockAction } from "./statblock.js";

export interface LegendaryOption {
  readonly name: string;
  readonly desc: string;
  /** Most cost one. "(Costs 2 Actions)" is printed on the ones that do not. */
  readonly cost: number;
}

/*
 * The entry that states the budget rather than being a thing to do. Some
 * books put it in a heading — "Legendary Actions (3/Turn)" — and some put the
 * whole sentence there: "Mammon can take 3 legendary actions, choosing from
 * the options below". Either way it is a header, and offering it as something
 * to tap would spend a legendary action on reading the rules.
 */
function budgetIn(a: StatblockAction): number | null {
  const m = /(\d+)\s*\/\s*turn/i.exec(a.name)
    ?? /(\d+)\s*(?:legendary\s*)?actions?\s*per\s*turn/i.exec(a.name)
    ?? /can take (\d+) legendary actions?/i.exec(a.name)
    ?? /can take (\d+) legendary actions?/i.exec(a.desc ?? "");
  return m ? Number(m[1]) : null;
}

/** How many it gets each round. Three is the common case; some have two. */
export function legendaryBudget(block: Statblock | null | undefined): number {
  for (const a of block?.legendary ?? []) {
    const n = budgetIn(a);
    if (n !== null) return n;
  }
  return 0;
}

/*
 * The entries that are prose about the lair or the region rather than things
 * the creature can do. The compendium files them under `legendary` alongside
 * the real options, and a DM tapping "Black Dragon Treasures" expecting a
 * tail attack is the app wasting their turn.
 */
const NOT_AN_ACTION =
  /lair|regional|treasure|^legendary actions?\b|^additional\b/i;

/** The things it can actually do, with what each costs. */
export function legendaryOptions(
  block: Statblock | null | undefined,
): LegendaryOption[] {
  const out: LegendaryOption[] = [];
  for (const a of block?.legendary ?? []) {
    if (NOT_AN_ACTION.test(a.name)) continue;
    // The header that states the budget is not a thing to do.
    if (budgetIn(a) !== null) continue;
    /*
     * "(Costs 2 Actions)" is the common printing; some books write just
     * "(3 actions)". Both mean the same thing and a missed one is a dragon
     * getting three tail attacks for the price of one.
     */
    const costs = /costs?\s+(\d+)\s+actions?/i.exec(a.name)
      ?? /\((\d+)\s+actions?\)/i.exec(a.name);
    out.push({
      name: a.name
        .replace(/\s*\(costs?\s+\d+\s+actions?\)\s*/i, "")
        .replace(/\s*\(\d+\s+actions?\)\s*/i, "")
        .trim(),
      desc: a.desc ?? "",
      cost: costs ? Number(costs[1]) : 1,
    });
  }
  return out;
}

/**
 * What the lair does, if anything.
 *
 * "On initiative count 20 (losing initiative ties), the dragon takes a lair
 * action" — the count is read rather than assumed, because a handful of
 * creatures use a different one and a hard-coded 20 would be quietly wrong
 * for them.
 */
export interface LairAction {
  readonly at: number;
  readonly text: string;
}

export function lairAction(
  block: Statblock | null | undefined,
): LairAction | null {
  const entry = (block?.legendary ?? []).find(
    (a: StatblockAction) => /^lair actions?$/i.test(a.name.trim()),
  );
  if (!entry?.desc) return null;
  const at = /initiative count (\d+)/i.exec(entry.desc);
  return { at: at ? Number(at[1]) : 20, text: entry.desc };
}

/**
 * How many are left this round.
 *
 * Spent is per ROUND rather than per turn, because that is how the rule
 * reads: they come back at the start of the creature's turn, and between
 * those two moments the count only ever goes down.
 */
export function legendaryLeft(
  budget: number,
  spent: number | undefined,
): number {
  return Math.max(0, budget - (spent ?? 0));
}

/**
 * Whether this creature may take one right now.
 *
 * Not on its own turn — that is the one rule people get wrong in the other
 * direction, and it matters: a dragon that legendary-acts on its own turn is
 * getting four actions instead of one.
 */
export function mayTakeLegendary({
  budget, spent, isTheirTurn, cost = 1,
}: {
  budget: number;
  spent: number | undefined;
  isTheirTurn: boolean;
  cost?: number;
}): boolean {
  if (budget === 0 || isTheirTurn) return false;
  return legendaryLeft(budget, spent) >= cost;
}
