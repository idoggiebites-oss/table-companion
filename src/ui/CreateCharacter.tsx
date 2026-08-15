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
  ABILITIES, abilityModifier, formatModifier, proficiencyBonus, SKILLS, SKILL_IDS,
  type Ability, type SkillId,
} from "../domain/abilities.js";
import type { Character } from "../domain/build.js";
import {
  asiPoints, assemble, finalScores, hpAtLevel, missing,
  type BackgroundChoice, type ClassChoice, type RaceChoice, type ScoreMethod,
} from "../domain/creation.js";
import {
  canAfford, POINT_BUY_BUDGET, POINT_BUY_MIN, pointsSpent, STANDARD_ARRAY,
} from "../domain/non-srd.js";
import type { ClassId, DieSize } from "../domain/resources.js";
import {
  loadBackgrounds, loadClasses, loadClassLevels, loadEquipment, loadRaces,
  loadSpells,
  type BackgroundEntry, type ClassEntry, type ClassLevels, type RaceEntry,
} from "../store/srd.js";
import type { CompendiumSpell } from "../import/compendium.js";
import {
  castableBy, isClassFeature, levelLabel, toKnown, type KnownSpell,
} from "../domain/spells.js";
import { indexItems, type Item, type Stack } from "../domain/items.js";
import { formatCoins } from "../domain/money.js";
import { describeWealthFor, wealthFor } from "../domain/non-srd.js";
import {
  parseChoice, parseFixed, toStack, type GearOption,
} from "../domain/starting-gear.js";

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
  onCreate: (
    c: Character,
    starting?: { items: readonly Stack[]; coins: number; spells?: readonly KnownSpell[] },
  ) => void;
  onCancel: () => void;
}) {
  const [races, setRaces] = useState<RaceEntry[] | null>(null);
  const [classes, setClasses] = useState<ClassEntry[] | null>(null);
  const [levels, setLevels] = useState<ClassLevels | null>(null);
  const [gear, setGear] = useState<Item[] | null>(null);
  const [book, setBook] = useState<CompendiumSpell[]>([]);
  const [spellFilter, setSpellFilter] = useState("");
  const [openPicker, setOpenPicker] = useState<null | "cantrip" | "spell">(null);
  const [chosenSpells, setChosenSpells] = useState<KnownSpell[]>([]);
  const [gearMode, setGearMode] = useState<"kit" | "gold">("kit");
  /** Which lettered option is taken, per choice. */
  const [picks, setPicks] = useState<Record<number, string>>({});
  /** What was chosen to satisfy "a martial weapon", keyed choice:phrase. */
  const [catPicks, setCatPicks] = useState<Record<string, string>>({});
  const [level, setLevel] = useState(1);

  const [name, setName] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [classSkills, setClassSkills] = useState<SkillId[]>([]);
  const [raceId, setRaceId] = useState<string>("");
  const [raceFilter, setRaceFilter] = useState("");
  const [subraceId, setSubraceId] = useState<string>("");
  const [method, setMethod] = useState<ScoreMethod>("array");
  const [assigned, setAssigned] = useState<Partial<Record<Ability, number>>>({});
  const [pool, setPool] = useState<number[]>([...STANDARD_ARRAY]);
  const [picked, setPicked] = useState<number | null>(null);
  const [buy, setBuy] = useState<Record<Ability, number>>({ ...FLAT });
  const [rolled, setRolled] = useState<number[]>([]);
  const [bgName, setBgName] = useState("");
  const [bgSkills, setBgSkills] = useState<SkillId[]>([]);
  const [bgId, setBgId] = useState("");
  const [bgFilter, setBgFilter] = useState("");
  const [backgrounds, setBackgrounds] = useState<BackgroundEntry[]>([]);

  useEffect(() => {
    loadRaces().then(setRaces, () => setRaces([]));
    loadClasses().then(setClasses, () => setClasses([]));
    loadClassLevels().then(setLevels, () => setLevels({}));
    loadEquipment().then(setGear, () => setGear([]));
    loadBackgrounds().then(setBackgrounds, () => setBackgrounds([]));
    loadSpells().then(setBook, () => setBook([]));
  }, []);

  /** Keeps the chosen race listed even when it falls out of the filter. */
  const shownRaces = useMemo(() => {
    const list = races ?? [];
    const q = raceFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.name.toLowerCase().includes(q) || r.id === raceId);
  }, [races, raceFilter, raceId]);

  const shownBackgrounds = useMemo(() => {
    const q = bgFilter.trim().toLowerCase();
    return q
      ? backgrounds.filter((b) => b.name.toLowerCase().includes(q) || b.id === bgId)
      : backgrounds;
  }, [backgrounds, bgFilter, bgId]);

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

  const table = klass && levels ? levels[klass.id] : undefined;
  const atLevel = table?.[level - 1];
  const asiLevels = (table ?? []).filter((l) => l.asi).map((l) => l.level);
  const asi = asiPoints(asiLevels, level);
  // Proficiency has to come from the chosen level, not the level-1 default —
  // the preview's whole job is to be the number you will actually see.
  const prof = atLevel?.profBonus ?? proficiencyBonus(level);

  const hasKit =
    (klass?.equipment?.length ?? 0) > 0 || (klass?.equipmentChoices?.length ?? 0) > 0;

  /*
   * Follow the class, and only once a class exists. Keyed on the class rather
   * than on hasKit: before one is chosen hasKit is false, and an effect
   * watching it flipped every character to "buy your own" before they had
   * picked anything — so nobody got their starting kit at all.
   */
  useEffect(() => {
    if (!klass) return;
    setGearMode(hasKit ? "kit" : "gold");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klass?.id]);

  const catalogue = useMemo(() => indexItems(gear ?? []), [gear]);
  const fixedGear = useMemo(
    () => (klass ? parseFixed(klass.equipment ?? [], catalogue) : []),
    [klass, catalogue],
  );
  const choices2 = useMemo<GearOption[][]>(
    () => (klass ? (klass.equipmentChoices ?? []).map((d) => parseChoice(d, catalogue)) : []),
    [klass, catalogue],
  );

  /** What the character walks away carrying, and with what in their purse. */
  const starting = useMemo(() => {
    if (!klass) return { items: [] as Stack[], coins: 0 };
    if (gearMode === "gold") return { items: [], coins: wealthFor(klass.id, klass.wealth) };
    const items: Stack[] = [];
    for (const p of fixedGear) {
      const st = toStack(p);
      if (st) items.push(st);
    }
    choices2.forEach((opts, i) => {
      const taken = opts.find((o) => o.letter === (picks[i] ?? opts[0]?.letter));
      if (!taken) return;
      taken.phrases.forEach((p, j) => {
        if (p.kind === "category") {
          const chosen = catPicks[`${i}:${j}`];
          const it = chosen ? catalogue[chosen] : undefined;
          if (it) items.push({ itemId: it.id, name: it.name, qty: p.qty });
          return;
        }
        const st = toStack(p);
        if (st) items.push(st);
      });
    });
    return { items, coins: 0 };
  }, [klass, gearMode, fixedGear, choices2, picks, catPicks, catalogue]);

  /**
   * How many of each the class gets at this level, straight from the table.
   * A wizard at 1 knows three cantrips and six spells; at 5 it is four and
   * more — asking the builder to know that is the point of having the table.
   */
  const cantripsKnown = atLevel?.cantrips ?? 0;
  const spellsKnown = atLevel?.known ?? 0;
  const hasSlots = (atLevel?.slots ?? []).some((n) => n > 0);
  const castsAtAll = cantripsKnown > 0 || spellsKnown > 0 || hasSlots;

  const pickedCantrips = chosenSpells.filter((s) => s.level === 0).length;
  const pickedSpells = chosenSpells.filter((s) => s.level > 0).length;

  const spellChoices = useMemo(() => {
    if (!klass || !castsAtAll) return [];
    const q = spellFilter.trim().toLowerCase();
    const have = new Set(chosenSpells.map((s) => s.id));
    // The highest slot level that exists, as an index. findLastIndex is not
    // in this lib target, and a reverse scan says the same thing.
    const slots = atLevel?.slots ?? [];
    let topSlot = -1;
    for (let i = slots.length - 1; i >= 0; i--) {
      if ((slots[i] ?? 0) > 0) {
        topSlot = i;
        break;
      }
    }
    return book
      .filter((s) => {
        if (have.has(s.id) || isClassFeature(s)) return false;
        if (!castableBy(s, klass.id)) return false;
        // Nothing you could not cast: a spell above your best slot is not a
        // choice, it is a tease.
        if (s.level > topSlot + 1) return false;
        if (q && !s.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .slice(0, 80);
  }, [book, klass, castsAtAll, spellFilter, chosenSpells, atLevel]);

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
          level,
          ...(atLevel?.slots.length ? { spellSlots: atLevel.slots } : {}),
        }
      : undefined;

  /** Categories the book asks about and nobody has answered yet. */
  const unpicked = choices2.flatMap((opts, i) => {
    const taken = opts.find((o) => o.letter === (picks[i] ?? opts[0]?.letter));
    return (taken?.phrases ?? []).flatMap((p, j) =>
      p.kind === "category" && !catPicks[`${i}:${j}`] ? [p.label] : [],
    );
  });

  const gaps = [
    ...missing(choices ?? {}),
    ...(gearMode === "kit" ? unpicked : []),
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
                <div className="row" style={{ marginTop: 10 }}>
                  <span className="label">Starting at level</span>
                  <input
                    type="number" min={1} max={20} value={level}
                    aria-label="Starting level"
                    style={{ width: 78 }}
                    onChange={(e) => setLevel(Math.max(1, Math.min(20, +e.target.value || 1)))}
                  />
                  {level > 1 && (
                    <span className="faint" style={{ fontSize: ".8rem" }}>
                      joining a campaign in progress
                    </span>
                  )}
                </div>
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
            {/* A shipped SRD list is nine long; an imported one is six hundred.
                The filter appears only when the list is long enough to need
                it, so the common case stays a single control. */}
            {races.length > 20 && (
              <input
                value={raceFilter}
                aria-label="Filter races"
                placeholder={`filter ${races.length} races…`}
                style={{ marginBottom: 8 }}
                onChange={(e) => setRaceFilter(e.target.value)}
              />
            )}
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
              {shownRaces.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {races.length > 20 && shownRaces.length === 0 && (
              <p className="cr-note">Nothing matches that.</p>
            )}
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
                <div><span className="l">Hit points</span><span className="v num">{hpAtLevel(klass.hitDie as DieSize, mods.con, level)}</span></div>
                <div><span className="l">Initiative</span><span className="v num">{formatModifier(mods.dex)}</span></div>
                <div><span className="l">Speed</span><span className="v num">{race.speed}</span></div>
              </div>
              {level > 1 && (
                <p className="cr-note" style={{ marginTop: 0 }}>
                  Level {level}: average hit points per level, proficiency{" "}
                  {formatModifier(prof)}
                  {atLevel?.slots.length ? `, slots ${atLevel.slots.join("/")}` : ""}
                  {asi > 0 ? ` · ${asi} ability points to spend in your builder` : ""}.
                </p>
              )}
              <span className="label cr-sub">Skills you are proficient in</span>
              {[...new Set([...classSkills, ...bgSkills])].map((s) => (
                <div className="cr-srow" key={s}>
                  <span>{spaced(s)}<span className="faint"> {SKILLS[s]}</span></span>
                  <span className="num">{formatModifier(mods[SKILLS[s]] + prof)}</span>
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
            {/* Imported backgrounds fill in the name and the skills; the
                custom route stays underneath, because a table invents one
                more often than it looks one up. */}
            {backgrounds.length > 0 && (
              <>
                <input
                  value={bgFilter}
                  aria-label="Filter backgrounds"
                  placeholder={`filter ${backgrounds.length} backgrounds…`}
                  onChange={(e) => setBgFilter(e.target.value)}
                />
                <select
                  aria-label="Background"
                  value={bgId}
                  style={{ marginTop: 8 }}
                  onChange={(e) => {
                    const b = backgrounds.find((x) => x.id === e.target.value);
                    setBgId(e.target.value);
                    if (!b) return;
                    setBgName(b.name);
                    // Only the skills this app knows how to score. A
                    // background naming a tool proficiency keeps its name and
                    // loses nothing the sheet was going to show.
                    setBgSkills(
                      b.skills
                        .map((n) => skillIdOf(n))
                        .filter((x): x is SkillId => x !== undefined)
                        .slice(0, 2),
                    );
                  }}
                >
                  <option value="">choose one, or make your own below…</option>
                  {shownBackgrounds.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </>
            )}
            <p className="cr-note" style={{ marginTop: backgrounds.length > 0 ? 12 : 0 }}>
              {backgrounds.length > 0
                ? "Or make one up — two skills and a name is all a background mechanically is."
                : "The SRD ships one background, so this builder offers a custom one instead — two skills and a name. That is all a background mechanically is."}
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

      {/* Its own step rather than buried in the ability-score block, where it
          was invisible until two unrelated questions had been answered. Last
          in the flow because it is the least consequential thing here. */}
      {klass && race && (
        <section className="card">
          <div className="card-hd">
            <span className="label cr-step">5 · Equipment</span>
            <span className="faint" style={{ fontSize: ".78rem" }}>
              {gearMode === "gold" ? "buying your own" : `${starting.items.length} items`}
            </span>
          </div>
          <div className="card-body">
          {/* Starting equipment belongs in creation, not after it: a
              character who arrives with nothing is one the first fight
              cannot use. The book writes the choices as prose, so they
              are taken apart rather than shown as a paragraph to obey. */}
          {gear !== null && (hasKit || wealthFor(klass.id, klass.wealth) > 0) ? (
            <div className="gear-step">
              <span className="label cr-sub">Starting equipment</span>
              <div className="seg">
                <button
                  aria-pressed={gearMode === "kit"}
                  className={gearMode === "kit" ? "on" : ""}
                  onClick={() => setGearMode("kit")}
                >
                  Take the kit
                </button>
                <button
                  aria-pressed={gearMode === "gold"}
                  className={gearMode === "gold" ? "on" : ""}
                  onClick={() => setGearMode("gold")}
                >
                  Buy your own
                </button>
              </div>

              {gearMode === "gold" ? (
                <p className="cr-note">
                  {describeWealthFor(klass.id, klass.wealth)} to spend — you start
                  with <b>{formatCoins(wealthFor(klass.id, klass.wealth))}</b> and
                  nothing else. Buy it under Gear once you are in.
                  {!hasKit && " This class has no kit written down, so this is the only route."}
                </p>
              ) : (
                <>
                  {fixedGear.length > 0 && (
                    <p className="cr-note">
                      Comes with{" "}
                      {fixedGear
                        .map((p) => {
                          const st = toStack(p);
                          return st ? (st.qty > 1 ? `${st.qty} × ${st.name}` : st.name) : "";
                        })
                        .filter(Boolean)
                        .join(", ")}.
                    </p>
                  )}
                  {choices2.map((opts, i) => {
                    const taken = picks[i] ?? opts[0]?.letter;
                    const chosen = opts.find((o) => o.letter === taken);
                    return (
                      <div className="gear-choice" key={i}>
                        <div className="chips">
                          {opts.map((o) => (
                            <button
                              key={o.letter}
                              className={`chip${o.letter === taken ? " on" : ""}`}
                              aria-pressed={o.letter === taken}
                              onClick={() => setPicks({ ...picks, [i]: o.letter })}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                        {chosen?.phrases.map((p, j) =>
                          p.kind === "category" ? (
                            <select
                              key={j}
                              aria-label={`Choose ${p.label}`}
                              value={catPicks[`${i}:${j}`] ?? ""}
                              onChange={(e) =>
                                setCatPicks({ ...catPicks, [`${i}:${j}`]: e.target.value })
                              }
                            >
                              <option value="">which {p.label}…</option>
                              {(gear ?? [])
                                .filter(
                                  (it) =>
                                    it.category === "weapon" &&
                                    it.weaponCategory === p.weaponCategory &&
                                    (p.weaponRange === undefined || it.weaponRange === p.weaponRange),
                                )
                                .map((it) => (
                                  <option key={it.id} value={it.id}>{it.name}</option>
                                ))}
                            </select>
                          ) : null,
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : null}
          </div>
        </section>
      )}

      {/* Only for casters, and only as many as the class table allows. The
          counts are the point: a wizard is told three cantrips and six
          spells, not left to remember it. */}
      {klass && race && castsAtAll && (
        <section className="card">
          <div className="card-hd">
            <span className="label cr-step">6 · Spells</span>
            <span className="faint" style={{ fontSize: ".78rem" }}>
              {cantripsKnown > 0 && `${pickedCantrips} of ${cantripsKnown} cantrips`}
              {cantripsKnown > 0 && (spellsKnown > 0 || hasSlots) && " · "}
              {/* A prepared caster has no "spells known" and the table says so
                  by leaving it at zero. Counting up rather than down is the
                  honest way to show a limit that does not exist. */}
              {spellsKnown > 0
                ? `${pickedSpells} of ${spellsKnown} spells`
                : hasSlots && `${pickedSpells} spells`}
            </span>
          </div>
          <div className="card-body">
            {book.length === 0 ? (
              <p className="cr-note" style={{ marginTop: 0 }}>
                No spell list on this device. The SRD data shipped here has
                none — a compendium provides it, and you can pick spells later
                under Spells.
              </p>
            ) : (
              <>
                {chosenSpells.length > 0 && (
                  <div className="chips" style={{ marginBottom: 10 }}>
                    {chosenSpells.map((sp) => (
                      <button
                        key={sp.id}
                        className="chip on"
                        aria-label={`Remove ${sp.name}`}
                        onClick={() => setChosenSpells(chosenSpells.filter((x) => x.id !== sp.id))}
                      >
                        {sp.name}
                      </button>
                    ))}
                  </div>
                )}

                {/*
                  * Two pickers rather than one list. A sorcerer can cast
                  * hundreds of things, and a single flat list ran off the
                  * bottom of the card — you cannot choose three cantrips from
                  * a page you are still scrolling. Each opens on its own,
                  * carries its own search, and scrolls inside a fixed height
                  * so the step stays the same size whatever the class.
                  */}
                {([["cantrip", "Cantrips"], ["spell", "Spells"]] as const).map(([kind, label]) => {
                  const isCantrip = kind === "cantrip";
                  if (isCantrip && cantripsKnown === 0) return null;
                  if (!isCantrip && !hasSlots && spellsKnown === 0) return null;

                  const open = openPicker === kind;
                  const taken = isCantrip ? pickedCantrips : pickedSpells;
                  const limit = isCantrip ? cantripsKnown : spellsKnown;
                  const full = limit > 0 && taken >= limit;
                  const rows = spellChoices.filter((sp) =>
                    isCantrip ? sp.level === 0 : sp.level > 0,
                  );

                  return (
                    <div className="chooser" key={kind}>
                      <button
                        className={`chooser-hd${open ? " open" : ""}`}
                        aria-expanded={open}
                        aria-label={`${label}, ${taken}${limit > 0 ? ` of ${limit}` : ""} chosen`}
                        onClick={() => {
                          setOpenPicker(open ? null : kind);
                          setSpellFilter("");
                        }}
                      >
                        <span className="nm">{label}</span>
                        <span className="faint num">
                          {limit > 0 ? `${taken} of ${limit}` : `${taken} chosen`}
                        </span>
                        <span className="chooser-mark">{open ? "−" : "+"}</span>
                      </button>

                      {open && (
                        <div className="chooser-body">
                          <input
                            value={spellFilter}
                            aria-label={`Filter ${label.toLowerCase()}`}
                            placeholder={`filter ${rows.length} ${label.toLowerCase()}…`}
                            onChange={(e) => setSpellFilter(e.target.value)}
                          />
                          <div className="chooser-list">
                            {rows.map((sp) => (
                              <button
                                className="inv-add"
                                key={sp.id}
                                disabled={full}
                                onClick={() => setChosenSpells([...chosenSpells, toKnown(sp)])}
                              >
                                <span className="nm">{sp.name}</span>
                                <span className="num">
                                  {sp.level === 0 ? "cantrip" : levelLabel(sp.level).toLowerCase()}
                                </span>
                                <span className="faint">{sp.school}</span>
                              </button>
                            ))}
                            {rows.length === 0 && (
                              <p className="faint" style={{ margin: 0, fontSize: ".84rem" }}>
                                Nothing matches.
                              </p>
                            )}
                          </div>
                          {full && (
                            <p className="faint" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>
                              That is all {limit}. Remove one above to swap.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <p className="faint" style={{ fontSize: ".8rem", margin: "12px 0 0" }}>
                  {spellsKnown === 0 && hasSlots
                    ? `A ${klass.name.toLowerCase()} prepares from a book rather than knowing a fixed few, so there is no number to hit here. Take what you like, or leave it — the Spells tab does the same job afterwards.`
                    : "Take what you like now or leave it — the Spells tab does the same job afterwards."}
                </p>
              </>
            )}
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
                onClick={() => choices && onCreate({ base: assemble(choices), deltas: [] }, { ...starting, spells: chosenSpells })}
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
