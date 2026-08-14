/**
 * Homebrew creatures.
 *
 * The legal escape hatch. Everything outside SRD 5.1 — which is most published
 * monsters — can only reach this app by being typed, so this is not a
 * nice-to-have bolted on at the end; it is what makes the reference usable for
 * a real campaign.
 *
 * The form asks for the fields a fight actually needs and nothing else. A DM
 * entering a creature at eleven at night wants to be done, not to fill in an
 * alignment they will never read.
 *
 * XP is suggested by looking at what SRD creatures of the same challenge
 * rating are worth — derived from data already in hand rather than copied out
 * of a CR-to-XP table, which is not SRD content.
 */

import { useEffect, useState } from "react";
import type { EventBody } from "../domain/events.js";
import type { CampaignState } from "../domain/project.js";
import {
  averageHp, formatCr, parseDice, suggestXp, type Statblock,
} from "../domain/statblock.js";
import { loadMonsters } from "../store/srd.js";

const CR_CHOICES = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];

const blank = () => ({
  name: "",
  type: "humanoid",
  size: "Medium",
  ac: 12,
  hitDice: "2d8",
  speed: "30 ft.",
  cr: 1,
  xp: 200,
  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  actionName: "",
  actionDesc: "",
});

export function Homebrew({
  state, append,
}: {
  state: CampaignState;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [srd, setSrd] = useState<Statblock[] | null>(null);
  /** Set once the DM types an XP themselves; their number is not overwritten. */
  const [xpTouched, setXpTouched] = useState(false);

  useEffect(() => {
    if (open && !srd) loadMonsters().then(setSrd, () => setSrd([]));
  }, [open, srd]);

  const mine = Object.values(state.homebrew);
  const dice = parseDice(f.hitDice);
  const hp = averageHp(f.hitDice);
  const suggested = srd ? suggestXp(srd, f.cr) : null;

  /*
   * The creature list can be tens of megabytes once a compendium ships with
   * the app, so choosing a challenge rating before it arrives used to leave
   * the default XP sitting there — quietly wrong, and only corrected if the
   * DM noticed the hint underneath. The suggestion now lands when it does.
   */
  useEffect(() => {
    if (suggested === null || xpTouched) return;
    setF((cur) => (cur.xp === suggested ? cur : { ...cur, xp: suggested }));
  }, [suggested, xpTouched]);

  function save() {
    const id = `hb-${f.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || Date.now().toString(36)}`;
    const statblock: Statblock = {
      id,
      name: f.name.trim() || "Unnamed creature",
      size: f.size,
      type: f.type.trim() || "creature",
      alignment: "unaligned",
      ac: f.ac,
      hp,
      hitDice: f.hitDice,
      speed: { walk: f.speed },
      cr: f.cr,
      xp: f.xp,
      abilities: { str: f.str, dex: f.dex, con: f.con, int: f.int, wis: f.wis, cha: f.cha },
      traits: [],
      actions: f.actionName.trim()
        ? [{ name: f.actionName.trim(), desc: f.actionDesc.trim() }]
        : [],
      reactions: [],
      legendary: [],
      homebrew: true,
    };
    append({ type: "homebrewSaved", statblock });
    setF(blank());
  }

  const num = (k: keyof ReturnType<typeof blank>, min = 0) => ({
    type: "number" as const,
    value: f[k] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setF({ ...f, [k]: Math.max(min, +e.target.value || 0) }),
  });

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Homebrew</span>
        <button onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Add a creature"}</button>
      </div>

      {mine.length > 0 && (
        <div className="saved">
          {mine.map((m) => (
            <div className="sv-row" key={m.id}>
              <span className="nm">{m.name}</span>
              <span className="faint num">
                CR {formatCr(m.cr)} · {m.hp} HP · AC {m.ac}
              </span>
              <button onClick={() => append({ type: "homebrewDeleted", statblockId: m.id })}>✕</button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="card-body">
          <div className="row" style={{ gap: 8 }}>
            <input
              value={f.name} aria-label="Creature name" placeholder="Bandit Warlord"
              style={{ flex: "2 1 150px", width: "auto" }}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
            <input
              value={f.type} aria-label="Creature type" placeholder="humanoid"
              style={{ flex: "1 1 110px", width: "auto" }}
              onChange={(e) => setF({ ...f, type: e.target.value })}
            />
          </div>

          <div className="six" style={{ marginTop: 10 }}>
            <div>
              <label className="label" htmlFor="hb-ac">Armour class</label>
              <input id="hb-ac" aria-label="Homebrew armour class" {...num("ac", 1)} />
            </div>
            <div>
              <label className="label" htmlFor="hb-hd">Hit dice</label>
              <input
                id="hb-hd" aria-label="Homebrew hit dice" value={f.hitDice}
                onChange={(e) => setF({ ...f, hitDice: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="hb-sp">Speed</label>
              <input
                id="hb-sp" aria-label="Homebrew speed" value={f.speed}
                onChange={(e) => setF({ ...f, speed: e.target.value })}
              />
            </div>
          </div>

          <p className={`hb-note ${dice ? "faint" : "err"}`}>
            {dice
              ? `Average ${hp} hit points. Rolled instances vary between ${
                  dice.count + dice.bonus} and ${dice.count * dice.die + dice.bonus}.`
              : "That isn't a dice expression — try 5d8+5."}
          </p>

          <div className="six" style={{ marginTop: 12 }}>
            {(["str", "dex", "con", "int", "wis", "cha"] as const).map((a) => (
              <div key={a}>
                <label className="label" htmlFor={`hb-${a}`}>{a}</label>
                <input id={`hb-${a}`} aria-label={`Homebrew ${a}`} {...num(a, 1)} />
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <div style={{ flex: "1 1 120px" }}>
              <label className="label" htmlFor="hb-cr">Challenge</label>
              <select
                id="hb-cr" aria-label="Homebrew challenge rating" value={f.cr}
                onChange={(e) => {
                  const cr = Number(e.target.value);
                  const xp = srd ? suggestXp(srd, cr) : null;
                  // A new challenge rating is a new question, so the DM's
                  // previous answer stops standing in the way of the hint.
                  setXpTouched(false);
                  setF({ ...f, cr, ...(xp === null ? {} : { xp }) });
                }}
              >
                {CR_CHOICES.map((c) => (
                  <option key={c} value={c}>CR {formatCr(c)}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: "1 1 110px" }}>
              <label className="label" htmlFor="hb-xp">XP</label>
              <input
                id="hb-xp"
                aria-label="Homebrew XP"
                {...num("xp")}
                onChange={(e) => {
                  setXpTouched(true);
                  num("xp").onChange(e);
                }}
              />
            </div>
          </div>
          {suggested !== null && suggested !== f.xp && (
            <p className="faint" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>
              SRD creatures at CR {formatCr(f.cr)} are usually worth{" "}
              <button className="linky" onClick={() => setF({ ...f, xp: suggested })}>
                {suggested} XP
              </button>.
            </p>
          )}

          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <input
              value={f.actionName} aria-label="Action name" placeholder="Greataxe"
              style={{ flex: "1 1 120px", width: "auto" }}
              onChange={(e) => setF({ ...f, actionName: e.target.value })}
            />
            <input
              value={f.actionDesc} aria-label="Action description"
              placeholder="+6 to hit, 1d12+4 slashing"
              style={{ flex: "2 1 180px", width: "auto" }}
              onChange={(e) => setF({ ...f, actionDesc: e.target.value })}
            />
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button disabled={!f.name.trim() || !dice} onClick={save}>
              Save creature
            </button>
            <span className="faint" style={{ fontSize: ".8rem" }}>
              Appears in search and the encounter builder like any other.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
