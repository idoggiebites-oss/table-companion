/**
 * The client half of the transport.
 *
 * Deliberately dumb: it owns a socket, a queue of unconfirmed events, and a
 * high-water mark. It never merges, never resolves conflicts, and never
 * decides an order — it asks for everything after a sequence number and hands
 * what arrives to the caller.
 *
 * Reconnection is the whole point. Phones at a table sleep constantly, so
 * dropping and re-establishing is the normal case rather than the error case,
 * and it must be invisible: reconnect, say where you got to, flush what you
 * did while away.
 */

import type { DomainEvent } from "../domain/events.js";
import type { ClientMessage, ServerMessage, StoredEvent } from "./protocol.js";

export type ConnectionStatus = "offline" | "connecting" | "online";

export interface RoomHandlers {
  /** Events the server has ordered — may include ones already held. */
  readonly onEvents: (events: readonly StoredEvent[]) => void;
  readonly onHead: (head: number) => void;
  readonly onStatus: (status: ConnectionStatus, members: number) => void;
  /** Whether this device may sit in the DM's seat, and the key if it may. */
  readonly onRole: (dm: boolean, dmKey?: string) => void;
}

const RETRY_MIN_MS = 500;
const RETRY_MAX_MS = 15_000;

export class RoomConnection {
  private ws: WebSocket | null = null;
  private retry = RETRY_MIN_MS;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private head: number;
  /** Appended locally, not yet acknowledged. Re-sent on every connect. */
  private pending: DomainEvent[];

  constructor(
    private readonly code: string,
    private readonly token: string,
    private readonly handlers: RoomHandlers,
    head = 0,
    pending: readonly DomainEvent[] = [],
  ) {
    this.head = head;
    this.pending = [...pending];
  }

  get status(): ConnectionStatus {
    if (this.closed) return "offline";
    if (this.ws?.readyState === WebSocket.OPEN) return "online";
    return "connecting";
  }

  connect(): void {
    if (this.closed || this.ws) return;
    this.handlers.onStatus("connecting", 0);

    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const url = `${scheme}://${location.host}/api/rooms/${encodeURIComponent(
      this.code,
    )}/ws?token=${encodeURIComponent(this.token)}`;

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.retry = RETRY_MIN_MS;
      this.send({ t: "sync", since: this.head });
      this.flush();
    };

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      this.receive(msg);
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.closed) return;
      this.handlers.onStatus("connecting", 0);
      this.scheduleRetry();
    };

    // An error is always followed by close; let close own the retry.
    ws.onerror = () => {};
  }

  private scheduleRetry(): void {
    if (this.timer !== null) return;
    const wait = this.retry;
    this.retry = Math.min(RETRY_MAX_MS, Math.round(this.retry * 1.8));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, wait);
  }

  private receive(msg: ServerMessage): void {
    switch (msg.t) {
      case "welcome":
        this.head = Math.max(this.head, msg.head);
        this.handlers.onStatus("online", msg.members);
        this.handlers.onHead(this.head);
        break;
      case "events": {
        this.head = Math.max(this.head, msg.head);
        // Anything that comes back with a sequence number is no longer ours
        // to re-send.
        const landed = new Set(msg.events.map((e) => e.event.id));
        this.pending = this.pending.filter((e) => !landed.has(e.id));
        this.handlers.onEvents(msg.events);
        this.handlers.onHead(this.head);
        break;
      }
      case "you":
        this.handlers.onRole(msg.dm, msg.dmKey);
        break;
      case "error":
        // Nothing here is recoverable by retrying the same message, and the
        // socket stays usable, so surface it and carry on.
        console.warn(`room: ${msg.code} — ${msg.message}`);
        break;
    }
  }

  private send(msg: ClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private flush(): void {
    if (this.pending.length === 0) return;
    // Re-sending is safe: the server deduplicates on event id.
    this.send({ t: "append", events: this.pending });
  }

  /** Queue an event and send it if we can. Order is decided by the server. */
  push(event: DomainEvent): void {
    this.pending.push(event);
    if (!this.send({ t: "append", events: [event] })) {
      // Offline: it stays queued and goes out on the next connect.
    }
  }

  close(): void {
    this.closed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.ws?.close();
    this.ws = null;
    this.handlers.onStatus("offline", 0);
  }
}
