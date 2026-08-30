/**
 * Last time, in six sentences.
 *
 * The log has held every session in full since the first commit and has never
 * been readable: three hundred rows of "Kira took 7", newest first. What a
 * table actually does when it sits back down is ask out loud, and the answer
 * is whatever four people half-remember.
 *
 * So the same events, read forwards and summarised — and put at the TOP of
 * the log tab, because "what happened last time" is the question the log gets
 * opened for and the transaction list is the answer to a different one.
 *
 * It never renders empty. A card that shows a blank box every week teaches
 * the table to stop looking at it.
 */

import { useState } from "react";
import type { EffectiveBuild } from "../domain/build.js";
import type { Seat } from "../domain/combat.js";
import type { DomainEvent } from "../domain/events.js";
import { isEmpty, recapOf, sessions, whenWas } from "../domain/recap.js";
import { visibleInLog } from "../domain/visibility.js";

export function Recap({
  log, builds, reverted, seat,
}: {
  log: readonly DomainEvent[];
  builds: Readonly<Record<string, EffectiveBuild>>;
  reverted: ReadonlySet<string>;
  /** A player's recap is built from a player's log. See visibility.ts. */
  seat: Seat;
}) {
  const [back, setBack] = useState(0);

  const visible = log.filter((e) => visibleInLog(e, seat) && !reverted.has(e.id));
  const all = sessions(visible);
  if (all.length === 0) return null;

  const at = Math.min(back, all.length - 1);
  const session = all[all.length - 1 - at]!;
  const recap = recapOf(session, (id) => builds[id]?.name ?? "Someone");
  if (isEmpty(recap)) return null;

  const when = whenWas(session.endedAt);
  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">{when === "today" ? "So far today" : "Last time"}</span>
        {/* Not beside "So far today", where it says the same thing twice. */}
        {when !== "today" && <span className="label faint">{when}</span>}
      </div>
      <div className="card-body">
        <div className="rc-said">
          {recap.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        {recap.counts.length > 0 && (
          <div className="rc-nums">
            {recap.counts.map((c) => (
              <span className="rc-n" key={c.label}>
                <span className="num">{c.value}</span>
                <span className="label">{c.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Only when there is one. A back button that goes nowhere is worse
            than none — it says there is more to see. */}
        {all.length > 1 && (
          <div className="row mt-3">
            <button
              disabled={at >= all.length - 1}
              aria-label="An earlier session"
              onClick={() => setBack(at + 1)}
            >
              Before that
            </button>
            {at > 0 && (
              <button aria-label="A later session" onClick={() => setBack(at - 1)}>
                Since
              </button>
            )}
            <span className="faint aside">
              {all.length - at} of {all.length}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
