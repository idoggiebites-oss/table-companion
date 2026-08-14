import { describe, expect, it } from "vitest";
import {
  canCast, castableBy, groupByLevel, isReady, levelLabel, preparedCount,
  slotsFor, sortSpells, toKnown, type KnownSpell, type SlotState,
} from "../spells.js";

const spell = (o: Partial<KnownSpell> & { id: string; name: string; level: number }): KnownSpell => ({
  school: "evocation", concentration: false, ritual: false, prepared: true, ...o,
});
const slots = (...pairs: [number, number, number][]): SlotState[] =>
  pairs.map(([level, max, left]) => ({ level, max, left }));

describe("what a spell costs", () => {
  it("names the level the way the book does", () => {
    expect(levelLabel(0)).toBe("Cantrip");
    expect(levelLabel(1)).toBe("1st level");
    expect(levelLabel(2)).toBe("2nd level");
    expect(levelLabel(3)).toBe("3rd level");
    expect(levelLabel(5)).toBe("5th level");
  });

  it("lets a spell go in a HIGHER slot — the forgotten option", () => {
    const magicMissile = spell({ id: "mm", name: "Magic Missile", level: 1 });
    expect(slotsFor(magicMissile, slots([1, 4, 0], [2, 3, 3], [3, 2, 1])).map((s) => s.level))
      .toEqual([2, 3]);
  });

  it("never offers a slot below the spell's level", () => {
    const fireball = spell({ id: "fb", name: "Fireball", level: 3 });
    expect(slotsFor(fireball, slots([1, 4, 4], [2, 3, 3])).length).toBe(0);
    expect(canCast(fireball, slots([1, 4, 4], [2, 3, 3]))).toBe(false);
  });

  it("costs a cantrip nothing, so it is always castable", () => {
    const firebolt = spell({ id: "fbolt", name: "Fire Bolt", level: 0 });
    expect(slotsFor(firebolt, [])).toEqual([]);
    expect(canCast(firebolt, [])).toBe(true);
  });

  it("will not cast an unprepared spell", () => {
    const s = spell({ id: "x", name: "Shield", level: 1, prepared: false });
    expect(isReady(s)).toBe(false);
    expect(canCast(s, slots([1, 4, 4]))).toBe(false);
  });

  it("but a cantrip needs no preparing", () => {
    expect(isReady(spell({ id: "c", name: "Light", level: 0, prepared: false }))).toBe(true);
  });
});

describe("which class can cast it", () => {
  const fireball = {
    id: "fireball", name: "Fireball", level: 3, school: "evocation",
    concentration: false, ritual: false,
    classes: ["sorcerer", "wizard", "cleric (light domain)", "fighter (eldritch knight)"],
  };

  it("matches the base class", () => {
    expect(castableBy(fireball, "wizard")).toBe(true);
    expect(castableBy(fireball, "druid")).toBe(false);
  });

  it("finds it through a subclass, which an exact match would hide", () => {
    // A Light cleric really does get Fireball, and the compendium says so only
    // as "cleric (light domain)".
    expect(castableBy(fireball, "cleric")).toBe(true);
    expect(castableBy(fireball, "fighter")).toBe(true);
  });

  it("does not match a class that merely starts the same way", () => {
    expect(castableBy({ ...fireball, classes: ["wizardry"] }, "wizard")).toBe(false);
  });
});

describe("the list as it reads", () => {
  const list = [
    spell({ id: "b", name: "Bless", level: 1 }),
    spell({ id: "l", name: "Light", level: 0 }),
    spell({ id: "a", name: "Aid", level: 2 }),
    spell({ id: "c", name: "Cure Wounds", level: 1, prepared: false }),
  ];

  it("puts cantrips first, then level, then name", () => {
    expect(sortSpells(list).map((s) => s.name)).toEqual(["Light", "Bless", "Cure Wounds", "Aid"]);
  });

  it("groups by level", () => {
    expect(groupByLevel(list).map((g) => [g.level, g.spells.length])).toEqual([[0, 1], [1, 2], [2, 1]]);
  });

  it("counts prepared without counting cantrips", () => {
    // Bless and Aid are prepared; Cure Wounds is not; Light is a cantrip.
    // Counting cantrips would give 3 and inflate a number people compare
    // against their class limit.
    expect(preparedCount(list)).toBe(2);
  });
});

describe("taking a spell from a compendium", () => {
  it("keeps what the sheet needs and drops the rest", () => {
    const known = toKnown({
      id: "bless", name: "Bless", level: 1, school: "enchantment",
      concentration: true, ritual: false, classes: ["cleric", "paladin"],
    });
    expect(known).toEqual({
      id: "bless", name: "Bless", level: 1, school: "enchantment",
      concentration: true, ritual: false, prepared: true,
    });
  });
});
