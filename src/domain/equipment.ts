/**
 * What being equipped actually does to the numbers.
 *
 * Armour class is derived only as far as it can honestly be derived. Equipping
 * plate gives 18 and that is not in dispute — but a monk's unarmoured defence,
 * a draconic sorcerer's scales and every imported sheet's bracers are AC rules
 * this app does not model, and recomputing from 10 + dex would silently strip
 * them. So the stored value is the floor of the calculation, not a thing to be
 * replaced:
 *
 *   - body armour worn → its formula wins, since it explicitly overrides
 *     whatever unarmoured rule you had
 *   - shield only      → +2 on top of the stored value, which is what a shield
 *     does to a monk and to a paladin alike
 *   - nothing          → the stored value, untouched
 *
 * Attacks are derived the other way round: entirely, and from the weapon. The
 * SRD carries the die, the type and the properties that decide HOW you roll,
 * so a longsword on a sheet should never be a number somebody typed.
 */

import {
  hasProperty, isArmour, isShield, isWeapon, type Item,
} from "./items.js";
import type { Attack } from "./attack.js";
import type { DieSize } from "./resources.js";

export interface ArmourClass {
  readonly value: number;
  /** Readable derivation — the sheet shows this rather than a bare number. */
  readonly from: string;
  /** Heavy armour you lack the Strength for costs 10 feet of speed. */
  readonly speedPenalty: number;
  readonly stealthDisadvantage: boolean;
}

export function armourClass(
  equipped: readonly Item[],
  dexMod: number,
  storedAc: number,
  strengthScore: number,
): ArmourClass {
  const body = equipped.find(isArmour);
  const shield = equipped.find(isShield);
  const shieldAc = shield?.baseAc ?? 0;

  let value: number;
  let from: string;

  if (body) {
    const base = body.baseAc ?? 10;
    const dex = body.dexBonus
      ? body.maxDex === undefined
        ? dexMod
        : Math.min(dexMod, body.maxDex)
      : 0;
    value = base + dex + shieldAc;
    from = `${body.name} ${base}${dex === 0 ? "" : ` + dex ${dex >= 0 ? "+" : "−"}${Math.abs(dex)}`}`;
    // A capped bonus is worth saying: it is the most common reason a player's
    // own arithmetic disagrees with the sheet.
    if (body.dexBonus && body.maxDex !== undefined && dexMod > body.maxDex) {
      from += ` (dex capped at +${body.maxDex})`;
    }
  } else {
    value = storedAc + shieldAc;
    from = shield ? `${storedAc} unarmoured` : "unarmoured";
  }

  if (shield) from += ` + ${shield.name} ${shieldAc}`;

  const short = body?.strMinimum !== undefined && strengthScore < body.strMinimum;

  return {
    value,
    from,
    speedPenalty: short ? 10 : 0,
    stealthDisadvantage: equipped.some((i) => i.stealthDisadvantage === true),
  };
}

/** "1d8" → {count: 1, die: 8}. Anything unparseable is treated as 1d4. */
export function parseDamage(dice: string | undefined): { count: number; die: DieSize } {
  const m = /^(\d+)d(\d+)$/.exec((dice ?? "").trim());
  if (!m) return { count: 1, die: 4 as DieSize };
  return { count: Number(m[1]), die: Number(m[2]) as DieSize };
}

/**
 * Whether the character can add proficiency. An EMPTY list means unknown, not
 * "none": an imported sheet rarely records weapon proficiencies, and assuming
 * the character is unproficient would quietly drop every attack by two to six
 * points. Unknown is treated as proficient — visible and wrong beats invisible
 * and wrong.
 */
export function proficientWith(
  item: Item,
  proficiencies: readonly string[] | undefined,
): boolean {
  if (!proficiencies || proficiencies.length === 0) return true;
  const has = (needle: string) =>
    proficiencies.some((p) => p.toLowerCase().includes(needle));
  if (has(item.name.toLowerCase())) return true;
  if (item.weaponCategory === "Simple" && has("simple weapon")) return true;
  if (item.weaponCategory === "Martial" && has("martial weapon")) return true;
  return false;
}

/**
 * A weapon becomes an attack. Which ability swings it is a property of the
 * weapon, not a choice: finesse defers to whichever of Strength and Dexterity
 * is better, and a bow is Dexterity whatever your arms look like.
 */
export function attackFromWeapon(
  item: Item,
  proficiencies?: readonly string[],
  { offHand = false, bonus = 0 }: { offHand?: boolean; bonus?: number } = {},
): Attack {
  const ability: Attack["ability"] = hasProperty(item, "finesse")
    ? "finesse"
    : item.weaponRange === "Ranged"
      ? "dex"
      : "str";
  const { count, die } = parseDamage(item.damage);

  const notes: string[] = [];
  if (item.twoHanded) notes.push(`${item.twoHanded} in two hands`);
  if (hasProperty(item, "thrown") && item.range) {
    notes.push(`thrown ${item.range.normal}/${item.range.long ?? item.range.normal} ft`);
  } else if (item.weaponRange === "Ranged" && item.range) {
    notes.push(`${item.range.normal}/${item.range.long ?? item.range.normal} ft`);
  }
  if (hasProperty(item, "ammunition")) notes.push("needs ammunition");
  if (offHand) notes.push("off hand");

  return {
    name: item.name,
    ability,
    proficient: proficientWith(item, proficiencies),
    bonus,
    damage: { count, die, addAbility: !offHand },
    damageType: item.damageType ?? "bludgeoning",
    range: item.weaponRange === "Ranged" ? "ranged" : "melee",
    ...(notes.length > 0 ? { notes: notes.join(" · ") } : {}),
  };
}

/** Every equipped weapon, in the order they were equipped. */
export function attacksFromEquipment(
  equipped: readonly Item[],
  proficiencies?: readonly string[],
): Attack[] {
  return equipped.filter(isWeapon).map((w) => attackFromWeapon(w, proficiencies));
}
