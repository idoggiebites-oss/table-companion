/**
 * Starting equipment, out of the sentence the SRD writes it in.
 *
 * The class data carries choices as prose — "(a) a martial weapon and a
 * shield or (b) two martial weapons" — because that is how the book says it.
 * A builder cannot offer that as a choice without taking it apart, so this
 * does: lettered options, each a list of things, each thing resolved against
 * the equipment catalogue where it can be.
 *
 * Where it cannot, it says so instead of guessing. Three outcomes per phrase:
 *
 *   item      — resolved to a catalogue entry, quantity and all
 *   category  — "a martial weapon" is a decision, not a thing; the builder
 *               has to ask, so this carries the filter to ask with
 *   unknown   — kept by name so nothing is silently dropped. "An arcane
 *               focus" is a real item the SRD list does not enumerate, and a
 *               wizard who ends up without one because a parser shrugged is
 *               worse off than one holding something labelled in plain words.
 *
 * The alternative to all of this is buying a kit with starting gold, which
 * every table treats as the advanced option and which is PHB rather than SRD —
 * so the numbers for it live in non-srd.ts.
 */

import type { Catalogue, Item } from "./items.js";

export interface GearItem {
  readonly kind: "item";
  readonly qty: number;
  readonly item: Item;
}
export interface GearCategory {
  readonly kind: "category";
  readonly qty: number;
  /** What the picker should offer: martial melee weapons, say. */
  readonly weaponCategory?: "Simple" | "Martial";
  readonly weaponRange?: "Melee" | "Ranged";
  readonly label: string;
}
export interface GearUnknown {
  readonly kind: "unknown";
  readonly qty: number;
  readonly label: string;
}
export type GearPhrase = GearItem | GearCategory | GearUnknown;

export interface GearOption {
  /** "a", "b", "c" — the letter the book uses. */
  readonly letter: string;
  readonly label: string;
  readonly phrases: readonly GearPhrase[];
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20,
};

/** Curly apostrophes and stray whitespace, which the SRD text is full of. */
function tidy(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Exact name first. "chain mail" also substring-matches "barding: chain mail",
 * and "leather armor" matches "studded leather armor" — picking the longer
 * one because it happened to sort first would arm every fighter wrongly.
 */
export function findItem(name: string, catalogue: Catalogue): Item | undefined {
  const want = tidy(name).toLowerCase();
  const all = Object.values(catalogue);
  const exact = all.find((i) => i.name.toLowerCase() === want);
  if (exact) return exact;
  const singular = want.replace(/s$/, "");
  const exactSingular = all.find((i) => i.name.toLowerCase() === singular);
  if (exactSingular) return exactSingular;
  // Shortest containing match: the least embellished thing that could be meant.
  const contains = all
    .filter((i) => i.name.toLowerCase().includes(singular))
    .sort((a, b) => a.name.length - b.name.length);
  return contains[0];
}

const CATEGORY = /^(?:any\s+)?(simple|martial)\s*(melee|ranged)?\s*weapons?$/i;

export function resolvePhrase(raw: string, catalogue: Catalogue): GearPhrase {
  let text = tidy(raw).replace(/^(?:and|or)\s+/i, "");
  let qty = 1;

  const numeric = /^(\d+)\s+(.*)$/.exec(text);
  if (numeric) {
    qty = Number(numeric[1]);
    text = numeric[2]!;
  } else {
    const word = /^(\w+)\s+(.*)$/.exec(text);
    const n = word ? WORD_NUMBERS[word[1]!.toLowerCase()] : undefined;
    if (word && n !== undefined) {
      qty = n;
      text = word[2]!;
    }
  }

  const cat = CATEGORY.exec(text);
  if (cat) {
    return {
      kind: "category",
      qty,
      weaponCategory: (cat[1]![0]!.toUpperCase() + cat[1]!.slice(1).toLowerCase()) as "Simple" | "Martial",
      ...(cat[2] ? { weaponRange: (cat[2][0]!.toUpperCase() + cat[2].slice(1).toLowerCase()) as "Melee" | "Ranged" } : {}),
      label: text,
    };
  }

  const item = findItem(text, catalogue);
  return item ? { kind: "item", qty, item } : { kind: "unknown", qty, label: text };
}

/**
 * "(a) chain mail or (b) leather armor, longbow, and 20 arrows" into two
 * options. Commas inside an option separate ITEMS; the lettered markers are
 * what separate options, which is why splitting on them has to come first.
 */
export function parseChoice(desc: string, catalogue: Catalogue): GearOption[] {
  const text = tidy(desc);
  const marks = [...text.matchAll(/\(([a-z])\)/gi)];
  if (marks.length === 0) {
    const phrases = splitPhrases(text).map((p) => resolvePhrase(p, catalogue));
    return phrases.length > 0 ? [{ letter: "a", label: text, phrases }] : [];
  }

  const out: GearOption[] = [];
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i]!.index! + marks[i]![0].length;
    const to = i + 1 < marks.length ? marks[i + 1]!.index! : text.length;
    const body = tidy(text.slice(from, to))
      .replace(/,?\s*(?:or|and)\s*$/i, "")
      .replace(/,\s*$/, "");
    out.push({
      letter: marks[i]![1]!.toLowerCase(),
      label: body,
      phrases: splitPhrases(body).map((p) => resolvePhrase(p, catalogue)),
    });
  }
  return out;
}

function splitPhrases(body: string): string[] {
  return body
    .split(/,| and /i)
    .map((p) => tidy(p).replace(/^(?:and|or)\s+/i, ""))
    .filter((p) => p.length > 0 && !/^or$/i.test(p));
}

/** The fixed half: "2 Dagger", "Leather Armor", "Thieves' Tools". */
export function parseFixed(entries: readonly string[], catalogue: Catalogue): GearPhrase[] {
  return entries.map((e) => resolvePhrase(e, catalogue));
}

/** What a resolved phrase becomes once it is actually carried. */
export function toStack(p: GearPhrase): { itemId: string; name: string; qty: number } | null {
  if (p.kind === "item") return { itemId: p.item.id, name: p.item.name, qty: p.qty };
  if (p.kind === "unknown") {
    return {
      itemId: `gear-${p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: p.label.replace(/^\w/, (c) => c.toUpperCase()),
      qty: p.qty,
    };
  }
  return null; // a category is a question, not a thing
}
