/**
 * Choosing a few things from a long list.
 *
 * The pattern the spell, feat and monster pickers arrived at, finally written
 * down. Languages and tools were the last chip walls: sixteen languages and
 * fifty-three tools laid out at once, which with a real 44px tap target made
 * the story step three and a half screens tall. Eighty-odd chips is not a
 * choice, it is a search with no search box.
 *
 * Closed until opened, because what you have chosen is the answer and the
 * list is only the way you got there. Open, it is a search and a scroll box —
 * so the step stays one screen whether the list holds sixteen or six hundred.
 */

import { useState } from "react";

export function PickList({
  label, options, chosen, max, verb, onChange, note,
}: {
  /** "Languages", "Tools". */
  readonly label: string;
  readonly options: readonly string[];
  readonly chosen: readonly string[];
  /** How many may be taken in total across every list sharing the budget. */
  readonly max: number;
  /** For the accessible name: "Speak", "Use". */
  readonly verb: string;
  readonly onChange: (next: string[]) => void;
  /** What the source said, when it could not be turned into a list. */
  readonly note?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const shown = options.filter((o) => !query || o.toLowerCase().includes(query));
  const full = chosen.length >= max;

  return (
    <div className="pl">
      <button
        className={`pl-hd${open ? " open" : ""}`}
        aria-expanded={open}
        aria-label={`${label}, ${chosen.length} chosen`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nm">{label}</span>
        {/* What you chose IS the answer, so it reads before the control. */}
        <span className="pl-said">
          {chosen.length > 0 ? chosen.join(", ") : `${options.length} to choose from`}
        </span>
        <span className="pl-mark">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="pl-body">
          {note && <p className="cr-note mt-0">{note}</p>}
          {options.length > 12 && (
            <input
              value={q}
              aria-label={`Filter ${label.toLowerCase()}`}
              placeholder={`filter ${options.length}…`}
              onChange={(e) => setQ(e.target.value)}
            />
          )}
          <div className="pl-rows">
            {shown.map((o) => {
              const on = chosen.includes(o);
              return (
                <button
                  key={o}
                  className={`pl-row${on ? " on" : ""}`}
                  aria-pressed={on}
                  aria-label={`${verb} ${o}`}
                  disabled={!on && full}
                  onClick={() =>
                    onChange(on ? chosen.filter((x) => x !== o) : [...chosen, o])
                  }
                >
                  <span className="nm">{o}</span>
                  <span className="pl-tick">{on ? "✓" : ""}</span>
                </button>
              );
            })}
            {shown.length === 0 && (
              <p className="faint note">
                Nothing matches.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
