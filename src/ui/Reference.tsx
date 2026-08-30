/**
 * The monster reference.
 *
 * DM only, and not as an afterthought: a player who can look up the statblock
 * knows the armour class and the hit points, which is exactly what the
 * disclosure ladder exists to withhold. Putting it behind the seat is the same
 * decision as hiding a creature's numbers in initiative.
 *
 * The data loads on first open rather than with the app — most sessions never
 * need it, and the service worker has it cached by the second visit.
 */

import { useEffect, useMemo, useState } from "react";
import {
  formatCr, mergeStatblocks, searchStatblocks, type Statblock,
} from "../domain/statblock.js";
import { StatblockView } from "./StatblockView.js";
import { loadMonsters } from "../store/srd.js";
import {
  crBand, creatureKind, CR_BANDS, CR_LABEL, CREATURE_KINDS,
  type CrBand, type CreatureKind,
} from "../domain/creature.js";

export function Reference({ homebrew }: { homebrew: Readonly<Record<string, Statblock>> }) {
  const [all, setAll] = useState<Statblock[] | null>(null);
  const [error, setError] = useState(false);
  const [text, setText] = useState("");
  const [maxCr, setMaxCr] = useState<number | "">("");
  const [kind, setKind] = useState<CreatureKind | null>(null);
  const [band, setBand] = useState<CrBand | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!shown || all || error) return;
    loadMonsters().then(setAll, () => setError(true));
  }, [shown, all, error]);

  const catalogue = useMemo(
    () => (all ? mergeStatblocks(all, homebrew) : null),
    [all, homebrew],
  );

  /*
   * Which pile it is in, before anybody reads it.
   *
   * A complete compendium ships 6,633 monsters under 416 distinct type
   * strings, because the files keep the subtype inside the type. The rulebook
   * has fourteen kinds, and "is this a fair fight" is a band rather than a
   * decimal — the two questions a DM is actually asking of this list.
   */
  const counts = useMemo(() => {
    const kinds = new Map<CreatureKind, number>();
    const bands = new Map<CrBand, number>();
    for (const m of catalogue ?? []) {
      const k = creatureKind(m.type);
      if (k) kinds.set(k, (kinds.get(k) ?? 0) + 1);
      const b = crBand(m.cr);
      bands.set(b, (bands.get(b) ?? 0) + 1);
    }
    return { kinds, bands };
  }, [catalogue]);

  const results = useMemo(() => {
    if (!catalogue) return [];
    return searchStatblocks(catalogue, {
      ...(text ? { text } : {}),
      ...(maxCr === "" ? {} : { maxCr }),
    })
      .filter((m) => kind === null || creatureKind(m.type) === kind)
      .filter((m) => band === null || crBand(m.cr) === band)
      .slice(0, 60);
  }, [catalogue, text, maxCr, kind, band]);

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Reference</span>
        <button onClick={() => setShown((v) => !v)}>
          {shown ? "Hide" : "Monsters"}
        </button>
      </div>

      {shown && (
        <div className="card-body">
          {error && <p className="err">Could not load the monster data.</p>}
          {!catalogue && !error && <p className="faint note">Loading…</p>}

          {catalogue && (
            <>
              <div className="row">
                <input
                  value={text}
                  aria-label="Search monsters"
                  placeholder="goblin, dragon, undead…"
                  style={{ flex: "2 1 160px", width: "auto" }}
                  onChange={(e) => setText(e.target.value)}
                />
                <input
                  type="number" min={0} step={1}
                  aria-label="Maximum challenge rating"
                  placeholder="max CR"
                  value={maxCr}
                  style={{ flex: "0 0 96px", width: "auto" }}
                  onChange={(e) => setMaxCr(e.target.value === "" ? "" : Math.max(0, +e.target.value))}
                />
              </div>
              {/* Kind, then difficulty — the order a DM asks them in. */}
              <div className="roles mt-2">
                {CREATURE_KINDS.filter((k) => (counts.kinds.get(k) ?? 0) > 0).map((k) => (
                  <button
                    key={k}
                    className={`role${kind === k ? " on" : ""}`}
                    aria-pressed={kind === k}
                    aria-label={`Only ${k}`}
                    onClick={() => setKind(kind === k ? null : k)}
                  >
                    {k} <span className="n">{counts.kinds.get(k)}</span>
                  </button>
                ))}
              </div>
              <div className="roles mt-1">
                {CR_BANDS.filter((b) => (counts.bands.get(b) ?? 0) > 0).map((b) => (
                  <button
                    key={b}
                    className={`role cr-${b}${band === b ? " on" : ""}`}
                    aria-pressed={band === b}
                    aria-label={`Only ${CR_LABEL[b]}`}
                    onClick={() => setBand(band === b ? null : b)}
                  >
                    {CR_LABEL[b]} <span className="n">{counts.bands.get(b)}</span>
                  </button>
                ))}
              </div>
              <p className="faint note">
                {results.length} of {catalogue?.length ?? 0}
              </p>

              <div className="mlist">
                {results.map((m) => (
                  <div key={m.id}>
                    <button
                      className={`mrow${open === m.id ? " open" : ""}`}
                      onClick={() => setOpen(open === m.id ? null : m.id)}
                    >
                      <span className="nm">
                        {m.name}
                        {m.homebrew && <> <span className="hb">yours</span></>}
                      </span>
                      <span className="ty faint">{m.type}</span>
                      <span className="cr num">CR {formatCr(m.cr)}</span>
                    </button>
                    {open === m.id && <StatblockView m={m} />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
