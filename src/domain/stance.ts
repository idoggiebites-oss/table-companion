/**
 * Whether you roll one d20, two and take the higher, or two and take the
 * lower — and, more importantly, WHY.
 *
 * Advantage is the most-used mechanic in the game and the one this app was
 * quietest about. It asked for "a d20 plus five" whether you were prone,
 * hidden, helped, or swinging at something paralysed. A table works that out
 * loud, slowly, and usually wrong: the conditions are on one person's screen,
 * the rule is in a book, and the person who needs both is the one who has
 * played twice.
 *
 * So it is computed from what the app already knows — conditions on both
 * sides, and what people did on their turns — and it is shown as a sentence
 * naming every source. "Advantage: the goblin is prone" teaches the rule
 * while you use it. "Advantage" alone teaches nothing.
 *
 * The rule for combining is 5e's own and it surprises people, which is
 * exactly why the app should be the one applying it: any number of advantages
 * and any number of disadvantages cancel to a single straight roll. Not a
 * tally, not a net. One of each is enough.
 *
 * What it deliberately does NOT know: reach, cover, and line of sight. Those
 * need positions, and this table keeps its positions on the table. Anything
 * it cannot see, the DM says out loud — so the reasons listed here are
 * partial by design and never contradict the DM.
 */

import type { ConditionId } from "./edition.js";
import type { StanceTag } from "./combat.js";

export type Stance = "advantage" | "straight" | "disadvantage";

/** One reason, phrased for the person reading it mid-turn. */
export interface StanceReason {
  readonly effect: "advantage" | "disadvantage";
  /** "the goblin is prone", "you are hidden". */
  readonly because: string;
}

export interface Roller {
  /** How they are referred to: "you", "the goblin". */
  readonly name: string;
  readonly conditions: readonly ConditionId[];
  readonly tags: readonly StanceTag[];
}

export type AttackRange = "melee" | "ranged";

/**
 * Conditions that hand the ATTACKER advantage when the target has them.
 *
 * Unconscious and paralysed also make a melee hit an automatic critical, and
 * this app does not say so — it asks for damage and lets the table decide
 * what a crit means, because doubling dice is a table ritual worth keeping.
 */
const TARGET_GIVES_ADVANTAGE: readonly ConditionId[] = [
  "blinded", "paralyzed", "petrified", "restrained", "stunned", "unconscious",
];

/** Conditions that make the ATTACKER roll badly, whoever they swing at. */
const ATTACKER_HAS_DISADVANTAGE: readonly ConditionId[] = [
  "blinded", "poisoned", "restrained", "frightened",
];

const THE = (name: string) => (name.toLowerCase() === "you" ? "you are" : `${name} is`);

/**
 * Everything the app can see about how this attack rolls.
 *
 * Both sides are described the same way, because advantage is symmetric in
 * the rules and asymmetric in every character sheet ever printed.
 */
export function stanceFor({
  attacker, target, range,
}: {
  attacker: Roller;
  target: Roller;
  range: AttackRange;
}): { stance: Stance; reasons: readonly StanceReason[] } {
  const reasons: StanceReason[] = [];
  const adv = (because: string) => reasons.push({ effect: "advantage", because });
  const dis = (because: string) => reasons.push({ effect: "disadvantage", because });

  for (const c of TARGET_GIVES_ADVANTAGE) {
    if (target.conditions.includes(c)) adv(`${THE(target.name)} ${c}`);
  }
  for (const c of ATTACKER_HAS_DISADVANTAGE) {
    if (attacker.conditions.includes(c)) dis(`${THE(attacker.name)} ${c}`);
  }

  // Prone is the one that cuts both ways, and the one people get wrong: easy
  // to hit up close, hard to hit from across the room.
  if (target.conditions.includes("prone")) {
    if (range === "melee") adv(`${THE(target.name)} prone`);
    else dis(`${THE(target.name)} prone, and you are far away`);
  }
  if (attacker.conditions.includes("prone")) dis(`${THE(attacker.name)} prone`);

  if (target.conditions.includes("invisible")) dis(`you cannot see ${target.name}`);
  if (attacker.conditions.includes("invisible") || attacker.tags.includes("hidden")) {
    adv(`${THE(attacker.name)} unseen`);
  }

  if (attacker.tags.includes("helped")) adv("someone is helping you");
  if (target.tags.includes("dodging")) dis(`${THE(target.name)} dodging`);

  return { stance: combine(reasons), reasons };
}

/**
 * 5e's own rule, and the one nobody at a table believes the first time: any
 * number of advantages and any number of disadvantages cancel to a straight
 * roll. Three sources of advantage and one of disadvantage is not "mostly
 * advantage" — it is one d20.
 */
export function combine(reasons: readonly StanceReason[]): Stance {
  const up = reasons.some((r) => r.effect === "advantage");
  const down = reasons.some((r) => r.effect === "disadvantage");
  if (up === down) return "straight";
  return up ? "advantage" : "disadvantage";
}

/** What to actually do with the dice, in words anyone can follow. */
export function describeStance(stance: Stance): string {
  switch (stance) {
    case "advantage":
      return "Roll two d20s and take the higher";
    case "disadvantage":
      return "Roll two d20s and take the lower";
    default:
      return "Roll a d20";
  }
}

/**
 * The reasons, as one line. Sources that cancelled are still named — being
 * told "these cancel out" is the whole lesson, and hiding the losing half
 * makes the app look wrong to anyone who knows the rule.
 */
export function describeReasons(
  stance: Stance,
  reasons: readonly StanceReason[],
): string | null {
  if (reasons.length === 0) return null;
  const list = (effect: StanceReason["effect"]) =>
    reasons.filter((r) => r.effect === effect).map((r) => r.because);
  const up = list("advantage");
  const down = list("disadvantage");
  if (stance === "advantage") return `Advantage: ${up.join(", ")}`;
  if (stance === "disadvantage") return `Disadvantage: ${down.join(", ")}`;
  return `${up.join(", ")} — but ${down.join(", ")}. They cancel.`;
}
