/**
 * Writing up a thing.
 *
 * The homebrew tool could only make creatures, so a magic sword lived in
 * somebody's notes: it could not be carried, equipped, swung, priced or sold,
 * and the app had no idea it was a weapon. A DM who invents a weapon wants it
 * to BE a weapon — to turn up in the bag, go in a hand, and put its own
 * numbers on the sheet.
 *
 * The form is grouped by what the rules read rather than by what a book
 * prints: choose what sort of thing it is first, because that decides every
 * other question. A shield asks two things; a weapon asks six.
 *
 * The panel at the foot is the point of the screen. It says what the APP will
 * read off this — not what was typed — so a mistake is visible here rather
 * than three sessions later when somebody swings it. It is the same sentence
 * the press-and-hold shows, produced by the same function, because a preview
 * that renders differently from the real thing is a preview that lies.
 */

import { useState } from "react";
import type { EventBody } from "../domain/events.js";
import { itemFacts, type Item, type WeaponProperty } from "../domain/items.js";
import { formatPrice, parseCoins } from "../domain/money.js";
import {
  HOMEBREW_PROPERTIES, toDraft, toItem,
  type HomebrewItemDraft, type HomebrewKind,
} from "../domain/homebrew-item.js";

const KINDS: readonly { id: HomebrewKind; label: string; hint: string }[] = [
  { id: "weapon", label: "Weapon", hint: "something you swing or shoot" },
  { id: "armour", label: "Armour", hint: "worn on the body" },
  { id: "shield", label: "Shield", hint: "carried in a hand" },
  { id: "gear", label: "Gear", hint: "everything else" },
];

const blank = (): HomebrewItemDraft => ({
  name: "",
  kind: "weapon",
  cost: 0,
  damage: "1d8",
  damageType: "slashing",
  properties: [],
});

