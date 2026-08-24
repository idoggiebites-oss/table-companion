/*
 * Languages and tools, read out of the prose the compendium actually ships.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  gather, isMundaneTool, languagesFromTrait, toolsFromClass,
} from "../proficiencies.js";

describe("a race's languages", () => {
  it("reads the shape 603 of 605 races use", () => {
    expect(languagesFromTrait(
      "You can speak, read, and write Common and Draconic. Draconic is thought to be one of the oldest languages.",
    )).toEqual({ known: ["Common", "Draconic"], choose: 0 });
  });

  it("counts a choice the race does not make for you", () => {
    // The reason a language picker has to exist at all.
    expect(languagesFromTrait(
      "You can speak, read, and write Common and one extra language of your choice.",
    )).toEqual({ known: ["Common"], choose: 1 });
  });

  it("handles a list of three", () => {
    expect(languagesFromTrait(
      "You can speak, read, and write Common, Elvish, and Undercommon.",
    ).known).toEqual(["Common", "Elvish", "Undercommon"]);
  });

  it("keeps what it cannot parse instead of inventing or dropping it", () => {
    const v = languagesFromTrait("You communicate telepathically within 30 feet.");
    expect(v.known).toEqual([]);
    expect(v.choose).toBe(0);
    expect(v.stated).toContain("telepathically");
  });

  it("has nothing to say about nothing", () => {
    expect(languagesFromTrait("")).toEqual({ known: [], choose: 0 });
    expect(languagesFromTrait(undefined as never).known).toEqual([]);
  });
});

describe("a class's tools", () => {
  it("grants what it names", () => {
    expect(toolsFromClass("Thieves' Tools")).toEqual({ known: ["Thieves' Tools"], choose: 0 });
  });

  it("gives nothing for None", () => {
    expect(toolsFromClass("None")).toEqual({ known: [], choose: 0 });
  });

  it("counts a choice, and keeps the wording so the picker can say it", () => {
    const bard = toolsFromClass("Three Musical Instrument of your choice");
    expect(bard.choose).toBe(3);
    expect(bard.stated).toContain("Musical Instrument");

    const monk = toolsFromClass(
      "Any one type of Artisan's Tools or any one Musical Instrument of your choice",
    );
    expect(monk.choose).toBe(1);
  });
});

describe("which items you can be proficient with", () => {
  it("is the mundane ones", () => {
    expect(isMundaneTool("tools")).toBe(true);
    expect(isMundaneTool("artisan tools")).toBe(true);
    expect(isMundaneTool("gaming set")).toBe(true);
    expect(isMundaneTool("instrument")).toBe(true);
  });

  it("and never treasure", () => {
    // "Instrument, very rare (requires attunement by a bard)" is loot.
    expect(isMundaneTool("instrument, very rare (requires attunement by a bard)")).toBe(false);
    expect(isMundaneTool("tool, legendary (requires attunement)")).toBe(false);
    expect(isMundaneTool(undefined)).toBe(false);
  });

  it.skipIf(!fs.existsSync("public/content/item.json"))(
    "which is a list a person can choose from", () => {
      const items = JSON.parse(
        fs.readFileSync("public/content/item.json", "utf8"),
      ) as { name: string; detail?: string }[];
      const tools = items.filter((i) => isMundaneTool(i.detail)).map((i) => i.name);
      expect(tools.length).toBeGreaterThan(30);
      expect(tools.length).toBeLessThan(120);
      for (const want of ["Thieves' Tools", "Herbalism Kit", "Smith's Tools"]) {
        expect(tools, want).toContain(want);
      }
    },
  );
});

describe("gathering what came from several places", () => {
  it("does not repeat itself", () => {
    // Common from the race and Common from the background is one language.
    expect(gather(["Common", "Elvish"], ["common"], ["Orc"])).toEqual(
      ["Common", "Elvish", "Orc"],
    );
  });

  it("tolerates the absent", () => {
    expect(gather(undefined, ["Common"], undefined)).toEqual(["Common"]);
  });
});
