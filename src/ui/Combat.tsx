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

import { useState } from "react";
import {
  activeCombatant, DISCLOSURE, mayEndTurn, turnsUntil, visibleTo,
  type Combatant, type Disclosure, type Seat,
} from "../domain/combat.js";
import type { EventBody } from "../domain/events.js";
import type { CampaignState } from "../domain/project.js";
import { AreaDamage } from "./AreaDamage.js";
import { healthStep, VAGUE_LABEL } from "./HpBar.js";

const nextDisclosure = (d: Disclosure): Disclosure =>
  DISCLOSURE[(DISCLOSURE.indexOf(d) + 1) % DISCLOSURE.length]!;

function StartCombat({
  state, append,
}: {
  state: CampaignState;
  append: (body: EventBody) => void;
}) {
  const characters = Object.values(state.builds);
  const [rolls, setRolls] = useState<Record<string, number>>({});
  const [creatures, setCreatures] = useState<
    { name: string; initiative: number; maxHp: number }[]
  >([]);

  function begin() {
    const order: Combatant[] = [
      ...characters.map((b) => ({
        id: `pc-${b.id}`,
        name: b.name,
        initiative: rolls[b.id] ?? b.abilityMods.dex,
        source: { kind: "character" as const, characterId: b.id },
        controller: { kind: "player" as const, characterId: b.id },
        disclosure: "exact" as const,
      })),
      ...creatures.map((c, i) => ({
        id: `cr-${Date.now().toString(36)}-${i}`,
        name: c.name || `Creature ${i + 1}`,
        initiative: c.initiative,
        source: { kind: "creature" as const, maxHp: c.maxHp },
        controller: { kind: "dm" as const },
        disclosure: "vague" as const,
      })),
    ];
    if (order.length > 0) append({ type: "combatStarted", order });
  }

  return (
    <div className="card-body">
      <span className="label" style={{ display: "block", marginBottom: 10 }}>
        Initiative — roll a d20 and add the modifier shown
      </span>
      {characters.map((b) => (
        <div className="init-row" key={b.id}>
          <span className="n">{b.name}</span>
          <span className="faint num">{b.abilityMods.dex >= 0 ? "+" : "−"}{Math.abs(b.abilityMods.dex)}</span>
          <input
            type="number"
            aria-label={`${b.name} initiative`}
            value={rolls[b.id] ?? b.abilityMods.dex}
            onChange={(e) => setRolls({ ...rolls, [b.id]: +e.target.value || 0 })}
          />
        </div>
      ))}

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
            aria-label={`Creature ${i + 1} initiative`}
            value={c.initiative}
            onChange={(e) =>
              setCreatures(creatures.map((x, n) => (n === i ? { ...x, initiative: +e.target.value || 0 } : x)))
            }
          />
        </div>
      ))}

      <div className="row" style={{ marginTop: 12 }}>
        <button
          onClick={() => setCreatures([...creatures, { name: "", initiative: 10, maxHp: 7 }])}
        >
          Add creature
        </button>
        <button onClick={begin} disabled={characters.length === 0}>Start combat</button>
      </div>
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
  const combat = state.combat;

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
          <button
            disabled={!canEnd}
            onClick={() => append({ type: "turnAdvanced", from: combat.turn })}
          >
            {seat.kind === "dm" ? "Advance turn" : "End turn"}
          </button>
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
        {area && seat.kind === "dm" && (
          <AreaDamage combat={combat} onApply={append} onClose={() => setArea(false)} />
        )}
        {!canEnd && (
          <p className="faint" style={{ fontSize: ".84rem", margin: "10px 0 0" }}>
            {active ? `${active.name} is up.` : "Nobody is up."}
          </p>
        )}
      </div>
    </section>
  );
}
