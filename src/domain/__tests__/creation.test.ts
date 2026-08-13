import { describe, expect, it } from "vitest";
import { effectiveBuild } from "../build.js";
import {
  asiPoints, assemble, finalScores, hpAtLevel, missing, startingHp,
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

describe("joining a campaign already in progress", () => {
  it("is a base at that level, exactly like importing one", () => {
    const base = assemble({ ...choices, level: 8 }, "kira");
    expect(base.classes).toEqual([{ classId: "ranger", level: 8 }]);
    // Not level 1 plus seven deltas — so re-import reconciliation is unchanged.
    expect(effectiveBuild({ base, deltas: [] }).proficiencyBonus).toBe(3);
  });

  it("takes the full die at level one and the average after", () => {
    // d10 ranger, con 14 → +2. 12 at first, then 6+2 each level.
    expect(hpAtLevel(10, 2, 1)).toBe(12);
    expect(hpAtLevel(10, 2, 2)).toBe(20);
    expect(hpAtLevel(10, 2, 8)).toBe(68);
  });

  it("applies constitution to every level, not just the first", () => {
    const withCon = hpAtLevel(10, 2, 5);
    const without = hpAtLevel(10, 0, 5);
    expect(withCon - without).toBe(10); // +2 across five levels
  });

  it("uses rolls where they are given and the average elsewhere", () => {
    // Two rolls supplied for levels 2 and 3; levels 4-5 fall back to 6.
    expect(hpAtLevel(10, 0, 5, [10, 10])).toBe(10 + 10 + 10 + 6 + 6);
  });

  it("never returns fewer hit points than levels", () => {
    expect(hpAtLevel(6, -5, 4)).toBeGreaterThanOrEqual(4);
  });

  it("clamps a level outside the table", () => {
    expect(assemble({ ...choices, level: 99 }).classes[0]!.level).toBe(20);
    expect(assemble({ ...choices, level: 0 }).classes[0]!.level).toBe(1);
  });

  it("takes spell slots from the class table when supplied", () => {
    const base = assemble({ ...choices, level: 8, spellSlots: [4, 3] });
    const b = effectiveBuild({ base, deltas: [] });
    expect(b.resources.find((r) => r.id === "slot2")?.max).toBe(3);
  });
});

describe("ability score improvements", () => {
  const fighter = [4, 6, 8, 12, 14, 16, 19];

  it("counts what a level has earned", () => {
    expect(asiPoints(fighter, 3)).toBe(0);
    expect(asiPoints(fighter, 4)).toBe(2);
    expect(asiPoints(fighter, 8)).toBe(6);   // 4, 6, 8
    expect(asiPoints(fighter, 20)).toBe(14);
  });

  it("is per class — a rogue's levels differ from a fighter's", () => {
    expect(asiPoints([4, 8, 10, 12, 16, 19], 10)).toBe(6);
    expect(asiPoints(fighter, 10)).toBe(6);
    expect(asiPoints([4, 8, 10, 12, 16, 19], 14)).toBe(8);
    expect(asiPoints(fighter, 14)).toBe(10);
  });
});
