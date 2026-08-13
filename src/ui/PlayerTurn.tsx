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

import {
  activeCombatant, controls, ECONOMY, turnsUntil,
  type Combat, type EconomyKind, type Seat,
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

export function PlayerTurn({
  combat, seat, character, append,
}: {
  combat: Combat;
  seat: Extract<Seat, { kind: "player" }>;
  character: CharacterState;
  append: (body: EventBody) => void;
}) {
  const who = seat.characterId;
  const active = activeCombatant(combat);
  const acting = active?.source.kind === "character" && active.source.characterId === who;
  /** Your summon is up: you are acting, even though it is not you. */
  const proxy = !acting && active !== null && controls(seat, active.controller);
  const away = turnsUntil(combat, who);

  if (acting) {
    return (
      <div className="pt acting">
        <div className="pt-turn">Your turn</div>
        <Pips who={who} character={character} kinds={ECONOMY} append={append} />
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
    </div>
  );
}
