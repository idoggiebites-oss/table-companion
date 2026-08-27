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

import type { ConditionId } from "./edition.js";
import { OPEN_GROUND, type Room } from "./terrain.js";
import type { CharacterId } from "./build.js";

/** Where a combatant's numbers live, which is also what kind of thing it is. */
export type CombatantSource =
  /** A player character; hit points live in campaign state. */
  | { readonly kind: "character"; readonly characterId: CharacterId }
  /** Anything the DM is running; hit points live in the combat itself. */
  | {
      readonly kind: "creature";
      readonly maxHp: number;
      readonly ac?: number;
      /**
       * Where the rest of it is, so the fight can show the whole creature
       * rather than the three fields that used to survive staging.
       */
      readonly statblockId?: string;
      /** What it can do, so the DM taps rather than reads and types. */
      readonly attacks?: readonly {
        readonly name: string;
        readonly toHit?: number;
        readonly dice?: string;
        readonly type?: string;
      }[];
    };

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
  /**
   * Conditions on CREATURES, by combatant id. A character's conditions live
   * on their sheet, where they outlast the fight; a creature has no life
   * outside this one. Same split as hit points and reactions.
   */
  readonly creatureConditions: Readonly<Record<string, readonly ConditionId[]>>;
  /**
   * What somebody did that changes how the dice fall for somebody ELSE, by
   * combatant id — dodging, helped, hidden.
   *
   * These are not conditions. They belong to this fight and this round: Dodge
   * lasts until your next turn, Help until you swing. Keeping them out of the
   * condition list means the DM's condition menu stays the fourteen names in
   * the rulebook rather than a mix of those and our bookkeeping.
   */
  readonly tags: Readonly<Record<string, readonly StanceTag[]>>;
  /**
   * Who is helping whom: helped combatant id → the helper's combatant id.
   *
   * Help expires "before the start of your next turn", where "your" is the
   * HELPER's. Without knowing who gave it, the only expiry available was the
   * helped creature's own turn — which is the instant the advantage is meant
   * to be used, so Help never once worked.
   */
  readonly helpedBy?: Readonly<Record<string, string>>;
  /**
   * A reaction the DM has offered and nobody has answered yet. One at a time:
   * the table is waiting on it, so a queue would mean the table is waiting on
   * several things and cannot see which.
   */
  readonly offer: ReactionOffer | null;
  /**
   * Triggers people are holding, by combatant id. The most-forgotten thing at
   * a table is somebody's readied action — held here so it is on the DM's
   * screen rather than in one player's memory.
   */
  readonly readied: Readonly<Record<string, string>>;
  /**
   * A shove, waiting on the DM. Contested rolls are the one thing in a fight
   * the app cannot settle on its own — it knows the player's total and not
   * the creature's — so it carries the number across and lets the DM say.
   */
  readonly shove: ShoveClaim | null;
  /**
   * What the room is like. On the fight rather than on anybody in it, because
   * that is what it is — a fact about where everyone is standing, not about
   * any one of them.
   */
  readonly scene: Room;
}

export interface ShoveClaim {
  readonly by: string;
  readonly byName: string;
  readonly targetId: string;
  readonly targetName: string;
  /** Their Athletics total, rolled on the table. */
  readonly total: number;
}

/** Not a condition — bookkeeping this fight needs and the rulebook does not. */
export type StanceTag = "dodging" | "helped" | "hidden";

