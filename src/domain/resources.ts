/**
 * Class resources and their recharge tags.
 *
 * The bet the whole rest system rests on: a rest is "restore everything
 * carrying this tag", and class logic is data rather than a pile of
 * per-class branches. This file is the test of that bet — all twelve SRD
 * classes are tagged here, deliberately, long before the app supports twelve
 * classes. Three findings came out of writing it, and each is handled without
 * a code branch:
 *
 *   1. A bare tag does not cover hit dice. They return at HALF your total on
 *      a long rest, so recharge carries an amount as well as an occasion.
 *   2. A resource's recharge can CHANGE with level. The bard's Font of
 *      Inspiration flips Bardic Inspiration from long-rest to short-rest at
 *      level 5, so specs are level-gated variants rather than a single tag.
 *   3. Spell slots are not universally long-rest. Warlock pact slots come
 *      back on a short rest, so slots are modelled as a resource like any
 *      other rather than as a special case with an assumed occasion.
 *
 * Ranger and Rogue have no pool resources at all in the SRD, so the empty
 * case has to be legal — it is not a modelling failure, it is a class.
 */

import type { Ability } from "./abilities.js";

export type RechargeOn = "short" | "long" | "dawn" | "never";

export interface Recharge {
  readonly on: RechargeOn;
  /** Defaults to "all". Only hit dice use "half" (rounded down, minimum 1). */
  readonly amount?: "all" | "half";
}

/**
 * A short rest restores anything tagged "short"; a long rest restores that
 * AND anything tagged "long", because 5e's "short or long rest" wording means
 * a long rest is never worse than a short one. Keeping this in one predicate
 * stops that rule being re-derived — wrongly — at each call site.
 */
export function restoredBy(rest: "short" | "long", r: Recharge): boolean {
  if (r.on === "short") return true;
  if (r.on === "long") return rest === "long";
  return false;
}

export type ResourceMax =
  | { readonly kind: "fixed"; readonly value: number }
  /** Ki points, sorcery points: equal to the class level. */
  | { readonly kind: "classLevel" }
  /** Lay on Hands: a multiple of the class level. */
  | { readonly kind: "perClassLevel"; readonly per: number }
  /** Bardic Inspiration, Divine Sense: an ability modifier, floored. */
  | {
      readonly kind: "abilityMod";
      readonly ability: Ability;
      readonly plus?: number;
      readonly min?: number;
    }
  /** Rage, Channel Divinity, Action Surge: a step table by class level. */
  | { readonly kind: "byLevel"; readonly steps: readonly (readonly [number, number])[] };

export type DieSize = 4 | 6 | 8 | 10 | 12 | 20;

/** One resource, whose maximum and recharge may both change with level. */
export interface ResourceSpec {
  readonly id: string;
  readonly name: string;
  /** Superiority dice, hit dice: the pool is dice rather than points. */
  readonly die?: DieSize;
  /** Variants apply from minLevel upward; the highest match wins. */
  readonly at: readonly {
    readonly minLevel: number;
    readonly max: ResourceMax;
    readonly recharge: Recharge;
  }[];
  /** Free-text caveat the rules impose that the model deliberately ignores. */
  readonly caveat?: string;
}

