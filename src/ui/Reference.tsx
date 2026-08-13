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

  const results = useMemo(() => {
    if (!catalogue) return [];
    return searchStatblocks(catalogue, {
      ...(text ? { text } : {}),
      ...(maxCr === "" ? {} : { maxCr }),
    }).slice(0, 60);
  }, [catalogue, text, maxCr]);

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
