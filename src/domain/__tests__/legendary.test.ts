import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  lairAction, legendaryBudget, legendaryLeft, legendaryOptions, mayTakeLegendary,
} from "../legendary.js";

const compendium = () => {
  const j = JSON.parse(readFileSync("public/content/monster.json", "utf8"));
  return (Array.isArray(j) ? j : Object.values(j).find(Array.isArray)) as {
    name: string;
  }[];
};
const find = (name: string) => compendium().find((m) => m.name === name) as never;

describe("reading legendary actions off a statblock", () => {
  /* The compendium files the options, the budget heading, pages of lair
     description and regional effects all under `legendary`. Most of the work
     is telling those apart. */
  it("reads the budget out of the heading", () => {
    expect(legendaryBudget(find("Adult Black Dragon"))).toBe(3);
    expect(legendaryBudget(find("Lich"))).toBe(4);
  });

  /* Some books put the whole sentence in the heading instead, and some say
     "1 legendary ACTION" in the singular — a plural-only pattern reads that
     as none, which is a creature silently losing its legendary actions. */
  it("and out of a sentence when that is where it is", () => {
    expect(legendaryBudget(find("Mammon"))).toBe(3);
    expect(legendaryBudget(find("Death Tyrant"))).toBe(1);
  });

  it("keeps the options and drops the prose", () => {
    const o = legendaryOptions(find("Adult Black Dragon")).map((x) => x.name);
    expect(o).toEqual(["Detect", "Tail Attack", "Wing Attack"]);
    // Not "A Black Dragon's Lair", "Regional Effects", "Black Dragon Treasures".
    expect(o.some((n) => /lair|regional|treasure/i.test(n))).toBe(false);
  });

  it("reads what each one costs, however it is printed", () => {
    const dragon = legendaryOptions(find("Adult Black Dragon"));
    expect(dragon.find((o) => o.name === "Wing Attack")?.cost).toBe(2);
    // "(3 actions)" without the word "Costs" means the same thing.
    expect(legendaryOptions(find("Mammon")).find((o) => o.name === "Deep Pockets")?.cost)
      .toBe(3);
  });

  it("finds the lair action and the count it fires on", () => {
    expect(lairAction(find("Adult Black Dragon"))?.at).toBe(20);
    // A creature with no lair described gets none invented for it.
    expect(lairAction(find("Goblin"))).toBeNull();
  });
});

describe("spending them", () => {
  it("counts down and floors at nothing", () => {
    expect(legendaryLeft(3, undefined)).toBe(3);
    expect(legendaryLeft(3, 2)).toBe(1);
    expect(legendaryLeft(3, 9)).toBe(0);
  });

  /* The mistake this feature is most likely to cause: a dragon that legendary
     acts on its own turn is taking four actions instead of one. */
  it("never on their own turn", () => {
    expect(mayTakeLegendary({ budget: 3, spent: 0, isTheirTurn: true })).toBe(false);
    expect(mayTakeLegendary({ budget: 3, spent: 0, isTheirTurn: false })).toBe(true);
  });

  it("and not one they cannot afford", () => {
    expect(mayTakeLegendary({ budget: 3, spent: 2, isTheirTurn: false, cost: 2 })).toBe(false);
    expect(mayTakeLegendary({ budget: 3, spent: 1, isTheirTurn: false, cost: 2 })).toBe(true);
  });
});
