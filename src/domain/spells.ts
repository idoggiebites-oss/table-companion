/**
 * A character's spells.
 *
 * One list with a prepared flag, rather than a model per class. The rules
 * distinguish a wizard preparing from a spellbook, a sorcerer knowing a fixed
 * few, and a cleric preparing from the whole class list — and encoding all
 * twelve of those would produce a builder that is wrong for the thirteenth.
 * What every table actually needs is: these are the spells on my sheet, and
 * these are the ones I can cast today. That is a list and a flag.
 *
 * Casting is where the app earns its place. A spell knows the slot level it
 * needs; the sheet knows which slots are left; and a spell that says
 * "Concentration" in its duration has to end whatever you were already
 * concentrating on. Doing those three things by hand is where mistakes live,
 * so casting is ONE event that does all of them — which also means undoing it
 * gives back the slot and the concentration together, rather than leaving one
 * of them lying.
 */

import { nameMark } from "./marks.js";

/** Re-exported: the provenance rule is shared with feats, the callers are here. */
export { nameMark };

/**
 * Structural, not the importer's type. The domain must not depend on the
 * compendium adapter: events.ts reaches this file, the Worker reaches
 * events.ts, and the Worker has no DOM to typecheck an XML parser against.
 */
export interface SpellSource {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly school: string;
  readonly concentration: boolean;
  readonly ritual: boolean;
  readonly classes: readonly string[];
}

/** A spell as it sits on a character's sheet. */
export interface KnownSpell {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  /** Denormalised so the list reads without the compendium loaded. */
  readonly school: string;
  readonly concentration: boolean;
  readonly ritual: boolean;
  /** Prepared spells are the ones castable today. Cantrips always are. */
  readonly prepared: boolean;
}

export const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function levelLabel(level: number): string {
  if (level === 0) return "Cantrip";
  const suffix = level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th";
  return `${level}${suffix} level`;
}

/** Cantrips need no preparing and cost nothing — they are always available. */
export function isReady(s: KnownSpell): boolean {
  return s.level === 0 || s.prepared;
}

export function toKnown(s: SpellSource, prepared = true): KnownSpell {
  return {
    id: s.id,
    name: s.name,
    level: s.level,
    school: s.school,
    concentration: s.concentration,
    ritual: s.ritual,
    prepared,
  };
}

/**
 * Whether a class can cast it, tolerantly.
 *
 * A compendium lists every subclass that gets a spell — "wizard", "cleric
 * (light domain)", "warlock (the genie) (efreeti)" — so an exact match would
 * hide Fireball from a Light cleric. Matching the leading word finds the base
 * class without pretending to understand subclasses.
 */
export function castableBy(spell: SpellSource, classId: string): boolean {
  const want = classId.toLowerCase();
  // Tolerates an absent list: device-local content is never migrated, and a
  // record saved by an older import must not be able to blank the screen.
  return (spell.classes ?? []).some((c) => c === want || c.startsWith(`${want} `));
}

/**
 * Compendiums file class FEATURES under spells — invocations, maneuvers,
 * metamagic, runes, infusions, elemental disciplines. In a complete one that
 * is 1,539 of 3,443 entries, and 1,254 of them claim level 0, so a warlock
 * browsing cantrips gets a wall of invocations before a single spell.
 *
 * Two signals identify them and both are needed. Most carry no school, which
 * no real spell omits. The rest announce their category before a colon —
 * "Invocation: Agonizing Blast", "Elemental Discipline: Breath of Winter" —
 * and some of those do have a school.
 *
 * Hidden by default rather than discarded: they are real things somebody
 * tracks, just not from a spell list.
 */
export function isClassFeature(s: { name: string; school: string }): boolean {
  return (s.school ?? "").trim() === "" || /^[^:]{1,40}:\s/.test(s.name ?? "");
}

export interface SlotState {
  readonly level: number;
  readonly max: number;
  readonly left: number;
}

/**
 * Which slots could cast this spell. A spell can always go into a HIGHER slot
 * than its own — that is upcasting, and it is the single most commonly
 * forgotten option at a table because nothing on a paper sheet suggests it.
 */
export function slotsFor(spell: KnownSpell, slots: readonly SlotState[]): SlotState[] {
  if (spell.level === 0) return [];
  return slots.filter((s) => s.level >= spell.level && s.left > 0);
}

export function canCast(spell: KnownSpell, slots: readonly SlotState[]): boolean {
  if (!isReady(spell)) return false;
  if (spell.level === 0) return true;
  return slotsFor(spell, slots).length > 0;
}

/**
 * Reading order for any list of spells drawn from a compendium: by level,
 * then the game's own before everything else, then by name.
 *
 * Level leads because every picker is capped — a list of three thousand is
 * not a choice — and a cap on a badly ordered list is how the choice
 * disappears entirely.
 */
export function byBookOrder(
  a: { name: string; level: number },
  b: { name: string; level: number },
): number {
  return (
    a.level - b.level ||
    (nameMark(a.name) ? 1 : 0) - (nameMark(b.name) ? 1 : 0) ||
    a.name.localeCompare(b.name)
  );
}

/** Sorted for reading: cantrips first, then by level, then by name. */
export function sortSpells(spells: readonly KnownSpell[]): KnownSpell[] {
  return [...spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export function groupByLevel(
  spells: readonly KnownSpell[],
): { level: number; spells: KnownSpell[] }[] {
  const out = new Map<number, KnownSpell[]>();
  for (const s of sortSpells(spells)) {
    const at = out.get(s.level);
    if (at) at.push(s);
    else out.set(s.level, [s]);
  }
  return [...out.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, list]) => ({ level, spells: list }));
}

/** How many prepared spells a caster is carrying, cantrips excluded. */
export function preparedCount(spells: readonly KnownSpell[]): number {
  return spells.filter((s) => s.level > 0 && s.prepared).length;
}
