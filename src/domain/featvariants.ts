/**
 * Feats that come pre-split by their own choice.
 *
 * The compendium does not ship "Resilient" with a dropdown. It ships
 * `Resilient (Strength)`, `Resilient (Dexterity)` and four more — 331 entries
 * across the file whose parenthetical is an ability, a damage type or a
 * skill. The choice is already data.
 *
 * Which broke something. The provenance rule reads a parenthetical as "this
 * came from somewhere other than the game", and the picker shows the game's
 * own unfiltered — so Resilient, Observant, Athlete, Weapon Master and
 * Elemental Adept, five of the most-taken feats there are, were invisible
 * unless you knew to search for their names. A rule that was right for
 * "(HB)" was wrong for "(Constitution)", and nothing said so.
 *
 * So: an axis, not a source. A parenthetical naming an ability, a damage type
 * or a skill is a variant of a real feat and belongs in the list; everything
 * else is still provenance and still sorts last. Variants of one feat then
 * collapse into a single row that asks which — the choice, restored, from the
 * data rather than from a parser.
 */

import { ABILITIES, type Ability } from "./abilities.js";
import { isAxis, nameMarks, sourceMark } from "./marks.js";

const ABILITY_BY_NAME: Record<string, Ability> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

const DAMAGE_TYPES = [
  "acid", "cold", "fire", "lightning", "thunder", "necrotic", "radiant",
  "poison", "psychic", "force",
];

/** The axes a feat is legitimately split along. */
export const isVariantAxis = isAxis;

/**
 * The provenance marker, or null. The rule is shared with every other list —
 * see marks.ts — because "is this somebody else's material" is one question
 * however it is asked.
 */
export const featMark = sourceMark;

/** The feat's own name, with any variant axis taken off the end. */
export function baseName(name: string): string {
  let out = (name ?? "").trim();
  // Innermost-last, so "X (Dexterity + Acrobatics (Proficient))" unwinds.
  for (;;) {
    const m = /\s*\(([^()]{1,30})\)\s*$/.exec(out);
    if (!m || !isVariantAxis(m[1]!)) break;
    out = out.slice(0, m.index).trim();
  }
  return out;
}

/** The ability a variant names, when it names one. */
export function variantAbility(name: string): Ability | null {
  for (const m of nameMarks(name)) {
    const hit = ABILITY_BY_NAME[m.trim().toLowerCase()];
    if (hit) return hit;
  }
  return null;
}

export interface FeatLike {
  readonly id: string;
  readonly name: string;
  readonly prerequisite: string;
  readonly text: string;
}

export interface FeatGroup {
  /** "Resilient", or the whole name where there is only one of it. */
  readonly name: string;
  /** One entry, or the variants to choose between. */
  readonly variants: readonly FeatLike[];
}

/**
 * One row per feat, however many entries the file split it into. Order is
 * preserved from the input, so whatever sorted it stays sorted.
 */
export function groupVariants(feats: readonly FeatLike[]): FeatGroup[] {
  const out = new Map<string, FeatLike[]>();
  for (const f of feats) {
    const key = baseName(f.name);
    const at = out.get(key);
    if (at) at.push(f);
    else out.set(key, [f]);
  }
  return [...out.entries()].map(([name, variants]) => ({ name, variants }));
}

/**
 * What taking this feat actually does to the numbers.
 *
 * Only the two that are unambiguous once the variant has named its ability:
 * the half-feat's +1, and Resilient's saving throw. Everything else a feat
 * grants stays recorded and unmechanised — the app cannot know what eight
 * hundred of them do, and half-applying them would be worse than being clear
 * that it applies none.
 */
export function effectsOf(feat: FeatLike): {
  readonly increase?: Ability;
  readonly saveProficiency?: Ability;
} {
  const text = (feat.text ?? "").toLowerCase();
  const named = variantAbility(feat.name);

  // "Increase the chosen ability score by 1" — the variant says which.
  const chosen = /increase the chosen ability score by 1/.test(text);
  // "Increase your Charisma score by 1" — the feat says which, no variant.
  const fixed = /increase your (\w+) score by 1/.exec(text);
  // "Increase your Intelligence or Wisdom score by 1" — the variant says which.
  const either = /increase your \w+ or \w+ score by 1/.test(text);

  let increase: Ability | undefined;
  if (chosen || either) increase = named ?? undefined;
  else if (fixed) increase = ABILITY_BY_NAME[fixed[1]!] ?? undefined;

  const save =
    /proficiency in saving throws using the chosen ability/.test(text) && named
      ? named
      : undefined;

  return {
    ...(increase ? { increase } : {}),
    ...(save ? { saveProficiency: save } : {}),
  };
}

/** Cheap guard for callers that only want to know whether to ask. */
export function hasChoice(group: FeatGroup): boolean {
  return group.variants.length > 1;
}

export { ABILITIES };
