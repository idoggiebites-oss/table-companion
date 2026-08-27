/*
 * Which book a subclass came from — the one thing no compendium says.
 */
import { describe, expect, it } from "vitest";
import { bookOf, byBook, exact, FILED, key } from "../books.js";
import { findChoices } from "../subclass.js";
import { isCore } from "../marks.js";

describe("placing a subclass", () => {
  it("puts the game's own where they belong", () => {
    expect(bookOf("Gloom Stalker")?.short).toBe("Xanathar's");
    expect(bookOf("Fey Wanderer")?.short).toBe("Tasha's");
    expect(bookOf("Drakewarden")?.short).toBe("Fizban's");
    expect(bookOf("Hunter")?.short).toBe("Player's Handbook");
  });

  it("files a reprint under the book that first printed it", () => {
    /*
     * Sun Soul is Sword Coast and Xanathar's; Order Domain is Ravnica and
     * Tasha's. "Where does this come from" does not change when a later book
     * reprints it.
     */
    expect(bookOf("Way of the Sun Soul")?.short).toBe("Sword Coast");
    expect(bookOf("Order Domain")?.short).toBe("Ravnica");
    expect(bookOf("College of Eloquence")?.short).toBe("Theros");
  });

  it("matches however the compendium spells it", () => {
    // Class words, articles and trailing markers all differ between files.
    expect(key("The Hexblade")).toBe(key("Hexblade"));
    expect(key("School of Evocation")).toBe(key("Evocation"));
    expect(key("Circle of Spores")).toBe(key("Spores"));
    expect(key("Grave Domain")).toBe(key("Grave"));
    expect(key("Gloom Stalker (UA)")).toBe(key("Gloom Stalker"));
  });

  it("and places nothing it was never told about", () => {
    // Critical Role's gunslinger and the Amonkhet domains are not in any of
    // the thirteen books, and pretending otherwise would be worse than a
    // heading that says so.
    expect(bookOf("Gunslinger")).toBe(null);
    expect(bookOf("Ambition Domain")).toBe(null);
  });
});

describe("grouping a list", () => {
  const opts = [
    { name: "Hunter" }, { name: "Gloom Stalker" }, { name: "Fey Wanderer" },
    { name: "Beast Master" }, { name: "Gunslinger" },
  ];

  it("is in publication order, not the order the file happened to list", () => {
    expect(byBook(opts).map(([book]) => book)).toEqual([
      "Player's Handbook", "Xanathar's", "Tasha's", "elsewhere",
    ]);
  });

  it("keeps what no book printed rather than dropping it", () => {
    expect(byBook(opts).at(-1)).toEqual(["elsewhere", [{ name: "Gunslinger" }]]);
  });
});

describe("the table itself", () => {
  it("covers every 2014 book that added a subclass", () => {
    const books = new Set(FILED.filter((f) => f.kind === "subclass").map((f) => f.book));
    expect(books.size).toBe(13);
  });

  it("and every one that added anything else", () => {
    // Nineteen books all told: the thirteen with subclasses, plus Volo's,
    // Mordenkainen's, Acquisitions, Strixhaven, Spelljammer and Planescape,
    // which added races, backgrounds or feats and no subclass at all.
    expect(new Set(FILED.map((f) => f.book)).size).toBe(19);
  });

  it("and files each name once", () => {
    const keys = FILED.map((f) => exact(f.name));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps two books apart when they name a subclass the same", () => {
    /*
     * A sorcerer's Wild Magic is the Player's Handbook; a barbarian's Path of
     * Wild Magic is Tasha's. Matching loosely enough to catch "Evocation" for
     * "School of Evocation" collapses those two into one key, and one of them
     * ends up filed under the other's book.
     */
    expect(bookOf("Wild Magic")?.short).toBe("Player's Handbook");
    expect(bookOf("Path of Wild Magic")?.short).toBe("Tasha's");
  });
});

describe("the marker survives long enough to be read", () => {
  it("which is the whole reason the filter never worked", () => {
    /*
     * findChoices strips the trailing parenthetical for the menu — right for
     * display, and it took the provenance with it. A ranger was offered
     * sixty-three archetypes and every one of them read as official.
     */
    const rows = [
      { level: 3, name: "Ranger Archetype" },
      { level: 3, name: "Ranger Archetype: Hunter" },
      { level: 3, name: "Ranger Archetype: Bog Phantom (HB)" },
    ];
    const [point] = findChoices(rows);
    const bog = point?.options.find((o) => o.name === "Bog Phantom");
    expect(bog?.full).toBe("Bog Phantom (HB)");
    expect(isCore(bog?.name ?? "")).toBe(true);   // what was being asked
    expect(isCore(bog?.full ?? "")).toBe(false);  // what should have been
  });
});

describe("the other four kinds", () => {
  it("places races, and keeps two books' goblins apart", () => {
    /*
     * Volo's goblin and Ravnica's goblin are different races with one name.
     * First printing wins, which is what "where is this from" means.
     */
    expect(bookOf("Tabaxi", "race")?.short).toBe("Volo's");
    expect(bookOf("Goblin", "race")?.short).toBe("Volo's");
    expect(bookOf("Loxodon", "race")?.short).toBe("Ravnica");
    expect(bookOf("Owlin", "race")?.short).toBe("Strixhaven");
  });

  it("reads the comma-inverted spelling a compendium uses for subraces", () => {
    // "Dwarf, Hill" is how a shelf sorts them; "Hill Dwarf" is how a book
    // prints them. Half this table's races missed until both were read.
    expect(bookOf("Dwarf, Hill", "race")?.short).toBe("Player's Handbook");
    expect(bookOf("Human, Mark of Making", "race")?.short).toBe("Eberron");
  });

  it("places backgrounds", () => {
    expect(bookOf("Criminal", "background")?.short).toBe("Player's Handbook");
    expect(bookOf("Faction Agent", "background")?.short).toBe("Sword Coast");
    expect(bookOf("Rune Carver", "background")?.short).toBe("Bigby's");
  });

  it("places feats, including the ones filed with a choice in the name", () => {
    expect(bookOf("Sentinel", "feat")?.short).toBe("Player's Handbook");
    expect(bookOf("Elven Accuracy", "feat")?.short).toBe("Xanathar's");
    expect(bookOf("Fey Touched", "feat")?.short).toBe("Tasha's");
    // The compendium ships the choice already made, twice nested.
    expect(bookOf("Squat Nimbleness (Dexterity + Athletics (Proficient))", "feat")?.short)
      .toBe("Xanathar's");
  });

  it("places fighting styles, which one book of the era added", () => {
    expect(bookOf("Archery", "style")?.short).toBe("Player's Handbook");
    expect(bookOf("Fighting Style: Blind Fighting", "style")?.short).toBe("Tasha's");
    expect(bookOf("Interception", "style")?.short).toBe("Tasha's");
  });

  it("and keeps the kinds apart, because a word is two things", () => {
    // "Fey Touched" is a Tasha's feat; "Fey Wanderer" is a Tasha's subclass;
    // neither should answer for the other, and a race named Goblin should
    // never resolve against a subclass table.
    expect(bookOf("Goblin", "subclass")).toBe(null);
    expect(bookOf("Sentinel", "subclass")).toBe(null);
    expect(bookOf("Hunter", "race")).toBe(null);
  });
});
