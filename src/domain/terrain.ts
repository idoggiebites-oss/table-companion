/**
 * What the room is like.
 *
 * The app can compute a great deal about a roll — conditions on both sides,
 * who helped, who dodged — and none of it about WHERE the fight is happening.
 * That is not a gap in the rules; it is the deliberate line this app draws:
 * positions live on the table, so the app never guesses at reach, cover or
 * line of sight.
 *
 * But a room has facts that are not positional. It is dark. The floor is
 * rubble. There is a gale. Those apply to everyone at once, the DM knows them
 * the moment the scene opens, and every one of them changes what somebody is
 * told to roll. Left unmodelled they get remembered by one person and applied
 * to whoever they happen to think of.
 *
 * So the DM says what the room is like, once, and every turn after that says
 * what it means for the person taking it.
 */

import type { Light } from "./stance.js";

/**
 * A fact about the room, not about anybody in it.
 *
 * Kept to what a table actually says out loud and what the rules actually
 * change. Cover is deliberately absent: it is positional, and the DM calls it
 * per attack.
 */
export type TerrainTag =
  | "difficult"
  | "obscured"
  | "wind"
  | "underwater"
  | "unstable"
  | "silence";

export interface Scene {
  readonly light: Light;
  readonly terrain: readonly TerrainTag[];
}

export const OPEN_GROUND: Scene = { light: "bright", terrain: [] };

export const TERRAIN: readonly {
  readonly id: TerrainTag;
  readonly name: string;
  /** What the DM is choosing, in the words they would use. */
  readonly what: string;
}[] = [
  { id: "difficult", name: "Difficult ground", what: "Rubble, mud, undergrowth. Every foot costs two." },
  { id: "obscured", name: "Fog or smoke", what: "Heavily obscured. Sight is no help to anyone in it." },
  { id: "wind", name: "Strong wind", what: "Ranged attacks and listening both suffer." },
  { id: "underwater", name: "Underwater", what: "Melee is a slog unless the weapon is made for it." },
  { id: "unstable", name: "Unstable footing", what: "Ice, a rolling deck, a rope bridge." },
  { id: "silence", name: "Silence", what: "Magical. Nothing here can be heard, or cast aloud." },
];

export const LIGHTS: readonly { readonly id: Light; readonly name: string }[] = [
  { id: "bright", name: "Bright" },
  { id: "dim", name: "Dim" },
  { id: "dark", name: "Dark" },
];

/** Whether anything has been said about this room at all. */
export function isOpenGround(scene: Scene): boolean {
  return scene.light === "bright" && scene.terrain.length === 0;
}

/**
 * How far a foot of movement goes here.
 *
 * Difficult ground is the one environmental rule everybody knows and nearly
 * everybody forgets to apply, because it touches the number on a different
 * screen from the one where the DM said it.
 */
export function movementCost(scene: Scene): number {
  return scene.terrain.includes("difficult") || scene.terrain.includes("unstable") ? 2 : 1;
}

/** What the room does to a roll, in the words the turn will print. */
export interface SceneEffect {
  readonly effect: "advantage" | "disadvantage";
  readonly because: string;
}

/**
 * The room's contribution to an attack.
 *
 * Deliberately narrow. Being underwater does not make every attack worse — it
 * makes MELEE worse, and ranged attacks beyond a short distance simply miss,
 * which is a call the DM makes rather than a modifier. Wind troubles arrows
 * and not swords. An app that shrugged and applied disadvantage to everything
 * would be easier to write and wrong often enough to distrust.
 */
export function sceneEffects(
  scene: Scene,
  { range }: { range: "melee" | "ranged" },
): SceneEffect[] {
  const out: SceneEffect[] = [];
  const dis = (because: string) => out.push({ effect: "disadvantage", because });

  if (scene.terrain.includes("obscured")) dis("you cannot see through it");
  if (scene.terrain.includes("wind") && range === "ranged") dis("the wind is against you");
  if (scene.terrain.includes("underwater") && range === "melee") {
    dis("swinging underwater");
  }
  if (scene.terrain.includes("unstable")) dis("you cannot plant your feet");
  return out;
}

/**
 * What the room does to a check, which is a different question — wind and
 * silence trouble ears rather than arms.
 */
export function checkEffects(scene: Scene, skill: string): SceneEffect[] {
  const out: SceneEffect[] = [];
  const s = skill.toLowerCase();
  if (/perception/.test(s)) {
    if (scene.terrain.includes("wind")) {
      out.push({ effect: "disadvantage", because: "the wind is loud" });
    }
    if (scene.terrain.includes("silence")) {
      out.push({ effect: "disadvantage", because: "nothing here makes a sound" });
    }
    if (scene.terrain.includes("obscured")) {
      out.push({ effect: "disadvantage", because: "you cannot see through it" });
    }
  }
  if (/stealth/.test(s)) {
    // The same fog that blinds you hides you.
    if (scene.terrain.includes("obscured")) {
      out.push({ effect: "advantage", because: "it hides you too" });
    }
    if (scene.terrain.includes("silence")) {
      out.push({ effect: "advantage", because: "you make no sound" });
    }
    if (scene.terrain.includes("unstable")) {
      out.push({ effect: "disadvantage", because: "the footing gives you away" });
    }
  }
  return out;
}

/** One line for the track, so the table can see what the room is. */
export function describeScene(scene: Scene): string {
  const parts: string[] = [];
  if (scene.light !== "bright") parts.push(scene.light);
  for (const t of scene.terrain) {
    parts.push(TERRAIN.find((x) => x.id === t)?.name.toLowerCase() ?? t);
  }
  return parts.join(" · ");
}