export interface ReactionOffer {
  /** Combatant ids who may answer. */
  readonly to: readonly string[];
  /** Why, in the DM's words: "the goblin is leaving your reach". */
  readonly because: string;
  /** Who or what triggered it, for the prompt to name. */
  readonly from: string;
  /**
   * The same creature, by id.
   *
   * An opportunity attack is at the thing that provoked it — you do not get
   * to swing at whoever you like because somebody else walked away. The
   * offer carried only a NAME, so the swing that answered it listed every
   * creature on the board and left the rule to the table.
   *
   * Optional because offers made before this existed replay without it, and
   * a fight in progress should not break for a field it never had.
   */
  readonly fromId?: string;
  /** Answered already, so the prompt clears on their screen only. */
  readonly declined: readonly string[];
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

/**
 * Two creatures called Ghoul are two creatures nobody can tell apart.
 *
 * The encounter builder has numbered its instances since it was written; a
 * DM typing two rows by hand got "Ghoul" and "Ghoul" — same row in the
 * track, same name in the log, and the same aria-label, which is how the
 * screenshots for this work turned up the problem in the first place.
 *
 * Only duplicates are touched, and only within one staging: a lone ghoul is
 * a Ghoul, not a Ghoul 1.
 */
export function numberDuplicates(order: readonly Combatant[]): Combatant[] {
  const seen = new Map<string, number>();
  for (const c of order) seen.set(c.name, (seen.get(c.name) ?? 0) + 1);
  const used = new Map<string, number>();
  return order.map((c) => {
    if ((seen.get(c.name) ?? 0) < 2) return c;
    const n = (used.get(c.name) ?? 0) + 1;
    used.set(c.name, n);
    return { ...c, name: `${c.name} ${n}` };
  });
}

/**
 * Something arrives after the fight has started.
 *
 * Reinforcements are ordinary at a table and were impossible here: the only
 * way in was to cancel the fight and stage it again, which throws away every
 * hit point already spent. It drops into the order by its initiative, and if
 * it lands before the current turn the pointer moves with it so nobody's go
 * is skipped or repeated.
 */
export function joinCombat(combat: Combat, arrival: Combatant): Combat {
  const at = combat.order[combat.turn];
  const order = sortOrder(numberDuplicates([...combat.order, arrival]));
  const turn = at ? Math.max(0, order.findIndex((c) => c.id === at.id)) : combat.turn;
  return {
    ...combat,
    order,
    turn,
    creatureHp:
      arrival.source.kind === "creature"
        ? { ...combat.creatureHp, [arrival.id]: arrival.source.maxHp }
        : combat.creatureHp,
  };
}

/** The roster, before anyone has rolled. */
export function stageCombat(order: readonly Combatant[]): Combat {
  const numbered = numberDuplicates(order);
  return {
    phase: "rolling",
    round: 1,
    turn: 0,
    order: numbered,
    creatureHp: seedHp(numbered),
    moved: {},
    reactions: {},
    creatureConditions: {},
    tags: {},
    offer: null,
    readied: {},
    shove: null,
    scene: OPEN_GROUND,
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
    creatureConditions: {},
    tags: {},
    offer: null,
    readied: {},
    shove: null,
    scene: OPEN_GROUND,
  };
}

export function setInitiative(combat: Combat, id: string, value: number): Combat {
  return {
    ...combat,
    order: combat.order.map((c) => (c.id === id ? { ...c, initiative: value } : c)),
  };
}

/**
 * The base name behind "Goblin 4" — what numberDuplicates numbered.
 *
 * A renamed combatant keeps whatever it was renamed to, which is what stops
 * "the one with the net" being swept back into the goblins.
 */
export function baseName(name: string): string {
  return name.replace(/\s+\d+$/, "").trim();
}

/**
 * Creatures that roll as one, the way a table already does it.
 *
 * The DMG rolls initiative once per group of identical monsters, and every
 * table I have seen does it whether or not they know that. The app asked for
 * a number each: one player and six goblins is SEVEN prompts, and the DM
 * fills six of them with the same digits.
 *
 * Grouped by statblock where there is one, by name where there is not — two
 * hand-typed Ghouls are as much a group as two catalogued ones. Players are
 * never grouped: each is a person with their own dexterity and their own
 * opinion about when to go.
 */
export function rollGroups(
  combatants: readonly Combatant[],
): { key: string; name: string; members: readonly Combatant[] }[] {
  const out = new Map<string, { key: string; name: string; members: Combatant[] }>();
  for (const c of combatants) {
    const key =
      c.source.kind === "creature"
        ? `sb:${c.source.statblockId ?? ""}|${baseName(c.name)}`
        : `pc:${c.id}`;
    const had = out.get(key);
    if (had) had.members.push(c);
    else out.set(key, { key, name: baseName(c.name), members: [c] });
  }
  return [...out.values()];
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
/*
 * Everything per-turn is wiped; the ROOM is not. Where the fight is happening
 * is a fact about the place, said once, and it was being said before Begin
 * more often than after — a DM sets the room while the table is still rolling
 * initiative, and it silently reverted to open ground the moment the fight
 * started.
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
    creatureConditions: {},
    tags: {},
    offer: null,
    readied: {},
    shove: null,
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
  const tags = { ...combat.tags };
  // Movement and the reaction both come back when your turn opens, exactly
  // like a character's economy does.
  const opening = combat.order[next >= combat.order.length ? 0 : next];
  if (opening) {
    delete moved[opening.id];
    delete reactions[opening.id];
    /*
     * Dodge lasts "until the start of your next turn", and this is that
     * turn — so it goes.
     *
     * Help does NOT, and clearing it here was the whole feature failing
     * silently. Being helped and then having your turn is exactly when the
     * advantage is meant to be used; deleting the tag the moment the helped
     * creature's turn opens deleted it one instant before it could apply.
     * The rule times it off the HELPER's next turn, not the helped one's,
     * which is what `helpedBy` below does.
     *
     * Hidden is left alone for the same reason: you do not stop being unseen
     * because it became your go.
     */
    tags[opening.id] = (tags[opening.id] ?? []).filter((t) => t !== "dodging");
    if (tags[opening.id]!.length === 0) delete tags[opening.id];
    /*
     * And the help this creature GAVE expires now, because "before the start
     * of your next turn" has arrived. An ally who never swung has lost the
     * moment, which is the rule and also the reason Help is a real decision.
     */
    for (const [id, who] of Object.entries(combat.helpedBy ?? {})) {
      if (who !== opening.id) continue;
      tags[id] = (tags[id] ?? []).filter((t) => t !== "helped");
      if (tags[id]!.length === 0) delete tags[id];
    }
  }
  // An offer nobody answered dies with the turn that raised it. Leaving it up
  // would have a player answering a question about a moment that has passed.
  const helpedBy = { ...combat.helpedBy };
  for (const [id, who] of Object.entries(helpedBy)) {
    if (who === opening?.id) delete helpedBy[id];
  }
  const base = { ...combat, moved, reactions, tags, helpedBy, offer: null };
  return next >= combat.order.length
    ? { ...base, turn: 0, round: combat.round + 1 }
    : { ...base, turn: next };
}

/** A character's seat in the fight, by their id. Null if they are not in it. */
export function combatantIdOf(combat: Combat, characterId: CharacterId): string | null {
  return (
    combat.order.find(
      (c) => c.source.kind === "character" && c.source.characterId === characterId,
    )?.id ?? null
  );
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
