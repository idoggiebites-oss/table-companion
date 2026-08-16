/**
 * What is wrong with somebody, on the initiative track.
 *
 * Conditions were already tracked for characters and nowhere at all for
 * creatures, which meant the app could never say the most useful sentence in
 * a fight: "it is prone, so you have advantage". The goblin being on its back
 * is the single most consequential fact on the table and it lived in the DM's
 * memory.
 *
 * Shown to everyone, because a condition is watched rather than deduced — the
 * table sees the goblin fall over. Only the DM can set one on a creature, and
 * only from here; a player's own conditions stay on their sheet, where they
 * outlast the fight.
 *
 * A creature nobody can see shows nothing, because the row itself is already
 * gone — the disclosure ladder does that part.
 */

import { useState } from "react";
import type { ConditionId } from "../domain/edition.js";
import { rulesFor } from "../domain/edition.js";

export function ConditionStrip({
  on, editable, onAdd, onRemove,
}: {
  on: readonly ConditionId[];
  /** The DM, on a creature. Everyone else is reading. */
  editable: boolean;
  onAdd: (c: ConditionId) => void;
  onRemove: (c: ConditionId) => void;
}) {
  const [open, setOpen] = useState(false);
  const all = rulesFor("2014").conditions;

  if (!editable && on.length === 0) return null;

  return (
    <div className="conds">
      {on.map((c) => (
        <button
          key={c}
          className="cnd on"
          aria-label={editable ? `Clear ${c}` : c}
          disabled={!editable}
          onClick={() => onRemove(c)}
        >
          {c}
        </button>
      ))}
      {editable && (
        <button
          className="cnd add"
          aria-expanded={open}
          aria-label="Add a condition"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "−" : "+"}
        </button>
      )}
      {open && (
        <div className="cnd-pick">
          {all
            .filter((c) => !on.includes(c))
            .map((c) => (
              <button
                key={c}
                className="cnd"
                onClick={() => {
                  onAdd(c);
                  setOpen(false);
                }}
              >
                {c}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
