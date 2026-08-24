/*
 * What a character can see, read out of the traits the file already ships.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { describeSenses, hasSenses, sensesFrom } from "../senses.js";

const trait = (name: string, desc = "") => ({ name, desc });

describe("darkvision", () => {
  it("reads the range the trait states", () => {
    expect(sensesFrom([trait(
      "Darkvision",
      "You can see in dim light within 60 feet of you as if it were bright light.",
    )]).darkvision).toBe(60);
  });

  it("and the longer one where a race has it", () => {
    expect(sensesFrom([trait(
      "Superior Darkvision",
      "Your darkvision has a radius of 120 feet.",
    )]).darkvision).toBe(120);
  });

  it("falling back to the usual rather than to none", () => {
    // A trait that says "Darkvision" and nothing parseable still means the
    // character can see in the dark. Zero would be worse than sixty.
    expect(sensesFrom([trait("Darkvision")]).darkvision).toBe(60);
  });

  it("keeping the best where a race states two", () => {
    expect(sensesFrom([
      trait("Darkvision", "within 60 feet"),
      trait("Superior Darkvision", "radius of 120 feet"),
    ]).darkvision).toBe(120);
  });
});

describe("light that hurts", () => {
  it("is the same mechanic pointing the other way", () => {
    expect(sensesFrom([trait("Sunlight Sensitivity")]).sunlightSensitivity).toBe(true);
    expect(sensesFrom([trait("Light Sensitivity")]).sunlightSensitivity).toBe(true);
  });

  it("and most races have none of it", () => {
    expect(sensesFrom([trait("Fey Ancestry")]).sunlightSensitivity).toBe(false);
    expect(sensesFrom(undefined)).toEqual({
      darkvision: 0, sunlightSensitivity: false, blindsight: 0, tremorsense: 0, truesight: 0,
    });
  });
});

describe("saying it on a sheet", () => {
  it("reads the way a statblock prints it", () => {
    expect(describeSenses(sensesFrom([
      trait("Darkvision", "within 60 feet"), trait("Sunlight Sensitivity"),
    ]))).toBe("darkvision 60 ft · sunlight sensitivity");
  });

  it("and says nothing when there is nothing to say", () => {
    expect(hasSenses(sensesFrom([trait("Brave")]))).toBe(false);
    expect(describeSenses(sensesFrom([]))).toBe("");
  });
});

describe("against the shipped races", () => {
  const SHIPPED = "public/content/race.json";
  const has = fs.existsSync(SHIPPED);
  const load = () =>
    JSON.parse(fs.readFileSync(SHIPPED, "utf8")) as
      { name: string; traits?: { name: string; text: string }[] }[];

  it.skipIf(!has)("finds it on the half of them that have it", () => {
    const all = load();
    const seeing = all.filter((r) => sensesFrom(r.traits).darkvision > 0).length;
    expect(seeing).toBeGreaterThan(250);
    expect(seeing).toBeLessThan(all.length);
  });

  it.skipIf(!has)("at ranges the rulebook would recognise", () => {
    const ranges = new Set(
      load().map((r) => sensesFrom(r.traits).darkvision).filter((d) => d > 0),
    );
    // 60 and 120 are the two the game uses; anything else is a red flag.
    for (const r of ranges) expect([30, 60, 90, 120], `${r} ft`).toContain(r);
  });

  it.skipIf(!has)("and catches the drow both ways", () => {
    const drow = load().find((r) => /drow/i.test(r.name));
    if (!drow) return;
    const s = sensesFrom(drow.traits);
    expect(s.darkvision).toBe(120);
    expect(s.sunlightSensitivity).toBe(true);
  });
});
