/**
 * Resolving a level.
 *
 * Pending, never interrupting. Crossing a threshold mid-fight must not put a
 * card on anyone's screen — the combat study drew a hard line about that: the
 * card becomes the prompt only when nothing else is true, and a concentration
 * save qualifies because it is owed NOW. A level-up never is. So this is a
 * quiet banner the player opens at a rest, between sessions, or whenever they
 * look.
 *
 * Hit points are a physical roll like everything else — the app names the die
 * and holds the modifier — or the fixed average, which most tables settle once
 * and never revisit.
 */

import { useEffect, useState } from "react";
import { ABILITIES, formatModifier, type Ability } from "../domain/abilities.js";
import type { CompendiumFeat } from "../import/compendium.js";
import { loadClassLevels, loadFeats, type ClassLevels } from "../store/srd.js";
import type { EffectiveBuild } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import type { ClassId } from "../domain/resources.js";

/** The fixed alternative to rolling: half the die, rounded up. */
export function averageGain(die: number, conMod: number): number {
  return Math.max(1, Math.floor(die / 2) + 1 + conMod);
}

export function LevelUp({
  build, owed, append,
}: {
  build: EffectiveBuild;
  owed: number;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState<ClassId>(build.classes[0]!.classId);
  const [levels, setLevels] = useState<ClassLevels | null>(null);
  const [feats, setFeats] = useState<CompendiumFeat[]>([]);
  const [route, setRoute] = useState<"asi" | "feat">("asi");
  const [bumps, setBumps] = useState<Partial<Record<Ability, number>>>({});
  const [featId, setFeatId] = useState("");
  const [featFilter, setFeatFilter] = useState("");

  useEffect(() => {
    loadClassLevels().then(setLevels, () => setLevels({}));
    loadFeats().then(setFeats, () => setFeats([]));
  }, []);

  if (owed <= 0) return null;

  const conMod = build.abilityMods.con;
  const die = build.hitDie;
  const average = averageGain(die, conMod);
  const to = build.totalLevel + 1;

  /**
   * Which levels grant an improvement is per class — fighters get extra ones
   * at 6 and 14, rogues at 10 — so it comes from the table rather than a
   * remembered 4/8/12/16/19.
   */
  const nextLevel = build.classes.find((c) => c.classId === classId)?.level ?? 0;
  const grantsChoice = (levels?.[classId]?.[nextLevel]?.asi ?? false);

  const spent = ABILITIES.reduce((n, a) => n + (bumps[a] ?? 0), 0);
  const chosenFeat = feats.find((f) => f.id === featId);
  const choiceReady = !grantsChoice
    || (route === "asi" ? spent === 2 : chosenFeat !== undefined);

  const shownFeats = feats
    .filter((f) => {
      const q = featFilter.trim().toLowerCase();
      return !q || f.name.toLowerCase().includes(q);
    })
    .slice(0, 60);

  const gain = (rolled: number) => {
    append({
      type: "levelGained",
      who: build.id,
      classId,
      hpGain: Math.max(1, rolled + conMod),
      ...(grantsChoice && route === "asi" ? { abilities: bumps } : {}),
      ...(grantsChoice && route === "feat" && chosenFeat
        ? { feat: { id: chosenFeat.id, name: chosenFeat.name } }
        : {}),
    });
    setOpen(false);
    setBumps({});
    setFeatId("");
  };

  return (
    <section className="card lv">
      <div className="lv-head">
        <span className="lv-k">Level up</span>
        <span className="lv-n">
          {build.classes.map((c) => c.classId).join(" / ")} {to}
        </span>
        <span className="lv-s">
          from level {build.totalLevel}
          {owed > 1 ? ` · ${owed} owed` : ""}
        </span>
      </div>

      {!open ? (
        <div className="card-body">
          <button onClick={() => setOpen(true)}>Resolve it</button>
          <p className="faint" style={{ fontSize: ".84rem", margin: "10px 0 0" }}>
            Nothing is waiting on this. Take it at a rest.
          </p>
        </div>
      ) : (
        <div className="card-body">
          {build.classes.length > 1 && (
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="label">In</span>
              <select
                aria-label="Class to level"
                value={classId}
                style={{ width: "auto" }}
                onChange={(e) => setClassId(e.target.value as ClassId)}
              >
                {build.classes.map((c) => (
                  <option key={c.classId} value={c.classId}>{c.classId}</option>
                ))}
              </select>
            </div>
          )}

          {grantsChoice && (
            <div className="lv-choice">
              <span className="label cr-sub">This level, you may improve or take a feat</span>
              <div className="seg">
                <button
                  aria-pressed={route === "asi"}
                  className={route === "asi" ? "on" : ""}
                  onClick={() => setRoute("asi")}
                >
                  Raise abilities
                </button>
                <button
                  aria-pressed={route === "feat"}
                  className={route === "feat" ? "on" : ""}
                  disabled={feats.length === 0}
                  onClick={() => setRoute("feat")}
                >
                  Take a feat
                </button>
              </div>

              {route === "asi" ? (
                <>
                  <p className="faint" style={{ fontSize: ".82rem", margin: "8px 0" }}>
                    Two points: both into one ability, or one each into two.
                    Nothing goes above 20. {2 - spent} left.
                  </p>
                  <div className="lv-abils">
                    {ABILITIES.map((a) => {
                      const at = build.abilities[a];
                      const added = bumps[a] ?? 0;
                      const capped = at + added >= 20;
                      return (
                        <button
                          key={a}
                          className={`chip${added > 0 ? " on" : ""}`}
                          disabled={(spent >= 2 && added === 0) || capped}
                          aria-label={`Raise ${a}`}
                          onClick={() =>
                            setBumps((b) => ({ ...b, [a]: (b[a] ?? 0) + 1 }))
                          }
                        >
                          {a} {at + added}
                          {added > 0 ? ` (+${added})` : ""}
                        </button>
                      );
                    })}
                  </div>
                  {spent > 0 && (
                    <button onClick={() => setBumps({})} style={{ marginTop: 8 }}>
                      Start over
                    </button>
                  )}
                </>
              ) : (
                <>
                  <input
                    value={featFilter}
                    aria-label="Filter feats"
                    placeholder={`filter ${feats.length} feats…`}
                    style={{ marginTop: 8 }}
                    onChange={(e) => setFeatFilter(e.target.value)}
                  />
                  <select
                    aria-label="Feat"
                    value={featId}
                    style={{ marginTop: 8 }}
                    onChange={(e) => setFeatId(e.target.value)}
                  >
                    <option value="">choose a feat…</option>
                    {shownFeats.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  {chosenFeat && (
                    <p className="faint lv-feat">
                      {chosenFeat.prerequisite && <b>Needs {chosenFeat.prerequisite}. </b>}
                      {chosenFeat.text.slice(0, 320)}
                      {chosenFeat.text.length > 320 ? "…" : ""}
                    </p>
                  )}
                  {/* Named, never mechanised: the app cannot know what six
                      hundred feats do, and half-applying them would be worse
                      than being clear that it applies none. */}
                  <p className="faint" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>
                    Recorded on your sheet. Nothing it grants is worked out for
                    you — tell the table what it does.
                  </p>
                </>
              )}
            </div>
          )}

          <p className="lv-ask">
            Roll a <strong>d{die}</strong> for hit points.
          </p>
          <p className="faint" style={{ fontSize: ".85rem", margin: "0 0 12px" }}>
            Add your Constitution modifier of {formatModifier(conMod)}. Tap what you rolled.
          </p>
          <div className="lv-pad">
            {Array.from({ length: die }, (_, i) => i + 1).map((face) => (
              <button key={face} disabled={!choiceReady} onClick={() => gain(face)}>
                {face}
              </button>
            ))}
          </div>

          <div className="lv-or"><i /><span>or</span><i /></div>
          <button className="lv-avg" disabled={!choiceReady} onClick={() => gain(average - conMod)}>
            Take the average · {average}
          </button>

          <p className="faint" style={{ fontSize: ".82rem", margin: "14px 0 0" }}>
            Everything derived moves with it — proficiency, skills, saves,
            attacks, hit dice. Choices like a new spell are yours to make,
            here or in your builder.
          </p>
        </div>
      )}
    </section>
  );
}
