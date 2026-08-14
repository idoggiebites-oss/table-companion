// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  countEntries, looksLikeCompendium, parseCompendiumXml, parseKind, scanEntries, survey,
} from "../compendium.js";

const wrap = (body: string) => `<?xml version="1.0"?><compendium version="5">${body}</compendium>`;

describe("scanning without building a document", () => {
  const xml = wrap(`
    <item><name>Club</name><type>M</type><value>0.1</value><dmg1>1d4</dmg1><dmgType>B</dmgType><property>L</property></item>
    <item><name>Longsword</name><type>M</type><value>15.0</value><property>V,M</property><dmg1>1d8</dmg1><dmg2>1d10</dmg2><dmgType>S</dmgType></item>
    <monster><name>Goblin</name><ac>15 (leather armor)</ac><hp>7 (2d6)</hp><cr>1/4</cr></monster>`);

  it("finds each entry", () => {
    expect([...scanEntries(xml, "item")]).toHaveLength(2);
    expect(countEntries(xml, "monster")).toBe(1);
  });

  it("is not confused by the tag name appearing in prose", () => {
    // A monster whose text mentions an item must not end the item scan early.
    const tricky = wrap(
      `<item><name>Rope</name><text>Tie it to an item or a monster.</text></item>` +
      `<item><name>Torch</name></item>`,
    );
    expect([...scanEntries(tricky, "item")]).toHaveLength(2);
  });

  it("surveys without parsing", () => {
    expect(survey(xml)).toMatchObject({ item: 2, monster: 1, spell: 0 });
  });
});

describe("items", () => {
  const xml = wrap(`
    <item><name>Club</name><type>M</type><value>0.1</value><dmg1>1d4</dmg1><dmgType>B</dmgType><property>L</property></item>
    <item><name>Longsword</name><type>M</type><value>15.0</value><property>V,M</property><dmg1>1d8</dmg1><dmg2>1d10</dmg2><dmgType>S</dmgType></item>
    <item><name>Chain Mail</name><type>HA</type><value>75.0</value><ac>16</ac><stealth>YES</stealth><strength>13</strength></item>
    <item><name>Half Plate</name><type>MA</type><value>750.0</value><ac>15</ac></item>
    <item><name>Potion of Healing</name><type>P</type><magic>YES</magic><value>50.0</value></item>`);
  const items = parseKind(xml, "item");
  const by = (n: string) => items.find((i) => i.name === n)!;

  it("reads gold into copper", () => {
    // A club is 1 sp. Written as 0.1 gp, which is exactly why money is not a
    // decimal anywhere else in this app.
    expect(by("Club").cost).toBe(10);
    expect(by("Longsword").cost).toBe(1500);
  });

  it("treats M in the property list as the CATEGORY, not a property", () => {
    expect(by("Longsword").weaponCategory).toBe("Martial");
    expect(by("Longsword").properties).toEqual(["versatile"]);
    // A club has no M, and that absence is what makes it simple.
    expect(by("Club").weaponCategory).toBe("Simple");
  });

  it("carries the damage a weapon needs to be rollable", () => {
    expect(by("Longsword")).toMatchObject({
      damage: "1d8", twoHanded: "1d10", damageType: "slashing", weaponRange: "Melee",
    });
  });

  it("reads armour well enough to derive armour class", () => {
    expect(by("Chain Mail")).toMatchObject({
      armorCategory: "Heavy", baseAc: 16, dexBonus: false,
      strMinimum: 13, stealthDisadvantage: true,
    });
    expect(by("Half Plate")).toMatchObject({ armorCategory: "Medium", maxDex: 2, dexBonus: true });
  });

  it("marks magic items", () => {
    expect(by("Potion of Healing").magic).toBe(true);
    expect(by("Club").magic).toBeUndefined();
  });
});

describe("spells and classes", () => {
  const xml = wrap(`
    <spell><name>Fireball</name><level>3</level><school>EV</school><time>1 action</time>
      <range>150 feet</range><components>V, S, M</components><duration>Instantaneous</duration>
      <classes>Sorcerer, Wizard</classes><text>A bright streak.</text></spell>
    <spell><name>Bless</name><level>1</level><school>EN</school><duration>Concentration, up to 1 minute</duration>
      <classes>Cleric</classes><text>You bless.</text></spell>
    <class><name>Wizard</name><hd>6</hd><numSkills>2</numSkills><wealth>4d4x10</wealth>
      <spellAbility>Intelligence</spellAbility>
      <autolevel level="1"><slots>3,2,0</slots><feature><name>Spellcasting</name><text>You cast.</text></feature></autolevel>
      <autolevel level="2"><slots>3,3,0</slots></autolevel>
    </class>`);

  it("expands the school letter", () => {
    expect(parseKind(xml, "spell").find((s) => s.name === "Fireball")!.school).toBe("evocation");
  });

  it("notices concentration from the duration", () => {
    const spells = parseKind(xml, "spell");
    expect(spells.find((s) => s.name === "Bless")!.concentration).toBe(true);
    expect(spells.find((s) => s.name === "Fireball")!.concentration).toBe(false);
  });

  it("lowercases the classes that can cast it", () => {
    expect(parseKind(xml, "spell").find((s) => s.name === "Fireball")!.classes)
      .toEqual(["sorcerer", "wizard"]);
  });

  it("drops the leading cantrip count from the slots row", () => {
    // "3,2,0" is three cantrips then two first-level slots, not three slots.
    const wiz = parseKind(xml, "class")[0]!;
    expect(wiz.slots[0]).toEqual([2, 0]);
    expect(wiz.slots[1]).toEqual([3, 0]);
    expect(wiz.hitDie).toBe(6);
    expect(wiz.wealth).toBe("4d4x10");
  });

  it("keeps features with the level that grants them", () => {
    expect(parseKind(xml, "class")[0]!.features).toEqual([
      { level: 1, name: "Spellcasting", text: "You cast." },
    ]);
  });
});

describe("refusing the wrong file", () => {
  it("names a character export for what it is", () => {
    expect(looksLikeCompendium("<character><name>Kira</name></character>"))
      .toMatch(/character export/);
  });

  it("rejects something that is not a compendium at all", () => {
    expect(looksLikeCompendium("<html><body>hello</body></html>")).toMatch(/No <compendium>/);
  });

  it("accepts one", () => {
    expect(looksLikeCompendium(wrap("<item><name>Rope</name></item>"))).toBe(null);
  });

  it("survives an entry that is malformed, and keeps the rest", () => {
    // The middle one has a mismatched closing tag — one bad entry costs that
    // entry, never the import.
    const xml = wrap(
      `<item><name>Good</name><value>1.0</value></item>` +
      `<item><name>Broken</name><value>1.0</dmgType></item>` +
      `<item><name>Also good</name></item>`,
    );
    const { compendium } = parseCompendiumXml(xml, "Test", ["item"]);
    expect(compendium!.items.map((i) => i.name)).toEqual(["Good", "Also good"]);
    // Kinds not asked for are not parsed at all.
    expect(compendium!.monsters).toEqual([]);
  });
});
