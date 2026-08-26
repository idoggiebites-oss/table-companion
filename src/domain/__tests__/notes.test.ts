/*
 * A player's own notes: in the log, and honest about who can read them.
 */
import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../events.js";
import { project } from "../project.js";
import { visibleInLog } from "../visibility.js";

let n = 0;
const ev = (by: string, b: object): DomainEvent =>
  ({ id: `e${++n}`, by, at: Date.now(), ...b }) as DomainEvent;

const kira = { kind: "player", characterId: "b1" } as const;
const bel = { kind: "player", characterId: "b2" } as const;
const dm = { kind: "dm" } as const;

describe("keeping notes", () => {
  it("holds the last save whole, because a note is edited not appended", () => {
    const s = project([
      ev("b1", { type: "notesSaved", who: "b1", text: "The innkeeper lied." }),
      ev("b1", { type: "notesSaved", who: "b1", text: "The innkeeper lied. Ask Bel." }),
    ]);
    expect(s.notes.b1).toBe("The innkeeper lied. Ask Bel.");
  });

  it("one per character", () => {
    const s = project([
      ev("b1", { type: "notesSaved", who: "b1", text: "mine" }),
      ev("b2", { type: "notesSaved", who: "b2", text: "hers" }),
    ]);
    expect(s.notes).toEqual({ b1: "mine", b2: "hers" });
  });

  it("and can be taken back like anything else", () => {
    const first = ev("b1", { type: "notesSaved", who: "b1", text: "one" });
    const second = ev("b1", { type: "notesSaved", who: "b1", text: "two" });
    const s = project([first, second, ev("b1", { type: "reverted", target: second.id })]);
    expect(s.notes.b1).toBe("one");
  });
});

describe("who sees a note happen", () => {
  const wrote = ev("b1", { type: "notesSaved", who: "b1", text: "secret" });

  it("the person who wrote it", () => {
    expect(visibleInLog(wrote, kira)).toBe(true);
  });

  it("not the player at the other end of the table", () => {
    expect(visibleInLog(wrote, bel)).toBe(false);
  });

  it("and the DM, whose device replays everything anyway", () => {
    // Saying otherwise would be a promise the architecture cannot keep, so
    // the app tells the player instead of pretending.
    expect(visibleInLog(wrote, dm)).toBe(true);
  });
});
