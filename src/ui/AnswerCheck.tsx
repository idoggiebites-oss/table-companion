/**
 * A roll the DM has asked you for.
 *
 * It arrives with the modifier already worked out, because the point is that
 * a beginner should not have to find Perception on their sheet while five
 * people wait. The dice are still theirs.
 */

import { useState } from "react";
import { formatModifier, SKILLS, type Ability, type SkillId } from "../domain/abilities.js";
import type { EffectiveBuild } from "../domain/build.js";
import type { CheckRequest } from "../domain/checks.js";
import { hasAnswered } from "../domain/checks.js";
import type { EventBody } from "../domain/events.js";
import { checkEffects, type Room } from "../domain/terrain.js";
import { combine, describeReasons, describeStance } from "../domain/stance.js";

export function AnswerCheck({
  check, build, append, scene,
}: {
  check: CheckRequest;
  build: EffectiveBuild;
  append: (body: EventBody) => void;
  /**
   * Where this is being rolled. terrain.ts has known since it was written
   * that fog hides you and wind drowns you out, and nothing ever asked it —
   * so a Stealth roll in fog was a plain d20 on the one screen that exists to
   * say otherwise.
   */
  scene?: Room | undefined;
}) {
  const [total, setTotal] = useState("");
  if (hasAnswered(check, build.id)) {
    return (
      <section className="card ask-mine done">
        <div className="card-body">
          <span className="label">Sent · {check.answers[build.id]}</span>
          <p className="faint" style={{ margin: "4px 0 0", fontSize: ".84rem" }}>
            The DM has it.
          </p>
        </div>
      </section>
    );
  }

  const modifier =
    check.kind === "save"
      ? build.saveMods[check.what as Ability]
      : build.skillMods[check.what as SkillId];
  const label =
    check.kind === "save"
      ? `${check.what.toUpperCase()} saving throw`
      : `${check.what.replace(/([A-Z])/g, " $1").toLowerCase()} (${SKILLS[check.what as SkillId]})`;

  /*
   * What the room does to this particular roll. A skill check only; a saving
   * throw against a spell is not helped by the fog.
   */
  const reasons = scene && check.kind !== "save" ? checkEffects(scene, check.what) : [];
  const stance = combine(reasons);
  const why = describeReasons(stance, reasons);

  return (
    <section className="card ask-mine">
      <div className="card-body">
        <span className="label">The DM wants a roll</span>
        <p className="swing-ask">
          {stance === "straight" ? (
            <>Roll a <b>d20</b></>
          ) : (
            <><b>{describeStance(stance)}</b></>
          )}{" "}
          for <b>{label}</b> and add <b>{formatModifier(modifier ?? 0)}</b>.
        </p>
        {/* Named, not just applied. "Advantage: it hides you too" teaches the
            rule while it is being used; "advantage" alone teaches nothing. */}
        {why && <p className="stance-why">{why}</p>}
        {check.dc !== undefined && (
          <p className="faint" style={{ margin: "0 0 8px", fontSize: ".84rem" }}>
            Beat {check.dc}.
          </p>
        )}
        <div className="row">
          <input
            type="number"
            aria-label="Check total"
            placeholder="total"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
          <button
            disabled={total.trim() === "" || !Number.isFinite(Number(total))}
            onClick={() =>
              append({
                type: "checkAnswered",
                checkId: check.id,
                who: build.id,
                total: Number(total),
              })
            }
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
