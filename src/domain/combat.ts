/**
 * Initiative, turns, and who is allowed to end them.
 *
 * The one rule that covers every case: whoever controls the active combatant
 * may end its turn, and the DM may always advance. That covers player
 * characters, monsters, and a druid's summoned wolf without a special case,
 * because ownership is a field on the combatant rather than something implied
 * by what kind of thing it is.
 *
 * Disclosure is orthogonal to control. The DM may run a creature the players
 * can see everything about, or one they cannot see at all.
 */

import type { CharacterId } from "./build.js";

/** Where a combatant's numbers live, which is also what kind of thing it is. */
export type CombatantSource =
  /** A player character; hit points live in campaign state. */
  | { readonly kind: "character"; readonly characterId: CharacterId }
  /** Anything the DM is running; hit points live in the combat itself. */
  | { readonly kind: "creature"; readonly maxHp: number };

export type Controller =
  | { readonly kind: "dm" }
  | { readonly kind: "player"; readonly characterId: CharacterId };

/**
 * How much of a creature the players are shown. An ordered ladder, because
 * the DM slides it up as a fight develops — a dropdown would hide the order.
 */
export const DISCLOSURE = ["hidden", "present", "vague", "exact"] as const;
export type Disclosure = (typeof DISCLOSURE)[number];

export interface Combatant {
  readonly id: string;
  readonly name: string;
  readonly initiative: number;
  readonly source: CombatantSource;
  readonly controller: Controller;
  readonly disclosure: Disclosure;
}

export interface Combat {
  readonly round: number;
  /** Index into `order`. */
  readonly turn: number;
  readonly order: readonly Combatant[];
  /** Current hit points for creature combatants, by combatant id. */
  readonly creatureHp: Readonly<Record<string, number>>;
}

/**
 * Higher initiative first. Ties are broken by the order given, which is the
 * DM's, so the same fight always resolves the same way on every device — a
 * sort that consulted anything device-local would desynchronise the table.
 */
export function sortOrder(combatants: readonly Combatant[]): Combatant[] {
  return combatants
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.initiative - a.c.initiative || a.i - b.i)
    .map(({ c }) => c);
}

export function startCombat(order: readonly Combatant[]): Combat {
  const sorted = sortOrder(order);
  const hp: Record<string, number> = {};
  for (const c of sorted) {
    if (c.source.kind === "creature") hp[c.id] = c.source.maxHp;
  }
  return { round: 1, turn: 0, order: sorted, creatureHp: hp };
}

/**
 * Advances if and only if the request names the turn it was issued against.
 *
 * Two devices can press at the same instant; the server orders both and every
 * client replays both, so the guard has to live here rather than in the
 * transport. The second request names a turn that has already passed and is
 * ignored — one press, one move, on every device, with no coordination.
 */
export function advance(combat: Combat, from: number): Combat {
  if (combat.order.length === 0) return combat;
  if (from !== combat.turn) return combat;
  const next = combat.turn + 1;
  return next >= combat.order.length
    ? { ...combat, turn: 0, round: combat.round + 1 }
    : { ...combat, turn: next };
}

export function activeCombatant(combat: Combat): Combatant | null {
  return combat.order[combat.turn] ?? null;
}

/** How many turns until this character acts. Zero means "now". */
export function turnsUntil(combat: Combat, characterId: CharacterId): number | null {
  const index = combat.order.findIndex(
    (c) => c.source.kind === "character" && c.source.characterId === characterId,
  );
  if (index === -1) return null;
  const n = combat.order.length;
  return (index - combat.turn + n) % n;
}

/**
 * What you have left this round.
 *
 * Tracked because forgetting a bonus action is the most common self-inflicted
 * loss in play. All three come back at the start of your turn — the reaction
 * included — but the reaction is the only one you ever spend on somebody
 * ELSE's turn, which is why it stays on screen while you are doing nothing.
 */
export const ECONOMY = ["action", "bonus", "reaction"] as const;
export type EconomyKind = (typeof ECONOMY)[number];

export type Economy = Readonly<Record<EconomyKind, boolean>>;

export const FRESH_ECONOMY: Economy = { action: false, bonus: false, reaction: false };

/**
 * Something damage can be pointed at. The first thing in the model that spans
 * both sides of the table — a fireball does not care which kind of thing is
 * standing in it.
 */
export type TargetRef =
  | { readonly kind: "character"; readonly characterId: CharacterId }
  | { readonly kind: "creature"; readonly combatantId: string };

export function targetOf(c: Combatant): TargetRef {
  return c.source.kind === "character"
    ? { kind: "character", characterId: c.source.characterId }
    : { kind: "creature", combatantId: c.id };
}

/** The seat a device is sitting in. Local to the device, never in the log. */
export type Seat = { readonly kind: "dm" } | { readonly kind: "player"; readonly characterId: CharacterId };

export function controls(seat: Seat, controller: Controller): boolean {
  if (seat.kind === "dm") return controller.kind === "dm";
  return controller.kind === "player" && controller.characterId === seat.characterId;
}

/** The DM may always advance; anyone else only on a combatant they control. */
export function mayEndTurn(seat: Seat, combat: Combat): boolean {
  if (seat.kind === "dm") return true;
  const active = activeCombatant(combat);
  return active !== null && controls(seat, active.controller);
}

/** What a player is allowed to be shown about a creature. */
export function visibleTo(seat: Seat, c: Combatant): boolean {
  if (seat.kind === "dm") return true;
  return c.disclosure !== "hidden";
}
