import { describe, expect, it } from "vitest";
import { mergeById } from "../content.js";

describe("merging two sources of the same thing", () => {
  it("takes what the import states", () => {
    const out = mergeById([{ id: "a", name: "Old", cost: 1 }], [{ id: "a", name: "New", cost: 2 }]);
    expect(out).toEqual([{ id: "a", name: "New", cost: 2 }]);
  });

  it("keeps what the import is silent about", () => {
    // The SRD compendium carries no <roll> elements, so importing it over a
    // complete one used to strip the damage dice off every spell.
    const out = mergeById(
      [{ id: "fire-bolt", name: "Fire Bolt", rolls: [{ dice: "1d10" }] }],
      [{ id: "fire-bolt", name: "Fire Bolt", rolls: [] }],
    );
    expect(out[0]!.rolls).toEqual([{ dice: "1d10" }]);
  });

  it("treats an empty string the same way", () => {
    const out = mergeById([{ id: "a", school: "evocation" }], [{ id: "a", school: "" }]);
    expect(out[0]!.school).toBe("evocation");
  });

  it("still lets a real value overwrite a real value", () => {
    const out = mergeById([{ id: "a", cost: 1500 }], [{ id: "a", cost: 2500 }]);
    expect(out[0]!.cost).toBe(2500);
  });

  it("adds what only the import has", () => {
    const out = mergeById([{ id: "a" }], [{ id: "b" }]);
    expect(out.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("leaves the base alone when there is nothing to merge", () => {
    expect(mergeById([{ id: "a" }], [])).toEqual([{ id: "a" }]);
  });
});
