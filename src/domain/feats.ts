/**
 * Feats, as a choice rather than a list.
 *
 * They were a dropdown of eight hundred and fifty names. A dropdown is the
 * right control for picking a thing you already know and the wrong one for
 * choosing between things you have never read — which is the whole of the
 * problem, because a feat IS its description. "Sentinel" means nothing; what
 * it does is the choice.
 *
 * This is the same lesson the spell picker and the turn menu already learned,
 * and feats were simply left behind. Two things fix it, and only one of them
 * is the description.
 *
 * The other is the prerequisite. Nearly five hundred of them have one, and a
 * beginner scrolling a list has no way to know that most of what they are
 * reading is not available to them. So the ones this app can actually check —
 * an ability score, a race, being able to cast at all — are checked and shown
 * as unavailable with the reason. Anything it cannot check is not blocked:
 * a proficiency it does not model, a subclass feature it does not know about.
 * It states the requirement and lets the table rule, which is the same
 * bargain the rest of the app makes.
 */

import type { Ability, AbilityScores } from "./abilities.js";
import { nameMark } from "./marks.js";

export interface FeatSource {
  readonly id: string;
  readonly name: string;
  readonly prerequisite: string;
  readonly text: string;
}

/** What a prerequisite gets checked against. */
export interface Aspirant {
  readonly abilities: AbilityScores;
  /** Empty for a character with no magic at all. */
  readonly spellSlots: readonly number[];
  readonly knowsSpells: boolean;
  /** "Wood elf", "Mountain dwarf". Free text, because a compendium's is too. */
  readonly race: string;
}

const ABILITY_WORDS: Record<string, Ability> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

/** Races a prerequisite names, matched loosely — "Elf (Drow)" against "Wood elf". */
function isRace(prereq: string, race: string): boolean {
  const want = prereq.toLowerCase();
  const mine = race.toLowerCase();
  // "Elf or Half-Elf", "Elf (Drow)" — any named race matching is enough.
  const names = want.split(/\s+or\s+|,/).map((p) => p.replace(/\(.*?\)/g, "").trim());
  return names.some((n) => n.length > 2 && mine.includes(n));
}

const RACE_WORDS = [
  "dwarf", "elf", "halfling", "human", "dragonborn", "gnome", "half-elf",
  "half-orc", "tiefling", "orc", "goblin", "aasimar", "genasi", "tabaxi",
];

export type Verdict =
  | { readonly ok: true }
  /** Checked, and they do not have it. */
  | { readonly ok: false; readonly why: string }
  /** Not checkable here. Stated, never blocked. */
  | { readonly ok: true; readonly unverified: string };

/**
 * Whether they qualify, as far as this app can tell.
 *
 * Deliberately conservative: an unrecognised prerequisite reads as allowed
 * with the requirement stated. Blocking on a guess would stop somebody taking
 * a feat they are entitled to, and being wrong in that direction is worse —
 * the table can always say no, but the app saying no is the end of it.
 */
export function meets(prerequisite: string, who: Aspirant): Verdict {
  const p = (prerequisite ?? "").trim();
  if (p === "") return { ok: true };
  const low = p.toLowerCase();

  // "Strength 13 or higher", "Intelligence or Wisdom 13 or higher"
  const score = /(\d{1,2})\s*(?:or higher)?$/.exec(low);
  const named = Object.keys(ABILITY_WORDS).filter((w) => low.includes(w));
  if (score && named.length > 0) {
    const need = Number(score[1]);
    const enough = named.some((w) => who.abilities[ABILITY_WORDS[w]!] >= need);
    return enough
      ? { ok: true }
      : {
          ok: false,
          why: `Needs ${named.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" or ")} ${need}.`,
        };
  }

  // "The ability to cast at least one spell"
  if (/cast at least one spell|spellcasting/.test(low)) {
    const casts = who.spellSlots.some((n) => n > 0) || who.knowsSpells;
    return casts ? { ok: true } : { ok: false, why: "Needs to be able to cast a spell." };
  }

  // "Halfling", "Elf (Drow)", "Elf or Half-Elf"
  if (RACE_WORDS.some((r) => low.includes(r))) {
    return isRace(p, who.race)
      ? { ok: true }
      : { ok: false, why: `Only for a ${p.replace(/\s+$/, "")}.` };
  }

  // A fighting style, a proficiency, a subclass feature — real requirements
  // this app does not model. Said out loud rather than enforced or hidden.
  return { ok: true, unverified: p };
}

/** Whether a verdict should stop the taking of it. */
export function blocked(v: Verdict): v is { ok: false; why: string } {
  return v.ok === false;
}

/**
 * Reading order: the game's own feats first, then everything a compendium
 * marked. Of eight hundred and fifty, seven hundred and fifty-six carry a
 * marker — so without this the entire visible list is somebody's homebrew,
 * exactly as it was for spells.
 */
export function byFeatOrder(a: { name: string }, b: { name: string }): number {
  return (
    (nameMark(a.name) ? 1 : 0) - (nameMark(b.name) ? 1 : 0) ||
    a.name.localeCompare(b.name)
  );
}
