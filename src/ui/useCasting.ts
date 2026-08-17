/**
 * Everything casting needs, in one place, because it now happens in two.
 *
 * Casting used to live only on the Spells tab, and taking the Cast action in
 * a fight sent you there. That was a moment implemented as a place: your turn
 * has a clock on it, and a tab is somewhere you can simply walk away from —
 * which is exactly what went wrong twice, once as a blank screen and once as
 * a slot spent on a spell that was never cast.
 *
 * So the act of casting moved into the turn, beside Attack, and the Spells
 * tab kept it too for the times you are not in a fight. Two callers, one set
 * of rules: what a spell costs, whether you can pay for it, which slots it
 * could go in, and what has to be written down when it goes off. Two copies
 * of that would drift, and the one that drifted would be the one somebody is
 * reading mid-turn.
 */

import { useEffect, useMemo, useState } from "react";
import type { EffectiveBuild } from "../domain/build.js";
import type { Combat } from "../domain/combat.js";
import type { EventBody } from "../domain/events.js";
import type { CharacterState } from "../domain/project.js";
import { costOf } from "../domain/spellcast.js";
import { canCast, slotsFor, type KnownSpell, type SlotState } from "../domain/spells.js";
import type { CompendiumSpell } from "../import/compendium.js";
import { loadSpells } from "../store/srd.js";

/**
 * The whole spellbook, loaded once per device.
 *
 * Not lazily on opening a browser: casting needs the file too — the casting
 * time, whether the caster rolls or the target saves, the dice at this level
 * — and loaded any later than this every spell became "nothing to roll" at
 * the moment it was pointed at something.
 */
export function useSpellbook(when: boolean): CompendiumSpell[] | null {
  const [all, setAll] = useState<CompendiumSpell[] | null>(null);
  useEffect(() => {
    if (!when || all) return;
    void loadSpells().then(setAll, () => setAll([]));
  }, [when, all]);
  return all;
}

export interface Casting {
  readonly book: CompendiumSpell[] | null;
  readonly slots: readonly SlotState[];
  /** What the file says this one costs — "long" is anything a fight has no room for. */
  readonly costFor: (spell: KnownSpell) => ReturnType<typeof costOf>;
  /** Whether it can be paid for right now. */
  readonly canAfford: (spell: KnownSpell) => boolean;
  /** Prepared, and a slot for it. */
  readonly ready: (spell: KnownSpell) => boolean;
  /** The slots it could go into. Empty for a cantrip. */
  readonly optionsFor: (spell: KnownSpell) => SlotState[];
  /**
   * The moment it is really cast: the slot goes, the pips move, the log says
   * so. Never before the aim is sent — see AimSpell.
   */
  readonly commit: (spell: KnownSpell, atLevel: number, ritual?: boolean) => void;
}

export function useCasting({
  build, state, combat, append, enabled = true,
}: {
  build: EffectiveBuild;
  state: CharacterState;
  combat: Combat | null | undefined;
  append: (body: EventBody) => void;
  /** A character with no magic should not pull four megabytes of spells. */
  enabled?: boolean;
}): Casting {
  const book = useSpellbook(enabled);

  const slots: SlotState[] = useMemo(
    () =>
      build.resources
        .filter((r) => /^slot\d$/.test(r.id))
        .map((r) => ({
          level: Number(r.id.slice(4)),
          max: r.max,
          left: r.max - (state.spent[r.id] ?? 0),
        }))
        .filter((s) => s.max > 0),
    [build.resources, state.spent],
  );

  const costFor = (spell: KnownSpell) => {
    const full = book?.find((s) => s.id === spell.id);
    return full ? costOf(full.time) : "action";
  };

  const canAfford = (spell: KnownSpell) => {
    const cost = costFor(spell);
    // Ten minutes of ritual is not something a turn has room for.
    if (cost === "long") return !combat;
    return !state.economy[cost];
  };

  return {
    book,
    slots,
    costFor,
    canAfford,
    ready: (spell) => canCast(spell, slots),
    optionsFor: (spell) => slotsFor(spell, slots),
    commit: (spell, atLevel, ritual = false) => {
      append({
        type: "spellCast",
        who: build.id,
        spellId: spell.id,
        name: spell.name,
        atLevel,
        concentration: spell.concentration,
        ...(ritual ? { ritual: true } : {}),
      });
      const cost = costFor(spell);
      if (combat && cost !== "long" && !state.economy[cost]) {
        append({ type: "economySpent", who: build.id, kind: cost });
      }
    },
  };
}
