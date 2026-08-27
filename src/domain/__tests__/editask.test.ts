import { describe, expect, it } from "vitest";
import { grantToSpend, isPending, mayRebuild, pendingFor, type EditAsk } from "../editask.js";

const ask = (over: Partial<EditAsk> = {}): EditAsk => ({
  id: "a1", who: "kira" as never, whoName: "Kira", at: 1, ...over,
});

/* The rule this exists to hold: a player cannot re-roll alone, and being
   allowed once is not being allowed. */
describe("asking to re-roll", () => {
  it("an unanswered ask opens nothing", () => {
    expect(mayRebuild([ask()], "kira" as never)).toBe(false);
    expect(isPending(ask())).toBe(true);
  });

  it("a refusal opens nothing either", () => {
    expect(mayRebuild([ask({ granted: false })], "kira" as never)).toBe(false);
  });

  it("the DM's yes is what opens it", () => {
    expect(mayRebuild([ask({ granted: true })], "kira" as never)).toBe(true);
  });

  /* A grant is spent by using it — otherwise one yes is a standing licence. */
  it("and using it closes it again", () => {
    expect(mayRebuild([ask({ granted: true, used: true })], "kira" as never)).toBe(false);
  });

  it("does not open the door for somebody else", () => {
    expect(mayRebuild([ask({ granted: true })], "bram" as never)).toBe(false);
  });

  /* Two grants in one evening are two rebuilds, spent oldest first, so they
     queue in the order the DM said yes. */
  it("spends the oldest open grant first", () => {
    const asks = [
      ask({ id: "a1", granted: true, used: true }),
      ask({ id: "a2", granted: true }),
      ask({ id: "a3", granted: true }),
    ];
    expect(grantToSpend(asks, "kira" as never)?.id).toBe("a2");
  });

  it("shows the DM only what is unanswered", () => {
    const asks = [ask({ id: "a1", granted: true }), ask({ id: "a2" }), ask({ id: "a3", granted: false })];
    expect(pendingFor(asks).map((a) => a.id)).toEqual(["a2"]);
  });
});
