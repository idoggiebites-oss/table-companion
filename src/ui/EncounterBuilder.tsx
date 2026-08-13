/**
 * The encounter builder — the DM's desk surface.
 *
 * Two things it does that a piece of paper cannot. It sums XP across
 * instances, which is the arithmetic nobody enjoys. And it shows the WORKING
 * rather than only the verdict: raw × multiplier = adjusted, because the
 * multiplier growing with creature count is the step everyone forgets, and a
 * band on its own teaches nobody why adding a seventh goblin mattered.
 *
 * The party is not typed in. The app already has the characters, so the
 * budget is computed — which removes the most tedious step from every
 * encounter calculator that exists.
 *
 * Difficulty is optional throughout: without a budget you still get totals.
 * See dmg-tables.ts for why that matters.
 */

import { useEffect, useMemo, useState } from "react";
import type { Combatant, Disclosure } from "../domain/combat.js";
import { DISCLOSURE } from "../domain/combat.js";
import { budgetForParty, encounterMultiplier } from "../domain/dmg-tables.js";
import {
  addEntry, EMPTY_ENCOUNTER, patchEntry, setCount, totals,
  type Encounter, type HpMode,
} from "../domain/encounter.js";
import type { EventBody } from "../domain/events.js";
import type { CampaignState } from "../domain/project.js";
import {
  formatCr, instanceLabel, rollHp, searchStatblocks, type Statblock,
} from "../domain/statblock.js";
import { loadMonsters } from "../store/srd.js";

const nextDisclosure = (d: Disclosure): Disclosure =>
  DISCLOSURE[(DISCLOSURE.indexOf(d) + 1) % DISCLOSURE.length]!;

const d20 = () => 1 + Math.floor(Math.random() * 20);
const mod = (score: number) => Math.floor((score - 10) / 2);

