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

/**
 * Who you are swinging at.
 *
 * Only creatures the disclosure ladder already shows you — a target list is
 * exactly the wrong place to leak the existence of something hidden.
 */
function Targets({
  combat, seat, label, onPick, onClose,
}: {
  combat: Combat;
  seat: Extract<Seat, { kind: "player" }>;
  label: string;
  onPick: (c: Combatant) => void;
  onClose: () => void;
}) {
  const targets = combat.order.filter(
    (c) =>
      visibleTo(seat, c) &&
      c.source.kind === "creature" &&
      (combat.creatureHp[c.id] ?? 1) > 0,
  );
  return (
    <div className="tgt">
      <span className="label">{label}</span>
      {targets.map((c) => (
        <button className="tgt-row" key={c.id} onClick={() => onPick(c)}>
          {c.name}
        </button>
      ))}
      {targets.length === 0 && (
        <p className="faint" style={{ margin: "6px 0", fontSize: ".84rem" }}>
          Nothing you can see.
        </p>
      )}
      <button onClick={onClose}>Cancel</button>
    </div>
  );
}

export function PlayerTurn({
  combat, seat, character, append, onAttack,
}: {
  combat: Combat;
  seat: Extract<Seat, { kind: "player" }>;
  character: CharacterState;
  append: (body: EventBody) => void;
  /** Hands the chosen target up so the sheet can open the right roll. */
  onAttack?: (target: Combatant) => void;
}) {
  const [picking, setPicking] = useState<null | "attack" | "opportunity">(null);
  const who = seat.characterId;
  const active = activeCombatant(combat);
  const acting = active?.source.kind === "character" && active.source.characterId === who;
  /** Your summon is up: you are acting, even though it is not you. */
  const proxy = !acting && active !== null && controls(seat, active.controller);
  const away = turnsUntil(combat, who);

  const self = combat.order.find(
    (c) => c.source.kind === "character" && c.source.characterId === who,
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
            {picking === "attack" ? (
              <Targets
                combat={combat}
                seat={seat}
                label="Attack which"
                onClose={() => setPicking(null)}
                onPick={(c) => {
                  if (!character.economy.action) {
                    append({ type: "economySpent", who, kind: "action" });
                  }
                  onAttack?.(c);
                  setPicking(null);
                }}
              />
            ) : (
              <button className="pt-atk" onClick={() => setPicking("attack")}>
                Attack
              </button>
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
        <Targets
          combat={combat}
          seat={seat}
          label="Opportunity attack on"
          onClose={() => setPicking(null)}
          onPick={(c) => {
            if (self) {
              append({
                type: "opportunityTaken",
                attacker: self.id,
                attackerWho: who,
                against: c.id,
              });
            }
            onAttack?.(c);
            setPicking(null);
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
