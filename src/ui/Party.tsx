/**
 * The DM's view of the party.
 *
 * The whole reason this exists: the DM narrates "you take twelve" and types it
 * while still talking, rather than waiting for a player to find the right
 * field mid-combat. Speed is the point.
 *
 * That is only defensible because every change lands in the action feed
 * signed by whoever made it, and any of it can be undone from any device.
 */

import { Num } from "./Num.js";
import { useState } from "react";
import { COMMON_BOONS, describeBoon, type Boon } from "../domain/boons.js";
import { formatCoins, parseCoins } from "../domain/money.js";
import type { EventBody } from "../domain/events.js";
import { mayEditCharacter } from "../domain/permissions.js";
import type { CampaignState } from "../domain/project.js";
import type { Seat } from "../domain/combat.js";
import { HpBar, healthStep, VAGUE_LABEL } from "./HpBar.js";

export function Party({
  state, seat, append,
}: {
  state: CampaignState;
  seat: Seat;
  append: (body: EventBody) => void;
}) {
  /**
   * One amount PER MEMBER, not one for the table. A shared field means the
   * number you just typed to heal the cleric is still sitting there when the
   * dragon hits the barbarian, and the DM either notices or does not.
   */
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [boonFor, setBoonFor] = useState<string | null>(null);
  const [loot, setLoot] = useState("");
  const builds = Object.values(state.builds);
  const amountOf = (id: string) => amounts[id] ?? 5;
  const setAmount = (id: string, n: number) =>
    setAmounts((a) => ({ ...a, [id]: Math.max(0, n) }));

  const grant = (who: string, b: Omit<Boon, "id">) => {
    append({
      type: "boonGranted",
      who,
      boon: { ...b, id: `${b.name.toLowerCase().replace(/\W+/g, "-")}-${Date.now().toString(36)}` },
    });
    setBoonFor(null);
  };

  if (builds.length === 0) return null;

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Party</span>
        <span className="label faint">{builds.length} at the table</span>
      </div>

      {builds.map((b) => {
        const c = state.characters[b.id];
        if (!c) return null;
        const editable = mayEditCharacter(seat, b.id);
        const owed = c.concentrationChecks[0];
        return (
          <div className="pm" key={b.id}>
            <div className="pm-top">
              <span className="pm-name">{b.name}</span>
              <span className="pm-hp num">
                {c.currentHp}<span className="faint"> / {b.maxHp}</span>
                {c.tempHp > 0 && <span className="pm-temp"> +{c.tempHp}</span>}
              </span>
            </div>
            <HpBar current={c.currentHp} max={b.maxHp} />
            <div className="pm-meta">
              <span className="label">{VAGUE_LABEL[healthStep(c.currentHp, b.maxHp)]}</span>
              {c.concentratingOn && <span className="chip conc">{c.concentratingOn}</span>}
              {owed && <span className="chip conc">Save owed · DC {owed.dc}</span>}
              {c.currentHp === 0 && (
                <span className="label" style={{ color: "var(--near)" }}>
                  Down · {c.deathSaves.successes}✓ {c.deathSaves.failures}✕
                </span>
              )}
              {c.conditions.map((cond) => (
                <span className="chip bad" key={cond}>{cond}</span>
              ))}
            </div>
            {c.boons.length > 0 && (
              <div className="pm-meta">
                {c.boons.map((bn) => (
                  <button
                    className="chip boon"
                    key={bn.id}
                    aria-label={`Remove ${bn.name} from ${b.name}`}
                    onClick={() => append({ type: "boonRemoved", who: b.id, boonId: bn.id })}
                  >
                    {describeBoon(bn)}
                  </button>
                ))}
              </div>
            )}
            {editable && (
              <>
                <div className="pm-acts">
                  {/* One number, three buttons, and nothing saying it is how
                      MUCH — the box read as whatever you last used it for. */}
                  <span className="label pm-howmuch">How much</span>
                  <Num min={0} value={amountOf(b.id)}
                    aria-label={`${b.name} amount`}
                    style={{ width: 62 }}
                    onChange={(n) => setAmount(b.id, n)}
                  />
                  <button onClick={() => append({ type: "damageApplied", who: b.id, amount: amountOf(b.id) })}>
                    Damage
                  </button>
                  <button onClick={() => append({ type: "healingApplied", who: b.id, amount: amountOf(b.id) })}>
                    Heal
                  </button>
                  <button onClick={() => append({ type: "tempHpGranted", who: b.id, amount: amountOf(b.id) })}>
                    Temp
                  </button>
                  <button
                    aria-label={`Give ${b.name} a boon`}
                    onClick={() => setBoonFor(boonFor === b.id ? null : b.id)}
                  >
                    Boon
                  </button>
                </div>
                {boonFor === b.id && (
                  <div className="pm-boons">
                    {COMMON_BOONS.map((bn) => (
                      <button className="chip" key={bn.name} onClick={() => grant(b.id, bn)}>
                        {describeBoon(bn as Boon)}
                      </button>
                    ))}
                    <input
                      aria-label={`Custom boon for ${b.name}`}
                      placeholder="Something else…"
                      onKeyDown={(e) => {
                        const v = e.currentTarget.value.trim();
                        if (e.key !== "Enter" || !v) return;
                        grant(b.id, { name: v, applies: ["attack", "save", "check"] });
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Loot found together lands here, to be divided later — which is what
          a table actually does with "you find 500 gp and a sword". */}
      {seat.kind === "dm" && (
        <div className="card-body stash">
          <div className="row">
            <input
              value={loot}
              aria-label="Loot"
              placeholder="120 gp, or an item name"
              style={{ flex: "2 1 150px", width: "auto" }}
              onChange={(e) => setLoot(e.target.value)}
            />
            <button
              disabled={!loot.trim()}
              onClick={() => {
                const coins = parseCoins(loot);
                append({
                  type: "lootGranted",
                  to: { kind: "party" },
                  items: coins === null
                    ? [{ itemId: `found-${loot.trim().toLowerCase().replace(/\W+/g, "-")}`, name: loot.trim(), qty: 1 }]
                    : [],
                  coins: coins ?? 0,
                });
                setLoot("");
              }}
            >
              To the party
            </button>
          </div>

          {(state.stash.coins > 0 || state.stash.items.length > 0) && (
            <div className="inv" style={{ padding: "8px 0 0" }}>
              <span className="label cr-sub">Not yet divided</span>
              {state.stash.coins > 0 && (
                <div className="inv-row">
                  <span className="nm num">{formatCoins(state.stash.coins)}</span>
                  <button
                    onClick={() =>
                      append({ type: "stashCoinsSplit", among: builds.map((x) => x.id) })
                    }
                  >
                    Split {builds.length} ways
                  </button>
                </div>
              )}
              {state.stash.items.map((it) => (
                <div className="inv-row" key={`${it.itemId}:${it.note ?? ""}`}>
                  <span className="nm">{it.name}</span>
                  <select
                    aria-label={`Give ${it.name} to`}
                    value=""
                    style={{ width: "auto", flex: "0 1 130px" }}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      append({
                        type: "stashAssigned",
                        to: e.target.value,
                        itemId: it.itemId,
                        name: it.name,
                        qty: 1,
                        ...(it.note === undefined ? {} : { note: it.note }),
                      });
                    }}
                  >
                    <option value="">give to…</option>
                    {builds.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
