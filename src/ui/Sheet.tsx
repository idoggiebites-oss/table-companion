/**
 * The sheet — a lean-in surface, not the combat HUD.
 *
 * Ordered by how often you are asked for something rather than by how the
 * printed sheet folds: hit points and live pools first, then saves and skills,
 * with abilities demoted to a reference strip. You almost never roll a raw
 * ability check.
 */

import { describeSenses, hasSenses } from "../domain/senses.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatModifier } from "../domain/abilities.js";
import { describeAttack } from "../domain/attack.js";
import type { EffectiveBuild } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import type { CharacterState } from "../domain/project.js";
import { previewRest, type RestKind, type RestPreview } from "../domain/rest.js";
import type { RollMode } from "../domain/roll.js";
import { RollPad, type RollTarget } from "./RollPad.js";
import type { CampaignState } from "../domain/project.js";
import { healthStep, VAGUE_LABEL } from "./HpBar.js";
import { Field } from "./Field.js";
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
import { Actions } from "./Shell.js";
import { Icon, LevelShield } from "./Icon.js";
import { shapeOf } from "../domain/guidance.js";
import { loadPortrait, savePortrait, clearPortrait, shrink } from "./portrait.js";
import { xpForLevel, xpToNextLevel } from "../domain/progression.js";
import type { Ability } from "../domain/abilities.js";

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
      <div className="label mb-2">
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
      <div className="row mt-3">
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

  /*
   * The portrait, read once per character and kept here.
   *
   * Device-local, never an event — ui/portrait.ts says why, and says plainly
   * what it costs: the picture does not travel to the DM's screen.
   */
  const fileRef = useRef<HTMLInputElement>(null);
  const [face, setFace] = useState<string | null>(() => loadPortrait(who));
  const [faceSaid, setFaceSaid] = useState<string | null>(null);
  useEffect(() => { setFace(loadPortrait(who)); setFaceSaid(null); }, [who]);

  const pickFace = async (file: File | undefined) => {
    if (file === undefined) return;
    setFaceSaid(null);
    try {
      /* Shrunk before it is stored: a phone hands over three to eight
         megabytes and this device has about five for everything it owns. */
      const small = await shrink(file);
      const wrong = savePortrait(who, small);
      if (wrong !== null) { setFaceSaid(`Not saved — ${wrong}.`); return; }
      setFace(small);
    } catch (e) {
      setFaceSaid(`Not saved — ${e instanceof Error ? e.message : "that file could not be read"}.`);
    } finally {
      /* So choosing the same file twice still fires a change. */
      if (fileRef.current !== null) fileRef.current.value = "";
    }
  };
  const dropFace = () => { clearPortrait(who); setFace(null); setFaceSaid(null); };

  /*
   * The pill row goes to a control rather than repeating it.
   *
   * `scrollIntoView` on the CARD, then focus on the field inside it: scrolling
   * a focused input into view is the browser's job and it does it without the
   * smooth scroll, so the two have to happen in that order and a frame apart.
   */
  const cards = useRef<Record<string, HTMLElement | null>>({});
  const jump = (card: string, field?: string) => {
    cards.current[card]?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (field === undefined) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(field);
      if (el instanceof HTMLInputElement) { el.focus(); el.select(); }
    });
  };

  /* Only where a table is counting it — a milestone campaign has no XP at all. */
  const xpMode = campaign.progression === "xp";
  /* `next` is the next LEVEL, not the XP for it — reading it as the threshold
     printed "0 / 2" on a level 8 ranger. `xpForLevel` turns it into a number
     of experience points, which is what "0 / 300" means. */
  const nextLevel = xpMode ? xpToNextLevel(state.xp) : null;
  const nextAt = nextLevel === null ? null : xpForLevel(nextLevel.next);

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
      {/*
        * Who they are, before anything that can change during a session.
        *
        * The level was a word in a lowercase line of class ids — "ranger 8" —
        * which is the one number on this card a table says out loud. It is a
        * crest now, and the name is set in the display face because a
        * character's name is the one romantic gesture this app allows itself.
        */}
      <div className="ident" data-testid="identity">
        {/*
          * The portrait, and it is a control.
          *
          * A face is the fastest way to tell six character sheets apart, and
          * the app ships no art — so the only picture that can be here is one
          * the player supplies. Empty, it is the class mark, which is still
          * more than a grey circle.
          *
          * Device-local: see ui/portrait.ts for why a picture must not become
          * an event, and for the cost of that decision.
          */}
        <span className="id-port">
          <button
            className={`id-face${face === null ? " empty" : ""}`}
            aria-label={face === null ? `Add a portrait for ${build.name}` : `Change ${build.name}'s portrait`}
            onClick={() => fileRef.current?.click()}
          >
            {face === null
              ? <Icon name={shapeOf(build.classes[0]?.classId ?? "")?.icon ?? "diamond"} size={30} />
              : <img src={face} alt="" />}
          </button>
          {/*
            * The pencil, on the rim.
            *
            * A circle you can press is not obviously a circle you can press —
            * it looks like a picture. The badge is the affordance, and it
            * rides the portrait so it cannot be read as belonging to the name
            * beside it. `aria-hidden`, because the button underneath already
            * says what pressing does; two names for one target is one too
            * many for anything driving by name.
            */}
          <span className="id-pen" aria-hidden="true"><Icon name="pencil" size={13} /></span>
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="id-file"
          aria-label="Portrait image"
          onChange={(e) => void pickFace(e.target.files?.[0])}
        />
        <span className="id-who">
          <span className="id-nm">{build.name}</span>
          <span className="id-kind">
            {build.classes.map((c) => `${c.classId} ${c.level}`).join(" · ")}
            {build.edition === "2014" ? "" : ` · ${build.edition}`}
          </span>
          {faceSaid !== null && <span className="id-said">{faceSaid}</span>}
          {face !== null && (
            <button className="id-drop" onClick={dropFace}>Remove portrait</button>
          )}
        </span>
        <span className="id-lvl">
          <span className="label">Level</span>
          <LevelShield level={build.classes.reduce((n, c) => n + c.level, 0)} size={38} />
          {/* Only where a table is counting it. In a milestone campaign the
              XP column does not exist at all — see Progression. */}
          {xpMode && (
            <>
              <span className="label">XP</span>
              <span className="id-xp num">
                {state.xp.toLocaleString()}
                {nextAt !== null && <i> / {nextAt.toLocaleString()}</i>}
              </span>
            </>
          )}
        </span>
      </div>

      {/*
        * The four things a player does to their own sheet, as one row of
        * pills under the name.
        *
        * They were spread down two cards — damage and healing inside Hit
        * points, conditions inside State, the hit die below both. A row of
        * four is what the concept draws and it is right: these are the verbs,
        * and the cards below are the reference.
        */}
      <div className="id-quick">
        {/*
          * These GO to the control rather than being a second copy of it.
          *
          * A second Damage button beside the first is a door into a room you
          * are standing in, and the sheet has been burned by that before. What
          * these are actually worth is the distance: the hit die sits eleven
          * hundred pixels down, and "d8 · 1/1" both says the answer and takes
          * you to where you change it.
          */}
        <button aria-label="Damage — go to hit points" onClick={() => jump("hp", "sh-amount")}>
          Damage
        </button>
        <button aria-label="Heal — go to hit points" onClick={() => jump("hp", "sh-amount")}>
          Heal
        </button>
        <button aria-label="Conditions — go to state" onClick={() => jump("state")}>
          Conditions{state.conditions.length > 0 ? ` · ${state.conditions.length}` : "…"}
        </button>
        <button aria-label="Hit dice — go to hit points" onClick={() => jump("hp", "sh-roll")}>
          d{die} · {hitDiceLeft}/{build.totalLevel}
        </button>
      </div>

      {/*
        * What is true right now, in one strip. Hit points lead it, because
        * they are the number a table asks for most and they were a card of
        * their own below this one.
        */}
      <div className="strip" data-testid="vitals">
        <div className="st-hp">
          <span>HP</span>
          {/*
            * `hp-big` follows the number.
            *
            * It moved out of a card of its own and into this cell, and
            * thirty-eight browser suites reach for it — both to wait for the
            * sheet and to read "38 / 52" off it. The name is still true: this
            * IS the big hit-point number. Renaming it would have been thirty-
            * eight edits to say the same thing.
            */}
          <b className="num hp-big">
            {state.currentHp}<i> / {build.maxHp}</i>
            {state.tempHp > 0 && <i> +{state.tempHp}</i>}
          </b>
          <span className="st-bar">
            <i
              className={`st-fill h-${healthStep(state.currentHp, build.maxHp)}`}
              style={{ width: `${Math.round((state.currentHp / Math.max(1, build.maxHp)) * 100)}%` }}
            />
          </span>
        </div>
        <div title={ac.from}>
          <b className="num">{ac.value}</b>
          <span>{acBoons(state.boons).length > 0 ? `AC ${acBoons(state.boons)[0]!.modifier ?? ""}` : "AC"}</span>
        </div>
        <div><b className="num">{formatModifier(build.abilityMods.dex)}</b><span>Initiative</span></div>
        <div><b className="num">{build.speed - ac.speedPenalty}</b><span>Speed</span></div>
        <div><b className="num">{formatModifier(build.proficiencyBonus)}</b><span>Prof bonus</span></div>
      </div>

      <section className="card" ref={(el) => { cards.current["hp"] = el; }}>
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
              <div className="row mt-2">
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

          {/*
            * The number and the bar moved UP into the stat strip, which is
            * where a table now reads them. What is left here is what you do
            * about them — and the one thing the strip cannot say in a cell,
            * which is that you are on the floor and how the saves are going.
            */}
          {state.currentHp === 0 && (
            <div className="hp-row">
              <span className="label" style={{ color: "var(--near)" }}>
                Down · {state.deathSaves.successes}✓ {state.deathSaves.failures}✕
                {state.stable ? " · stable" : ""}{state.dead ? " · dead" : ""}
              </span>
            </div>
          )}

          {/* One number and three buttons: without a name it read as
              whatever you last used it for. */}
          <div className="controls">
            <Field label="How much" htmlFor="sh-amount" width={84}>
              <input id="sh-amount" type="number" min={0} value={amount} aria-label="Amount"
                onChange={(e) => setAmount(Math.max(0, +e.target.value || 0))} />
            </Field>
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
            {/* No stacked label here on purpose. The die selector and the
                Spend button beside it already name this box, and the sheet
                has room for one label before it stops being a panel — see
                verify-panel, which measures exactly that. */}
            <input id="sh-roll" type="number" min={1} max={die} value={roll} aria-label="Rolled"
              onChange={(e) => setRoll(Math.max(1, Math.min(die, +e.target.value || 1)))} />
            <button
              disabled={hitDiceLeft <= 0 || state.currentHp >= build.maxHp}
              onClick={() => append({ type: "hitDiceSpent", who, rolled: roll, conMod })}
            >
              Spend d{die} {formatModifier(conMod)}
            </button>
            <span className="faint aside">{hitDiceLeft} left</span>
          </div>

          {/*
            * The two rests moved to the shell's pinned bar — see <Actions>
            * below. They are what a player does BETWEEN fights and they were
            * eleven hundred pixels down a card, under the hit dice.
            */}

          {/*
            * Rendered DOWN into the shell's action bar. The rule for whether
            * a rest is offered lives here, with the state it reads; passing
            * it up to App would give that rule a second home.
            */}
          <Actions>
            <button
              aria-pressed={rest === "short"}
              className={rest === "short" ? "filled" : undefined}
              onClick={() => setRest(rest === "short" ? null : "short")}
            >
              Short rest
            </button>
            <button
              aria-pressed={rest === "long"}
              className={rest === "long" ? "filled" : undefined}
              onClick={() => setRest(rest === "long" ? null : "long")}
            >
              Long rest
            </button>
          </Actions>

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

      {/*
       * What is TRUE of you right now, next to the other number that is.
       *
       * Conditions, exhaustion and concentration sat last, under fourteen
       * hundred pixels of reference — so the way to find out you were poisoned
       * was to scroll past everything you are wearing. Hit points and this are
       * the two blocks that change during a session; the rest is what you
       * looked up once when you made the character.
       *
       * That is the order the fight screen was rearranged into and the rule
       * for anything added here later: what is happening to you, then what you
       * can do about it, then what you are.
       */}
      {/* Wrapped so the pill row has something to scroll to: StateCard owns
          its own markup and a layout should not reach in and rename its parts. */}
      <div ref={(el) => { cards.current["state"] = el; }}>
        <StateCard build={build} state={state} append={append} />
      </div>


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

      {/*
        * After the things it makes possible, not before them.
        *
        * It led the sheet's second half, so a player looking for their attacks
        * scrolled through every slot on the doll to reach them. What is worn
        * changes a handful of times a session; what it lets you DO is the
        * reason the sheet is open. It sits here because it is the answer to
        * "why does my attack say that", which is a question you ask after
        * reading the attack.
        */}
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

      {/*
        * The six scores, as tiles.
        *
        * This sheet was written with "abilities demoted to a reference strip"
        * — right, in that you almost never roll a raw ability, and wrong in
        * that it left them nowhere at all. They are the first thing anybody
        * reads back off a character, and six tiles cost one band. The
        * MODIFIER is the number you actually use, so it sits under the score
        * rather than in brackets beside it.
        *
        * Placed HERE, low, and not second where the concept draws it. Law 7
        * orders this screen by the questions it raises, and a score is the
        * most static thing on a sheet — it is what you ARE, which is the
        * bottom of that order, beside who they are. The concept can put it
        * first because it has an Overview TAB to put it at the top of; this
        * screen has no tabs, so second would push conditions and
        * concentration down a card, which is the exact failure law 7 was
        * written after. `verify-panel` refused the seventh card until it was
        * placed on purpose, which is what that guard is for.
        */}
      <section className="card">
        <div className="card-hd"><span className="label">Ability scores</span></div>
        <div className="card-body">
          <div className="abil">
            {(Object.keys(build.abilities) as Ability[]).map((a) => (
              <div className="abil-t" key={a}>
                <span className="label">{a}</span>
                <b className="num">{build.abilities[a]}</b>
                <span className="num abil-m">{formatModifier(build.abilityMods[a])}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

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
