/**
 * The DM asking the table for a roll.
 *
 * "Everyone roll Perception" is the sentence most likely to be lost in the
 * noise — somebody was talking, somebody rolled the wrong thing, somebody
 * missed it entirely. Asked here it lands on each player's screen with their
 * own modifier already worked out, and the answers come back in one place
 * instead of five people calling numbers across a table.
 *
 * The DC is optional and defaults to unsaid. "Roll Perception" and "beat a
 * 15" are different amounts of information, and which the players get is the
 * DM's call.
 */

import { useState } from "react";
import { SKILL_IDS, SKILLS, ABILITIES } from "../domain/abilities.js";
import { describeAsk, outstanding, passed } from "../domain/checks.js";
import type { EventBody } from "../domain/events.js";
import { checkEffects } from "../domain/terrain.js";
import { combine, describeReasons } from "../domain/stance.js";
import type { CampaignState } from "../domain/project.js";

const spaced = (s: string) => s.replace(/([A-Z])/g, " $1").toLowerCase();

export function AskCheck({
  state, append,
}: {
  state: CampaignState;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"skill" | "save">("skill");
  const [what, setWhat] = useState<string>("perception");
  const [dc, setDc] = useState("");
  const [only, setOnly] = useState<string[]>([]);

  const builds = Object.values(state.builds);
  const everyone = builds.map((b) => b.id);

  /*
   * What the room will do to this roll, said before it is asked. terrain.ts
   * has known since it was written that fog hides you and wind drowns you
   * out; nothing asked it, so the DM found out from the players or not at all.
   */
  const roomReasons =
    state.combat && kind === "skill" ? checkEffects(state.combat.scene, what) : [];
  const roomWill = describeReasons(combine(roomReasons), roomReasons);

  function ask() {
    const target = only.length > 0 ? only : everyone;
    if (target.length === 0) return;
    const n = Number(dc);
    append({
      type: "checkAsked",
      checkId: `ck-${Date.now().toString(36)}`,
      who: target,
      what,
      kind,
      ...(Number.isFinite(n) && dc.trim() !== "" ? { dc: n } : {}),
    });
    setOpen(false);
    setOnly([]);
    setDc("");
  }

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Ask for a roll</span>
        <button onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "Ask"}</button>
      </div>

      {state.checks.map((c) => (
        <div className="ask" key={c.id}>
          <span className="nm">{describeAsk(c)}</span>
          <div className="ask-answers">
            {c.who.map((id) => {
              const total = c.answers[id];
              const verdict = passed(c, id);
              return (
                <span
                  className={`chip${total === undefined ? "" : verdict === false ? " bad" : " on"}`}
                  key={id}
                >
                  {state.builds[id]?.name ?? id}
                  {total === undefined ? " …" : ` ${total}`}
                </span>
              );
            })}
          </div>
          <span className="faint">
            {outstanding(c).length === 0
              ? "Everyone has answered."
              : `Waiting on ${outstanding(c).length}.`}
          </span>
          <button onClick={() => append({ type: "checkClosed", checkId: c.id })}>Done</button>
        </div>
      ))}

      {open && (
        <div className="card-body">
          <div className="seg">
            <button
              aria-pressed={kind === "skill"}
              className={kind === "skill" ? "on" : ""}
              onClick={() => { setKind("skill"); setWhat("perception"); }}
            >
              A skill
            </button>
            <button
              aria-pressed={kind === "save"}
              className={kind === "save" ? "on" : ""}
              onClick={() => { setKind("save"); setWhat("dex"); }}
            >
              A saving throw
            </button>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <select
              aria-label="What to roll"
              value={what}
              onChange={(e) => setWhat(e.target.value)}
            >
              {(kind === "skill" ? SKILL_IDS : ABILITIES).map((x) => (
                <option key={x} value={x}>
                  {kind === "skill" ? `${spaced(x)} (${SKILLS[x as never]})` : x.toUpperCase()}
                </option>
              ))}
            </select>
            <input
              type="number"
              aria-label="Difficulty"
              placeholder="DC"
              value={dc}
              style={{ width: 84 }}
              onChange={(e) => setDc(e.target.value)}
            />
          </div>
          {/* What the room will do to it, before it is asked. The DM is the
              one adjudicating, and finding out afterwards is finding out from
              the players. */}
          {roomWill && <p className="stance-why">{roomWill}</p>}
          <p className="faint" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>
            Leave the DC blank to keep it to yourself — they will roll and you
            decide.
          </p>

          <span className="label cr-sub" style={{ marginTop: 12 }}>Who</span>
          <div className="chips">
            {builds.map((b) => (
              <button
                key={b.id}
                className={`chip${only.includes(b.id) ? " on" : ""}`}
                onClick={() =>
                  setOnly((v) => (v.includes(b.id) ? v.filter((x) => x !== b.id) : [...v, b.id]))
                }
              >
                {b.name}
              </button>
            ))}
          </div>
          <p className="faint" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>
            {only.length === 0 ? "Nobody picked means everyone." : `${only.length} of them.`}
          </p>

          <div className="row" style={{ marginTop: 12 }}>
            <button disabled={builds.length === 0} onClick={ask}>Ask the table</button>
          </div>
        </div>
      )}
    </section>
  );
}
