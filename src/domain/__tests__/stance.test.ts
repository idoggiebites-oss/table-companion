import { describe, expect, it } from "vitest";
import { combine, describeReasons, describeStance, stanceFor } from "../stance.js";

const who = (name: string, conditions: string[] = [], tags: string[] = []) =>
  ({ name, conditions, tags }) as never;
const at = (attacker: never, target: never, range: "melee" | "ranged" = "melee") =>
  stanceFor({ attacker, target, range });

describe("what the app can see about a roll", () => {
  it("is a straight d20 when there is nothing to say", () => {
    const { stance, reasons } = at(who("you"), who("the goblin"));
    expect(stance).toBe("straight");
    expect(reasons).toEqual([]);
  });

  it("gives advantage on a target that cannot defend itself", () => {
    const { stance, reasons } = at(who("you"), who("the goblin", ["paralyzed"]));
    expect(stance).toBe("advantage");
    expect(reasons[0]?.because).toBe("the goblin is paralyzed");
  });

  it("reads prone both ways, which is the one people get wrong", () => {
    expect(at(who("you"), who("the goblin", ["prone"]), "melee").stance).toBe("advantage");
    expect(at(who("you"), who("the goblin", ["prone"]), "ranged").stance).toBe("disadvantage");
  });

  it("punishes the attacker for their own conditions", () => {
    expect(at(who("you", ["frightened"]), who("the goblin")).stance).toBe("disadvantage");
    expect(at(who("you", ["prone"]), who("the goblin")).stance).toBe("disadvantage");
  });

  it("knows what people did on their turns", () => {
    expect(at(who("you", [], ["helped"]), who("the goblin")).stance).toBe("advantage");
    expect(at(who("you"), who("the goblin", [], ["dodging"])).stance).toBe("disadvantage");
    expect(at(who("you", [], ["hidden"]), who("the goblin")).stance).toBe("advantage");
  });

  it("cannot see what it cannot see", () => {
    // Reach, cover and line of sight need positions, and the positions are on
    // the table. The DM says those out loud.
    const { reasons } = at(who("you"), who("the goblin"));
    expect(reasons).toEqual([]);
  });
});

describe("the rule nobody believes the first time", () => {
  it("cancels any number of each to a straight roll", () => {
    // Three advantages and one disadvantage is one d20, not "mostly good".
    const { stance } = at(
      who("you", ["prone"], ["helped", "hidden"]),
      who("the goblin", ["restrained", "prone"]),
    );
    expect(stance).toBe("straight");
  });

  it("says so, rather than quietly dropping the losing half", () => {
    const { stance, reasons } = at(who("you", ["poisoned"]), who("the goblin", ["stunned"]));
    expect(stance).toBe("straight");
    expect(describeReasons(stance, reasons)).toBe(
      "the goblin is stunned — but you are poisoned. They cancel.",
    );
  });

  it("combines nothing into a straight roll", () => {
    expect(combine([])).toBe("straight");
  });
});

describe("what it tells you to do", () => {
  it("says it in dice, not in jargon", () => {
    expect(describeStance("advantage")).toBe("Roll two d20s and take the higher");
    expect(describeStance("disadvantage")).toBe("Roll two d20s and take the lower");
    expect(describeStance("straight")).toBe("Roll a d20");
  });

  it("names every source, because that is the teaching", () => {
    const { stance, reasons } = at(who("you", [], ["helped"]), who("the goblin", ["restrained"]));
    expect(describeReasons(stance, reasons)).toBe(
      "Advantage: the goblin is restrained, someone is helping you",
    );
  });

  it("has nothing to say when there is nothing to say", () => {
    expect(describeReasons("straight", [])).toBe(null);
  });
});

describe("how much light there is", () => {
  const seeing = (dv: number, sun = false) =>
    ({ name: "you", conditions: [], tags: [],
       senses: { darkvision: dv, sunlightSensitivity: sun,
                 blindsight: 0, tremorsense: 0, truesight: 0 } }) as never;

  it("changes nothing until the DM says it does", () => {
    expect(at(who("you"), who("the goblin")).stance).toBe("straight");
  });

  it("costs ordinary eyes their roll in the dark", () => {
    const { stance, reasons } = stanceFor({
      attacker: who("you"), target: who("the goblin"), range: "melee", light: "dark",
    });
    expect(stance).toBe("disadvantage");
    expect(reasons[0]?.because).toBe("you cannot see in the dark");
  });

  it("and dim light too", () => {
    expect(stanceFor({
      attacker: who("you"), target: who("the goblin"), range: "melee", light: "dim",
    }).stance).toBe("disadvantage");
  });

  it("but a dwarf reads dim light as bright", () => {
    // The whole reason senses are tracked: two people in one corridor rolling
    // differently, and neither having to remember which.
    expect(stanceFor({
      attacker: seeing(60), target: who("the goblin"), range: "melee", light: "dim",
    }).stance).toBe("straight");
  });

  it("while darkness is still only dim to them", () => {
    const { stance, reasons } = stanceFor({
      attacker: seeing(60), target: who("the goblin"), range: "melee", light: "dark",
    });
    expect(stance).toBe("disadvantage");
    expect(reasons[0]?.because).toContain("you see 60 ft");
  });

  it("and a drow is the one who suffers in daylight", () => {
    expect(stanceFor({
      attacker: seeing(120, true), target: who("the goblin"), range: "melee", light: "bright",
    }).stance).toBe("disadvantage");
    // In the dark, that same drow is fine relative to everyone else.
    expect(stanceFor({
      attacker: seeing(120, true), target: who("the goblin"), range: "melee", light: "dim",
    }).stance).toBe("straight");
  });
});