/** Where the working is shown rather than only the verdict. */
function Working({
  state, encounter,
}: {
  state: CampaignState;
  encounter: Encounter;
}) {
  const levels = Object.values(state.builds).map((b) => b.totalLevel);
  const budget = budgetForParty(levels);
  const multiplier = encounterMultiplier(
    encounter.entries.reduce((n, x) => n + x.count, 0),
  );
  const t = totals(encounter, levels.length, budget, multiplier);

  const scale = budget ? budget.deadly * 1.4 : 0;
  const pct = (v: number) => (scale ? Math.max(0, Math.min(100, (v / scale) * 100)) : 0);

  return (
    <div className="working">
      <div className="calc">
        <span><b className="num">{t.rawXp.toLocaleString()}</b><i>Raw XP</i></span>
        <span className="op">×</span>
        <span><b className="num">{t.multiplier}</b><i>{t.creatures} creatures</i></span>
        <span className="op">=</span>
        <span><b className="num">{t.adjustedXp.toLocaleString()}</b><i>Adjusted</i></span>
      </div>

      {budget ? (
        <>
          <div className="band">
            <span className="band-name">{t.band}</span>
            <span className="faint">
              against {levels.length} character{levels.length === 1 ? "" : "s"}
            </span>
          </div>
          {/* Magnitude, so a sequential single hue — never the health ramp,
              which is reserved for creatures. */}
          <div className="gauge">
            <i className="b1" /><i className="b2" /><i className="b3" /><i className="b4" /><i className="b5" />
            <span className="pin" style={{ left: `${pct(t.adjustedXp)}%` }} />
          </div>
          <div className="ticks">
            {([["Easy", budget.easy], ["Medium", budget.medium],
               ["Hard", budget.hard], ["Deadly", budget.deadly]] as const).map(([k, v]) => (
              <span className="tk" style={{ left: `${pct(v)}%` }} key={k}>
                <b>{k}</b><span className="num">{v.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="faint" style={{ fontSize: ".82rem", margin: "10px 0 0" }}>
          Import a character and the difficulty band appears.
        </p>
      )}

      <p className="faint" style={{ fontSize: ".8rem", margin: "10px 0 0" }}>
        Award <b className="num">{t.rawXp.toLocaleString()}</b> — the raw total,
        never the adjusted one. {t.perCharacter.toLocaleString()} each.
      </p>
    </div>
  );
}

export function EncounterBuilder({
  state, append,
}: {
  state: CampaignState;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<Statblock[] | null>(null);
  const [text, setText] = useState("");
  const [encounter, setEncounter] = useState<Encounter>({
    ...EMPTY_ENCOUNTER,
    id: `enc-${Date.now().toString(36)}`,
    name: "",
  });

  useEffect(() => {
    if (open && !all) loadMonsters().then(setAll, () => setAll([]));
  }, [open, all]);

  const results = useMemo(
    () => (all && text.trim() ? searchStatblocks(all, { text }).slice(0, 8) : []),
    [all, text],
  );
  const saved = Object.values(state.encounters);

  /**
   * One tap: instances, labels, hit points, initiative, disclosure.
   *
   * Loads the statblocks itself rather than trusting that the builder was
   * opened first — dropping a saved encounter at the table is the common
   * case, and without this every creature silently arrived with 1 hit point.
   */
  async function dropIntoInitiative(e: Encounter) {
    const monsters = all ?? (await loadMonsters().catch(() => []));
    if (!all && monsters.length > 0) setAll(monsters);
    const lookup = new Map(monsters.map((m) => [m.id, m]));

    const order: Combatant[] = [];
    for (const entry of e.entries) {
      const sb = lookup.get(entry.statblockId);
      // Monster initiative is a hidden DM roll, which the design notes put
      // squarely in the app's half of the labour.
      const init = d20() + (sb ? mod(sb.abilities.dex) : 0);
      for (let i = 0; i < entry.count; i++) {
        const hp = sb
          ? entry.hpMode === "rolled"
            ? rollHp(sb.hitDice)
            : sb.hp
          : 1; // unknown statblock: visible as wrong rather than plausible
        order.push({
          id: `cr-${entry.statblockId}-${Date.now().toString(36)}-${i}`,
          name: instanceLabel(entry.name, i, entry.count),
          initiative: init,
          source: { kind: "creature", maxHp: hp },
          controller: { kind: "dm" },
          disclosure: entry.disclosure,
        });
      }
    }
    for (const b of Object.values(state.builds)) {
      order.push({
        id: `pc-${b.id}`,
        name: b.name,
        initiative: d20() + b.abilityMods.dex,
        source: { kind: "character", characterId: b.id },
        controller: { kind: "player", characterId: b.id },
        disclosure: "exact",
      });
    }
    if (order.length > 0) append({ type: "combatStarted", order });
  }

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Encounters</span>
        <button onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Build"}</button>
      </div>

      {saved.length > 0 && (
        <div className="saved">
          {saved.map((e) => (
            <div className="sv-row" key={e.id}>
              <span className="nm">{e.name || "Untitled"}</span>
              <span className="faint num">
                {e.entries.reduce((n, x) => n + x.count, 0)} creatures
              </span>
              <button onClick={() => void dropIntoInitiative(e)}>Drop in</button>
              <button onClick={() => append({ type: "encounterDeleted", encounterId: e.id })}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="card-body">
          {!all && <p className="faint" style={{ margin: 0 }}>Loading…</p>}

          {all && (
            <>
              <input
                value={text}
                aria-label="Add a monster"
                placeholder="search to add — goblin, ogre, wolf…"
                onChange={(e) => setText(e.target.value)}
              />
              {results.length > 0 && (
                <div className="picks">
                  {results.map((m) => (
                    <button
                      key={m.id}
                      className="pick"
                      onClick={() => {
                        setEncounter(
                          addEntry(encounter, {
                            statblockId: m.id, name: m.name, count: 1, xpEach: m.xp,
                            hpMode: "average", disclosure: "vague",
                          }),
                        );
                        setText("");
                      }}
                    >
                      <span className="nm">{m.name}</span>
                      <span className="faint">CR {formatCr(m.cr)} · {m.xp} XP</span>
                    </button>
                  ))}
                </div>
              )}

              {encounter.entries.length > 0 && (
                <>
                  <div className="ents">
                    {encounter.entries.map((x) => (
                      <div className="ent" key={x.statblockId}>
                        <span className="nm">
                          {x.name}
                          <span className="faint"> · {x.xpEach} XP each</span>
                        </span>
                        <span className="step">
                          <button
                            aria-label={`One fewer ${x.name}`}
                            onClick={() => setEncounter(setCount(encounter, x.statblockId, x.count - 1))}
                          >−</button>
                          <span className="ct num">{x.count}</span>
                          <button
                            aria-label={`One more ${x.name}`}
                            onClick={() => setEncounter(setCount(encounter, x.statblockId, x.count + 1))}
                          >+</button>
                        </span>
                        <button
                          className="chip"
                          aria-label={`${x.name} hit points`}
                          onClick={() =>
                            setEncounter(patchEntry(encounter, x.statblockId, {
                              hpMode: (x.hpMode === "average" ? "rolled" : "average") as HpMode,
                            }))
                          }
                        >
                          {x.hpMode}
                        </button>
                        <button
                          className="chip"
                          aria-label={`${x.name} disclosure`}
                          onClick={() =>
                            setEncounter(patchEntry(encounter, x.statblockId, {
                              disclosure: nextDisclosure(x.disclosure),
                            }))
                          }
                        >
                          {x.disclosure}
                        </button>
                      </div>
                    ))}
                  </div>

                  <Working state={state} encounter={encounter} />

                  <div className="row" style={{ marginTop: 14 }}>
                    <input
                      value={encounter.name}
                      aria-label="Encounter name"
                      placeholder="Goblin ambush"
                      style={{ flex: "1 1 140px", width: "auto" }}
                      onChange={(e) => setEncounter({ ...encounter, name: e.target.value })}
                    />
                    <button
                      onClick={() => {
                        append({ type: "encounterSaved", encounter });
                        setEncounter({
                          ...EMPTY_ENCOUNTER,
                          id: `enc-${Date.now().toString(36)}`,
                          name: "",
                        });
                      }}
                    >
                      Save for later
                    </button>
                    <button onClick={() => void dropIntoInitiative(encounter)}>
                      Drop into initiative
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
