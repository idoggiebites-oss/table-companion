import { describe, expect, it } from "vitest";
import { actionsCosting, blockedBecause, STANDARD_ACTIONS } from "../actions.js";

const spent = (o: Partial<Record<"action" | "bonus" | "reaction", boolean>> = {}) => ({
  action: false, bonus: false, reaction: false, ...o,
});

describe("the menu", () => {
  it("has the ones nobody discovers on their own", () => {
    const names = STANDARD_ACTIONS.map((a) => a.id);
    for (const id of ["dodge", "disengage", "hide", "help", "shove", "ready"]) {
      expect(names).toContain(id);
    }
  });

  it("splits by what it costs", () => {
    expect(actionsCosting("action").length).toBeGreaterThan(5);
    expect(actionsCosting("bonus").map((a) => a.id)).toContain("offhand");
  });

  it("explains every one of them", () => {
    // A menu entry with no sentence is a rules reference, which is the thing
    // this exists instead of.
    for (const a of STANDARD_ACTIONS) {
      expect(a.what.length).toBeGreaterThan(20);
      expect(a.what.endsWith(".")).toBe(true);
    }
  });
});

describe("why something cannot be taken", () => {
  it("says so rather than just greying out", () => {
    expect(blockedBecause(STANDARD_ACTIONS[1]!, spent({ action: true }), true))
      .toBe("Your action is gone this turn.");
  });

  it("names the right pip for a bonus action", () => {
    const offhand = STANDARD_ACTIONS.find((a) => a.id === "offhand")!;
    expect(blockedBecause(offhand, spent({ bonus: true }), true)).toBe("Your bonus is gone this turn.");
  });

  it("tells an empty-handed character where to fix it", () => {
    const attack = STANDARD_ACTIONS.find((a) => a.id === "attack")!;
    expect(blockedBecause(attack, spent(), false)).toMatch(/equip a weapon/i);
  });

  it("allows what is allowed", () => {
    expect(blockedBecause(STANDARD_ACTIONS[1]!, spent(), true)).toBe(null);
  });

  it("does not require a weapon for the ones that need none", () => {
    const dodge = STANDARD_ACTIONS.find((a) => a.id === "dodge")!;
    expect(blockedBecause(dodge, spent(), false)).toBe(null);
  });
});
