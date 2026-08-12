/**
 * Edition is a property of the campaign, not of the app.
 *
 * The divergence between the 2014 and 2024 rules is small and bounded for
 * everything this app actually tracks. It is concentrated here so that
 * nothing else in the domain ever branches on edition — the rest of the code
 * asks this module for a rule and gets data back.
 *
 * v1 ships 2014 / SRD 5.1. The 2024 tables below are written and exercised by
 * the tests but read by nothing else: they are the seam guard. If a 2024 rule
 * ever fails to fit these shapes without changing them, the abstraction is
 * wrong and this is the cheap moment to find out.
 */

export const EDITIONS = ["2014", "2024"] as const;
export type Edition = (typeof EDITIONS)[number];

/**
 * Every exhaustion effect either editions expresses, as data.
 *
 * 2014 gives each level a distinct effect; 2024 replaced that with a flat
 * penalty that stacks. Both are describable with the same fields, which is
 * the whole point — exhaustion is stored as an integer level and the effects
 * are resolved, never baked into an enum.
 */
export interface ExhaustionEffect {
  readonly level: number;
  /** 2024: −2 per level, applied to every d20 test. */
  readonly d20Penalty?: number;
  /** 2024: −5 ft per level. */
  readonly speedPenaltyFeet?: number;
  /** 2014 level 2: speed halved. */
  readonly speedMultiplier?: number;
  /** 2014 level 4: hit point maximum halved. */
  readonly hpMaxMultiplier?: number;
  readonly disadvantage?: readonly ("abilityChecks" | "attacks" | "saves")[];
  readonly speedZero?: boolean;
  readonly death?: boolean;
}

const EXHAUSTION_2014: readonly ExhaustionEffect[] = [
  { level: 1, disadvantage: ["abilityChecks"] },
  { level: 2, speedMultiplier: 0.5 },
  { level: 3, disadvantage: ["attacks", "saves"] },
  { level: 4, hpMaxMultiplier: 0.5 },
  { level: 5, speedZero: true },
  { level: 6, death: true },
];

const EXHAUSTION_2024: readonly ExhaustionEffect[] = [
  { level: 1, d20Penalty: -2, speedPenaltyFeet: -5 },
  { level: 2, d20Penalty: -4, speedPenaltyFeet: -10 },
  { level: 3, d20Penalty: -6, speedPenaltyFeet: -15 },
  { level: 4, d20Penalty: -8, speedPenaltyFeet: -20 },
  { level: 5, d20Penalty: -10, speedPenaltyFeet: -25 },
  { level: 6, death: true },
];

/**
 * Condition identifiers are data, not a union type, so a content pack can
 * add or rename one without a compile error rippling through the codebase.
 */
const CONDITIONS_2014 = [
  "blinded", "charmed", "deafened", "frightened", "grappled",
  "incapacitated", "invisible", "paralyzed", "petrified", "poisoned",
  "prone", "restrained", "stunned", "unconscious",
] as const;

const CONDITIONS_2024 = CONDITIONS_2014;

export type ConditionId = string;

export interface EditionRules {
  readonly edition: Edition;
  readonly exhaustion: readonly ExhaustionEffect[];
  readonly conditions: readonly ConditionId[];
  /** Exhaustion levels beyond this are not representable. */
  readonly maxExhaustion: number;
  /** 2024 only. Absent rather than empty so its absence is meaningful. */
  readonly weaponMastery?: boolean;
}

const RULES: Record<Edition, EditionRules> = {
  "2014": {
    edition: "2014",
    exhaustion: EXHAUSTION_2014,
    conditions: CONDITIONS_2014,
    maxExhaustion: 6,
  },
  "2024": {
    edition: "2024",
    exhaustion: EXHAUSTION_2024,
    conditions: CONDITIONS_2024,
    maxExhaustion: 6,
    weaponMastery: true,
  },
};

export function rulesFor(edition: Edition): EditionRules {
  return RULES[edition];
}

/** Cumulative effect of a given exhaustion level, or null at level 0. */
export function exhaustionAt(
  edition: Edition,
  level: number,
): ExhaustionEffect | null {
  if (level <= 0) return null;
  const table = rulesFor(edition).exhaustion;
  const capped = Math.min(level, table.length);
  return table[capped - 1] ?? null;
}

export function isKnownCondition(edition: Edition, id: ConditionId): boolean {
  return rulesFor(edition).conditions.includes(id);
}
