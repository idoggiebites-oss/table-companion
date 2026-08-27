/**
 * "Can I re-roll?"
 *
 * A character is built once and then only ever added to — levels, hit points,
 * items. There was no way back. A player who put their 15 in the wrong place
 * on their first evening, or whose subclass turned out to be nothing like
 * they expected, was stuck with it or asking the DM to delete them and start
 * again, which loses everything that happened since.
 *
 * The shape is law two's, the same as an attack: the player claims, the DM
 * confirms. A player cannot quietly re-roll their own scores between sessions
 * any more than they can quietly apply their own damage — not because they
 * would cheat, but because a character changing without the table noticing is
 * the sort of thing that gets discovered three weeks later in an argument.
 *
 * A grant is spent by using it. It opens a door, it does not remove one:
 * being allowed to rebuild once is different from being allowed to rebuild.
 */

import type { CharacterId } from "./build.js";

export interface EditAsk {
  readonly id: string;
  readonly who: CharacterId;
  /** Denormalised: the log has to read after the character is long changed. */
  readonly whoName: string;
  /** Why they are asking. Optional — "can I re-roll" is a complete sentence. */
  readonly why?: string;
  readonly at: number;
  /**
   * Unanswered while absent. The DM's answer, not the outcome — a granted ask
   * that was never used is still granted.
   */
  readonly granted?: boolean;
  /** Set when the rebuild actually happens, which is what spends the grant. */
  readonly used?: boolean;
}

/** Waiting on the DM. What the DM's screen shows a badge for. */
export function isPending(ask: EditAsk): boolean {
  return ask.granted === undefined;
}

/**
 * Whether this character may rebuild right now.
 *
 * The most recent granted-and-unused ask, rather than any of them: two asks
 * granted in one evening are two rebuilds, and an old grant left lying around
 * is a door nobody remembers opening.
 */
export function mayRebuild(asks: readonly EditAsk[], who: CharacterId): boolean {
  return asks.some((a) => a.who === who && a.granted === true && a.used !== true);
}

/** The one a rebuild spends: the oldest open grant, so they queue honestly. */
export function grantToSpend(
  asks: readonly EditAsk[],
  who: CharacterId,
): EditAsk | undefined {
  return asks.find((a) => a.who === who && a.granted === true && a.used !== true);
}

/** What the DM still has to answer. */
export function pendingFor(asks: readonly EditAsk[]): EditAsk[] {
  return asks.filter(isPending);
}

/** One line, from either side. */
export function describeAsk(ask: EditAsk): string {
  const why = ask.why?.trim();
  if (ask.granted === false) return `${ask.whoName} was told no`;
  if (ask.used) return `${ask.whoName} rebuilt their character`;
  if (ask.granted) return `${ask.whoName} may rebuild`;
  return why
    ? `${ask.whoName} asks to change their character — ${why}`
    : `${ask.whoName} asks to change their character`;
}
