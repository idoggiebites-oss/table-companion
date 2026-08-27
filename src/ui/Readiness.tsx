/**
 * What you would bring to a fight, on the tab where there is not one.
 *
 * Between fights this screen said "No fight yet." and nothing else — which
 * is honest and useless, and it is the tab a player lands on. Most of a
 * session is not a fight; the question that gets asked in that time is still
 * "what have I got", and the answer is the same answer the turn gives, minus
 * the turn.
 *
 * Nothing here is a control. Everything on it is somewhere else to be spent —
 * this is the reading, not the doing.
 */

import type { EffectiveBuild } from "../domain/build.js";
import type { CharacterState } from "../domain/project.js";
import { formatModifier } from "../domain/abilities.js";
import { describeAttack, type ResolvedAttack } from "../domain/attack.js";

export function Readiness({
  build, state, attacks,
}: {
  build: EffectiveBuild;
  state: CharacterState;
  attacks: readonly ResolvedAttack[];
}) {
  const slots = build.resources.filter((r) => /^slot\d$/.test(r.id));
  const hitDice = build.resources.find((r) => r.id === "hitDice");
  const hurt = state.currentHp < build.maxHp;

  return (
    <div className="card-body ready-for">
      <p className="ready-say">
        No fight. Here is what you would bring to one.
      </p>

      {attacks.length > 0 && (
        <div className="ready-part">
          <span className="label q">In your hands</span>
          {attacks.slice(0, 3).map((a) => (
            <div className="pt-arm" key={a.name}>
              <span className="n">
                {a.name}
                <span className="d">{describeAttack(a)}</span>
              </span>
              <span className="v">{formatModifier(a.toHit)}</span>
            </div>
          ))}
        </div>
      )}

      {(slots.length > 0 || hitDice) && (
        <div className="ready-part">
          <span className="label q">Left to spend</span>
          <div className="ready-pools">
            {slots.map((r) => (
              <span className="ready-pool" key={r.id}>
                <span className="num">{r.max - (state.spent[r.id] ?? 0)}</span>
                <span className="k">{r.name.replace(/ slots$/, "")}</span>
              </span>
            ))}
            {hitDice && (
              <span className="ready-pool">
                <span className="num">
                  {hitDice.max - (state.spent.hitDice ?? 0)}
                </span>
                <span className="k">hit dice</span>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="ready-part">
        <span className="label q">Standing</span>
        <p className="ready-state">
          <span className={hurt ? "hurtnow" : ""}>
            {state.currentHp} of {build.maxHp} hit points
          </span>
          {state.conditions.length > 0
            ? ` · ${state.conditions.join(", ")}`
            : " · nothing wrong with you"}
          {state.concentratingOn ? ` · holding ${state.concentratingOn}` : ""}
        </p>
      </div>
    </div>
  );
}
