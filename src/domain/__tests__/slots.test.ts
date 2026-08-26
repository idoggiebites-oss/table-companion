/*
 * What is worn where — a reading, not a rules system.
 */
import { describe, expect, it } from "vitest";
import type { Item } from "../items.js";
import { rarityOf, slotFor, worn } from "../slots.js";

const item = (over: Partial<Item> & { name: string }): Item =>
  ({ id: over.name.toLowerCase().replace(/\W+/g, "-"), category: "adventuring-gear", cost: 0, ...over });

const longbow = item({ name: "Longbow", category: "weapon", damage: "1d8" });
const shortsword = item({ name: "Shortsword", category: "weapon", damage: "1d6" });
const dagger = item({ name: "Dagger", category: "weapon", damage: "1d4" });
const leather = item({ name: "Studded leather", category: "armor", armorCategory: "Light", baseAc: 12 });
const shield = item({ name: "Shield", category: "armor", armorCategory: "Shield", baseAc: 2 });
const cloak = item({ name: "Cloak of Protection", magic: true, detail: "uncommon" });
const rope = item({ name: "Rope, hempen (50 feet)", weight: 10 });

describe("where a thing goes", () => {
  it("armour on the body, a shield in the off hand", () => {
    expect(slotFor(leather)).toBe("body");
    expect(slotFor(shield)).toBe("off");
  });

  it("the first weapon in the main hand, the second in the other", () => {
    expect(slotFor(longbow)).toBe("main");
    expect(slotFor(shortsword, new Set(["main"]))).toBe("off");
  });

  it("and a third weapon nowhere, rather than displacing one", () => {
    expect(slotFor(dagger, new Set(["main", "off"]))).toBe(null);
  });

  it("reads the rest off the name, because the catalogue does not say", () => {
    // A Cloak of Protection is filed as adventuring gear, like a coil of rope.
    expect(slotFor(cloak)).toBe("cloak");
    expect(slotFor(item({ name: "Helm of Comprehending Languages" }))).toBe("head");
    expect(slotFor(item({ name: "Belt of Giant Strength" }))).toBe("belt");
    expect(slotFor(rope)).toBe(null);
  });
});

describe("the figure, filled in", () => {
  it("puts each thing in its place", () => {
    const { slots } = worn([longbow, leather, cloak]);
    expect(slots.main?.name).toBe("Longbow");
    expect(slots.body?.name).toBe("Studded leather");
    expect(slots.cloak?.name).toBe("Cloak of Protection");
    expect(slots.head).toBe(null);
  });

  it("keeps what will not fit rather than dropping it", () => {
    // A ring is equipped and real. It just has no place in a six-slot
    // picture, and pretending it is a belt would be a lie about the sheet.
    const ring = item({ name: "Ring of Swimming", magic: true });
    const { slots, elsewhere } = worn([longbow, ring]);
    expect(slots.main?.name).toBe("Longbow");
    expect(elsewhere.map((i) => i.name)).toEqual(["Ring of Swimming"]);
  });

  it("does not let a second shield take the first one's place", () => {
    const { slots, elsewhere } = worn([shield, shield]);
    expect(slots.off?.name).toBe("Shield");
    expect(elsewhere).toHaveLength(1);
  });

  it("a sword and a shield fill both hands, in that order", () => {
    const { slots } = worn([shortsword, shield]);
    expect(slots.main?.name).toBe("Shortsword");
    expect(slots.off?.name).toBe("Shield");
  });
});

describe("rarity", () => {
  it("comes off the detail the compendium files it under", () => {
    expect(rarityOf(cloak)).toBe("uncommon");
    expect(rarityOf(item({ name: "Holy Avenger", detail: "legendary" }))).toBe("legendary");
  });

  it("reads the longer word first", () => {
    // "very rare" contains "rare", and the shorter match would demote it.
    expect(rarityOf(item({ name: "Staff of Power", detail: "very rare" }))).toBe("very rare");
  });

  it("or off the name, which is where half of them keep it", () => {
    expect(rarityOf(item({ name: "Bag of Holding (Uncommon)" }))).toBe("uncommon");
  });

  it("and is nothing at all for ordinary kit", () => {
    expect(rarityOf(longbow)).toBe(null);
    expect(rarityOf(rope)).toBe(null);
  });
});
