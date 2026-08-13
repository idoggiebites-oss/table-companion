import { describe, expect, it } from "vitest";
import {
  formatCr, instanceLabel, parseDice, rollHp, searchStatblocks, type Statblock,
} from "../statblock.js";

const mk = (over: Partial<Statblock>): Statblock => ({
  id: "goblin", name: "Goblin", size: "Small", type: "humanoid",
  alignment: "neutral evil", ac: 15, hp: 7, hitDice: "2d6",
  speed: { walk: "30 ft." }, cr: 0.25, xp: 50,
  abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  traits: [], actions: [], reactions: [], legendary: [],
  ...over,
});

describe("challenge ratings read the way they are spoken", () => {
  it("prints fractions below 1", () => {
    expect([0.125, 0.25, 0.5].map(formatCr)).toEqual(["1/8", "1/4", "1/2"]);
  });
  it("prints whole numbers plainly", () => {
    expect([0, 1, 24].map(formatCr)).toEqual(["0", "1", "24"]);
  });
});

describe("dice expressions", () => {
  it("parses a bare pool", () => {
    expect(parseDice("2d6")).toEqual({ count: 2, die: 6, bonus: 0 });
  });
  it("parses a bonus and a penalty", () => {
    expect(parseDice("7d10+21")).toEqual({ count: 7, die: 10, bonus: 21 });
    expect(parseDice("1d4-1")).toEqual({ count: 1, die: 4, bonus: -1 });
  });
  it("refuses what it cannot read rather than guessing", () => {
    expect(parseDice("lots")).toBeNull();
    expect(parseDice("2d7")).toBeNull();
  });
});

describe("rolling hit points at prep time", () => {
  it("is bounded by the expression", () => {
    const lo = rollHp("2d6", () => 0);      // two 1s
    const hi = rollHp("2d6", () => 0.999);  // two 6s
    expect(lo).toBe(2);
    expect(hi).toBe(12);
  });
  it("adds the flat bonus", () => {
    expect(rollHp("7d10+21", () => 0)).toBe(28);
  });
  it("never returns less than one", () => {
    expect(rollHp("1d4-10", () => 0)).toBe(1);
  });
  it("falls back rather than throwing on nonsense", () => {
    expect(rollHp("???")).toBe(1);
  });
});

describe("instances are told apart", () => {
  it("numbers them when there is more than one", () => {
    expect([0, 1, 2].map((i) => instanceLabel("Goblin", i, 3)))
      .toEqual(["Goblin 1", "Goblin 2", "Goblin 3"]);
  });
  it("leaves a lone creature unnumbered", () => {
    expect(instanceLabel("Goblin Boss", 0, 1)).toBe("Goblin Boss");
  });
});

describe("search", () => {
  const all = [
    mk({}),
    mk({ id: "ogre", name: "Ogre", type: "giant", cr: 2, xp: 450 }),
    mk({ id: "wyvern", name: "Wyvern", type: "dragon", cr: 6, xp: 2300 }),
  ];

  it("matches on name", () => {
    expect(searchStatblocks(all, { text: "ogr" }).map((m) => m.name)).toEqual(["Ogre"]);
  });
  it("matches on creature type too, which is how DMs actually look", () => {
    expect(searchStatblocks(all, { text: "dragon" }).map((m) => m.name)).toEqual(["Wyvern"]);
  });
  it("filters by challenge rating band", () => {
    expect(searchStatblocks(all, { minCr: 1, maxCr: 3 }).map((m) => m.name)).toEqual(["Ogre"]);
  });
  it("combines filters", () => {
    expect(searchStatblocks(all, { text: "o", maxCr: 1 }).map((m) => m.name)).toEqual(["Goblin"]);
  });
  it("returns everything for an empty query", () => {
    expect(searchStatblocks(all, {})).toHaveLength(3);
  });
});
