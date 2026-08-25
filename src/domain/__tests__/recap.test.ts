/*
 * The log read forwards.
 */
import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../events.js";
import {
  andList, isEmpty, recapOf, sessions, SESSION_GAP_MS, whenWas,
} from "../recap.js";

const HOUR = 3_600_000;
const T0 = new Date("2026-08-20T19:00:00Z").getTime();

let n = 0;
const ev = (at: number, b: object): DomainEvent =>
  ({ id: `e${++n}`, by: "dm", at, ...b }) as DomainEvent;

const NAMES: Record<string, string> = { b1: "Kira", b2: "Bel", b3: "Sam" };
const nameOf = (id: string) => NAMES[id] ?? id;

describe("where one session ends", () => {
  it("keeps a night that runs past midnight together", () => {
    const s = sessions([
      ev(T0, { type: "combatBegan" }),
      ev(T0 + 5 * HOUR, { type: "combatBegan" }),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]?.events).toHaveLength(2);
  });

  it("and splits a week later", () => {
    const s = sessions([
      ev(T0, { type: "combatBegan" }),
      ev(T0 + 7 * 24 * HOUR, { type: "combatBegan" }),
    ]);
    expect(s).toHaveLength(2);
  });

  it("splitting on the gap itself, not on a clock", () => {
    // 3am to 10am is one gap; the calendar day changing is not.
    const s = sessions([
      ev(T0, { type: "combatBegan" }),
      ev(T0 + SESSION_GAP_MS + 1, { type: "combatBegan" }),
    ]);
    expect(s).toHaveLength(2);
  });

  it("puts them oldest first, whatever order the log arrived in", () => {
    const s = sessions([
      ev(T0 + 7 * 24 * HOUR, { type: "combatBegan" }),
      ev(T0, { type: "combatEnded" }),
    ]);
    expect(s.map((x) => x.startedAt)).toEqual([T0, T0 + 7 * 24 * HOUR]);
  });
});

describe("what a session reads as", () => {
  const at = (i: number) => T0 + i * 60_000;
  const recap = recapOf(
    sessions([
      ev(at(0), { type: "sceneSet", scene: { light: "dark", terrain: ["difficult"] } }),
      ev(at(1), { type: "combatBegan" }),
      ev(at(2), { type: "damageApplied", who: "b1", amount: 7 }),
      ev(at(3), { type: "damageApplied", who: "b1", amount: 19 }),
      ev(at(4), { type: "damageApplied", who: "b2", amount: 4 }),
      ev(at(5), { type: "healingApplied", who: "b1", amount: 10 }),
      ev(at(6), { type: "deathSaveRecorded", who: "b1", result: "failure" }),
      ev(at(7), { type: "deathSaveRecorded", who: "b1", result: "success" }),
      ev(at(8), { type: "combatEnded" }),
      ev(at(9), { type: "combatBegan" }),
      ev(at(10), {
        type: "diceRolled", who: "b2", label: "Perception",
        mode: "straight", dice: [20], modifier: 4,
      }),
      ev(at(11), {
        type: "spellCast", who: "b2", spellId: "s1", name: "Hunter's Mark",
        atLevel: 1, concentration: true,
      }),
      ev(at(12), {
        type: "spellCast", who: "b2", spellId: "s1", name: "Hunter's Mark",
        atLevel: 1, concentration: true,
      }),
      ev(at(13), { type: "lootGranted", to: { kind: "party" }, items: [], coins: 340 }),
      ev(at(14), { type: "levelGained", who: "b1", classId: "ranger", hpGain: 6 }),
      ev(at(15), { type: "longRestTaken", who: ["b1", "b2"] }),
    ])[0]!,
    nameOf,
  );
  const said = recap.lines.join(" ");

  it("opens with where they were", () => {
    expect(recap.lines[0]).toBe("You fought in dark, difficult ground.");
  });

  it("counts the fights in words", () => {
    // "2 fights" reads like a spreadsheet; a table says "two fights".
    expect(said).toContain("Two fights.");
  });

  it("names who went down", () => {
    expect(said).toContain("Kira went down");
  });

  it("and does not bury anybody who got up", () => {
    // One failed save is not a death. Three are.
    expect(said).not.toContain("did not get back up");
  });

  it("remembers the worst hit and who took it", () => {
    expect(said).toContain("landed on Kira, for 19");
  });

  it("the spell that got leaned on", () => {
    expect(said).toContain("Hunter's Mark got cast 2 times");
  });

  it("the levels", () => {
    expect(said).toContain("Kira levelled.");
  });

  it("what they came away with", () => {
    expect(said).toContain("340 copper");
  });

  it("and the natural twenty, because the app never rolled it", () => {
    expect(said).toContain("one natural twenty, thrown by Bel");
  });

  it("with the numbers worth a glance kept out of the prose", () => {
    const strip = Object.fromEntries(recap.counts.map((c) => [c.label, c.value]));
    expect(strip).toMatchObject({
      Fights: "2",
      "Damage taken": "30",
      Healed: "10",
      "Spells cast": "2",
      Rests: "1 long",
    });
  });
});

describe("three failures", () => {
  it("is a death, and the recap says so", () => {
    const recap = recapOf(
      sessions([
        ev(T0, { type: "deathSaveRecorded", who: "b3", result: "failure" }),
        ev(T0 + 1000, { type: "deathSaveRecorded", who: "b3", result: "fumble" }),
        ev(T0 + 2000, { type: "deathSaveRecorded", who: "b3", result: "failure" }),
      ])[0]!,
      nameOf,
    );
    expect(recap.lines.join(" ")).toContain("Sam did not get back up");
  });
});

describe("a session where nothing happened", () => {
  it("has nothing to say, and says nothing", () => {
    // Opening the app is not a session. A recap card that renders an empty
    // box every week teaches the table to stop looking at it.
    const recap = recapOf(
      sessions([ev(T0, { type: "turnAdvanced" })])[0]!,
      nameOf,
    );
    expect(isEmpty(recap)).toBe(true);
  });
});

describe("a player's recap is built from a player's log", () => {
  it("so prep cannot leak into it sideways", () => {
    // The filtering is the caller's (visibleInLog); what is proved here is
    // that nothing is read from anywhere else.
    const recap = recapOf(
      sessions([ev(T0, { type: "combatBegan" })])[0]!,
      nameOf,
    );
    expect(recap.lines.join(" ")).toBe("One fight.");
  });
});

describe("when it was", () => {
  const day = 86_400_000;
  const now = new Date("2026-08-25T21:00:00Z").getTime();
  it("says it the way a table does", () => {
    expect(whenWas(now, now)).toBe("today");
    expect(whenWas(now - day, now)).toBe("yesterday");
    expect(whenWas(now - 3 * day, now)).toBe("3 days ago");
    expect(whenWas(now - 9 * day, now)).toBe("last week");
    expect(whenWas(now - 21 * day, now)).toBe("3 weeks ago");
    expect(whenWas(now - 90 * day, now)).toBe("3 months ago");
  });
});

describe("lists that read aloud", () => {
  it("one, two, and three", () => {
    expect(andList(["Kira"])).toBe("Kira");
    expect(andList(["Kira", "Bel"])).toBe("Kira and Bel");
    expect(andList(["Kira", "Bel", "Sam"])).toBe("Kira, Bel and Sam");
    expect(andList([])).toBe("");
  });
});
