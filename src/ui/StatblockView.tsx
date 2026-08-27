/**
 * A statblock, rendered.
 *
 * Lifted out of the monster reference because the fight needs the same thing
 * and was getting a thirtieth of it. Staging a creature kept its hit points,
 * its armour class and the actions that deal damage, and dropped everything
 * else at the boundary — across seven common monsters, 17 of 57 entries
 * survived. Nimble Escape, Regeneration, Legendary Resistance, Petrifying
 * Gaze and, on nearly every statblock in the game, Multiattack: gone. The DM
 * could read them in the Book tab, which means leaving the fight.
 *
 * `onAct` is what makes it a control rather than a page. An entry that names
 * numbers becomes a button; the rest stay prose, because a trait is something
 * that is true rather than something you do.
 *
 * It never rolls. Tapping an action names the die and holds the modifier —
 * the number still comes from a person throwing something, which is the one
 * rule this app does not bend.
 */

import type { Statblock, StatblockAction } from "../domain/statblock.js";

const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"] as const;
const mod = (score: number) => Math.floor((score - 10) / 2);
const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

/** Whether this entry is something to do, as opposed to something that is true. */
export function isActionable(a: StatblockAction): boolean {
  return a.attackBonus !== undefined || (a.damage?.length ?? 0) > 0;
}

/** "+4 to hit · 1d6+2 slashing" — the numbers, without throwing anything. */
export function actionNumbers(a: StatblockAction): string {
  const parts: string[] = [];
  if (a.attackBonus !== undefined) parts.push(`${signed(a.attackBonus)} to hit`);
  for (const d of a.damage ?? []) parts.push(`${d.dice}${d.type ? ` ${d.type.toLowerCase()}` : ""}`);
  return parts.join(" · ");
}

function Block({
  title, entries, onAct,
}: {
  title: string;
  entries: readonly StatblockAction[];
  onAct?: ((a: StatblockAction) => void) | undefined;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="sb-block">
      <span className="label">{title}</span>
      {entries.map((a) =>
        onAct && isActionable(a) ? (
          <button
            className="sb-act"
            key={a.name}
            aria-label={`Use ${a.name}`}
            onClick={() => onAct(a)}
          >
            <span className="sb-act-n">
              <b>{a.name}</b>
              <span className="faint">{actionNumbers(a)}</span>
            </span>
            <span className="sb-act-d">{a.desc}</span>
          </button>
        ) : (
          <p className="sb-entry" key={a.name}>
            <b>{a.name}.</b> {a.desc}
          </p>
        ),
      )}
    </div>
  );
}

export function StatblockView({
  m, onAct,
}: {
  readonly m: Statblock;
  /** Given, every action that names numbers becomes a button. */
  readonly onAct?: ((a: StatblockAction) => void) | undefined;
}) {
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
      <Block title="Actions" entries={m.actions} onAct={onAct} />
      <Block title="Reactions" entries={m.reactions} onAct={onAct} />
      <Block title="Legendary actions" entries={m.legendary} onAct={onAct} />
    </div>
  );
}
