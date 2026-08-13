/**
 * Resolving a level.
 *
 * Pending, never interrupting. Crossing a threshold mid-fight must not put a
 * card on anyone's screen — the combat study drew a hard line about that: the
 * card becomes the prompt only when nothing else is true, and a concentration
 * save qualifies because it is owed NOW. A level-up never is. So this is a
 * quiet banner the player opens at a rest, between sessions, or whenever they
 * look.
 *
 * Hit points are a physical roll like everything else — the app names the die
 * and holds the modifier — or the fixed average, which most tables settle once
 * and never revisit.
 */

import { useState } from "react";
import { formatModifier } from "../domain/abilities.js";
import type { EffectiveBuild } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import type { ClassId } from "../domain/resources.js";

/** The fixed alternative to rolling: half the die, rounded up. */
export function averageGain(die: number, conMod: number): number {
  return Math.max(1, Math.floor(die / 2) + 1 + conMod);
}

export function LevelUp({
  build, owed, append,
}: {
  build: EffectiveBuild;
  owed: number;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState<ClassId>(build.classes[0]!.classId);

  if (owed <= 0) return null;

  const conMod = build.abilityMods.con;
  const die = build.hitDie;
  const average = averageGain(die, conMod);
  const to = build.totalLevel + 1;

  const gain = (rolled: number) => {
    append({ type: "levelGained", who: build.id, classId, hpGain: Math.max(1, rolled + conMod) });
    setOpen(false);
  };

  return (
    <section className="card lv">
      <div className="lv-head">
        <span className="lv-k">Level up</span>
        <span className="lv-n">
          {build.classes.map((c) => c.classId).join(" / ")} {to}
        </span>
        <span className="lv-s">
          from level {build.totalLevel}
          {owed > 1 ? ` · ${owed} owed` : ""}
        </span>
      </div>

      {!open ? (
        <div className="card-body">
          <button onClick={() => setOpen(true)}>Resolve it</button>
          <p className="faint" style={{ fontSize: ".84rem", margin: "10px 0 0" }}>
            Nothing is waiting on this. Take it at a rest.
          </p>
        </div>
      ) : (
        <div className="card-body">
          {build.classes.length > 1 && (
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="label">In</span>
              <select
                aria-label="Class to level"
                value={classId}
                style={{ width: "auto" }}
                onChange={(e) => setClassId(e.target.value as ClassId)}
              >
                {build.classes.map((c) => (
                  <option key={c.classId} value={c.classId}>{c.classId}</option>
                ))}
              </select>
            </div>
          )}

          <p className="lv-ask">
            Roll a <strong>d{die}</strong> for hit points.
          </p>
          <p className="faint" style={{ fontSize: ".85rem", margin: "0 0 12px" }}>
            Add your Constitution modifier of {formatModifier(conMod)}. Tap what you rolled.
          </p>
          <div className="lv-pad">
            {Array.from({ length: die }, (_, i) => i + 1).map((face) => (
              <button key={face} onClick={() => gain(face)}>{face}</button>
            ))}
          </div>

          <div className="lv-or"><i /><span>or</span><i /></div>
          <button className="lv-avg" onClick={() => gain(average - conMod)}>
            Take the average · {average}
          </button>

          <p className="faint" style={{ fontSize: ".82rem", margin: "14px 0 0" }}>
            Everything derived moves with it — proficiency, skills, saves,
            attacks, hit dice. Choices like a new spell are yours to make,
            here or in your builder.
          </p>
        </div>
      )}
    </section>
  );
}
