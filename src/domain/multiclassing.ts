/**
 * What a SECOND class gives you, which is not what a first one does.
 *
 * Taking a level of fighter at character creation makes you a fighter: all
 * the armour, all the weapons, two skills off its list. Taking one later
 * makes you a fighter who missed basic training — the book grants a short,
 * specific list per class and no skills at all for most of them.
 *
 * The builder had this half-right by accident: a second class granted
 * nothing, which is correct for nine classes out of thirteen and wrong for
 * the three that do grant a skill. It also said nothing about the armour and
 * weapons that DO come across, so a fighter/wizard's shield proficiency was
 * a thing the player had to remember on their own.
 *
 * 2014 rules. Recorded rather than mechanised, in the same way subclass
 * features are: the app writes down what you gained and the table reads it.
 */

import type { ClassId } from "./resources.js";
import type { SkillId } from "./abilities.js";

export interface MulticlassGrant {
  /** Armour and weapons, in the book's own words. */
  readonly proficiencies: readonly string[];
  /** How many skills, and from where. Absent means none — which is usual. */
  readonly skills?: {
    readonly choose: number;
    /** Empty means any skill; otherwise the class's own list. */
    readonly from: readonly SkillId[];
  };
  /** Tools it brings across. */
  readonly tools?: readonly string[];
}

const LIGHT = "light armour";
const MEDIUM = "medium armour";
const SHIELDS = "shields";
const SIMPLE = "simple weapons";
const MARTIAL = "martial weapons";

export const MULTICLASS: Readonly<Record<string, MulticlassGrant>> = {
  barbarian: { proficiencies: [SHIELDS, SIMPLE, MARTIAL] },
  bard: {
    proficiencies: [LIGHT],
    // The bard is the one class whose multiclass skill is any skill at all.
    skills: { choose: 1, from: [] },
    tools: ["one musical instrument"],
  },
  cleric: { proficiencies: [LIGHT, MEDIUM, SHIELDS] },
  druid: { proficiencies: [LIGHT, MEDIUM, "shields (nonmetal)"] },
  fighter: { proficiencies: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL] },
  monk: { proficiencies: [SIMPLE, "shortswords"] },
  paladin: { proficiencies: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL] },
  ranger: {
    proficiencies: [LIGHT, MEDIUM, SHIELDS, SIMPLE, MARTIAL],
    skills: {
      choose: 1,
      from: [
        "animalHandling", "athletics", "insight", "investigation", "nature",
        "perception", "stealth", "survival",
      ],
    },
  },
  rogue: {
    proficiencies: [LIGHT],
    skills: {
      choose: 1,
      from: [
        "acrobatics", "athletics", "deception", "insight", "intimidation",
        "investigation", "perception", "performance", "persuasion",
        "sleightOfHand", "stealth",
      ],
    },
    tools: ["thieves' tools"],
  },
  // Neither gains a thing beyond the spellcasting itself.
  sorcerer: { proficiencies: [] },
  wizard: { proficiencies: [] },
  warlock: { proficiencies: [LIGHT, SIMPLE] },
  artificer: {
    proficiencies: [LIGHT, MEDIUM, SHIELDS],
    tools: ["thieves' tools", "tinker's tools"],
  },
};

export function multiclassGrant(id: ClassId | string): MulticlassGrant | null {
  return MULTICLASS[id] ?? null;
}

/** The whole grant as one line, for a card that has to say it out loud. */
export function describeGrant(name: string, g: MulticlassGrant): string {
  const parts = [...g.proficiencies, ...(g.tools ?? [])];
  if (g.skills) {
    parts.push(
      g.skills.from.length === 0
        ? "one skill of your choice"
        : "one skill from its list",
    );
  }
  if (parts.length === 0) {
    return `${name} brings its spellcasting and nothing else — no armour, no weapons, no skills.`;
  }
  const list =
    parts.length === 1
      ? parts[0]!
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]!}`;
  return `Taken as a second class, ${name} brings ${list}.`;
}
