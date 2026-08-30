/*
 * A spell whose data carries no dice, which is the common case rather than
 * the exotic one: the compendium a real table imports has 317 spells and not
 * one <roll> element, and 76 of the bundled spells state dice in prose and
 * carry none. Where that happened the caster was asked for an attack roll,
 * never asked for damage, and the DM got a claim reading "0 damage".
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { damageFor, rollsFromText } from "./spellcast.js";

const FIRE_BOLT_TEXT =
  "You hurl a mote of fire at a creature or object within range. Make a ranged " +
  "spell attack against the target. On a hit, the target takes 1d10 fire damage. " +
  "A flammable object hit by this spell ignites if it isn't being worn or carried.\n" +
  "This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th " +
  "level (3d10), and 17th level (4d10).";

const spell = (over: Partial<Parameters<typeof damageFor>[0]> = {}) => ({
  name: "Fire Bolt", level: 0, time: "1 action", text: FIRE_BOLT_TEXT, rolls: [],
  ...over,
}) as Parameters<typeof damageFor>[0];

describe("dice read from a spell's own text", () => {
  it("finds the base damage and its type", () => {
    const r = rollsFromText(FIRE_BOLT_TEXT, 0);
    expect(r[0]).toEqual({ description: "Fire Damage", level: 0, dice: "1d10" });
  });

  it("reads a cantrip's upgrade table, which scales on the CASTER's level", () => {
    expect(rollsFromText(FIRE_BOLT_TEXT, 0).map((x) => [x.level, x.dice])).toEqual([
      [0, "1d10"], [5, "2d10"], [11, "3d10"], [17, "4d10"],
    ]);
  });

  it("gives a level-1 caster 1d10 and a level-11 caster 3d10", () => {
    const at = (lvl: number) =>
      damageFor(spell(), { slotLevel: 1, characterLevel: lvl })?.dice;
    expect(at(1)).toBe("1d10");
    expect(at(5)).toBe("2d10");
    expect(at(11)).toBe("3d10");
  });

  it("names the damage type, so a claim never reads the generic word", () => {
    expect(damageFor(spell(), { slotLevel: 1, characterLevel: 1 })?.description)
      .toBe("Fire Damage");
  });

  it("does not override dice the file actually states", () => {
    const stated = spell({
      rolls: [{ description: "Cold Damage", level: 0, dice: "9d99" }],
    });
    expect(damageFor(stated, { slotLevel: 1, characterLevel: 1 })?.dice).toBe("9d99");
  });

  it("stays silent where the prose states no dice at all", () => {
    expect(rollsFromText("You touch a creature and it is blessed.", 0)).toEqual([]);
    expect(damageFor(spell({ text: "Nothing to roll here." }),
      { slotLevel: 1, characterLevel: 1 })).toBeNull();
  });

  it("a levelled spell takes its base line and does not invent slot scaling", () => {
    const fireball = spell({
      name: "Fireball", level: 3,
      text: "each creature takes 8d6 fire damage on a failed save. " +
        "the damage increases by 1d6 for each slot level above 3rd.",
    });
    expect(damageFor(fireball, { slotLevel: 5, characterLevel: 9 })?.dice).toBe("8d6");
  });

  /*
   * The dangerous direction. The prose is full of dice that are not damage,
   * and offering a player healing dice to hurt somebody with is worse than
   * offering nothing — so the pattern is anchored to the word "damage" and
   * these are the cases that would break if that anchor were loosened.
   */
  it.each([
    ["Cure Wounds", "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier."],
    ["False Life", "you gain 1d4 + 4 temporary hit points for the duration."],
    ["Control Weather", "It takes 1d4 x 10 minutes for the new conditions to take effect."],
    ["Aura of Vitality", "one creature in the aura can regain 2d6 hit points."],
  ])("offers nothing for %s, whose dice are not damage", (_name, text) => {
    expect(rollsFromText(text, 1)).toEqual([]);
  });

  it.each([
    ["Vampiric Touch", "The target takes 3d6 necrotic damage, and you regain hit points equal to half the amount", "3d6", "Necrotic Damage"],
    ["Chromatic Orb", "the creature takes 3d8 damage of the type you chose.", "3d8", "Damage"],
    ["Disintegrate", "the target takes 10d6 + 40 force damage.", "10d6", "Force Damage"],
  ])("reads %s as %s", (_n, text, dice, description) => {
    expect(rollsFromText(text, 1)[0]).toEqual({ dice, description });
  });

  it("recovers most bundled spells when their dice are stripped, as an import does", () => {
    const spells = JSON.parse(readFileSync("public/content/spell.json", "utf8"));
    let stated = 0, recovered = 0;
    for (const s of spells) {
      if (!/\b\d+d\d+\b/.test(s.text ?? "")) continue;
      const at = { slotLevel: Math.max(1, s.level), characterLevel: 5 };
      if (damageFor(s, at)) stated++;
      if (damageFor({ ...s, rolls: [] }, at)) recovered++;
    }
    /* Measured, not hoped for: of 1322 bundled spells whose prose mentions
       dice, 1280 have usable rolls in the data and 1074 can be recovered from
       the prose alone — 84%. The shortfall is spells whose dice are healing,
       temporary hit points, durations or statblock tables, which this is
       right to refuse. Asserted as a ratio so a content update moves it
       without breaking the claim. */
    expect(stated).toBeGreaterThan(1200);
    expect(recovered).toBeGreaterThan(stated * 0.8);
  });
});
