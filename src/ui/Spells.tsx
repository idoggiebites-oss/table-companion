/**
 * The spell list.
 *
 * Grouped by level and led by the slots, because the first question at a table
 * is never "what do I know" — it is "what can I still cast". A spell you
 * cannot pay for is shown and disabled rather than hidden, so the answer to
 * "why not" is on screen.
 *
 * Casting asks which slot when there is a choice. Upcasting is the most
 * commonly forgotten option in play, because nothing on a paper sheet suggests
 * a 1st-level spell can go in a 3rd-level slot; here the options are simply
 * listed. Where there is no choice — a cantrip, or one slot left — it casts
 * without asking.
 *
 * Browsing needs a compendium. The SRD ships no spell list, so rather than
 * pretend, an empty state says where spells come from.
 */

import { useEffect, useMemo, useState } from "react";
import type { EffectiveBuild } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import type { CharacterState } from "../domain/project.js";
import {
  byBookOrder, canCast, castableBy, groupByLevel, isClassFeature, isReady, levelLabel,
  slotsFor, toKnown,
  type KnownSpell, type SlotState,
} from "../domain/spells.js";
import type { CompendiumSpell } from "../import/compendium.js";
import type { Combat, Combatant } from "../domain/combat.js";
import type { Stance, StanceReason } from "../domain/stance.js";
import { costOf } from "../domain/spellcast.js";
import { AimSpell } from "./AimSpell.js";
import { useCasting } from "./useCasting.js";
import { useHomebrew } from "./useHomebrew.js";
import { HomebrewToggle } from "./HomebrewToggle.js";
import { isCore } from "../domain/marks.js";
import { SpellPick } from "./SpellPick.js";

