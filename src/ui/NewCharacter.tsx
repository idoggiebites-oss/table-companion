/**
 * Manual entry — the floor you can always stand on.
 *
 * Deliberately the first adapter rather than the last: every import path has
 * to produce exactly this shape, so building it first keeps the canonical
 * model honest. Fight Club XML and PDF land next and write the same object.
 */

import { Num } from "./Num.js";
import { useState } from "react";
import { ABILITIES, SKILLS, SKILL_IDS, type Ability, type SkillId } from "../domain/abilities.js";
import type { Attack } from "../domain/attack.js";
import type { BuildBase, Character } from "../domain/build.js";
import { HIT_DIE } from "../domain/classes.js";
import { CLASS_IDS, type ClassId } from "../domain/resources.js";
import { AttacksEditor } from "./AttacksEditor.js";
import { ImportPanel } from "./ImportPanel.js";
import { bramSample, kiraSample } from "./sample.js";

const titleCase = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const spaced = (s: string) => s.replace(/([A-Z])/g, " $1").toLowerCase();

export function NewCharacter({
  onCreate,
}: {
  /** `sit` false means "hold this one, but stay where you are". */
  onCreate: (c: Character, starting?: undefined, sit?: boolean) => void;
}) {
  /**
   * Folded away by default. This form is thirty-odd fields, and it was the
   * first thing on an empty table — a wall of inputs in front of a DM who
   * mostly wants to prep a session. Loading a sample and importing both still
   * work without opening it.
   */
  const [byHand, setByHand] = useState(false);
  const [imported, setImported] = useState<BuildBase | null>(null);
  /**
   * The form edits one class. A multiclass import would lose the rest on
   * submit, so the imported list is kept until the class fields are touched.
   */
  const [importedClasses, setImportedClasses] = useState<BuildBase["classes"] | null>(null);
  const [name, setName] = useState("");
  const [classId, setClassId] = useState<ClassId>("fighter");
  const [level, setLevel] = useState(1);
  const [race, setRace] = useState("");
  const [maxHp, setMaxHp] = useState(10);
  const [armourClass, setArmourClass] = useState(10);
  const [speed, setSpeed] = useState(30);
  const [scores, setScores] = useState<Record<Ability, number>>({
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  });
  const [saves, setSaves] = useState<Ability[]>([]);
  const [skills, setSkills] = useState<SkillId[]>([]);
  const [slots, setSlots] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [attacks, setAttacks] = useState<Attack[]>([]);

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  /** Prefills every field from an import so the gaps are all that is left. */
  function prefill(b: BuildBase) {
    setName(b.name);
    const first = b.classes[0];
    if (first) {
      setClassId(first.classId);
      setLevel(first.level);
    }
    setImportedClasses(b.classes.length > 1 ? b.classes : null);
    setRace(b.race);
    setMaxHp(b.maxHp);
    setArmourClass(b.armourClass);
    setSpeed(b.speed);
    setScores({ ...b.abilities });
    setSaves([...b.saveProficiencies]);
    setSkills([...b.skillProficiencies]);
    const next = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    b.spellSlots.forEach((n, i) => { next[i] = n; });
    setSlots(next);
    setAttacks([...b.attacks]);
    setImported(b);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedSlots = [...slots];
    while (trimmedSlots.length && trimmedSlots.at(-1) === 0) trimmedSlots.pop();

    const base: BuildBase = {
      id: `c${Date.now().toString(36)}`,
      name: name.trim() || "Unnamed",
      edition: "2014",
      source: imported ? imported.source : "manual",
      classes: importedClasses ?? [{ classId, level }],
      race: race.trim(),
      abilities: scores,
      maxHp,
      hitDie: HIT_DIE[classId],
      armourClass,
      speed,
      saveProficiencies: saves,
      skillProficiencies: skills,
      spellSlots: trimmedSlots,
      attacks: attacks.filter((a) => a.name.trim()).map((a) => ({ ...a, name: a.name.trim() })),
    };
    onCreate({ base, deltas: [] });
  }

  return (
    <>
      <ImportPanel
        onPrefill={prefill}
        onUse={(b) => onCreate({ base: b, deltas: [] })}
      />
      <form onSubmit={submit}>
      <section className="card">
        <div className="card-hd">
          <span className="label">New character</span>
          <span className="row">
            <button type="button" onClick={() => setByHand((v) => !v)}>
              {byHand ? "Hide" : "Enter by hand"}
            </button>
            <button type="button" onClick={() => onCreate(kiraSample())}>
              Load sample
            </button>
            {/*
              * Somebody to stand next to.
              *
              * Help is a thing you do FOR somebody, and a table of one has
              * nobody to do it for — so a whole class of behaviour was not
              * only untested but unreachable. Kept separate from the sample
              * rather than folded into it: "load the sample" means one known
              * character on twenty screens, and quietly making it two would
              * change what every one of them is showing.
              *
              * Held but not sat in, because you are already somebody.
              */}
            <button type="button" onClick={() => onCreate(bramSample(), undefined, false)}>
              Add an ally
            </button>
          </span>
        </div>
        <div className="card-body" hidden={!byHand && !imported}>
          {imported && (
            <p className="faint" style={{ fontSize: ".85rem", marginTop: 0 }}>
              Filled in from {imported.source === "fightclub" ? "a Fight Club export" : "an import"} —
              armour class, speed and spell slots are the ones it could not carry.
              {importedClasses && (
                <> Multiclass kept as <b>{importedClasses.map((c) => `${c.classId} ${c.level}`).join(" · ")}</b>;
                editing class or level below replaces it with a single class.</>
              )}
            </p>
          )}

          <div className="field">
            <label className="label" htmlFor="nm">Name</label>
            <input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kira Vance" />
          </div>

          <div className="six">
            <div className="field">
              <label className="label" htmlFor="cl">Class</label>
              <select id="cl" value={classId} onChange={(e) => { setClassId(e.target.value as ClassId); setImportedClasses(null); }}>
                {CLASS_IDS.map((c) => (
                  <option key={c} value={c}>{titleCase(c)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="lv">Level</label>
              <Num id="lv"  min={1} max={20} value={level}
                onChange={(n) => { setLevel(n); setImportedClasses(null); }} />
            </div>
            <div className="field">
              <label className="label" htmlFor="rc">Race</label>
              <input id="rc" value={race} onChange={(e) => setRace(e.target.value)} placeholder="Wood elf" />
            </div>
          </div>

          <div className="six">
            <div className="field">
              <label className="label" htmlFor="hp">Max HP</label>
              <Num id="hp"  min={1} value={maxHp}
                onChange={setMaxHp} />
            </div>
            <div className="field">
              <label className="label" htmlFor="ac">Armour class</label>
              <Num id="ac"  min={1} value={armourClass}
                onChange={setArmourClass} />
            </div>
            <div className="field">
              <label className="label" htmlFor="sp">Speed</label>
              <Num id="sp"  min={0} step={5} value={speed}
                onChange={setSpeed} />
            </div>
          </div>

          <div className="field">
            <span className="label">Ability scores</span>
            <div className="six" style={{ marginTop: 6 }}>
              {ABILITIES.map((a) => (
                <div key={a}>
                  <label className="label" htmlFor={`ab-${a}`}>{a}</label>
                  <Num id={`ab-${a}`} min={1} max={30} value={scores[a]}
                    onChange={(n) => setScores({ ...scores, [a]: n })} />
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">Saving throw proficiencies</span>
            <div className="chips" style={{ marginTop: 8 }}>
              {ABILITIES.map((a) => (
                <button key={a} type="button"
                  className={`chip${saves.includes(a) ? " on" : ""}`}
                  aria-pressed={saves.includes(a)}
                  onClick={() => setSaves(toggle(saves, a))}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">Skill proficiencies</span>
            <div className="chips" style={{ marginTop: 8 }}>
              {SKILL_IDS.map((s) => (
                <button key={s} type="button"
                  className={`chip${skills.includes(s) ? " on" : ""}`}
                  aria-pressed={skills.includes(s)}
                  onClick={() => setSkills(toggle(skills, s))}>
                  {spaced(s)}
                </button>
              ))}
            </div>
          </div>

          <AttacksEditor attacks={attacks} onChange={setAttacks} />

          <div className="field">
            <span className="label">Spell slots by level — leave at zero for a non-caster</span>
            <div className="six" style={{ marginTop: 6 }}>
              {slots.map((n, i) => (
                <div key={i}>
                  <label className="label" htmlFor={`sl-${i}`}>{i + 1}</label>
                  <Num id={`sl-${i}`} min={0} max={9} value={n}
                    onChange={(v) => {
                      const next = [...slots];
                      next[i] = v;
                      setSlots(next);
                    }} />
                </div>
              ))}
            </div>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <button type="submit">Create character</button>
            <span className="faint" style={{ fontSize: ".85rem" }}>
              Hit die is set from class ({HIT_DIE[classId]}), and {SKILLS.perception ? "passive perception" : ""} is derived.
            </span>
          </div>
        </div>
      </section>
      </form>
    </>
  );
}
