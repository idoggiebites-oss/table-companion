/**
 * The event log.
 *
 * Every mutation to campaign state is one of these, appended and never
 * rewritten. Current state is a projection of the log, which is what buys
 * undo, reconnect replay, the action feed, and session recap from a single
 * mechanism rather than four.
 *
 * Events are deliberately COARSE and gameplay-shaped — "damage was applied",
 * not "field currentHp was set to 23". A field-level log would still work and
 * would be useless to read, undo, or sync.
 */

import type { CharacterId, Character } from "./build.js";
import type { ClassId } from "./resources.js";
import type { Combatant, Disclosure, EconomyKind, TargetRef } from "./combat.js";
import type { Encounter } from "./encounter.js";
import type { Progression } from "./progression.js";
import type { AttackClaim } from "./attackflow.js";
import type { Ability } from "./abilities.js";
import type { Boon } from "./boons.js";
import type { Stack } from "./items.js";
import type { KnownSpell } from "./spells.js";
import type { Npc } from "./npc.js";
import type { Statblock } from "./statblock.js";
import type { ConditionId } from "./edition.js";
import type { RollMode } from "./roll.js";

export type EventId = string;

interface Meta {
  readonly id: EventId;
  /** Epoch milliseconds. A session is a view over the log between two of these. */
  readonly at: number;
  /** Who caused it. Phase 1 is always the one local player. */
  readonly by: string;
}

