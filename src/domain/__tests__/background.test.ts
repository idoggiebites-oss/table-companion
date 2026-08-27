/*
 * What a background gives you — which is not a choice between the two.
 */
import { describe, expect, it } from "vitest";
import { describeGrants, grantsOf, picksIn } from "../background.js";

const trait = (text: string) => [{ name: "Description", text }];

describe("reading the book's own line", () => {
  it("two languages, no tools — an acolyte", () => {
    const g = grantsOf(trait("• Languages: Two of your choice\n\t• Equipment: A holy symbol"));
    expect(g.languages).toBe(2);
    expect(g.tools).toEqual([]);
    expect(g.toolChoices).toEqual([]);
    expect(picksIn(g)).toBe(2);
  });

  it("two tools, no languages — a criminal", () => {
    const g = grantsOf(trait(
      "• Tool Proficiencies: One type of gaming set, thieves' tools\n\t• Equipment: A crowbar",
    ));
    expect(g.languages).toBe(0);
    expect(g.tools).toEqual(["thieves' tools"]);
    expect(g.toolChoices).toEqual([{ of: "gaming set", count: 1 }]);
    // One decision, not two: the thieves' tools are simply given.
    expect(picksIn(g)).toBe(1);
  });

  it("one of each — a guild artisan", () => {
    const g = grantsOf(trait(
      "• Tool Proficiencies: One type of artisan's tools\n\t• Languages: One of your choice",
    ));
    expect(g.languages).toBe(1);
    expect(g.toolChoices).toEqual([{ of: "artisan's tools", count: 1 }]);
  });

  it("a set and a fixed one — a soldier", () => {
    const g = grantsOf(trait("• Tool Proficiencies: One type of gaming set, vehicles (land)"));
    expect(g.tools).toEqual(["vehicles (land)"]);
    expect(g.toolChoices).toEqual([{ of: "gaming set", count: 1 }]);
  });

  it("and keeps the book's words, for when the reading looks thin", () => {
    const g = grantsOf(trait("• Languages: Two of your choice"));
    expect(g.said.languages).toBe("Two of your choice");
  });
});

describe("what it does not do", () => {
  it("invents nothing when a background says nothing", () => {
    expect(picksIn(grantsOf(trait("• Equipment: A set of clothes")))).toBe(0);
  });

  it("keeps a named language rather than dropping it", () => {
    // A wrong name on a sheet is visible; a missing choice is not.
    const g = grantsOf(trait("• Languages: Elvish and one of your choice"));
    expect(g.languages).toBe(1);
    expect(g.namedLanguages).toEqual(["Elvish"]);
  });
});

describe("saying it in one sentence", () => {
  const of = (text: string, name: string) => describeGrants(grantsOf(trait(text)), name);

  it("a criminal, whose grant is two tools and no verb of its own", () => {
    // Assembled out of JSX fragments this read "Criminal thieves' tools,
    // plus a gaming set of your choice" — a list with no sentence around it.
    expect(of("• Tool Proficiencies: One type of gaming set, thieves' tools", "Criminal"))
      .toBe("Criminal gives you thieves' tools and a gaming set of your choice.");
  });

  it("an acolyte, whose grant is only languages", () => {
    expect(of("• Languages: Two of your choice", "Acolyte"))
      .toBe("Acolyte gives you two languages.");
  });

  it("a guild artisan, who gets one of each — and an 'an'", () => {
    expect(of(
      "• Tool Proficiencies: One type of artisan's tools\n\t• Languages: One of your choice",
      "Guild Artisan",
    )).toBe("Guild Artisan gives you a language and an artisan's tools of your choice.");
  });

  it("and a background that says nothing says so", () => {
    expect(of("• Equipment: A set of clothes", "Wanderer"))
      .toBe("Wanderer says nothing about languages or tools.");
  });
});
