/*
 * The events behind the fight's new memory, through the projection — because
 * "build = imported base + replayed deltas" means a feature that is not in
 * the projection is a feature that vanishes on reload.
 */
import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../events.js";
import { project } from "../project.js";
import { kiraSample } from "../../ui/sample.js";

let n = 0;
const ev = (body: object): DomainEvent =>
  ({ id: `e${++n}`, by: "dm", at: Date.now(), ...body }) as DomainEvent;

function fighting() {
  const kira = kiraSample();
  const joined = ev({ type: "characterAdded", character: kira });
  const ids = [kira.base.id];
  const log = [
    joined,
    ev({
      type: "combatStarted",
      order: [
        {
          id: "pc", name: "Kira", initiative: 20,
          source: { kind: "character", characterId: ids[0] },
          controller: { kind: "player", characterId: ids[0] }, disclosure: "exact",
        },
        {
          id: "gob", name: "Goblin", initiative: 5,
          source: { kind: "creature", maxHp: 12, statblockId: "goblin" },
          controller: { kind: "dm" }, disclosure: "exact",
        },
      ],
    }),
  ];
  return { log, ids };
}

describe("a creature's conditions", () => {
  it("go on and come off", () => {
    const { log } = fighting();
    const on = project([...log, ev({ type: "creatureConditionAdded", combatantId: "gob", condition: "prone" })]);
    expect(on.combat?.creatureConditions.gob).toEqual(["prone"]);
    const off = project([
      ...log,
      ev({ type: "creatureConditionAdded", combatantId: "gob", condition: "prone" }),
      ev({ type: "creatureConditionRemoved", combatantId: "gob", condition: "prone" }),
    ]);
    expect(off.combat?.creatureConditions.gob).toEqual([]);
  });

  it("cannot be applied twice", () => {
    const { log } = fighting();
    const s = project([
      ...log,
      ev({ type: "creatureConditionAdded", combatantId: "gob", condition: "prone" }),
      ev({ type: "creatureConditionAdded", combatantId: "gob", condition: "prone" }),
    ]);
    expect(s.combat?.creatureConditions.gob).toEqual(["prone"]);
  });
});

describe("a reaction the DM offered", () => {
  it("waits for the people it names", () => {
    const { log } = fighting();
    const s = project([
      ...log,
      ev({ type: "reactionOffered", to: ["pc"], because: "it is leaving your reach", from: "Goblin" }),
    ]);
    expect(s.combat?.offer?.to).toEqual(["pc"]);
  });

  it("is over once everyone asked has let it go", () => {
    const { log } = fighting();
    const s = project([
      ...log,
      ev({ type: "reactionOffered", to: ["pc"], because: "leaving", from: "Goblin" }),
      ev({ type: "reactionDeclined", combatantId: "pc" }),
    ]);
    expect(s.combat?.offer).toBe(null);
  });

  it("stays up while somebody else is still deciding", () => {
    const { log } = fighting();
    const s = project([
      ...log,
      ev({ type: "reactionOffered", to: ["pc", "other"], because: "leaving", from: "Goblin" }),
      ev({ type: "reactionDeclined", combatantId: "pc" }),
    ]);
    expect(s.combat?.offer?.declined).toEqual(["pc"]);
  });
});

describe("a shove", () => {
  it("carries the half of the contest the app knows", () => {
    const { log } = fighting();
    const s = project([
      ...log,
      ev({
        type: "shoveClaimed", combatantId: "pc", byName: "Kira",
        targetId: "gob", targetName: "Goblin", total: 17,
      }),
    ]);
    expect(s.combat?.shove?.total).toBe(17);
  });

  it("puts the thing on its back when the DM says it went over", () => {
    // The point of the whole feature: shove, prone, and the next attack says
    // "advantage" without anyone looking anything up.
    const { log } = fighting();
    const s = project([
      ...log,
      ev({
        type: "shoveClaimed", combatantId: "pc", byName: "Kira",
        targetId: "gob", targetName: "Goblin", total: 17,
      }),
      ev({ type: "shoveResolved", prone: true }),
    ]);
    expect(s.combat?.creatureConditions.gob).toEqual(["prone"]);
    expect(s.combat?.shove).toBe(null);
  });

  it("leaves it standing otherwise", () => {
    const { log } = fighting();
    const s = project([
      ...log,
      ev({
        type: "shoveClaimed", combatantId: "pc", byName: "Kira",
        targetId: "gob", targetName: "Goblin", total: 4,
      }),
      ev({ type: "shoveResolved", prone: false }),
    ]);
    expect(s.combat?.creatureConditions.gob ?? []).toEqual([]);
    expect(s.combat?.shove).toBe(null);
  });
});

describe("what people are holding", () => {
  it("is on the fight, not in one player's memory", () => {
    const { log } = fighting();
    const s = project([
      ...log,
      ev({ type: "actionReadied", combatantId: "pc", trigger: "when it opens the door" }),
    ]);
    expect(s.combat?.readied.pc).toBe("when it opens the door");
  });

  it("clears when it fires", () => {
    const { log } = fighting();
    const s = project([
      ...log,
      ev({ type: "actionReadied", combatantId: "pc", trigger: "when it opens the door" }),
      ev({ type: "readiedActionCleared", combatantId: "pc" }),
    ]);
    expect(s.combat?.readied.pc).toBeUndefined();
  });
});
