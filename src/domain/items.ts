/**
 * Items, and what a character is carrying.
 *
 * Two shapes, deliberately separate:
 *
 *   - `Item` is a CATALOGUE record — the SRD's longsword, the same for
 *     everyone, loaded from data and never written to.
 *   - `Stack` is what a character actually has. It carries the item's name
 *     alongside its id, which is denormalisation on purpose: the DM hands out
 *     "a tarnished key" that is in no catalogue, and a log replayed on a
 *     device that has not loaded the equipment file still has to be readable.
 *     A stack that can only be understood by joining against data the device
 *     might not have is a stack that shows up blank at the wrong moment.
 *
 * What is equipped is a SET of item ids held apart from quantities, rather
 * than a flag on the stack. Equipping does not change how many you own, and
 * making it a flag forces a stack of two daggers to split the moment one is
 * drawn — which then has to merge again on sheathing, and stops merging
 * correctly the first time one of them picks up a note.
 */

export type ItemCategory =
  | "weapon"
  | "armor"
  | "adventuring-gear"
  | "tools"
  | "mounts-and-vehicles";

/** A weapon property, lowercased: finesse, versatile, two-handed, thrown… */
export type WeaponProperty = string;

export interface Item {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  /** In copper. See money.ts for why nothing here is a decimal. */
  readonly cost: number;
  readonly weight?: number;

  // weapons
  readonly weaponRange?: "Melee" | "Ranged";
  readonly weaponCategory?: "Simple" | "Martial";
  readonly damage?: string;
  readonly damageType?: string;
  /** Versatile: the die when it is swung in two hands. */
  readonly twoHanded?: string;
  readonly properties?: readonly WeaponProperty[];
  readonly range?: { readonly normal: number; readonly long?: number };

  // armour
  readonly armorCategory?: "Light" | "Medium" | "Heavy" | "Shield";
  readonly baseAc?: number;
  readonly dexBonus?: boolean;
  /** Medium armour caps dexterity at +2. Absent means uncapped. */
  readonly maxDex?: number;
  readonly strMinimum?: number;
  readonly stealthDisadvantage?: boolean;
}

export interface Stack {
  readonly itemId: string;
  /** Denormalised so a granted item survives without the catalogue. */
  readonly name: string;
  readonly qty: number;
  /** What makes one of a kind different from another — "+1", "cracked". */
  readonly note?: string;
}

export type Catalogue = Readonly<Record<string, Item>>;

export function indexItems(items: readonly Item[]): Catalogue {
  return Object.fromEntries(items.map((i) => [i.id, i]));
}

/** Same item AND same note stack together; a noted one stays its own thing. */
function same(a: Stack, b: { itemId: string; note?: string }): boolean {
  return a.itemId === b.itemId && (a.note ?? "") === (b.note ?? "");
}

export function addItem(inv: readonly Stack[], add: Stack): Stack[] {
  if (add.qty <= 0) return [...inv];
  const at = inv.findIndex((s) => same(s, add));
  if (at === -1) return [...inv, add];
  return inv.map((s, i) => (i === at ? { ...s, qty: s.qty + add.qty } : s));
}

/** Removing more than is held empties the stack rather than going negative. */
export function removeItem(
  inv: readonly Stack[],
  itemId: string,
  qty = 1,
  note?: string,
): Stack[] {
  const at = inv.findIndex((s) => same(s, { itemId, ...(note === undefined ? {} : { note }) }));
  if (at === -1) return [...inv];
  const held = inv[at]!;
  if (held.qty <= qty) return inv.filter((_, i) => i !== at);
  return inv.map((s, i) => (i === at ? { ...s, qty: s.qty - qty } : s));
}

export function countOf(inv: readonly Stack[], itemId: string): number {
  return inv.filter((s) => s.itemId === itemId).reduce((n, s) => n + s.qty, 0);
}

/**
 * Equipping something you no longer carry is the failure this prevents: sell
 * your armour and the AC has to fall with it, so what is equipped is filtered
 * against what is held rather than trusted.
 */
export function equippedItems(
  inv: readonly Stack[],
  equipped: readonly string[],
  catalogue: Catalogue,
): Item[] {
  return equipped
    .filter((id) => countOf(inv, id) > 0)
    .map((id) => catalogue[id])
    .filter((i): i is Item => i !== undefined);
}

export function isWeapon(i: Item): boolean {
  return i.category === "weapon";
}

export function isArmour(i: Item): boolean {
  return i.category === "armor" && i.armorCategory !== "Shield";
}

export function isShield(i: Item): boolean {
  return i.armorCategory === "Shield";
}

export function hasProperty(i: Item, p: WeaponProperty): boolean {
  return (i.properties ?? []).includes(p);
}

/** Catalogue search for the add-an-item field and the trader's shelf. */
export function searchItems(
  items: readonly Item[],
  { text, category, maxCost }: {
    text?: string;
    category?: string;
    maxCost?: number;
  },
): Item[] {
  const q = text?.trim().toLowerCase();
  return items.filter((i) => {
    if (q && !i.name.toLowerCase().includes(q)) return false;
    if (category && i.category !== category) return false;
    if (maxCost !== undefined && i.cost > maxCost) return false;
    return true;
  });
}
