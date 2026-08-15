import { describe, expect, it } from "vitest";
import { deriveClass, splitProficiency, type CompendiumClassLike } from "../classes-from-compendium.js";

const fighter: CompendiumClassLike = {
  id: "fighter", name: "Fighter", hitDie: 10, numSkills: 2,
  armor: "Light Armor, Medium Armor, Heavy Armor, Shields",
  weapons: "Simple Weapons, Martial Weapons",
  tools: "None",
  wealth: "5d4x10",
  spellAbility: "Intelligence",
  proficiency:
    "Strength, Constitution, Acrobatics, Animal Handling, Athletics, History, " +
    "Insight, Intimidation, Perception, Survival",
  slots: [],
};

describe("reading the one proficiency line", () => {
  it("takes the leading ability names as saving throws", () => {
    // Checked against the SRD entry for the same class, which says str/con.
    expect(splitProficiency(fighter.proficiency).saves).toEqual(["str", "con"]);
  });

  it("and everything after as the skills to choose from", () => {
    const { skills } = splitProficiency(fighter.proficiency);
    expect(skills).toHaveLength(8);
    expect(skills).toContain("Animal Handling");
    expect(skills).not.toContain("Strength");
  });

  it("sets aside anything the sheet cannot score", () => {
    // A tool proficiency in the same list must not become a skill choice.
    const { skills, other } = splitProficiency("Dexterity, Stealth, Thieves' Tools");
    expect(skills).toEqual(["Stealth"]);
    expect(other).toEqual(["Thieves' Tools"]);
  });

  it("copes with an empty line", () => {
    expect(splitProficiency("")).toEqual({ saves: [], skills: [], other: [] });
  });

  it("does not repeat a save", () => {
    expect(splitProficiency("Strength, Strength, Athletics").saves).toEqual(["str"]);
  });
});

describe("the derived class", () => {
  const derived = deriveClass(fighter);

  it("matches what the builder needs", () => {
    expect(derived).toMatchObject({
      id: "fighter", name: "Fighter", hitDie: 10, saves: ["str", "con"],
      skillChoices: { choose: 2 },
    });
  });

  it("keeps armour and weapon proficiencies, dropping the literal None", () => {
    expect(derived.proficiencies).toContain("Heavy Armor");
    expect(derived.proficiencies).toContain("Martial Weapons");
    expect(derived.proficiencies).not.toContain("None");
  });

  it("has no starting kit, because a compendium carries none", () => {
    // Not an omission to paper over: wealth is the route that does exist.
    expect(derived.equipment).toEqual([]);
    expect(derived.equipmentChoices).toEqual([]);
  });

  it("is not a caster when it has no slots", () => {
    expect(derived.spellcasting).toBeUndefined();
  });

  it("is one when it has", () => {
    const wizard = deriveClass({
      ...fighter, id: "wizard", name: "Wizard", slots: [[2, 0], [3, 0]],
      spellAbility: "Intelligence",
    });
    expect(wizard.spellcasting).toMatchObject({ ability: "int", slots: [2] });
  });
});
