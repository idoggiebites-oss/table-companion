import { describe, expect, it } from "vitest";
import { makeEvent, type DomainEvent } from "../events.js";
import { levelsOwed, project } from "../project.js";
import { kira } from "./fixtures.js";

const add = makeEvent({ type: "characterAdded", character: kira });
const run = (...rest: DomainEvent[]) => project([add, ...rest]);
const k = (s: ReturnType<typeof project>) => s.characters.kira!;

describe("experience campaigns", () => {
  it("starts at nothing owed", () => {
    expect(levelsOwed(run(), "kira")).toBe(0);
  });

  it("owes a level once the threshold is crossed", () => {
    // Kira is level 8; level 9 is 48,000.
    const s = run(makeEvent({ type: "xpAwarded", who: ["kira"], amount: 48_000 }));
    expect(k(s).xp).toBe(48_000);
    expect(levelsOwed(s, "kira")).toBe(1);
  });

  it("owes nothing one XP short", () => {
    const s = run(makeEvent({ type: "xpAwarded", who: ["kira"], amount: 47_999 }));
    expect(levelsOwed(s, "kira")).toBe(0);
  });

  it("awards the whole party in one event", () => {
    const s = run(makeEvent({ type: "xpAwarded", who: ["kira"], amount: 250 }));
    expect(k(s).xp).toBe(250);
  });

  it("accumulates across awards", () => {
    const s = run(
      makeEvent({ type: "xpAwarded", who: ["kira"], amount: 40_000 }),
      makeEvent({ type: "xpAwarded", who: ["kira"], amount: 8_000 }),
    );
    expect(levelsOwed(s, "kira")).toBe(1);
  });
});

describe("milestone campaigns", () => {
  const milestone = makeEvent({ type: "progressionSet", mode: "milestone" });

  it("ignores experience entirely", () => {
    const s = run(milestone, makeEvent({ type: "xpAwarded", who: ["kira"], amount: 99_000 }));
    expect(levelsOwed(s, "kira")).toBe(0);
  });

  it("owes a level when the DM says so", () => {
    const s = run(milestone, makeEvent({ type: "levelAwarded", who: ["kira"] }));
    expect(levelsOwed(s, "kira")).toBe(1);
  });

  it("can owe several", () => {
    const s = run(
      milestone,
      makeEvent({ type: "levelAwarded", who: ["kira"] }),
      makeEvent({ type: "levelAwarded", who: ["kira"] }),
    );
    expect(levelsOwed(s, "kira")).toBe(2);
  });
});

describe("resolving a level", () => {
  const owed = makeEvent({ type: "xpAwarded", who: ["kira"], amount: 48_000 });
  const level = makeEvent({ type: "levelGained", who: "kira", classId: "ranger", hpGain: 8 });

  it("clears what was owed", () => {
    const s = run(owed, level);
    expect(levelsOwed(s, "kira")).toBe(0);
    expect(s.builds.kira?.totalLevel).toBe(9);
  });

  it("raises the maximum without healing", () => {
    const s = run(
      makeEvent({ type: "damageApplied", who: "kira", amount: 30 }),
      owed, level,
    );
    expect(s.builds.kira?.maxHp).toBe(60);
    expect(k(s).currentHp).toBe(22);
  });

  it("rewrites everything derived from proficiency, untouched by hand", () => {
    const before = run();
    const after = run(owed, level);
    expect(before.builds.kira?.proficiencyBonus).toBe(3);
    expect(after.builds.kira?.proficiencyBonus).toBe(4);
    // The eighteen skills and six saves all move with it.
    expect(before.builds.kira?.skillMods.stealth).toBe(7);
    expect(after.builds.kira?.skillMods.stealth).toBe(8);
    expect(after.builds.kira?.saveMods.dex).toBe(8);
    expect(after.builds.kira?.attacks[0]?.toHit).toBe(8);
    expect(after.builds.kira?.resources.find((r) => r.id === "hitDice")?.max).toBe(9);
  });

  it("is undone by reverting it, like anything else", () => {
    const s = project([add, owed, level, makeEvent({ type: "reverted", target: level.id })]);
    expect(s.builds.kira?.totalLevel).toBe(8);
    expect(levelsOwed(s, "kira")).toBe(1);
  });
});

describe("re-import through the log", () => {
  it("does not apply a level the new file already contains", () => {
    const level = makeEvent({ type: "levelGained", who: "kira", classId: "ranger", hpGain: 8 });
    const at9 = makeEvent({
      type: "characterAdded",
      character: {
        base: { ...kira.base, classes: [{ classId: "ranger", level: 9 }], maxHp: 60 },
        deltas: [],
      },
    });
    const s = project([add, level, at9]);
    expect(s.builds.kira?.totalLevel).toBe(9);
    expect(s.builds.kira?.maxHp).toBe(60);
  });

  it("keeps campaign state across a re-import", () => {
    const dmg = makeEvent({ type: "damageApplied", who: "kira", amount: 20 });
    const again = makeEvent({ type: "characterAdded", character: kira });
    const s = project([add, dmg, again]);
    expect(s.characters.kira?.currentHp).toBe(32);
  });
});
