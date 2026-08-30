/**
 * Your turn, from wherever you are looking.
 *
 * A player wanders off to their sheet or their gear between turns — which is
 * the point of those screens — and then it is their turn and the app says so
 * with a dot on a tab. The fix for "I did not notice" was never a louder dot;
 * it is that the thing you need is reachable without first navigating back to
 * find it.
 *
 * So this appears only when all three are true: you are a player, it is your
 * turn, and you are NOT on the fight — where the whole turn is already on
 * screen and a second copy of it would be a door into a room you are standing
 * in.
 *
 * Dodge is the one that ACTS here rather than navigating. It is the only
 * common action that needs no target, no roll and no choice, so it is the only
 * one that can honestly be taken from a bar without showing you anything
 * first. Everything else opens the place where its question gets asked.
 */

import type { EventBody } from "../domain/events.js";

export type TurnBarGo = "combat" | "gear" | "notes";

export function TurnBar({
  who, selfId, actionSpent, dodging, onGo, append,
}: {
  /** The character, for the economy event. */
  who: string;
  /** Their combatant id, for the stance tag. Absent if not in the order. */
  selfId: string | null;
  actionSpent: boolean;
  dodging: boolean;
  onGo: (tab: TurnBarGo) => void;
  append: (body: EventBody) => void;
}) {
  return (
    <nav className="turnbar" aria-label="Your turn">
      <button
        className="tb"
        aria-label="Attack — opens the fight"
        onClick={() => onGo("combat")}
      >
        <span className="g" aria-hidden="true">{"⚔"}</span>
        <span className="l">Attack</span>
      </button>
      <button
        className={`tb${dodging ? " on" : ""}`}
        disabled={actionSpent || selfId === null}
        aria-label={dodging ? "Already dodging" : "Dodge"}
        onClick={() => {
          /* The one action a bar can honestly take: no target, no roll, no
             choice. Undoable like everything else. */
          append({ type: "economySpent", who, kind: "action" });
          if (selfId) {
            append({ type: "stanceTagAdded", combatantId: selfId, tag: "dodging" });
          }
        }}
      >
        <span className="g" aria-hidden="true">{"⛨"}</span>
        <span className="l">{dodging ? "Dodging" : "Dodge"}</span>
      </button>
      <button
        className="tb"
        aria-label="Use item — opens your gear"
        onClick={() => onGo("gear")}
      >
        <span className="g" aria-hidden="true">{"⚒"}</span>
        <span className="l">Use item</span>
      </button>
      <button
        className="tb"
        aria-label="Notes"
        onClick={() => onGo("notes")}
      >
        <span className="g" aria-hidden="true">{"✎"}</span>
        <span className="l">Notes</span>
      </button>
      <button
        className="tb"
        aria-label="Roll — opens the fight, where a roll is asked for"
        onClick={() => onGo("combat")}
      >
        <span className="g" aria-hidden="true">{"⚄"}</span>
        <span className="l">Roll</span>
      </button>
    </nav>
  );
}
