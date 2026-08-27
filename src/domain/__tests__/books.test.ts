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
    expect(new Set(FILED.map((f) => f.book)).size).toBe(13);
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
