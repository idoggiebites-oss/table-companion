/**
 * A place, prepared before anybody sits down.
 *
 * The app could save encounters, NPCs and statblocks — three kinds of thing,
 * which is a bestiary rather than a plan. What a DM actually prepares is a
 * PLACE: the cellar, with its dark and its rubble, the thing waiting in it,
 * and the line they mean to read out when the door opens.
 *
 * Those three already existed as separate features that nothing joined up.
 * A scene is the join: a room, an encounter, and a note, under a name, ready
 * to be put live in one press.
 *
 * Deliberately not a map and not a sequence. Scenes are a drawer you reach
 * into, not a track a session runs along — a table goes where it goes, and a
 * tool that assumed an order would be wrong every session and smug about it.
 */

import { OPEN_GROUND, type Room } from "./terrain.js";

export interface Scene {
  readonly id: string;
  readonly name: string;
  /** What the room is like when this scene opens. */
  readonly room: Room;
  /** An encounter to stage, by id. Absent means nothing is waiting. */
  readonly encounterId?: string;
  /** What the DM means to say, or remember. Never reaches a player. */
  readonly note?: string;
}

export function blankScene(id: string): Scene {
  return { id, name: "", room: OPEN_GROUND };
}

/** Ready enough to save: a name is the only thing a scene truly needs. */
export function isNamed(scene: Scene): boolean {
  return scene.name.trim().length > 0;
}

/**
 * One line, for the drawer. Says what is IN it rather than restating the name
 * — a list where every row repeats its own title tells you nothing.
 */
export function describeScene(
  scene: Scene,
  encounterName?: string | undefined,
): string {
  const parts: string[] = [];
  if (scene.room.light !== "bright") parts.push(scene.room.light);
  if (scene.room.terrain.length > 0) {
    parts.push(`${scene.room.terrain.length} thing${scene.room.terrain.length === 1 ? "" : "s"} about the ground`);
  }
  if (encounterName) parts.push(encounterName);
  if (scene.note?.trim()) parts.push("a note");
  return parts.join(" · ") || "open ground, nothing waiting";
}

/** Newest first, because the one you just wrote is the one you want. */
export function sortScenes(scenes: readonly Scene[]): Scene[] {
  return [...scenes].sort((a, b) => b.id.localeCompare(a.id));
}
