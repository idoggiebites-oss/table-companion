/**
 * React's view of the log.
 *
 * The only way to change anything is to append an event, and the only way to
 * read anything is to project the log — the same discipline the domain
 * enforces, carried up into the UI so no component can quietly hold state the
 * log doesn't know about.
 *
 * Writes are optimistic: state updates immediately and the IndexedDB write
 * follows. Phase 2 replaces that trailing write with the same append going to
 * a durable object, and nothing in the UI has to change.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { makeEvent, type DomainEvent, type EventBody } from "../domain/events.js";
import { EMPTY_STATE, project, type CampaignState } from "../domain/project.js";
import { appendEvents, clearLog, loadLog } from "./log.js";

export interface Campaign {
  readonly ready: boolean;
  readonly log: readonly DomainEvent[];
  readonly state: CampaignState;
  readonly append: (body: EventBody) => DomainEvent;
  readonly revert: (target: string) => void;
  readonly reset: () => void;
  /** Reverted ids, so the feed can show a mistake as struck through. */
  readonly reverted: ReadonlySet<string>;
}

export function useCampaign(): Campaign {
  const [log, setLog] = useState<readonly DomainEvent[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    loadLog()
      .then((events) => {
        if (live) setLog(events);
      })
      .catch(() => {
        // A blocked or unavailable IndexedDB shouldn't stop play — the session
        // still works, it just won't survive a reload.
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const append = useCallback((body: EventBody) => {
    const event = makeEvent(body);
    setLog((prev) => [...prev, event]);
    void appendEvents([event]);
    return event;
  }, []);

  const revert = useCallback(
    (target: string) => {
      append({ type: "reverted", target });
    },
    [append],
  );

  const reset = useCallback(() => {
    setLog([]);
    void clearLog();
  }, []);

  const state = useMemo(() => (log.length ? project(log) : EMPTY_STATE), [log]);

  const reverted = useMemo(() => {
    const s = new Set<string>();
    for (const e of log) if (e.type === "reverted") s.add(e.target);
    return s;
  }, [log]);

  return { ready, log, state, append, revert, reset, reverted };
}
