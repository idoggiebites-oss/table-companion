/**
 * React's view of the log.
 *
 * The only way to change anything is to append an event, and the only way to
 * read anything is to project the log. That discipline is what lets the same
 * hook serve solo play and a synced room with no branching in the UI: joining
 * a room adds a transport, not a second source of truth.
 *
 * The log the projector sees is always `confirmed ++ pending` — server order
 * first, then whatever this device has done that the server has not ordered
 * yet. A local write shows instantly and settles into its real position when
 * the server answers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeEvent, type DomainEvent, type EventBody } from "../domain/events.js";
import { EMPTY_STATE, project, type CampaignState } from "../domain/project.js";
import { RoomConnection, type ConnectionStatus } from "../sync/client.js";
import type { RoomCredentials, StoredEvent } from "../sync/protocol.js";
import {
  appendLocal,
  clearLog,
  loadLog,
  readMeta,
  recordStored,
  writeMeta,
} from "./log.js";

const ROOM_KEY = "room";
const HEAD_KEY = "head";

export interface Campaign {
  readonly ready: boolean;
  readonly log: readonly DomainEvent[];
  readonly state: CampaignState;
  readonly append: (body: EventBody) => DomainEvent;
  readonly revert: (target: string) => void;
  readonly reset: () => void;
  readonly reverted: ReadonlySet<string>;
  /** Null when playing solo. */
  readonly room: RoomCredentials | null;
  readonly status: ConnectionStatus;
  readonly members: number;
  /**
   * Whether this device may sit in the DM's seat. Solo (no room) it may — a
   * device on its own is its own table. In a room only the creator may.
   * `null` means the server has not answered yet, and is deliberately not
   * treated as "no": a DM reloading must not be tipped out of their seat.
   */
  readonly dmRole: boolean | null;
  /** The DM's key, held only by a DM. Never sent to a player's device. */
  readonly dmKey: string | null;
  /** Present the key to become a DM on this device too. */
  readonly claimDm: (key: string) => Promise<boolean>;
  readonly joinRoom: (creds: RoomCredentials) => Promise<void>;
  readonly leaveRoom: () => Promise<void>;
}

export function useCampaign(actor = "local"): Campaign {
  const [confirmed, setConfirmed] = useState<StoredEvent[]>([]);
  const [pending, setPending] = useState<DomainEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [room, setRoom] = useState<RoomCredentials | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [members, setMembers] = useState(0);
  const [dmRole, setDmRole] = useState<boolean | null>(null);
  const [dmKey, setDmKey] = useState<string | null>(null);

  const conn = useRef<RoomConnection | null>(null);
  // Held in a ref so changing seats doesn't rebuild every callback.
  const actorRef = useRef(actor);
  actorRef.current = actor;
  const head = useRef(0);

  /** Server-ordered events win their position; ours settle out of pending. */
  const absorb = useCallback((stored: readonly StoredEvent[]) => {
    if (stored.length === 0) return;
    setConfirmed((prev) => {
      const seen = new Set(prev.map((s) => s.event.id));
      const merged = [...prev];
      for (const s of stored) if (!seen.has(s.event.id)) merged.push(s);
      return merged.sort((a, b) => a.seq - b.seq);
    });
    const landed = new Set(stored.map((s) => s.event.id));
    setPending((prev) => prev.filter((e) => !landed.has(e.id)));
    void recordStored(stored);
  }, []);

  const openConnection = useCallback(
    (creds: RoomCredentials, resend: readonly DomainEvent[]) => {
      conn.current?.close();
      const c = new RoomConnection(
        creds.code,
        creds.token,
        {
          onEvents: absorb,
          onHead: (h) => {
            head.current = h;
            void writeMeta(HEAD_KEY, h);
          },
          onStatus: (s, n) => {
            setStatus(s);
            setMembers(n);
          },
          onRole: (dm, key) => {
            setDmRole(dm);
            setDmKey(key ?? null);
          },
        },
        head.current,
        resend,
      );
      conn.current = c;
      c.connect();
    },
    [absorb],
  );

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [loaded, savedRoom, savedHead] = await Promise.all([
          loadLog(),
          readMeta<RoomCredentials>(ROOM_KEY),
          readMeta<number>(HEAD_KEY),
        ]);
        if (!live) return;
        setConfirmed(loaded.confirmed);
        setPending(loaded.pending);
        head.current = savedHead ?? 0;
        if (savedRoom) {
          setRoom(savedRoom);
          setDmRole(savedRoom.dm ?? null);
          openConnection(savedRoom, loaded.pending);
        }
      } catch {
        // A blocked IndexedDB shouldn't stop play; the session just won't
        // survive a reload.
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
      conn.current?.close();
      conn.current = null;
    };
  }, [openConnection]);

  const append = useCallback((body: EventBody) => {
    const event = makeEvent(body, actorRef.current);
    setPending((prev) => [...prev, event]);
    void appendLocal(event);
    conn.current?.push(event);
    return event;
  }, []);

  const revert = useCallback(
    (target: string) => {
      append({ type: "reverted", target });
    },
    [append],
  );

  const joinRoom = useCallback(
    async (creds: RoomCredentials) => {
      await writeMeta(ROOM_KEY, creds);
      setRoom(creds);
      setDmRole(creds.dm ?? null);
      // Everything written solo is pending, so it flows into the room on
      // connect — a character made before joining is not lost.
      const loaded = await loadLog();
      openConnection(creds, loaded.pending);
    },
    [openConnection],
  );

  /**
   * The server answers by pushing a fresh role down the open socket, so there
   * is nothing to reload and no second source of truth on this device.
   */
  const claimDm = useCallback(
    async (key: string) => {
      if (!room) return false;
      try {
        const res = await fetch(
          `/api/rooms/${encodeURIComponent(room.code)}/claim` +
            `?token=${encodeURIComponent(room.token)}&key=${encodeURIComponent(key)}`,
          { method: "POST" },
        );
        return res.ok;
      } catch {
        return false;
      }
    },
    [room],
  );

  const leaveRoom = useCallback(async () => {
    conn.current?.close();
    conn.current = null;
    await writeMeta(ROOM_KEY, undefined);
    setRoom(null);
    setStatus("offline");
    setMembers(0);
    setDmRole(null);
    setDmKey(null);
  }, []);

  const reset = useCallback(() => {
    conn.current?.close();
    conn.current = null;
    setConfirmed([]);
    setPending([]);
    setRoom(null);
    setStatus("offline");
    head.current = 0;
    void clearLog();
  }, []);

  const log = useMemo(
    () => [...confirmed.map((s) => s.event), ...pending],
    [confirmed, pending],
  );

  const state = useMemo(() => (log.length ? project(log) : EMPTY_STATE), [log]);

  const reverted = useMemo(() => {
    const s = new Set<string>();
    for (const e of log) if (e.type === "reverted") s.add(e.target);
    return s;
  }, [log]);

  return {
    ready, log, state, append, revert, reset, reverted,
    room, status, members, dmRole, dmKey, claimDm, joinRoom, leaveRoom,
  };
}
