/**
 * Attacks.
 *
 * The attack bonus is DERIVED, never stored. That is the whole point: when
 * proficiency goes from +3 to +4 at level 9, every attack on the sheet has to
 * move with it, and a stored number is a number that silently stays wrong for
 * months. The same is true of the damage line.
 *
 * Two cases the model has to carry properly because they are the ones people
 * get wrong by hand:
 *
 *   - Finesse takes the better of Strength and Dexterity, so it cannot be
 *     stored as one ability.
 *   - An off-hand attack adds no ability modifier to its damage, which is why
 *     damage carries a flag rather than assuming the modifier applies.
 */

import type { AttackRange } from "./stance.js";
import { formatModifier, type Ability } from "./abilities.js";
import type { DieSize } from "./resources.js";

/** Which ability swings it. "finesse" means the better of the two. */
export type AttackAbility = "str" | "dex" | "finesse";

export interface Attack {
  readonly name: string;
  readonly ability: AttackAbility;
  readonly proficient: boolean;
  /** A magic weapon's bonus, added to both the attack roll and the damage. */
  readonly bonus: number;
  readonly damage: {
    readonly count: number;
    readonly die: DieSize;
    /** Off-hand attacks add no ability modifier to damage. */
    readonly addAbility: boolean;
  };
  readonly damageType: string;
  readonly notes?: string;
  /**
   * Melee or ranged. The app needs it for exactly one question and it is a
   * question people get wrong: a prone target is easy to hit up close and
   * hard to hit from across the room. Absent means unknown, and unknown is
   * treated as melee — the commoner case, and the one a hand-typed attack on
   * a sheet almost always is.
   */
  readonly range?: AttackRange;
}

export interface ResolvedAttack {
  readonly name: string;
  readonly toHit: number;
  /** The ability that ended up being used, once finesse is settled. */
  readonly usedAbility: Ability;
  readonly damageFormula: string;
  readonly damageType: string;
  readonly notes?: string;
  readonly range?: AttackRange;
}

export function abilityFor(
  attack: Attack,
  mods: Record<Ability, number>,
): Ability {
  if (attack.ability !== "finesse") return attack.ability;
  return mods.dex >= mods.str ? "dex" : "str";
}

/** "1d8+4", "2d6", "1d6−1" — never a bare "+0". */
export function damageFormula(count: number, die: DieSize, flat: number): string {
  const dice = `${count}d${die}`;
  if (flat === 0) return dice;
  return `${dice}${flat < 0 ? "−" : "+"}${Math.abs(flat)}`;
}

export function resolveAttack(
  attack: Attack,
  mods: Record<Ability, number>,
  proficiencyBonus: number,
): ResolvedAttack {
  const used = abilityFor(attack, mods);
  const abilityMod = mods[used];
  const toHit = abilityMod + attack.bonus + (attack.proficient ? proficiencyBonus : 0);
  const flat = (attack.damage.addAbility ? abilityMod : 0) + attack.bonus;

  const base = {
    name: attack.name,
    toHit,
    usedAbility: used,
    damageFormula: damageFormula(attack.damage.count, attack.damage.die, flat),
    damageType: attack.damageType,
    ...(attack.range ? { range: attack.range } : {}),
  };
  return attack.notes === undefined ? base : { ...base, notes: attack.notes };
}

/** One line, the way a sheet prints it: "1d8+4 piercing · 150/600 ft". */
export function describeAttack(a: ResolvedAttack): string {
  const head = `${a.damageFormula} ${a.damageType}`;
  return a.notes ? `${head} · ${a.notes}` : head;
}

export function attackLabel(a: ResolvedAttack): string {
  return `${a.name} ${formatModifier(a.toHit)}`;
}
