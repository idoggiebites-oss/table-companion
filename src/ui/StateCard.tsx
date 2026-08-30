/**
 * Conditions, exhaustion, and concentration.
 *
 * Exhaustion is a stepper rather than a chip because it is a LEVEL, not a
 * flag — and the effect at that level is shown, since it is the line of the
 * rest rules people most often forget they are under.
 */

import { useEffect, useState } from "react";
import type { EffectiveBuild } from "../domain/build.js";
import { exhaustionAt, rulesFor, type ExhaustionEffect } from "../domain/edition.js";
import type { EventBody } from "../domain/events.js";
import type { CharacterState } from "../domain/project.js";
import { loadConditions, type ConditionDescription } from "../store/srd.js";

const titleCase = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Renders whichever fields an edition's exhaustion table actually populated. */
function describeExhaustion(e: ExhaustionEffect): string {
  const parts: string[] = [];
  if (e.d20Penalty) parts.push(`${e.d20Penalty} to every d20 test`);
  if (e.speedPenaltyFeet) parts.push(`${e.speedPenaltyFeet} ft speed`);
  if (e.disadvantage) {
    const words: Record<string, string> = {
      abilityChecks: "ability checks",
      attacks: "attack rolls",
      saves: "saving throws",
    };
    parts.push(`disadvantage on ${e.disadvantage.map((d) => words[d] ?? d).join(" and ")}`);
  }
  if (e.speedMultiplier) parts.push("speed halved");
  if (e.hpMaxMultiplier) parts.push("hit point maximum halved");
  if (e.speedZero) parts.push("speed 0");
  if (e.death) parts.push("death");
  return parts.join(" · ");
}

export function StateCard({
  build, state, append,
}: {
  build: EffectiveBuild;
  state: CharacterState;
  append: (body: EventBody) => void;
}) {
  const who = build.id;
  const [spell, setSpell] = useState("");
  const conditions = rulesFor(build.edition).conditions;
  const [descriptions, setDescriptions] = useState<ConditionDescription[]>([]);
  useEffect(() => {
    loadConditions().then(setDescriptions, () => setDescriptions([]));
  }, []);
  const maxExhaustion = rulesFor(build.edition).maxExhaustion;
  const effect = exhaustionAt(build.edition, state.exhaustion);

  return (
    <section className="card">
      <div className="card-hd"><span className="label">State</span></div>

      <div className="card-body">
        <span className="label standalone under">
          Concentration
        </span>
        {state.concentratingOn ? (
          <div className="row">
            <span className="chip conc">{state.concentratingOn}</span>
            <button onClick={() => append({ type: "concentrationEnded", who })}>Drop it</button>
          </div>
        ) : (
          <div className="row">
            <input
              value={spell}
              placeholder="Hunter's Mark"
              aria-label="Spell to concentrate on"
              style={{ flex: "1 1 160px", width: "auto" }}
              onChange={(e) => setSpell(e.target.value)}
            />
            <button
              disabled={!spell.trim()}
              onClick={() => {
                append({ type: "concentrationStarted", who, on: spell.trim() });
                setSpell("");
              }}
            >
              Concentrate
            </button>
          </div>
        )}
      </div>

      <div className="card-body" style={{ borderTop: "1px solid var(--rule)" }}>
        <span className="label standalone under">Conditions</span>

        {/* What the condition DOES, for the one you have. "What does
            frightened mean again" is the most asked question at a table, and
            the app has shipped the answer since the first week without ever
            showing it. */}
        {state.conditions.map((c) => {
          const desc = descriptions.find((d) => d.id === c);
          if (!desc) return null;
          const lines = Array.isArray(desc.desc) ? desc.desc : [desc.desc];
          return (
            <div className="cond" key={c}>
              <span className="nm">{titleCase(c)}</span>
              {lines.map((line, i) => (
                <p key={i}>{line.replace(/^\s*-\s*/, "")}</p>
              ))}
            </div>
          );
        })}
        <div className="chips">
          {conditions.map((c) => {
            const on = state.conditions.includes(c);
            return (
              <button
                key={c}
                type="button"
                className={`chip${on ? " on bad" : ""}`}
                aria-pressed={on}
                onClick={() =>
                  append(
                    on
                      ? { type: "conditionRemoved", who, condition: c }
                      : { type: "conditionAdded", who, condition: c },
                  )
                }
              >
                {titleCase(c)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card-body" style={{ borderTop: "1px solid var(--rule)" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="label">Exhaustion</span>
          <span className="row">
            <button
              disabled={state.exhaustion <= 0}
              aria-label="Reduce exhaustion"
              onClick={() => append({ type: "exhaustionChanged", who, delta: -1 })}
            >
              −
            </button>
            <span className="num" style={{ minWidth: 28, textAlign: "center" }}>
              {state.exhaustion}
            </span>
            <button
              disabled={state.exhaustion >= maxExhaustion}
              aria-label="Increase exhaustion"
              onClick={() => append({ type: "exhaustionChanged", who, delta: 1 })}
            >
              +
            </button>
          </span>
        </div>
        {effect && <p className="exh">{describeExhaustion(effect)}</p>}
      </div>
    </section>
  );
}
