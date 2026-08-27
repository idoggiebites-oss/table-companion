/**
 * The wire protocol, shared by the client and the Durable Object.
 *
 * The log is the only thing that crosses the wire. There is no "state"
 * message and no diffing: a client sends events it has, the server assigns
 * them an order, and every client projects the same log to the same state.
 * That is what makes reconnection a replay rather than a reconciliation.
 *
 * Two properties carry the correctness:
 *
 *   - Every event has a client-generated id, and the server stores it with a
 *     UNIQUE constraint. Re-sending after a dropped acknowledgement is a
 *     no-op, which is what makes the offline queue safe to flush blindly.
 *   - The server assigns the sequence numbers, so ordering is decided in one
 *     place. A client only ever asks "what happened after seq N".
 */

import type { DomainEvent } from "../domain/events.js";

/** An event once the server has given it a place in the order. */
export interface StoredEvent {
  readonly seq: number;
  readonly event: DomainEvent;
}

/** A browser's push subscription, as the Push API hands it over. */
export interface PushSub {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

export type ClientMessage =
  /** Sent on connect: "I have up to `since`; send me the rest." */
  | { readonly t: "sync"; readonly since: number }
  /** Push local events. Safe to repeat — ids make it idempotent. */
  | { readonly t: "append"; readonly events: readonly DomainEvent[] }
  /**
   * "Buzz this phone when these characters are being waited for."
   *
   * Kept per character rather than per device: a player who picks up a spare
   * phone should get their own turn, and a device that has claimed nobody has
   * nothing to be told about.
   */
  | {
      readonly t: "watch";
      readonly sub: PushSub;
      readonly characters: readonly string[];
    }
  | { readonly t: "unwatch"; readonly endpoint: string }
  /**
   * "Somebody is being waited for."
   *
   * Worked out on the device that appended the events, because it is the one
   * holding the projection — and it is awake by definition, since it is the
   * DM pressing the button. The room server holds a log and has never had to
   * understand it; that stays true.
   */
  | {
      readonly t: "nudge";
      readonly nudges: readonly {
        readonly to: string;
        readonly title: string;
        readonly body: string;
      }[];
    };

export type ServerMessage =
  | {
      readonly t: "welcome";
      readonly head: number;
      readonly members: number;
    }
  | {
      readonly t: "events";
      readonly events: readonly StoredEvent[];
      readonly head: number;
    }
  /**
   * Who this ONE socket is. Deliberately not a field on `welcome`: welcome is
   * broadcast to the whole room, and a per-socket fact riding on a broadcast
   * is a leak waiting to happen — every device would read the last arrival's
   * answer as its own.
   */
  | {
      readonly t: "you";
      readonly dm: boolean;
      /** Only ever sent to a DM — a player's device never holds this. */
      readonly dmKey?: string;
    }
  | { readonly t: "error"; readonly code: string; readonly message: string };

export interface RoomCredentials {
  readonly code: string;
  readonly token: string;
  /**
   * Seeded from which button was pressed — start a room, or join one. The
   * server confirms it on connect and is the authority; this only closes the
   * window before the socket is up, during which a joiner would otherwise be
   * sitting in the DM's seat.
   */
  readonly dm?: boolean;
}

/**
 * Codes are read aloud at a table, so the alphabet excludes characters that
 * are heard or seen wrong: no O/0, I/1/L, S/5, B/8.
 */
export const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY2346789";
export const CODE_LENGTH = 6;

/**
 * The DM key is longer than a join code and grouped, because it is typed once
 * from a screen rather than shouted across a table. Same alphabet: it is still
 * read by a human.
 */
export const DM_KEY_LENGTH = 8;

export function formatDmKey(raw: string): string {
  const up = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return up.length > 4 ? `${up.slice(0, 4)}-${up.slice(4, 8)}` : up;
}

export function normaliseDmKey(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, DM_KEY_LENGTH);
}

export function isDmKeyShaped(s: string): boolean {
  const up = normaliseDmKey(s);
  return up.length === DM_KEY_LENGTH && [...up].every((c) => CODE_ALPHABET.includes(c));
}

export function isCodeShaped(s: string): boolean {
  const up = s.trim().toUpperCase();
  if (up.length !== CODE_LENGTH) return false;
  return [...up].every((c) => CODE_ALPHABET.includes(c));
}

export function normaliseCode(s: string): string {
  return s.trim().toUpperCase();
}
