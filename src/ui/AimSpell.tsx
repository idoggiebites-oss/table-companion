/**
 * Pointing a spell at something.
 *
 * The same walkthrough a weapon gets, because a beginner should not meet two
 * different ways of making an attack. What changes is who rolls: an attack
 * spell asks the caster for a d20, a save spell tells them the DC and asks
 * only for damage, and a spell that does neither has nothing to aim.
 *
 * Nothing is spent until this screen is finished. Casting used to take the
 * slot up front and ask who you were aiming at afterwards, which meant
 * walking away from this screen cost a slot and an action and cast nothing.
 *
 * The dice come from the file, at the right level — a cantrip scales with the
 * caster and a levelled spell with the slot it went into, which is the rule
 * most often got wrong at a table.
 */

import { useState } from "react";
import { formatModifier } from "../domain/abilities.js";
import type { EffectiveBuild } from "../domain/build.js";
import { visibleTo, type Combat, type Combatant } from "../domain/combat.js";
import type { CompendiumSpell } from "../import/compendium.js";
import type { KnownSpell } from "../domain/spells.js";
import { describeReasons, describeStance, type Stance, type StanceReason } from "../domain/stance.js";
import {
  castingAbility, damageFor, damageTypeFrom, halvesOnSave, kindOf, resolveDice,
  spellAttackBonus, spellSaveDc,
} from "../domain/spellcast.js";

