/**
 * The things a sheet carries that do not change during a session.
 *
 * Skills, saves and features were three cards on the scroll — forty-odd rows
 * a player passes on the way to their hit points, every time, for the one
 * evening in ten they need them. They are now three buttons that carry their
 * own answer ("+7 best") and open over the panel.
 *
 * Over, not below: the panel stays behind the drawer, so you can look up
 * Stealth while still seeing that you are on 31 of 52.
 */

import { useState } from "react";
import {
  formatModifier, SKILL_IDS, SKILLS, type Ability, type SkillId,
} from "../domain/abilities.js";
import type { EffectiveBuild } from "../domain/build.js";
import { Features } from "./Features.js";

type Which = "skills" | "saves" | "features";

const spaced = (s: string) => s.replace(/([A-Z])/g, " $1").toLowerCase();

export function Drawer({
  build, onRoll, rolling,
}: {
  build: EffectiveBuild;
  /** A skill or save is a roll, and the roll pad belongs to the sheet. */
  onRoll: (label: string, modifier: number, kind: "check" | "save") => void;
  /** What the pad is already open on, so the row can show it is selected. */
  rolling?: string | undefined;
}) {
  const [open, setOpen] = useState<Which | null>(null);

  const bestSkill = SKILL_IDS.reduce<SkillId>(
    (top, s) => (build.skillMods[s] > build.skillMods[top] ? s : top),
    SKILL_IDS[0]!,
  );
  const abilities = Object.keys(build.saveMods) as Ability[];
  const bestSave = abilities.reduce(
    (top, a) => (build.saveMods[a] > build.saveMods[top] ? a : top),
    abilities[0]!,
  );

  const tab = (id: Which, name: string, answer: string) => (
    <button
      className={`dw-open${open === id ? " on" : ""}`}
      aria-expanded={open === id}
      aria-label={`${name}, ${answer}`}
      onClick={() => setOpen(open === id ? null : id)}
    >
      <span className="n">{name}</span>
      <span className="v">{answer}</span>
    </button>
  );

  return (
    <>
      <div className="dw-tabs">
        {tab("skills", "Skills", `${formatModifier(build.skillMods[bestSkill])} best`)}
        {tab("saves", "Saves", `${bestSave} ${formatModifier(build.saveMods[bestSave])}`)}
        {tab("features", "Features", "what you have")}
      </div>

      {open === "skills" && (
        <section className="card dw">
          <div className="card-hd">
            <span className="label">Skills</span>
            {/*
              * Passive perception, where perception is.
              *
              * It was the sixth cell of the stat strip, which on a 390px phone
              * clipped its own label — and it is not a number a table asks for
              * mid-turn, it is the one a DM reads to decide whether you
              * noticed something. It belongs with the skill it derives from.
              */}
            <span className="label q">Passive perception {build.passivePerception} · tap to roll</span>
          </div>
          <div className="dw-list">
            {[...SKILL_IDS]
              .sort((a, b) => build.skillMods[b] - build.skillMods[a])
              .map((s) => (
                <button
                  className={`dw-row${
                    trainedIn(build.skillMods[s], build.abilityMods[SKILLS[s]], build) ? " on" : ""
                  }${
                    rolling === spaced(s) ? " sel" : ""
                  }`}
                  key={s}
                  onClick={() => onRoll(spaced(s), build.skillMods[s], "check")}
                >
                  <span className="n">{spaced(s)}</span>
                  <span className="a">{SKILLS[s]}</span>
                  <span className="v">{formatModifier(build.skillMods[s])}</span>
                </button>
              ))}
          </div>
        </section>
      )}

      {open === "saves" && (
        <section className="card dw">
          <div className="card-hd">
            <span className="label">Saving throws</span>
            <span className="label q">Tap to roll</span>
          </div>
          <div className="dw-list">
            {abilities.map((a) => (
              <button
                className={`dw-row${trainedIn(build.saveMods[a], build.abilityMods[a], build) ? " on" : ""}${
                  rolling === `${a} save` ? " sel" : ""
                }`}
                key={a}
                onClick={() => onRoll(`${a} save`, build.saveMods[a], "save")}
              >
                <span className="n">{a}</span>
                <span className="a">save</span>
                <span className="v">{formatModifier(build.saveMods[a])}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {open === "features" && <Features build={build} />}
    </>
  );
}

/**
 * Trained ones carry the gold; the rest stay legible and quiet.
 *
 * Read off the numbers rather than the proficiency lists, which the effective
 * build does not carry — a trained skill is its ability plus the proficiency
 * bonus, and expertise is more. That also gets a feat's half-proficiency
 * right without knowing the feat exists.
 */
function trainedIn(mod: number, ability: number, build: EffectiveBuild): boolean {
  return mod - ability >= build.proficiencyBonus;
}
