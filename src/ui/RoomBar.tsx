/**
 * Creating and joining a room, and the room's own controls once you are in.
 *
 * The join flow is the product's most fragile forty seconds — a player who
 * has never seen the app types six characters and has to be in. So the code
 * uses an alphabet without O/0, I/1/L, S/5 or B/8, because it gets read aloud
 * across a table rather than copied.
 *
 * Two components, because the two moments could not be less alike. Getting IN
 * is the whole screen for forty seconds and then never again; being in is a
 * code, a status, and three buttons a table touches roughly twice a session —
 * so those live in a sheet, and the header keeps the code and a dot.
 */

import { useState } from "react";
import type { ConnectionStatus } from "../sync/client.js";
import {
  formatDmKey, isCodeShaped, isDmKeyShaped, normaliseCode, normaliseDmKey,
  type RoomCredentials,
} from "../sync/protocol.js";

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
  room, onJoin,
}: {
  room: RoomCredentials | null;
  onJoin: (creds: RoomCredentials) => Promise<void>;
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
      await onJoin({ code: res.code, token: res.token, dm: true });
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
      await onJoin({ code: c, token: res.token, dm: false });
      setCode("");
    } catch {
      setError("Could not reach the room.");
    } finally {
      setBusy(false);
    }
  }

  if (room) return null;

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

/**
 * The room, once you are in it: what the connection is doing, the key that
 * lets a second device be the DM, and the way out.
 *
 * These sat in a bar across the top of every screen — a hundred pixels of
 * chrome, permanently, for three controls a table presses about twice a
 * night. The header keeps the two things that are read rather than pressed:
 * the code, and a dot for the connection. The rest is here.
 */
export function RoomMenu({
  room, status, members, dmRole, dmKey, onLeave, onClaim,
}: {
  room: RoomCredentials;
  status: ConnectionStatus;
  members: number;
  dmRole: boolean | null;
  dmKey: string | null;
  onLeave: () => Promise<void>;
  onClaim: (key: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimKey, setClaimKey] = useState("");
  const [claimError, setClaimError] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setClaimError(null);
    const won = await onClaim(normaliseDmKey(claimKey));
    setBusy(false);
    if (won) {
      setClaiming(false);
      setClaimKey("");
    } else {
      setClaimError("That key does not match.");
    }
  }

  return (
    <div className="rm">
      {/* The code is in the header, where it is read from; this is what the
          header's dot could only say in a colour. */}
      <p className="rm-said">
        <span className={`rb-status s-${status}`}>
          {STATUS_LABEL[status]}
          {status === "online" && members > 0 ? ` · ${members} joined` : ""}
        </span>
      </p>

      {/* A secret does not belong on screen by default — this used to sit in
          the one bar everyone at the table leans over to read. */}
      {dmKey && !showKey && (
        <button onClick={() => setShowKey(true)}>DM key</button>
      )}
      {dmKey && showKey && (
        <p className="rm-said">
          <span className="label">DM key</span>
          <span className="rm-key num">{formatDmKey(dmKey)}</span>
          <span className="rb-hint">Your other devices only. Not the players.</span>
          <button onClick={() => setShowKey(false)}>Hide</button>
        </p>
      )}

      {dmRole === false && !claiming && (
        <button onClick={() => setClaiming(true)}>I&rsquo;m the DM</button>
      )}
      {dmRole === false && claiming && (
        <p className="rm-said">
          <span className="label">DM key</span>
          <input
            className="rb-input num"
            value={formatDmKey(claimKey)}
            maxLength={9}
            placeholder="XXXX-XXXX"
            aria-label="DM key"
            onChange={(e) => {
              setClaimKey(normaliseDmKey(e.target.value));
              setClaimError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && isDmKeyShaped(claimKey) && void claim()}
          />
          <button disabled={busy || !isDmKeyShaped(claimKey)} onClick={() => void claim()}>
            Claim DM
          </button>
          <button onClick={() => { setClaiming(false); setClaimError(null); }}>Cancel</button>
          {claimError && <span className="rb-error">{claimError}</span>}
        </p>
      )}

      <button onClick={() => void onLeave()}>Leave</button>
    </div>
  );
}
