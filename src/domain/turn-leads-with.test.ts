/*
 * A caster's turn led with their weapon: "Attack with Quarterstaff" as the
 * biggest thing on a wizard's screen, with the cantrip a tap further behind a
 * question labelled "What else can I do?".
 *
 * Both directions are tested, because a rule that only ever answers one way is
 * not a rule — and the ranger is the half that keeps this honest.
 */
import { describe, it, expect } from "vitest";
import { leadsWithSpell } from "./spellcast.js";

describe("what a turn leads with", () => {
  it("the wizard: quarterstaff +1, Fire Bolt +5 — the spell leads", () => {
    expect(leadsWithSpell(5, 1)).toBe(true);
  });

  it("the ranger: longbow +7, spell +5 — the bow leads", () => {
    expect(leadsWithSpell(5, 7)).toBe(false);
  });

  it("a caster with nothing in their hands still leads with the spell", () => {
    expect(leadsWithSpell(5, null)).toBe(true);
  });

  it("a fighter is never offered one", () => {
    expect(leadsWithSpell(null, 7)).toBe(false);
    expect(leadsWithSpell(null, null)).toBe(false);
  });

  it("a tie goes to the weapon, rather than moving a screen already learnt", () => {
    expect(leadsWithSpell(5, 5)).toBe(false);
  });
});
