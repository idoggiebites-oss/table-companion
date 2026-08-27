/**
 * A thing the DM made up, that the app reads as a thing.
 *
 * The homebrew tool could only ever make creatures, so a magic sword existed
 * as a line in somebody's notes: it could not be carried, equipped, swung,
 * priced, or sold, and the app had no idea it was a weapon. The point of this
 * file is that it produces the SAME shape the catalogue produces — not a
 * parallel "custom item" type with its own half of the rules — so everything
 * downstream works without being told about homebrew at all.
 *
 * That is the whole test: equip it and the armour class moves; swing it and
 * the damage is right; give it "versatile" and both grips appear; put it on a
 * shelf and it can run out. None of those code paths know this file exists.
 *
 * What the form asks for is what the shape needs and nothing more. A DM
 * writing a sword at eleven at night is not going to fill in a weight they
 * will never read — so weight is optional and the fields that ARE required
 * are the ones the rules read.
 */

import type { Item, WeaponProperty } from "./items.js";

/** What sort of thing this is, which decides what the rules read off it. */
export type HomebrewKind = "weapon" | "armour" | "shield" | "gear";

/**
 * The properties that change what the app does, rather than what it prints.
 *
 * Only these five, because the others are flavour the app does not act on and
 * a list of fourteen checkboxes is a form nobody finishes. Each one here
 * changes a number somewhere:
 *
 * - finesse and thrown pick which ability swings it
 * - versatile turns on the second damage die
 * - two-handed empties the other hand
 * - ammunition is the one that is only a note, and is here because a bow
 *   without it looks like an oversight rather than a decision
 */
export const HOMEBREW_PROPERTIES: readonly WeaponProperty[] = [
  "finesse", "thrown", "versatile", "two-handed", "ammunition",
];

export interface HomebrewItemDraft {
  readonly id?: string;
  readonly name: string;
  readonly kind: HomebrewKind;
  /** Copper, like everything else. See money.ts. */
  readonly cost: number;
  readonly weight?: number;
  /** Rarity, or a short qualifier — the same field the catalogue uses. */
  readonly detail?: string;
  readonly magic?: boolean;

  // weapon
  readonly damage?: string;
  readonly damageType?: string;
  readonly twoHanded?: string;
  readonly ranged?: boolean;
  readonly martial?: boolean;
  readonly properties?: readonly WeaponProperty[];
  readonly rangeNormal?: number;
  readonly rangeLong?: number;

  // armour
  readonly armourWeight?: "Light" | "Medium" | "Heavy";
  readonly baseAc?: number;
  readonly stealthDisadvantage?: boolean;
  readonly strMinimum?: number;
}

/** A stable id from the name, so saving the same thing twice edits it. */
export function homebrewItemId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `hb-${slug || Date.now().toString(36)}`;
}

/**
 * Turn a draft into a catalogue item.
 *
 * Every branch here exists because some rule reads the field. `category` is
 * what isWeapon and isArmour look at; `armorCategory: "Shield"` is the only
 * thing that makes a shield a shield; `dexBonus` and `maxDex` are what make
 * medium armour cap at +2 rather than silently uncapping.
 *
 * A name is marked "(HB)" so provenance survives — the same marker imported
 * homebrew carries, so the same filters hide it and the same badge shows it.
 * Marked once: re-saving an edited item must not produce "Sword (HB) (HB)".
 */
export function toItem(draft: HomebrewItemDraft): Item {
  const name = /\(HB\)\s*$/i.test(draft.name.trim())
    ? draft.name.trim()
    : `${draft.name.trim()} (HB)`;

  const base = {
    id: draft.id ?? homebrewItemId(draft.name),
    name,
    cost: Math.max(0, Math.round(draft.cost)),
    ...(draft.weight !== undefined && draft.weight > 0 ? { weight: draft.weight } : {}),
    ...(draft.detail?.trim() ? { detail: draft.detail.trim() } : {}),
    ...(draft.magic ? { magic: true as const } : {}),
  };

  if (draft.kind === "weapon") {
    const props = draft.properties ?? [];
    return {
      ...base,
      category: "weapon",
      weaponRange: draft.ranged ? "Ranged" : "Melee",
      weaponCategory: draft.martial ? "Martial" : "Simple",
      damage: draft.damage?.trim() || "1d4",
      damageType: draft.damageType?.trim() || "bludgeoning",
      /*
       * Only when it is actually versatile. A twoHanded die on a weapon
       * without the property would put a second grip on the sheet that the
       * item does not have.
       */
      ...(props.includes("versatile") && draft.twoHanded?.trim()
        ? { twoHanded: draft.twoHanded.trim() }
        : {}),
      ...(props.length > 0 ? { properties: [...props] } : {}),
      ...(draft.rangeNormal
        ? {
            range: {
              normal: draft.rangeNormal,
              ...(draft.rangeLong ? { long: draft.rangeLong } : {}),
            },
          }
        : {}),
    };
  }

  if (draft.kind === "shield") {
    return {
      ...base,
      category: "armor",
      armorCategory: "Shield",
      // A shield's baseAc is what it ADDS, which is why 2 is the default.
      baseAc: draft.baseAc ?? 2,
    };
  }

  if (draft.kind === "armour") {
    const weight = draft.armourWeight ?? "Light";
    return {
      ...base,
      category: "armor",
      armorCategory: weight,
      baseAc: draft.baseAc ?? 11,
      // Heavy armour ignores dexterity entirely; medium caps it at +2.
      dexBonus: weight !== "Heavy",
      ...(weight === "Medium" ? { maxDex: 2 } : {}),
      ...(draft.strMinimum ? { strMinimum: draft.strMinimum } : {}),
      ...(draft.stealthDisadvantage ? { stealthDisadvantage: true } : {}),
    };
  }

  return { ...base, category: "adventuring-gear" };
}

/**
 * Back to a draft, so an item can be edited rather than retyped.
 *
 * The marker comes off for editing and goes back on when saved — a DM should
 * see the name they typed, not the app's bookkeeping.
 */
export function toDraft(item: Item): HomebrewItemDraft {
  const kind: HomebrewKind =
    item.category === "weapon"
      ? "weapon"
      : item.armorCategory === "Shield"
        ? "shield"
        : item.category === "armor"
          ? "armour"
          : "gear";
  return {
    id: item.id,
    name: item.name.replace(/\s*\(HB\)\s*$/i, ""),
    kind,
    cost: item.cost,
    ...(item.weight !== undefined ? { weight: item.weight } : {}),
    ...(item.detail ? { detail: item.detail } : {}),
    ...(item.magic ? { magic: true } : {}),
    ...(item.damage ? { damage: item.damage } : {}),
    ...(item.damageType ? { damageType: item.damageType } : {}),
    ...(item.twoHanded ? { twoHanded: item.twoHanded } : {}),
    ...(item.weaponRange === "Ranged" ? { ranged: true } : {}),
    ...(item.weaponCategory === "Martial" ? { martial: true } : {}),
    ...(item.properties ? { properties: [...item.properties] } : {}),
    ...(item.range ? { rangeNormal: item.range.normal } : {}),
    ...(item.range?.long ? { rangeLong: item.range.long } : {}),
    ...(kind === "armour" && item.armorCategory && item.armorCategory !== "Shield"
      ? { armourWeight: item.armorCategory }
      : {}),
    ...(item.baseAc !== undefined ? { baseAc: item.baseAc } : {}),
    ...(item.stealthDisadvantage ? { stealthDisadvantage: true } : {}),
    ...(item.strMinimum ? { strMinimum: item.strMinimum } : {}),
  };
}
