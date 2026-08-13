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
import { effectiveBuild, type Character, type CharacterId, type EffectiveBuild } from "./build.js";
import { advance, startCombat, type Combat } from "./combat.js";
import { checkFor, type ConcentrationCheck } from "./concentration.js";
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
}

export interface CampaignState {
  readonly builds: Readonly<Record<CharacterId, EffectiveBuild>>;
  readonly characters: Readonly<Record<CharacterId, CharacterState>>;
  /** Null outside a fight. */
  readonly combat: Combat | null;
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
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

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
    const build = effectiveBuild(e.character);
    return {
      builds: { ...state.builds, [build.id]: build },
      characters: { ...state.characters, [build.id]: initialState(build) },
      combat: state.combat,
    };
  }
  if (e.type === "reverted") return state;

  switch (e.type) {
    case "combatStarted":
      return { ...state, combat: startCombat(e.order) };
    case "combatEnded":
      return { ...state, combat: null };
    case "turnAdvanced":
      return state.combat === null
        ? state
        : { ...state, combat: advance(state.combat, e.from) };
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
    e.type === "shortRestTaken" || e.type === "longRestTaken" ? e.who : [e.who];

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

  return { builds: state.builds, characters, combat: state.combat };
}

export const EMPTY_STATE: CampaignState = { builds: {}, characters: {}, combat: null };

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

/** Convenience for tests and adapters that have a character rather than a log. */
export function conModOf(c: Character): number {
  return abilityModifier(c.base.abilities.con);
}
