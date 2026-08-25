/*
 * What the room is like, as opposed to where anybody is standing in it.
 */
import { describe, expect, it } from "vitest";
import {
  checkEffects, describeRoom, isOpenGround, movementCost, roomEffects,
  OPEN_GROUND, type Room,
} from "../terrain.js";

const room = (over: Partial<Room>): Room => ({ ...OPEN_GROUND, ...over });

describe("a room nobody has said anything about", () => {
  it("changes nothing", () => {
    expect(isOpenGround(OPEN_GROUND)).toBe(true);
    expect(movementCost(OPEN_GROUND)).toBe(1);
    expect(roomEffects(OPEN_GROUND, { range: "melee" })).toEqual([]);
    expect(describeRoom(OPEN_GROUND)).toBe("");
  });
});

describe("difficult ground", () => {
  it("is the rule everybody knows and forgets to apply", () => {
    // It touches the movement number on a different screen from the one where
    // the DM said it, which is exactly how it gets forgotten.
    expect(movementCost(room({ terrain: ["difficult"] }))).toBe(2);
  });

  it("and unstable footing costs the same", () => {
    expect(movementCost(room({ terrain: ["unstable"] }))).toBe(2);
  });

  it("but does not touch your attack", () => {
    expect(roomEffects(room({ terrain: ["difficult"] }), { range: "melee" })).toEqual([]);
  });
});

describe("what the room does to an attack", () => {
  it("troubles arrows in wind, and not swords", () => {
    // An app that shrugged and applied disadvantage to everything would be
    // easier to write and wrong often enough to distrust.
    expect(roomEffects(room({ terrain: ["wind"] }), { range: "ranged" })).toHaveLength(1);
    expect(roomEffects(room({ terrain: ["wind"] }), { range: "melee" })).toEqual([]);
  });

  it("and troubles swords underwater, and not arrows", () => {
    expect(roomEffects(room({ terrain: ["underwater"] }), { range: "melee" })).toHaveLength(1);
    expect(roomEffects(room({ terrain: ["underwater"] }), { range: "ranged" })).toEqual([]);
  });

  it("while fog troubles both", () => {
    expect(roomEffects(room({ terrain: ["obscured"] }), { range: "melee" })).toHaveLength(1);
    expect(roomEffects(room({ terrain: ["obscured"] }), { range: "ranged" })).toHaveLength(1);
  });

  it("and they stack", () => {
    const nasty = room({ terrain: ["obscured", "unstable", "wind"] });
    expect(roomEffects(nasty, { range: "ranged" })).toHaveLength(3);
  });
});

describe("what the room does to a check", () => {
  it("is a different question from what it does to an attack", () => {
    // Wind troubles ears rather than arms.
    expect(checkEffects(room({ terrain: ["wind"] }), "perception")).toHaveLength(1);
    expect(checkEffects(room({ terrain: ["wind"] }), "athletics")).toEqual([]);
  });

  it("and the same fog that blinds you hides you", () => {
    const fog = room({ terrain: ["obscured"] });
    expect(checkEffects(fog, "perception")[0]?.effect).toBe("disadvantage");
    expect(checkEffects(fog, "stealth")[0]?.effect).toBe("advantage");
  });

  it("while bad footing gives you away", () => {
    expect(checkEffects(room({ terrain: ["unstable"] }), "stealth")[0]?.effect)
      .toBe("disadvantage");
  });
});

describe("saying what the room is", () => {
  it("reads as a line the table can glance at", () => {
    expect(describeRoom(room({ light: "dark", terrain: ["difficult"] })))
      .toBe("dark · difficult ground");
  });
});
