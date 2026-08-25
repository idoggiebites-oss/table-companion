/*
 * A place, prepared before anybody sits down.
 */
import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../events.js";
import { project } from "../project.js";
import { blankScene, describeScene, isNamed, sortScenes } from "../scenes.js";
import { OPEN_GROUND } from "../terrain.js";
import { isDmOnly } from "../visibility.js";

let n = 0;
const ev = (b: object): DomainEvent =>
  ({ id: `e${++n}`, by: "dm", at: Date.now(), ...b }) as DomainEvent;

describe("a scene", () => {
  it("needs only a name to be worth keeping", () => {
    expect(isNamed(blankScene("s1"))).toBe(false);
    expect(isNamed({ ...blankScene("s1"), name: "The cellar" })).toBe(true);
    expect(isNamed({ ...blankScene("s1"), name: "   " })).toBe(false);
  });

  it("says what is IN it, not what it is called", () => {
    // A list where every row repeats its own title tells you nothing.
    expect(describeScene({ ...blankScene("s1"), name: "The cellar" }))
      .toBe("open ground, nothing waiting");
    expect(describeScene(
      {
        id: "s1", name: "The cellar",
        room: { light: "dark", terrain: ["difficult"] },
        note: "the letter is in the desk",
      },
      "Three ghouls",
    )).toBe("dark · 1 thing about the ground · Three ghouls · a note");
  });

  it("puts the one you just wrote first", () => {
    const a = { ...blankScene("s1"), name: "First" };
    const b = { ...blankScene("s2"), name: "Second" };
    expect(sortScenes([a, b]).map((s) => s.name)).toEqual(["Second", "First"]);
  });
});

describe("preparing and throwing away", () => {
  const scene = { id: "s1", name: "The cellar", room: OPEN_GROUND };

  it("keeps it", () => {
    const s = project([ev({ type: "scenePrepared", scene })]);
    expect(s.scenes.s1?.name).toBe("The cellar");
  });

  it("and lets it go", () => {
    const s = project([
      ev({ type: "scenePrepared", scene }),
      ev({ type: "sceneDeleted", sceneId: "s1" }),
    ]);
    expect(s.scenes.s1).toBeUndefined();
  });

  it("overwriting rather than duplicating when it is edited", () => {
    const s = project([
      ev({ type: "scenePrepared", scene }),
      ev({ type: "scenePrepared", scene: { ...scene, name: "The deep cellar" } }),
    ]);
    expect(Object.keys(s.scenes)).toHaveLength(1);
    expect(s.scenes.s1?.name).toBe("The deep cellar");
  });
});

describe("what a player may read about it", () => {
  it("nothing — preparing a place is prep", () => {
    // "Prepared the cellar · dark · a note" tells them what is coming.
    expect(isDmOnly("scenePrepared")).toBe(true);
    expect(isDmOnly("sceneDeleted")).toBe(true);
  });

  it("but putting one live is public, because the table can see the room", () => {
    expect(isDmOnly("sceneSet")).toBe(false);
  });
});

describe("the room a fight is fought in", () => {
  const scene = { id: "s1", name: "The cellar", room: { light: "dark" as const, terrain: [] } };

  it("survives the fight actually starting", () => {
    /*
     * A DM sets the room while the table is still rolling initiative, which
     * is when there is time to. Beginning the fight used to reset it to open
     * ground, so the room was only ever kept if it was said late.
     */
    const s = project([
      ev({
        type: "combatStaged",
        combatants: [{
          id: "c1", name: "Kira", initiative: null,
          source: { kind: "character", characterId: "b1" },
          controller: { kind: "player", characterId: "b1" },
          disclosure: "exact", surprised: false, speed: 30,
        }],
      }),
      ev({ type: "sceneSet", scene: scene.room }),
      ev({ type: "initiativeRolled", combatantId: "c1", value: 15 }),
      ev({ type: "combatBegan" }),
    ]);
    expect(s.combat?.phase).toBe("active");
    expect(s.combat?.scene.light).toBe("dark");
  });
});
