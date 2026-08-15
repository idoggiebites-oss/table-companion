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
  | { readonly kind: "creature"; readonly maxHp: number; readonly ac?: number };

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
  /**
   * Null until it has been rolled. Not zero: "has not rolled yet" and "rolled
   * badly" are different facts, and the whole point of starting a fight
   * together is knowing who the table is still waiting on.
   */
  readonly initiative: number | null;
  readonly source: CombatantSource;
  readonly controller: Controller;
  readonly disclosure: Disclosure;
  /** Misses its first turn. Set for one SIDE when the DM calls an ambush. */
  readonly surprised?: boolean;
  /** Feet per round. Absent means the app does not track its movement. */
  readonly speed?: number;
}

/**
 * A fight starts before it starts. Everyone rolling initiative is a real
 * moment at the table — the DM says "roll for initiative" and then waits —
 * and modelling it as a phase is what lets every device show who is still
 * outstanding instead of one person collecting numbers verbally.
 */
export type CombatPhase = "rolling" | "active";

export interface Combat {
  readonly phase: CombatPhase;
  readonly round: number;
  /** Index into `order`. Meaningless while rolling. */
  readonly turn: number;
  readonly order: readonly Combatant[];
  /** Current hit points for creature combatants, by combatant id. */
  readonly creatureHp: Readonly<Record<string, number>>;
  /** Feet moved this turn, by combatant id. Cleared when their turn opens. */
  readonly moved: Readonly<Record<string, number>>;
  /**
   * Reactions spent, by combatant id — for CREATURES only. A character's
   * reaction is part of their economy in campaign state, where the rest of
   * their action economy lives; a creature has no state outside the fight, so
   * its reaction lives here. Same split as hit points.
   */
  readonly reactions: Readonly<Record<string, boolean>>;
}

/**
 * Higher initiative first. Ties are broken by the order given, which is the
 * DM's, so the same fight always resolves the same way on every device — a
 * sort that consulted anything device-local would desynchronise the table.
 */
export function sortOrder(combatants: readonly Combatant[]): Combatant[] {
  return combatants
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      // Anyone who has not rolled sorts last rather than as a zero, so a
      // half-rolled order still reads correctly while the table waits.
      const ai = a.c.initiative;
      const bi = b.c.initiative;
      if (ai === null && bi === null) return a.i - b.i;
      if (ai === null) return 1;
      if (bi === null) return -1;
      return bi - ai || a.i - b.i;
    })
    .map(({ c }) => c);
}

function seedHp(order: readonly Combatant[]): Record<string, number> {
  const hp: Record<string, number> = {};
  for (const c of order) {
    if (c.source.kind === "creature") hp[c.id] = c.source.maxHp;
  }
  return hp;
}

/** The roster, before anyone has rolled. */
export function stageCombat(order: readonly Combatant[]): Combat {
  return {
    phase: "rolling",
    round: 1,
    turn: 0,
    order: [...order],
    creatureHp: seedHp(order),
    moved: {},
    reactions: {},
  };
}

export function startCombat(order: readonly Combatant[]): Combat {
  const sorted = sortOrder(order);
  return {
    phase: "active",
    round: 1,
    turn: 0,
    order: sorted,
    creatureHp: seedHp(sorted),
    moved: {},
    reactions: {},
  };
}

export function setInitiative(combat: Combat, id: string, value: number): Combat {
  return {
    ...combat,
    order: combat.order.map((c) => (c.id === id ? { ...c, initiative: value } : c)),
  };
}

export function awaitingRolls(combat: Combat): readonly Combatant[] {
  return combat.order.filter((c) => c.initiative === null);
}

/**
 * Settles the order. Anyone who still has not rolled is dropped rather than
 * placed arbitrarily — a fight that starts with somebody at a made-up
 * position is worse than one that starts without them, and they can be added
 * back by staging again.
 */
export function beginCombat(combat: Combat): Combat {
  const rolled = combat.order.filter((c) => c.initiative !== null);
  return {
    ...combat,
    phase: "active",
    round: 1,
    turn: 0,
    order: sortOrder(rolled),
    moved: {},
    reactions: {},
  };
}

/** Surprise costs you the first round only. */
export function isSurprised(combat: Combat, c: Combatant): boolean {
  return c.surprised === true && combat.round === 1;
}

/** Creatures only — a character's reaction lives in their economy. */
export function hasReaction(combat: Combat, id: string): boolean {
  return combat.reactions[id] !== true;
}

export function movementLeft(combat: Combat, c: Combatant): number | null {
  if (c.speed === undefined) return null;
  return Math.max(0, c.speed - (combat.moved[c.id] ?? 0));
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
  if (combat.phase !== "active") return combat;
  if (from !== combat.turn) return combat;
  const next = combat.turn + 1;
  const moved = { ...combat.moved };
  const reactions = { ...combat.reactions };
  // Movement and the reaction both come back when your turn opens, exactly
  // like a character's economy does.
  const opening = combat.order[next >= combat.order.length ? 0 : next];
  if (opening) {
    delete moved[opening.id];
    delete reactions[opening.id];
  }
  return next >= combat.order.length
    ? { ...combat, turn: 0, round: combat.round + 1, moved, reactions }
    : { ...combat, turn: next, moved, reactions };
}

export function activeCombatant(combat: Combat): Combatant | null {
  if (combat.phase !== "active") return null;
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
