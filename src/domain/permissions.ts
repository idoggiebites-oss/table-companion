/**
 * Who may change what.
 *
 * This is NOT a security boundary. Everyone holding a room token is a person
 * at the table, and the log is trusted among them — a member who wanted to
 * forge an event could. What this prevents is accidents and confusion: the
 * wrong sheet edited, two people applying the same hit, a player quietly
 * topping up their own hit points without anyone seeing.
 *
 * The default is deliberate. The DM applies damage and healing to anyone,
 * because waiting for a player to find the right field mid-combat is slower
 * than the DM typing it while narrating, and speed is the point. That is only
 * acceptable because every change is attributed and reversible — see the
 * action feed.
 */

import type { CharacterId } from "./build.js";
import type { Seat } from "./combat.js";

export interface TableRules {
  /** When false, only a character's own player may change their sheet. */
  readonly dmMayEditCharacters: boolean;
}

export const DEFAULT_RULES: TableRules = { dmMayEditCharacters: true };

export function mayEditCharacter(
  seat: Seat,
  characterId: CharacterId,
  rules: TableRules = DEFAULT_RULES,
): boolean {
  if (seat.kind === "player") return seat.characterId === characterId;
  return rules.dmMayEditCharacters;
}

/** Creatures are the DM's, always — a player rolls damage, the DM applies it. */
export function mayEditCreature(seat: Seat): boolean {
  return seat.kind === "dm";
}

/**
 * How an event is signed. The raw id rather than a name, so the feed resolves
 * it at render time — renaming a character then fixes its old rows too, and
 * signing does not depend on state the signer may not have yet.
 */
export const DM_ACTOR = "dm";

export function actorKey(seat: Seat): string {
  return seat.kind === "dm" ? DM_ACTOR : seat.characterId;
}
