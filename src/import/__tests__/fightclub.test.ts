// @vitest-environment happy-dom
/**
 * The adapter's contract is that it never guesses silently. Every one of these
 * tests is really asking the same question: when the file doesn't say, does
 * the result admit it?
 */

import { describe, expect, it } from "vitest";
import { effectiveBuild } from "../../domain/build.js";
import { ImportError, parseFightClubXml } from "../fightclub.js";

const kira = `<?xml version="1.0" encoding="UTF-8"?>
<character>
  <name>Kira Vance</name>
  <hpMax>52</hpMax>
  <xp>47800</xp>
  <abilities>10, 18, 14, 11, 16, 12</abilities>
  <race>
    <name>Wood Elf</name>
    <mod>dexterity +2</mod>
    <mod>wisdom +1</mod>
    <proficiency>Perception</proficiency>
  </race>
  <class>
    <name>Ranger</name>
    <level>8</level>
    <proficiency>Strength, Dexterity</proficiency>
    <proficiency>Stealth, Survival, Nature</proficiency>
    <feat><name>Colossus Slayer</name></feat>
  </class>
  <background>
    <name>Outlander</name>
    <proficiency>Athletics</proficiency>
  </background>
</character>`;

const issue = (r: ReturnType<typeof parseFightClubXml>, field: string) =>
  r.issues.find((i) => i.field === field);

describe("a complete-looking export", () => {
  const r = parseFightClubXml(kira, "kira");

  it("reads identity and hit points", () => {
    expect(r.base.name).toBe("Kira Vance");
    expect(r.base.race).toBe("Wood Elf");
    expect(r.base.maxHp).toBe(52);
    expect(r.base.source).toBe("fightclub");
  });

  it("reads the class and level", () => {
    expect(r.base.classes).toEqual([{ classId: "ranger", level: 8 }]);
  });

  it("splits the comma-separated ability string in order", () => {
    expect(r.base.abilities).toEqual({ str: 10, dex: 18, con: 14, int: 11, wis: 16, cha: 12 });
  });

  it("derives the hit die from the class, since no export carries it", () => {
    expect(r.base.hitDie).toBe(10);
  });

  it("tells saving throws from skills, which the format does not distinguish", () => {
    expect([...r.base.saveProficiencies].sort()).toEqual(["dex", "str"]);
    expect([...r.base.skillProficiencies].sort()).toEqual([
      "athletics", "nature", "perception", "stealth", "survival",
    ]);
  });

  it("collects proficiencies from race, class and background alike", () => {
    // perception came from race, stealth from class, athletics from background
    expect(r.base.skillProficiencies).toContain("perception");
    expect(r.base.skillProficiencies).toContain("stealth");
    expect(r.base.skillProficiencies).toContain("athletics");
  });

  it("produces a build the rest of the app can use unchanged", () => {
    const b = effectiveBuild({ base: r.base, deltas: [] });
    expect(b.proficiencyBonus).toBe(3);
    expect(b.skillMods.stealth).toBe(7);
    expect(b.saveMods.dex).toBe(7);
    expect(b.resources.find((x) => x.id === "hitDice")?.max).toBe(8);
  });
});

describe("what the format does not carry is reported, never invented", () => {
  const r = parseFightClubXml(kira, "kira");

  it("flags armour class and speed as defaults", () => {
    expect(issue(r, "armourClass")?.kind).toBe("missing");
    expect(issue(r, "speed")?.kind).toBe("missing");
    expect(r.base.armourClass).toBe(10);
    expect(r.base.speed).toBe(30);
  });

  it("flags missing spell slots for a caster", () => {
    expect(issue(r, "spellSlots")?.detail).toMatch(/enter slots by hand/i);
    expect(r.base.spellSlots).toEqual([]);
  });

  it("does not silently apply racial modifiers it cannot place", () => {
    // Applying them blind would be wrong by two whenever the export already had.
    expect(r.base.abilities.dex).toBe(18);
    expect(issue(r, "abilities")?.detail).toMatch(/NOT added/);
  });

  it("says nothing about spell slots for a non-caster", () => {
    const fighter = parseFightClubXml(
      kira.replace("<name>Ranger</name>", "<name>Fighter</name>"),
    );
    expect(issue(fighter, "spellSlots")).toBeUndefined();
  });
});

describe("tolerating files that disagree with the assumed shape", () => {
  it("accepts a character wrapped in a compendium root", () => {
    const wrapped = `<compendium version="5">${kira.replace(/<\?xml.*?\?>/, "")}</compendium>`;
    expect(parseFightClubXml(wrapped).base.name).toBe("Kira Vance");
  });

  it("reports rather than throws when scores are unreadable", () => {
    const r = parseFightClubXml(kira.replace("10, 18, 14, 11, 16, 12", "not, scores"));
    expect(r.base.abilities.str).toBe(10);
    expect(issue(r, "abilities")?.kind).toBe("missing");
  });

  it("skips a class it does not recognise and says so", () => {
    const r = parseFightClubXml(kira.replace("<name>Ranger</name>", "<name>Artificer</name>"));
    expect(issue(r, "class")?.detail).toMatch(/Artificer/);
    expect(r.base.classes).toEqual([{ classId: "fighter", level: 1 }]);
  });

  it("keeps unmapped proficiencies visible instead of dropping them quietly", () => {
    const r = parseFightClubXml(
      kira.replace("<proficiency>Athletics</proficiency>", "<proficiency>Athletics, Thieves' Tools</proficiency>"),
    );
    expect(issue(r, "proficiencies")?.detail).toMatch(/Thieves' Tools/);
    expect(r.base.skillProficiencies).toContain("athletics");
  });

  it("handles multiclass entries", () => {
    const multi = kira.replace(
      "</class>",
      "</class><class><name>Rogue</name><level>2</level></class>",
    );
    const r = parseFightClubXml(multi);
    expect(r.base.classes).toEqual([
      { classId: "ranger", level: 8 },
      { classId: "rogue", level: 2 },
    ]);
    expect(effectiveBuild({ base: r.base, deltas: [] }).totalLevel).toBe(10);
  });

  it("refuses a compendium with no character in it", () => {
    expect(() => parseFightClubXml("<compendium><monster/></compendium>")).toThrow(ImportError);
  });

  it("refuses something that is not XML at all", () => {
    expect(() => parseFightClubXml("this is a PDF, honestly")).toThrow(ImportError);
  });
});
