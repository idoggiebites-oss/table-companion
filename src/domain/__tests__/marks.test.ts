/*
 * One question asked the same way of every list: did this come from outside
 * the game?
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { isAxis, isCore, nameMarks, sourceMark } from "../marks.js";

describe("where something came from", () => {
  it("reads the provenance marker", () => {
    expect(sourceMark("Zephyr Strike (HB)")).toBe("HB");
    expect(sourceMark("Kor (Zendikar)")).toBe("Zendikar");
    expect(sourceMark("Fireball")).toBe(null);
  });

  it("does not mistake a choice for a source", () => {
    // Feats are the only list where this happens, and it happens 331 times.
    expect(sourceMark("Resilient (Constitution)")).toBe(null);
    expect(isAxis("Fire")).toBe(true);
    expect(isAxis("HB")).toBe(false);
  });

  it("reads both when a name carries two", () => {
    expect(nameMarks("Aereni Halflife (Wisdom) (TP)")).toEqual(["Wisdom", "TP"]);
    expect(sourceMark("Aereni Halflife (Wisdom) (TP)")).toBe("TP");
  });

  it("calls the game's own core", () => {
    expect(isCore("Elf")).toBe(true);
    expect(isCore("Elf (Drow) (HB)")).toBe(false);
  });
});

describe("against the files the switch exists for", () => {
  const has = (k: string) => fs.existsSync(`public/content/${k}.json`);
  const load = (k: string) =>
    JSON.parse(fs.readFileSync(`public/content/${k}.json`, "utf8")) as { name: string }[];

  it.skipIf(!has("race"))("hides most of every list, which is the point", () => {
    for (const [kind, floor] of [["race", 0.6], ["feat", 0.6], ["spell", 0.5]] as const) {
      const all = load(kind);
      const marked = all.filter((x) => !isCore(x.name)).length;
      expect(marked / all.length, kind).toBeGreaterThan(floor);
    }
  });

  it.skipIf(!has("race"))("and leaves the things people came for", () => {
    // The compendium names them "Elf, Wood" rather than "Wood Elf".
    const races = load("race").filter((r) => isCore(r.name)).map((r) => r.name);
    for (const want of ["Elf, Wood", "Elf, High", "Dwarf, Hill", "Human", "Dragonborn"]) {
      expect(races, want).toContain(want);
    }
    // Small enough to read rather than search.
    expect(races.length).toBeLessThan(140);
  });
});

describe("parentheses that are not a source", () => {
  it("never reads a rarity as provenance", () => {
    /*
     * The trap this exists for: 1,499 magic items are named "(Rare)",
     * "(Very Rare)", "(Legendary)". Pointing the switch at equipment without
     * this would hide every magic item in the game — and it would look
     * exactly like the switch working.
     */
    for (const r of ["Rare", "Very Rare", "Uncommon", "Legendary", "Common", "Artifact"]) {
      expect(sourceMark(`Bag of Holding (${r})`), r).toBe(null);
    }
  });

  it("but still reads a real source beside one", () => {
    expect(sourceMark("Blade of Wonder (Rare) (HB)")).toBe("HB");
  });
});
