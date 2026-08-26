/**
 * What you are wearing, as a figure rather than a list.
 *
 * A list of equipped items answers "what do I own that is ticked". The
 * question a player actually asks is "what is in my hands" and "what is my
 * head doing" — and the shape of the answer is a person, which is why every
 * game that has ever had equipment draws one.
 *
 * The six slots are a reading of what is equipped, not a rules system 5e
 * does not have — see slots.ts. Anything that fits none of them is named
 * underneath rather than forced into a slot it does not belong in.
 */

import { useMemo, useState } from "react";
import type { EventBody } from "../domain/events.js";
import {
  equippedItems, indexItems, type Item, type Stack,
} from "../domain/items.js";
import {
  HELD, rarityOf, rarityStep, slotFor, SLOTS, WORN, worn as fill,
  type SlotId,
} from "../domain/slots.js";
import { loadEquipment } from "../store/srd.js";
import { useCatalogue } from "./Inventory.js";

export function Doll({
  who, inventory, equipped, append,
}: {
  who: string;
  inventory: readonly Stack[];
  equipped: readonly string[];
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState<SlotId | null>(null);
  const items = useCatalogue(loadEquipment, true);
  const catalogue = useMemo(() => indexItems(items ?? []), [items]);
  const on = useMemo(
    () => equippedItems(inventory, equipped, catalogue),
    [inventory, equipped, catalogue],
  );
  const { slots, elsewhere } = useMemo(() => fill(on), [on]);

  /** What could go in this slot, out of what is actually carried. */
  const candidates = (id: SlotId): Item[] => {
    const taken = new Set<SlotId>(
      (Object.keys(slots) as SlotId[]).filter((s) => s !== id && slots[s] !== null),
    );
    return inventory
      .map((s) => catalogue[s.itemId])
      .filter((i): i is Item => i !== undefined)
      .filter((i) => !equipped.includes(i.id))
      .filter((i) => slotFor(i, taken) === id);
  };

  const column = (ids: readonly SlotId[]) => (
    <div className="dl-col">
      {ids.map((id) => {
        const slot = SLOTS.find((s) => s.id === id)!;
        const item = slots[id];
        const rarity = item ? rarityOf(item) : null;
        return (
          <button
            key={id}
            className={`dl-slot${item ? "" : " empty"}${open === id ? " on" : ""}`}
            data-rarity={rarity ? rarityStep(item!) : 0}
            aria-label={item ? `${slot.name}: ${item.name}` : `${slot.name}, empty`}
            aria-expanded={open === id}
            onClick={() => setOpen(open === id ? null : id)}
          >
            <span className="g">{slot.glyph}</span>
            <span className="t">
              <span className="n">{item ? item.name : slot.name}</span>
              <span className="s">{item ? said(item) : "empty"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const slot = open ? SLOTS.find((s) => s.id === open)! : null;
  const held = open ? slots[open] : null;
  const offer = open ? candidates(open) : [];

  return (
    <>
      <div className="dl">
        {column(WORN)}
        <div className="dl-fig">
          {/*
            * Line art, drawn rather than fetched. The app ships no icon set
            * and a downloaded one is a request that can fail in a cellar.
            */}
          <svg viewBox="0 0 90 210" aria-hidden="true" fill="none" stroke="var(--rule)" strokeWidth="1.4">
            <circle cx="45" cy="24" r="15" />
            <path d="M45 39v16M24 60c0-3 9-5 21-5s21 2 21 5l4 46c0 4-4 6-25 6s-25-2-25-6z" />
            <path d="M24 62 8 104l9 5 12-32M66 62l16 42-9 5-12-32" />
            <path d="M31 112l-3 62h13l4-40 4 40h13l-3-62" />
          </svg>
        </div>
        {column(HELD)}
      </div>

      {slot && (
        <div className="dl-pick">
          <span className="label">{slot.name}</span>
          {held ? (
            <>
              <p className="dl-what">
                {held.name}
                <span className="faint"> · {said(held)}</span>
              </p>
              <button
                aria-label={`Take off ${held.name}`}
                onClick={() => {
                  append({ type: "itemUnequipped", who, itemId: held.id, name: held.name });
                  setOpen(null);
                }}
              >
                Take it off
              </button>
            </>
          ) : offer.length > 0 ? (
            <div className="dl-offer">
              {offer.map((i) => (
                <button
                  key={i.id}
                  className="dl-row"
                  aria-label={`Wear ${i.name}`}
                  onClick={() => {
                    append({ type: "itemEquipped", who, itemId: i.id, name: i.name });
                    setOpen(null);
                  }}
                >
                  <span className="n">{i.name}</span>
                  <span className="s">{said(i)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="dl-what faint">
              Nothing in the bag goes here. {slot.what}.
            </p>
          )}
        </div>
      )}

      {elsewhere.length > 0 && (
        <div className="dl-else">
          <span className="label">Also worn</span>
          <span className="dl-names">{elsewhere.map((i) => i.name).join(" · ")}</span>
        </div>
      )}
    </>
  );
}

/** The one line about an item that belongs beside its name. */
function said(i: Item): string {
  if (i.damage) {
    return [i.damage, i.damageType?.toLowerCase(), (i.properties ?? [])[0]]
      .filter(Boolean)
      .join(" · ");
  }
  if (i.baseAc !== undefined) {
    return i.armorCategory === "Shield"
      ? `+${i.baseAc} armour`
      : `AC ${i.baseAc}${i.dexBonus ? " + dex" : ""}`;
  }
  const r = rarityOf(i);
  return r ?? (i.weight ? `${i.weight} lb` : "worn");
}
