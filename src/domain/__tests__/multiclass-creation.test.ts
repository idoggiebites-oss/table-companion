/*
 * Building a character who is already two classes.
 */
import { describe, expect, it } from "vitest";
import { assemble, multiclassHp } from "../creation.js";
import { effectiveBuild } from "../build.js";

const base = {
  name: "Bel", classSkills: [],
  baseScores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 14 },
  race: { id: "human", name: "Human", speed: 30, abilityBonuses: {} },
  klass: { id: "fighter", name: "Fighter", hitDie: 10, saves: ["str", "con"], spellSlots: [] },
  background: { name: "Soldier", skills: [], tools: [] },
} as never;

describe("hit points across two classes", () => {
  it("gives the full die once, at the very first level", () => {
    // The only free maximum anybody gets, and it belongs to the class they
    // started in.
    expect(multiclassHp({ die: 10, level: 1 }, [], 2)).toBe(12);
  });

  it("and an average for every level after, in whichever class", () => {
    // Fighter 2 = 10 + 6, then warlock 1 = +5. Con +2 on all three.
    expect(multiclassHp({ die: 10, level: 2 }, [{ die: 8, level: 1 }], 2))
      .toBe(10 + 2 + 6 + 2 + 5 + 2);
  });

  it("so a d12 dip is worth more than a d6 one", () => {
    const big = multiclassHp({ die: 10, level: 5 }, [{ die: 12, level: 1 }], 0);
    const small = multiclassHp({ die: 10, level: 5 }, [{ die: 6, level: 1 }], 0);
    expect(big).toBeGreaterThan(small);
  });
});

describe("a character built as two classes", () => {
  const bel = assemble({
    ...(base as object),
    level: 5,
    extraClasses: [{ id: "warlock", name: "Warlock", hitDie: 8, level: 3 }],
  } as never);

  it("carries both", () => {
    expect(bel.classes).toEqual([
      { classId: "fighter", level: 5 },
      { classId: "warlock", level: 3 },
    ]);
  });

  it("and each class's own hit die", () => {
    expect(bel.hitDie).toBe(10);
    expect(bel.classDice).toEqual({ warlock: 8 });
  });

  it("reading as level eight, not five", () => {
    const build = effectiveBuild({ base: bel, deltas: [] });
    expect(build.totalLevel).toBe(8);
    expect(build.proficiencyBonus).toBe(3);
    expect(build.multiclass).toBe(true);
  });

  it("with hit dice as a pool", () => {
    expect(effectiveBuild({ base: bel, deltas: [] }).hitDicePool).toEqual([
      { die: 10, count: 5 },
      { die: 8, count: 3 },
    ]);
  });

  it("and pact magic beside its slots rather than inside them", () => {
    const build = effectiveBuild({ base: bel, deltas: [] });
    // A fighter/warlock has no ordinary slots at all — warlocks are not in
    // the caster-level sum.
    expect(build.spellSlots).toEqual([]);
    expect(build.resources.some((r) => r.id === "pactSlots")).toBe(true);
  });
});

describe("a class taken at zero levels", () => {
  it("is a class you do not have", () => {
    const b = assemble({
      ...(base as object),
      extraClasses: [{ id: "warlock", name: "Warlock", hitDie: 8, level: 0 }],
    } as never);
    expect(b.classes).toHaveLength(1);
    expect(effectiveBuild({ base: b, deltas: [] }).multiclass).toBe(false);
  });
});
