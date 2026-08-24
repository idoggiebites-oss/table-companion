/**
 * Plain words for the two questions a builder cannot answer with numbers.
 *
 * "d10 hit die · saves in STR and DEX" tells a returning player what they
 * need and a new one nothing at all. What they are asking is "what is this
 * class LIKE to play" and "what does Strength even do", and neither is
 * derivable from data — so it is written here, once, deliberately short.
 *
 * Only for the classes this app ships. A compendium brings fifty-five more
 * and inventing a sentence about a homebrew class would be worse than saying
 * nothing: absent is honest, wrong is not.
 */

import type { Ability } from "./abilities.js";

/** One line on what playing it is actually like. */
/**
 * What a class is LIKE, at a glance.
 *
 * A dropdown of names told you nothing until you picked one and read a
 * paragraph. Two things fix that without adding words: what it plays like,
 * and how much bookkeeping it asks of you.
 *
 * Both are authored rather than derived. "Spellcaster" can be read off a slot
 * table, but "Support" and "Control" are what the class is FOR, and how hard
 * a class is to run is a judgement — a wizard has no more rules than a
 * fighter, it just has three hundred more decisions.
 */
export interface ClassShape {
  /** One or two, in the order they should read. */
  readonly tags: readonly string[];
  /** 1 easiest, 5 hardest. Bookkeeping and decisions, not power. */
  readonly complexity: number;
  /** A mark, not a picture: the app ships no images. */
  readonly glyph: string;
}

export const CLASS_SHAPE: Readonly<Record<string, ClassShape>> = {
  barbarian: { tags: ["Martial", "Tank"], complexity: 1, glyph: "\u2694" },
  bard: { tags: ["Spellcaster", "Support"], complexity: 4, glyph: "\u266A" },
  cleric: { tags: ["Spellcaster", "Support"], complexity: 3, glyph: "\u271D" },
  druid: { tags: ["Spellcaster", "Control"], complexity: 5, glyph: "\u2766" },
  fighter: { tags: ["Martial", "Tank"], complexity: 1, glyph: "\u2694" },
  monk: { tags: ["Martial", "Mobile"], complexity: 3, glyph: "\u262F" },
  paladin: { tags: ["Martial", "Support"], complexity: 3, glyph: "\u2720" },
  ranger: { tags: ["Martial", "Skirmisher"], complexity: 3, glyph: "\u27B3" },
  rogue: { tags: ["Martial", "Stealth"], complexity: 2, glyph: "\u25D1" },
  sorcerer: { tags: ["Spellcaster", "Damage"], complexity: 4, glyph: "\u2726" },
  warlock: { tags: ["Spellcaster", "Damage"], complexity: 3, glyph: "\u26E7" },
  wizard: { tags: ["Spellcaster", "Control"], complexity: 5, glyph: "\u2728" },
  artificer: { tags: ["Spellcaster", "Support"], complexity: 4, glyph: "\u2699" },
};

/** What the app knows about a class it has never heard of: nothing useful. */
export function shapeOf(classId: string): ClassShape | null {
  return CLASS_SHAPE[classId.toLowerCase()] ?? null;
}

export const CLASS_BLURB: Readonly<Record<string, string>> = {
  barbarian: "Wade in and take the hits. Rage makes you hard to hurt. The easiest to play.",
  bard: "Talk your way past trouble and make everyone else better at their job.",
  cleric: "Heal, protect, and hit undead very hard. Armoured, and never short of something to do.",
  druid: "Turn into animals, and bend weather and plants to your side.",
  fighter: "Hit things, take hits, and attack more often than anyone. The simplest place to start.",
  monk: "Fast and unarmed, hard to pin down, better at running up a wall than standing still.",
  paladin: "Armoured, healing, and enormous damage in one swing when it matters.",
  ranger: "Track, shoot, and know the ground. Half warrior, half woodsman.",
  rogue: "Sneak, pick locks, and hit for a great deal once a turn if you set it up.",
  sorcerer: "Magic you were born with. Fewer spells than a wizard, bent to your will mid-cast.",
  warlock: "A pact for power. Few slots, but they come back on a short rest.",
  wizard: "The longest spell list in the game, prepared from a book you carry.",
};

