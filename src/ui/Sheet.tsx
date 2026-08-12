/**
 * The sheet — a lean-in surface, not the combat HUD.
 *
 * Ordered by how often you are asked for something rather than by how the
 * printed sheet folds: hit points and live pools first, then saves and skills,
 * with abilities demoted to a reference strip. You almost never roll a raw
 * ability check.
 */

import { useState } from "react";
import { formatModifier, SKILLS, SKILL_IDS, type Ability } from "../domain/abilities.js";
import { describeAttack } from "../domain/attack.js";
import type { EffectiveBuild } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import type { CharacterState } from "../domain/project.js";
import { previewRest, type RestKind, type RestPreview } from "../domain/rest.js";
import type { RollMode } from "../domain/roll.js";
import { RollPad, type RollTarget } from "./RollPad.js";
import type { CampaignState } from "../domain/project.js";
import { HpBar, healthStep, VAGUE_LABEL } from "./HpBar.js";
import { StateCard } from "./StateCard.js";

const spaced = (s: string) => s.replace(/([A-Z])/g, " $1").toLowerCase();

function Pips({
  max, spent, die, onSpend, onRestore,
}: {
  max: number; spent: number; die?: number;
  onSpend: () => void; onRestore: () => void;
}) {
  // Countable pools read as pips — four of six is instant, "4/6" is not.
  // Past a dozen the pips stop helping and the number carries it alone.
  if (max > 12) {
    return (
      <span className="row">
        <button onClick={onRestore} disabled={spent === 0} aria-label="Restore one">+</button>
        <span className="ct">{max - spent} of {max}</span>
        <button onClick={onSpend} disabled={spent >= max} aria-label="Spend one">−</button>
      </span>
    );
  }
  return (
    <span className="pips">
      {Array.from({ length: max }, (_, i) => {
        const available = i < max - spent;
        return (
          <button
            key={i}
            className={`pip${available ? " on" : ""}${die ? " dice" : ""}`}
            aria-label={available ? "Spend one" : "Restore one"}
            onClick={available ? onSpend : onRestore}
          />
        );
      })}
    </span>
  );
}

