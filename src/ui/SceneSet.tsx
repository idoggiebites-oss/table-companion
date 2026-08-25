/**
 * The DM saying what the room is like.
 *
 * Everything else the app knows about a roll it worked out for itself. This
 * is the one thing it cannot see and will not guess: where the fight is
 * happening. So the DM says it once, in a breath, and every turn afterwards
 * carries it — the movement counter halves, the attack says why it is harder,
 * the check says whether the fog helps or hinders.
 *
 * One event for the whole room rather than one per fact, because that is how
 * a DM sets a scene and because undoing it should take back the room rather
 * than one detail of it.
 */

import { useState } from "react";
import type { EventBody } from "../domain/events.js";
import {
  describeScene, isOpenGround, LIGHTS, OPEN_GROUND, TERRAIN,
  type Scene, type TerrainTag,
} from "../domain/terrain.js";
import type { Light } from "../domain/stance.js";

export function SceneSet({
  scene, append,
}: {
  scene: Scene;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);

  const set = (next: Scene) => append({ type: "sceneSet", scene: next });
  const toggle = (t: TerrainTag) =>
    set({
      ...scene,
      terrain: scene.terrain.includes(t)
        ? scene.terrain.filter((x) => x !== t)
        : [...scene.terrain, t],
    });

  return (
    <div className="scene">
      <button
        className={`scene-hd${open ? " open" : ""}`}
        aria-expanded={open}
        aria-label="The room"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nm">The room</span>
        <span className="scene-said">
          {isOpenGround(scene) ? "open ground" : describeScene(scene)}
        </span>
        <span className="scene-mark">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="scene-body">
          <span className="label">Light</span>
          <div className="seg" style={{ marginTop: 6 }}>
            {LIGHTS.map((l) => (
              <button
                key={l.id}
                className={scene.light === l.id ? "on" : ""}
                aria-pressed={scene.light === l.id}
                aria-label={`Light ${l.name}`}
                onClick={() => set({ ...scene, light: l.id as Light })}
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
              const on = scene.terrain.includes(t.id);
              return (
                <button
                  key={t.id}
                  className={`scene-row${on ? " on" : ""}`}
                  aria-pressed={on}
                  aria-label={t.name}
                  onClick={() => toggle(t.id)}
                >
                  <span className="nm">{t.name}</span>
                  <span className="faint">{t.what}</span>
                </button>
              );
            })}
          </div>

          {!isOpenGround(scene) && (
            <button
              style={{ marginTop: 10 }}
              aria-label="Clear the room"
              onClick={() => set(OPEN_GROUND)}
            >
              Open ground again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
