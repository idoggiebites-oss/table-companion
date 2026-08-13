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

export type ClientMessage =
  /** Sent on connect: "I have up to `since`; send me the rest." */
  | { readonly t: "sync"; readonly since: number }
  /** Push local events. Safe to repeat — ids make it idempotent. */
  | { readonly t: "append"; readonly events: readonly DomainEvent[] };

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
  | { readonly t: "error"; readonly code: string; readonly message: string };

export interface RoomCredentials {
  readonly code: string;
  readonly token: string;
}

/**
 * Codes are read aloud at a table, so the alphabet excludes characters that
 * are heard or seen wrong: no O/0, I/1/L, S/5, B/8.
 */
export const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY2346789";
export const CODE_LENGTH = 6;

export function isCodeShaped(s: string): boolean {
  const up = s.trim().toUpperCase();
  if (up.length !== CODE_LENGTH) return false;
  return [...up].every((c) => CODE_ALPHABET.includes(c));
}

export function normaliseCode(s: string): string {
  return s.trim().toUpperCase();
}
