/**
 * The people in the world, as opposed to the things fighting the party.
 *
 * An NPC is not a statblock. Most of the ones a campaign accumulates never
 * roll anything — a shopkeeper, a harbourmaster, the contact who knows a guy —
 * and forcing them through a creature form would mean inventing an armour
 * class for a man who sells rope. So the record is notes-first, with stats as
 * an optional afterthought for the ones where it turns out to matter, because
 * it always eventually matters for one of them.
 *
 * Inventory hangs off a `trader` flag rather than existing on every NPC, for
 * the same reason: a stock list on a record that will never sell anything is a
 * field that has to be skipped every time the form is opened.
 *
 * Prices are per-NPC, not per-item. The point of a trader is that this one
 * charges more, and a stock list that could only quote the SRD price would
 * make every shop in the campaign identical.
 */

import { formatPrice } from "./money.js";

export interface StockEntry {
  readonly itemId: string;
  readonly name: string;
  /** Copper. Defaults to the catalogue price but is the DM's to set. */
  readonly price: number;
  /** How many are for sale. Negative means an unlimited supply. */
  readonly qty: number;
}

export interface NpcStats {
  readonly ac?: number;
  readonly hp?: number;
  readonly notes?: string;
}

export interface Npc {
  readonly id: string;
  readonly name: string;
  /** "Shopkeeper", "Harbourmaster" — what they are to the party. */
  readonly role: string;
  readonly trader: boolean;
  readonly notes: string;
  readonly stats?: NpcStats;
  readonly stock: readonly StockEntry[];
}

export const UNLIMITED = -1;

export function isUnlimited(entry: StockEntry): boolean {
  return entry.qty < 0;
}

export function inStock(entry: StockEntry): boolean {
  return isUnlimited(entry) || entry.qty > 0;
}

/** "12 gp · 3 left", or just the price when the supply is endless. */
export function describeStock(entry: StockEntry): string {
  const price = formatPrice(entry.price);
  return isUnlimited(entry) ? price : `${price} · ${entry.qty} left`;
}

/** Selling one. An unlimited entry never runs down. */
export function sellOne(stock: readonly StockEntry[], itemId: string): StockEntry[] {
  return stock.flatMap((e) => {
    if (e.itemId !== itemId || isUnlimited(e)) return [e];
    return e.qty <= 1 ? [] : [{ ...e, qty: e.qty - 1 }];
  });
}

export function makeNpcId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `npc-${slug || Date.now().toString(36)}`;
}

export function searchNpcs(npcs: readonly Npc[], text: string): Npc[] {
  const q = text.trim().toLowerCase();
  if (!q) return [...npcs];
  return npcs.filter(
    (n) =>
      n.name.toLowerCase().includes(q) ||
      n.role.toLowerCase().includes(q) ||
      n.notes.toLowerCase().includes(q),
  );
}
