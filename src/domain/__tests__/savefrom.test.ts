import { describe, expect, it } from "vitest";
import { describeSave, saveFromAction } from "../savefrom.js";

const act = (desc: string, name = "Breath") => ({ name, desc });

describe("reading a save off a monster's action", () => {
  it("reads the dragon's own words", () => {
    const s = saveFromAction(act(
      "The dragon exhales acid in a 60-foot line that is 5 feet wide. Each creature in that line must make a DC 18 Dexterity saving throw, taking 54 (12d8) acid damage on a failed save, or half as much damage on a successful one.",
    ));
    expect(s).toEqual({ ability: "dex", dc: 18, half: true, dice: "12d8", damageType: "acid", average: 54 });
  });

  /* A success that AVOIDS it is different from one that halves it, and the
     books say so in different words. Defaulting to "half" would take hit
     points off somebody who should have kept them. */
  it("does not invent half damage", () => {
    const s = saveFromAction(act(
      "Each creature must make a DC 13 Constitution saving throw, taking 10 (3d6) psychic damage on a failed save.",
    ));
    expect(s?.half).toBe(false);
  });

  it("reads a save with no damage at all", () => {
    const s = saveFromAction(act(
      "Each creature must succeed on a DC 11 Wisdom saving throw or become frightened.",
    ));
    expect(s?.ability).toBe("wis");
    expect(s?.dc).toBe(11);
    expect(s?.dice).toBeUndefined();
  });

  /* An attack roll is not a save. Reading one as the other would replace the
     swing walkthrough with a question nobody asked. */
  it("is silent about an ordinary attack", () => {
    expect(saveFromAction(act(
      "Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage.",
    ))).toBeNull();
  });

  it("and about prose that merely mentions a saving throw", () => {
    expect(saveFromAction(act(
      "The creature has advantage on saving throws against spells.",
    ))).toBeNull();
  });

  it("says the sentence a DM would read out", () => {
    const s = saveFromAction(act(
      "Each creature must make a DC 18 Dexterity saving throw, taking 54 (12d8) acid damage on a failed save, or half as much damage on a successful one.",
      "Acid Breath",
    ))!;
    expect(describeSave(s, "Acid Breath"))
      .toBe("Acid Breath: DC 18 DEX, 54 (12d8) acid, half on a save.");
  });
});