function RestPanel({
  previews, kind, onCommit, onCancel,
}: {
  previews: readonly RestPreview[]; kind: RestKind;
  onCommit: () => void; onCancel: () => void;
}) {
  const p = previews[0];
  if (!p) return null;
  return (
    <div className="preview">
      <div className="label" style={{ marginBottom: 8 }}>
        {kind === "long" ? "Long rest" : "Short rest"} — what will change
      </div>
      {p.noop ? (
        <div className="ln"><span>Nothing to restore.</span></div>
      ) : (
        <>
          {p.hp.to !== p.hp.from && (
            <div className="ln">
              <span>Hit points</span>
              <span className="v">{p.hp.from}<span className="ar">→</span>{p.hp.to}</span>
            </div>
          )}
          {p.tempHpLost > 0 && (
            <div className="ln"><span>Temporary hit points</span><span className="v">{p.tempHpLost} lost</span></div>
          )}
          {p.exhaustion && (
            <div className="ln">
              <span>Exhaustion</span>
              <span className="v">{p.exhaustion.from}<span className="ar">→</span>{p.exhaustion.to}</span>
            </div>
          )}
          {p.deathSavesCleared && (
            <div className="ln"><span>Death saves</span><span className="v">cleared</span></div>
          )}
          {p.resources.map((r) => (
            <div className="ln" key={r.id}>
              <span>{r.name}</span>
              <span className="v">
                {r.max - r.spentBefore}<span className="ar">→</span>{r.max - r.spentAfter} of {r.max}
              </span>
            </div>
          ))}
        </>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={onCommit}>Take the rest</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function Sheet({
  build, state, campaign, append,
}: {
  build: EffectiveBuild;
  state: CharacterState;
  campaign: CampaignState;
  append: (body: EventBody) => void;
}) {
  const [amount, setAmount] = useState(5);
  const [rest, setRest] = useState<RestKind | null>(null);
  const [roll, setRoll] = useState(1);
  const [pad, setPad] = useState<
    { kind: "check" | "concentration"; target: RollTarget } | null
  >(null);
  const openCheck = (target: RollTarget) => setPad({ kind: "check", target });

  const who = build.id;
  const step = healthStep(state.currentHp, build.maxHp);
  const conMod = build.abilityMods.con;
  const hitDice = build.resources.find((r) => r.id === "hitDice");
  const hitDiceLeft = (hitDice?.max ?? 0) - (state.spent.hitDice ?? 0);

  const previews = rest ? previewRest(campaign, rest, [who]) : [];
  const owed = state.concentrationChecks[0];

  return (
    <>
      <section className="card">
        <div className="ident">
          <div className="nm">{build.name}</div>
          <div className="cls label">
            {build.classes.map((c) => `${c.classId} ${c.level}`).join(" · ")}
            {build.edition === "2014" ? "" : ` · ${build.edition}`}
          </div>
        </div>
        <div className="strip">
          <div><b className="num">{build.armourClass}</b><span>Armour</span></div>
          <div><b className="num">{formatModifier(build.abilityMods.dex)}</b><span>Initiative</span></div>
          <div><b className="num">{build.speed}</b><span>Speed</span></div>
          <div><b className="num">{formatModifier(build.proficiencyBonus)}</b><span>Proficiency</span></div>
          <div><b className="num">{build.passivePerception}</b><span>Passive per.</span></div>
        </div>
      </section>

      <section className="card">
        <div className="card-hd">
          <span className="label">Hit points</span>
          <span className="label" style={{ color: "var(--faint)" }}>
            {VAGUE_LABEL[step]}
          </span>
        </div>
        <div className="card-body">
          {owed && (
            <div className="alarm">
              <span className="alarm-k">Concentration</span>
              <p className="alarm-q">
                A Constitution save is owed · <span className="num">DC {owed.dc}</span>
              </p>
              <p className="alarm-s">
                {state.concentratingOn} · from {owed.fromDamage} damage
                {state.concentrationChecks.length > 1
                  ? ` · ${state.concentrationChecks.length - 1} more after this`
                  : ""}
              </p>
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  onClick={() =>
                    setPad({
                      kind: "concentration",
                      target: {
                        label: "Constitution save",
                        modifier: build.saveMods.con,
                        dc: owed.dc,
                        note: `Holding ${state.concentratingOn}`,
                      },
                    })
                  }
                >
                  Roll the save
                </button>
              </div>
            </div>
          )}

          <div className="hp-row">
            <span className="hp-big">{state.currentHp}<s> / {build.maxHp}</s></span>
            {state.tempHp > 0 && <span className="hp-temp">+{state.tempHp} temp</span>}
            {state.currentHp === 0 && (
              <span className="label" style={{ color: "var(--near)" }}>
                Down · {state.deathSaves.successes}✓ {state.deathSaves.failures}✕
                {state.stable ? " · stable" : ""}{state.dead ? " · dead" : ""}
              </span>
            )}
          </div>
          <HpBar current={state.currentHp} max={build.maxHp} />

          <div className="controls">
            <input type="number" min={0} value={amount} aria-label="Amount"
              onChange={(e) => setAmount(Math.max(0, +e.target.value || 0))} />
            <button onClick={() => append({ type: "damageApplied", who, amount })}>Damage</button>
            <button onClick={() => append({ type: "healingApplied", who, amount })}>Heal</button>
            <button onClick={() => append({ type: "tempHpGranted", who, amount })}>Temp</button>
          </div>

          {state.currentHp === 0 && !state.dead && (
            <div className="controls">
              {(["success", "failure", "critical", "fumble"] as const).map((r) => (
                <button key={r} onClick={() => append({ type: "deathSaveRecorded", who, result: r })}>
                  {r === "critical" ? "Nat 20" : r === "fumble" ? "Nat 1" : r}
                </button>
              ))}
            </div>
          )}

          <div className="controls">
            <span className="label">Hit die</span>
            <input type="number" min={1} max={build.hitDie} value={roll} aria-label="Rolled"
              onChange={(e) => setRoll(Math.max(1, Math.min(build.hitDie, +e.target.value || 1)))} />
            <button
              disabled={hitDiceLeft <= 0 || state.currentHp >= build.maxHp}
              onClick={() => append({ type: "hitDiceSpent", who, rolled: roll, conMod })}
            >
              Spend d{build.hitDie} {formatModifier(conMod)}
            </button>
            <span className="faint" style={{ fontSize: ".82rem" }}>{hitDiceLeft} left</span>
          </div>

          <div className="controls">
            <button onClick={() => setRest(rest === "short" ? null : "short")}>Short rest</button>
            <button onClick={() => setRest(rest === "long" ? null : "long")}>Long rest</button>
          </div>

          {rest && (
            <RestPanel
              previews={previews}
              kind={rest}
              onCancel={() => setRest(null)}
              onCommit={() => {
                append(rest === "long"
                  ? { type: "longRestTaken", who: [who] }
                  : { type: "shortRestTaken", who: [who] });
                setRest(null);
              }}
            />
          )}
        </div>
      </section>

      {build.resources.length > 0 && (
        <section className="card">
          <div className="card-hd"><span className="label">Pools</span></div>
          {build.resources.map((r) => {
            const spent = state.spent[r.id] ?? 0;
            return (
              <div className="pool" key={r.id}>
                <span className="nm">
                  {r.name}
                  {r.die ? <span className="faint"> · d{r.die}</span> : null}
                </span>
                <Pips
                  max={r.max}
                  spent={spent}
                  {...(r.die === undefined ? {} : { die: r.die })}
                  onSpend={() => append({ type: "resourceSpent", who, resource: r.id, amount: 1 })}
                  onRestore={() => append({ type: "resourceRestored", who, resource: r.id, amount: 1 })}
                />
                <span className="ct">{r.max - spent} of {r.max}</span>
              </div>
            );
          })}
        </section>
      )}

      {build.attacks.length > 0 && (
        <section className="card">
          <div className="card-hd">
            <span className="label">Attacks</span>
            <span className="label faint">Tap to roll</span>
          </div>
          {build.attacks.map((a) => (
            <button
              type="button"
              key={a.name}
              className={`atk${pad?.target.label === a.name ? " sel" : ""}`}
              onClick={() =>
                openCheck({
                  label: a.name,
                  modifier: a.toHit,
                  note: `Damage ${describeAttack(a)}`,
                })
              }
            >
              <span className="n">
                {a.name}
                <span className="d">{describeAttack(a)}</span>
              </span>
              <span className="m">{formatModifier(a.toHit)}</span>
            </button>
          ))}
        </section>
      )}

      <section className="card">
        <div className="card-hd"><span className="label">Saving throws</span></div>
        <div className="card-body">
          <div className="grid2">
            {(Object.keys(build.saveMods) as Ability[]).map((a) => {
              const label = `${a} save`;
              return (
                <button
                  type="button"
                  className={`stat rollable${pad?.target.label === label ? " sel" : ""}`}
                  key={a}
                  onClick={() => openCheck({ label, modifier: build.saveMods[a] })}
                >
                  <span className="n prof">{a}</span>
                  <span className="m">{formatModifier(build.saveMods[a])}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-hd"><span className="label">Skills</span></div>
        <div className="card-body">
          <div className="grid2">
            {SKILL_IDS.map((s) => {
              const label = spaced(s);
              return (
                <button
                  type="button"
                  className={`stat rollable${pad?.target.label === label ? " sel" : ""}`}
                  key={s}
                  onClick={() => openCheck({ label, modifier: build.skillMods[s] })}
                >
                  <span className="n">
                    {label} <span className="a">{SKILLS[s]}</span>
                  </span>
                  <span className="m">{formatModifier(build.skillMods[s])}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <StateCard build={build} state={state} append={append} />

      {pad && (
        <RollPad
          target={pad.target}
          onClose={() => setPad(null)}
          onRolled={(mode: RollMode, dice: number[]) =>
            append(
              pad.kind === "concentration"
                ? { type: "concentrationChecked", who, mode, dice, modifier: pad.target.modifier }
                : {
                    type: "diceRolled",
                    who,
                    label: pad.target.label,
                    mode,
                    dice,
                    modifier: pad.target.modifier,
                  },
            )
          }
        />
      )}
    </>
  );
}
