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
  formatCr, mergeStatblocks, searchStatblocks,
  type Statblock, type StatblockAction,
} from "../domain/statblock.js";
import { loadMonsters } from "../store/srd.js";
import {
  crBand, creatureKind, CR_BANDS, CR_LABEL, CREATURE_KINDS,
  type CrBand, type CreatureKind,
} from "../domain/creature.js";

const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"] as const;
const mod = (score: number) => Math.floor((score - 10) / 2);
const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

function Block({ title, entries }: { title: string; entries: readonly StatblockAction[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="sb-block">
      <span className="label">{title}</span>
      {entries.map((a) => (
        <p className="sb-entry" key={a.name}>
          <b>{a.name}.</b> {a.desc}
        </p>
      ))}
    </div>
  );
}

function StatblockView({ m }: { m: Statblock }) {
  return (
    <div className="sb">
      <div className="sb-line">
        {m.size} {m.type}
        {m.subtype ? ` (${m.subtype})` : ""}, {m.alignment}
      </div>
      <div className="sb-top">
        <span><b className="num">{m.ac}</b> AC{m.acNote ? ` (${m.acNote})` : ""}</span>
        <span><b className="num">{m.hp}</b> HP <span className="faint">({m.hitDice})</span></span>
        <span className="faint">
          {Object.entries(m.speed).map(([k, v]) => `${k} ${v}`).join(", ")}
        </span>
      </div>
      <div className="sb-abils">
        {ABILITY_ORDER.map((a) => (
          <div key={a}>
            <span className="k">{a}</span>
            <span className="v num">{m.abilities[a]}</span>
            <span className="m num">{signed(mod(m.abilities[a]))}</span>
          </div>
        ))}
      </div>
      <div className="sb-meta">
        {m.saves && <div><span className="label">Saves</span> {Object.entries(m.saves).map(([k, v]) => `${k} ${signed(v)}`).join(", ")}</div>}
        {m.skills && <div><span className="label">Skills</span> {Object.entries(m.skills).map(([k, v]) => `${k} ${signed(v)}`).join(", ")}</div>}
        {m.resistances && <div><span className="label">Resistant</span> {m.resistances.join(", ")}</div>}
        {m.immunities && <div><span className="label">Immune</span> {m.immunities.join(", ")}</div>}
        {m.conditionImmunities && <div><span className="label">Condition immune</span> {m.conditionImmunities.join(", ")}</div>}
        {m.senses && <div><span className="label">Senses</span> {Object.entries(m.senses).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")}</div>}
        {m.languages && <div><span className="label">Languages</span> {m.languages}</div>}
      </div>
      <Block title="Traits" entries={m.traits} />
      <Block title="Actions" entries={m.actions} />
      <Block title="Reactions" entries={m.reactions} />
      <Block title="Legendary actions" entries={m.legendary} />
    </div>
  );
}

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
          {!catalogue && !error && <p className="faint" style={{ margin: 0 }}>Loading…</p>}

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
              <div className="roles" style={{ marginTop: 10 }}>
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
              <div className="roles" style={{ marginTop: 6 }}>
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
              <p className="faint" style={{ fontSize: ".8rem", margin: "10px 0 0" }}>
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
