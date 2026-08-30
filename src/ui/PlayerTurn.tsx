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
import { describeAttack, type ResolvedAttack } from "../domain/attack.js";
import { castingAbility, leadsWithSpell, spellAttackBonus } from "../domain/spellcast.js";
import { formatModifier } from "../domain/abilities.js";
import type { EffectiveBuild } from "../domain/build.js";
import { levelLabel, type KnownSpell } from "../domain/spells.js";
import { AimSpell } from "./AimSpell.js";
import { useCasting } from "./useCasting.js";
import { blockedBecause, STANDARD_ACTIONS } from "../domain/actions.js";
import { stanceFor } from "../domain/stance.js";
import { movementCost } from "../domain/terrain.js";
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
  /*
   * Difficult ground is the environmental rule everybody knows and nearly
   * everybody forgets, because the DM says it on one screen and the number it
   * touches lives on another. Here the buttons simply cost double, and say
   * so — five feet of rubble spends ten.
   */
  const cost = movementCost(combat.scene);
  const spend = (feet: number) =>
    append({ type: "movementSpent", combatantId: combatant.id, feet: feet * cost });

  return (
    <div className="mv">
      <span className="mv-n">
        <b className="num">{left}</b>
        {/* "45 of 30 ft" contradicts itself after a Dash, so say what happened
            instead of restating a budget the number has already exceeded. */}
        <small>{left > (combatant.speed ?? 0) ? "ft · dashed" : `of ${combatant.speed} ft`}</small>
      </span>
      <div className="mv-acts">
        <button
          aria-label="Move 5 feet"
          disabled={left < 5 * cost}
          onClick={() => spend(5)}
        >
          −5{cost > 1 ? " ×2" : ""}
        </button>
        <button
          aria-label="Move 15 feet"
          disabled={left < 15 * cost}
          onClick={() => spend(15)}
        >
          −15{cost > 1 ? " ×2" : ""}
        </button>
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
    /** Everyone the spell caught — a blast is one roll and several saves. */
    targets: readonly Combatant[];
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
  /** Chosen from the strip, so the swing skips "which weapon". */
  const [withWeapon, setWithWeapon] = useState<ResolvedAttack | null>(null);
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
    // What they can see. The DM has no light control yet; when they do, it
    // arrives here and this already knows what to do with it.
    ...(build ? { senses: build.senses } : {}),
  };
  const stanceAt = (target: Combatant, attack?: ResolvedAttack) =>
    stanceFor({
      attacker: meAsRoller,
      target: rollerFor(target),
      // A hand-typed attack says nothing about reach, and most of those are
      // melee. A spell aimed across the room is not.
      range: attack?.range ?? "melee",
      scene: combat.scene,
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

  /*
   * Which of the two a turn should lead with.
   *
   * It always led with the weapon: a wizard's turn opened with "Attack with
   * Quarterstaff" — the thing a wizard does roughly never — and their cantrip
   * was a tap further, behind a question. The small print beside it read "or
   * something else", which sounds like every other option and means another
   * WEAPON, so the one route a caster wants is the one route that button does
   * not go to.
   *
   * Ranked on the numbers rather than on a guess about the class, because the
   * numbers are a thing this app can stand behind: Merlin swings a quarterstaff
   * at +1 and throws a Fire Bolt at +5, so the spell leads; a ranger shoots at
   * +7 and casts at +5, so the bow does. A multiclass sorts itself out without
   * anybody writing down what a Bladesinger is supposed to prefer.
   */
  const spellAttack =
    build && castable.length > 0
      ? spellAttackBonus(
          build.proficiencyBonus,
          build.abilityMods[castingAbility(build.classes.map((c) => c.classId))],
        )
      : null;
  const bestSwing = attacks.length > 0 ? Math.max(...attacks.map((a) => a.toHit)) : null;
  const leadWithSpell = leadsWithSpell(spellAttack, bestSwing);

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

  /*
   * An opportunity attack is at the thing that provoked it.
   *
   * Answering the DM's offer used to list every creature on the board, which
   * is not a choice the rules give you — you do not get to swing at whoever
   * you like because somebody else walked out of your reach. When the offer
   * names its provoker, that is the only target.
   *
   * An UNPROMPTED opportunity attack still offers everyone: nobody has said
   * who moved, so narrowing it would be the app inventing the trigger.
   */
  const provoker =
    offered && combat.offer?.fromId
      ? combat.order.find((c) => c.id === combat.offer?.fromId)
      : undefined;
  const reactionTargets = provoker ? [provoker] : visibleTargets;


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
                  {STANDARD_ACTIONS.filter(
                    /*
                     * "Cast a spell" was a tile whose whole content was
                     * "opens your spells", directly above a strip that shows
                     * the spells. Two doors into one room, and the strip is
                     * the one you can see through — so the tile goes, and
                     * with it the only action on the bar that explained
                     * itself by naming another part of the screen.
                     */
                    (a) => !(a.id === "cast" && castable.length > 0),
                  ).map((a) => {
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
                {/*
                  * What you are holding and what you could cast, under the
                  * grid that names the actions. Both were two tabs away from
                  * the turn that needed them — a player mid-turn was being
                  * asked to remember their own weapon's damage die.
                  */}
                {attacks.length > 0 && (
                  <div className="pt-strip">
                    <span className="label q">In your hands</span>
                    {attacks.slice(0, 3).map((a) => (
                      <button
                        className="pt-arm"
                        key={a.name}
                        disabled={character.economy.action}
                        aria-label={`Attack with ${a.name}`}
                        onClick={() => {
                          setWithWeapon(a);
                          setPicking("attack");
                        }}
                      >
                        <span className="n">
                          {a.name}
                          <span className="d">{describeAttack(a)}</span>
                        </span>
                        <span className="v">{formatModifier(a.toHit)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {castable.length > 0 && (
                  <div className="pt-strip">
                    <span className="label q">
                      Can be cast right now
                      <span className="faint"> · costs your action</span>
                    </span>
                    <div className="sp-grid pt-cast">
                      {castable.map((sp) => (
                        <button
                          className="sp-tile ready"
                          key={sp.id}
                          aria-label={`Cast ${sp.name}`}
                          onClick={() => {
                            const options = cast.optionsFor(sp);
                            setPicking("cast");
                            if (sp.level === 0) return setAiming({ spell: sp, atLevel: 0 });
                            if (options.length === 1) {
                              return setAiming({ spell: sp, atLevel: options[0]!.level });
                            }
                            setCasting(sp);
                          }}
                        >
                          {sp.concentration && <i className="conc" aria-hidden="true" />}
                          <span className="nm">{sp.name}</span>
                          <span className="c">
                            <span className="cost">
                              {sp.level === 0 ? "cantrip" : levelLabel(sp.level)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                  <p className="faint note">
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
                <p className="faint note">
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
                  loading={cast.book === null}
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
                  <p className="faint note">
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
                    <p className="faint note">
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
                {...(withWeapon ? { start: withWeapon } : {})}
                targets={visibleTargets}
                stanceAt={stanceAt}
                onCancel={() => {
                  setWithWeapon(null);
                  setPicking(null);
                }}
                onSend={(swing) => {
                  if (!character.economy.action) {
                    append({ type: "economySpent", who, kind: "action" });
                  }
                  setWithWeapon(null);
                  onSwing?.(swing);
                }}
              />
            ) : (
              <>
                {/*
                  * Two primaries, the character's own first — see
                  * leadWithSpell. And the small print names what it opens: "or
                  * something else" beside a weapon reads like every other
                  * option on the turn and means another WEAPON, which is the
                  * one thing a caster is not looking for.
                  */}
                {(leadWithSpell
                  ? ["cast" as const, "swing" as const]
                  : ["swing" as const, "cast" as const]
                ).map((which) =>
                  which === "swing" ? (
                    <button
                      key="swing"
                      className="pt-atk"
                      disabled={character.economy.action || attacks.length === 0}
                      onClick={() => setPicking("attack")}
                    >
                      {attacks.length > 0 ? `Attack with ${attacks[0]!.name}` : "Attack"}
                      {attacks.length > 1 && <small> or another weapon</small>}
                    </button>
                  ) : castable.length > 0 ? (
                    <button
                      key="cast"
                      className="pt-atk"
                      disabled={character.economy.action}
                      /* It says Cast Fire Bolt, so it casts Fire Bolt — the
                         same route the tile in the menu takes, rather than
                         opening a menu and asking again. */
                      onClick={() => {
                        const sp = castable[0]!;
                        setPicking("cast");
                        if (sp.level === 0) return setAiming({ spell: sp, atLevel: 0 });
                        const options = cast.optionsFor(sp);
                        if (options.length === 1) {
                          return setAiming({ spell: sp, atLevel: options[0]!.level });
                        }
                        setCasting(sp);
                      }}
                    >
                      Cast {castable[0]!.name}
                      {castable.length > 1 && <small> or another spell</small>}
                    </button>
                  ) : null,
                )}
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
          targets={reactionTargets}
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
