/**
 * The sheet — a lean-in surface, not the combat HUD.
 *
 * Ordered by how often you are asked for something rather than by how the
 * printed sheet folds: hit points and live pools first, then saves and skills,
 * with abilities demoted to a reference strip. You almost never roll a raw
 * ability check.
 */

import { describeSenses, hasSenses } from "../domain/senses.js";
import { useMemo, useState } from "react";
import { formatModifier } from "../domain/abilities.js";
import { describeAttack } from "../domain/attack.js";
import type { EffectiveBuild } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import type { CharacterState } from "../domain/project.js";
import { previewRest, type RestKind, type RestPreview } from "../domain/rest.js";
import type { RollMode } from "../domain/roll.js";
import { RollPad, type RollTarget } from "./RollPad.js";
import type { CampaignState } from "../domain/project.js";
import { HpBar, healthStep, VAGUE_LABEL } from "./HpBar.js";
import { useCatalogue } from "./Inventory.js";
import { Doll } from "./Doll.js";
import { Drawer } from "./Drawer.js";
import { acBoons, boonsFor, describeBoon } from "../domain/boons.js";
import { armourClass, attacksFromEquipment } from "../domain/equipment.js";
import {
  equippedItems, indexItems, mergeItems,
} from "../domain/items.js";
import { resolveAttack } from "../domain/attack.js";
import { loadEquipment } from "../store/srd.js";
import { StateCard } from "./StateCard.js";

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
  /** Which size to spend. Only a multiclass character is ever asked. */
  const [die, setDie] = useState(build.hitDie);
  const [pad, setPad] = useState<
    { kind: "check" | "concentration"; target: RollTarget } | null
  >(null);
  const openCheck = (target: RollTarget) => setPad({ kind: "check", target });

  const who = build.id;
  const step = healthStep(state.currentHp, build.maxHp);
  const conMod = build.abilityMods.con;
  const hitDice = build.resources.find((r) => r.id === "hitDice");
  const hitDiceLeft = (hitDice?.max ?? 0) - (state.spent.hitDice ?? 0);

  // Equipment is campaign state, not part of the build, so the derivations
  // live here where both are in hand. The build stays "imported base plus
  // deltas" and never learns about a shield.
  const items = useCatalogue(loadEquipment, true);
  // The DM's own things are items like any other.
  const catalogue = useMemo(
    () => indexItems(mergeItems(items ?? [], campaign.homebrewItems)),
    [items, campaign.homebrewItems],
  );
  const worn = useMemo(
    () => equippedItems(state.inventory, state.equipped, catalogue),
    [state.inventory, state.equipped, catalogue],
  );
  const ac = armourClass(worn, build.abilityMods.dex, build.armourClass, build.abilities.str);
  const gear = useMemo(
    () =>
      attacksFromEquipment(worn).map((a) =>
        resolveAttack(a, build.abilityMods, build.proficiencyBonus),
      ),
    [worn, build.abilityMods, build.proficiencyBonus],
  );
  // Equipment-derived attacks come first, then whatever was imported or typed
  // by hand. Both are kept: an imported sheet's attacks are real, and a
  // character who equips a longsword has not renounced them.
  const attacks = [...gear, ...build.attacks.filter((a) => !gear.some((g) => g.name === a.name))];

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
          <div title={ac.from}>
            <b className="num">{ac.value}</b>
            <span>{acBoons(state.boons).length > 0 ? `Armour ${acBoons(state.boons)[0]!.modifier ?? ""}` : "Armour"}</span>
          </div>
          <div><b className="num">{formatModifier(build.abilityMods.dex)}</b><span>Initiative</span></div>
          <div><b className="num">{build.speed - ac.speedPenalty}</b><span>Speed</span></div>
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
            <>
              {/* Nobody reads the death save rules before they need them, and
                  by then they are on the floor and everyone is talking. */}
              <p className="down-help">
                {state.stable
                  ? "Stable: no more saves. You wake with 1 hit point after a while, or the moment anyone heals you."
                  : `On your turn, roll a d20. Ten or more is a success. Three successes and you are stable; three failures and you die. You have ${state.deathSaves.successes} and ${state.deathSaves.failures}.`}
              </p>
              <div className="controls">
                {(["success", "failure", "critical", "fumble"] as const).map((r) => (
                  <button key={r} onClick={() => append({ type: "deathSaveRecorded", who, result: r })}>
                    {r === "critical" ? "Nat 20" : r === "fumble" ? "Nat 1" : r}
                  </button>
                ))}
              </div>
              <p className="faint down-note">
                A natural 20 puts you back up with 1 hit point. A natural 1
                counts as two failures. Any damage while you are down is a
                failure on its own.
              </p>
            </>
          )}

          {/* A multiclass character has more than one size of hit die and
              chooses which to spend; a single-class one has exactly one and
              should not be asked. */}
          <div className="controls">
            <span className="label">Hit die</span>
            {build.multiclass && (
              <select
                aria-label="Which hit die"
                value={die}
                style={{ width: "auto" }}
                onChange={(e) => setDie(Number(e.target.value) as typeof build.hitDie)}
              >
                {build.hitDicePool.map((h) => (
                  <option key={h.die} value={h.die}>d{h.die} · {h.count}</option>
                ))}
              </select>
            )}
            <input type="number" min={1} max={die} value={roll} aria-label="Rolled"
              onChange={(e) => setRoll(Math.max(1, Math.min(die, +e.target.value || 1)))} />
            <button
              disabled={hitDiceLeft <= 0 || state.currentHp >= build.maxHp}
              onClick={() => append({ type: "hitDiceSpent", who, rolled: roll, conMod })}
            >
              Spend d{die} {formatModifier(conMod)}
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

      <section className="card">
        <div className="card-hd">
          <span className="label">Worn &amp; wielded</span>
          <span className="label q">Tap a slot</span>
        </div>
        <div className="card-body">
          <Doll
            homebrew={campaign.homebrewItems}
            who={who}
            inventory={state.inventory}
            equipped={state.equipped}
            append={append}
          />
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

      {build.choices.length > 0 && (
        <section className="card">
          <div className="card-hd">
            <span className="label">Your class</span>
          </div>
          <div className="src">
            {build.choices.map((c) => (
              <div className="src-row" key={c.of}>
                <span className="nm">{c.name}</span>
                <span className="faint">{c.of}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {build.feats.length > 0 && (
        <section className="card">
          <div className="card-hd">
            <span className="label">Feats</span>
          </div>
          <div className="card-body chips">
            {build.feats.map((f) => (
              <span className="chip" key={f.id}>{f.name}</span>
            ))}
          </div>
        </section>
      )}

      {state.boons.length > 0 && (
        <section className="card">
          <div className="card-hd">
            <span className="label">Boons</span>
            <span className="label faint">Yours until they end</span>
          </div>
          <div className="card-body chips">
            {state.boons.map((b) => (
              <span className="chip boon" key={b.id} title={b.note ?? ""}>
                {describeBoon(b)}
              </span>
            ))}
          </div>
        </section>
      )}

      {attacks.length > 0 && (
        <section className="card">
          <div className="card-hd">
            <span className="label">Attacks</span>
            <span className="label faint">Tap to roll</span>
          </div>
          {attacks.map((a) => (
            <button
              type="button"
              key={a.name}
              className={`atk${pad?.target.label === a.name ? " sel" : ""}`}
              onClick={() =>
                openCheck({
                  label: a.name,
                  modifier: a.toHit,
                  note: `Damage ${describeAttack(a)}`,
                  boons: boonsFor(state.boons, "attack"),
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

      {/* Who they are. Nothing here is mechanical, and it is the only part of
          the sheet the player wrote themselves. */}
      {(build.identity.alignment || build.identity.personality || build.identity.ideals
        || build.identity.bonds || build.identity.flaws) && (
        <section className="card">
          <div className="card-hd">
            <span className="label">Who they are</span>
            {build.identity.alignment && (
              <span className="label faint">{build.identity.alignment}</span>
            )}
          </div>
          <div className="card-body prof-lists">
            {([
              ["personality", "Personality"], ["ideals", "Ideals"],
              ["bonds", "Bonds"], ["flaws", "Flaws"],
            ] as const).map(([key, label]) =>
              build.identity[key] ? (
                <p className="prof-line" key={key}>
                  <span className="label">{label}</span>
                  <span>{build.identity[key]}</span>
                </p>
              ) : null,
            )}
          </div>
        </section>
      )}

      {/* Nothing to roll, so it sits below what is rollable — but it was
          missing entirely, which made a finished character mute. */}
      {(build.languages.length > 0 || build.toolProficiencies.length > 0
        || hasSenses(build.senses)) && (
        <section className="card">
          <div className="card-hd">
            <span className="label">Languages &amp; tools</span>
          </div>
          <div className="card-body prof-lists">
            {build.languages.length > 0 && (
              <p className="prof-line">
                <span className="label">Speaks</span>
                <span>{build.languages.join(", ")}</span>
              </p>
            )}
            {build.toolProficiencies.length > 0 && (
              <p className="prof-line">
                <span className="label">Uses</span>
                <span>{build.toolProficiencies.join(", ")}</span>
              </p>
            )}
            {/* What they can see, which the fight will ask about the moment a
                DM says the room is dark. */}
            {hasSenses(build.senses) && (
              <p className="prof-line">
                <span className="label">Sees</span>
                <span>{describeSenses(build.senses)}</span>
              </p>
            )}
          </div>
        </section>
      )}


      <StateCard build={build} state={state} append={append} />

      <Drawer
        build={build}
        rolling={pad?.target.label}
        onRoll={(label, modifier, kind) =>
          openCheck({
            label,
            modifier,
            boons: boonsFor(state.boons, kind === "save" ? "save" : "check"),
          })
        }
      />


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
