/*
 * Spells a race hands you, which the app showed as prose and never granted.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { hasInnate, innateAt, innateFrom } from "../innate.js";

const t = (name: string, desc: string) => ({ name, desc });

describe("what a race gives you", () => {
  it("reads a cantrip known from the start", () => {
    expect(innateFrom([t("Infernal Legacy", "You know the Thaumaturgy cantrip.")]).spells)
      .toEqual([{ name: "Thaumaturgy", level: 1, from: "Infernal Legacy" }]);
  });

  it("and the ones that arrive later, at the level they arrive", () => {
    // A drow trait names two spells at two levels in one paragraph.
    const drow = innateFrom([t(
      "Drow Magic",
      "You know the dancing lights cantrip. When you reach 3rd level, you can cast the "
        + "faerie fire spell once per day. When you reach 5th level, you can also cast the "
        + "darkness spell once per day.",
    )]);
    expect(drow.spells.map((s) => `${s.name} @${s.level}`)).toEqual([
      "dancing lights @1", "faerie fire @3", "darkness @5",
    ]);
  });

  it("holding back the ones they have not earned", () => {
    const drow = innateFrom([t(
      "Drow Magic",
      "You know the dancing lights cantrip. When you reach 3rd level, you can cast the "
        + "faerie fire spell once per day.",
    )]);
    expect(innateAt(drow, 1).map((s) => s.name)).toEqual(["dancing lights"]);
    expect(innateAt(drow, 3).map((s) => s.name)).toEqual(["dancing lights", "faerie fire"]);
  });
});

describe("a race that asks rather than grants", () => {
  it("is reported as a choice, not picked for you", () => {
    const elf = innateFrom([t(
      "Cantrip",
      "You know one cantrip of your choice from the wizard spell list.",
    )]);
    expect(elf.spells).toEqual([]);
    expect(elf.choices).toEqual([{ count: 1, list: "wizard", from: "Cantrip" }]);
  });
});

describe("a race with no magic at all", () => {
  it("gets nothing, and says nothing", () => {
    expect(hasInnate(innateFrom([t("Brave", "You have advantage on saves against fear.")])))
      .toBe(false);
    expect(hasInnate(innateFrom(undefined))).toBe(false);
  });
});

describe("against the shipped races", () => {
  const SHIPPED = "public/content/race.json";
  const has = fs.existsSync(SHIPPED);
  const load = () =>
    JSON.parse(fs.readFileSync(SHIPPED, "utf8")) as
      { name: string; traits?: { name: string; text: string }[] }[];

  it.skipIf(!has)("finds it on the quarter of them that have it", () => {
    const all = load();
    const casters = all.filter((r) => hasInnate(innateFrom(r.traits))).length;
    expect(casters).toBeGreaterThan(100);
    expect(casters / all.length).toBeLessThan(0.4);
  });

  it.skipIf(!has)("and gets the two everybody knows right", () => {
    const all = load();
    const drow = all.find((r) => /drow/i.test(r.name));
    const tiefling = all.find((r) => r.name === "Tiefling");
    if (drow) {
      const names = innateFrom(drow.traits).spells.map((s) => s.name.toLowerCase());
      expect(names).toContain("dancing lights");
      expect(names).toContain("faerie fire");
    }
    if (tiefling) {
      expect(innateFrom(tiefling.traits).spells.map((s) => s.name.toLowerCase()))
        .toContain("thaumaturgy");
    }
  });

  it.skipIf(!has)("without inventing levels the rules do not use", () => {
    for (const r of load()) {
      for (const s of innateFrom(r.traits).spells) {
        expect(s.level, `${r.name}: ${s.name}`).toBeGreaterThanOrEqual(1);
        expect(s.level, `${r.name}: ${s.name}`).toBeLessThanOrEqual(20);
      }
    }
  });
});
