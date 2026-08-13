/**
 * Building a character at session zero.
 *
 * The one screen a complete stranger opens. Every other surface assumes you
 * know what a saving throw is; this cannot. The usual fix — tooltips, an
 * explainer panel, a wizard that lectures — would wreck the instrument and
 * bore the veterans, so it teaches by CONSEQUENCE instead: the derived
 * numbers sit beside the scores and move as you assign them. Nobody reads
 * what Dexterity does; they watch armour class and Stealth change.
 *
 * Class comes first, not race. Every builder leads with race because the
 * printed sheet does, and mechanically that is backwards: class decides
 * almost everything you will actually do, so asking for it first lets every
 * later step filter and advise. Race first teaches the app nothing.
 *
 * Advice is never enforcement. Recommend is a button, not a default — auto
 * placing scores would quietly homogenise every character at the table.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ABILITIES, abilityModifier, formatModifier, SKILLS, SKILL_IDS,
  type Ability, type SkillId,
} from "../domain/abilities.js";
import type { Character } from "../domain/build.js";
import {
  assemble, finalScores, missing, startingHp,
  type BackgroundChoice, type ClassChoice, type RaceChoice, type ScoreMethod,
} from "../domain/creation.js";
import {
  canAfford, POINT_BUY_BUDGET, POINT_BUY_MIN, pointsSpent, STANDARD_ARRAY,
} from "../domain/non-srd.js";
import type { ClassId, DieSize } from "../domain/resources.js";
import { loadClasses, loadRaces, type ClassEntry, type RaceEntry } from "../store/srd.js";

const FLAT: Record<Ability, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
const skillIdOf = (label: string): SkillId | undefined =>
  SKILL_IDS.find((s) => s.toLowerCase() === label.toLowerCase().replace(/\s+/g, ""));
const spaced = (s: string) => s.replace(/([A-Z])/g, " $1").toLowerCase();

/** Priority order for Recommend — the app's opinion, offered not applied. */
const PRIORITY: Partial<Record<ClassId, Ability[]>> = {
  barbarian: ["str", "con", "dex", "wis", "cha", "int"],
  bard: ["cha", "dex", "con", "wis", "int", "str"],
  cleric: ["wis", "con", "str", "dex", "cha", "int"],
  druid: ["wis", "con", "dex", "int", "cha", "str"],
  fighter: ["str", "con", "dex", "wis", "cha", "int"],
  monk: ["dex", "wis", "con", "str", "int", "cha"],
  paladin: ["str", "cha", "con", "dex", "wis", "int"],
  ranger: ["dex", "wis", "con", "str", "int", "cha"],
  rogue: ["dex", "con", "wis", "int", "cha", "str"],
  sorcerer: ["cha", "con", "dex", "wis", "int", "str"],
  warlock: ["cha", "con", "dex", "wis", "int", "str"],
  wizard: ["int", "con", "dex", "wis", "cha", "str"],
};

