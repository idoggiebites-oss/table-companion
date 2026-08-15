/**
 * Log → state.
 *
 * Undo is why this file exists in this shape. Because state is DERIVED rather
 * than stored, reverting an event is just replaying without it — which means
 * undoing a long rest correctly un-restores every pool it touched, with no
 * inverse-operation code anywhere. Storing state directly would need an
 * explicit inverse for every event type, and each one would be a place to get
 * it wrong.
 */

import { abilityModifier } from "./abilities.js";
import {
  appendLevel, effectiveBuild, reconcileImport,
  type Character, type CharacterId, type EffectiveBuild,
} from "./build.js";
import {
  activeCombatant, advance, beginCombat, FRESH_ECONOMY, setInitiative,
  stageCombat, startCombat,
  type Combat, type Economy,
} from "./combat.js";
import { checkFor, type ConcentrationCheck } from "./concentration.js";
import type { Encounter } from "./encounter.js";
import type { AttackClaim } from "./attackflow.js";
import type { Boon } from "./boons.js";
import type { KnownSpell } from "./spells.js";
import { addItem, removeItem, type Stack } from "./items.js";
import { sellOne, type Npc } from "./npc.js";
import { levelForXp, type Progression } from "./progression.js";
import type { Statblock } from "./statblock.js";
import { rulesFor, type ConditionId } from "./edition.js";
import { resolveRoll } from "./roll.js";
import type { DomainEvent, EventId } from "./events.js";
import { restoredAmount, restoredBy } from "./resources.js";

export interface CharacterState {
  readonly currentHp: number;
  readonly tempHp: number;
  readonly exhaustion: number;
  readonly inspiration: boolean;
  /** Spent counts by resource id — absent means untouched. */
  readonly spent: Readonly<Record<string, number>>;
  readonly conditions: readonly ConditionId[];
  readonly concentratingOn: string | null;
  /**
   * Saves owed but not yet rolled, oldest first. Each instance of damage owes
   * its own save, so this is a queue rather than a single flag — and failing
   * any of them clears the rest, because concentration is already gone.
   */
  readonly concentrationChecks: readonly ConcentrationCheck[];
  readonly deathSaves: { readonly successes: number; readonly failures: number };
  readonly stable: boolean;
  readonly dead: boolean;
  /** What has been spent this round. All of it returns on your turn. */
  readonly economy: Economy;
  readonly xp: number;
  /** The level the DM has granted in a milestone campaign. */
  readonly milestoneLevel: number;
  readonly boons: readonly Boon[];
  readonly spells: readonly KnownSpell[];
  readonly inventory: readonly Stack[];
  /** Item ids being worn or wielded. See items.ts for why it is a set. */
  readonly equipped: readonly string[];
  /** Copper. Integer, always — money.ts explains why. */
  readonly coins: number;
}

export interface CampaignState {
  /** Imported base plus appended level-ups — the source builds derive from. */
  readonly sources: Readonly<Record<CharacterId, Character>>;
  readonly builds: Readonly<Record<CharacterId, EffectiveBuild>>;
  readonly characters: Readonly<Record<CharacterId, CharacterState>>;
  /** Null outside a fight. */
  readonly combat: Combat | null;
  /** Saved prep, by encounter id. */
  readonly encounters: Readonly<Record<string, Encounter>>;
  /** The DM's own creatures, by statblock id. */
  readonly homebrew: Readonly<Record<string, Statblock>>;
  readonly npcs: Readonly<Record<string, Npc>>;
  /** The shop the party is standing in, if any. Players see only this one. */
  readonly openTrader: string | null;
  /** Loot given to the party as a whole, waiting to be divided. */
  readonly stash: { readonly items: readonly Stack[]; readonly coins: number };
  /** Attacks a player has rolled, waiting for the DM to say they land. */
  readonly claims: readonly AttackClaim[];
  readonly progression: Progression;
}

