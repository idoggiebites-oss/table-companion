/**
 * The people in the world.
 *
 * Notes-first, because most NPCs never roll anything: the field a DM actually
 * fills in at eleven at night is "grumpy, owes the party a favour, knows about
 * the bridge", not an armour class. Stats are there for the one who turns out
 * to matter, folded away until asked for.
 *
 * The trader flag is what makes a stock list exist at all. A shop is only
 * visible to players while it is OPEN — standing in a shop is a thing that
 * starts and stops, and a permanently browsable list of every merchant in the
 * campaign would let a player buy plate from a village three days away.
 */

import { useMemo, useState } from "react";
import type { EventBody } from "../domain/events.js";
import { mergeItems, searchItems, type Item } from "../domain/items.js";
import { formatPrice, parseCoins } from "../domain/money.js";
import {
  describeStock, makeNpcId, UNLIMITED, type Npc, type StockEntry,
} from "../domain/npc.js";
import type { CampaignState } from "../domain/project.js";
import { loadEquipment } from "../store/srd.js";
import { useCatalogue } from "./Inventory.js";

const blank = (): Npc => ({
  id: "", name: "", role: "", trader: false, notes: "", stock: [],
});

export function Npcs({
  state, append,
}: {
  state: CampaignState;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Npc>(blank);
  const [find, setFind] = useState("");
  const [price, setPrice] = useState("");
  /*
   * How many there are. Blank means an endless supply, which is the right
   * default for a rope merchant and the wrong one for the only breastplate
   * in the village — and the wrong one was the only one on offer, because
   * this form hardcoded UNLIMITED and never asked.
   */
  const [qty, setQty] = useState("");
  const [picked, setPicked] = useState<Item | null>(null);

  const items = useCatalogue(loadEquipment, open && draft.trader);
  /*
   * The DM's own things are for sale too. A shopkeeper who cannot stock the
   * sword the DM invented last week is a shopkeeper with the wrong stock —
   * and the sword already IS an item everywhere else.
   */
  const shelf = useMemo(
    () => mergeItems(items ?? [], state.homebrewItems),
    [items, state.homebrewItems],
  );
  const results = useMemo(
    () => (find ? searchItems(shelf, { text: find }).slice(0, 8) : []),
    [shelf, find],
  );

  const all = Object.values(state.npcs);
  const editing = draft.id !== "";

  function save() {
    const id = editing ? draft.id : makeNpcId(draft.name);
    append({ type: "npcSaved", npc: { ...draft, id, name: draft.name.trim() || "Someone" } });
    setDraft(blank());
    setOpen(false);
  }

  function addStock(item: Item) {
    const asked = parseCoins(price);
    const wanted = Number(qty);
    const entry: StockEntry = {
      itemId: item.id,
      name: item.name,
      price: asked ?? item.cost,
      // Blank, nonsense or zero all read as endless: a shop with none of a
      // thing is a thing not on the shelf, which is what Remove is for.
      qty: qty.trim() !== "" && Number.isFinite(wanted) && wanted > 0 ? Math.floor(wanted) : UNLIMITED,
    };
    setDraft({ ...draft, stock: [...draft.stock.filter((s) => s.itemId !== item.id), entry] });
    setFind("");
    setPicked(null);
    setPrice("");
    setQty("");
  }

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">People</span>
        <button
          onClick={() => {
            setDraft(blank());
            setOpen((v) => !v);
          }}
        >
          {open ? "Hide" : "Add someone"}
        </button>
      </div>

      {all.length > 0 && (
        <div className="saved">
          {all.map((n) => {
            const isOpen = state.openTrader === n.id;
            return (
              <div className="sv-row npc-row" key={n.id}>
                <span className="nm">
                  {n.name}
                  {n.role && <> <span className="faint">{n.role}</span></>}
                </span>
                {n.trader && (
                  <button
                    className={isOpen ? "on" : ""}
                    aria-label={`${isOpen ? "Close" : "Open"} ${n.name}'s shop`}
                    onClick={() =>
                      append(isOpen ? { type: "traderClosed" } : { type: "traderOpened", npcId: n.id })
                    }
                  >
                    {isOpen ? "Open to party" : "Open shop"}
                  </button>
                )}
                <button
                  aria-label={`Edit ${n.name}`}
                  onClick={() => {
                    setDraft(n);
                    setOpen(true);
                  }}
                >
                  Edit
                </button>
                <button
                  aria-label={`Delete ${n.name}`}
                  onClick={() => append({ type: "npcDeleted", npcId: n.id })}
                >
                  ✕
                </button>
                {n.notes && <span className="npc-note faint">{n.notes}</span>}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="card-body">
          <div className="row" style={{ gap: 8 }}>
            <input
              value={draft.name}
              aria-label="NPC name"
              placeholder="Halbrek the Fence"
              style={{ flex: "2 1 150px", width: "auto" }}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              value={draft.role}
              aria-label="NPC role"
              placeholder="shopkeeper"
              style={{ flex: "1 1 110px", width: "auto" }}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            />
          </div>

          <textarea
            className="npc-notes"
            value={draft.notes}
            aria-label="NPC notes"
            rows={3}
            placeholder="What the party knows, what they want, how they talk."
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />

          <div className="row" style={{ marginTop: 10 }}>
            <button
              className={`chip${draft.trader ? " on" : ""}`}
              aria-pressed={draft.trader}
              onClick={() => setDraft({ ...draft, trader: !draft.trader })}
            >
              Trades with the party
            </button>
            <span className="faint" style={{ fontSize: ".78rem" }}>
              {draft.trader ? "Has stock to sell." : "Most people don't."}
            </span>
          </div>

          {draft.trader && (
            <div className="npc-stock">
              <span className="label cr-sub">Stock</span>
              {draft.stock.map((s) => (
                <div className="inv-row" key={s.itemId}>
                  <span className="nm">{s.name}</span>
                  <span className="faint num">{describeStock(s)}</span>
                  {/* A shelf changes between sessions. Re-adding the item to
                      change the count would also lose the asking price. */}
                  <input
                    type="number"
                    min={0}
                    value={s.qty < 0 ? "" : s.qty}
                    aria-label={`How many ${s.name}`}
                    placeholder="any"
                    style={{ flex: "0 0 70px", width: "auto" }}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const next =
                        e.target.value.trim() !== "" && Number.isFinite(n) && n >= 0
                          ? Math.floor(n)
                          : UNLIMITED;
                      setDraft({
                        ...draft,
                        stock: draft.stock.map((x) =>
                          x.itemId === s.itemId ? { ...x, qty: next } : x,
                        ),
                      });
                    }}
                  />
                  <button
                    aria-label={`Remove ${s.name} from stock`}
                    onClick={() =>
                      setDraft({ ...draft, stock: draft.stock.filter((x) => x.itemId !== s.itemId) })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}

              <div className="row" style={{ marginTop: 8, gap: 8 }}>
                <input
                  value={find}
                  aria-label="Find stock"
                  placeholder="longsword, potion…"
                  style={{ flex: "2 1 140px", width: "auto" }}
                  onChange={(e) => {
                    setFind(e.target.value);
                    setPicked(null);
                  }}
                />
                <input
                  value={price}
                  aria-label="Asking price"
                  placeholder={picked ? formatPrice(picked.cost) : "price"}
                  style={{ flex: "0 0 88px", width: "auto" }}
                  onChange={(e) => setPrice(e.target.value)}
                />
                {/* Blank is endless, which is right for rope and wrong for
                    the only breastplate in the village. */}
                <input
                  type="number"
                  min={1}
                  value={qty}
                  aria-label="How many"
                  placeholder="any"
                  style={{ flex: "0 0 74px", width: "auto" }}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              {/* The point of a trader is that THIS one charges more. */}
              {results.map((i) => (
                <button className="inv-add" key={i.id} onClick={() => addStock(i)}>
                  <span className="nm">{i.name}</span>
                  <span className="num">{formatPrice(i.cost)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="row" style={{ marginTop: 14 }}>
            <button disabled={!draft.name.trim()} onClick={save}>
              {editing ? "Save changes" : "Save"}
            </button>
            <button onClick={() => { setDraft(blank()); setOpen(false); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
