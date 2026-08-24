/**
 * More than one class.
 *
 * Three things change and everything else already worked. Levels add up for
 * the proficiency bonus, which they always did. Hit dice stop being one die
 * and become a pool. And spell slots stop coming from a class's own table.
 *
 * That last one is the reason this is a file rather than a few lines. A
 * multiclass caster does not add their classes' slot tables together — they
 * work out ONE effective caster level and read the full-caster table at it,
 * which is why a Cleric 3 / Wizard 3 has the slots of a 6th-level caster
 * while knowing only 2nd-level spells. Nobody gets this right at a table
 * without the book open, and getting it wrong quietly is worse than not
 * offering it.
 *
 * Warlocks are not in that sum at all. Pact magic is its own track with its
 * own table and its own short rest, and it stacks alongside rather than into.
 */

import type { AbilityScores, Ability } from "./abilities.js";
import type { ClassId, DieSize } from "./resources.js";

export interface ClassLevel {
  readonly classId: string;
  readonly level: number;
  readonly subclass?: string;
}

/**
 * How much of a caster each class is. Absent means none — a fighter is not a
 * caster, and an Eldritch Knight is a third of one, which is a subclass fact
 * rather than a class fact and is handled below.
 */
const CASTER_SHARE: Record<string, "full" | "half" | "third" | "pact"> = {
  bard: "full", cleric: "full", druid: "full", sorcerer: "full", wizard: "full",
  paladin: "half", ranger: "half", artificer: "half",
  warlock: "pact",
};

/** Subclasses that make a third of a caster out of a class that is none. */
const THIRD_CASTER_SUBCLASS = /eldritch knight|arcane trickster/i;

/**
 * The one number the multiclass table is read at.
 *
 * Full casters count their level, half casters half, third casters a third —
 * each rounded DOWN, except the artificer, which the rules round up and which
 * is the single most-forgotten exception in the whole calculation.
 */
export function casterLevel(classes: readonly ClassLevel[]): number {
  let total = 0;
  for (const c of classes) {
    const id = c.classId.toLowerCase();
    const share = CASTER_SHARE[id];
    if (share === "full") total += c.level;
    else if (share === "half") {
      total += id === "artificer" ? Math.ceil(c.level / 2) : Math.floor(c.level / 2);
    } else if (share === undefined && THIRD_CASTER_SUBCLASS.test(c.subclass ?? "")) {
      total += Math.floor(c.level / 3);
    }
  }
  return total;
}

/**
 * The full-caster slot table, 1..20. Index 0 of each row is 1st-level slots.
 *
 * Written out rather than derived: every attempt to generate this from a rule
 * is a rule with exceptions, and a wrong row here is a player casting a spell
 * they do not have.
 */
const FULL_CASTER: readonly (readonly number[])[] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Slots for a multiclass caster. Empty when nothing in the mix casts. */
export function multiclassSlots(classes: readonly ClassLevel[]): number[] {
  const level = casterLevel(classes);
  if (level <= 0) return [];
  return [...(FULL_CASTER[Math.min(20, level) - 1] ?? [])];
}

/** A warlock's own track, which never joins the sum above. */
export function pactMagic(
  classes: readonly ClassLevel[],
): { count: number; level: number } | null {
  const warlock = classes.find((c) => c.classId.toLowerCase() === "warlock");
  if (!warlock || warlock.level < 1) return null;
  const l = Math.min(20, warlock.level);
  const count = l >= 17 ? 4 : l >= 11 ? 3 : l >= 2 ? 2 : 1;
  const level = l >= 9 ? 5 : l >= 7 ? 4 : l >= 5 ? 3 : l >= 3 ? 2 : 1;
  return { count, level };
}

/** Whether the multiclass table applies at all, or the class's own does. */
export function isMulticlass(classes: readonly ClassLevel[]): boolean {
  return classes.filter((c) => c.level > 0).length > 1;
}

/**
 * Hit dice, as a pool rather than a die.
 *
 * A Fighter 5 / Warlock 3 has five d10 and three d8 and spends whichever they
 * choose on a short rest. One `hitDie` field could only ever be a lie about
 * one of them.
 */
export function hitDicePool(
  classes: readonly ClassLevel[],
  dieFor: (classId: string) => DieSize | undefined,
): { die: DieSize; count: number }[] {
  const byDie = new Map<DieSize, number>();
  for (const c of classes) {
    const die = dieFor(c.classId);
    if (!die || c.level <= 0) continue;
    byDie.set(die, (byDie.get(die) ?? 0) + c.level);
  }
  return [...byDie.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([die, count]) => ({ die, count }));
}

/**
 * What each class demands of you before it will have you.
 *
 * The rule cuts both ways and people forget the first half: taking a level in
 * something new requires the minimums of the class you are LEAVING as well as
 * the one you are joining.
 */
const REQUIREMENTS: Record<string, { readonly all?: readonly Ability[]; readonly any?: readonly Ability[] }> = {
  barbarian: { all: ["str"] },
  bard: { all: ["cha"] },
  cleric: { all: ["wis"] },
  druid: { all: ["wis"] },
  fighter: { any: ["str", "dex"] },
  monk: { all: ["dex", "wis"] },
  paladin: { all: ["str", "cha"] },
  ranger: { all: ["dex", "wis"] },
  rogue: { all: ["dex"] },
  sorcerer: { all: ["cha"] },
  warlock: { all: ["cha"] },
  wizard: { all: ["int"] },
  artificer: { all: ["int"] },
};

const MINIMUM = 13;

const FULL_NAME: Record<Ability, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

/** Why they cannot take this level, or null. */
export function multiclassBlock(
  { from, into, abilities }: {
    /** The classes they already have. */
    from: readonly ClassLevel[];
    into: ClassId | string;
    abilities: AbilityScores;
  },
): string | null {
  const needed = [into, ...from.map((c) => c.classId)]
    .map((id) => id.toLowerCase())
    .filter((id, i, all) => all.indexOf(id) === i);

  const unmet: string[] = [];
  for (const id of needed) {
    const rule = REQUIREMENTS[id];
    if (!rule) continue; // A class this app has no rule for is not blocked.
    if (rule.all && !rule.all.every((a) => abilities[a] >= MINIMUM)) {
      unmet.push(`${title(id)} needs ${rule.all.map((a) => FULL_NAME[a]).join(" and ")} ${MINIMUM}`);
    }
    if (rule.any && !rule.any.some((a) => abilities[a] >= MINIMUM)) {
      unmet.push(`${title(id)} needs ${rule.any.map((a) => FULL_NAME[a]).join(" or ")} ${MINIMUM}`);
    }
  }
  return unmet.length > 0 ? `${unmet.join(". ")}.` : null;
}

function title(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}
