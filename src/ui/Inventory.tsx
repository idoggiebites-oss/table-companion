/**
 * What you are carrying, and what you have drawn.
 *
 * Equipping is the only thing on this panel with consequences, so it is the
 * only thing that looks like a control: everything else is a list. Tapping a
 * weapon or a piece of armour changes the armour class on the strip above and
 * the attacks below it, live, which is the same teaching-by-consequence the
 * character builder uses — nobody reads what half plate does to a dexterity
 * bonus, they watch the number stop going up.
 *
 * The catalogue loads on first open rather than with the app. Most of a
 * session never opens this, and it is another 27KB.
 */

import { useEffect, useMemo, useState } from "react";
import { useHold } from "./useHold.js";
import { Popover } from "./Popover.js";
import type { EventBody } from "../domain/events.js";
import {
  countOf, isArmour, isShield, isWeapon, itemFacts, searchItems, type Catalogue, type Item, type Stack,
  type Bucket,
  inBucket,
} from "../domain/items.js";
import { formatCoins, formatPrice, parseCoins } from "../domain/money.js";
import { displacedBy } from "../domain/equipment.js";
import { Icon, type IconName } from "./Icon.js";

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "weapon", label: "Weapons" },
  { id: "armor", label: "Armour" },
  { id: "adventuring-gear", label: "Gear" },
  { id: "tools", label: "Tools" },
] as const;

/** Only things that DO something can be equipped. Rope cannot be worn. */
function equippable(item: Item | undefined): boolean {
  return item !== undefined && (isWeapon(item) || isArmour(item) || isShield(item));
}


/**
 * A thing's name, holdable.
 *
 * A tap on a row must keep meaning what it meant — nothing here — so "what is
 * this" lives under a hold, which is the phone gesture for the question and
 * cannot be hit by accident.
 */
function ItemName({
  label, note, count, onRead,
}: {
  label: string;
  note?: string | undefined;
  count: number;
  onRead?: (() => void) | undefined;
}) {
  const hold = useHold(onRead);
  return (
    <span className="nm" {...hold}>
      {label}
      {note && <> <span className="hb">{note}</span></>}
      {count > 1 && <> <span className="faint num">×{count}</span></>}
    </span>
  );
}

const BUCKETS: readonly { readonly id: Bucket; readonly label: string }[] = [
  { id: "weapons", label: "Weapons" },
  { id: "armor", label: "Armour" },
  { id: "gear", label: "Gear" },
  { id: "consumables", label: "Consumables" },
];