export function AimSpell({
  spell, atLevel, build, book, combat, loading = false, stanceAt, onDone, onCancel,
}: {
  spell: KnownSpell;
  atLevel: number;
  build: EffectiveBuild;
  book: readonly CompendiumSpell[];
  combat: Combat;
  /**
   * Whether the spellbook has arrived. Absent is treated as loaded, for the
   * callers that only ever pass a settled list.
   */
  loading?: boolean;
  /** How the dice fall against this target, and why. A spell is ranged. */
  stanceAt: (target: Combatant) => { stance: Stance; reasons: readonly StanceReason[] };
  /**
   * The spell was cast. `null` means there is nothing for the DM to rule on —
   * no target, or nothing to roll — which is still a cast.
   */
  onDone: (aim: {
    target: Combatant;
    toHit: number | null;
    damage: number;
    damageType: string;
    /** Present only when the target saves rather than the caster swings. */
    save?: { ability: string; dc: number; half: boolean };
  } | null) => void;
  /** Never mind. Nothing is spent, because nothing was cast. */
  onCancel: () => void;
}) {
  const [target, setTarget] = useState<Combatant | null>(null);
  const [toHit, setToHit] = useState("");
  const [damage, setDamage] = useState("");

  const full = book.find((s) => s.id === spell.id);
  const kind = full ? kindOf(full) : { kind: "none" as const };
  const ability = castingAbility(build.classes.map((c) => c.classId));
  const mod = build.abilityMods[ability];
  const attackBonus = spellAttackBonus(build.proficiencyBonus, mod);
  const dc = spellSaveDc(build.proficiencyBonus, mod);

  const roll = full
    ? damageFor(full, { slotLevel: atLevel, characterLevel: build.totalLevel })
    : null;
  const dice = roll ? resolveDice(roll.dice, mod) : null;
  const damageType = roll ? damageTypeFrom(roll.description) : "damage";

  /*
   * The book is four megabytes and arrives when it arrives.
   *
   * Until it does, `full` is undefined for EVERY spell — which read as "this
   * one has nothing to roll", so a spell cast in the first seconds of a
   * session silently did nothing at all: no dice asked for, no claim sent, no
   * damage. The player saw "tell the table what it does" and the DM saw
   * nothing. That is the worst possible way to be wrong, because it looks
   * like an answer.
   */
  if (!full && (loading || book.length === 0)) {
    return (
      <div className="swing-step">
        <span className="label">{spell.name}</span>
        <p className="faint" style={{ margin: 0, fontSize: ".86rem" }}>
          Looking up what it does…
        </p>
        <button onClick={onCancel}>Never mind</button>
      </div>
    );
  }

  // A spell that neither attacks nor damages has nothing to point at.
  if (kind.kind === "none" && !dice) {
    return (
      <div className="swing-step">
        <span className="label">{spell.name} is cast</span>
        <p className="faint" style={{ margin: 0, fontSize: ".86rem" }}>
          Nothing to roll. Tell the table what it does.
        </p>
        <div className="row">
          <button onClick={() => onDone(null)}>Cast it</button>
          <button onClick={onCancel}>Never mind</button>
        </div>
      </div>
    );
  }

  const targets = combat.order.filter(
    (c) =>
      visibleTo({ kind: "player", characterId: build.id }, c) &&
      c.source.kind === "creature" &&
      (combat.creatureHp[c.id] ?? 1) > 0,
  );
  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && s.trim() !== "" ? n : null;
  };

  if (!target) {
    return (
      <div className="swing-step">
        <span className="label">Who are you aiming {spell.name} at?</span>
        {targets.map((c) => (
          <button className="tgt-row" key={c.id} onClick={() => setTarget(c)}>
            {c.name}
          </button>
        ))}
        {targets.length === 0 && (
          <p className="faint" style={{ margin: "6px 0", fontSize: ".84rem" }}>
            Nothing you can see.
          </p>
        )}
        {/* Two ways out, because they mean opposite things. A spell aimed at
            a spot on the floor is cast and costs a slot; a spell you thought
            better of costs nothing. */}
        <div className="row">
          <button onClick={() => onDone(null)}>Cast it at no one</button>
          <button onClick={onCancel}>Never mind</button>
        </div>
      </div>
    );
  }

  return (
    <div className="swing-step">
      <span className="label">{spell.name} at {target.name}</span>

      {kind.kind === "attack" && (
        <>
          {(() => {
            const { stance, reasons } = stanceAt(target);
            const why = describeReasons(stance, reasons);
            return (
              <>
                <p className="swing-ask">
                  {describeStance(stance)} and add <b>{formatModifier(attackBonus)}</b>.
                </p>
                {why && <p className={`stance ${stance}`}>{why}</p>}
              </>
            );
          })()}
          <input
            type="number"
            aria-label="Spell attack roll"
            placeholder="total"
            value={toHit}
            onChange={(e) => setToHit(e.target.value)}
          />
        </>
      )}

      {kind.kind === "save" && (
        <p className="swing-ask">
          They roll a <b>{kind.ability.toUpperCase()}</b> save against your
          {" "}<b>DC {dc}</b>. The DM will tell you.
          {/* Said before the dice, because after them it is arithmetic
              somebody has to do out loud. */}
          {full && (halvesOnSave(full)
            ? " A success takes half."
            : " A success takes nothing.")}
        </p>
      )}

      {dice && (
        <>
          <p className="swing-ask">
            Roll <b>{dice}</b> {damageType}.
          </p>
          <input
            type="number"
            aria-label="Spell damage roll"
            placeholder="total"
            value={damage}
            onChange={(e) => setDamage(e.target.value)}
          />
        </>
      )}

      <div className="row">
        <button
          disabled={
            (kind.kind === "attack" && num(toHit) === null) ||
            (dice !== null && num(damage) === null)
          }
          onClick={() =>
            onDone({
              target,
              toHit: kind.kind === "attack" ? num(toHit) : null,
              damage: num(damage) ?? 0,
              damageType,
              // The spell's own rule, sent with the claim. The DM's device
              // has the name and the number and not the spellbook.
              ...(kind.kind === "save" && full
                ? {
                    save: {
                      ability: kind.ability,
                      dc,
                      half: halvesOnSave(full),
                    },
                  }
                : {}),
            })
          }
        >
          Send to the DM
        </button>
        <button onClick={() => setTarget(null)}>Back</button>
      </div>
      <p className="faint" style={{ fontSize: ".8rem", margin: 0 }}>
        Nothing is spent until you send this. The DM says whether it lands.
      </p>
    </div>
  );
}
