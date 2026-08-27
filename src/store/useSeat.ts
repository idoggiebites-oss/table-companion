/**
 * Which seat this device is sitting in, and which characters are its own.
 *
 * Deliberately NOT in the event log. A seat is a property of the device, not
 * of the campaign — two people sharing a tablet swap seats without that
 * needing to be a fact everybody else replays.
 *
 * The device also remembers WHICH characters belong to it. Without that, the
 * seat dropdown listed the whole party and any player could sit in anyone
 * else's character — reading their sheet and spending their resources. A
 * device claims a character by making one, or by choosing once when it joins
 * a campaign that already has them; after that the dropdown only offers what
 * it claimed. Someone running two characters gets both, which is the only
 * reason the dropdown still exists on a player's screen.
 *
 * This is not a permission: the DM can still seat anyone, and nothing stops a
 * determined person clearing storage. It stops the accident, which is the
 * thing that actually happens at a table.
 */

import { useCallback, useEffect, useState } from "react";
import type { CharacterId } from "../domain/build.js";
import type { Seat } from "../domain/combat.js";
import { readMeta, writeMeta } from "./log.js";

const SEAT_KEY = "seat";
const MINE_KEY = "myCharacters";

export interface SeatState {
  readonly seat: Seat;
  readonly mine: readonly CharacterId[];
  readonly setSeat: (seat: Seat) => void;
  /** Remembers a character as this device's, and sits in it. */
  readonly claim: (id: CharacterId) => void;
  /** Hold it, but stay where you are. */
  readonly claimOnly: (id: CharacterId) => void;
  readonly release: (id: CharacterId) => void;
}

export function useSeat(): SeatState {
  const [seat, setSeatState] = useState<Seat>({ kind: "dm" });
  const [mine, setMine] = useState<readonly CharacterId[]>([]);

  useEffect(() => {
    void readMeta<Seat>(SEAT_KEY).then((s) => {
      if (s) setSeatState(s);
    });
    void readMeta<CharacterId[]>(MINE_KEY).then((m) => {
      if (m) setMine(m);
    });
  }, []);

  const setSeat = useCallback((s: Seat) => {
    setSeatState(s);
    void writeMeta(SEAT_KEY, s);
  }, []);

  const claim = useCallback((id: CharacterId) => {
    setMine((cur) => {
      const next = cur.includes(id) ? cur : [...cur, id];
      void writeMeta(MINE_KEY, next);
      return next;
    });
    setSeatState({ kind: "player", characterId: id });
    void writeMeta(SEAT_KEY, { kind: "player", characterId: id } satisfies Seat);
  }, []);

  /*
   * Hold it without sitting in it. Loading a sample party means this device
   * holds both characters and sits in the first, not the last.
   */
  const claimOnly = useCallback((id: CharacterId) => {
    setMine((cur) => {
      if (cur.includes(id)) return cur;
      const next = [...cur, id];
      void writeMeta(MINE_KEY, next);
      return next;
    });
  }, []);

  const release = useCallback((id: CharacterId) => {
    setMine((cur) => {
      const next = cur.filter((x) => x !== id);
      void writeMeta(MINE_KEY, next);
      return next;
    });
  }, []);

  return { seat, mine, setSeat, claim, claimOnly, release };
}
