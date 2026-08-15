/**
 * What a player's log is allowed to say.
 *
 * The log is the same on every device — that is what makes undo work across
 * the table — but "everyone replays the same events" was quietly taken to
 * mean "everyone reads the same events". A player's screen was printing the
 * DM's prep: the villain they had just written down, the creature waiting in
 * the next room, every point of damage a monster had taken.
 *
 * That undoes the disclosure ladder from behind. The initiative track can
 * hide a creature's hit points as carefully as it likes while the log two
 * tabs away announces them.
 *
 * The rule is about the AUDIENCE, not the actor: a thing the table would see
 * happen is public, and a thing the DM did alone is not. Damage a player
 * dealt is public because they rolled it out loud; a creature quietly losing
 * hit points is not.
 */

import type { DomainEvent } from "./events.js";
import type { Seat } from "./combat.js";

/** Things that happen behind the screen. */
const BEHIND_THE_SCREEN = new Set<DomainEvent["type"]>([
  "npcSaved",
  "npcDeleted",
  "homebrewSaved",
  "homebrewDeleted",
  "encounterSaved",
  "encounterDeleted",
  "disclosureSet",
  "creatureDamaged",
]);

export function isDmOnly(type: DomainEvent["type"]): boolean {
  return BEHIND_THE_SCREEN.has(type);
}

export function visibleInLog(event: DomainEvent, seat: Seat): boolean {
  if (seat.kind === "dm") return true;
  return !isDmOnly(event.type);
}

/**
 * Who may take something back. The DM may undo anything, because they are the
 * one holding the table together; a player may undo what they did themselves.
 * Undoing somebody else's action is a conversation, not a button.
 */
export function mayRevert(event: DomainEvent, seat: Seat): boolean {
  if (seat.kind === "dm") return true;
  return event.by === seat.characterId;
}
