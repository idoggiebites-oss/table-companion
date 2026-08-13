/**
 * The shop, from the buying side.
 *
 * Appears only while the DM has a trader open, and vanishes when they close
 * it. That is the whole reactive contract: a player does not go looking for a
 * shop, the shop arrives because the party walked into one.
 *
 * What you cannot afford stays visible and disabled rather than being hidden.
 * A shop that silently omits the expensive things is a shop that never tells
 * you what to save for.
 */

import type { EventBody } from "../domain/events.js";
import { canAfford, formatCoins, formatPrice } from "../domain/money.js";
import { inStock, isUnlimited } from "../domain/npc.js";
import type { CampaignState } from "../domain/project.js";

export function Shop({
  state, who, coins, append,
}: {
  state: CampaignState;
  who: string;
  coins: number;
  append: (body: EventBody) => void;
}) {
  const npc = state.openTrader ? state.npcs[state.openTrader] : undefined;
  if (!npc) return null;

  const shelf = npc.stock.filter(inStock);

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">
          {npc.name}
          {npc.role && <> · <span className="faint">{npc.role}</span></>}
        </span>
        <span className="inv-purse num">{formatCoins(coins)}</span>
      </div>

      {npc.notes && (
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <p className="faint" style={{ margin: 0, fontSize: ".84rem" }}>{npc.notes}</p>
        </div>
      )}

      <div className="inv">
        {shelf.map((s) => {
          const affordable = canAfford(coins, s.price);
          return (
            <div className="inv-row" key={s.itemId}>
              <span className="nm">{s.name}</span>
              <button
                disabled={!affordable}
                aria-label={`Buy ${s.name}`}
                onClick={() =>
                  append({
                    type: "itemBought",
                    who,
                    npcId: npc.id,
                    stack: { itemId: s.itemId, name: s.name, qty: 1 },
                    price: s.price,
                  })
                }
              >
                {affordable ? `Buy · ${formatPrice(s.price)}` : formatPrice(s.price)}
              </button>
              {!isUnlimited(s) && (
                <span className="inv-desc faint">{s.qty} left</span>
              )}
            </div>
          );
        })}
        {shelf.length === 0 && (
          <p className="faint" style={{ margin: "4px 0", fontSize: ".84rem" }}>
            Nothing for sale right now.
          </p>
        )}
      </div>
    </section>
  );
}