/** One line on what the race is, for the nine this app ships. */
export const RACE_BLURB: Readonly<Record<string, string>> = {
  dragonborn: "Draconic blood, a breath weapon, and everybody notices you walk in.",
  dwarf: "Tough and steady, hard to poison, and sees in the dark.",
  elf: "Keen senses, no need to sleep, and hard to charm.",
  gnome: "Small, clever, and unusually hard to fool with magic.",
  "half-elf": "At home nowhere and everywhere. Charming, and picks its own strengths.",
  "half-orc": "Strong, and stays standing when it should not.",
  halfling: "Small, lucky and brave — hard to frighten, harder to hit.",
  human: "A little of everything. The easiest to build and the hardest to get wrong.",
  tiefling: "Infernal blood, resistance to fire, and a little magic of your own.",
};

/** Flavour the data carries but a builder should not lead with. */
const NOT_MECHANICAL = /^(description|suggested characteristics|personality|ideal|bond|flaw)/i;

export interface Trait {
  readonly name: string;
  readonly desc: string;
}

/**
 * One sentence, preferring what is written here and falling back to what the
 * file says. Two hundred and sixty imported races cannot be hand-written, and
 * their own description is better than an invented one.
 */
export function blurbFor(
  id: string,
  traits: readonly Trait[] | undefined,
  authored: Readonly<Record<string, string>> = RACE_BLURB,
): string | null {
  const own = authored[id];
  if (own) return own;
  const described = (traits ?? []).find((t) => /^description/i.test(t.name));
  if (!described) return null;
  const first = described.desc.split(/(?<=[.!?])\s/)[0]?.trim();
  return first && first.length > 0 ? first : null;
}

/** What it actually GIVES you, with the prose left out. */
export function mechanicalTraits(traits: readonly Trait[] | undefined): Trait[] {
  return (traits ?? []).filter((t) => t.name && !NOT_MECHANICAL.test(t.name));
}

/** A background's one mechanical line, which the books mark as "Feature:". */
export function featureOf(traits: readonly Trait[] | undefined): Trait | null {
  return (traits ?? []).find((t) => /^feature\b/i.test(t.name)) ?? null;
}

/** What the score actually changes, in the order it comes up in play. */
export const ABILITY_BLURB: Readonly<Record<Ability, string>> = {
  str: "Melee attacks and damage, Athletics, shoving and carrying.",
  dex: "Armour class, initiative, ranged and finesse attacks, Stealth.",
  con: "Hit points, at every level. And holding concentration on a spell.",
  int: "Arcana, History, Investigation. Wizards cast with it.",
  wis: "Perception, Insight, Survival. Clerics and druids cast with it.",
  cha: "Persuasion, Deception, Intimidation. Bards, sorcerers, warlocks and paladins cast with it.",
};

/**
 * The two that matter most, from the class's own priority order. Advice, not
 * enforcement — the builder already refuses to place scores for you, and this
 * refuses to hide the other four.
 */
export function mattersMost(
  priority: readonly Ability[] | undefined,
): readonly Ability[] {
  return (priority ?? []).slice(0, 2);
}

const NAMES: Readonly<Record<Ability, string>> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

export function abilityName(a: Ability): string {
  return NAMES[a];
}

/** "Strength and Constitution matter most for a fighter." */
export function describePriority(
  className: string,
  priority: readonly Ability[] | undefined,
): string | null {
  const top = mattersMost(priority);
  if (top.length < 2) return null;
  return `${abilityName(top[0]!)} and ${abilityName(top[1]!)} matter most for a ${className.toLowerCase()}.`;
}
