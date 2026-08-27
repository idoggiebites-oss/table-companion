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

import { useMemo, useState } from "react";
import { useHold } from "./useHold.js";
import { Popover } from "./Popover.js";
import type { EffectiveBuild } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import type { CharacterState } from "../domain/project.js";
import {
  byBookOrder, canCast, castableBy, groupByLevel, isClassFeature, isReady, levelLabel,
  slotsFor, toKnown,
  type KnownSpell,
} from "../domain/spells.js";
import type { Combat, Combatant } from "../domain/combat.js";
import type { Stance, StanceReason } from "../domain/stance.js";
import { AimSpell } from "./AimSpell.js";
import { useCasting } from "./useCasting.js";
import { useHomebrew } from "./useHomebrew.js";
import { HomebrewToggle } from "./HomebrewToggle.js";
import { isCore } from "../domain/marks.js";
import { SpellPick } from "./SpellPick.js";


/**
 * One spell, tappable to consider and holdable to read.
 *
 * The text is four hundred words and the row is forty pixels; printing it on
 * every tile turns a list into a book, and putting it behind the tap collides
 * with casting. A hold is the phone gesture for "what is this", costs nothing
 * when unused, and cannot be hit by accident mid-turn.
 */
function SpellTile({
  spell, able, open, onOpen, onRead, children,
}: {
  spell: KnownSpell;
  able: boolean;
  open: boolean;
  onOpen: () => void;
  onRead: () => void;
  children: React.ReactNode;
}) {
  const hold = useHold(onRead);
  return (
    <button
      className={`sp-tile${able ? " ready" : " no"}${open ? " on" : ""}`}
      aria-label={`${spell.name}, ${able ? "ready" : "not ready"}`}
      aria-expanded={open}
      onClick={onOpen}
      {...hold}
    >
      {children}
    </button>
  );
}

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
    /** Everyone the spell caught — a blast is one roll and several saves. */
    targets: readonly Combatant[];
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
  /*
   * The spell somebody is holding down to read. Separate from `open`, which
   * is "I am thinking about casting this" — a tap on this grid means cast,
   * and a row that both casts and explains is a row nobody trusts.
   */
  const [reading, setReading] = useState<KnownSpell | null>(null);

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
        if (onlyMine && !classIds.some((c) => castableBy(s, c, { homebrew }))) return false;
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

      {/*
        * A grid, not a list.
        *
        * Twelve rows of name-and-school is twelve things read one at a time;
        * the same twelve as tiles is one glance. What a spell COSTS is on its
        * face, because that is the question — and what you cannot pay for is
        * dimmed rather than hidden, because "why can't I cast this" is the
        * next question and a missing row cannot answer it.
        */}
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
          <div className="card-body">
            <div className="sp-grid">
              {g.spells.map((s) => {
                const able = isReady(s) && canCast(s, slots) && canAfford(s);
                return (
                  <SpellTile
                    key={s.id}
                    spell={s}
                    able={able}
                    open={open === s.id}
                    onOpen={() => setOpen(open === s.id ? null : s.id)}
                    onRead={() => setReading(s)}
                  >
                    {s.concentration && <i className="conc" aria-hidden="true" />}
                    <span className="nm">{s.name}</span>
                    <span className="c">
                      <span className="cost">{s.level === 0 ? "cantrip" : levelLabel(s.level)}</span>
                      <span className="sc">{(s.school ?? "").slice(0, 3)}</span>
                    </span>
                  </SpellTile>
                );
              })}
            </div>

            {g.spells.filter((s) => open === s.id).map((s) => {
              const ready = isReady(s);
              const able = canCast(s, slots);
              return (
                <div className="sp-detail" key={s.id}>
                  <span className="nm">{s.name}</span>
                  <span className="faint">
                    {s.school}
                    {s.concentration ? " · concentration" : ""}
                    {s.ritual ? " · ritual" : ""}
                  </span>
                  <p className="why">
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
                  </p>
                  <div className="row">
                    <button
                      disabled={!able || !canAfford(s) || !ready}
                      aria-label={`Cast ${s.name}`}
                      onClick={() => {
                        const options = slotsFor(s, slots);
                        if (s.level === 0) return cast(s, 0);
                        if (options.length === 1) return cast(s, options[0]!.level);
                        setCasting(s);
                      }}
                    >
                      Cast
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
                  </div>
                </div>
              );
            })}
          </div>
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

      {/*
        * What a hold found. The compendium's own words, unedited — this is a
        * reference, and paraphrasing a spell is how a table ends up arguing
        * with the app instead of with the book.
        */}
      <Popover
        open={reading !== null}
        title={reading?.name ?? ""}
        onClose={() => setReading(null)}
        done="Close"
      >
        {reading && (() => {
          const full = (book ?? []).find((x) => x.id === reading.id);
          return (
            <>
              <span className="faint">
                {full
                  ? `${full.level === 0 ? "Cantrip" : levelLabel(full.level)} · ${full.school} · ${full.time} · ${full.range}`
                  : reading.level === 0 ? "Cantrip" : levelLabel(reading.level)}
              </span>
              {full?.text
                ? full.text.split(/\n{2,}/).map((para, i) => (
                    <p className="pop-text selectable" key={i}>{para}</p>
                  ))
                : <p className="pop-text faint">
                    No description shipped with this one — it came from a list
                    that carried the name and the numbers only.
                  </p>}
            </>
          );
        })()}
      </Popover>

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