export function HomebrewItem({
  mine, append,
}: {
  /** What has already been written up, so it can be edited or thrown away. */
  mine: Readonly<Record<string, Item>>;
  append: (body: EventBody) => void;
}) {
  const [d, setD] = useState<HomebrewItemDraft>(blank);
  const [price, setPrice] = useState("");

  const set = <K extends keyof HomebrewItemDraft>(k: K, v: HomebrewItemDraft[K]) =>
    setD((cur) => ({ ...cur, [k]: v }));
  const toggle = (p: WeaponProperty) =>
    setD((cur) => {
      const had = cur.properties ?? [];
      return {
        ...cur,
        properties: had.includes(p) ? had.filter((x) => x !== p) : [...had, p],
      };
    });

  const asked = parseCoins(price);
  const draft: HomebrewItemDraft = { ...d, cost: asked ?? d.cost };
  /*
   * Built through the same function that saving uses, so what is shown IS
   * what will be stored. A preview assembled separately drifts, and the
   * drift is invisible until somebody swings the thing.
   */
  const preview = toItem(draft);
  const named = d.name.trim() !== "";

  const list = Object.values(mine);

  return (
    <>
      {list.length > 0 && (
        <div className="saved">
          {list.map((i) => (
            <div className="sv-row" key={i.id}>
              <span className="nm">{i.name}</span>
              <span className="faint num">{formatPrice(i.cost)}</span>
              <button
                aria-label={`Edit ${i.name}`}
                onClick={() => {
                  const back = toDraft(i);
                  setD(back);
                  setPrice(back.cost > 0 ? formatPrice(back.cost) : "");
                }}
              >
                Edit
              </button>
              <button
                aria-label={`Delete ${i.name}`}
                onClick={() => append({ type: "homebrewItemDeleted", itemId: i.id })}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card-body">
        {/* What sort of thing it is decides every other question, so it is
            asked first rather than buried under a name. */}
        <span className="label cr-sub">What is it</span>
        <div className="chips">
          {KINDS.map((k) => (
            <button
              key={k.id}
              className={`chip${d.kind === k.id ? " on" : ""}`}
              aria-pressed={d.kind === k.id}
              aria-label={`It is a ${k.label.toLowerCase()}`}
              onClick={() => set("kind", k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="faint hb-note">
          {KINDS.find((k) => k.id === d.kind)?.hint}
        </p>

        {/* Labelled, not just placeheld. A placeholder disappears the moment
            the box is filled, so a DM coming back to an edit sees four boxes
            of numbers and no way to tell which is which. */}
        <div className="row tight mt-2">
          <div style={{ flex: "2 1 150px" }}>
            <label className="label" htmlFor="hbi-name">Name</label>
            <input
              id="hbi-name"
              value={d.name}
              aria-label="Item name"
              placeholder="Ashbrand"
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div style={{ flex: "0 0 104px" }}>
            <label className="label" htmlFor="hbi-price">Price</label>
            <input
              id="hbi-price"
              value={price}
              aria-label="Item price"
              placeholder="15 gp"
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        {d.kind === "weapon" && (
          <>
            <div className="row tight mt-2">
              <div style={{ flex: "0 0 92px" }}>
                <label className="label" htmlFor="hbi-dmg">Damage</label>
                <input
                  id="hbi-dmg"
                  value={d.damage ?? ""}
                  aria-label="Damage dice"
                  placeholder="1d8"
                  onChange={(e) => set("damage", e.target.value)}
                />
              </div>
              <div style={{ flex: "1 1 120px" }}>
                <label className="label" htmlFor="hbi-dmgt">Type</label>
                <input
                  id="hbi-dmgt"
                  value={d.damageType ?? ""}
                  aria-label="Damage type"
                  placeholder="slashing"
                  onChange={(e) => set("damageType", e.target.value)}
                />
              </div>
            </div>

            <div className="chips mt-2">
              <button
                className={`chip${d.martial ? " on" : ""}`}
                aria-pressed={Boolean(d.martial)}
                aria-label="Martial weapon"
                onClick={() => set("martial", !d.martial)}
              >
                Martial
              </button>
              <button
                className={`chip${d.ranged ? " on" : ""}`}
                aria-pressed={Boolean(d.ranged)}
                aria-label="Ranged weapon"
                onClick={() => set("ranged", !d.ranged)}
              >
                Ranged
              </button>
              {/* Only the five that change a number. The rest are flavour the
                  app does not act on, and fourteen checkboxes is a form
                  nobody finishes. */}
              {HOMEBREW_PROPERTIES.map((p) => (
                <button
                  key={p}
                  className={`chip${(d.properties ?? []).includes(p) ? " on" : ""}`}
                  aria-pressed={(d.properties ?? []).includes(p)}
                  aria-label={`Property ${p}`}
                  onClick={() => toggle(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            {(d.properties ?? []).includes("versatile") && (
              <div className="row tight mt-2">
                <div style={{ flex: "0 0 92px" }}>
                  <label className="label" htmlFor="hbi-2h">In two hands</label>
                  <input
                    id="hbi-2h"
                    value={d.twoHanded ?? ""}
                    aria-label="Two-handed damage"
                    placeholder="1d10"
                    onChange={(e) => set("twoHanded", e.target.value)}
                  />
                </div>
                <span className="faint hb-note">
                  What it does in two hands. Both grips become rows on the
                  sheet, and a shield rules the second one out.
                </span>
              </div>
            )}

            {((d.properties ?? []).includes("thrown") || d.ranged) && (
              <div className="row tight mt-2">
                <div style={{ flex: "0 0 92px" }}>
                  <label className="label" htmlFor="hbi-rn">Range</label>
                  <input
                    id="hbi-rn"
                    type="number"
                    value={d.rangeNormal ?? ""}
                    aria-label="Normal range"
                    placeholder="20"
                    onChange={(e) => set("rangeNormal", +e.target.value || 0)}
                  />
                </div>
                <div style={{ flex: "0 0 92px" }}>
                  <label className="label" htmlFor="hbi-rl">Long</label>
                  <input
                    id="hbi-rl"
                    type="number"
                    value={d.rangeLong ?? ""}
                    aria-label="Long range"
                    placeholder="60"
                    onChange={(e) => set("rangeLong", +e.target.value || 0)}
                  />
                </div>
                <span className="faint hb-note">Feet.</span>
              </div>
            )}
          </>
        )}

        {d.kind === "armour" && (
          <>
            <div className="chips mt-2">
              {(["Light", "Medium", "Heavy"] as const).map((w) => (
                <button
                  key={w}
                  className={`chip${(d.armourWeight ?? "Light") === w ? " on" : ""}`}
                  aria-pressed={(d.armourWeight ?? "Light") === w}
                  aria-label={`${w} armour`}
                  onClick={() => set("armourWeight", w)}
                >
                  {w}
                </button>
              ))}
              <button
                className={`chip${d.stealthDisadvantage ? " on" : ""}`}
                aria-pressed={Boolean(d.stealthDisadvantage)}
                aria-label="Disadvantage on Stealth"
                onClick={() => set("stealthDisadvantage", !d.stealthDisadvantage)}
              >
                noisy
              </button>
            </div>
            <div className="row tight mt-2">
              <div style={{ flex: "0 0 92px" }}>
                <label className="label" htmlFor="hbi-ac">Armour class</label>
                <input
                  id="hbi-ac"
                  type="number"
                  value={d.baseAc ?? 11}
                  aria-label="Base armour class"
                  onChange={(e) => set("baseAc", +e.target.value || 0)}
                />
              </div>
              <span className="faint hb-note">
                {(d.armourWeight ?? "Light") === "Heavy"
                  ? "Heavy armour ignores dexterity."
                  : (d.armourWeight ?? "Light") === "Medium"
                    ? "Medium armour adds dexterity, capped at +2."
                    : "Light armour adds all of your dexterity."}
              </span>
            </div>
          </>
        )}

        {d.kind === "shield" && (
          <div className="row tight mt-2">
            <div style={{ flex: "0 0 92px" }}>
              <label className="label" htmlFor="hbi-sh">Adds</label>
              <input
                id="hbi-sh"
                type="number"
                value={d.baseAc ?? 2}
                aria-label="Armour class added"
                onChange={(e) => set("baseAc", +e.target.value || 0)}
              />
            </div>
            <span className="faint hb-note">
              What it adds, on top of whatever you were standing at.
            </span>
          </div>
        )}

        {/*
          * What the app will read, produced by the same function that saves
          * it. This is the whole point of the screen: a mistake shows here
          * rather than three sessions later when somebody swings it.
          */}
        <div className="hb-reads">
          <span className="label">What the app reads</span>
          {itemFacts(preview).map((line) => (
            <p className="hb-line" key={line}>{line}</p>
          ))}
          <p className="hb-line faint">
            {formatPrice(preview.cost)}
            {preview.category === "weapon" && " · goes in a hand, and swings"}
            {preview.armorCategory === "Shield" && " · goes in a hand"}
            {preview.category === "armor" && preview.armorCategory !== "Shield" &&
              " · worn on the body"}
          </p>
        </div>

        <div className="row mt-3">
          <button
            disabled={!named}
            aria-label="Save the item"
            onClick={() => {
              append({ type: "homebrewItemSaved", item: toItem(draft) });
              setD(blank());
              setPrice("");
            }}
          >
            {d.id ? "Save changes" : "Write it up"}
          </button>
          {d.id && (
            <button onClick={() => { setD(blank()); setPrice(""); }}>New instead</button>
          )}
        </div>
      </div>
    </>
  );
}
