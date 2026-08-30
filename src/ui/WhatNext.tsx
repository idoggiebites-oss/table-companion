/**
 * What to do about it, beside what happened.
 *
 * The recap has always reported and stopped. It is read at the two moments
 * somebody asks the question the app was not answering — sitting back down a
 * week later, and packing up at the end of a night — and the answer lives in
 * prompts.ts: a handful of facts, each with the screen that settles it.
 *
 * It sits ABOVE the recap, which is VISION law 7 in one place: what is
 * waiting on you comes before what is true and a long way before what you are
 * reading about. And it never renders empty — a card that shows a blank box
 * every week teaches the table to stop looking at it, which is the same rule
 * the recap keeps two lines further down the page.
 */

import type { Seat } from "../domain/combat.js";
import type { DomainEvent } from "../domain/events.js";
import type { CampaignState } from "../domain/project.js";
import { promptsFor, type PromptTab } from "../domain/prompts.js";
import { sessions, whenWas } from "../domain/recap.js";
import { visibleInLog } from "../domain/visibility.js";

export function WhatNext({
  log, state, reverted, seat, reachable, onGo,
}: {
  log: readonly DomainEvent[];
  state: CampaignState;
  reverted: ReadonlySet<string>;
  /** A player's prompts are built from a player's log. See visibility.ts. */
  seat: Seat;
  /** Tabs this device is actually showing. A prompt with nowhere to go is
      dropped rather than rendered as a button that lands somewhere else. */
  reachable: readonly PromptTab[];
  onGo: (tab: PromptTab) => void;
}) {
  const visible = log.filter((e) => visibleInLog(e, seat) && !reverted.has(e.id));
  const all = sessions(visible);
  const latest = all[all.length - 1];
  if (!latest) return null;

  const nameOf = (id: string): string => state.builds[id]?.name ?? "Someone";
  const prompts = promptsFor(seat, state, visible, latest, nameOf)
    .filter((p) => reachable.includes(p.go));
  if (prompts.length === 0) return null;

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">
          {whenWas(latest.endedAt) === "today" ? "Still open" : "Before next time"}
        </span>
      </div>
      <div className="card-body">
        <ul className="wn-list">
          {prompts.map((p) => (
            <li key={p.id}>
              {/* The sentence IS the control. Two prompts that both lead to
                  the sheet would otherwise be two buttons with one name,
                  which is an ambiguity for anything driving by name. */}
              <button className="wn-row" onClick={() => onGo(p.go)}>
                <span className="wn-said">{p.text}</span>
                <span className="wn-to">{p.where}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
