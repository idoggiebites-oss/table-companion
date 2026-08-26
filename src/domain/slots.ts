/**
 * What is worn where.
 *
 * 5e has no slot system. It has sentences — "you can wear only one pair of
 * boots", "a shield is carried in one hand" — and a table that remembers
 * them. So this is not the rules made explicit; it is a reading of what a
 * character has equipped, arranged the way a person pictures themselves.
 *
 * Six places, because six is what a phone holds beside a figure and because
 * every one of them answers a question somebody asks at a table: what am I
 * hitting with, what is in my other hand, what am I wearing, and the three
 * that magic items land in.
 *
 * Anything equipped that fits none of them is still equipped — a ring, a pair
 * of boots, a lantern. Those are named separately rather than forced into a
 * slot they do not belong in, because inventing a slot system and then lying
 * about which slot something is in is worse than admitting the list is short.
 */

import { isArmour, isShield, isWeapon, type Item } from "./items.js";

export type SlotId = "head" | "body" | "cloak" | "main" | "off" | "belt";

export interface Slot {
  readonly id: SlotId;
  readonly name: string;
  /** Drawn, not fetched — the app ships no icon set. */
  readonly glyph: string;
  /** What goes here, for the empty state. */
  readonly what: string;
}

export const SLOTS: readonly Slot[] = [
  { id: "head", name: "Head", glyph: "⛑", what: "a helm, a circlet, a hat" },
  { id: "body", name: "Body", glyph: "⛨", what: "armour" },
  { id: "cloak", name: "Cloak", glyph: "◈", what: "a cloak or mantle" },
  { id: "main", name: "Main hand", glyph: "⚔", what: "what you attack with" },
  { id: "off", name: "Off hand", glyph: "🗡", what: "a shield, or a second weapon" },
  { id: "belt", name: "Belt", glyph: "◐", what: "a belt, a pouch, a horn" },
];

/** The left-hand column, then the right, as the figure is drawn. */
export const WORN: readonly SlotId[] = ["head", "body", "cloak"];
export const HELD: readonly SlotId[] = ["main", "off", "belt"];

/*
 * Read off the name, because the catalogue does not say. 10,760 items carry a
 * category and a set of armour or weapon numbers and nothing about where they
 * sit on a body — so a Cloak of Protection is "adventuring-gear" like a coil
 * of rope. The words are the only signal there is.
 */
const BY_NAME: readonly { readonly slot: SlotId; readonly re: RegExp }[] = [
  { slot: "head", re: /\b(helm|helmet|circlet|crown|hat|hood|mask|goggles|lenses)\b/i },
  { slot: "cloak", re: /\b(cloak|cape|mantle|shawl)\b/i },
  { slot: "belt", re: /\b(belt|girdle|sash|pouch|horn|quiver)\b/i },
];

/**
 * Where this item goes, or null for the things a six-slot picture cannot
 * hold. `taken` is what is already filled, so the second sword a character
 * draws lands in the other hand rather than replacing the first.
 */
export function slotFor(item: Item, taken: ReadonlySet<SlotId> = new Set()): SlotId | null {
  if (isShield(item)) return "off";
  if (isArmour(item)) return "body";
  if (isWeapon(item)) {
    if (!taken.has("main")) return "main";
    if (!taken.has("off")) return "off";
    return null;
  }
  for (const { slot, re } of BY_NAME) {
    if (re.test(item.name)) return slot;
  }
  return null;
}

export interface Worn {
  readonly slots: Readonly<Record<SlotId, Item | null>>;
  /** Equipped, and not in one of the six. Still worn, still counted. */
  readonly elsewhere: readonly Item[];
}

/**
 * The figure, filled in.
 *
 * Order matters and is the caller's: whatever was equipped first takes the
 * main hand. Two shields, or a third weapon, land in `elsewhere` rather than
 * quietly displacing what is already held.
 */
export function worn(items: readonly Item[]): Worn {
  const slots: Record<SlotId, Item | null> = {
    head: null, body: null, cloak: null, main: null, off: null, belt: null,
  };
  const elsewhere: Item[] = [];
  const taken = new Set<SlotId>();
  for (const item of items) {
    const at = slotFor(item, taken);
    if (at === null || slots[at] !== null) {
      elsewhere.push(item);
      continue;
    }
    slots[at] = item;
    taken.add(at);
  }
  return { slots, elsewhere };
}

/**
 * Rarity, which the app shows as a rim rather than a fill.
 *
 * Red already means damage here, green means healing and violet means
 * concentration, so rarity cannot have a hue of its own without teaching the
 * wrong thing. It climbs one hue — the structural steel — into gold at the
 * top, and the word is always available underneath.
 */
export type Rarity = "common" | "uncommon" | "rare" | "very rare" | "legendary";

const RARITIES: readonly Rarity[] = [
  "common", "uncommon", "rare", "very rare", "legendary",
];

export function rarityOf(item: Item): Rarity | null {
  const said = `${item.detail ?? ""} ${item.name}`.toLowerCase();
  // Longest first: "very rare" contains "rare".
  for (const r of ["legendary", "very rare", "uncommon", "rare", "common"] as const) {
    if (said.includes(r)) return r;
  }
  return item.magic ? "rare" : null;
}

/** How bright the rim gets. Nothing for ordinary kit. */
export function rarityStep(item: Item): number {
  const r = rarityOf(item);
  return r === null ? 0 : RARITIES.indexOf(r);
}
