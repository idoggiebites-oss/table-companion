/**
 * The three moments a phone should buzz.
 *
 * A table companion that needs watching is a table companion that gets put
 * face-down. Most of a session a player's phone is in their pocket and should
 * stay there — but three moments cost the table real time when they are
 * missed, and all three are somebody being waited for:
 *
 *   - your turn has come round
 *   - initiative is being rolled and yours is not in
 *   - the DM has asked YOU for a roll
 *
 * Nothing else nudges. Not damage, not a fight ending, not somebody else's
 * turn — a notification that arrives when nothing is being asked of you
 * teaches people to swipe them away without reading, and then the one that
 * mattered goes with it.
 *
 * Worked out on the device that APPENDS the event rather than in the room
 * server, which holds a log and has never had to understand it. That device
 * is awake by definition: it is the DM pressing Next turn, calling for
 * initiative, or asking for the roll.
 */

import type { Combat, Combatant } from "./combat.js";
import type { DomainEvent } from "./events.js";
import type { CampaignState } from "./project.js";

export interface Nudge {
  /** The character whose device should buzz. */
  readonly to: string;
  readonly title: string;
  readonly body: string;
}

/** Who a combatant belongs to, when it belongs to a player at all. */
function playerOf(c: Combatant | undefined): string | null {
  if (!c) return null;
  return c.controller.kind === "player" ? c.controller.characterId : null;
}

function upNow(combat: Combat | null): Combatant | undefined {
  return combat?.order[combat.turn];
}

/**
 * What to send, given events that have just been appended and the state they
 * produced. State AFTER, because "whose turn is it" is only answerable once
 * the turn has advanced.
 */
export function nudgesFor(
  events: readonly DomainEvent[],
  after: CampaignState,
  nameOf: (id: string) => string,
): Nudge[] {
  const out: Nudge[] = [];
  const seen = new Set<string>();
  const push = (n: Nudge) => {
    // One buzz per person per batch. Being told twice that it is your turn is
    // worse than being told once.
    if (seen.has(n.to)) return;
    seen.add(n.to);
    out.push(n);
  };

  for (const e of events) {
    switch (e.type) {
      case "turnAdvanced":
      case "combatBegan": {
        const who = playerOf(upNow(after.combat));
        if (who) {
          push({
            to: who,
            title: "Your turn",
            body: `${nameOf(who)} is up${
              after.combat ? ` · round ${after.combat.round}` : ""
            }.`,
          });
        }
        break;
      }

      case "combatStaged": {
        /*
         * Everyone in the fight, because initiative is the one roll the whole
         * table makes at once — and the one the DM ends up chasing.
         */
        for (const c of e.combatants) {
          const who = playerOf(c);
          if (who) {
            push({ to: who, title: "Roll for initiative", body: "A fight is starting." });
          }
        }
        break;
      }

      case "checkAsked": {
        for (const who of e.who) {
          push({
            to: who,
            title: e.kind === "save" ? "A save is owed" : "The DM wants a roll",
            body: e.dc === undefined ? `${e.what}.` : `${e.what} · DC ${e.dc}.`,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return out;
}

/**
 * Whether this device should be told about a nudge at all.
 *
 * A nudge is addressed to a CHARACTER; a device claims one or more. The
 * device that sent the events never buzzes itself — the DM pressing Next turn
 * does not need to be told they pressed it.
 */
export function forMe(n: Nudge, mine: readonly string[]): boolean {
  return mine.includes(n.to);
}
