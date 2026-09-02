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
  equippedItems, indexItems, mergeItems, type Item, type Stack,
} from "../domain/items.js";
import { displacedBy, usesBothHands } from "../domain/equipment.js";
import { Popover } from "./Popover.js";
import {
  HELD, rarityOf, rarityStep, slotFor, SLOTS, WORN, worn as fill,
  type SlotId,
} from "../domain/slots.js";
import { loadEquipment } from "../store/srd.js";
import { useCatalogue } from "./Inventory.js";
import { Icon } from "./Icon.js";

export function Doll({
  who, inventory, equipped, append, homebrew,
}: {
  who: string;
  inventory: readonly Stack[];
  equipped: readonly string[];
  /** The DM's own things, which are items like any other. */
  homebrew?: Readonly<Record<string, Item>> | undefined;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState<SlotId | null>(null);
  const items = useCatalogue(loadEquipment, true);
  // The DM's own things are items like any other.
  const catalogue = useMemo(
    () => indexItems(mergeItems(items ?? [], homebrew)),
    [items, homebrew],
  );
  const on = useMemo(
    () => equippedItems(inventory, equipped, catalogue),
    [inventory, equipped, catalogue],
  );
  const { slots, elsewhere } = useMemo(() => fill(on), [on]);

  /*
   * The weapon that has taken both hands, if there is one. A greatsword in
   * the main hand does not leave an empty off hand to fill — it leaves no
   * off hand at all, and drawing an inviting empty box there was the app
   * offering something the rules do not.
   */
  const bothHands = on.find(usesBothHands);

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
        /* No off hand at all, rather than an empty one — a greatsword is
           already in it. An inviting empty box here offered something the
           rules do not. */
        const spoken = id === "off" && !item && bothHands;
        return (
          <button
            key={id}
            className={`dl-slot${item ? "" : " empty"}${spoken ? " taken" : ""}${open === id ? " on" : ""}`}
            data-rarity={rarity ? rarityStep(item!) : 0}
            aria-label={
              item
                ? `${slot.name}: ${item.name}`
                : spoken
                  ? `${slot.name}, holding ${bothHands.name}`
                  : `${slot.name}, empty`
            }
            aria-expanded={open === id}
            disabled={Boolean(spoken)}
            onClick={() => setOpen(open === id ? null : id)}
          >
            <span className="g"><Icon name={slot.icon} size={22} /></span>
            {/*
              * The PLACE first, then what is in it, then what that does.
              *
              * It read the other way round — the item large and the place it
              * goes as a footnote — which is backwards for a figure whose
              * whole job is "what is on each part of me". Six of these are on
              * screen at once and the thing being scanned for is the place.
              */}
            <span className="t">
              <span className="s">{slot.name}</span>
              <span className="n">
                {item ? item.name
                  : spoken ? `both hands on the ${bothHands.name.toLowerCase()}`
                  : slot.what}
              </span>
              {item && <span className="d">{said(item)}</span>}
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

      {/*
        * Over the figure, not under it.
        *
        * Choosing what to wear opened a list INSIDE the panel, which pushed
        * the figure — the thing you are choosing FOR — off the top of a
        * phone. You picked a helm while looking at your own boots.
        */}
      <Popover
        open={slot !== null}
        title={slot ? slot.name : ""}
        onClose={() => setOpen(null)}
        done="Close"
      >
        {slot && (
          <>
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
                    /* Both hands means both hands. Whatever was in the other
                       one comes off first, as its own event. */
                    for (const off of displacedBy(i, on)) {
                      append({ type: "itemUnequipped", who, itemId: off.id, name: off.name });
                    }
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
          </>
        )}
      </Popover>

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
