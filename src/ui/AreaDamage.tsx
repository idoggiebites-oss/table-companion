/**
 * Area damage, applied in one pass.
 *
 * A fireball on four goblins is four saving throws, four totals, and half
 * damage for whoever passed. Done one creature at a time it stalls the table
 * for a minute; done as four separate events it also takes four undos to put
 * back. So it is one entry with a target set and one event in the log.
 *
 * The party is in the target list by default — unticked, but present —
 * precisely because a fireball does not care who is standing there. Excluding
 * a friendly is a selection, not a separate flow.
 */

import { Num } from "./Num.js";
import { useState } from "react";
import { targetOf, type Combat, type TargetRef } from "../domain/combat.js";
import type { EventBody } from "../domain/events.js";

interface Row {
  readonly id: string;
  readonly name: string;
  readonly ref: TargetRef;
  hit: boolean;
  saved: boolean;
}

export function AreaDamage({
  combat, onApply, onClose,
}: {
  combat: Combat;
  onApply: (body: EventBody) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("Fireball");
  const [amount, setAmount] = useState(28);
  const [damageType, setDamageType] = useState("fire");
  const [halfOnSave, setHalfOnSave] = useState(true);
  const [rows, setRows] = useState<Row[]>(() =>
    combat.order.map((c) => ({
      id: c.id,
      name: c.name,
      ref: targetOf(c),
      hit: false,
      saved: false,
    })),
  );

  const hit = rows.filter((r) => r.hit);
  const half = Math.floor(amount / 2);
  const total = hit.reduce(
    (n, r) => n + (r.saved ? (halfOnSave ? half : 0) : amount),
    0,
  );

  const patch = (id: string, part: Partial<Row>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...part } : r)));

  return (
    <div className="area">
      <div className="row" style={{ gap: 8 }}>
        <input
          value={label} aria-label="Effect name" placeholder="Fireball"
          style={{ flex: "2 1 120px", width: "auto" }}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Num min={0} value={amount} aria-label="Area damage amount"
          style={{ flex: "0 0 76px", width: "auto" }}
          onChange={setAmount}
        />
        <input
          value={damageType} aria-label="Area damage type" placeholder="fire"
          style={{ flex: "1 1 84px", width: "auto" }}
          onChange={(e) => setDamageType(e.target.value)}
        />
      </div>

      <div className="chips" style={{ marginTop: 10 }}>
        <button
          type="button"
          className={`chip${halfOnSave ? " on" : ""}`}
          aria-pressed={halfOnSave}
          onClick={() => setHalfOnSave(!halfOnSave)}
        >
          {halfOnSave ? `Half on save · ${half}` : "Save takes nothing"}
        </button>
      </div>

      <div className="area-list">
        {rows.map((r) => (
          <div className={`arow${r.hit ? " in" : ""}`} key={r.id}>
            <button
              type="button"
              className={`tick${r.hit ? " on" : ""}`}
              aria-label={`${r.name} in the blast`}
              aria-pressed={r.hit}
              onClick={() => patch(r.id, { hit: !r.hit })}
            />
            <span className="nm">{r.name}</span>
            {r.hit ? (
              <button
                type="button"
                className={`chip${r.saved ? " on" : ""}`}
                aria-label={`${r.name} saved`}
                aria-pressed={r.saved}
                onClick={() => patch(r.id, { saved: !r.saved })}
              >
                {r.saved ? "Saved" : "Failed"}
              </button>
            ) : (
              <span className="faint" style={{ fontSize: ".72rem" }}>out of it</span>
            )}
            <span className="amt num">
              {r.hit ? (r.saved ? (halfOnSave ? half : 0) : amount) : "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button
          disabled={hit.length === 0 || amount <= 0}
          onClick={() => {
            onApply({
              type: "areaDamageApplied",
              label: label.trim() || "Area damage",
              amount,
              damageType: damageType.trim() || "damage",
              halfOnSave,
              targets: hit.map((r) => ({ ref: r.ref, saved: r.saved })),
            });
            onClose();
          }}
        >
          Apply to {hit.length}
        </button>
        <button onClick={onClose}>Cancel</button>
        <span className="faint" style={{ fontSize: ".82rem" }}>
          {total} total · one event, one undo
        </span>
      </div>
    </div>
  );
}
