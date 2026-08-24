/**
 * The player's combat view, which is two screens rather than one.
 *
 * Almost all of a fight is spent NOT acting, and the two states want opposite
 * things. Waiting is one enormous number read across the table with nothing
 * to tap, because tapping is not what that moment is for. Acting is twenty
 * seconds where it becomes a tool.
 *
 * The reaction pip appears in both, and is the reason the economy is on the
 * waiting screen at all: it is the only thing you spend on somebody else's
 * turn, so it is the only part that has to stay legible while you do nothing.
 */

import { useEffect, useState } from "react";
import type { ResolvedAttack } from "../domain/attack.js";
import type { EffectiveBuild } from "../domain/build.js";
import { levelLabel, type KnownSpell } from "../domain/spells.js";
import { AimSpell } from "./AimSpell.js";
import { useCasting } from "./useCasting.js";
import { blockedBecause, STANDARD_ACTIONS } from "../domain/actions.js";
import { stanceFor } from "../domain/stance.js";
import { Swing } from "./Swing.js";
import {
  activeCombatant, controls, ECONOMY, isSurprised, movementLeft, turnsUntil,
  visibleTo, type Combat, type Combatant, type EconomyKind, type Seat,
} from "../domain/combat.js";
import type { CharacterId } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import type { CharacterState } from "../domain/project.js";

/*
 * A stand-in for a build this device has not resolved yet. The casting hook
 * cannot be called conditionally, and a character with no spells never reads
 * any of it — enabled:false stops it loading four megabytes of spellbook.
 */
const EMPTY_BUILD = {
  id: "", resources: [], classes: [], abilityMods: {},
} as unknown as EffectiveBuild;

const LABEL: Record<EconomyKind, string> = {
  action: "Action",
  bonus: "Bonus",
  reaction: "Reaction",
};

