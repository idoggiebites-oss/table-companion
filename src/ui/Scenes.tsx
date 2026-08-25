/**
 * The places a DM prepared, and the one press that opens one.
 *
 * Encounters, NPCs and statblocks were three saved things that nothing joined
 * up — a bestiary rather than a plan. A scene is the join: the cellar, with
 * its dark and its rubble, the thing waiting in it, and the line to read when
 * the door opens.
 *
 * Opening one does three things at once, which is the whole point: it sets
 * the room live for everybody, it stages the encounter if there is one, and
 * it puts the note in front of the DM. Doing those separately is what a DM
 * does today, and forgetting the second is why a fight starts in daylight
 * that was supposed to be pitch dark.
 */

import { useEffect, useState } from "react";
import type { EventBody } from "../domain/events.js";
import type { CampaignState } from "../domain/project.js";
import { blankScene, describeScene, isNamed, sortScenes, type Scene } from "../domain/scenes.js";
import {
  isOpenGround, LIGHTS, OPEN_GROUND, TERRAIN, type TerrainTag,
} from "../domain/terrain.js";
import type { Light } from "../domain/stance.js";
import { combatantsFor, creaturesFrom } from "../domain/stage.js";
import { mergeStatblocks, type Statblock } from "../domain/statblock.js";
import { loadMonsters } from "../store/srd.js";

export function Scenes({
  state, append, onOpened,
}: {
  state: CampaignState;
  append: (body: EventBody) => void;
  /**
   * Which place is live, kept by the app rather than this card. Opening one
   * with a fight in it moves the DM to the fight tab — so a note rendered
   * here would vanish at the exact moment it is meant to be read.
   */
  onOpened: (sceneId: string) => void;
}) {
  const [draft, setDraft] = useState<Scene | null>(null);
  const scenes = sortScenes(Object.values(state.scenes));
  const anyEncounter = scenes.some((s) => s.encounterId);
  /*
   * Loaded as soon as a prepared place has something waiting in it, not when
   * the button is pressed. "Open it" has one job and it has to land in one
   * press — a fight that arrives half a second later, with the wrong hit
   * points, is worse than no button.
   */
  const [book, setBook] = useState<Statblock[] | null>(null);
  useEffect(() => {
    if (!anyEncounter || book) return;
    loadMonsters().then(setBook, () => setBook([]));
  }, [anyEncounter, book]);

  const open = (scene: Scene) => {
    /*
     * The fight FIRST, then the room. Staging a combat builds a fresh one on
     * open ground — so setting the room before staging silently wiped it, and
     * a place prepared as pitch dark opened in daylight. Which is the exact
     * failure scenes exist to prevent.
     */
    const encounter = scene.encounterId ? state.encounters[scene.encounterId] : undefined;
    if (encounter) {
      const combatants = combatantsFor({
        characters: Object.values(state.builds),
        creatures: creaturesFrom(encounter, mergeStatblocks(book ?? [], state.homebrew)),
      });
      if (combatants.length > 0) append({ type: "combatStaged", combatants });
    }
    append({ type: "sceneSet", scene: scene.room });
  };

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Places</span>
        <button onClick={() => setDraft(draft ? null : blankScene(`sc${Date.now().toString(36)}`))}>
          {draft ? "Cancel" : "Prepare one"}
        </button>
      </div>

      <div className="card-body">
        {scenes.length === 0 && !draft && (
          <p className="faint" style={{ margin: 0, fontSize: ".88rem" }}>
            A place is a room, whatever is waiting in it, and what you mean to
            say when the door opens. Prepare them now; open one in a press.
          </p>
        )}

        {scenes.map((s) => (
          <div className="sc-row" key={s.id}>
            <span className="sc-name">
              <span className="nm">{s.name}</span>
              <span className="faint">
                {describeScene(
                  s,
                  s.encounterId ? state.encounters[s.encounterId]?.name : undefined,
                )}
              </span>
            </span>
            <button
              className="sc-open"
              aria-label={`Open ${s.name}`}
              onClick={() => {
                open(s);
                onOpened(s.id);
              }}
            >
              Open it
            </button>
            <button aria-label={`Edit ${s.name}`} onClick={() => setDraft(s)}>Edit</button>
          </div>
        ))}

        {draft && (
          <div className={`sc-draft${scenes.length > 0 ? " under" : ""}`}>
            <input
              value={draft.name}
              aria-label="Place name"
              placeholder="The cellar under the mill"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />

            <span className="label" style={{ display: "block", marginTop: 14 }}>Light</span>
            <div className="seg" style={{ marginTop: 6 }}>
              {LIGHTS.map((l) => (
                <button
                  key={l.id}
                  className={draft.room.light === l.id ? "on" : ""}
                  aria-pressed={draft.room.light === l.id}
                  aria-label={`Prepare light ${l.name}`}
                  onClick={() =>
                    setDraft({ ...draft, room: { ...draft.room, light: l.id as Light } })
                  }
                >
                  {l.name}
                </button>
              ))}
            </div>

            <span className="label" style={{ display: "block", marginTop: 14 }}>
              And the ground
            </span>
            <div className="scene-rows">
              {TERRAIN.map((t) => {
                const on = draft.room.terrain.includes(t.id);
                return (
                  <button
                    key={t.id}
                    className={`scene-row${on ? " on" : ""}`}
                    aria-pressed={on}
                    aria-label={`Prepare ${t.name}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        room: {
                          ...draft.room,
                          terrain: on
                            ? draft.room.terrain.filter((x) => x !== t.id)
                            : [...draft.room.terrain, t.id as TerrainTag],
                        },
                      })
                    }
                  >
                    <span className="nm">{t.name}</span>
                    <span className="faint">{t.what}</span>
                  </button>
                );
              })}
            </div>

            {Object.keys(state.encounters).length > 0 && (
              <div className="row" style={{ marginTop: 14 }}>
                <span className="label">Waiting in it</span>
                <select
                  aria-label="Encounter waiting"
                  value={draft.encounterId ?? ""}
                  style={{ width: "auto", flex: "1 1 160px" }}
                  onChange={(e) => {
                    const { encounterId: _drop, ...rest } = draft;
                    setDraft(
                      e.target.value ? { ...rest, encounterId: e.target.value } : rest,
                    );
                  }}
                >
                  <option value="">nothing</option>
                  {Object.values(state.encounters).map((en) => (
                    <option key={en.id} value={en.id}>{en.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="sc-note">
              <label>
                <span className="label">What you mean to say</span>
                <span className="sc-ct">{(draft.note ?? "").length} / 400</span>
              </label>
              <textarea
                aria-label="Note"
                maxLength={400}
                placeholder="The stair gives under your weight. Something below stops moving."
                value={draft.note ?? ""}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button
                disabled={!isNamed(draft)}
                onClick={() => {
                  append({ type: "scenePrepared", scene: draft });
                  setDraft(null);
                }}
              >
                Keep it
              </button>
              {state.scenes[draft.id] && (
                <button
                  aria-label={`Throw away ${draft.name}`}
                  onClick={() => {
                    append({ type: "sceneDeleted", sceneId: draft.id });
                    setDraft(null);
                  }}
                >
                  Throw it away
                </button>
              )}
              {/* "Open ground" beside "Open it" reads as a second way to
                  start the scene. It is the opposite. */}
              <button onClick={() => setDraft({ ...draft, room: OPEN_GROUND })}>
                Clear the room
              </button>
            </div>
            {isOpenGround(draft.room) && (
              <p className="faint" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>
                Nothing said about the room. Opening this will clear whatever
                the last place set.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