export function Inventory({
  who, inventory, equipped, coins, catalogue, items, editable, append,
}: {
  who: string;
  inventory: readonly Stack[];
  equipped: readonly string[];
  coins: number;
  catalogue: Catalogue;
  items: readonly Item[];
  editable: boolean;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [cat, setCat] = useState<string>("");
  const [purse, setPurse] = useState("");

  const results = useMemo(
    () =>
      open
        ? searchItems(items, { ...(text ? { text } : {}), ...(cat ? { category: cat } : {}) })
            .slice(0, 40)
        : [],
    [open, items, text, cat],
  );

  const worn = inventory.filter((s) => equipped.includes(s.itemId));
  /** The same list as things rather than as stacks, for the hands rule. */
  const wornItems = worn.map((s) => catalogue[s.itemId]).filter((i) => i !== undefined);
  /** What a hold is asking about. */
  const [reading, setReading] = useState<Item | null>(null);
  const packed = inventory.filter((s) => !equipped.includes(s.itemId));

  const row = (s: Stack) => {
    const item = catalogue[s.itemId];
    const isOn = equipped.includes(s.itemId);
    return (
      <div className="inv-row" key={`${s.itemId}:${s.note ?? ""}`}>
        {/*
          * A thumb for the kind of thing it is. The app ships no item art, so
          * this is the same drawn set the slots use — and it is what turns a
          * list of forty names into a list you can skim.
          */}
        <span className="inv-th" aria-hidden="true"><Icon name={iconForItem(item)} /></span>
        <span className="inv-t">
          {/* Hold the name to find out what it is. There is no prose to show —
              not one of the 10,760 items carries a description — so it is the
              fields, and the panel says so rather than looking empty. */}
          <ItemName
            label={s.name}
            note={s.note}
            count={s.qty}
            {...(item ? { onRead: () => setReading(item) } : {})}
          />
          {item && <span className="inv-d">{describeItem(item)}</span>}
        </span>
        {/* The damage, in its own column, because that is the number the eye
            is looking for when it scans a weapon list. */}
        {item?.damage
          ? <span className="inv-dmg">
              <b className="num">{item.damage}</b><span className="label">dmg</span>
            </span>
          : <span className="inv-dmg" />}
        {editable && equippable(item) && (
          <button
            className={`inv-eq${isOn ? " on" : ""}`}
            aria-label={`${isOn ? "Put away" : "Equip"} ${s.name}`}
            onClick={() => {
              /* Both hands means both hands. Whatever was in the other one
                 comes off first, as its own event, so the log says so. */
              if (!isOn && item) {
                for (const off of displacedBy(item, wornItems)) {
                  append({ type: "itemUnequipped", who, itemId: off.id, name: off.name });
                }
              }
              append({
                type: isOn ? "itemUnequipped" : "itemEquipped",
                who,
                itemId: s.itemId,
                name: s.name,
              });
            }}
          >
            {isOn ? "Equipped" : "Equip"}
          </button>
        )}
        {editable && (
          <button
            aria-label={`Drop ${s.name}`}
            onClick={() =>
              append({
                type: "itemRemoved", who, itemId: s.itemId, name: s.name, qty: 1,
                ...(s.note === undefined ? {} : { note: s.note }),
              })
            }
          >
            ✕
          </button>
        )}
        {/* Said once, in `.inv-d` above. It used to be a line of its own
            under the row because the row wrapped; the row has declared
            columns now, so the description sits where it belongs. */}
      </div>
    );
  };

  const [bucket, setBucket] = useState<Bucket>("weapons");

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Carrying</span>
        <span className="row">
          <span className="inv-purse num">{formatCoins(coins)}</span>
          {editable && <button onClick={() => setOpen((v) => !v)}>{open ? "Done" : "Add"}</button>}
        </span>
      </div>

      {/*
        * The pack, under the four headings V2 sorts by.
        *
        * It was two: worn, and everything else — the right split for a figure
        * and the wrong one for a bag, where everything else is one list with a
        * rope, a rapier and a potion in whatever order they were picked up.
        *
        * TABS, as V2 draws them. They were headings for one commit, out of a
        * worry that four tabs hide three quarters of a small pack — and the
        * nesting is in fact the same depth in both apps: V2 reaches its pack
        * through a sheet tab, this reaches it through a bottom-bar tab. The
        * count on each tab is what answers "is there anything under there"
        * without opening it, which is what the worry was really about.
        *
        * Worn and wielded keeps its own band above these: what is IN HAND is a
        * different question from what is in the bag. `bucketOf` is the rule,
        * in domain/items.ts.
        */}
      {worn.length > 0 && (
        <div className="inv">
          <span className="label cr-sub">Worn and wielded</span>
          {worn.map(row)}
        </div>
      )}
      {packed.length > 0 && (
        <>
          <div className="pk-tabs" role="tablist" aria-label="Pack">
            {BUCKETS.map((b) => {
              const n = inBucket(packed, (id) => catalogue[id], b.id).length;
              return (
                <button
                  key={b.id}
                  role="tab"
                  aria-selected={b.id === bucket}
                  className={`pk-tab${b.id === bucket ? " on" : ""}`}
                  onClick={() => setBucket(b.id)}
                >
                  {b.label}
                  {n > 0 && <i className="pk-n num">{n}</i>}
                </button>
              );
            })}
          </div>
          <div className="inv">
            {(() => {
              const rows = inBucket(packed, (id) => catalogue[id], bucket);
              return rows.length === 0
                ? <p className="faint note pk-none">
                    Nothing under {BUCKETS.find((b) => b.id === bucket)?.label.toLowerCase()}.
                  </p>
                : rows.map(row);
            })()}
          </div>
        </>
      )}

      {inventory.length === 0 && (
        <div className="card-body">
          <p className="faint note">
            Nothing yet. Add what you started with, or wait for the DM to hand
            something over.
          </p>
        </div>
      )}

      {open && (
        <div className="card-body">
          <div className="row">
            <input
              value={text}
              aria-label="Search items"
              placeholder="longsword, rope, potion…"
              style={{ flex: "2 1 150px", width: "auto" }}
              onChange={(e) => setText(e.target.value)}
            />
            <input
              value={purse}
              aria-label="Coins"
              placeholder="+10 gp"
              style={{ flex: "0 0 92px", width: "auto" }}
              onChange={(e) => setPurse(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const sign = purse.trim().startsWith("-") ? -1 : 1;
                const delta = parseCoins(purse.replace(/^[+-]/, ""));
                if (delta === null) return;
                append({ type: "coinsChanged", who, delta: sign * delta });
                setPurse("");
              }}
            />
          </div>
          <div className="chips mt-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`chip${cat === c.id ? " on" : ""}`}
                onClick={() => setCat(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="inv-find">
            {results.map((i) => (
              <button
                className="inv-add"
                key={i.id}
                onClick={() =>
                  append({
                    type: "itemAdded", who,
                    stack: { itemId: i.id, name: i.name, qty: 1 },
                  })
                }
              >
                <span className="nm">
                  {i.name}
                  {countOf(inventory, i.id) > 0 && (
                    <span className="faint num"> · have {countOf(inventory, i.id)}</span>
                  )}
                </span>
                <span className="faint">{describeItem(i)}</span>
                <span className="num">{formatPrice(i.cost)}</span>
              </button>
            ))}
            {results.length === 0 && (
              <p className="faint note">
                Nothing matches.
              </p>
            )}
          </div>
        </div>
      )}
      {/*
        * What a hold found. There is no prose to quote — not one of the
        * 10,760 items in the compendium carries a description — so this is
        * assembled from the fields, and it says so. An empty panel reads as
        * a bug; "the data does not have this" reads as a fact.
        */}
      <Popover
        open={reading !== null}
        title={reading?.name ?? ""}
        onClose={() => setReading(null)}
        done="Close"
      >
        {reading && (
          <>
            {itemFacts(reading).map((line) => (
              <p className="pop-text selectable" key={line}>{line}</p>
            ))}
            <p className="pop-text faint">
              {formatPrice(reading.cost)} · the compendium ships no description
              for items, so this is what the app knows rather than what a book
              would say.
            </p>
          </>
        )}
      </Popover>

    </section>
  );
}

/** The one line that matters about an item, or nothing. */
/**
 * A mark for the kind of thing it is. The app ships no item art and never
 * will — a downloaded picture is a request that can fail in a cellar — so
 * this is the drawn set the worn slots already use.
 */
function iconForItem(i: Item | undefined): IconName {
  if (i === undefined) return "pack";
  if (isWeapon(i)) return /\b(bow|sling|crossbow)\b/i.test(i.name) ? "bow" : "sword";
  if (isShield(i) || isArmour(i)) return "shield";
  if (/\b(potion|elixir|oil|flask|vial|antitoxin)\b/i.test(i.name)) return "flask";
  if (/\b(scroll|book|tome|spellbook)\b/i.test(i.name)) return "book";
  if (/\b(cloak|cape|mantle)\b/i.test(i.name)) return "cloak";
  if (/\b(boots|shoes|sandals)\b/i.test(i.name)) return "helm";
  return "pack";
}

export function describeItem(i: Item): string {
  if (isWeapon(i)) {
    const props = (i.properties ?? []).join(", ");
    return `${i.damage ?? ""} ${i.damageType ?? ""}${props ? ` · ${props}` : ""}`.trim();
  }
  if (isShield(i)) return `+${i.baseAc ?? 0} armour class`;
  if (isArmour(i)) {
    const dex = i.dexBonus ? (i.maxDex === undefined ? " + dex" : ` + dex (max ${i.maxDex})`) : "";
    return `armour class ${i.baseAc ?? 0}${dex}`;
  }
  return i.weight ? `${i.weight} lb` : "";
}

/** Loads once and hands the panel both shapes it needs. */
export function useCatalogue(load: () => Promise<Item[]>, when: boolean) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    if (!when || items) return;
    void load().then(setItems, () => setItems([]));
  }, [when, items, load]);
  return items;
}
