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
import type { EventBody } from "../domain/events.js";
import {
  countOf, isArmour, isShield, isWeapon, searchItems, type Catalogue, type Item, type Stack,
} from "../domain/items.js";
import { formatCoins, formatPrice, parseCoins } from "../domain/money.js";

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
  const packed = inventory.filter((s) => !equipped.includes(s.itemId));

  const row = (s: Stack) => {
    const item = catalogue[s.itemId];
    const isOn = equipped.includes(s.itemId);
    return (
      <div className="inv-row" key={`${s.itemId}:${s.note ?? ""}`}>
        <span className="nm">
          {s.name}
          {s.note && <> <span className="hb">{s.note}</span></>}
          {s.qty > 1 && <> <span className="faint num">×{s.qty}</span></>}
        </span>
        {editable && equippable(item) && (
          <button
            className={isOn ? "on" : ""}
            aria-label={`${isOn ? "Put away" : "Equip"} ${s.name}`}
            onClick={() =>
              append({
                type: isOn ? "itemUnequipped" : "itemEquipped",
                who,
                itemId: s.itemId,
                name: s.name,
              })
            }
          >
            {isOn ? "Worn" : "Equip"}
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
        {item && <span className="inv-desc faint">{describeItem(item)}</span>}
      </div>
    );
  };

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Carrying</span>
        <span className="row">
          <span className="inv-purse num">{formatCoins(coins)}</span>
          {editable && <button onClick={() => setOpen((v) => !v)}>{open ? "Done" : "Add"}</button>}
        </span>
      </div>

      {worn.length > 0 && (
        <div className="inv">
          <span className="label cr-sub">Worn and wielded</span>
          {worn.map(row)}
        </div>
      )}
      {packed.length > 0 && (
        <div className="inv">
          <span className="label cr-sub">In your pack</span>
          {packed.map(row)}
        </div>
      )}
      {inventory.length === 0 && (
        <div className="card-body">
          <p className="faint" style={{ margin: 0, fontSize: ".86rem" }}>
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
          <div className="chips" style={{ marginTop: 10 }}>
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
              <p className="faint" style={{ margin: 0, fontSize: ".84rem" }}>
                Nothing matches.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** The one line that matters about an item, or nothing. */
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
