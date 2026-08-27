/**
 * Initiative.
 *
 * Active state is carried by luminance, never a hue: the row that is up sits
 * on a raised ground with a white edge and everything else is dimmed. Red
 * already means damage here, so a coloured "current turn" marker could be
 * confused with a creature that is nearly dead two rows down.
 *
 * What a player sees is decided per creature by the DM's disclosure setting,
 * and vague health is a word rather than a meter — the game already supplies
 * the vocabulary, and a bar would imitate a precision the player is not
 * meant to have.
 */

import { ConditionStrip } from "./Conditions.js";
import { SceneSet } from "./SceneSet.js";
import { describeRoom, isOpenGround, type Room } from "../domain/terrain.js";
import type { KnownSpell } from "../domain/spells.js";
import { useEffect, useState } from "react";
import { mergeStatblocks, type Statblock } from "../domain/statblock.js";
import { combatantsFor, creaturesFrom, type StagedCreature } from "../domain/stage.js";
import { loadMonsters } from "../store/srd.js";
import {
  activeCombatant, awaitingRolls, controls, DISCLOSURE, hasReaction, mayEndTurn,
  turnsUntil, visibleTo,
  type Combat, type Combatant, type Disclosure, type Seat,
} from "../domain/combat.js";

type Surprise = "none" | "monsters" | "players";
/**
 * Named sides, not pronouns. "We are" read from the DM's screen is wrong on
 * its face — the DM is not in the party — and "they" means whichever side you
 * happened to be thinking of.
 */
const SURPRISE_LABEL: Record<Surprise, string> = {
  none: "Nobody",
  monsters: "The encounter",
  players: "The party",
};
import type { EventBody } from "../domain/events.js";
import type { CampaignState } from "../domain/project.js";
import {
  describeClaim, onSave, sortClaims, verdictFor,
} from "../domain/attackflow.js";
import { AreaDamage } from "./AreaDamage.js";
import { healthStep, VAGUE_LABEL } from "./HpBar.js";
import { PlayerTurn } from "./PlayerTurn.js";
import { Readiness } from "./Readiness.js";
import { useAttacks } from "./useAttacks.js";

const nextDisclosure = (d: Disclosure): Disclosure =>
  DISCLOSURE[(DISCLOSURE.indexOf(d) + 1) % DISCLOSURE.length]!;

/**
 * Setting a fight up.
 *
 * Who is IN it is a decision, not an assumption. Parties split — half the
 * table is in the warehouse and half is on the roof — and a combat that
 * silently drafts everybody makes the DM either explain it away or track two
 * initiative orders in their head.
 *
 * Surprise is chosen per SIDE rather than per creature, because that is how
 * an ambush actually works: one group walked into it.
 */
