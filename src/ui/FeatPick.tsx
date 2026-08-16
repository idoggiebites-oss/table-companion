/**
 * Choosing a feat.
 *
 * It was a dropdown of eight hundred and fifty names, in two places. A
 * dropdown is right for picking something you already know and wrong for
 * choosing between things you have never read — and a feat IS its
 * description. "Sentinel" is not a choice; what Sentinel does is the choice.
 *
 * So: the same collapsed list the spells and the turn menu use. Names and
 * prerequisites, whole text on tap, and one button to take it. The ones this
 * app can prove you do not qualify for say so and cannot be taken; the ones
 * it cannot check state the requirement and let the table rule.
 */

import { useState } from "react";
import { blocked, byFeatOrder, meets, type Aspirant, type FeatSource } from "../domain/feats.js";
import { nameMark } from "../domain/marks.js";

export function FeatPick({
  feats, who, taken, onPick,
}: {
  feats: readonly FeatSource[];
  who: Aspirant;
  /** The one already chosen here, so it reads as chosen rather than absent. */
  taken?: string;
  onPick: (f: FeatSource | null) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  /*
   * Unfiltered, this is the game's own feats — all ninety-four of them, which
   * is a menu somebody can actually read. Typing searches the other seven
   * hundred and fifty-six as well.
   *
   * A flat cap was the wrong answer here for the reason it was wrong for
   * spells: sorted with the marked material last, the first sixty entries run
   * out at F, and Sentinel — one of the four feats a new player has actually
   * heard of — was unreachable without knowing to search for it.
   */
  const q = filter.trim().toLowerCase();
  const rows = feats
    .filter((f) => (q ? f.name.toLowerCase().includes(q) : nameMark(f.name) === null))
    .sort(byFeatOrder)
    .slice(0, q ? 60 : 200);

  const chosen = taken ? feats.find((f) => f.id === taken) : undefined;
  if (chosen) {
    const v = meets(chosen.prerequisite, who);
    return (
      <div className="feat-took">
        <div className="menu-row">
          <div className="menu-hd" aria-label={`${chosen.name}, taken`}>
            <span className="nm">{chosen.name}</span>
            <span className="cost">taken</span>
          </div>
          <div className="menu-more">
            {"unverified" in v && v.unverified && (
              <p className="what">Requires {v.unverified} — the DM decides.</p>
            )}
            <p className="then">{chosen.text}</p>
            <button className="menu-take" onClick={() => onPick(null)}>
              Choose something else
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="feat-pick">
      <input
        value={filter}
        aria-label="Filter feats"
        placeholder={`filter ${feats.length} feats…`}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="menu feat-scroll">
        {rows.map((f) => {
          const v = meets(f.prerequisite, who);
          const no = blocked(v);
          const shown = open === f.id;
          return (
            <div className={`menu-row${no ? " off" : ""}`} key={f.id}>
              <button
                className="menu-hd"
                aria-expanded={shown}
                aria-label={f.name}
                onClick={() => setOpen(shown ? null : f.id)}
              >
                <span className="nm">{f.name}</span>
                {f.prerequisite && <span className="cost">{f.prerequisite}</span>}
              </button>
              {shown && (
                <div className="menu-more">
                  {no && <p className="what">{v.why}</p>}
                  {!no && "unverified" in v && v.unverified && (
                    <p className="what">Requires {v.unverified} — the DM decides.</p>
                  )}
                  <p className="then">{f.text}</p>
                  {!no && (
                    <button
                      className="menu-take"
                      onClick={() => {
                        onPick(f);
                        setOpen(null);
                      }}
                    >
                      Take it
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="faint" style={{ margin: 0, fontSize: ".84rem" }}>
            Nothing matches.
          </p>
        )}
      </div>
      {q === "" && feats.length > rows.length && (
        <p className="faint" style={{ margin: 0, fontSize: ".78rem" }}>
          {feats.length - rows.length} more from imported content — type to
          search those too.
        </p>
      )}
    </div>
  );
}
