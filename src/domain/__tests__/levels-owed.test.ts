/*
 * Levels the DM has granted and the player has not taken yet.
 */
import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../events.js";
import { levelsOwed, project } from "../project.js";
import { kiraSample } from "../../ui/sample.js";

let n = 0;
const ev = (b: object): DomainEvent =>
  ({ id: `e${++n}`, by: "dm", at: Date.now(), ...b }) as DomainEvent;

const kira = () => {
  const c = kiraSample();
  return {
    id: c.base.id,
    log: [
      ev({ type: "characterAdded", character: c }),
      ev({ type: "progressionSet", progression: "milestone" }),
    ],
  };
};
const gain = (id: string) =>
  ev({ type: "levelGained", who: id, classId: "ranger", hpGain: 6 });

describe("a milestone campaign", () => {
  it("stacks the levels the DM gives out", () => {
    const { id, log } = kira();
    const s = project([...log, ev({ type: "levelAwarded", who: [id] }), ev({ type: "levelAwarded", who: [id] })]);
    expect(levelsOwed(s, id)).toBe(2);
  });

  it("keeps the rest when one is taken", () => {
    // This was the bug: award two at the end of a session, take one, and the
    // second was silently gone — with nothing on any screen to say so.
    const { id, log } = kira();
    const s = project([
      ...log,
      ev({ type: "levelAwarded", who: [id] }),
      ev({ type: "levelAwarded", who: [id] }),
      gain(id),
    ]);
    expect(levelsOwed(s, id)).toBe(1);
  });

  it("owes nothing once they are all taken", () => {
    const { id, log } = kira();
    const s = project([
      ...log,
      ev({ type: "levelAwarded", who: [id] }),
      ev({ type: "levelAwarded", who: [id] }),
      gain(id),
      gain(id),
    ]);
    expect(levelsOwed(s, id)).toBe(0);
  });

  it("and never goes negative for someone who levelled another way", () => {
    // An imported sheet, or a hand-edit, can put a character ahead of what
    // the DM has handed out. The milestone catches up rather than owing.
    const { id, log } = kira();
    const s = project([...log, gain(id)]);
    expect(levelsOwed(s, id)).toBe(0);
    expect(s.characters[id]?.milestoneLevel).toBe(s.builds[id]?.totalLevel);
  });
});
