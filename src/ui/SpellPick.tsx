/**
 * Choosing a spell you have never read.
 *
 * A list of names is not a choice. "Faerie Fire" and "Fog Cloud" mean nothing
 * to somebody picking their first cantrips, and the compendium has carried
 * the range, the casting time and the whole description all along.
 *
 * Collapsed until you point at one, for the same reason the turn menu is: a
 * hundred descriptions at once is a spellbook, and a spellbook is what a new
 * player already could not read.
 */

import { useState } from "react";
import type { CompendiumSpell } from "../import/compendium.js";
import { levelLabel } from "../domain/spells.js";

/** The line under the name: what it costs to cast and how far it reaches. */
export function spellLine(s: CompendiumSpell): string {
  return [
    s.level === 0 ? "Cantrip" : levelLabel(s.level),
    s.school,
    s.concentration ? "concentration" : "",
    s.ritual ? "ritual" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function SpellPick({
  spells, disabled, actionLabel, onPick,
}: {
  spells: readonly CompendiumSpell[];
  /** Reason it cannot be taken, or null. */
  disabled?: (s: CompendiumSpell) => string | null;
  actionLabel: string;
  onPick: (s: CompendiumSpell) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (spells.length === 0) {
    return (
      <p className="faint" style={{ margin: 0, fontSize: ".84rem" }}>
        Nothing matches.
      </p>
    );
  }

  return (
    <div className="menu">
      {spells.map((s) => {
        const why = disabled?.(s) ?? null;
        const shown = open === s.id;
        return (
          <div className={`menu-row${why ? " off" : ""}`} key={s.id}>
            <button
              className="menu-hd"
              aria-expanded={shown}
              aria-label={s.name}
              onClick={() => setOpen(shown ? null : s.id)}
            >
              <span className="nm">{s.name}</span>
              <span className="cost">{s.level === 0 ? "cantrip" : s.level}</span>
            </button>
            {shown && (
              <div className="menu-more">
                <p className="what">{spellLine(s)}</p>
                <p className="sp-meta">
                  {[
                    s.time && `Takes ${s.time.toLowerCase()}`,
                    s.range && `Reaches ${s.range.toLowerCase()}`,
                    s.duration && `Lasts ${s.duration.toLowerCase()}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {s.text && (
                  <p className="then">
                    {s.text.slice(0, 400)}
                    {s.text.length > 400 ? "…" : ""}
                  </p>
                )}
                {why ? (
                  <p className="what">{why}</p>
                ) : (
                  <button
                    className="menu-take"
                    onClick={() => {
                      onPick(s);
                      setOpen(null);
                    }}
                  >
                    {actionLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
