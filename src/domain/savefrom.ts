/**
 * Reading a saving throw off a monster's action.
 *
 * A breath weapon is not an attack roll. "Each creature in that line must
 * make a DC 18 Dexterity saving throw, taking 54 (12d8) acid damage on a
 * failed save, or half as much damage on a successful one" has no to-hit in
 * it at all — and the fight offered one anyway, because tapping an action
 * led to the swing walkthrough whatever the action was. Four thousand of the
 * twenty thousand actions in the compendium ask for a save; 2,665 of them ask
 * for nothing else.
 *
 * The sentence is near-boilerplate, which is what makes reading it safe. What
 * is NOT read is where the line falls or who is in it — that is the table's,
 * and law four says so. The app supplies the number, the ability and what a
 * success costs; the DM says who was caught.
 *
 * Anything unrecognised returns null and the old behaviour stands. A wrong
 * save is worse than no save, so the parse is deliberately narrow: it wants
 * the exact shape the books print.
 */

import type { Ability } from "./abilities.js";

export interface ActionSave {
  readonly ability: Ability;
  readonly dc: number;
  /** True when a success halves it; false when a success avoids it entirely. */
  readonly half: boolean;
  /** "12d8", when the text states dice. Absent for a save with no damage. */
  readonly dice?: string;
  readonly damageType?: string;
  /** The average the book prints, for a DM who does not want to roll it. */
  readonly average?: number;
}

const ABILITY: Readonly<Record<string, Ability>> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

/**
 * The one shape every printed save shares: a DC, an ability, the words
 * "saving throw". Everything after that is optional detail.
 */
const SAVE = /DC\s*(\d+)\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving\s+throw/i;

/** "54 (12d8) acid damage" — the average, the dice, and what kind. */
const DAMAGE = /(?:(\d+)\s*\()?\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*\)?\s*([a-z]+)?\s*damage/i;

export function saveFromAction(
  action: { readonly name?: string; readonly desc?: string; readonly damage?: readonly { readonly dice: string; readonly type?: string }[] },
): ActionSave | null {
  const text = action.desc ?? "";
  const m = SAVE.exec(text);
  if (!m) return null;
  const ability = ABILITY[m[2]!.toLowerCase()];
  if (!ability) return null;

  /*
   * "half as much damage on a successful one" is the common phrasing; "half
   * damage" and "takes half" appear too. Absent, a success avoids it — which
   * is the rule's default and the safer way to be wrong, since it never
   * takes hit points off somebody who should have kept them.
   */
  const half = /half\s+(?:as much\s+)?damage|takes?\s+half/i.test(text);

  const d = DAMAGE.exec(text);
  const dice = d?.[2]?.replace(/\s+/g, "") ?? action.damage?.[0]?.dice;
  const damageType = d?.[3]?.toLowerCase() ?? action.damage?.[0]?.type?.toLowerCase();
  const average = d?.[1] ? Number(d[1]) : undefined;

  return {
    ability,
    dc: Number(m[1]),
    half,
    ...(dice ? { dice } : {}),
    ...(damageType ? { damageType } : {}),
    ...(average !== undefined ? { average } : {}),
  };
}

/** The sentence a DM reads out, from the app's side of it. */
export function describeSave(save: ActionSave, name: string): string {
  const dmg = save.dice
    ? `${save.average !== undefined ? `${save.average} (${save.dice})` : save.dice}${save.damageType ? ` ${save.damageType}` : ""}`
    : null;
  const cost = save.half ? "half on a save" : "nothing on a save";
  return dmg
    ? `${name}: DC ${save.dc} ${save.ability.toUpperCase()}, ${dmg}, ${cost}.`
    : `${name}: DC ${save.dc} ${save.ability.toUpperCase()}.`;
}