export function CreateCharacter({
  onCreate, onCancel,
}: {
  onCreate: (c: Character) => void;
  onCancel: () => void;
}) {
  const [races, setRaces] = useState<RaceEntry[] | null>(null);
  const [classes, setClasses] = useState<ClassEntry[] | null>(null);

  const [name, setName] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [classSkills, setClassSkills] = useState<SkillId[]>([]);
  const [raceId, setRaceId] = useState<string>("");
  const [subraceId, setSubraceId] = useState<string>("");
  const [method, setMethod] = useState<ScoreMethod>("array");
  const [assigned, setAssigned] = useState<Partial<Record<Ability, number>>>({});
  const [pool, setPool] = useState<number[]>([...STANDARD_ARRAY]);
  const [picked, setPicked] = useState<number | null>(null);
  const [buy, setBuy] = useState<Record<Ability, number>>({ ...FLAT });
  const [rolled, setRolled] = useState<number[]>([]);
  const [bgName, setBgName] = useState("");
  const [bgSkills, setBgSkills] = useState<SkillId[]>([]);

  useEffect(() => {
    loadRaces().then(setRaces, () => setRaces([]));
    loadClasses().then(setClasses, () => setClasses([]));
  }, []);

  const klass = classes?.find((c) => c.id === classId);
  const race = races?.find((r) => r.id === raceId);
  const subrace = race?.subraces.find((s) => s.id === subraceId);

  const raceChoice: RaceChoice | undefined = race && {
    id: race.id,
    name: race.name,
    speed: race.speed,
    abilityBonuses: race.abilityBonuses as Partial<Record<Ability, number>>,
    ...(subrace
      ? {
          subraceName: subrace.name.replace(new RegExp(`\\s*${race.name}$`), ""),
          subraceBonuses: subrace.abilityBonuses as Partial<Record<Ability, number>>,
        }
      : {}),
  };

  const baseScores = useMemo<Record<Ability, number>>(() => {
    if (method === "pointBuy") return buy;
    return Object.fromEntries(
      ABILITIES.map((a) => [a, assigned[a] ?? 8]),
    ) as Record<Ability, number>;
  }, [method, buy, assigned]);

  const scores = raceChoice ? finalScores(baseScores, raceChoice) : baseScores;
  const mods = Object.fromEntries(
    ABILITIES.map((a) => [a, abilityModifier(scores[a])]),
  ) as Record<Ability, number>;

  const allAssigned = method === "pointBuy" || ABILITIES.every((a) => assigned[a] !== undefined);
  const skillsNeeded = klass?.skillChoices?.choose ?? 0;

  const choices =
    klass && raceChoice
      ? {
          name,
          race: raceChoice,
          klass: {
            id: klass.id as ClassId,
            name: klass.name,
            hitDie: klass.hitDie as DieSize,
            saves: klass.saves as Ability[],
            spellSlots: klass.spellcasting?.slots ?? [],
          } satisfies ClassChoice,
          background: {
            name: bgName, skills: bgSkills, tools: [],
          } satisfies BackgroundChoice,
          baseScores,
          classSkills,
        }
      : undefined;

  const gaps = [
    ...missing(choices ?? {}),
    ...(allAssigned ? [] : ["every score assigned"]),
    ...(classSkills.length === skillsNeeded ? [] : [`${skillsNeeded} class skills`]),
  ];

  function recommend() {
    if (!klass) return;
    const order = PRIORITY[klass.id as ClassId] ?? [...ABILITIES];
    if (method === "pointBuy") {
      const spread = [15, 14, 13, 12, 10, 8];
      setBuy(Object.fromEntries(order.map((a, i) => [a, spread[i]!])) as Record<Ability, number>);
      return;
    }
    const values = (method === "rolled" ? [...rolled] : [...STANDARD_ARRAY])
      .sort((a, b) => b - a);
    if (values.length < 6) return;
    setAssigned(Object.fromEntries(order.map((a, i) => [a, values[i]!])));
    setPool([]);
    setPicked(null);
  }

  function resetScores(next: ScoreMethod) {
    setMethod(next);
    setAssigned({});
    setPicked(null);
    setBuy({ ...FLAT });
    setPool(next === "array" ? [...STANDARD_ARRAY] : []);
    setRolled([]);
  }

  const toggle = <T,>(list: T[], v: T, max: number): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list;

  return (
    <>
      <section className="card">
        <div className="card-hd">
          <span className="label">Build a character</span>
          <button onClick={onCancel}>Cancel</button>
        </div>

        {(!races || !classes) && (
          <div className="card-body"><p className="faint" style={{ margin: 0 }}>Loading…</p></div>
        )}

        {races && classes && (
          <div className="card-body">
            {/* Class first: it is what lets every later step advise. */}
            <span className="label cr-step">1 · Class</span>
            <select
              aria-label="Class"
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setClassSkills([]); }}
            >
              <option value="">choose a class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {klass && (
              <>
                <p className="cr-note">
                  d{klass.hitDie} hit die · saves in{" "}
                  {klass.saves.map((s) => s.toUpperCase()).join(" and ")}
                  {klass.spellcasting ? " · casts from level 1" : ""}
                </p>
                {klass.skillChoices && (
                  <>
                    <span className="label cr-sub">
                      Choose {klass.skillChoices.choose} skills
                      <span className="faint"> — {classSkills.length} of {klass.skillChoices.choose}</span>
                    </span>
                    <div className="chips">
                      {klass.skillChoices.from.map((label) => {
                        const id = skillIdOf(label);
                        if (!id) return null;
                        const on = classSkills.includes(id);
                        return (
                          <button
                            key={label}
                            className={`chip${on ? " on" : ""}`}
                            aria-pressed={on}
                            onClick={() => setClassSkills(toggle(classSkills, id, klass.skillChoices!.choose))}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            <span className="label cr-step">2 · Race</span>
            <select
              aria-label="Race"
              value={raceId}
              onChange={(e) => {
                setRaceId(e.target.value);
                const r = races.find((x) => x.id === e.target.value);
                setSubraceId(r?.subraces[0]?.id ?? "");
              }}
            >
              <option value="">choose a race…</option>
              {races.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {race && race.subraces.length > 0 && (
              <select
                aria-label="Subrace"
                value={subraceId}
                style={{ marginTop: 8 }}
                onChange={(e) => setSubraceId(e.target.value)}
              >
                {race.subraces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </section>

      {klass && race && (
        <section className="card">
          <div className="card-hd">
            <span className="label">3 · Ability scores</span>
            <span className="seg">
              {(["array", "pointBuy", "rolled"] as ScoreMethod[]).map((m) => (
                <button
                  key={m}
                  aria-pressed={method === m}
                  className={method === m ? "on" : ""}
                  onClick={() => resetScores(m)}
                >
                  {m === "array" ? "Array" : m === "pointBuy" ? "Point buy" : "Roll"}
                </button>
              ))}
            </span>
          </div>

          <div className="cr-scores">
            <div className="cr-assign">
              {method === "rolled" && rolled.length < 6 && (
                <div className="cr-roll">
                  <p className="cr-note" style={{ marginTop: 0 }}>
                    Roll <strong>4d6</strong>, drop the lowest, and tap each total.
                    {" "}{6 - rolled.length} to go.
                  </p>
                  <div className="cr-pad">
                    {Array.from({ length: 16 }, (_, i) => i + 3).map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          const next = [...rolled, v];
                          setRolled(next);
                          if (next.length === 6) setPool(next);
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {method !== "pointBuy" && pool.length > 0 && (
                <div className="cr-pool">
                  {pool.map((v, i) => (
                    <button
                      key={i}
                      className={`chipv${picked === i ? " on" : ""}`}
                      aria-label={`Value ${v}`}
                      aria-pressed={picked === i}
                      onClick={() => setPicked(picked === i ? null : i)}
                    >
                      {v}
                    </button>
                  ))}
                  <span className="faint" style={{ fontSize: ".78rem", alignSelf: "center" }}>
                    tap a value, then an ability
                  </span>
                </div>
              )}

              {ABILITIES.map((a) => {
                const base = method === "pointBuy" ? buy[a] : assigned[a];
                const bonus = (raceChoice?.abilityBonuses[a] ?? 0) + (raceChoice?.subraceBonuses?.[a] ?? 0);
                return (
                  <div className={`cr-ab${base === undefined ? " empty" : ""}`} key={a}>
                    <button
                      className="cr-name"
                      disabled={method === "pointBuy"}
                      onClick={() => {
                        if (method === "pointBuy") return;
                        if (base !== undefined) {
                          setPool([...pool, base]);
                          setAssigned({ ...assigned, [a]: undefined });
                          return;
                        }
                        if (picked === null) return;
                        setAssigned({ ...assigned, [a]: pool[picked] });
                        setPool(pool.filter((_, i) => i !== picked));
                        setPicked(null);
                      }}
                    >
                      {a}
                    </button>
                    {method === "pointBuy" ? (
                      <span className="step">
                        <button
                          aria-label={`Lower ${a}`}
                          disabled={buy[a] <= POINT_BUY_MIN}
                          onClick={() => setBuy({ ...buy, [a]: buy[a] - 1 })}
                        >−</button>
                        <span className="ct num">{buy[a]}</span>
                        <button
                          aria-label={`Raise ${a}`}
                          disabled={!canAfford(buy, a, buy[a] + 1)}
                          onClick={() => setBuy({ ...buy, [a]: buy[a] + 1 })}
                        >+</button>
                      </span>
                    ) : (
                      <span className="cr-val num">{base ?? "—"}</span>
                    )}
                    {/* Shown as a separate term: "15 + 2", never a mystery 17. */}
                    <span className="cr-bonus num">{bonus > 0 ? `+ ${bonus}` : ""}</span>
                    <span className="cr-total num">
                      {base === undefined ? "—" : scores[a]}
                      <span className="cr-mod">{base === undefined ? "" : formatModifier(mods[a])}</span>
                    </span>
                  </div>
                );
              })}

              <div className="row" style={{ marginTop: 12 }}>
                <button onClick={recommend}>Recommend</button>
                <button onClick={() => resetScores(method)}>Clear</button>
                {method === "pointBuy" && (
                  <span className="faint num" style={{ fontSize: ".8rem" }}>
                    {POINT_BUY_BUDGET - pointsSpent(buy)} of {POINT_BUY_BUDGET} left
                  </span>
                )}
              </div>
            </div>

            {/* The consequences, so nobody has to be told what Dexterity does. */}
            <div className="cr-conseq">
              <div className="cr-grid">
                <div><span className="l">Armour class</span><span className="v num">{10 + mods.dex}</span></div>
                <div><span className="l">Hit points</span><span className="v num">{startingHp(klass.hitDie as DieSize, mods.con)}</span></div>
                <div><span className="l">Initiative</span><span className="v num">{formatModifier(mods.dex)}</span></div>
                <div><span className="l">Speed</span><span className="v num">{race.speed}</span></div>
              </div>
              <span className="label cr-sub">Skills you are proficient in</span>
              {[...new Set([...classSkills, ...bgSkills])].map((s) => (
                <div className="cr-srow" key={s}>
                  <span>{spaced(s)}<span className="faint"> {SKILLS[s]}</span></span>
                  <span className="num">{formatModifier(mods[SKILLS[s]] + 2)}</span>
                </div>
              ))}
              {classSkills.length + bgSkills.length === 0 && (
                <p className="faint" style={{ fontSize: ".82rem", margin: 0 }}>None yet.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {klass && race && (
        <section className="card">
          <div className="card-hd">
            <span className="label">4 · Background</span>
            <span className="faint" style={{ fontSize: ".78rem" }}>{bgSkills.length} of 2 skills</span>
          </div>
          <div className="card-body">
            <p className="cr-note" style={{ marginTop: 0 }}>
              The SRD ships one background, so this builder offers a custom one
              instead — two skills and a name. That is all a background
              mechanically is.
            </p>
            <div className="chips">
              {SKILL_IDS.map((s) => {
                const on = bgSkills.includes(s);
                return (
                  <button
                    key={s}
                    className={`chip${on ? " on" : ""}`}
                    aria-pressed={on}
                    onClick={() => setBgSkills(toggle(bgSkills, s, 2))}
                  >
                    {spaced(s)}
                  </button>
                );
              })}
            </div>
            <input
              value={bgName}
              aria-label="Background name"
              placeholder="Greenwarden's apprentice"
              style={{ marginTop: 12 }}
              onChange={(e) => setBgName(e.target.value)}
            />
          </div>
        </section>
      )}

      {klass && race && (
        <section className="card">
          <div className="card-body">
            <input
              value={name}
              aria-label="Character name"
              placeholder="Kira Vance"
              onChange={(e) => setName(e.target.value)}
            />
            <div className="row" style={{ marginTop: 12 }}>
              <button
                disabled={gaps.length > 0 || !choices}
                onClick={() => choices && onCreate({ base: assemble(choices), deltas: [] })}
              >
                Create character
              </button>
              <span className="faint" style={{ fontSize: ".82rem" }}>
                {gaps.length > 0 ? `Still needed: ${gaps.join(", ")}.` : "Ready to play."}
              </span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
