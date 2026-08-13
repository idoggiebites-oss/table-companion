/**
 * The DM's view of the party.
 *
 * The whole reason this exists: the DM narrates "you take twelve" and types it
 * while still talking, rather than waiting for a player to find the right
 * field mid-combat. Speed is the point.
 *
 * That is only defensible because every change lands in the action feed
 * signed by whoever made it, and any of it can be undone from any device.
 */

import { useState } from "react";
import type { EventBody } from "../domain/events.js";
import { mayEditCharacter } from "../domain/permissions.js";
import type { CampaignState } from "../domain/project.js";
import type { Seat } from "../domain/combat.js";
import { HpBar, healthStep, VAGUE_LABEL } from "./HpBar.js";

export function Party({
  state, seat, append,
}: {
  state: CampaignState;
  seat: Seat;
  append: (body: EventBody) => void;
}) {
  const [amount, setAmount] = useState(5);
  const builds = Object.values(state.builds);
  if (builds.length === 0) return null;

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Party</span>
        <span className="row">
          <input
            type="number" min={0} value={amount} aria-label="Party amount"
            style={{ width: 76 }}
            onChange={(e) => setAmount(Math.max(0, +e.target.value || 0))}
          />
        </span>
      </div>

      {builds.map((b) => {
        const c = state.characters[b.id];
        if (!c) return null;
        const editable = mayEditCharacter(seat, b.id);
        const owed = c.concentrationChecks[0];
        return (
          <div className="pm" key={b.id}>
            <div className="pm-top">
              <span className="pm-name">{b.name}</span>
              <span className="pm-hp num">
                {c.currentHp}<span className="faint"> / {b.maxHp}</span>
                {c.tempHp > 0 && <span className="pm-temp"> +{c.tempHp}</span>}
              </span>
            </div>
            <HpBar current={c.currentHp} max={b.maxHp} />
            <div className="pm-meta">
              <span className="label">{VAGUE_LABEL[healthStep(c.currentHp, b.maxHp)]}</span>
              {c.concentratingOn && <span className="chip conc">{c.concentratingOn}</span>}
              {owed && <span className="chip conc">Save owed · DC {owed.dc}</span>}
              {c.currentHp === 0 && (
                <span className="label" style={{ color: "var(--near)" }}>
                  Down · {c.deathSaves.successes}✓ {c.deathSaves.failures}✕
                </span>
              )}
              {c.conditions.map((cond) => (
                <span className="chip bad" key={cond}>{cond}</span>
              ))}
            </div>
            {editable && (
              <div className="pm-acts">
                <button onClick={() => append({ type: "damageApplied", who: b.id, amount })}>
                  Damage
                </button>
                <button onClick={() => append({ type: "healingApplied", who: b.id, amount })}>
                  Heal
                </button>
                <button onClick={() => append({ type: "tempHpGranted", who: b.id, amount })}>
                  Temp
                </button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
