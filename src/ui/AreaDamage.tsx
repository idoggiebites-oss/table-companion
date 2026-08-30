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
import { Field } from "./Field.js";
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
  combat, onApply, onClose, from,
}: {
  combat: Combat;
  onApply: (body: EventBody) => void;
  onClose: () => void;
  /*
   * Filled in from a monster's own action, when the DM tapped one that asks
   * for a save. A breath weapon is not an attack roll — "each creature in
   * that line must make a DC 18 Dexterity saving throw" has no to-hit in it
   * — and the fight offered one anyway, because tapping an action led to the
   * swing whatever the action was.
   *
   * Who is caught is still the DM's to say. The app supplies the number, the
   * ability and what a success costs; where the line falls belongs to the
   * table. See law four.
   */
  from?: {
    readonly name: string;
    readonly dc: number;
    readonly ability: string;
    readonly amount: number;
    readonly damageType: string;
    readonly half: boolean;
  } | undefined;
}) {
  const [label, setLabel] = useState(from?.name ?? "Fireball");
  const [amount, setAmount] = useState(from?.amount ?? 28);
  const [damageType, setDamageType] = useState(from?.damageType ?? "fire");
  const [halfOnSave, setHalfOnSave] = useState(from?.half ?? true);
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
      {/* What the book asks for, read off the creature's own action. The DM
          still says who was caught — that needs positions, and positions
          live on the table. */}
      {from && (
        <p className="area-from">
          <b>DC {from.dc} {from.ability.toUpperCase()}</b>
          {" · "}{from.half ? "half on a save" : "nothing on a save"}
          {" · "}say who was caught, then who made it
        </p>
      )}
      <div className="row" style={{ gap: 8 }}>
        <Field label="What hit them" htmlFor="area-name">
        <input
          id="area-name"
          value={label} aria-label="Effect name" placeholder="Fireball"
          onChange={(e) => setLabel(e.target.value)}
        />
        </Field>
        <Field label="Damage" htmlFor="area-amt" width={84}>
        <Num min={0} value={amount} aria-label="Area damage amount"
          id="area-amt"
          onChange={setAmount}
        />
        </Field>
        <Field label="Type" htmlFor="area-type" width={96}>
        <input
          id="area-type"
          value={damageType} aria-label="Area damage type" placeholder="fire"
          onChange={(e) => setDamageType(e.target.value)}
        />
        </Field>
      </div>

      <div className="chips mt-2">
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
              <span className="faint aside">out of it</span>
            )}
            <span className="amt num">
              {r.hit ? (r.saved ? (halfOnSave ? half : 0) : amount) : "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="row mt-3">
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
        <span className="faint aside">
          {total} total · one event, one undo
        </span>
      </div>
    </div>
  );
}