export const CLASS_RESOURCES = {
  barbarian: [
    {
      id: "rage",
      name: "Rage",
      at: [
        {
          minLevel: 1,
          recharge: { on: "long" },
          max: {
            kind: "byLevel",
            steps: [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]],
          },
        },
      ],
    },
  ],

  bard: [
    {
      id: "bardicInspiration",
      name: "Bardic Inspiration",
      at: [
        {
          minLevel: 1,
          recharge: { on: "long" },
          max: { kind: "abilityMod", ability: "cha", min: 1 },
        },
        // Font of Inspiration. The occasion changes, the tag model does not.
        {
          minLevel: 5,
          recharge: { on: "short" },
          max: { kind: "abilityMod", ability: "cha", min: 1 },
        },
      ],
    },
  ],

  cleric: [
    {
      id: "channelDivinity",
      name: "Channel Divinity",
      at: [
        {
          minLevel: 2,
          recharge: { on: "short" },
          max: { kind: "byLevel", steps: [[2, 1], [6, 2], [18, 3]] },
        },
      ],
    },
    {
      id: "divineIntervention",
      name: "Divine Intervention",
      caveat: "On a success the rules impose a seven-day cooldown the app does not track.",
      at: [{ minLevel: 10, recharge: { on: "long" }, max: { kind: "fixed", value: 1 } }],
    },
  ],

  druid: [
    {
      id: "wildShape",
      name: "Wild Shape",
      at: [{ minLevel: 2, recharge: { on: "short" }, max: { kind: "fixed", value: 2 } }],
    },
    {
      id: "naturalRecovery",
      name: "Natural Recovery",
      at: [{ minLevel: 2, recharge: { on: "long" }, max: { kind: "fixed", value: 1 } }],
    },
  ],

  fighter: [
    {
      id: "secondWind",
      name: "Second Wind",
      at: [{ minLevel: 1, recharge: { on: "short" }, max: { kind: "fixed", value: 1 } }],
    },
    {
      id: "actionSurge",
      name: "Action Surge",
      at: [
        {
          minLevel: 2,
          recharge: { on: "short" },
          max: { kind: "byLevel", steps: [[2, 1], [17, 2]] },
        },
      ],
    },
    {
      id: "indomitable",
      name: "Indomitable",
      at: [
        {
          minLevel: 9,
          recharge: { on: "long" },
          max: { kind: "byLevel", steps: [[9, 1], [13, 2], [17, 3]] },
        },
      ],
    },
  ],

  monk: [
    {
      id: "ki",
      name: "Ki",
      at: [{ minLevel: 2, recharge: { on: "short" }, max: { kind: "classLevel" } }],
    },
  ],

  paladin: [
    {
      id: "layOnHands",
      name: "Lay on Hands",
      at: [
        { minLevel: 1, recharge: { on: "long" }, max: { kind: "perClassLevel", per: 5 } },
      ],
    },
    {
      id: "divineSense",
      name: "Divine Sense",
      at: [
        {
          minLevel: 1,
          recharge: { on: "long" },
          max: { kind: "abilityMod", ability: "cha", plus: 1, min: 1 },
        },
      ],
    },
    {
      id: "channelDivinity",
      name: "Channel Divinity",
      at: [{ minLevel: 3, recharge: { on: "short" }, max: { kind: "fixed", value: 1 } }],
    },
    {
      id: "cleansingTouch",
      name: "Cleansing Touch",
      at: [
        {
          minLevel: 14,
          recharge: { on: "long" },
          max: { kind: "abilityMod", ability: "cha", min: 1 },
        },
      ],
    },
  ],

  // Primeval Awareness spends a spell slot rather than a pool of its own.
  ranger: [],

  // Sneak Attack is once per turn, which is not a pool and is never tracked.
  rogue: [],

  sorcerer: [
    {
      id: "sorceryPoints",
      name: "Sorcery Points",
      at: [{ minLevel: 2, recharge: { on: "long" }, max: { kind: "classLevel" } }],
    },
  ],

  warlock: [
    {
      id: "mysticArcanum6",
      name: "Mystic Arcanum (6th)",
      at: [{ minLevel: 11, recharge: { on: "long" }, max: { kind: "fixed", value: 1 } }],
    },
    {
      id: "mysticArcanum7",
      name: "Mystic Arcanum (7th)",
      at: [{ minLevel: 13, recharge: { on: "long" }, max: { kind: "fixed", value: 1 } }],
    },
    {
      id: "mysticArcanum8",
      name: "Mystic Arcanum (8th)",
      at: [{ minLevel: 15, recharge: { on: "long" }, max: { kind: "fixed", value: 1 } }],
    },
    {
      id: "mysticArcanum9",
      name: "Mystic Arcanum (9th)",
      at: [{ minLevel: 17, recharge: { on: "long" }, max: { kind: "fixed", value: 1 } }],
    },
  ],

  wizard: [
    {
      id: "arcaneRecovery",
      name: "Arcane Recovery",
      at: [{ minLevel: 1, recharge: { on: "long" }, max: { kind: "fixed", value: 1 } }],
    },
  ],
} as const satisfies Record<string, readonly ResourceSpec[]>;

export type ClassId = keyof typeof CLASS_RESOURCES;
export const CLASS_IDS = Object.keys(CLASS_RESOURCES) as ClassId[];

/**
 * The catalog above is `as const` so CLASS_IDS stays exact, which also narrows
 * away fields no current entry uses — `die` has no dice-valued resource in the
 * SRD yet. Read through here to get the declared shape back.
 */
export function resourcesFor(classId: ClassId): readonly ResourceSpec[] {
  return CLASS_RESOURCES[classId];
}

/** Hit dice are a resource like any other — with the one non-"all" amount. */
export const HIT_DICE_RECHARGE: Recharge = { on: "long", amount: "half" };

/** The variant in force at a given class level, or null if not yet unlocked. */
export function specAt(
  spec: ResourceSpec,
  classLevel: number,
): { max: ResourceMax; recharge: Recharge } | null {
  let found: { max: ResourceMax; recharge: Recharge } | null = null;
  for (const v of spec.at) {
    if (classLevel >= v.minLevel) found = { max: v.max, recharge: v.recharge };
  }
  return found;
}

export function resolveMax(
  max: ResourceMax,
  classLevel: number,
  abilityMod: (a: Ability) => number,
): number {
  switch (max.kind) {
    case "fixed":
      return max.value;
    case "classLevel":
      return classLevel;
    case "perClassLevel":
      return classLevel * max.per;
    case "abilityMod":
      return Math.max(max.min ?? 0, abilityMod(max.ability) + (max.plus ?? 0));
    case "byLevel": {
      let value = 0;
      for (const [from, n] of max.steps) if (classLevel >= from) value = n;
      return value;
    }
  }
}

/**
 * How many uses come back, given a pool's size and what it recharges on.
 * Hit dice are the only caller that gets a partial answer.
 */
export function restoredAmount(max: number, r: Recharge): number {
  if (r.amount === "half") return Math.max(1, Math.floor(max / 2));
  return max;
}