function StartCombat({
  state, append,
}: {
  state: CampaignState;
  append: (body: EventBody) => void;
}) {
  const characters = Object.values(state.builds);
  const encounters = Object.values(state.encounters);
  /**
   * Who is OUT, not who is in. The party arrives asynchronously — a DM opens
   * the app before anybody has joined — and a snapshot of "everyone" taken at
   * first render silently excludes every character that syncs in afterwards.
   * Tracking exclusions makes the default correct no matter when it is read.
   */
  const [sittingOut, setSittingOut] = useState<string[]>([]);
  const inFight = characters.filter((b) => !sittingOut.includes(b.id)).map((b) => b.id);
  const [surprise, setSurprise] = useState<Surprise>("none");
  const [creatures, setCreatures] = useState<readonly StagedCreature[]>([]);
  /**
   * Loaded whenever prep exists, not when a panel is opened. Dropping an
   * encounter in without the statblocks is how six goblins once arrived with
   * one hit point each.
   */
  const [book, setBook] = useState<Statblock[] | null>(null);
  useEffect(() => {
    if (encounters.length === 0 || book) return;
    loadMonsters().then(setBook, () => setBook([]));
  }, [encounters.length, book]);

  const toggle = (id: string) =>
    setSittingOut((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  function dropIn(encounterId: string) {
    const enc = state.encounters[encounterId];
    if (!enc) return;
    setCreatures((c) => [
      ...c,
      ...creaturesFrom(enc, mergeStatblocks(book ?? [], state.homebrew)),
    ]);
  }

  function stage() {
    const combatants = combatantsFor({
      characters: characters.filter((b) => !sittingOut.includes(b.id)),
      creatures,
      surprise,
    });
    if (combatants.length > 0) append({ type: "combatStaged", combatants });
  }

  return (
    <div className="card-body">
      <span className="label cr-sub">Who is in this fight</span>
      <div className="chips">
        {characters.map((b) => (
          <button
            key={b.id}
            className={`chip${inFight.includes(b.id) ? " on" : ""}`}
            aria-pressed={inFight.includes(b.id)}
            onClick={() => toggle(b.id)}
          >
            {b.name}
          </button>
        ))}
        {characters.length === 0 && (
          <span className="faint" style={{ fontSize: ".84rem" }}>Nobody yet.</span>
        )}
      </div>

      <span className="label cr-sub" style={{ marginTop: 12 }}>Who is surprised</span>
      <div className="seg">
        {(["none", "monsters", "players"] as const).map((k) => (
          <button
            key={k}
            aria-pressed={surprise === k}
            className={surprise === k ? "on" : ""}
            onClick={() => setSurprise(k)}
          >
            {SURPRISE_LABEL[k]}
          </button>
        ))}
      </div>

      <span className="label cr-sub" style={{ marginTop: 12 }}>
        Against {creatures.length > 0 ? `· ${creatures.length}` : ""}
      </span>
      {creatures.map((c, i) => (
        <div className="init-row" key={i}>
          <input
            aria-label={`Creature ${i + 1} name`}
            value={c.name}
            placeholder="Goblin"
            onChange={(e) =>
              setCreatures(creatures.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))
            }
          />
          <input
            type="number"
            aria-label={`Creature ${i + 1} hp`}
            value={c.maxHp}
            onChange={(e) =>
              setCreatures(creatures.map((x, n) => (n === i ? { ...x, maxHp: Math.max(1, +e.target.value || 1) } : x)))
            }
          />
          <input
            type="number"
            aria-label={`Creature ${i + 1} armour class`}
            placeholder="AC"
            value={c.ac ?? ""}
            style={{ width: 62 }}
            onChange={(e) =>
              setCreatures(
                creatures.map((x, n) => {
                  if (n !== i) return x;
                  const ac = Number(e.target.value);
                  const { ac: _drop, ...rest } = x;
                  return Number.isFinite(ac) && ac > 0 ? { ...rest, ac } : rest;
                }),
              )
            }
          />
          <button
            aria-label={`Remove creature ${i + 1}`}
            onClick={() => setCreatures(creatures.filter((_, n) => n !== i))}
          >
            ✕
          </button>
        </div>
      ))}

      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={() => setCreatures([...creatures, { name: "", maxHp: 7 }])}>
          Add creature
        </button>
        {encounters.length > 0 && (
          <select
            aria-label="Drop in an encounter"
            value=""
            style={{ width: "auto" }}
            onChange={(e) => {
              if (e.target.value) dropIn(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">from prep…</option>
            {encounters.map((enc) => (
              <option key={enc.id} value={enc.id}>{enc.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={stage}
          disabled={inFight.length === 0 && creatures.length === 0}
        >
          Roll for initiative
        </button>
      </div>
    </div>
  );
}

/**
 * The moment between "roll for initiative" and the first turn.
 *
 * Everyone rolls on their own device, so the DM stops collecting numbers
 * verbally and the screen answers "who are we waiting on" without anyone
 * having to ask.
 */
/**
 * Where the fight is, for anyone who is not the DM.
 *
 * It sat inside the turn panel, which meant a player learned the room was
 * pitch dark at the moment it was already too late to say anything about it —
 * on their own turn, and never before. The room is a fact about the table,
 * not about whose go it is.
 */
function RoomLine({ scene }: { scene: Room }) {
  if (isOpenGround(scene)) return null;
  return (
    <div className="card-body" style={{ paddingBottom: 0 }}>
      <p className="room-is">
        <span className="label">The room</span>
        {describeRoom(scene)}
      </p>
    </div>
  );
}

/**
 * Something walks in on round three.
 *
 * Reinforcements are ordinary at a table and were impossible here: the only
 * way to add a creature was to cancel the fight and stage it again, throwing
 * away every hit point already spent. Three fields, because that is what the
 * order needs — a name, how much it can take, and where it goes.
 */
function Arrival({
  onAdd, onCancel,
}: {
  onAdd: (c: Combatant) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [hp, setHp] = useState(10);
  const [init, setInit] = useState("");

  const roll = Number(init);
  const ready = name.trim() !== "" && Number.isFinite(roll) && init.trim() !== "";

  return (
    <div className="card-body arrive">
      <span className="label">What arrives</span>
      <div className="row" style={{ marginTop: 8 }}>
        <input
          value={name}
          aria-label="Arrival name"
          placeholder="Ghoul"
          style={{ flex: "2 1 130px", width: "auto" }}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number" min={1} value={hp}
          aria-label="Arrival hit points"
          style={{ flex: "0 0 74px", width: "auto" }}
          onChange={(e) => setHp(Math.max(1, +e.target.value || 1))}
        />
        <input
          type="number" value={init}
          aria-label="Arrival initiative"
          placeholder="d20"
          style={{ flex: "0 0 74px", width: "auto" }}
          onChange={(e) => setInit(e.target.value)}
        />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button
          disabled={!ready}
          onClick={() =>
            onAdd({
              id: `cr-${Date.now().toString(36)}`,
              name: name.trim(),
              initiative: roll,
              source: { kind: "creature", maxHp: hp },
              controller: { kind: "dm" },
              disclosure: "vague",
              surprised: false,
              speed: 30,
            })
          }
        >
          It joins the fight
        </button>
        <button onClick={onCancel}>Never mind</button>
      </div>
      <p className="faint" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>
        It drops into the order at that initiative. Nobody's turn is skipped.
      </p>
    </div>
  );
}

function Rolling({
  combat, seat, append,
}: {
  combat: Combat;
  seat: Seat;
  append: (body: EventBody) => void;
}) {
  const waiting = awaitingRolls(combat);
  /**
   * The DM may roll for ANYONE, not only their own creatures — the same rule
   * that lets them always advance a turn. Somebody is in the toilet, somebody
   * has no device, and a fight that cannot start because of it is worse than
   * a DM rolling on their behalf. Players only ever see their own.
   */
  const mine = combat.order.filter(
    (c) => c.initiative === null && (seat.kind === "dm" || controls(seat, c.controller)),
  );

  return (
    <div className="card-body">
      <div className="init-head">
        <span className="label">Roll for initiative</span>
        <span className="faint num">
          {combat.order.length - waiting.length} of {combat.order.length}
        </span>
      </div>

      {mine.map((c) => (
        <InitiativeRow key={c.id} combatant={c} append={append} />
      ))}

      {mine.length === 0 && (
        <p className="faint" style={{ margin: "8px 0", fontSize: ".86rem" }}>
          {waiting.length === 0 ? "Everyone has rolled." : "Waiting on the others."}
        </p>
      )}

      <div className="init-waiting">
        {combat.order
          .filter((c) => visibleTo(seat, c))
          .map((c) => (
            <span className={`chip${c.initiative === null ? "" : " on"}`} key={c.id}>
              {c.name}
              {c.initiative !== null && <> <b className="num">{c.initiative}</b></>}
            </span>
          ))}
      </div>

      {seat.kind === "dm" && (
        <div className="row" style={{ marginTop: 12 }}>
          <button
            onClick={() => append({ type: "combatBegan" })}
            disabled={combat.order.every((c) => c.initiative === null)}
          >
            {waiting.length === 0 ? "Begin" : `Begin without ${waiting.length}`}
          </button>
          <button onClick={() => append({ type: "combatEnded" })}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/** One roll. The app names the modifier and a person rolls the die. */
function InitiativeRow({
  combatant, append,
}: {
  combatant: Combatant;
  append: (body: EventBody) => void;
}) {
  const [value, setValue] = useState("");
  const send = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || value.trim() === "") return;
    append({ type: "initiativeRolled", combatantId: combatant.id, value: n });
    setValue("");
  };
  return (
    <div className="init-row">
      <span className="n">{combatant.name}</span>
      <input
        type="number"
        aria-label={`${combatant.name} initiative`}
        value={value}
        placeholder="d20"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
      />
      <button aria-label={`Set ${combatant.name} initiative`} onClick={send}>Set</button>
    </div>
  );
}

export function Combat({
  state, seat, append, onCast, takeReaction, onReactionOpened, buzz,
}: {
  state: CampaignState;
  seat: Seat;
  append: (body: EventBody) => void;
  /** Sends a player to their spells, where casting lives. */
  /** An aimed spell, on its way to the DM's queue like any other claim. */
  onCast?: (c: {
    spell: KnownSpell;
    atLevel: number;
    target: Combatant;
    toHit: number | null;
    damage: number;
    damageType: string;
  }) => void;
  /** Said yes to a reaction from another screen — open the swing on arrival. */
  takeReaction?: boolean;
  onReactionOpened?: () => void;
  /** The "tell me when it's my turn" control, owned by the app. */
  buzz?: React.ReactNode;
}) {
  const [hit, setHit] = useState(5);
  const [area, setArea] = useState(false);
  /** Who a player has chosen to swing at, and what they rolled for damage. */
  const [target, setTarget] = useState<Combatant | null>(null);
  const [dealt, setDealt] = useState(0);
  /**
   * The DM's swing, in two flavours. On a creature's own turn the attacker is
   * whoever is up. Off-turn it is an opportunity attack, and WHICH creature
   * is reacting has to be asked — attributing it to whoever happens to be
   * active would credit the player whose turn provoked it.
   */
  const [offering, setOffering] = useState(false);
  /** Reinforcements: the form for something walking in mid-fight. */
  const [something, setSomething] = useState(false);
  /** Which row has its own number open, and what it says. */
  const [hurting, setHurting] = useState<string | null>(null);
  const [amount, setAmount] = useState(5);
  const [offerTo, setOfferTo] = useState<readonly string[]>([]);
  const [offerWhy, setOfferWhy] = useState("");
  const [dmPicking, setDmPicking] = useState<null | "target" | "reactor">(null);
  const [reactor, setReactor] = useState<Combatant | null>(null);
  const combat = state.combat;

  // What the seated player is holding, so the walkthrough can name the weapon
  // rather than asking for "your attack bonus".
  const seated = seat.kind === "player" ? state.builds[seat.characterId] : undefined;
  const seatedState = seated ? state.characters[seated.id] : undefined;
  const { attacks: playerAttacks } = useAttacks(seated, seatedState);

  if (!combat) {
    return (
      <section className="card">
        <div className="card-hd"><span className="label">Combat</span></div>
        {seat.kind === "dm" ? (
          <StartCombat state={state} append={append} />
        ) : seated && seatedState ? (
          <>
            <Readiness build={seated} state={seatedState} attacks={playerAttacks} />
            {buzz && <div className="card-body" style={{ paddingTop: 0 }}>{buzz}</div>}
          </>
        ) : (
          <div className="card-body"><p className="faint" style={{ margin: 0 }}>No fight yet.</p></div>
        )}
      </section>
    );
  }

  if (combat.phase === "rolling") {
    return (
      <section className="card">
        <div className="card-hd"><span className="label">Combat</span></div>
        {/* Rolling initiative is when a DM has the time to say what the room
            is like, and where opening a prepared place lands them. Hiding the
            control until Begin meant the one window for it was shut. */}
        {seat.kind === "dm" ? (
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <SceneSet scene={combat.scene} append={append} />
          </div>
        ) : (
          <RoomLine scene={combat.scene} />
        )}
        <Rolling combat={combat} seat={seat} append={append} />
      </section>
    );
  }

  const active = activeCombatant(combat);
  /** Who follows, so a player can see their own turn coming. */
  const upNext = combat.order.length > 1
    ? combat.order[(combat.turn + 1) % combat.order.length]
    : null;
  const canEnd = mayEndTurn(seat, combat);
  const mine = seat.kind === "player" ? turnsUntil(combat, seat.characterId) : null;
  const visible = combat.order.filter((c) => visibleTo(seat, c));

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">
          Round <span className="num">{combat.round}</span>
          <span className="faint">
            {" · "}turn <span className="num">{combat.turn + 1}</span> of{" "}
            <span className="num">{combat.order.length}</span>
          </span>
        </span>
        {mine !== null && (
          <span
            className={`label turns-away${mine === 0 ? " now" : ""}`}
          >
            {mine === 0 ? "Your turn" : `${mine} turn${mine === 1 ? "" : "s"} away`}
          </span>
        )}
      </div>

      {/*
        * Whose turn it is, in words.
        *
        * It was carried by a highlight on one row and nothing else — which
        * is legible when you are looking at the list and useless when you
        * have just looked up from the table. The next name is here too,
        * because "you are after the ghoul" is the question a player asks
        * more often than any other.
        */}
      <div className="up">
        <span className="up-now">
          <span className="k">Up now</span>
          <span className="n">{active?.name ?? "nobody"}</span>
        </span>
        {upNext && (
          <span className="up-next">
            <span className="k">Then</span>
            <span className="n">{upNext.name}</span>
          </span>
        )}
      </div>

      {seat.kind === "player" && <RoomLine scene={combat.scene} />}

      {seat.kind === "player" && state.characters[seat.characterId] && (
        <PlayerTurn
          combat={combat}
          seat={seat}
          character={state.characters[seat.characterId]!}
          append={append}
          attacks={playerAttacks}
          {...(seated ? { build: seated } : {})}
          {...(takeReaction ? { takeReaction } : {})}
          {...(onReactionOpened ? { onReactionOpened } : {})}
          {...(onCast ? { onCast } : {})}
          onSwing={(swing) => {
            // Claimed, not applied: the DM says whether it lands.
            append({
              type: "attackClaimed",
              claim: {
                id: `atk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                who: seated?.id ?? "",
                whoName: seated?.name ?? "",
                targetId: swing.target.id,
                targetName: swing.target.name,
                weapon: swing.attack.name,
                toHit: swing.toHit,
                damage: swing.damage,
                damageType: swing.attack.damageType,
                at: Date.now(),
              },
            });
          }}
        />
      )}

      {/* Rolling to hit happens on the sheet; this is where what landed goes.
          It stays until dismissed so a miss is a deliberate act rather than a
          panel that vanished. */}
      {target && (
        <div className="swing">
          <span className="label">Attacking {target.name}</span>
          {/* What the attacker can do, with the numbers already read off its
              statblock — the DM's turn should not be slower than a player's. */}
          {(reactor ?? active)?.source.kind === "creature" &&
            ((reactor ?? active)?.source as { attacks?: readonly { name: string; toHit?: number; dice?: string; type?: string }[] })
              .attacks?.map((a) => (
                <button
                  className="swing-act"
                  key={a.name}
                  aria-label={`Use ${a.name}`}
                  onClick={() => setDealt(0)}
                >
                  {a.name}
                  <span className="faint">
                    {a.toHit !== undefined ? ` ${a.toHit >= 0 ? "+" : ""}${a.toHit} to hit` : ""}
                    {a.dice ? ` · ${a.dice}${a.type ? ` ${a.type}` : ""}` : ""}
                  </span>
                </button>
              ))}
          <input
            type="number" min={0} value={dealt} aria-label="Damage dealt"
            style={{ width: 76 }}
            onChange={(e) => setDealt(Math.max(0, +e.target.value || 0))}
          />
          <button
            disabled={dealt <= 0}
            onClick={() => {
              // A hit does not care which side of the table it landed on, and
              // damage to a character is what owes a concentration save.
              append(
                target.source.kind === "character"
                  ? { type: "damageApplied", who: target.source.characterId, amount: dealt }
                  : { type: "creatureDamaged", combatantId: target.id, amount: dealt },
              );
              setTarget(null);
              setDealt(0);
            }}
          >
            It hits
          </button>
          <button onClick={() => setTarget(null)}>Missed</button>
        </div>
      )}

      {/* Claims wait here. A player rolled; nothing has happened yet. */}
      {seat.kind === "dm" && state.claims.length > 0 && (
        <div className="claims">
          {sortClaims(state.claims).map((c) => {
            const target = combat.order.find((x) => x.id === c.targetId);
            const ac = target?.source.kind === "creature" ? target.source.ac : undefined;
            const verdict = verdictFor(c.toHit, ac);
            return (
              <div className={`claim v-${verdict}`} key={c.id}>
                <span className="nm">
                  {c.whoName} → {c.targetName}
                  <span className="faint"> · {c.weapon}</span>
                </span>
                <span className="say">{describeClaim(c, ac)}</span>
                <span className="dmg num">{c.damage} {c.damageType}</span>
                <span className="acts">
                  <button
                    aria-label={`Apply ${c.damage} to ${c.targetName}`}
                    onClick={() => append({ type: "attackResolved", claimId: c.id, applied: true })}
                  >
                    {c.save ? `Failed — ${c.damage}` : verdict === "misses" ? "Hits anyway" : "It hits"}
                  </button>
                  {/* The one place the app made the DM do arithmetic: a save
                      that halves it, announced after the dice are already on
                      the table. Half rounds down, and the button says the
                      number so nobody has to trust it. */}
                  {c.save?.half && (
                    <button
                      aria-label={`Apply ${onSave(c)} to ${c.targetName} on a save`}
                      onClick={() =>
                        append({
                          type: "attackResolved",
                          claimId: c.id,
                          applied: true,
                          amount: onSave(c),
                        })
                      }
                    >
                      Saved — {onSave(c)}
                    </button>
                  )}
                  <button
                    aria-label={`Reject ${c.whoName}'s attack`}
                    onClick={() => append({ type: "attackResolved", claimId: c.id, applied: false })}
                  >
                    {c.save ? "Saved — none" : "Missed"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* The one thing the app cannot see and will not guess. */}
      {seat.kind === "dm" && (
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <SceneSet scene={combat.scene} append={append} />
        </div>
      )}

      {seat.kind === "dm" && offering && (
        <div className="card-body offer">
          <span className="label">Whose reaction?</span>
          <div className="tgt">
            {combat.order
              .filter((c) => c.source.kind === "character")
              .map((c) => (
                <button
                  className={`offer-row${offerTo.includes(c.id) ? " on" : ""}`}
                  key={c.id}
                  aria-pressed={offerTo.includes(c.id)}
                  onClick={() =>
                    setOfferTo((ids) =>
                      ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id],
                    )
                  }
                >
                  {c.name}
                </button>
              ))}
          </div>
          <input
            aria-label="Reason for the reaction"
            placeholder="the goblin is leaving your reach"
            value={offerWhy}
            onChange={(e) => setOfferWhy(e.target.value)}
          />
          <div className="row">
            <button
              disabled={offerTo.length === 0}
              onClick={() => {
                append({
                  type: "reactionOffered",
                  to: offerTo,
                  because: offerWhy.trim() || "something is happening",
                  from: active?.name ?? "someone",
                });
                setOffering(false);
                setOfferTo([]);
                setOfferWhy("");
              }}
            >
              Ask them
            </button>
          </div>
        </div>
      )}

      {/* A shove, waiting on the only person who can settle it. */}
      {seat.kind === "dm" && combat.shove && (
        <div className="card-body shove-ask">
          <span className="label">
            {combat.shove.byName} shoves {combat.shove.targetName}
          </span>
          <p className="swing-ask">
            Athletics <b>{combat.shove.total}</b>. Roll theirs — Athletics or
            Acrobatics, their choice.
          </p>
          <div className="row">
            <button onClick={() => append({ type: "shoveResolved", prone: true })}>
              Down it goes
            </button>
            <button onClick={() => append({ type: "shoveResolved", prone: false })}>
              It holds
            </button>
          </div>
        </div>
      )}

      {/* What people are holding, so it is not one player's memory. */}
      {Object.keys(combat.readied).length > 0 && (
        <div className="card-body readied">
          {combat.order
            .filter((c) => combat.readied[c.id])
            .map((c) => (
              <div className="ready-row" key={c.id}>
                <span className="nm">{c.name} is waiting</span>
                <span className="faint">{combat.readied[c.id]}</span>
                {seat.kind === "dm" && (
                  <button
                    onClick={() =>
                      append({ type: "readiedActionCleared", combatantId: c.id })
                    }
                  >
                    It fired
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      <div className="track">
        {visible.map((c) => {
          const isActive = active?.id === c.id;
          const hp =
            c.source.kind === "creature"
              ? { current: combat.creatureHp[c.id] ?? 0, max: c.source.maxHp }
              : {
                  current: state.characters[c.source.characterId]?.currentHp ?? 0,
                  max: state.builds[c.source.characterId]?.maxHp ?? 1,
                };
          const showExact = seat.kind === "dm" || c.disclosure === "exact";
          return (
            <div className={`cbt${isActive ? " on" : ""}`} key={c.id}>
              <span className="i num">{c.initiative}</span>
              <span className="who">
                <span className="nm">{c.name}</span>
                {seat.kind === "dm" && c.source.kind === "creature" && (
                  <button
                    className="disc"
                    onClick={() =>
                      append({
                        type: "disclosureSet",
                        combatantId: c.id,
                        level: nextDisclosure(c.disclosure),
                      })
                    }
                  >
                    {c.disclosure}
                  </button>
                )}
              </span>
              <span className="hp num">
                {showExact
                  ? `${hp.current}/${hp.max}`
                  : c.disclosure === "vague"
                    ? VAGUE_LABEL[healthStep(hp.current, hp.max)]
                    : "—"}
              </span>
              {seat.kind === "dm" && c.source.kind === "creature" && (
                <>
                  <button
                    className="hitbtn"
                    aria-label={`Hurt ${c.name} by ${hit}`}
                    onClick={() => append({ type: "creatureDamaged", combatantId: c.id, amount: hit })}
                  >
                    −{hit}
                  </button>
                  {/*
                    * And a number that is not the last one used. It was a
                    * single box at the foot of the card feeding every row,
                    * so "which row does this apply to" was answered by
                    * remembering rather than by looking.
                    */}
                  <button
                    className="hitbtn more"
                    aria-label={`Hurt or heal ${c.name}`}
                    aria-expanded={hurting === c.id}
                    onClick={() => setHurting(hurting === c.id ? null : c.id)}
                  >
                    {hurting === c.id ? "−" : "…"}
                  </button>
                </>
              )}
              {hurting === c.id && seat.kind === "dm" && c.source.kind === "creature" && (
                <div className="hurt-row">
                  <input
                    type="number" min={0} value={amount}
                    aria-label={`Amount for ${c.name}`}
                    style={{ width: 74 }}
                    onChange={(e) => setAmount(Math.max(0, +e.target.value || 0))}
                  />
                  <button
                    aria-label={`Damage ${c.name}`}
                    onClick={() => {
                      append({ type: "creatureDamaged", combatantId: c.id, amount });
                      setHit(amount);
                      setHurting(null);
                    }}
                  >
                    Hurt
                  </button>
                  <button
                    aria-label={`Heal ${c.name}`}
                    onClick={() => {
                      append({ type: "creatureDamaged", combatantId: c.id, amount: -amount });
                      setHurting(null);
                    }}
                  >
                    Heal
                  </button>
                  <span className="faint">of {hp.max}</span>
                </div>
              )}
              {/* What is wrong with them, where both sides can read it. This
                  is what turns "roll a d20" into "roll two and take the
                  higher" one screen over. */}
              <ConditionStrip
                who={c.name}
                on={
                  c.source.kind === "creature"
                    ? (combat.creatureConditions[c.id] ?? [])
                    : (state.characters[c.source.characterId]?.conditions ?? [])
                }
                editable={seat.kind === "dm" && c.source.kind === "creature"}
                onAdd={(cond) =>
                  append({ type: "creatureConditionAdded", combatantId: c.id, condition: cond })
                }
                onRemove={(cond) =>
                  append({ type: "creatureConditionRemoved", combatantId: c.id, condition: cond })
                }
              />
            </div>
          );
        })}
      </div>

      {seat.kind === "dm" && (
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <button
            className="next-turn"
            disabled={!canEnd}
            aria-label="Next turn"
            onClick={() => append({ type: "turnAdvanced", from: combat.turn })}
          >
            Next turn
            <small>{upNext ? `${upNext.name} is up` : "round ends"}</small>
          </button>
        </div>
      )}

      <div className="card-body">
        <div className="controls" style={{ marginTop: 0 }}>
          {seat.kind === "dm" && (
            <>
              {/*
                * The DM's side of an attack. Creature rows carry a fast "−N"
                * for chip damage, but a monster swinging at a PLAYER had no
                * route at all from here — the only way was to leave the fight
                * for the party screen, which is the one thing you cannot do
                * mid-turn.
                */}
              <button
                onClick={() => {
                  if (dmPicking) {
                    setDmPicking(null);
                    setReactor(null);
                    return;
                  }
                  const own = active !== null && active.controller.kind === "dm";
                  setReactor(own ? active : null);
                  setDmPicking(own ? "target" : "reactor");
                }}
              >
                {dmPicking
                  ? "Cancel"
                  : active && active.controller.kind === "dm"
                    ? `Attack with ${active.name}`
                    : "Opportunity attack"}
              </button>
              {/*
                * Reactions, offered rather than detected. The app cannot see
                * reach or line of sight — the positions are on the table —
                * so it can never know the moment arrived. The DM does, and
                * this is them saying so to exactly the people it concerns,
                * instead of asking the room and hoping.
                */}
              <button
                onClick={() => setOffering((v) => !v)}
                disabled={combat.offer !== null}
              >
                {offering ? "Cancel" : "Offer a reaction"}
              </button>
            </>
          )}
          {seat.kind === "dm" && (
            <>
              <span className="quick">
                <span className="k">Quick hit</span>
                <input
                  type="number" min={0} value={hit} aria-label="Creature damage"
                  onChange={(e) => setHit(Math.max(0, +e.target.value || 0))}
                />
              </span>
              <button onClick={() => setArea((v) => !v)}>Area damage</button>
              <button onClick={() => setSomething((v) => !v)}>
                {something ? "Cancel" : "Something arrives"}
              </button>
              {/*
                * Ending a fight is one press and cannot be misread as the one
                * beside it, so it keeps its distance from the control the DM
                * presses forty times an evening.
                */}
              <button className="end-it" onClick={() => append({ type: "combatEnded" })}>
                End combat
              </button>
            </>
          )}
        </div>

        {something && seat.kind === "dm" && (
          <Arrival
            onCancel={() => setSomething(false)}
            onAdd={(combatant) => {
              append({ type: "combatantJoined", combatant });
              setSomething(false);
            }}
          />
        )}
        {dmPicking === "reactor" && seat.kind === "dm" && (() => {
          const able = combat.order.filter(
            (c) =>
              c.controller.kind === "dm" &&
              c.id !== active?.id &&
              hasReaction(combat, c.id) &&
              (c.source.kind !== "creature" || (combat.creatureHp[c.id] ?? 1) > 0),
          );
          return (
            <div className="tgt">
              <span className="label">Which one reacts</span>
              {able.map((c) => (
                <button
                  className="tgt-row"
                  key={c.id}
                  onClick={() => {
                    setReactor(c);
                    setDmPicking("target");
                  }}
                >
                  {c.name}
                </button>
              ))}
              {able.length === 0 && (
                <p className="faint" style={{ margin: "6px 0", fontSize: ".84rem" }}>
                  Nothing of yours has a reaction left. They come back on their
                  own turns.
                </p>
              )}
            </div>
          );
        })()}

        {dmPicking === "target" && seat.kind === "dm" && (
          <div className="tgt">
            <span className="label">
              {reactor ? `${reactor.name} attacks` : "Attacks"}
            </span>
            {/* Everyone but the attacker: monsters turn on each other often
                enough — charmed, confused, or just badly aimed. */}
            {combat.order
              .filter((c) => c.id !== reactor?.id)
              .map((c) => (
                <button
                  className="tgt-row"
                  key={c.id}
                  onClick={() => {
                    // Off-turn, this IS an opportunity attack: one event
                    // spends the reaction and records who it was against, so
                    // undoing the attack gives the reaction back.
                    if (reactor && reactor.id !== active?.id) {
                      append({
                        type: "opportunityTaken",
                        attacker: reactor.id,
                        against: c.id,
                      });
                    }
                    setTarget(c);
                    setDealt(0);
                    setDmPicking(null);
                  }}
                >
                  {c.name}
                </button>
              ))}
          </div>
        )}
        {area && seat.kind === "dm" && (
          <AreaDamage combat={combat} onApply={append} onClose={() => setArea(false)} />
        )}
        {seat.kind === "dm" && !canEnd && (
          <p className="faint" style={{ fontSize: ".84rem", margin: "10px 0 0" }}>
            {active ? `${active.name} is up.` : "Nobody is up."}
          </p>
        )}
      </div>
    </section>
  );
}
