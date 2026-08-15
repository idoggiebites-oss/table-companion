/**
 * An attack, from the swing to the damage landing.
 *
 * A player rolls their own dice and types what they got; the DM decides
 * whether it lands. That is how a table already works — "eighteen to hit,
 * seven damage" / "yeah, that hits" — and it is the only division that keeps
 * the disclosure ladder intact. A player who could apply damage themselves
 * would learn a creature's armour class by trial, and one who was told
 * "that misses" by the app would learn it in one go.
 *
 * So an attack becomes a CLAIM: everything the player knows, sent across, and
 * nothing resolved until the DM says so. The claim carries both numbers
 * because tables roll to-hit and damage together, and asking twice would put
 * a round trip in the middle of somebody's turn.
 *
 * The verdict is suggested, never taken. The DM's screen knows the armour
 * class and says "18 against 15 — that hits", which is one tap to confirm and
 * still one tap to overrule when a shield spell or a cover rule the app has
 * never heard of says otherwise.
 */

import type { CharacterId } from "./build.js";

export interface AttackClaim {
  readonly id: string;
  readonly who: CharacterId;
  /** Denormalised: the log has to read after the fight is long over. */
  readonly whoName: string;
  readonly targetId: string;
  readonly targetName: string;
  readonly weapon: string;
  /** What the player rolled, with their modifier already in it. */
  readonly toHit: number;
  readonly damage: number;
  readonly damageType: string;
  readonly at: number;
}

export type Verdict = "hits" | "misses" | "unknown";

/**
 * What the DM's screen suggests. Unknown when the app has no armour class for
 * the target — an ad-hoc creature typed in mid-fight has none, and guessing
 * would be worse than asking.
 */
export function verdictFor(toHit: number, ac: number | undefined): Verdict {
  if (ac === undefined) return "unknown";
  return toHit >= ac ? "hits" : "misses";
}

export function describeVerdict(toHit: number, ac: number | undefined): string {
  const verdict = verdictFor(toHit, ac);
  if (verdict === "unknown") return `${toHit} to hit`;
  return `${toHit} against ${ac} — ${verdict}`;
}

export function claimsAgainst(
  claims: readonly AttackClaim[],
  targetId: string,
): AttackClaim[] {
  return claims.filter((c) => c.targetId === targetId);
}

export function claimsFrom(
  claims: readonly AttackClaim[],
  who: CharacterId,
): AttackClaim[] {
  return claims.filter((c) => c.who === who);
}

/** Oldest first, so a queue is answered in the order it arrived. */
export function sortClaims(claims: readonly AttackClaim[]): AttackClaim[] {
  return [...claims].sort((a, b) => a.at - b.at);
}
