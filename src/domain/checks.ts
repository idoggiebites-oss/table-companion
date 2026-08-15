/**
 * The DM asking the table for a roll.
 *
 * "Everyone roll Perception" is the most common sentence at a table and the
 * one most likely to be lost in the noise — somebody is talking, somebody
 * missed it, somebody rolls the wrong thing. Asked through the app it arrives
 * on each player's screen with the modifier already worked out, and the
 * answers come back in one place.
 *
 * The DC is optional on purpose. "Roll Perception" and "beat a 15" are
 * different amounts of information, and which one the players get is the DM's
 * call rather than the app's.
 */

import type { CharacterId } from "./build.js";

export interface CheckRequest {
  readonly id: string;
  readonly who: readonly CharacterId[];
  readonly what: string;
  readonly kind: "skill" | "save" | "ability";
  readonly dc?: number;
  readonly note?: string;
  readonly answers: Readonly<Record<CharacterId, number>>;
  readonly at: number;
}

export function isAsked(check: CheckRequest, who: CharacterId): boolean {
  return check.who.includes(who);
}

export function hasAnswered(check: CheckRequest, who: CharacterId): boolean {
  return check.answers[who] !== undefined;
}

export function outstanding(check: CheckRequest): CharacterId[] {
  return check.who.filter((w) => check.answers[w] === undefined);
}

/** Only meaningful when a DC was given; otherwise the DM decides. */
export function passed(check: CheckRequest, who: CharacterId): boolean | null {
  const total = check.answers[who];
  if (total === undefined || check.dc === undefined) return null;
  return total >= check.dc;
}

export function describeAsk(check: CheckRequest): string {
  const label =
    check.kind === "save" ? `${check.what} save` : check.what;
  return check.dc === undefined ? label : `${label} · DC ${check.dc}`;
}
