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

import { useEffect, useState } from "react";
import {
  instanceLabel, mergeStatblocks, rollHp, type Statblock,
} from "../domain/statblock.js";
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
import { describeVerdict, sortClaims, verdictFor } from "../domain/attackflow.js";
import { AreaDamage } from "./AreaDamage.js";
import { healthStep, VAGUE_LABEL } from "./HpBar.js";
import { PlayerTurn } from "./PlayerTurn.js";
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
  const [creatures, setCreatures] = useState<{ name: string; maxHp: number; ac?: number }[]>([]);
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
    const catalogue = mergeStatblocks(book ?? [], state.homebrew);
    const added: { name: string; maxHp: number }[] = [];
    for (const entry of enc.entries) {
      const sb = catalogue.find((m) => m.id === entry.statblockId);
      for (let i = 0; i < entry.count; i++) {
        added.push({
          name: instanceLabel(entry.name, i, entry.count),
          // An unknown statblock lands as 1, which is visible as wrong rather
          // than plausible — the same choice the encounter builder makes.
          maxHp: sb ? (entry.hpMode === "rolled" ? rollHp(sb.hitDice) : sb.hp) : 1,
          ...(sb ? { ac: sb.ac } : {}),
        });
      }
    }
    setCreatures((c) => [...c, ...added]);
  }

  function stage() {
    const combatants: Combatant[] = [
      ...characters
        .filter((b) => inFight.includes(b.id))
        .map((b) => ({
          id: `pc-${b.id}`,
          name: b.name,
          initiative: null,
          source: { kind: "character" as const, characterId: b.id },
          controller: { kind: "player" as const, characterId: b.id },
          disclosure: "exact" as const,
          surprised: surprise === "players",
          speed: b.speed,
        })),
      ...creatures.map((c, i) => ({
        id: `cr-${Date.now().toString(36)}-${i}`,
        name: c.name || `Creature ${i + 1}`,
        initiative: null,
        source: { kind: "creature" as const, maxHp: c.maxHp, ...(c.ac ? { ac: c.ac } : {}) },
        controller: { kind: "dm" as const },
        disclosure: "vague" as const,
        surprised: surprise === "monsters",
        speed: 30,
      })),
    ];
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
  state, seat, append,
}: {
  state: CampaignState;
  seat: Seat;
  append: (body: EventBody) => void;
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
        <Rolling combat={combat} seat={seat} append={append} />
      </section>
    );
  }

  const active = activeCombatant(combat);
  const canEnd = mayEndTurn(seat, combat);
  const mine = seat.kind === "player" ? turnsUntil(combat, seat.characterId) : null;
  const visible = combat.order.filter((c) => visibleTo(seat, c));

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Round <span className="num">{combat.round}</span></span>
        {mine !== null && (
          <span
            className={`label turns-away${mine === 0 ? " now" : ""}`}
          >
            {mine === 0 ? "Your turn" : `${mine} turn${mine === 1 ? "" : "s"} away`}
          </span>
        )}
      </div>

      {seat.kind === "player" && state.characters[seat.characterId] && (
        <PlayerTurn
          combat={combat}
          seat={seat}
          character={state.characters[seat.characterId]!}
          append={append}
          attacks={playerAttacks}
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
                <span className="say">{describeVerdict(c.toHit, ac)}</span>
                <span className="dmg num">{c.damage} {c.damageType}</span>
                <span className="acts">
                  <button
                    aria-label={`Apply ${c.damage} to ${c.targetName}`}
                    onClick={() => append({ type: "attackResolved", claimId: c.id, applied: true })}
                  >
                    {verdict === "misses" ? "Hits anyway" : "It hits"}
                  </button>
                  <button
                    aria-label={`Reject ${c.whoName}'s attack`}
                    onClick={() => append({ type: "attackResolved", claimId: c.id, applied: false })}
                  >
                    Missed
                  </button>
                </span>
              </div>
            );
          })}
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
                <button
                  className="hitbtn"
                  onClick={() => append({ type: "creatureDamaged", combatantId: c.id, amount: hit })}
                >
                  −{hit}
                </button>
              )}
            </div>
          );
        })}
      </div>

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
              <button
                disabled={!canEnd}
                onClick={() => append({ type: "turnAdvanced", from: combat.turn })}
              >
                Advance turn
              </button>
            </>
          )}
          {seat.kind === "dm" && (
            <>
              <input
                type="number" min={0} value={hit} aria-label="Creature damage"
                style={{ width: 76 }}
                onChange={(e) => setHit(Math.max(0, +e.target.value || 0))}
              />
              <button onClick={() => setArea((v) => !v)}>Area damage</button>
              <button onClick={() => append({ type: "combatEnded" })}>End combat</button>
            </>
          )}
        </div>
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
