/**
 * The DM's side of levelling.
 *
 * Experience or milestone is a campaign SETTING, not a preference, because it
 * changes what exists rather than what is shown. In a milestone campaign
 * there are no totals, no thresholds and no bars anywhere — a number nobody
 * is tracking is worse than no number, since it invites someone to ask what
 * it means.
 *
 * Awards are raw XP. Any multiplier a table applies estimates how dangerous a
 * fight will be and is never earned; awarding an adjusted total roughly
 * doubles a party's progression over a campaign.
 */

import { useState } from "react";
import type { EventBody } from "../domain/events.js";
import { levelForXp, xpForLevel, xpToNextLevel } from "../domain/progression.js";
import { levelsOwed, type CampaignState } from "../domain/project.js";

export function Progression({
  state, append,
}: {
  state: CampaignState;
  append: (body: EventBody) => void;
}) {
  const [amount, setAmount] = useState(250);
  const builds = Object.values(state.builds);
  if (builds.length === 0) return null;

  const xpMode = state.progression === "xp";
  const everyone = builds.map((b) => b.id);

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Progression</span>
        <span className="seg">
          <button
            aria-pressed={xpMode}
            className={xpMode ? "on" : ""}
            onClick={() => append({ type: "progressionSet", mode: "xp" })}
          >
            Experience
          </button>
          <button
            aria-pressed={!xpMode}
            className={!xpMode ? "on" : ""}
            onClick={() => append({ type: "progressionSet", mode: "milestone" })}
          >
            Milestone
          </button>
        </span>
      </div>

      {builds.map((b) => {
        const c = state.characters[b.id];
        if (!c) return null;
        const owed = levelsOwed(state, b.id);
        const next = xpMode ? xpToNextLevel(c.xp) : null;
        const floor = xpMode ? (xpForLevel(levelForXp(c.xp)) ?? 0) : 0;
        const ceil = next ? (xpForLevel(next.next) ?? 0) : 0;
        const pct = ceil > floor ? ((c.xp - floor) / (ceil - floor)) * 100 : 100;

        return (
          <div className={`prow${owed > 0 ? " owed" : ""}`} key={b.id}>
            <span className="who">
              <span className="nm">{b.name}</span>
              <span className="cls">
                {b.classes.map((x) => `${x.classId} ${x.level}`).join(" · ")}
              </span>
            </span>

            {/* In a milestone campaign the XP column does not exist at all. */}
            {xpMode && (
              <span className="xp">
                <span className="xpb">
                  <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, pct / 100))})` }} />
                </span>
                <span className="num">
                  {c.xp.toLocaleString()}
                  {next && <span className="faint"> / {ceil.toLocaleString()}</span>}
                </span>
              </span>
            )}

            <span className={`owe${owed > 0 ? " on" : ""}`}>
              {owed > 0 ? `${owed} level${owed === 1 ? "" : "s"} owed` : `Level ${b.totalLevel}`}
            </span>
          </div>
        );
      })}

      <div className="card-body prog-acts">
        {xpMode ? (
          <div className="row">
            {/* A bare number box beside a button is a box that means whatever
                you last assumed it meant. */}
            <div style={{ flex: "0 0 110px" }}>
              <label className="label" htmlFor="prog-xp">Experience</label>
              <input
                id="prog-xp"
                type="number" min={0} value={amount} aria-label="XP to award"
                onChange={(e) => setAmount(Math.max(0, +e.target.value || 0))}
              />
            </div>
            <button onClick={() => append({ type: "xpAwarded", who: everyone, amount })}>
              Award the party
            </button>
            {builds.length > 1 && (
              <select
                aria-label="Award one character"
                value=""
                style={{ width: "auto" }}
                onChange={(e) => {
                  if (e.target.value) {
                    append({ type: "xpAwarded", who: [e.target.value], amount });
                    e.target.value = "";
                  }
                }}
              >
                <option value="">just one…</option>
                {builds.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="row">
            <button onClick={() => append({ type: "levelAwarded", who: everyone })}>
              Level the party
            </button>
            {builds.map((b) => (
              <button key={b.id} onClick={() => append({ type: "levelAwarded", who: [b.id] })}>
                {b.name}
              </button>
            ))}
          </div>
        )}
        <p className="faint" style={{ fontSize: ".82rem", margin: "10px 0 0" }}>
          {xpMode
            ? "Award the raw total from an encounter, never the adjusted one."
            : "No totals in a milestone campaign — you decide when."}
        </p>
      </div>
    </section>
  );
}