export type DomainEvent = Meta &
  (
    | { readonly type: "characterAdded"; readonly character: Character }
    | { readonly type: "damageApplied"; readonly who: CharacterId; readonly amount: number }
    | { readonly type: "healingApplied"; readonly who: CharacterId; readonly amount: number }
    | { readonly type: "tempHpGranted"; readonly who: CharacterId; readonly amount: number }
    | {
        readonly type: "resourceSpent";
        readonly who: CharacterId;
        readonly resource: string;
        readonly amount: number;
      }
    | {
        readonly type: "resourceRestored";
        readonly who: CharacterId;
        readonly resource: string;
        readonly amount: number;
      }
    | {
        readonly type: "hitDiceSpent";
        readonly who: CharacterId;
        /** The player rolled a real die; this is what they typed. */
        readonly rolled: number;
        readonly conMod: number;
      }
    | { readonly type: "conditionAdded"; readonly who: CharacterId; readonly condition: ConditionId }
    | { readonly type: "conditionRemoved"; readonly who: CharacterId; readonly condition: ConditionId }
    | { readonly type: "concentrationStarted"; readonly who: CharacterId; readonly on: string }
    | { readonly type: "concentrationEnded"; readonly who: CharacterId }
    /**
     * Resolving one owed save. Carries the dice the player physically rolled;
     * the projector compares the total against the DC it already stored, so
     * pass or fail is derived rather than asserted by whoever tapped.
     */
    | {
        readonly type: "concentrationChecked";
        readonly who: CharacterId;
        readonly mode: RollMode;
        readonly dice: readonly number[];
        readonly modifier: number;
      }
    | { readonly type: "exhaustionChanged"; readonly who: CharacterId; readonly delta: number }
    | { readonly type: "inspirationChanged"; readonly who: CharacterId; readonly value: boolean }
    | {
        readonly type: "deathSaveRecorded";
        readonly who: CharacterId;
        readonly result: "success" | "failure" | "critical" | "fumble";
      }
    /**
     * A roll changes no state — it is recorded because the log is the session's
     * record, not only its state machine. The projector ignores it; the feed
     * and the recap do not.
     */
    | {
        readonly type: "diceRolled";
        readonly who: CharacterId;
        readonly label: string;
        readonly mode: RollMode;
        readonly dice: readonly number[];
        readonly modifier: number;
      }
    | { readonly type: "combatStarted"; readonly order: readonly Combatant[] }
    /**
     * The roster, before anyone has rolled. Separate from combatStarted
     * because "roll for initiative" is a real moment the table spends
     * together, and every device should show who is still outstanding.
     */
    | { readonly type: "combatStaged"; readonly combatants: readonly Combatant[] }
    | {
        readonly type: "initiativeRolled";
        readonly combatantId: string;
        readonly value: number;
      }
    | { readonly type: "combatBegan" }
    /** Signed feet. Undo is replay-without-it, so no inverse is stored. */
    | {
        readonly type: "movementSpent";
        readonly combatantId: string;
        readonly feet: number;
      }
    /**
     * An opportunity attack. Spends the reaction and says who it was against,
     * so the log answers "why has the fighter no reaction left".
     */
    | {
        readonly type: "opportunityTaken";
        /**
         * NOT `by`: every event already carries a `by` in its metadata (who
         * signed it), and EventBody omits the metadata keys — so a field
         * named `by` here is silently stripped from the body.
         */
        readonly attacker: string;
        readonly attackerWho?: CharacterId;
        readonly against: string;
      }
    | { readonly type: "combatEnded" }
    /** How this campaign advances. A setting, not a preference. */
    | { readonly type: "progressionSet"; readonly mode: Progression }
    | {
        readonly type: "xpAwarded";
        readonly who: readonly CharacterId[];
        readonly amount: number;
      }
    /** Milestone campaigns: the DM says so, and a level becomes owed. */
    | { readonly type: "levelAwarded"; readonly who: readonly CharacterId[] }
    /** Resolving one owed level. Appends to the character's deltas. */
    | {
        readonly type: "levelGained";
        readonly who: CharacterId;
        readonly classId: ClassId;
        readonly hpGain: number;
        /** +2 to one ability or +1 to two, where the level grants it. */
        readonly abilities?: Partial<Record<Ability, number>>;
        /** Taken instead of the improvement. */
        readonly feat?: { readonly id: string; readonly name: string };
      }
    /** Prep that survives contact: built on a laptop, opened at the table. */
    | { readonly type: "encounterSaved"; readonly encounter: Encounter }
    | { readonly type: "encounterDeleted"; readonly encounterId: string }
    /** The legal escape hatch: anything the SRD cannot carry. */
    /**
     * Carrying things. Quantities and what is equipped move separately: taking
     * off a helmet does not change how many you own, and selling one does not
     * need to know whether it was worn.
     */
    | { readonly type: "itemAdded"; readonly who: CharacterId; readonly stack: Stack }
    | {
        readonly type: "itemRemoved";
        readonly who: CharacterId;
        readonly itemId: string;
        readonly name: string;
        readonly qty: number;
        readonly note?: string;
      }
    | {
        readonly type: "itemEquipped";
        readonly who: CharacterId;
        readonly itemId: string;
        readonly name: string;
      }
    | {
        readonly type: "itemUnequipped";
        readonly who: CharacterId;
        readonly itemId: string;
        readonly name: string;
      }
    /** Signed, in copper. Undo is replay-without-it, so no inverse is stored. */
    | { readonly type: "coinsChanged"; readonly who: CharacterId; readonly delta: number }
    /** Blessings and buffs. Shown, never applied — see boons.ts. */
    /**
     * A player's attack, waiting on the DM. Nothing lands until it is
     * resolved — see attackflow.ts for why the player cannot apply it.
     */
    | { readonly type: "attackClaimed"; readonly claim: AttackClaim }
    | {
        readonly type: "attackResolved";
        readonly claimId: string;
        /** False is a miss, or a DM saying no. Either way nothing lands. */
        readonly applied: boolean;
      }
    | { readonly type: "spellLearned"; readonly who: CharacterId; readonly spell: KnownSpell }
    | { readonly type: "spellForgotten"; readonly who: CharacterId; readonly spellId: string }
    | {
        readonly type: "spellPrepared";
        readonly who: CharacterId;
        readonly spellId: string;
        readonly prepared: boolean;
      }
    /**
     * Casting is one event because it does three things — spends the slot,
     * takes over concentration, and names what was cast. Undoing it has to
     * give back all three, and separate events could be undone apart.
     */
    | {
        readonly type: "spellCast";
        readonly who: CharacterId;
        readonly spellId: string;
        readonly name: string;
        /** The slot level spent. 0 is a cantrip, and costs nothing. */
        readonly atLevel: number;
        readonly concentration: boolean;
        /** Rituals cost no slot, which is the whole point of them. */
        readonly ritual?: boolean;
      }
    | { readonly type: "boonGranted"; readonly who: CharacterId; readonly boon: Boon }
    | { readonly type: "boonRemoved"; readonly who: CharacterId; readonly boonId: string }

    | { readonly type: "npcSaved"; readonly npc: Npc }
    | { readonly type: "npcDeleted"; readonly npcId: string }
    /** Opening a shop is what makes it visible to players. One at a time. */
    | { readonly type: "traderOpened"; readonly npcId: string }
    | { readonly type: "traderClosed" }
    | {
        readonly type: "itemBought";
        readonly who: CharacterId;
        readonly npcId: string;
        readonly stack: Stack;
        /** Copper. One event, so undoing a purchase returns both halves. */
        readonly price: number;
      }

    /**
     * Loot. To the party it lands in a shared stash to be divided later, which
     * is what a table actually does with "you find 500 gp and a sword".
     */
    | {
        readonly type: "lootGranted";
        readonly to: { readonly kind: "party" } | { readonly kind: "character"; readonly who: CharacterId };
        readonly items: readonly Stack[];
        readonly coins: number;
      }
    | {
        readonly type: "stashAssigned";
        readonly to: CharacterId;
        readonly itemId: string;
        readonly name: string;
        readonly qty: number;
        readonly note?: string;
      }
    /** Even shares out of the stash; the remainder stays in it. */
    | { readonly type: "stashCoinsSplit"; readonly among: readonly CharacterId[] }
    | { readonly type: "homebrewSaved"; readonly statblock: Statblock }
    | { readonly type: "homebrewDeleted"; readonly statblockId: string }
    | {
        readonly type: "economySpent";
        readonly who: CharacterId;
        readonly kind: EconomyKind;
      }
    /**
     * Names the turn it was issued against, so two devices pressing at the
     * same instant produce one move rather than a skipped creature.
     */
    | { readonly type: "turnAdvanced"; readonly from: number }
    | {
        readonly type: "creatureDamaged";
        readonly combatantId: string;
        readonly amount: number;
      }
    | {
        readonly type: "disclosureSet";
        readonly combatantId: string;
        readonly level: Disclosure;
      }
    /**
     * One blast, one event, one undo. A fireball on four goblins is four
     * saving throws and two different damage totals, and doing that as four
     * separate events would mean four undos to take it back.
     */
    | {
        readonly type: "areaDamageApplied";
        readonly label: string;
        readonly amount: number;
        readonly damageType: string;
        /** When false a successful save takes nothing at all. */
        readonly halfOnSave: boolean;
        readonly targets: readonly {
          readonly ref: TargetRef;
          readonly saved: boolean;
        }[];
      }
    | { readonly type: "shortRestTaken"; readonly who: readonly CharacterId[] }
    | { readonly type: "longRestTaken"; readonly who: readonly CharacterId[] }
    /**
     * Undo. The log stays append-only: reverting appends a marker naming the
     * event to skip, rather than removing anything. Other people may have
     * acted since, and a removed event would silently rewrite their history.
     */
    | { readonly type: "reverted"; readonly target: EventId }
  );

export type DomainEventType = DomainEvent["type"];

let counter = 0;

/** Monotonic within a process; phase 2 replaces this with a room-scoped id. */
export function newEventId(): EventId {
  counter += 1;
  return `e${Date.now().toString(36)}-${counter.toString(36)}`;
}

/**
 * Omit distributes over a union only if you make it — a plain Omit collapses
 * DomainEvent to the keys every variant shares, which is just Meta.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type EventBody = DistributiveOmit<DomainEvent, keyof Meta>;

/** Generic so the returned event keeps its exact variant, with no cast. */
export function makeEvent<B extends EventBody>(
  body: B,
  by = "local",
  at = Date.now(),
): B & Meta {
  return { id: newEventId(), at, by, ...body };
}

/** Events that only describe the world, and can never be undone. */
export function isRevertible(e: DomainEvent): boolean {
  return e.type !== "characterAdded" && e.type !== "reverted";
}
