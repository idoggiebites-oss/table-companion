/*
 * The arithmetic nobody does right at a table without the book open.
 */
import { describe, expect, it } from "vitest";
import {
  casterLevel, hitDicePool, isMulticlass, multiclassBlock, multiclassSlots, pactMagic,
} from "../multiclass.js";

const c = (classId: string, level: number, subclass?: string) =>
  subclass ? { classId, level, subclass } : { classId, level };
const scores = (over: Partial<Record<string, number>> = {}) =>
  ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...over }) as never;

describe("the one number the table is read at", () => {
  it("counts a full caster at their level", () => {
    expect(casterLevel([c("wizard", 5)])).toBe(5);
    expect(casterLevel([c("cleric", 3), c("wizard", 3)])).toBe(6);
  });

  it("halves a half caster, rounding down", () => {
    expect(casterLevel([c("paladin", 5)])).toBe(2);
    expect(casterLevel([c("ranger", 7)])).toBe(3);
  });

  it("rounds the artificer UP, which is the exception everyone forgets", () => {
    expect(casterLevel([c("artificer", 5)])).toBe(3);
    expect(casterLevel([c("artificer", 1)])).toBe(1);
  });

  it("counts a third-caster subclass and not the class it sits on", () => {
    expect(casterLevel([c("fighter", 6)])).toBe(0);
    expect(casterLevel([c("fighter", 6, "Eldritch Knight")])).toBe(2);
    expect(casterLevel([c("rogue", 9, "Arcane Trickster")])).toBe(3);
  });

  it("leaves the warlock out of it entirely", () => {
    // Pact magic is its own track. Adding it in would hand out slots twice.
    expect(casterLevel([c("warlock", 5)])).toBe(0);
    expect(casterLevel([c("warlock", 5), c("sorcerer", 3)])).toBe(3);
  });
});

describe("the slots that come out", () => {
  it("gives a Cleric 3 / Wizard 3 the slots of a sixth-level caster", () => {
    // 4/3/3 — while they still only know 2nd-level spells. This is the case
    // the whole file exists for.
    expect(multiclassSlots([c("cleric", 3), c("wizard", 3)])).toEqual([4, 3, 3]);
  });

  it("and a Fighter 5 / Wizard 3 the slots of a third-level one", () => {
    expect(multiclassSlots([c("fighter", 5), c("wizard", 3)])).toEqual([4, 2]);
  });

  it("gives nothing to a mix that cannot cast", () => {
    expect(multiclassSlots([c("fighter", 5), c("barbarian", 3)])).toEqual([]);
  });

  it("caps at twenty rather than running off the end of the table", () => {
    expect(multiclassSlots([c("wizard", 20), c("cleric", 20)]))
      .toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
  });
});

describe("pact magic, alongside", () => {
  it("is its own count and its own level", () => {
    expect(pactMagic([c("warlock", 5)])).toEqual({ count: 2, level: 3 });
    expect(pactMagic([c("warlock", 11)])).toEqual({ count: 3, level: 5 });
    expect(pactMagic([c("warlock", 1)])).toEqual({ count: 1, level: 1 });
  });

  it("and is absent when nobody took warlock", () => {
    expect(pactMagic([c("wizard", 5)])).toBe(null);
  });

  it("stacks beside the slots rather than into them", () => {
    const mix = [c("warlock", 3), c("sorcerer", 3)];
    expect(multiclassSlots(mix)).toEqual([4, 2]);
    expect(pactMagic(mix)).toEqual({ count: 2, level: 2 });
  });
});

describe("hit dice, as a pool", () => {
  const dieFor = (id: string) =>
    (({ fighter: 10, warlock: 8, wizard: 6 }) as Record<string, number>)[id] as never;

  it("keeps each class's own die", () => {
    expect(hitDicePool([c("fighter", 5), c("warlock", 3)], dieFor)).toEqual([
      { die: 10, count: 5 },
      { die: 8, count: 3 },
    ]);
  });

  it("merges classes that share one", () => {
    const same = (id: string) => (id === "x" || id === "y" ? 8 : undefined) as never;
    expect(hitDicePool([c("x", 2), c("y", 3)], same)).toEqual([{ die: 8, count: 5 }]);
  });
});

describe("whether a class will have you", () => {
  it("blocks on the class you are joining", () => {
    expect(multiclassBlock({ from: [c("fighter", 5)], into: "wizard", abilities: scores({ str: 15 }) }))
      .toContain("Wizard needs Intelligence 13");
  });

  it("and on the one you are leaving, which people forget", () => {
    // Both halves of the rule. A Strength 10 fighter cannot dip anywhere.
    const why = multiclassBlock({
      from: [c("fighter", 5)], into: "wizard", abilities: scores({ int: 16 }),
    });
    expect(why).toContain("Fighter needs Strength or Dexterity 13");
  });

  it("lets it through when both are met", () => {
    expect(multiclassBlock({
      from: [c("fighter", 5)], into: "wizard", abilities: scores({ str: 15, int: 14 }),
    })).toBe(null);
  });

  it("takes either where the class takes either", () => {
    expect(multiclassBlock({
      from: [], into: "fighter", abilities: scores({ dex: 13 }),
    })).toBe(null);
  });

  it("and never blocks on a class it has no rule for", () => {
    // A homebrew class is the table's business, not the app's.
    expect(multiclassBlock({ from: [], into: "warden-of-the-deep", abilities: scores() }))
      .toBe(null);
  });
});

describe("whether any of this applies", () => {
  it("is only true of more than one class", () => {
    expect(isMulticlass([c("wizard", 5)])).toBe(false);
    expect(isMulticlass([c("wizard", 5), c("cleric", 1)])).toBe(true);
    // A class at zero levels is a class you do not have.
    expect(isMulticlass([c("wizard", 5), c("cleric", 0)])).toBe(false);
  });
});
