/**
 * Imported content, on this device.
 *
 * A compendium is CONTENT, not campaign state, so it never goes in the event
 * log: it is the same for everyone, it is tens of megabytes, and syncing it
 * through a Durable Object would be absurd. Each device imports its own,
 * exactly like the SRD data it sits alongside.
 *
 * Stored one kind per key rather than as a single blob. A complete compendium
 * is around 30MB parsed and the monsters are half of it — a player who wants
 * spells should not have to hold six thousand creatures to get them, and a
 * write that big is also a write that can fail halfway.
 */

import type { Item } from "../domain/items.js";
import type { Statblock } from "../domain/statblock.js";
import type {
  Compendium, CompendiumBackground, CompendiumClass, CompendiumFeat,
  CompendiumKind, CompendiumRace, CompendiumSpell,
} from "../import/compendium.js";
import { readMeta, writeMeta } from "./log.js";

export interface ContentMeta {
  readonly name: string;
  readonly importedAt: number;
  readonly counts: Partial<Record<CompendiumKind, number>>;
}

const META_KEY = "content:meta";
const key = (kind: CompendiumKind) => `content:${kind}`;

type RowsFor = {
  race: CompendiumRace;
  class: CompendiumClass;
  background: CompendiumBackground;
  feat: CompendiumFeat;
  spell: CompendiumSpell;
  item: Item;
  monster: Statblock;
};

/** Kept in memory once read, because the equipment picker asks constantly. */
const cache = new Map<CompendiumKind, unknown[]>();

export async function readContent<K extends CompendiumKind>(
  kind: K,
): Promise<RowsFor[K][]> {
  const hit = cache.get(kind);
  if (hit) return hit as RowsFor[K][];
  const rows = (await readMeta<RowsFor[K][]>(key(kind))) ?? [];
  cache.set(kind, rows);
  return rows;
}

export async function writeContent<K extends CompendiumKind>(
  kind: K,
  rows: readonly RowsFor[K][],
): Promise<void> {
  cache.set(kind, [...rows]);
  await writeMeta(key(kind), rows);
}

export async function readContentMeta(): Promise<ContentMeta | undefined> {
  return readMeta<ContentMeta>(META_KEY);
}

export async function writeContentMeta(meta: ContentMeta): Promise<void> {
  await writeMeta(META_KEY, meta);
}

export async function clearContent(kinds: readonly CompendiumKind[]): Promise<void> {
  for (const k of kinds) {
    cache.delete(k);
    await writeMeta(key(k), undefined);
  }
  await writeMeta(META_KEY, undefined);
}

/** Everything a compendium yielded, saved kind by kind. */
export async function saveCompendium(c: Compendium): Promise<ContentMeta> {
  const counts: Partial<Record<CompendiumKind, number>> = {};
  const pairs: [CompendiumKind, readonly unknown[]][] = [
    ["race", c.races], ["class", c.classes], ["background", c.backgrounds],
    ["feat", c.feats], ["spell", c.spells], ["item", c.items], ["monster", c.monsters],
  ];
  for (const [kind, rows] of pairs) {
    if (rows.length === 0) continue;
    await writeContent(kind as CompendiumKind, rows as never);
    counts[kind] = rows.length;
  }
  const meta: ContentMeta = { name: c.name, importedAt: c.importedAt, counts };
  await writeContentMeta(meta);
  return meta;
}

/**
 * Imported wins on a name collision, and that is deliberate: somebody who has
 * loaded a compendium meant it to be authoritative, and the SRD entry is the
 * one they were trying to replace. Ids are compared, not names, so an SRD
 * longsword and an imported longsword are the same item rather than two.
 */
export function mergeById<T extends { id: string }>(
  base: readonly T[],
  imported: readonly T[],
): T[] {
  if (imported.length === 0) return [...base];
  const out = new Map(base.map((x) => [x.id, x]));
  for (const x of imported) out.set(x.id, x);
  return [...out.values()];
}
