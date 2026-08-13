import { describe, expect, it } from "vitest";
import { effectiveBuild } from "../build.js";
import {
  assemble, finalScores, missing, startingHp,
  type ClassChoice, type CreationChoices, type RaceChoice,
} from "../creation.js";
import {
  canAfford, POINT_BUY_BUDGET, pointCost, pointsSpent, STANDARD_ARRAY,
} from "../non-srd.js";

const woodElf: RaceChoice = {
  id: "elf", name: "Elf", speed: 35,
  abilityBonuses: { dex: 2 },
  subraceName: "Wood", subraceBonuses: { wis: 1 },
};
const ranger: ClassChoice = {
  id: "ranger", name: "Ranger", hitDie: 10, saves: ["str", "dex"], spellSlots: [],
};
const choices: CreationChoices = {
  name: "Kira Vance",
  race: woodElf,
  klass: ranger,
  background: { name: "Greenwarden", skills: ["nature", "survival"], tools: ["Herbalism kit"] },
  baseScores: { str: 10, dex: 15, con: 14, int: 11, wis: 13, cha: 12 },
  classSkills: ["perception", "stealth", "survival"],
};

describe("racial bonuses land on what was assigned", () => {
  it("adds race and subrace together", () => {
    const s = finalScores(choices.baseScores, woodElf);
    expect(s.dex).toBe(17);   // 15 + 2
    expect(s.wis).toBe(14);   // 13 + 1
    expect(s.str).toBe(10);   // untouched
  });
});

describe("starting hit points", () => {
  it("is the full die plus constitution, never rolled", () => {
    expect(startingHp(10, 2)).toBe(12);
    expect(startingHp(6, 0)).toBe(6);
  });
  it("never drops below one", () => {
    expect(startingHp(6, -5)).toBe(1);
  });
});

describe("assembling", () => {
  const base = assemble(choices, "kira");

  it("produces a build the rest of the app reads unchanged", () => {
    const b = effectiveBuild({ base, deltas: [] });
    expect(b.totalLevel).toBe(1);
    expect(b.proficiencyBonus).toBe(2);
    expect(b.maxHp).toBe(12);
    expect(b.abilityMods.dex).toBe(3);
    expect(b.armourClass).toBe(13);      // unarmoured 10 + dex
    expect(b.speed).toBe(35);
    expect(b.saveMods.dex).toBe(5);      // +3 and proficient
    expect(b.skillMods.stealth).toBe(5);
    expect(b.resources.find((r) => r.id === "hitDice")?.max).toBe(1);
  });

  it("marks where it came from, so a re-import can replace it", () => {
    expect(base.source).toBe("builder");
  });

  it("names the subrace with the race", () => {
    expect(base.race).toBe("Wood Elf");
  });

  it("merges overlapping skills instead of doubling them", () => {
    // Survival was picked by both the class and the background.
    expect(base.skillProficiencies.filter((s) => s === "survival")).toHaveLength(1);
    expect(base.skillProficiencies).toHaveLength(4);
  });
});

describe("what is still missing", () => {
  it("names each gap", () => {
    expect(missing({})).toEqual(["class", "race", "ability scores"]);
  });
  it("wants two background skills", () => {
    expect(missing({ ...choices, background: { name: "x", skills: ["nature"], tools: [] } }))
      .toEqual(["two background skills"]);
  });
  it("is empty for a complete character", () => {
    expect(missing(choices)).toEqual([]);
  });
});

describe("point buy", () => {
  const flat = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };

  it("costs nothing at the floor", () => {
    expect(pointsSpent(flat)).toBe(0);
  });

  it("charges more above 13", () => {
    expect(pointCost(13)).toBe(5);
    expect(pointCost(14)).toBe(7);   // the curve people forget
    expect(pointCost(15)).toBe(9);
  });

  it("refuses a score outside the range", () => {
    expect(pointCost(16)).toBeNull();
    expect(pointCost(7)).toBeNull();
    expect(canAfford(flat, "str", 16)).toBe(false);
  });

  it("stops at the budget", () => {
    const spent = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };
    expect(pointsSpent(spent)).toBe(27);
    expect(pointsSpent(spent)).toBe(POINT_BUY_BUDGET);
    expect(canAfford(spent, "int", 9)).toBe(false);
    expect(canAfford(spent, "int", 8)).toBe(true);
  });
});

describe("the standard array", () => {
  it("is six values, highest first", () => {
    expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8]);
  });
});
