/**
 * Which seat this device is sitting in.
 *
 * Deliberately NOT in the event log. A seat is a property of the device, not
 * of the campaign — two people sharing a tablet swap seats without that
 * needing to be a fact everybody else replays.
 */

import { useCallback, useEffect, useState } from "react";
import type { Seat } from "../domain/combat.js";
import { readMeta, writeMeta } from "./log.js";

const SEAT_KEY = "seat";

export function useSeat(): [Seat, (seat: Seat) => void] {
  const [seat, setSeatState] = useState<Seat>({ kind: "dm" });

  useEffect(() => {
    void readMeta<Seat>(SEAT_KEY).then((s) => {
      if (s) setSeatState(s);
    });
  }, []);

  const setSeat = useCallback((s: Seat) => {
    setSeatState(s);
    void writeMeta(SEAT_KEY, s);
  }, []);

  return [seat, setSeat];
}
