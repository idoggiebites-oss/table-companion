/**
 * One Durable Object per campaign.
 *
 * The DO's whole job is to be the sequencer: it decides the order of the
 * event log and hands that order to everyone. It holds no derived state —
 * clients project the log themselves — which means a client that has been
 * asleep for ten minutes needs nothing but "everything after seq N".
 *
 * Connections use the hibernation API, so a table full of sleeping phones
 * costs nothing while nobody is doing anything.
 */

import { DurableObject } from "cloudflare:workers";
import type { DomainEvent } from "../src/domain/events.js";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  isCodeShaped,
  normaliseCode,
  type ClientMessage,
  type ServerMessage,
  type StoredEvent,
} from "../src/sync/protocol.js";

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
}

/**
 * How long a room accepts new members. Long enough that someone arriving an
 * hour late still gets in, short enough that a code read aloud in a pub is
 * not a permanent key. Existing members keep their tokens regardless.
 */
const JOIN_WINDOW_MS = 12 * 60 * 60 * 1000;

const MAX_EVENTS_PER_APPEND = 500;

function randomFrom(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

const newToken = () => crypto.randomUUID();

interface Attachment {
  readonly token: string;
}

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS meta (
          k TEXT PRIMARY KEY,
          v TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS members (
          token TEXT PRIMARY KEY,
          joined INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL UNIQUE,
          payload TEXT NOT NULL
        );
      `);
    });
  }

  // ---- metadata -----------------------------------------------------------

  private meta(key: string): string | null {
    const row = this.ctx.storage.sql
      .exec<{ v: string }>("SELECT v FROM meta WHERE k = ?", key)
      .toArray()[0];
    return row?.v ?? null;
  }

  private setMeta(key: string, value: string): void {
    this.ctx.storage.sql.exec(
      "INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
      key,
      value,
    );
  }

  private head(): number {
    const row = this.ctx.storage.sql
      .exec<{ head: number | null }>("SELECT MAX(seq) AS head FROM events")
      .toArray()[0];
    return row?.head ?? 0;
  }

  private memberCount(): number {
    return (
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM members")
        .toArray()[0]?.n ?? 0
    );
  }

  private isMember(token: string): boolean {
    return (
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM members WHERE token = ?", token)
        .toArray()[0]?.n === 1
    );
  }

  private addMember(): string {
    const token = newToken();
    this.ctx.storage.sql.exec(
      "INSERT INTO members (token, joined) VALUES (?, ?)",
      token,
      Date.now(),
    );
    return token;
  }

  // ---- RPC ----------------------------------------------------------------

  /** Creates the room if it does not exist and returns the creator's token. */
  async create(): Promise<{ token: string; created: boolean }> {
    if (this.meta("createdAt") !== null) {
      // Astronomically unlikely code collision — refuse rather than join
      // someone else's campaign silently.
      return { token: "", created: false };
    }
    this.setMeta("createdAt", String(Date.now()));
    return { token: this.addMember(), created: true };
  }

  async join(): Promise<{ token: string } | { error: string }> {
    const createdAt = this.meta("createdAt");
    if (createdAt === null) return { error: "no-such-room" };
    if (Date.now() - Number(createdAt) > JOIN_WINDOW_MS) {
      return { error: "joining-closed" };
    }
    return { token: this.addMember() };
  }

  // ---- the log ------------------------------------------------------------

  private after(seq: number): StoredEvent[] {
    return this.ctx.storage.sql
      .exec<{ seq: number; payload: string }>(
        "SELECT seq, payload FROM events WHERE seq > ? ORDER BY seq",
        seq,
      )
      .toArray()
      .map((r) => ({ seq: r.seq, event: JSON.parse(r.payload) as DomainEvent }));
  }

  /**
   * Stores what it has not seen before and returns only that. INSERT OR
   * IGNORE against the UNIQUE id is the whole idempotency story: a client
   * flushing its offline queue can re-send freely.
   */
  private store(events: readonly DomainEvent[]): StoredEvent[] {
    const stored: StoredEvent[] = [];
    for (const event of events) {
      if (typeof event?.id !== "string" || typeof event?.type !== "string") continue;
      const row = this.ctx.storage.sql
        .exec<{ seq: number }>(
          "INSERT OR IGNORE INTO events (id, payload) VALUES (?, ?) RETURNING seq",
          event.id,
          JSON.stringify(event),
        )
        .toArray()[0];
      if (row) stored.push({ seq: row.seq, event });
    }
    return stored;
  }

  // ---- websockets ---------------------------------------------------------

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    if (!this.isMember(token)) {
      return new Response("not a member of this room", { status: 403 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    server.serializeAttachment({ token } satisfies Attachment);
    // Hibernatable: the object leaves memory while the table is quiet and the
    // sockets stay open.
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // A socket that died between getWebSockets() and here is not an error.
    }
  }

  private broadcast(msg: ServerMessage): void {
    for (const ws of this.ctx.getWebSockets()) this.send(ws, msg);
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      this.send(ws, { t: "error", code: "bad-json", message: "Could not parse that." });
      return;
    }

    if (msg.t === "sync") {
      const since = Number.isFinite(msg.since) ? Math.max(0, msg.since) : 0;
      // Everyone gets the new count, not just the arrival — otherwise the
      // first person in the room reads "1 joined" for the whole session.
      this.broadcast({ t: "welcome", head: this.head(), members: this.memberCount() });
      const missed = this.after(since);
      if (missed.length > 0) {
        this.send(ws, { t: "events", events: missed, head: this.head() });
      }
      return;
    }

    if (msg.t === "append") {
      if (!Array.isArray(msg.events) || msg.events.length > MAX_EVENTS_PER_APPEND) {
        this.send(ws, { t: "error", code: "too-many", message: "Too many events at once." });
        return;
      }
      const stored = this.store(msg.events);
      if (stored.length > 0) {
        // Including the sender: everyone learns the same sequence numbers, so
        // everyone projects the same order. A duplicate id stores nothing and
        // is therefore silent, which is correct — the sender already has it.
        this.broadcast({ t: "events", events: stored, head: this.head() });
      }
      return;
    }

    this.send(ws, { t: "error", code: "unknown", message: "Unknown message." });
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close(1000, "closed");
    } catch {
      // Already gone.
    }
  }
}

// ---- the Worker in front of it ---------------------------------------------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/rooms" && request.method === "POST") {
      // Try a few codes so a collision is a retry rather than an error.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomFrom(CODE_ALPHABET, CODE_LENGTH);
        const result = await env.ROOM.getByName(code).create();
        if (result.created) return json({ code, token: result.token });
      }
      return json({ error: "could-not-allocate" }, 503);
    }

    const roomMatch = /^\/api\/rooms\/([^/]+)\/(join|ws)$/.exec(path);
    if (roomMatch) {
      const code = normaliseCode(decodeURIComponent(roomMatch[1]!));
      const action = roomMatch[2];
      if (!isCodeShaped(code)) return json({ error: "bad-code" }, 400);

      const stub = env.ROOM.getByName(code);

      if (action === "join" && request.method === "POST") {
        const result = await stub.join();
        return "error" in result ? json(result, 404) : json({ code, ...result });
      }
      if (action === "ws") return stub.fetch(request);
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
