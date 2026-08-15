/**
 * The player's combat view, which is two screens rather than one.
 *
 * Almost all of a fight is spent NOT acting, and the two states want opposite
 * things. Waiting is one enormous number read across the table with nothing
 * to tap, because tapping is not what that moment is for. Acting is twenty
 * seconds where it becomes a tool.
 *
 * The reaction pip appears in both, and is the reason the economy is on the
 * waiting screen at all: it is the only thing you spend on somebody else's
 * turn, so it is the only part that has to stay legible while you do nothing.
 */

import { useState } from "react";
import type { ResolvedAttack } from "../domain/attack.js";
import { blockedBecause, STANDARD_ACTIONS } from "../domain/actions.js";
import { Swing } from "./Swing.js";
import {
  activeCombatant, controls, ECONOMY, isSurprised, movementLeft, turnsUntil,
  visibleTo, type Combat, type Combatant, type EconomyKind, type Seat,
} from "../domain/combat.js";
import type { CharacterId } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import type { CharacterState } from "../domain/project.js";

const LABEL: Record<EconomyKind, string> = {
  action: "Action",
  bonus: "Bonus",
  reaction: "Reaction",
};

function Pips({
  who, character, kinds, append,
}: {
  who: CharacterId;
  character: CharacterState;
  kinds: readonly EconomyKind[];
  append: (body: EventBody) => void;
}) {
  return (
    <div className="econ">
      {kinds.map((k) => {
        const spent = character.economy[k];
        return (
          <button
            key={k}
            className={`ec${spent ? " spent" : " up"}`}
            aria-pressed={spent}
            aria-label={`${LABEL[k]} ${spent ? "spent" : "available"}`}
            onClick={() => !spent && append({ type: "economySpent", who, kind: k })}
          >
            {LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Movement as a counter, not a map. The table already knows where everyone is
 * — from minis or from description — and what it loses track of is how much of
 * your thirty feet is left after you shuffled twice.
 */
function Movement({
  combat, combatant, append,
}: {
  combat: Combat;
  combatant: Combatant;
  append: (body: EventBody) => void;
}) {
  const left = movementLeft(combat, combatant);
  if (left === null) return null;
  const spend = (feet: number) =>
    append({ type: "movementSpent", combatantId: combatant.id, feet });

  return (
    <div className="mv">
      <span className="mv-n">
        <b className="num">{left}</b>
        {/* "45 of 30 ft" contradicts itself after a Dash, so say what happened
            instead of restating a budget the number has already exceeded. */}
        <small>{left > (combatant.speed ?? 0) ? "ft · dashed" : `of ${combatant.speed} ft`}</small>
      </span>
      <div className="mv-acts">
        <button aria-label="Move 5 feet" disabled={left < 5} onClick={() => spend(5)}>−5</button>
        <button aria-label="Move 15 feet" disabled={left < 15} onClick={() => spend(15)}>−15</button>
        <button aria-label="Dash" onClick={() => spend(-(combatant.speed ?? 0))}>Dash</button>
        <button
          aria-label="Take back movement"
          disabled={left >= (combatant.speed ?? 0)}
          onClick={() => spend(-5)}
        >
          +5
        </button>
      </div>
    </div>
  );
}

export function PlayerTurn({
  combat, seat, character, append, attacks = [], onSwing, canCast = false, onCast,
}: {
  combat: Combat;
  seat: Extract<Seat, { kind: "player" }>;
  character: CharacterState;
  append: (body: EventBody) => void;
  /** What they are actually holding — the walkthrough names the weapon. */
  attacks?: readonly ResolvedAttack[];
  onSwing?: (a: {
    attack: ResolvedAttack;
    target: Combatant;
    toHit: number;
    damage: number;
  }) => void;
  /** Whether they have any spells at all. */
  canCast?: boolean;
  /** Takes them to the spell list, which is where casting lives. */
  onCast?: () => void;
}) {
  const [picking, setPicking] = useState<null | "attack" | "opportunity" | "menu">(null);
  const [took, setTook] = useState<string | null>(null);
  const [looking, setLooking] = useState<string | null>(null);
  const who = seat.characterId;
  const active = activeCombatant(combat);
  const acting = active?.source.kind === "character" && active.source.characterId === who;
  /** Your summon is up: you are acting, even though it is not you. */
  const proxy = !acting && active !== null && controls(seat, active.controller);
  const away = turnsUntil(combat, who);

  const self = combat.order.find(
    (c) => c.source.kind === "character" && c.source.characterId === who,
  );
  const visibleTargets = combat.order.filter(
    (c) =>
      visibleTo(seat, c) &&
      c.source.kind === "creature" &&
      (combat.creatureHp[c.id] ?? 1) > 0,
  );

  if (acting) {
    const surprised = self ? isSurprised(combat, self) : false;
    return (
      <div className="pt acting">
        <div className="pt-turn">
          Your turn
          {surprised && <small>Surprised — you cannot act this round</small>}
        </div>
        {!surprised && (
          <>
            <Pips who={who} character={character} kinds={ECONOMY} append={append} />
            {self && <Movement combat={combat} combatant={self} append={append} />}
            {picking === "menu" ? (
              <div className="menu">
                {/*
                  * Names and costs only, until you point at one. Eleven
                  * explanations at once is a rulebook, and a rulebook is what
                  * a new player already could not read — the whole list has
                  * to fit on the screen for the menu to be the teaching.
                  */}
                {STANDARD_ACTIONS.map((a) => {
                  const why = blockedBecause(a, character.economy, attacks.length > 0, canCast);
                  const shown = looking === a.id;
                  return (
                    <div className={`menu-row${why ? " off" : ""}`} key={a.id}>
                      <button
                        className="menu-hd"
                        aria-expanded={shown}
                        aria-label={a.name}
                        onClick={() => setLooking(shown ? null : a.id)}
                      >
                        <span className="nm">{a.name}</span>
                        <span className="cost">{a.cost}</span>
                      </button>
                      {shown && (
                        <div className="menu-more">
                          <p className="what">{why ?? a.what}</p>
                          {!why && a.then && <p className="then">{a.then}</p>}
                          {!why && (
                            <button
                              className="menu-take"
                              onClick={() => {
                                if (a.id === "attack") return setPicking("attack");
                                // Casting has its own screen; the menu's job
                                // is to say it exists and take you there.
                                if (a.id === "cast") {
                                  setPicking(null);
                                  return onCast?.();
                                }
                                append({ type: "economySpent", who, kind: a.cost });
                                if (a.id === "dash" && self?.speed) {
                                  append({
                                    type: "movementSpent",
                                    combatantId: self.id,
                                    feet: -self.speed,
                                  });
                                }
                                setTook(a.id);
                                setLooking(null);
                                setPicking(null);
                              }}
                            >
                              Do it
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => setPicking(null)}>Back</button>
              </div>
            ) : picking === "attack" ? (
              <Swing
                attacks={attacks}
                targets={visibleTargets}
                onCancel={() => setPicking(null)}
                onSend={(swing) => {
                  if (!character.economy.action) {
                    append({ type: "economySpent", who, kind: "action" });
                  }
                  onSwing?.(swing);
                }}
              />
            ) : (
              <>
                <button
                  className="pt-atk"
                  disabled={character.economy.action || attacks.length === 0}
                  onClick={() => setPicking("attack")}
                >
                  {attacks.length > 0 ? `Attack with ${attacks[0]!.name}` : "Attack"}
                  {attacks.length > 1 && <small> or something else</small>}
                </button>
                <button className="pt-more" onClick={() => setPicking("menu")}>
                  What else can I do?
                </button>
                {took && (
                  <p className="pt-took">
                    {STANDARD_ACTIONS.find((a) => a.id === took)?.name} taken.{" "}
                    {STANDARD_ACTIONS.find((a) => a.id === took)?.then ??
                      "Tell the table."}
                  </p>
                )}
                {/* Beginners do not know an attack IS the action. */}
                <p className="pt-why">
                  {character.economy.action
                    ? "Your action is gone. You can still move, and you keep your reaction for somebody else's turn."
                    : "Attacking costs your action. You get one a turn."}
                </p>
              </>
            )}
          </>
        )}
        <button
          className="pt-end"
          onClick={() => append({ type: "turnAdvanced", from: combat.turn })}
        >
          End turn
        </button>
      </div>
    );
  }

  if (proxy && active) {
    return (
      <div className="pt acting">
        <div className="pt-turn">{active.name}<small>You control it</small></div>
        <button
          className="pt-end"
          onClick={() => append({ type: "turnAdvanced", from: combat.turn })}
        >
          End its turn
        </button>
      </div>
    );
  }

  return (
    <div className="pt waiting">
      <div className="pt-dist">
        <span className="num">{away ?? "—"}</span>
        <small>{away === 1 ? "turn away" : "turns away"}</small>
      </div>
      {/* The one part of the economy that matters while you are doing nothing. */}
      <Pips who={who} character={character} kinds={["reaction"]} append={append} />

      {/* The reaction pip has always been here for this. An opportunity
          attack is the reason it stays on screen while you do nothing. */}
      {picking === "opportunity" ? (
        <Swing
          attacks={attacks}
          targets={visibleTargets}
          onCancel={() => setPicking(null)}
          onSend={(swing) => {
            if (self) {
              append({
                type: "opportunityTaken",
                attacker: self.id,
                attackerWho: who,
                against: swing.target.id,
              });
            }
            onSwing?.(swing);
          }}
        />
      ) : (
        !character.economy.reaction && (
          <button className="pt-opp" onClick={() => setPicking("opportunity")}>
            Opportunity attack
          </button>
        )
      )}
    </div>
  );
}
