import { describe, expect, it } from "vitest";
import { describeRoll, diceNeeded, resolveRoll } from "../roll.js";

describe("how many dice a mode asks for", () => {
  it("is one normally and two either way round", () => {
    expect(diceNeeded("normal")).toBe(1);
    expect(diceNeeded("advantage")).toBe(2);
    expect(diceNeeded("disadvantage")).toBe(2);
  });
});

describe("normal", () => {
  it("adds the modifier", () => {
    expect(resolveRoll([14], "normal", 6).total).toBe(20);
  });

  it("handles a negative modifier", () => {
    const r = resolveRoll([9], "normal", -1);
    expect(r.total).toBe(8);
    expect(describeRoll("Stealth", r)).toBe("Stealth 8 · 9 − 1");
  });
});

describe("advantage keeps the right one so nobody has to", () => {
  it("keeps the higher die and reports the dropped one", () => {
    const r = resolveRoll([7, 18], "advantage", 6);
    expect(r.kept).toBe(18);
    expect(r.dropped).toBe(7);
    expect(r.total).toBe(24);
  });

  it("keeps the higher regardless of the order they were tapped", () => {
    expect(resolveRoll([18, 7], "advantage", 0).kept).toBe(18);
    expect(resolveRoll([7, 18], "advantage", 0).kept).toBe(18);
  });
});

describe("disadvantage", () => {
  it("keeps the lower die", () => {
    const r = resolveRoll([7, 18], "disadvantage", 6);
    expect(r.kept).toBe(7);
    expect(r.dropped).toBe(18);
    expect(r.total).toBe(13);
  });
});

describe("naturals count on the kept die only", () => {
  it("flags a natural 20 that survived", () => {
    expect(resolveRoll([20, 3], "advantage", 5).natural).toBe("twenty");
  });

  it("does not flag a natural 20 that was dropped", () => {
    expect(resolveRoll([20, 3], "disadvantage", 5).natural).toBeNull();
  });

  it("flags a natural 1 that survived disadvantage", () => {
    expect(resolveRoll([1, 19], "disadvantage", 5).natural).toBe("one");
  });

  it("does not flag a natural 1 that advantage discarded", () => {
    expect(resolveRoll([1, 19], "advantage", 5).natural).toBeNull();
  });
});

describe("refuses impossible input rather than guessing", () => {
  it("rejects the wrong number of dice", () => {
    expect(() => resolveRoll([5], "advantage", 0)).toThrow();
    expect(() => resolveRoll([5, 6], "normal", 0)).toThrow();
  });

  it("rejects results a d20 cannot produce", () => {
    expect(() => resolveRoll([0], "normal", 0)).toThrow();
    expect(() => resolveRoll([21], "normal", 0)).toThrow();
    expect(() => resolveRoll([3.5], "normal", 0)).toThrow();
  });
});

describe("the feed line", () => {
  it("names the dropped die and the natural", () => {
    const r = resolveRoll([20, 4], "advantage", 7);
    expect(describeRoll("Perception", r)).toBe(
      "Perception 27 · 20 + 7 (4 dropped) · natural 20",
    );
  });
});
