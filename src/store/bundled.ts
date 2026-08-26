/**
 * Content shipped WITH the app, built from a compendium at deploy time.
 *
 * Same shapes as an import, arriving a different way: fetched like the SRD
 * data rather than fed through a file picker on every device. Four players
 * hand-loading the same 54MB file is a ritual, not a feature.
 *
 * Absent is normal. A deployment built without running build-compendium.mjs
 * has no /content at all, and every one of these resolves empty rather than
 * failing — the SRD is still there and the manual import still works.
 */

import type { Item } from "../domain/items.js";
import type { Statblock } from "../domain/statblock.js";
import type {
  ClassIndexRow, CompendiumBackground, CompendiumClass, CompendiumFeat,
  CompendiumKind, CompendiumRace, CompendiumSpell,
} from "../import/compendium.js";

export interface BundledIndex {
  readonly name: string;
  readonly builtAt: number;
  readonly counts: Partial<Record<CompendiumKind, number>>;
}

type RowsFor = {
  race: CompendiumRace;
  class: CompendiumClass;
  background: CompendiumBackground;
  feat: CompendiumFeat;
  spell: CompendiumSpell;
  item: Item;
  monster: Statblock;
};

const cache = new Map<string, Promise<unknown[]>>();

export function loadBundled<K extends CompendiumKind>(kind: K): Promise<RowsFor[K][]> {
  let hit = cache.get(kind);
  if (!hit) {
    hit = fetch(`/content/${kind}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<unknown[]>) : []))
      .catch(() => []);
    cache.set(kind, hit);
  }
  return hit as Promise<RowsFor[K][]>;
}

let classIdx: Promise<ClassIndexRow[] | null> | null = null;

/**
 * The classes, without their descriptions — names, levels and slots.
 *
 * Null means this deployment was built before the slim file existed, and the
 * caller falls back to the full one. Absent content is normal here (see the
 * note at the top) and "fall back to six megabytes" is the right failure:
 * slower, never wrong.
 */
export function loadBundledClassIndex(): Promise<ClassIndexRow[] | null> {
  classIdx ??= fetch("/content/class-index.json")
    .then((r) => (r.ok ? (r.json() as Promise<ClassIndexRow[]>) : null))
    .catch(() => null);
  return classIdx;
}

let index: Promise<BundledIndex | null> | null = null;

export function loadBundledIndex(): Promise<BundledIndex | null> {
  index ??= fetch("/content/index.json")
    .then((r) => (r.ok ? (r.json() as Promise<BundledIndex>) : null))
    .catch(() => null);
  return index;
}
