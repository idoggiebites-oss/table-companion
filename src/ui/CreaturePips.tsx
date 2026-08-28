/**
 * What a creature has left this turn.
 *
 * Players have had an action economy on screen since the beginning. Creatures
 * had a single boolean for the reaction, so a DM running six goblins tracked
 * "has that one used its bonus action" in their head, six times, every round
 * — and the answer, most evenings, was a guess.
 *
 * Three pips on the row, same as a player's, and they come back when the
 * creature's turn opens. Tapping one takes it back, because a mis-tap during
 * a fight needs one press and not a conversation.
 */

import { ECONOMY, type Economy, type EconomyKind } from "../domain/combat.js";
import type { EventBody } from "../domain/events.js";

const SHORT: Readonly<Record<EconomyKind, string>> = {
  action: "A",
  bonus: "B",
  reaction: "R",
};
const LONG: Readonly<Record<EconomyKind, string>> = {
  action: "action",
  bonus: "bonus action",
  reaction: "reaction",
};

export function CreaturePips({
  id, name, spent, append,
}: {
  id: string;
  name: string;
  spent: Economy | undefined;
  append: (body: EventBody) => void;
}) {
  return (
    <span className="cpips">
      {ECONOMY.map((kind) => {
        const gone = spent?.[kind] === true;
        return (
          <button
            key={kind}
            className={`cpip${gone ? " gone" : ""}`}
            aria-pressed={gone}
            aria-label={`${name} ${LONG[kind]}${gone ? ", spent" : ""}`}
            onClick={() =>
              append({ type: "creatureSpent", combatantId: id, kind, on: !gone })
            }
          >
            {SHORT[kind]}
          </button>
        );
      })}
    </span>
  );
}
