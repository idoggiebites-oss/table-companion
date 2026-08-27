/**
 * What a spell is FOR, in one word.
 *
 * "Faerie Fire" and "Fog Cloud" mean nothing to somebody choosing their first
 * cantrips, and reading twenty descriptions to find the one that does damage
 * is not a choice, it is homework. A tag says which pile a spell is in before
 * you read a word of it, and lets the list be filtered down to the pile you
 * came for.
 *
 * Derived, not authored. Three thousand spells is far too many to label by
 * hand, and a hand-labelled list would be wrong the moment somebody imported
 * their own. The file already says all of this: <roll> carries "Fire Damage"
 * or "Heal", and the conditions are named in the text in near-boilerplate
 * wording.
 *
 * A spell can be more than one thing — Spirit Guardians damages and slows —
 * so this returns every role that applies, most consequential first. Filtering
 * on "Damage" should find it.
 */

export type SpellRole = "damage" | "healing" | "control" | "utility";

export interface RoleSource {
  readonly name: string;
  readonly text: string;
  readonly rolls?: readonly { readonly description: string; readonly dice: string }[];
}

/**
 * The conditions, plus the two phrasings that mean "it cannot act" without
 * naming one. Taking somebody's turn away is control whatever it is called.
 */
const CONTROLLING = new RegExp(
  [
    "paralyz(?:ed|es)", "restrain(?:ed|s)", "frighten(?:ed|s)", "charm(?:ed|s)",
    "stunn(?:ed|s)", "knocked prone", "falls? prone", "incapacitated",
    "blind(?:ed|s)", "deafen(?:ed|s)", "poison(?:ed|s)", "grappl(?:ed|es)",
    "unconscious", "petrifi(?:ed|es)", "put to sleep", "fall(?:s)? asleep",
    "speed becomes 0", "can'?t move", "cannot move",
    "difficult terrain", "pushed", "banish(?:ed|es)",
  ].join("|"),
  "i",
);

/** "…regains 2d8 hit points", "you restore hit points". */
const HEALING = /regains?\b[^.]{0,60}\bhit points|restore[sd]?\b[^.]{0,40}\bhit points|healing/i;

/**
 * The same words, negated — which is a curse rather than a cure.
 *
 * Chill Touch says the target "can't regain hit points" and was filed under
 * healing, where it sat in a list of cures with a green label on it. Necrotic
 * damage that BLOCKS healing is the opposite of the thing it was matched
 * against, and the phrasing is near-boilerplate across the book.
 */
const NOT_HEALING =
  /\b(can(?:'|’)?t|cannot|unable to|prevented from|does(?:n(?:'|’)?t| not))\b[^.]{0,40}\b(regain|restore|heal)/i;

export function rolesOf(spell: RoleSource): SpellRole[] {
  const text = spell.text ?? "";
  const rolls = spell.rolls ?? [];
  const out: SpellRole[] = [];

  /*
   * The <roll> descriptions are the strongest signal there is: "Fire Damage",
   * "Heal". They are structured rather than prose, so they come first.
   */
  const says = (re: RegExp) => rolls.some((r) => re.test(r.description ?? ""));
  if (says(/damage/i)) out.push("damage");
  if ((says(/heal/i) || HEALING.test(text)) && !NOT_HEALING.test(text)) out.push("healing");

  // Only fall back to the text where the file gave no dice to read.
  if (!out.includes("damage") && /\b\d+d\d+\b[^.]{0,40}damage|deals?\b[^.]{0,30}damage/i.test(text)) {
    out.push("damage");
  }

  if (CONTROLLING.test(text)) out.push("control");

  // Everything is for something. A spell that is none of the above is the
  // large and genuinely useful remainder rather than a gap in the rules.
  return out.length > 0 ? out : ["utility"];
}

/** The one a chip should show, when there is only room for one. */
export function primaryRole(spell: RoleSource): SpellRole {
  return rolesOf(spell)[0]!;
}

export const ROLE_ORDER: readonly SpellRole[] = ["damage", "healing", "control", "utility"];

export const ROLE_LABEL: Readonly<Record<SpellRole, string>> = {
  damage: "Damage",
  healing: "Healing",
  control: "Control",
  utility: "Utility",
};