function initialState(build: EffectiveBuild): CharacterState {
  return {
    currentHp: build.maxHp,
    tempHp: 0,
    exhaustion: 0,
    inspiration: false,
    spent: {},
    conditions: [],
    concentratingOn: null,
    concentrationChecks: [],
    deathSaves: { successes: 0, failures: 0 },
    stable: false,
    dead: false,
    economy: FRESH_ECONOMY,
    xp: 0,
    milestoneLevel: build.totalLevel,
    boons: [],
    spells: [],
    inventory: [],
    equipped: [],
    coins: 0,
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** You regain everything at the start of your turn, the reaction included. */
function refillActive(
  characters: Readonly<Record<CharacterId, CharacterState>>,
  combat: Combat,
): Record<CharacterId, CharacterState> {
  const next = { ...characters };
  const active = activeCombatant(combat);
  if (active?.source.kind === "character") {
    const who = active.source.characterId;
    const before = next[who];
    if (before) next[who] = { ...before, economy: FRESH_ECONOMY };
  }
  return next;
}

function spend(spent: Record<string, number>, id: string, n: number, max: number) {
  const now = clamp((spent[id] ?? 0) + n, 0, max);
  return { ...spent, [id]: now };
}

/**
 * Damage eats temporary hit points first, and dropping to 0 ends
 * concentration — a rule tables forget in exactly the moment it matters.
 */
function applyDamage(s: CharacterState, amount: number): CharacterState {
  const absorbed = Math.min(s.tempHp, amount);
  const rest = amount - absorbed;
  const hp = Math.max(0, s.currentHp - rest);
  const downed = hp === 0;

  // Damage that lands while concentrating owes a save — unless it dropped you,
  // in which case concentration is already gone and no save is owed.
  const owes = s.concentratingOn !== null && !downed && amount > 0;

  return {
    ...s,
    tempHp: s.tempHp - absorbed,
    currentHp: hp,
    concentratingOn: downed ? null : s.concentratingOn,
    concentrationChecks: downed
      ? []
      : owes
        ? [...s.concentrationChecks, checkFor(amount)]
        : s.concentrationChecks,
    stable: downed ? false : s.stable,
  };
}

function applyRest(
  s: CharacterState,
  build: EffectiveBuild,
  rest: "short" | "long",
): CharacterState {
  const spent: Record<string, number> = { ...s.spent };

  for (const r of build.resources) {
    if (!restoredBy(rest, r.recharge)) continue;
    const back = restoredAmount(r.max, r.recharge);
    const used = spent[r.id] ?? 0;
    spent[r.id] = Math.max(0, used - back);
  }

  if (rest === "short") {
    return { ...s, spent };
  }

  return {
    ...s,
    spent,
    currentHp: build.maxHp,
    // Temporary hit points do not survive a long rest.
    tempHp: 0,
    exhaustion: Math.max(0, s.exhaustion - 1),
    deathSaves: { successes: 0, failures: 0 },
    stable: false,
  };
}

function reduce(state: CampaignState, e: DomainEvent): CampaignState {
  if (e.type === "characterAdded") {
    const id = e.character.base.id;
    const existing = state.sources[id];
    // A second characterAdded for the same id is a RE-IMPORT: keep the
    // level-ups the incoming file does not already contain.
    const source = existing
      ? reconcileImport(e.character.base, existing.deltas)
      : e.character;
    const build = effectiveBuild(source);
    const before = state.characters[id];
    return {
      ...state,
      sources: { ...state.sources, [id]: source },
      builds: { ...state.builds, [id]: build },
      characters: {
        ...state.characters,
        // Re-import replaces the BUILD, never the campaign state — you do not
        // lose your spent slots because you fixed a typo in your builder.
        [id]: before
          ? { ...before, currentHp: Math.min(before.currentHp, build.maxHp) }
          : initialState(build),
      },
    };
  }
  if (e.type === "reverted") return state;

  switch (e.type) {
    case "combatStarted": {
      const combat = startCombat(e.order);
      return { ...state, combat, characters: refillActive(state.characters, combat) };
    }
    case "encounterSaved":
      return {
        ...state,
        encounters: { ...state.encounters, [e.encounter.id]: e.encounter },
      };
    case "encounterDeleted": {
      const rest = { ...state.encounters };
      delete rest[e.encounterId];
      return { ...state, encounters: rest };
    }
    case "combatStaged":
      return { ...state, combat: stageCombat(e.combatants) };
    case "initiativeRolled":
      return state.combat
        ? { ...state, combat: setInitiative(state.combat, e.combatantId, e.value) }
        : state;
    case "combatBegan":
      return state.combat ? { ...state, combat: beginCombat(state.combat) } : state;
    case "movementSpent": {
      if (!state.combat) return state;
      const at = state.combat.moved[e.combatantId] ?? 0;
      // NET feet, allowed to go negative: a Dash is negative spend, and
      // clamping at zero made extra movement impossible to represent — a dash
      // after moving 15 gave back 30 instead of 45. The floor belongs in
      // movementLeft, which is where "how much is left" is actually asked.
      return {
        ...state,
        combat: {
          ...state.combat,
          moved: { ...state.combat.moved, [e.combatantId]: at + e.feet },
        },
      };
    }
    case "opportunityTaken": {
      // The reaction is spent by the same event, so undoing the attack gives
      // it back — two events could be undone apart and leave a lie.
      if (!e.attackerWho) {
        // A creature: its reaction lives in the fight, not in a character.
        return state.combat
          ? {
              ...state,
              combat: {
                ...state.combat,
                reactions: { ...state.combat.reactions, [e.attacker]: true },
              },
            }
          : state;
      }
      const c = state.characters[e.attackerWho];
      if (!c) return state;
      return {
        ...state,
        characters: {
          ...state.characters,
          [e.attackerWho]: { ...c, economy: { ...c.economy, reaction: true } },
        },
      };
    }
    case "progressionSet":
      return { ...state, progression: e.mode };
    case "attackClaimed":
      return state.claims.some((c) => c.id === e.claim.id)
        ? state
        : { ...state, claims: [...state.claims, e.claim] };
    case "attackResolved": {
      const claim = state.claims.find((c) => c.id === e.claimId);
      if (!claim) return state;
      const rest = { ...state, claims: state.claims.filter((c) => c.id !== e.claimId) };
      if (!e.applied || claim.damage <= 0) return rest;

      // Resolution is where damage finally lands, on whichever side was hit —
      // and damage to a character is what owes a concentration save, so it
      // goes through the same path everything else uses.
      const target = state.combat?.order.find((c) => c.id === claim.targetId);
      if (target?.source.kind === "character") {
        const before = rest.characters[target.source.characterId];
        if (!before) return rest;
        return {
          ...rest,
          characters: {
            ...rest.characters,
            [target.source.characterId]: applyDamage(before, claim.damage),
          },
        };
      }
      if (!rest.combat) return rest;
      const at = rest.combat.creatureHp[claim.targetId] ?? 0;
      return {
        ...rest,
        combat: {
          ...rest.combat,
          creatureHp: {
            ...rest.combat.creatureHp,
            [claim.targetId]: Math.max(0, at - claim.damage),
          },
        },
      };
    }
    case "npcSaved":
      return { ...state, npcs: { ...state.npcs, [e.npc.id]: e.npc } };
    case "npcDeleted": {
      const rest = { ...state.npcs };
      delete rest[e.npcId];
      // A deleted shopkeeper cannot still be serving the party.
      return {
        ...state,
        npcs: rest,
        openTrader: state.openTrader === e.npcId ? null : state.openTrader,
      };
    }
    case "traderOpened":
      return { ...state, openTrader: e.npcId };
    case "traderClosed":
      return { ...state, openTrader: null };
    case "itemBought": {
      const npc = state.npcs[e.npcId];
      const buyer = state.characters[e.who];
      if (!buyer) return state;
      return {
        ...state,
        ...(npc
          ? { npcs: { ...state.npcs, [e.npcId]: { ...npc, stock: sellOne(npc.stock, e.stack.itemId) } } }
          : {}),
        characters: {
          ...state.characters,
          [e.who]: {
            ...buyer,
            coins: Math.max(0, buyer.coins - e.price),
            inventory: addItem(buyer.inventory, e.stack),
          },
        },
      };
    }
    case "lootGranted": {
      if (e.to.kind === "party") {
        return {
          ...state,
          stash: {
            items: e.items.reduce((inv, s) => addItem(inv, s), [...state.stash.items]),
            coins: state.stash.coins + e.coins,
          },
        };
      }
      const owner = state.characters[e.to.who];
      if (!owner) return state;
      return {
        ...state,
        characters: {
          ...state.characters,
          [e.to.who]: {
            ...owner,
            coins: Math.max(0, owner.coins + e.coins),
            inventory: e.items.reduce((inv, s) => addItem(inv, s), [...owner.inventory]),
          },
        },
      };
    }
    case "stashAssigned": {
      const owner = state.characters[e.to];
      if (!owner) return state;
      return {
        ...state,
        stash: {
          ...state.stash,
          items: removeItem(state.stash.items, e.itemId, e.qty, e.note),
        },
        characters: {
          ...state.characters,
          [e.to]: {
            ...owner,
            inventory: addItem(owner.inventory, {
              itemId: e.itemId, name: e.name, qty: e.qty,
              ...(e.note === undefined ? {} : { note: e.note }),
            }),
          },
        },
      };
    }
    case "stashCoinsSplit": {
      const n = e.among.length;
      // An even split only; the remainder stays in the stash rather than
      // being quietly given to whoever happens to sort first.
      const each = n === 0 ? 0 : Math.floor(state.stash.coins / n);
      if (each <= 0) return state;
      const characters = { ...state.characters };
      for (const id of e.among) {
        const c = characters[id];
        if (c) characters[id] = { ...c, coins: c.coins + each };
      }
      return { ...state, characters, stash: { ...state.stash, coins: state.stash.coins - each * n } };
    }
    case "levelGained": {
      const source = state.sources[e.who];
      if (!source) return state;
      const next = appendLevel(source, e.classId, e.hpGain, new Date(e.at).toISOString(), {
        ...(e.abilities ? { abilities: e.abilities } : {}),
        ...(e.feat ? { feat: e.feat } : {}),
      });
      const build = effectiveBuild(next);
      const before = state.characters[e.who];
      return {
        ...state,
        sources: { ...state.sources, [e.who]: next },
        builds: { ...state.builds, [e.who]: build },
        // Levelling raises the maximum; it does not heal you.
        characters: before
          ? { ...state.characters, [e.who]: { ...before, milestoneLevel: build.totalLevel } }
          : state.characters,
      };
    }
    case "homebrewSaved":
      return {
        ...state,
        homebrew: { ...state.homebrew, [e.statblock.id]: e.statblock },
      };
    case "homebrewDeleted": {
      const rest = { ...state.homebrew };
      delete rest[e.statblockId];
      return { ...state, homebrew: rest };
    }
    case "combatEnded":
      // Outside a fight there is no economy to have spent.
      return {
        ...state,
        combat: null,
        characters: Object.fromEntries(
          Object.entries(state.characters).map(([id, c]) => [id, { ...c, economy: FRESH_ECONOMY }]),
        ),
      };
    case "turnAdvanced": {
      if (state.combat === null) return state;
      const combat = advance(state.combat, e.from);
      if (combat === state.combat) return state; // guard refused it
      return { ...state, combat, characters: refillActive(state.characters, combat) };
    }
    case "creatureDamaged": {
      if (state.combat === null) return state;
      const current = state.combat.creatureHp[e.combatantId];
      if (current === undefined) return state;
      return {
        ...state,
        combat: {
          ...state.combat,
          creatureHp: {
            ...state.combat.creatureHp,
            [e.combatantId]: Math.max(0, current - e.amount),
          },
        },
      };
    }
    case "areaDamageApplied": {
      const characters = { ...state.characters };
      let combat = state.combat;
      for (const t of e.targets) {
        // Half rounds DOWN, and a character's concentration save is owed
        // against what they actually took — not the blast's full number.
        const amount = t.saved
          ? e.halfOnSave
            ? Math.floor(e.amount / 2)
            : 0
          : e.amount;
        if (amount <= 0 && t.saved && !e.halfOnSave) continue;
        if (t.ref.kind === "character") {
          const before = characters[t.ref.characterId];
          if (before) characters[t.ref.characterId] = applyDamage(before, amount);
        } else if (combat) {
          const current = combat.creatureHp[t.ref.combatantId];
          if (current !== undefined) {
            combat = {
              ...combat,
              creatureHp: {
                ...combat.creatureHp,
                [t.ref.combatantId]: Math.max(0, current - amount),
              },
            };
          }
        }
      }
      return { ...state, characters, combat };
    }
    case "disclosureSet": {
      if (state.combat === null) return state;
      return {
        ...state,
        combat: {
          ...state.combat,
          order: state.combat.order.map((c) =>
            c.id === e.combatantId ? { ...c, disclosure: e.level } : c,
          ),
        },
      };
    }
    default:
      break;
  }

  const targets =
    e.type === "shortRestTaken" || e.type === "longRestTaken" ||
    e.type === "xpAwarded" || e.type === "levelAwarded"
      ? e.who
      : [e.who];

  const characters = { ...state.characters };

  for (const id of targets) {
    const build = state.builds[id];
    const before = characters[id];
    if (!build || !before) continue;
    let s = before;

    switch (e.type) {
      case "damageApplied":
        s = applyDamage(s, e.amount);
        break;
      case "healingApplied": {
        if (s.currentHp === 0 && e.amount > 0) {
          s = { ...s, deathSaves: { successes: 0, failures: 0 }, stable: false, dead: false };
        }
        s = { ...s, currentHp: clamp(s.currentHp + e.amount, 0, build.maxHp) };
        break;
      }
      case "tempHpGranted":
        // Temporary hit points never stack; you take the better pool.
        s = { ...s, tempHp: Math.max(s.tempHp, e.amount) };
        break;
      case "spellLearned":
        s = s.spells.some((x) => x.id === e.spell.id)
          ? s
          : { ...s, spells: [...s.spells, e.spell] };
        break;
      case "spellForgotten":
        s = { ...s, spells: s.spells.filter((x) => x.id !== e.spellId) };
        break;
      case "spellPrepared":
        s = {
          ...s,
          spells: s.spells.map((x) =>
            x.id === e.spellId ? { ...x, prepared: e.prepared } : x,
          ),
        };
        break;
      case "spellCast": {
        // A ritual costs no slot; nor does a cantrip.
        const free = e.ritual === true || e.atLevel === 0;
        const id = `slot${e.atLevel}`;
        const max = build.resources.find((r) => r.id === id)?.max ?? 0;
        s = {
          ...s,
          ...(free ? {} : { spent: spend({ ...s.spent }, id, 1, max) }),
          // Concentration is exclusive: the new spell displaces the old one,
          // and any save owed on the old one is moot.
          ...(e.concentration ? { concentratingOn: e.name, concentrationChecks: [] } : {}),
        };
        break;
      }
      case "boonGranted":
        s = {
          ...s,
          boons: s.boons.some((b) => b.id === e.boon.id)
            ? s.boons
            : [...s.boons, e.boon],
        };
        break;
      case "boonRemoved":
        s = { ...s, boons: s.boons.filter((b) => b.id !== e.boonId) };
        break;
      case "itemAdded":
        s = { ...s, inventory: addItem(s.inventory, e.stack) };
        break;
      case "itemRemoved": {
        const inventory = removeItem(s.inventory, e.itemId, e.qty, e.note);
        // Losing the last one takes it off your body too, or the sheet keeps
        // deriving armour class from a breastplate that has been sold.
        const gone = inventory.every((x) => x.itemId !== e.itemId);
        s = {
          ...s,
          inventory,
          equipped: gone ? s.equipped.filter((id) => id !== e.itemId) : s.equipped,
        };
        break;
      }
      case "itemEquipped":
        s = s.equipped.includes(e.itemId)
          ? s
          : { ...s, equipped: [...s.equipped, e.itemId] };
        break;
      case "itemUnequipped":
        s = { ...s, equipped: s.equipped.filter((id) => id !== e.itemId) };
        break;
      case "coinsChanged":
        // A purse cannot go negative; the DM taking more than you have takes
        // what there is.
        s = { ...s, coins: Math.max(0, s.coins + e.delta) };
        break;
      case "resourceSpent": {
        const max = build.resources.find((r) => r.id === e.resource)?.max ?? 0;
        s = { ...s, spent: spend({ ...s.spent }, e.resource, e.amount, max) };
        break;
      }
      case "resourceRestored": {
        const max = build.resources.find((r) => r.id === e.resource)?.max ?? 0;
        s = { ...s, spent: spend({ ...s.spent }, e.resource, -e.amount, max) };
        break;
      }
      case "hitDiceSpent": {
        const max = build.resources.find((r) => r.id === "hitDice")?.max ?? 0;
        const gain = Math.max(0, e.rolled + e.conMod);
        s = {
          ...s,
          spent: spend({ ...s.spent }, "hitDice", 1, max),
          currentHp: clamp(s.currentHp + gain, 0, build.maxHp),
        };
        break;
      }
      case "conditionAdded":
        s = s.conditions.includes(e.condition)
          ? s
          : { ...s, conditions: [...s.conditions, e.condition] };
        break;
      case "conditionRemoved":
        s = { ...s, conditions: s.conditions.filter((c) => c !== e.condition) };
        break;
      case "concentrationStarted":
        s = { ...s, concentratingOn: e.on, concentrationChecks: [] };
        break;
      case "concentrationEnded":
        s = { ...s, concentratingOn: null, concentrationChecks: [] };
        break;
      case "concentrationChecked": {
        const owed = s.concentrationChecks[0];
        if (!owed) break; // nothing to resolve; a stale tap changes nothing
        const held = resolveRoll(e.dice, e.mode, e.modifier).total >= owed.dc;
        s = held
          ? { ...s, concentrationChecks: s.concentrationChecks.slice(1) }
          : { ...s, concentratingOn: null, concentrationChecks: [] };
        break;
      }
      case "exhaustionChanged":
        s = {
          ...s,
          exhaustion: clamp(
            s.exhaustion + e.delta,
            0,
            rulesFor(build.edition).maxExhaustion,
          ),
        };
        break;
      case "inspirationChanged":
        s = { ...s, inspiration: e.value };
        break;
      case "deathSaveRecorded": {
        let { successes, failures } = s.deathSaves;
        if (e.result === "success") successes += 1;
        else if (e.result === "failure") failures += 1;
        else if (e.result === "fumble") failures += 2;
        else {
          // A natural 20 puts you back up at one hit point.
          s = { ...s, currentHp: 1, deathSaves: { successes: 0, failures: 0 }, stable: false };
          break;
        }
        successes = Math.min(3, successes);
        failures = Math.min(3, failures);
        s = {
          ...s,
          deathSaves: { successes, failures },
          stable: successes >= 3,
          dead: failures >= 3,
        };
        break;
      }
      case "economySpent":
        s = { ...s, economy: { ...s.economy, [e.kind]: true } };
        break;
      case "xpAwarded":
        s = { ...s, xp: Math.max(0, s.xp + e.amount) };
        break;
      case "levelAwarded":
        s = { ...s, milestoneLevel: s.milestoneLevel + 1 };
        break;
      case "diceRolled":
        // Recorded, never applied — a roll is history, not state.
        break;
      case "shortRestTaken":
        s = applyRest(s, build, "short");
        break;
      case "longRestTaken":
        s = applyRest(s, build, "long");
        break;
    }

    characters[id] = s;
  }

  return { ...state, characters };
}

export const EMPTY_STATE: CampaignState = {
  sources: {}, builds: {}, characters: {}, combat: null,
  encounters: {}, homebrew: {}, progression: "xp",
  npcs: {}, openTrader: null, stash: { items: [], coins: 0 }, claims: [],
};

/**
 * Replays a log. Reverted events are skipped rather than removed, so the log
 * stays append-only and a revert can itself be inspected or reverted later.
 */
export function project(log: readonly DomainEvent[]): CampaignState {
  const reverted = new Set<EventId>();
  for (const e of log) if (e.type === "reverted") reverted.add(e.target);

  let state = EMPTY_STATE;
  for (const e of log) {
    if (reverted.has(e.id)) continue;
    state = reduce(state, e);
  }
  return state;
}

/**
 * Levels owed but not yet resolved. Derived, so it survives a reload and the
 * DM can see it without anything extra being stored.
 */
export function levelsOwed(state: CampaignState, id: CharacterId): number {
  const build = state.builds[id];
  const c = state.characters[id];
  if (!build || !c) return 0;
  const target = state.progression === "xp" ? levelForXp(c.xp) : c.milestoneLevel;
  return Math.max(0, target - build.totalLevel);
}

/** Convenience for tests and adapters that have a character rather than a log. */
export function conModOf(c: Character): number {
  return abilityModifier(c.base.abilities.con);
}
