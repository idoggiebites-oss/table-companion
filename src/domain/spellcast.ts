/**
 * What casting a spell actually costs and does.
 *
 * Three questions a beginner cannot answer from a spell's description, and
 * all three are answerable from the file:
 *
 *   - What does it cost me? <time> says "1 action" or "1 bonus action". The
 *     app can stop you casting two things in a turn instead of leaving you to
 *     notice.
 *   - Do I roll to hit, or do they roll to save? The text says "make a ranged
 *     spell attack" or "must make a Dexterity saving throw" in almost exactly
 *     those words.
 * Every reader here tolerates an absent field. Content is device-local and
 * never migrated, so a spell saved by an older import can be missing what
 * today's code reads — and a missing string must not be able to take the
 * whole screen down. See Boundary.tsx for what happens when one does.
 *
 *   - How much damage? <roll> states the dice per level — and per level of
 *     WHAT differs: a cantrip scales with the caster and a levelled spell
 *     with the slot it was cast from. That is the rule people get wrong by
 *     hand, and getting it right is most of the value here.
 */

import { ABILITIES, type Ability } from "./abilities.js";
import type { EconomyKind } from "./combat.js";

export interface CastableSpell {
  readonly name: string;
  readonly level: number;
  readonly time: string;
  readonly text: string;
  readonly rolls: readonly { description: string; level?: number; dice: string }[];
}

/** What a cast costs. "long" is anything a fight has no room for. */
export type CastCost = EconomyKind | "long";

export function costOf(time: string): CastCost {
  const t = (time ?? "").toLowerCase();
  if (t.includes("bonus")) return "bonus";
  if (t.includes("reaction")) return "reaction";
  if (/^\s*1\s*action/.test(t) || t === "action") return "action";
  // "1 minute", "8 hours", "10 minutes" — not something you do mid-fight.
  return "long";
}

export type SpellKind =
  | { readonly kind: "attack" }
  | { readonly kind: "save"; readonly ability: Ability }
  | { readonly kind: "none" };

const ABILITY_WORDS: Record<string, Ability> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

/**
 * Read off the text, because no compendium marks it structurally. The
 * phrasing is near-boilerplate in the rules, which is what makes this safe —
 * and anything unrecognised falls to "none", where the app asks for nothing
 * and gets out of the way.
 */
