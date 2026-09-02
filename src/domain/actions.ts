import type { IconName } from "../ui/Icon.js";
/**
 * What you can actually do on your turn.
 *
 * A new player's turn is not limited by the rules, it is limited by not
 * knowing what is on the menu. Nobody discovers Dodge by reading a character
 * sheet, and nobody learns why they got hit walking away until somebody
 * explains Disengage. So the menu is the teaching: every option present, what
 * it costs, and one sentence on what it does in play.
 *
 * The sentences are deliberately about CONSEQUENCE rather than mechanism —
 * "attacks against you have disadvantage until your next turn" tells a
 * beginner what changes; "you take the Dodge action" tells them nothing.
 *
 * Nothing here rolls anything. Taking an action spends the pip and says what
 * to tell the table; the dice stay on it.
 */

import type { EconomyKind } from "./combat.js";

export interface StandardAction {
  readonly id: string;
  readonly name: string;
  readonly cost: EconomyKind;
  /** One sentence, in play terms. */
  readonly what: string;
  /** What to say or do at the table once it is taken. */
  readonly then?: string;
  /** Shown only when it is likely to be relevant. */
  readonly whenArmed?: boolean;
  /** Only for someone who has spells; the rest should not be taught them. */
  readonly whenCaster?: boolean;
  /**
   * A mark for the hotbar. Not decoration: twelve rows of words is a list you
   * read, and a grid of marks is something you aim at — which is what a turn
   * actually is after the first session.
   *
   * Every one keeps its name underneath. An unlabelled icon is its own kind
   * of unreadable, and nobody at this table has played a session yet.
   */
  /**
   * SVG, not a character. U+23F1 (Ready) is `Emoji_Presentation=Yes` — an
   * always-colour stopwatch — and U+2694, U+2692 and U+21AA were the
   * platform's choice. Every one keeps its name underneath: an unlabelled
   * icon is its own kind of unreadable.
   */
  readonly icon: IconName;
}

export const STANDARD_ACTIONS: readonly StandardAction[] = [
  {
    id: "attack",
    name: "Attack",
    icon: "sword",
    cost: "action",
    what: "Swing at something, or shoot it.",
    whenArmed: true,
  },
  {
    id: "cast",
    name: "Cast a spell",
    icon: "spark",
    cost: "action",
    what: "Most spells cost your action. A few are a bonus action, and the list says which.",
    then: "Opens your spells.",
    whenCaster: true,
  },
  {
    id: "dodge",
    name: "Dodge",
    icon: "guard",
    cost: "action",
    what: "Attacks against you have disadvantage until your next turn.",
    then: "For when you are hurt and cannot get away.",
  },
  {
    id: "disengage",
    name: "Disengage",
    icon: "slip",
    cost: "action",
    what: "Move away without anyone getting a free swing at you.",
    then: "This is what stops the free hit when you walk off.",
  },
  {
    id: "dash",
    name: "Dash",
    icon: "dash",
    cost: "action",
    what: "Twice the movement this turn.",
  },
  {
    id: "hide",
    name: "Hide",
    icon: "hide",
    cost: "action",
    what: "Roll Stealth. Unseen, your attacks have advantage.",
    then: "The DM will tell you what to beat.",
  },
  {
    id: "help",
    name: "Help",
    icon: "help",
    cost: "action",
    what: "Give an ally advantage on their next attack or check.",
    then: "Say who you are helping.",
  },
  {
    id: "shove",
    name: "Shove",
    icon: "shove",
    cost: "action",
    what: "Athletics against theirs. Win and they fall prone, or move five feet.",
    then: "Prone is often better than damage — everyone gets advantage on them.",
  },
  {
    id: "ready",
    name: "Ready",
    icon: "clock",
    cost: "action",
    what: "Name a trigger now; it happens later, using your reaction.",
    then: 'Say it out loud: "when the goblin comes through the door, I shoot it".',
  },
  {
    id: "search",
    name: "Search",
    icon: "search",
    cost: "action",
    what: "Look for something. The DM will ask for a roll.",
  },
  {
    id: "use",
    name: "Use an object",
    icon: "hammer",
    cost: "action",
    what: "Drink a potion, pull a lever. Your first interaction each turn is free.",
  },
  {
    id: "offhand",
    name: "Off-hand attack",
    icon: "cycle",
    cost: "bonus",
    what: "A second swing with a light weapon. No ability modifier to damage.",
    whenArmed: true,
  },
];

export function actionsCosting(cost: EconomyKind): StandardAction[] {
  return STANDARD_ACTIONS.filter((a) => a.cost === cost);
}

/** Why an option cannot be taken, or null when it can. */
export function blockedBecause(
  action: StandardAction,
  spent: Readonly<Record<EconomyKind, boolean>>,
  armed: boolean,
  caster = false,
): string | null {
  if (action.whenArmed && !armed) return "Nothing in your hands — equip a weapon under Gear.";
  if (action.whenCaster && !caster) return "You have no spells.";
  if (spent[action.cost]) {
    return action.cost === "action"
      ? "Your action is gone this turn."
      : `Your ${action.cost} is gone this turn.`;
  }
  return null;
}
