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
 * See non-srd.ts for why that matters.
 */

import { useEffect, useMemo, useState } from "react";
import {
  crBand, creatureKind, CR_BANDS, CR_LABEL, CREATURE_KINDS,
  type CrBand, type CreatureKind,
} from "../domain/creature.js";
import type { Combatant, Disclosure } from "../domain/combat.js";
import { DISCLOSURE } from "../domain/combat.js";
import { budgetForParty, encounterMultiplier } from "../domain/non-srd.js";
import {
  addEntry, EMPTY_ENCOUNTER, patchEntry, setCount, totals,
  type Encounter, type HpMode,
} from "../domain/encounter.js";
import type { EventBody } from "../domain/events.js";
import type { CampaignState } from "../domain/project.js";
import {
  formatCr, instanceLabel, mergeStatblocks, rollHp, searchStatblocks,
  type Statblock,
} from "../domain/statblock.js";
import { loadMonsters } from "../store/srd.js";

const nextDisclosure = (d: Disclosure): Disclosure =>
  DISCLOSURE[(DISCLOSURE.indexOf(d) + 1) % DISCLOSURE.length]!;

const d20 = () => 1 + Math.floor(Math.random() * 20);
const mod = (score: number) => Math.floor((score - 10) / 2);

/** Where the working is shown rather than only the verdict. */
function Working({
  state, encounter, append,
}: {
  state: CampaignState;
  encounter: Encounter;
  append: (body: EventBody) => void;
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

      <div className="row" style={{ marginTop: 12 }}>
        {state.progression === "xp" && (
          <button
            disabled={t.rawXp <= 0 || levels.length === 0}
            onClick={() =>
              append({
                type: "xpAwarded",
                who: Object.keys(state.builds),
                amount: t.rawXp,
              })
            }
          >
            Award {t.rawXp.toLocaleString()} XP
          </button>
        )}
        <span className="faint" style={{ fontSize: ".8rem" }}>
          The raw total, never the adjusted one.
          {levels.length > 0 && ` ${t.perCharacter.toLocaleString()} each.`}
        </span>
      </div>
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
  const [kind, setKind] = useState<CreatureKind | null>(null);
  const [band, setBand] = useState<CrBand | null>(null);
  const [encounter, setEncounter] = useState<Encounter>({
    ...EMPTY_ENCOUNTER,
    id: `enc-${Date.now().toString(36)}`,
    name: "",
  });

  useEffect(() => {
    if (open && !all) loadMonsters().then(setAll, () => setAll([]));
  }, [open, all]);

  const catalogue = useMemo(
    () => (all ? mergeStatblocks(all, state.homebrew) : null),
    [all, state.homebrew],
  );
  const counts = useMemo(() => {
    const kinds = new Map<CreatureKind, number>();
    const bands = new Map<CrBand, number>();
    for (const m of catalogue ?? []) {
      const k = creatureKind(m.type);
      if (k) kinds.set(k, (kinds.get(k) ?? 0) + 1);
      bands.set(crBand(m.cr), (bands.get(crBand(m.cr)) ?? 0) + 1);
    }
    return { kinds, bands };
  }, [catalogue]);

  /*
   * Search OR browse. It was search-only, which assumes you already know what
   * you want — and building an encounter is usually the other way round:
   * "something undead, and not too hard". The piles let you ask that.
   */
  const results = useMemo(
    () =>
      catalogue && (text.trim() || kind || band)
        ? searchStatblocks(catalogue, { ...(text.trim() ? { text } : {}) })
            .filter((m) => kind === null || creatureKind(m.type) === kind)
            .filter((m) => band === null || crBand(m.cr) === band)
            .slice(0, 12)
        : [],
    [catalogue, text, kind, band],
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
    const srd = all ?? (await loadMonsters().catch(() => []));
    if (!all && srd.length > 0) setAll(srd);
    // Homebrew must resolve here too, or a creature the DM wrote arrives with
    // one hit point exactly like an unknown statblock would.
    const lookup = new Map(mergeStatblocks(srd, state.homebrew).map((m) => [m.id, m]));

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
          {!catalogue && <p className="faint" style={{ margin: 0 }}>Loading…</p>}

          {catalogue && (
            <>
              <input
                value={text}
                aria-label="Add a monster"
                placeholder="search to add — goblin, ogre, wolf…"
                onChange={(e) => setText(e.target.value)}
              />
              {/* Kind, then difficulty — the order a DM asks them in. */}
              <div className="roles" style={{ marginTop: 10 }}>
                {CREATURE_KINDS.filter((k) => (counts.kinds.get(k) ?? 0) > 0).map((k) => (
                  <button
                    key={k}
                    className={`role${kind === k ? " on" : ""}`}
                    aria-pressed={kind === k}
                    aria-label={`Only ${k}`}
                    onClick={() => setKind(kind === k ? null : k)}
                  >
                    {k} <span className="n">{counts.kinds.get(k)}</span>
                  </button>
                ))}
              </div>
              <div className="roles" style={{ marginTop: 6 }}>
                {CR_BANDS.filter((b) => (counts.bands.get(b) ?? 0) > 0).map((b) => (
                  <button
                    key={b}
                    className={`role cr-${b}${band === b ? " on" : ""}`}
                    aria-pressed={band === b}
                    aria-label={`Only ${CR_LABEL[b]}`}
                    onClick={() => setBand(band === b ? null : b)}
                  >
                    {CR_LABEL[b]} <span className="n">{counts.bands.get(b)}</span>
                  </button>
                ))}
              </div>

              {results.length > 0 && (
                <div className="picks ref-scroll">
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
                      <span className="faint">
                        {creatureKind(m.type) ?? m.type} · CR {formatCr(m.cr)} · {m.xp} XP
                      </span>
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

                  <Working state={state} encounter={encounter} append={append} />

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
