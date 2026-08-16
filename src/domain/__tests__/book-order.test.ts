/*
 * Reading order for a compendium that is mostly not the game.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { byBookOrder, nameMark } from "../spells.js";

const SHIPPED = "public/content/spell.json";
const sp = (name: string, level = 0) => ({ name, level });

describe("what the parentheses mean", () => {
  it("reads the marker off the name", () => {
    expect(nameMark("Acid Splash (Alt) (HB)")).toBe("Alt");
    expect(nameMark("Conducting Technique: Crash (Marcato)")).toBe("Marcato");
    expect(nameMark("Fireball")).toBe(null);
  });

  it("says nothing about a spell with no name to read", () => {
    expect(nameMark(undefined as never)).toBe(null);
  });
});

describe("the order a picker reads in", () => {
  it("puts the game's own spells first within a level", () => {
    const rows = [sp("Acid Burn (HB)"), sp("Fire Bolt"), sp("Acid Splash (Alt) (HB)"), sp("Light")];
    expect([...rows].sort(byBookOrder).map((s) => s.name)).toEqual([
      "Fire Bolt", "Light", "Acid Burn (HB)", "Acid Splash (Alt) (HB)",
    ]);
  });

  it("still leads with level, because every picker is capped", () => {
    // A cap on a badly ordered list is how the choice disappears entirely:
    // sorted by level, the first eighty entries were all cantrips.
    const rows = [sp("Bane", 1), sp("Zephyr Strike (HB)", 1), sp("Word of Radiance", 0)];
    expect([...rows].sort(byBookOrder).map((s) => s.name)).toEqual([
      "Word of Radiance", "Bane", "Zephyr Strike (HB)",
    ]);
  });

  it("falls back to the name, so the order is stable", () => {
    const rows = [sp("Shield"), sp("Bless"), sp("Aid")];
    expect([...rows].sort(byBookOrder).map((s) => s.name)).toEqual(["Aid", "Bless", "Shield"]);
  });
});

describe("the rule, against the file it was written for", () => {
  const has = fs.existsSync(SHIPPED);
  const load = () =>
    JSON.parse(fs.readFileSync(SHIPPED, "utf8")) as { name: string }[];

  it.skipIf(!has)("no spell from the game carries a parenthetical", () => {
    // The whole rule rests on this. If a real spell ever arrives with one in
    // its name, sorting it to the back is exactly the wrong answer.
    const core = [
      "Fireball", "Cure Wounds", "Fire Bolt", "Eldritch Blast", "Wish", "Haste",
      "Hunter's Mark", "Counterspell", "Magic Missile", "Shield", "Bless",
      "Mage Hand", "Prestidigitation", "Revivify", "Polymorph",
    ];
    const byName = new Map(load().map((s) => [s.name, s]));
    for (const name of core) {
      expect(byName.has(name), `${name} is in the file under its plain name`).toBe(true);
      expect(nameMark(name), name).toBe(null);
    }
  });

  it.skipIf(!has)("and most of the file is marked, which is the point", () => {
    const all = load();
    const marked = all.filter((s) => nameMark(s.name) !== null).length;
    expect(marked / all.length).toBeGreaterThan(0.5);
  });
});
