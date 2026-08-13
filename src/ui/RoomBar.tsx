/**
 * Creating and joining a room.
 *
 * The join flow is the product's most fragile forty seconds — a player who
 * has never seen the app types six characters and has to be in. So the code
 * uses an alphabet without O/0, I/1/L, S/5 or B/8, because it gets read aloud
 * across a table rather than copied.
 */

import { useState } from "react";
import type { ConnectionStatus } from "../sync/client.js";
import { isCodeShaped, normaliseCode, type RoomCredentials } from "../sync/protocol.js";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  offline: "Solo",
  connecting: "Connecting",
  online: "Live",
};

async function post(url: string): Promise<Record<string, string>> {
  const res = await fetch(url, { method: "POST" });
  return (await res.json()) as Record<string, string>;
}

export function RoomBar({
  room, status, members, onJoin, onLeave,
}: {
  room: RoomCredentials | null;
  status: ConnectionStatus;
  members: number;
  onJoin: (creds: RoomCredentials) => Promise<void>;
  onLeave: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await post("/api/rooms");
      if (!res.code || !res.token) throw new Error("no room");
      await onJoin({ code: res.code, token: res.token });
    } catch {
      setError("Could not start a room.");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    const c = normaliseCode(code);
    if (!isCodeShaped(c)) {
      setError("A code is six characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await post(`/api/rooms/${encodeURIComponent(c)}/join`);
      if (!res.token) {
        setError(res.error === "joining-closed" ? "That room is closed." : "No room with that code.");
        return;
      }
      await onJoin({ code: c, token: res.token });
      setCode("");
    } catch {
      setError("Could not reach the room.");
    } finally {
      setBusy(false);
    }
  }

  if (room) {
    return (
      <div className="roombar">
        <span className="rb-code num" title="Read this out to join">{room.code}</span>
        <span className={`rb-status s-${status}`}>
          {STATUS_LABEL[status]}
          {status === "online" && members > 0 ? ` · ${members} joined` : ""}
        </span>
        <button onClick={() => void onLeave()}>Leave</button>
      </div>
    );
  }

  return (
    <div className="roombar">
      <span className="rb-status s-offline">{STATUS_LABEL.offline}</span>
      <input
        className="rb-input num"
        value={code}
        maxLength={6}
        placeholder="CODE"
        aria-label="Room code"
        onChange={(e) => setCode(normaliseCode(e.target.value))}
        onKeyDown={(e) => e.key === "Enter" && void join()}
      />
      <button disabled={busy || code.length === 0} onClick={() => void join()}>Join</button>
      <button disabled={busy} onClick={() => void create()}>Start a room</button>
      {error && <span className="rb-error">{error}</span>}
    </div>
  );
}