export function kindOf(spell: CastableSpell): SpellKind {
  const text = (spell.text ?? "").toLowerCase();
  if (/\b(ranged|melee) spell attack\b/.test(text)) return { kind: "attack" };
  const save = /\b(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw\b/
    .exec(text);
  if (save) return { kind: "save", ability: ABILITY_WORDS[save[1]!]! };
  return { kind: "none" };
}

/**
 * Whether a successful save halves the damage or avoids it entirely.
 *
 * The rule lives in the spell's own last sentence — "half as much damage on a
 * successful one" — and it is the one number a table gets wrong most often,
 * because it arrives after the dice are already on the table and somebody has
 * to divide by two out loud.
 *
 * Absent that sentence a save takes nothing, which is the rule's default and
 * also the safer way to be wrong: it under-applies rather than inventing
 * damage the spell does not do.
 */
export function halvesOnSave(spell: CastableSpell): boolean {
  return /half as much damage/i.test(spell.text ?? "");
}

/** Proficiency plus the casting ability, the same as a weapon's. */
export function spellAttackBonus(proficiencyBonus: number, abilityMod: number): number {
  return proficiencyBonus + abilityMod;
}

export function spellSaveDc(proficiencyBonus: number, abilityMod: number): number {
  return 8 + proficiencyBonus + abilityMod;
}

/**
 * The dice for this casting.
 *
 * A cantrip's rolls are keyed by CHARACTER level and a levelled spell's by the
 * SLOT it went into, so the same lookup with a different key. Both take the
 * highest entry at or below the level in hand, which is how the tables read.
 */
/**
 * Which of the two a turn should lead with.
 *
 * The turn always led with the weapon, so a wizard's turn opened with "Attack
 * with Quarterstaff" — a thing a wizard does roughly never — and the cantrip
 * sat a tap further behind a question.
 *
 * Ranked on the numbers rather than on a guess about the class, because the
 * numbers are something this app can stand behind and "what a Bladesinger
 * prefers" is not. A wizard swings at +1 and throws a Fire Bolt at +5, so the
 * spell leads; a ranger shoots at +7 and casts at +5, so the bow does. Ties go
 * to the weapon: no reason to move a screen somebody has already learnt.
 */
export function leadsWithSpell(
  spellAttack: number | null,
  bestSwing: number | null,
): boolean {
  if (spellAttack === null) return false;
  return bestSwing === null || spellAttack > bestSwing;
}

/**
 * The dice a spell's own TEXT states, for when the data carries none.
 *
 * `rolls` is a Fight Club extension. The compendium a real table imports has
 * 317 spells and not one <roll> element, and 76 of the bundled spells state
 * dice in their prose and carry none either. Where that happened the caster
 * was asked for an attack roll, never asked for damage, and the DM got a
 * claim reading "0 damage" — with the word "damage" rather than "fire",
 * which is the tell: the type is only generic when there was no roll to name
 * it.
 *
 * Deliberately narrow. It reads the base line — "takes 1d10 fire damage" —
 * and a cantrip's own upgrade table — "1d10 when you reach 5th level (2d10),
 * 11th level (3d10)". It does NOT try to work out slot scaling from prose
 * like "one extra d6 for each slot level above 3rd"; a wrong number offered
 * with confidence is worse than the player reading their own spell, and this
 * app's whole posture is that the person rolls.
 */
export function rollsFromText(text: string, level: number): CastableSpell["rolls"][number][] {
  const prose = text ?? "";
  /*
   * "1d10 fire damage", "3d8 radiant damage", "10d6 + 40 force damage", and
   * bare "3d8 damage" where the book leaves the type to the caster.
   *
   * The word "damage" is required and that is the whole safety of this: the
   * prose is full of dice that are NOT damage — Cure Wounds "regains a number
   * of hit points equal to 1d8", False Life gives "1d4 + 4 temporary hit
   * points", Control Weather takes "1d4 x 10 minutes". Matching those would
   * offer a player healing dice as damage, which is worse than offering
   * nothing, so the pattern stays anchored to the word.
   */
  const base = /(\d+d\d+)(?:\s*\+\s*\d+)?\s+(?:(\w+)\s+)?damage/i.exec(prose);
  if (!base) return [];
  const type = base[2];
  const description = type
    ? `${type[0]!.toUpperCase()}${type.slice(1)} Damage`
    : "Damage";

  if (level !== 0) return [{ description, dice: base[1]! }];

  /* A cantrip states its own table, and it is the one rule people get wrong
     by hand: it scales with the CASTER's level, not with a slot. */
  const steps: CastableSpell["rolls"][number][] = [{ description, level: 0, dice: base[1]! }];
  for (const m of prose.matchAll(/(\d+)(?:st|nd|rd|th)\s+level\s*\((\d+d\d+)\)/gi)) {
    steps.push({ description, level: Number(m[1]), dice: m[2]! });
  }
  return steps;
}

export function damageFor(
  spell: CastableSpell,
  { slotLevel, characterLevel }: { slotLevel: number; characterLevel: number },
): { dice: string; description: string } | null {
  /* The file first, its own prose second. See rollsFromText: a compendium
     without <roll> elements is the common case, not the exotic one. */
  const stated = spell.rolls ?? [];
  const rolls = stated.length > 0 ? stated : rollsFromText(spell.text ?? "", spell.level);
  const scaling = rolls.filter((r) => r.level !== undefined);
  const flat = rolls.find((r) => r.level === undefined);

  if (scaling.length === 0) {
    return flat ? { dice: flat.dice, description: flat.description } : null;
  }

  const against = spell.level === 0 ? characterLevel : slotLevel;
  const best = scaling
    .filter((r) => (r.level ?? 0) <= against)
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
  const chosen = best ?? scaling.sort((a, b) => (a.level ?? 0) - (b.level ?? 0))[0];
  return chosen ? { dice: chosen.dice, description: chosen.description } : null;
}

/**
 * "1d8+%0" with the modifier filled in. The placeholder is the compendium's,
 * and left unresolved it would be handed to a player as literal text.
 */
export function resolveDice(dice: string, abilityMod: number): string {
  return (dice ?? "").replace(/%0/g, abilityMod >= 0 ? `${abilityMod}` : `${abilityMod}`)
    .replace(/\+\s*-/, "−");
}

/** "Fire Damage" → "fire". What the DM's queue shows beside the number. */
export function damageTypeFrom(description: string): string {
  return (description ?? "").replace(/\s*damage\s*$/i, "").trim().toLowerCase() || "damage";
}

/**
 * Which ability a class casts with. The build does not carry one — an
 * imported sheet rarely states it — so this is the fallback, and anything
 * unknown lands on Intelligence rather than refusing to cast.
 */
const BY_CLASS: Record<string, Ability> = {
  bard: "cha", cleric: "wis", druid: "wis", paladin: "cha", ranger: "wis",
  sorcerer: "cha", warlock: "cha", wizard: "int", artificer: "int",
};

export function castingAbility(classIds: readonly string[], stated?: string): Ability {
  if (stated) {
    const short = stated.slice(0, 3).toLowerCase() as Ability;
    if ((ABILITIES as readonly string[]).includes(short)) return short;
  }
  for (const id of classIds) {
    const found = BY_CLASS[id.toLowerCase()];
    if (found) return found;
  }
  return "int";
}