function Pips({
  who, character, kinds, append,
}: {
  who: CharacterId;
  character: CharacterState;
  kinds: readonly EconomyKind[];
  append: (body: EventBody) => void;
}) {
  return (
    <div className="econ">
      {kinds.map((k) => {
        const spent = character.economy[k];
        return (
          <button
            key={k}
            className={`ec${spent ? " spent" : " up"}`}
            aria-pressed={spent}
            aria-label={`${LABEL[k]} ${spent ? "spent" : "available"}`}
            onClick={() => !spent && append({ type: "economySpent", who, kind: k })}
          >
            {LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Movement as a counter, not a map. The table already knows where everyone is
 * — from minis or from description — and what it loses track of is how much of
 * your thirty feet is left after you shuffled twice.
 */
function Movement({
  combat, combatant, append,
}: {
  combat: Combat;
  combatant: Combatant;
  append: (body: EventBody) => void;
}) {
  const left = movementLeft(combat, combatant);
  if (left === null) return null;
  const spend = (feet: number) =>
    append({ type: "movementSpent", combatantId: combatant.id, feet });

  return (
    <div className="mv">
      <span className="mv-n">
        <b className="num">{left}</b>
        {/* "45 of 30 ft" contradicts itself after a Dash, so say what happened
            instead of restating a budget the number has already exceeded. */}
        <small>{left > (combatant.speed ?? 0) ? "ft · dashed" : `of ${combatant.speed} ft`}</small>
      </span>
      <div className="mv-acts">
        <button aria-label="Move 5 feet" disabled={left < 5} onClick={() => spend(5)}>−5</button>
        <button aria-label="Move 15 feet" disabled={left < 15} onClick={() => spend(15)}>−15</button>
        <button aria-label="Dash" onClick={() => spend(-(combatant.speed ?? 0))}>Dash</button>
        <button
          aria-label="Take back movement"
          disabled={left >= (combatant.speed ?? 0)}
          onClick={() => spend(-5)}
        >
          +5
        </button>
      </div>
    </div>
  );
}

export function PlayerTurn({
  combat, seat, character, build, append, attacks = [], onSwing, onCast,
  takeReaction, onReactionOpened,
}: {
  combat: Combat;
  seat: Extract<Seat, { kind: "player" }>;
  character: CharacterState;
  /** Present once this device knows whose turn it is. Casting needs it. */
  build?: EffectiveBuild;
  append: (body: EventBody) => void;
  /** What they are actually holding — the walkthrough names the weapon. */
  attacks?: readonly ResolvedAttack[];
  onSwing?: (a: {
    attack: ResolvedAttack;
    target: Combatant;
    toHit: number;
    damage: number;
  }) => void;
  /** Sends an aimed spell to the DM, exactly as a weapon attack is sent. */
  onCast?: (c: {
    spell: KnownSpell;
    atLevel: number;
    target: Combatant;
    toHit: number | null;
    damage: number;
    damageType: string;
  }) => void;
  /** The DM offered a reaction and they said yes from another screen. */
  takeReaction?: boolean;
  onReactionOpened?: () => void;
}) {
  const [picking, setPicking] = useState<
    null | "attack" | "opportunity" | "menu" | "help" | "shove" | "ready" | "cast"
  >(null);
  const [took, setTook] = useState<string | null>(null);
  const [trigger, setTrigger] = useState("");
  const [athletics, setAthletics] = useState("");
  const [shoveAt, setShoveAt] = useState<Combatant | null>(null);
  const [casting, setCasting] = useState<KnownSpell | null>(null);
  const [aiming, setAiming] = useState<{ spell: KnownSpell; atLevel: number } | null>(null);
  const [looking, setLooking] = useState<string | null>(null);
  const who = seat.characterId;
  const active = activeCombatant(combat);
  const acting = active?.source.kind === "character" && active.source.characterId === who;
  /** Your summon is up: you are acting, even though it is not you. */
  const proxy = !acting && active !== null && controls(seat, active.controller);
  const away = turnsUntil(combat, who);

  const self = combat.order.find(
    (c) => c.source.kind === "character" && c.source.characterId === who,
  );
  /*
   * Both sides of the roll, in one place — which is the whole reason this can
   * be computed at all. The conditions on you are on your sheet, the ones on
   * the goblin are in the fight, and until now the only place they met was in
   * somebody's head while five people waited.
   */
  const rollerFor = (c: Combatant) => ({
    name: c.name,
    conditions: combat.creatureConditions[c.id] ?? [],
    tags: combat.tags[c.id] ?? [],
  });
  const meAsRoller = {
    name: "you",
    conditions: character.conditions,
    tags: self ? (combat.tags[self.id] ?? []) : [],
  };
  const stanceAt = (target: Combatant, attack?: ResolvedAttack) =>
    stanceFor({
      attacker: meAsRoller,
      target: rollerFor(target),
      // A hand-typed attack says nothing about reach, and most of those are
      // melee. A spell aimed across the room is not.
      range: attack?.range ?? "melee",
    });

  /*
   * Said yes on another screen. The prompt above the tabs is the alert; the
   * swing itself lives here, and arriving should not ask the same question a
   * second time while the table waits.
   */
  useEffect(() => {
    if (takeReaction) {
      setPicking("opportunity");
      onReactionOpened?.();
    }
  }, [takeReaction, onReactionOpened]);

  /** An offer the DM made that names me and that I have not answered. */
  const offered =
    combat.offer &&
    self &&
    combat.offer.to.includes(self.id) &&
    !combat.offer.declined.includes(self.id)
      ? combat.offer
      : null;

  /*
   * Casting, here, beside attacking.
   *
   * It used to send you to the Spells tab — a moment implemented as a place.
   * Your turn has a clock on it and a tab is somewhere you can walk away
   * from, which is how a slot got spent on a spell that was never cast.
   */
  const cast = useCasting({
    build: build ?? EMPTY_BUILD,
    state: character,
    combat,
    append,
    enabled: build !== undefined && character.spells.length > 0,
  });
  /** What they could actually cast this instant — prepared, paid for, in time. */
  const castable = character.spells.filter(
    (s) => cast.ready(s) && cast.canAfford(s),
  );

  /** Everyone else in the fight you could put a hand on the shoulder of. */
  const allies = combat.order.filter(
    (c) => c.source.kind === "character" && c.id !== self?.id,
  );

  const visibleTargets = combat.order.filter(
    (c) =>
      visibleTo(seat, c) &&
      c.source.kind === "creature" &&
      (combat.creatureHp[c.id] ?? 1) > 0,
  );

  if (acting) {
    const surprised = self ? isSurprised(combat, self) : false;
    return (
      <div className="pt acting">
        <div className="pt-turn">
          Your turn
          {surprised && <small>Surprised — you cannot act this round</small>}
        </div>
        {!surprised && (
          <>
            <Pips who={who} character={character} kinds={ECONOMY} append={append} />
            {self && <Movement combat={combat} combatant={self} append={append} />}
            {picking === "menu" ? (
              <div className="hotbar-wrap">
                {/*
                  * A grid of marks, not twelve rows of words.
                  *
                  * The old menu was a list you read: every option a sentence,
                  * and a second sentence when you pointed at one. That is the
                  * right shape for the first session and the wrong one for
                  * every session after, when the turn is something you aim at
                  * rather than something you study.
                  *
                  * Every mark keeps its name. An unlabelled icon is its own
                  * kind of unreadable, and nobody here has played a session
                  * yet — the labels come off when somebody says they can.
                  */}
                <div className="hotbar">
                  {STANDARD_ACTIONS.map((a) => {
                    const why = blockedBecause(
                      a, character.economy, attacks.length > 0, castable.length > 0,
                    );
                    return (
                      <button
                        key={a.id}
                        className={`hot${looking === a.id ? " on" : ""}`}
                        data-cost={a.cost}
                        disabled={why !== null}
                        aria-label={a.name}
                        title={why ?? a.what}
                        onClick={() => setLooking(looking === a.id ? null : a.id)}
                      >
                        <span className="hg">{a.glyph}</span>
                        <span className="ht">{a.name}</span>
                        <i />
                      </button>
                    );
                  })}
                </div>

                {/* One explanation, for the one you pointed at. */}
                {looking && (() => {
                  const a = STANDARD_ACTIONS.find((x) => x.id === looking)!;
                  const why = blockedBecause(
                    a, character.economy, attacks.length > 0, castable.length > 0,
                  );
                  return (
                    <div className="hot-say">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <span className="label">{a.name} · {a.cost}</span>
                        {!why && (
                          <button
                            className="menu-take"
                            onClick={() => {
                              if (a.id === "attack") return setPicking("attack");
                              if (a.id === "cast") return setPicking("cast");
                              if (a.id === "help") return setPicking("help");
                              if (a.id === "shove") return setPicking("shove");
                              if (a.id === "ready") return setPicking("ready");

                              append({ type: "economySpent", who, kind: a.cost });
                              if (a.id === "dash" && self?.speed) {
                                append({
                                  type: "movementSpent",
                                  combatantId: self.id,
                                  feet: -self.speed,
                                });
                              }
                              if (self && (a.id === "dodge" || a.id === "hide")) {
                                append({
                                  type: "stanceTagAdded",
                                  combatantId: self.id,
                                  tag: a.id === "dodge" ? "dodging" : "hidden",
                                });
                              }
                              setTook(a.id);
                              setLooking(null);
                              setPicking(null);
                            }}
                          >
                            Do it
                          </button>
                        )}
                      </div>
                      <p className="what">{why ?? a.what}</p>
                      {!why && a.then && <p className="then">{a.then}</p>}
                    </div>
                  );
                })()}
                <button onClick={() => setPicking(null)}>Back</button>
              </div>
            ) : picking === "help" ? (
              /* Help was a sentence saying it gives an ally advantage, and
                 nothing gave anybody advantage. Now it names them, and their
                 next attack says who is helping. */
              <div className="swing-step">
                <span className="label">Who are you helping?</span>
                {allies.map((c) => (
                  <button
                    className="tgt-row"
                    key={c.id}
                    onClick={() => {
                      append({ type: "economySpent", who, kind: "action" });
                      append({
                        type: "stanceTagAdded",
                        combatantId: c.id,
                        tag: "helped",
                        ...(self ? { source: who } : {}),
                      });
                      setTook("help");
                      setPicking(null);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
                {allies.length === 0 && (
                  <p className="faint" style={{ margin: "6px 0", fontSize: ".84rem" }}>
                    Nobody else is in this fight.
                  </p>
                )}
                <button onClick={() => setPicking("menu")}>Back</button>
              </div>
            ) : picking === "ready" ? (
              /* The most-forgotten thing at a table is somebody's readied
                 action, so it goes somewhere the DM can see it rather than
                 into one player's memory. */
              <div className="swing-step">
                <span className="label">What are you waiting for?</span>
                <p className="swing-ask">
                  Say the trigger out loud, then write it here.
                </p>
                <input
                  aria-label="Trigger"
                  placeholder="when the goblin comes through the door, I shoot it"
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                />
                <div className="row">
                  <button
                    disabled={trigger.trim() === "" || !self}
                    onClick={() => {
                      if (!self) return;
                      append({ type: "economySpent", who, kind: "action" });
                      append({
                        type: "actionReadied",
                        combatantId: self.id,
                        trigger: trigger.trim(),
                      });
                      setTrigger("");
                      setTook("ready");
                      setPicking(null);
                    }}
                  >
                    Hold it
                  </button>
                  <button onClick={() => setPicking("menu")}>Back</button>
                </div>
                <p className="faint" style={{ fontSize: ".8rem", margin: 0 }}>
                  It costs your reaction when it fires, not now.
                </p>
              </div>
            ) : picking === "shove" ? (
              <div className="swing-step">
                <span className="label">
                  {shoveAt ? `Shoving ${shoveAt.name}` : "Who are you shoving?"}
                </span>
                {!shoveAt &&
                  visibleTargets.map((c) => (
                    <button className="tgt-row" key={c.id} onClick={() => setShoveAt(c)}>
                      {c.name}
                    </button>
                  ))}
                {shoveAt && (
                  <>
                    {/* Only half the contest is knowable here: the app has
                        your total and not theirs, so it carries yours across
                        and the DM says whether it went over. */}
                    <p className="swing-ask">
                      Roll <b>Athletics</b> and type the total. They roll
                      against it.
                    </p>
                    <input
                      type="number"
                      aria-label="Athletics total"
                      placeholder="total"
                      value={athletics}
                      onChange={(e) => setAthletics(e.target.value)}
                    />
                    <div className="row">
                      <button
                        disabled={athletics.trim() === "" || !self}
                        onClick={() => {
                          if (!self) return;
                          append({ type: "economySpent", who, kind: "action" });
                          append({
                            type: "shoveClaimed",
                            combatantId: self.id,
                            byName: self.name,
                            targetId: shoveAt.id,
                            targetName: shoveAt.name,
                            total: Number(athletics),
                          });
                          setAthletics("");
                          setShoveAt(null);
                          setTook("shove");
                          setPicking(null);
                        }}
                      >
                        Send to the DM
                      </button>
                      <button onClick={() => setShoveAt(null)}>Back</button>
                    </div>
                  </>
                )}
                {!shoveAt && (
                  <button onClick={() => setPicking("menu")}>Back</button>
                )}
              </div>
            ) : picking === "cast" && build ? (
              /*
                * The same three questions a weapon asks — which one, at what,
                * how much — because a beginner should not meet two different
                * ways of doing the same thing. Names and costs only until you
                * pick one: a hundred descriptions is a spellbook, and a
                * spellbook is what they already could not read.
                */
              aiming ? (
                <AimSpell
                  spell={aiming.spell}
                  atLevel={aiming.atLevel}
                  build={build}
                  book={cast.book ?? []}
                  combat={combat}
                  stanceAt={(target) => stanceAt(target)}
                  onCancel={() => {
                    setAiming(null);
                    setPicking(null);
                  }}
                  onDone={(aim) => {
                    cast.commit(aiming.spell, aiming.atLevel);
                    if (aim) {
                      onCast?.({ ...aim, spell: aiming.spell, atLevel: aiming.atLevel });
                    }
                    setAiming(null);
                    setTook("cast");
                    setPicking(null);
                  }}
                />
              ) : casting ? (
                <div className="swing-step">
                  <span className="label">Which slot for {casting.name}?</span>
                  {cast.optionsFor(casting).map((sl) => (
                    <button
                      className="tgt-row"
                      key={sl.level}
                      onClick={() => {
                        setAiming({ spell: casting, atLevel: sl.level });
                        setCasting(null);
                      }}
                    >
                      {levelLabel(sl.level)}
                      <span className="faint num"> · {sl.left} left</span>
                    </button>
                  ))}
                  <p className="faint" style={{ fontSize: ".8rem", margin: 0 }}>
                    A higher slot makes it stronger. Nothing is spent yet.
                  </p>
                  <button onClick={() => setCasting(null)}>Back</button>
                </div>
              ) : (
                <div className="swing-step">
                  <span className="label">What are you casting?</span>
                  {castable.map((sp) => (
                    <button
                      className="tgt-row"
                      key={sp.id}
                      onClick={() => {
                        const options = cast.optionsFor(sp);
                        if (sp.level === 0) return setAiming({ spell: sp, atLevel: 0 });
                        if (options.length === 1) {
                          return setAiming({ spell: sp, atLevel: options[0]!.level });
                        }
                        setCasting(sp);
                      }}
                    >
                      {sp.name}
                      <span className="faint">
                        {" "}· {sp.level === 0 ? "cantrip" : levelLabel(sp.level)} ·{" "}
                        {cast.costFor(sp)}
                      </span>
                    </button>
                  ))}
                  {castable.length === 0 && (
                    <p className="faint" style={{ margin: "6px 0", fontSize: ".84rem" }}>
                      {cast.book === null
                        ? "Looking up your spells…"
                        : "Nothing you can cast right now — no slot left, or nothing prepared."}
                    </p>
                  )}
                  <button onClick={() => setPicking("menu")}>Back</button>
                </div>
              )
            ) : picking === "attack" ? (
              <Swing
                attacks={attacks}
                targets={visibleTargets}
                stanceAt={stanceAt}
                onCancel={() => setPicking(null)}
                onSend={(swing) => {
                  if (!character.economy.action) {
                    append({ type: "economySpent", who, kind: "action" });
                  }
                  onSwing?.(swing);
                }}
              />
            ) : (
              <>
                <button
                  className="pt-atk"
                  disabled={character.economy.action || attacks.length === 0}
                  onClick={() => setPicking("attack")}
                >
                  {attacks.length > 0 ? `Attack with ${attacks[0]!.name}` : "Attack"}
                  {attacks.length > 1 && <small> or something else</small>}
                </button>
                <button className="pt-more" onClick={() => setPicking("menu")}>
                  What else can I do?
                </button>
                {took && (
                  <p className="pt-took">
                    {STANDARD_ACTIONS.find((a) => a.id === took)?.name} taken.{" "}
                    {STANDARD_ACTIONS.find((a) => a.id === took)?.then ??
                      "Tell the table."}
                  </p>
                )}
                {/* Beginners do not know an attack IS the action. */}
                <p className="pt-why">
                  {character.economy.action
                    ? "Your action is gone. You can still move, and you keep your reaction for somebody else's turn."
                    : "Attacking costs your action. You get one a turn."}
                </p>
              </>
            )}
          </>
        )}
        <button
          className="pt-end"
          onClick={() => append({ type: "turnAdvanced", from: combat.turn })}
        >
          End turn
        </button>
      </div>
    );
  }

  if (proxy && active) {
    return (
      <div className="pt acting">
        <div className="pt-turn">{active.name}<small>You control it</small></div>
        <button
          className="pt-end"
          onClick={() => append({ type: "turnAdvanced", from: combat.turn })}
        >
          End its turn
        </button>
      </div>
    );
  }

  return (
    <div className="pt waiting">
      <div className="pt-dist">
        <span className="num">{away ?? "—"}</span>
        <small>{away === 1 ? "turn away" : "turns away"}</small>
      </div>
      {/* The one part of the economy that matters while you are doing nothing. */}
      <Pips who={who} character={character} kinds={["reaction"]} append={append} />

      {/* The reaction pip has always been here for this. An opportunity
          attack is the reason it stays on screen while you do nothing. */}
      {picking === "opportunity" ? (
        <Swing
          attacks={attacks}
          targets={visibleTargets}
          stanceAt={stanceAt}
          onCancel={() => setPicking(null)}
          onSend={(swing) => {
            if (self) {
              append({
                type: "opportunityTaken",
                attacker: self.id,
                attackerWho: who,
                against: swing.target.id,
              });
              // Answered. The question came from the DM and it is over now
              // for everyone, not just for me.
              if (offered) append({ type: "reactionOfferClosed" });
            }
            onSwing?.(swing);
          }}
        />
      ) : (
        !character.economy.reaction && (
          <button className="pt-opp" onClick={() => setPicking("opportunity")}>
            Opportunity attack
          </button>
        )
      )}
    </div>
  );
}
