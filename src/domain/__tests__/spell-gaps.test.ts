/*
 * A spell record with holes in it.
 *
 * Content is device-local and never migrated: a compendium imported months
 * ago is read by today's code, and the field today's code reaches for may
 * simply not be there. Every one of these threw before — and a throw during
 * render is a black screen, not a missing line.
 */
import { describe, expect, it } from "vitest";
import { costOf, damageFor, damageTypeFrom, kindOf, resolveDice } from "../spellcast.js";
import { castableBy, isClassFeature } from "../spells.js";

const hollow = { name: "Half a Spell", level: 1 } as never;

describe("a spell missing the fields we read", () => {
  it("costs an action rather than throwing", () => {
    expect(costOf(undefined as never)).toBe("long");
  });

  it("asks for nothing when there is no text to read", () => {
    expect(kindOf(hollow)).toEqual({ kind: "none" });
  });

  it("has no damage rather than no screen", () => {
    expect(damageFor(hollow, { slotLevel: 1, characterLevel: 5 })).toBe(null);
  });

  it("survives an absent dice string and description", () => {
    expect(resolveDice(undefined as never, 3)).toBe("");
    expect(damageTypeFrom(undefined as never)).toBe("damage");
  });

  it("is castable by nobody rather than crashing the list", () => {
    expect(castableBy(hollow, "wizard")).toBe(false);
  });

  it("counts as a class feature when it has no school", () => {
    // This one ran over the whole book on every render of the Spells tab.
    expect(isClassFeature(hollow)).toBe(true);
    expect(isClassFeature({ name: undefined, school: undefined } as never)).toBe(true);
  });
});
