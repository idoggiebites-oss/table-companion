/*
 * The half of a racial bonus the race does not decide for you.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { freeBonusFrom, freeSkillsFrom, grantsFeatFrom } from "../races.js";

const t = (name: string, desc: string) => ({ name, desc });

describe("points the race leaves to you", () => {
  it("reads the half-elf's two", () => {
    expect(freeBonusFrom([t(
      "Ability Score Increase",
      "Your Charisma score increases by 2. Two different ability scores of your choice increase by 1.",
    )])).toEqual({ count: 2, each: 1, distinct: true });
  });

  it("and the variant human's, which is all of them", () => {
    expect(freeBonusFrom([t(
      "Ability Score Increase",
      "Two different ability scores of your choice increase by 1.",
    )])).toEqual({ count: 2, each: 1, distinct: true });
  });

  it("but not a race that decides for you", () => {
    // The fixed half is already structural in the file; reading it here too
    // would count it twice.
    expect(freeBonusFrom([t(
      "Ability Score Increase",
      "Your Dexterity score increases by 2, and your Charisma score increases by 1.",
    )])).toBe(null);
  });

  it("and nothing at all where there is no such trait", () => {
    expect(freeBonusFrom([t("Brave", "You have advantage on saves against being frightened.")])).toBe(null);
    expect(freeBonusFrom(undefined)).toBe(null);
  });
});

describe("what else a race can hand over", () => {
  it("a skill of your choice", () => {
    expect(freeSkillsFrom([t("Skills", "You gain proficiency in one skill of your choice.")])).toBe(1);
    expect(freeSkillsFrom([t("Skill Versatility", "You gain proficiency in two skills of your choice.")])).toBe(2);
    expect(freeSkillsFrom([t("Brave", "…")])).toBe(0);
  });

  it("and a feat, which only two races do", () => {
    expect(grantsFeatFrom([t("Feat", "You gain one feat of your choice.")])).toBe(true);
    expect(grantsFeatFrom([t("Brave", "…")])).toBe(false);
  });
});

describe("against the shipped races", () => {
  const SHIPPED = "public/content/race.json";
  const has = fs.existsSync(SHIPPED);
  const load = () =>
    JSON.parse(fs.readFileSync(SHIPPED, "utf8")) as
      { name: string; abilityBonuses: Record<string, number>; traits?: { name: string; text: string }[] }[];

  it.skipIf(!has)("finds the half-elf and the variant human", () => {
    const all = load();
    const halfElf = all.find((r) => r.name === "Half-Elf");
    const variant = all.find((r) => r.name === "Human, Variant");
    expect(freeBonusFrom(halfElf?.traits)?.count).toBe(2);
    expect(freeBonusFrom(variant?.traits)?.count).toBe(2);
    expect(grantsFeatFrom(variant?.traits)).toBe(true);
  });

  it.skipIf(!has)("and does not think every race has free points", () => {
    const all = load();
    const free = all.filter((r) => freeBonusFrom(r.traits) !== null).length;
    expect(free).toBeGreaterThan(10);
    expect(free / all.length).toBeLessThan(0.5);
  });
});