export function Spells({
  build, state, append, combat, stanceAt, onCast,
}: {
  build: EffectiveBuild;
  state: CharacterState;
  append: (body: EventBody) => void;
  /** Present during a fight: casting then aims at something. */
  combat?: Combat | null;
  /** How the dice fall against a target, and why. Absent outside a fight. */
  stanceAt?: (target: Combatant) => { stance: Stance; reasons: readonly StanceReason[] };
  onCast?: (c: {
    spell: KnownSpell;
    atLevel: number;
    target: Combatant;
    toHit: number | null;
    damage: number;
    damageType: string;
  }) => void;
}) {
  const [browsing, setBrowsing] = useState(false);
  const [text, setText] = useState("");
  const [onlyMine, setOnlyMine] = useState(true);
  const [showFeatures, setShowFeatures] = useState(false);
  const [homebrew, setHomebrew] = useHomebrew();
  const [casting, setCasting] = useState<KnownSpell | null>(null);
  const [aiming, setAiming] = useState<
    { spell: KnownSpell; atLevel: number; ritual: boolean } | null
  >(null);
  const [open, setOpen] = useState<string | null>(null);

  const { book, slots, costFor, canAfford, commit } = useCasting({
    build, state, combat, append,
  });

  const classIds = build.classes.map((c) => c.classId);
  const known = state.spells;
  const groups = groupByLevel(known);

  const hiddenFeatures = useMemo(
    () => (book ? book.filter((s) => isClassFeature(s)).length : 0),
    [book],
  );

  const results = useMemo(() => {
    if (!book) return [];
    const q = text.trim().toLowerCase();
    const have = new Set(known.map((s) => s.id));
    return book
      .filter((s) => {
        if (have.has(s.id)) return false;
        // Two thirds of a complete compendium's spells are somebody else's.
        if (!homebrew && !isCore(s.name)) return false;
        if (!showFeatures && isClassFeature(s)) return false;
        if (q && !s.name.toLowerCase().includes(q)) return false;
        if (onlyMine && !classIds.some((c) => castableBy(s, c))) return false;
        return true;
      })
      .sort(byBookOrder)
      .slice(0, 60);
  }, [book, text, onlyMine, showFeatures, known, classIds, homebrew]);

  /*
   * In a fight, casting is not finished until it has been pointed at
   * something — so nothing is spent until then.
   *
   * It used to spend the slot and the action here and ask who you were aiming
   * at afterwards. The aim lived in this tab, and the app sends you to this
   * tab from the fight, so switching back to see the goblin's health threw the
   * aim away: no claim ever reached the DM, and the player was left with the
   * slot gone, the action gone, and nothing cast. That is the worst trade in
   * the app, and it was one tap away.
   *
   * A weapon attack already worked this way — Swing claims and spends at the
   * same moment, when you send it.
   */
  function cast(spell: KnownSpell, atLevel: number, ritual = false) {
    setCasting(null);
    if (combat) {
      setAiming({ spell, atLevel, ritual });
      return;
    }
    commit(spell, atLevel, ritual);
  }

  return (
    <>
      <section className="card">
        <div className="card-hd">
          <span className="label">Slots</span>
          <button onClick={() => setBrowsing((v) => !v)}>
            {browsing ? "Done" : "Add spells"}
          </button>
        </div>
        <div className="slots">
          {slots.map((s) => (
            <div className={`slot${s.left === 0 ? " out" : ""}`} key={s.level}>
              <b className="num">{s.left}</b>
              <span className="label">{levelLabel(s.level)}</span>
            </div>
          ))}
          {slots.length === 0 && (
            <p className="faint" style={{ margin: 0, fontSize: ".86rem" }}>
              No spell slots. Cantrips still work.
            </p>
          )}
        </div>
        {state.concentratingOn && (
          <p className="faint src-note">
            Concentrating on <b>{state.concentratingOn}</b>. Casting another
            concentration spell replaces it.
          </p>
        )}
      </section>

      {browsing && (
        <section className="card">
          <div className="card-hd">
            <span className="label">Add spells</span>
            <button
              className={onlyMine ? "on" : ""}
              aria-pressed={onlyMine}
              onClick={() => setOnlyMine((v) => !v)}
            >
              {onlyMine ? `${classIds.join("/")} only` : "Everything"}
            </button>
          </div>
          <div className="card-body">
            {book === null && <p className="faint" style={{ margin: 0 }}>Loading…</p>}
            {book?.length === 0 && (
              <p className="faint" style={{ margin: 0, fontSize: ".86rem" }}>
                No spells on this device. The SRD data this app ships has no
                spell list — import a compendium under Gear to get one.
              </p>
            )}
            {book && book.length > 0 && (
              <>
                <input
                  value={text}
                  aria-label="Search spells"
                  placeholder="fireball, cure wounds…"
                  onChange={(e) => setText(e.target.value)}
                />
                {/* Compendiums file invocations, maneuvers and the like under
                    spells. Hidden rather than dropped — somebody tracks them,
                    just not from here. */}
                {book && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <HomebrewToggle
                      on={homebrew}
                      hidden={book.filter((sp) => !isCore(sp.name)).length}
                      onChange={setHomebrew}
                    />
                  </div>
                )}
                {hiddenFeatures > 0 && (
                  <button
                    className={`chip${showFeatures ? " on" : ""}`}
                    aria-pressed={showFeatures}
                    style={{ marginTop: 10 }}
                    onClick={() => setShowFeatures((v) => !v)}
                  >
                    {hiddenFeatures} class features filed as spells
                  </button>
                )}
                <div className="inv-find">
                  {/* Same as the builder: a name is not a choice. */}
                  <SpellPick
                    spells={results}
                    actionLabel="Learn it"
                    onPick={(sp) =>
                      append({ type: "spellLearned", who: build.id, spell: toKnown(sp) })
                    }
                  />
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {groups.map((g) => (
        <section className="card" key={g.level}>
          <div className="card-hd">
            <span className="label">{levelLabel(g.level)}</span>
            {g.level > 0 && (
              <span className="label faint">
                {g.spells.filter((s) => s.prepared).length} prepared
              </span>
            )}
          </div>
          {g.spells.map((s) => {
            const ready = isReady(s);
            const able = canCast(s, slots);
            return (
              <div className="sp" key={s.id}>
                <button className="sp-main" onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <span className="nm">
                    {s.name}
                    {s.concentration && <> <span className="hb">conc</span></>}
                    {s.ritual && <> <span className="hb">ritual</span></>}
                  </span>
                  <span className="faint">{s.school}</span>
                </button>
                {g.level > 0 && (
                  <button
                    className={`chip${s.prepared ? " on" : ""}`}
                    aria-label={`${s.prepared ? "Unprepare" : "Prepare"} ${s.name}`}
                    onClick={() =>
                      append({
                        type: "spellPrepared", who: build.id, spellId: s.id, prepared: !s.prepared,
                      })
                    }
                  >
                    {s.prepared ? "Prepared" : "Prepare"}
                  </button>
                )}
                <button
                  disabled={!able || !canAfford(s)}
                  aria-label={`Cast ${s.name}`}
                  onClick={() => {
                    const options = slotsFor(s, slots);
                    // No choice to make: a cantrip, or exactly one slot left.
                    if (s.level === 0) return cast(s, 0);
                    if (options.length === 1) return cast(s, options[0]!.level);
                    setCasting(s);
                  }}
                >
                  Cast
                </button>
                {open === s.id && (
                  <div className="sp-detail">
                    <span className="faint">
                      {!ready
                        ? "Not prepared."
                        : !able
                          ? "No slot left for this."
                          : !canAfford(s)
                            ? costFor(s) === "long"
                              ? "Takes longer than a turn — not in a fight."
                              : `Your ${costFor(s)} is gone this turn.`
                            : s.level === 0
                              ? `Costs nothing but your ${costFor(s)}.`
                              : `A ${levelLabel(s.level).toLowerCase()} slot and your ${costFor(s)}.`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}

      {known.length === 0 && !browsing && (
        <section className="card">
          <div className="card-body">
            <p className="faint" style={{ margin: 0, fontSize: ".88rem" }}>
              No spells yet. Add some — they come from an imported compendium,
              since the SRD data this app ships has no spell list.
            </p>
          </div>
        </section>
      )}

      {aiming && combat && (
        <AimSpell
          spell={aiming.spell}
          atLevel={aiming.atLevel}
          build={build}
          book={book ?? []}
          loading={book === null}
          combat={combat}
          stanceAt={stanceAt ?? (() => ({ stance: "straight" as const, reasons: [] }))}
          onCancel={() => setAiming(null)}
          onDone={(aim) => {
            commit(aiming.spell, aiming.atLevel, aiming.ritual);
            // A spell with nothing to roll is still cast; it just leaves the
            // DM nothing to rule on.
            if (aim) onCast?.({ ...aim, spell: aiming.spell, atLevel: aiming.atLevel });
            setAiming(null);
          }}
        />
      )}

      {casting && (
        <div className="tgt sp-cast">
          <span className="label">Cast {casting.name} at</span>
          {slotsFor(casting, slots).map((s) => (
            <button className="tgt-row" key={s.level} onClick={() => cast(casting, s.level)}>
              {levelLabel(s.level)}
              <span className="faint num"> · {s.left} left</span>
            </button>
          ))}
          {casting.ritual && (
            <button className="tgt-row" onClick={() => cast(casting, 0, true)}>
              As a ritual <span className="faint">· no slot</span>
            </button>
          )}
          <button onClick={() => setCasting(null)}>Cancel</button>
        </div>
      )}
    </>
  );
}
