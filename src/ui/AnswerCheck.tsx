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

export function AnswerCheck({
  check, build, append,
}: {
  check: CheckRequest;
  build: EffectiveBuild;
  append: (body: EventBody) => void;
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

  return (
    <section className="card ask-mine">
      <div className="card-body">
        <span className="label">The DM wants a roll</span>
        <p className="swing-ask">
          Roll a <b>d20</b> for <b>{label}</b> and add{" "}
          <b>{formatModifier(modifier ?? 0)}</b>.
        </p>
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
