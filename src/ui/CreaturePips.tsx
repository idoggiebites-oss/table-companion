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

/*
 * Read on the row, not only by a screen reader.
 *
 * These were "A", "B" and "R", with the words they stand for living in the
 * aria-label — so the assistive reader heard "Goblin 1 bonus action" and the
 * person holding the phone got a letter. The first thing anyone asked about
 * this feature was what the letters meant.
 */
const SHORT: Readonly<Record<EconomyKind, string>> = {
  action: "ACT",
  bonus: "BON",
  reaction: "REA",
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
