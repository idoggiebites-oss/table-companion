/**
 * Resolving a level.
 *
 * Pending, never interrupting. Crossing a threshold mid-fight must not put a
 * card on anyone's screen — the combat study drew a hard line about that: the
 * card becomes the prompt only when nothing else is true, and a concentration
 * save qualifies because it is owed NOW. A level-up never is. So this is a
 * quiet banner the player opens at a rest, between sessions, or whenever they
 * look.
 *
 * Hit points are a physical roll like everything else — the app names the die
 * and holds the modifier — or the fixed average, which most tables settle once
 * and never revisit.
 */

import { useEffect, useState } from "react";
import { ABILITIES, formatModifier, type Ability } from "../domain/abilities.js";
import type { CompendiumFeat } from "../import/compendium.js";
import {
  loadClassLevels, loadClasses, loadFeats, type ClassEntry, type ClassLevels,
} from "../store/srd.js";
import { multiclassBlock } from "../domain/multiclass.js";
import { FeatPick } from "./FeatPick.js";
import { SpellPick } from "./SpellPick.js";
import { useHomebrew } from "./useHomebrew.js";
import { HomebrewToggle } from "./HomebrewToggle.js";
import { isCore } from "../domain/marks.js";
import { useSpellbook } from "./useCasting.js";
import type { CharacterState } from "../domain/project.js";
import { choicesBy, findChoices, ownerOf } from "../domain/subclass.js";
import { byBook } from "../domain/books.js";
import { castableBy, isClassFeature, toKnown, type KnownSpell } from "../domain/spells.js";
import { effectsOf } from "../domain/featvariants.js";
import type { EffectiveBuild } from "../domain/build.js";
import type { EventBody } from "../domain/events.js";
import type { ClassId, DieSize } from "../domain/resources.js";

/** The fixed alternative to rolling: half the die, rounded up. */
export function averageGain(die: number, conMod: number): number {
  return Math.max(1, Math.floor(die / 2) + 1 + conMod);
}

export function LevelUp({
  build, state, owed, append,
}: {
  build: EffectiveBuild;
  /** For what they already know — spells learned are not on the build. */
  state: CharacterState;
  owed: number;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState<ClassId>(build.classes[0]!.classId);
  const [levels, setLevels] = useState<ClassLevels | null>(null);
  const [feats, setFeats] = useState<CompendiumFeat[]>([]);
  const [route, setRoute] = useState<"asi" | "feat">("asi");
  const [bumps, setBumps] = useState<Partial<Record<Ability, number>>>({});
  const [featId, setFeatId] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [learned, setLearned] = useState<KnownSpell[]>([]);
  const [classList, setClassList] = useState<ClassEntry[] | null>(null);
  const [homebrew, setHomebrew] = useHomebrew();
  /** Which choices the player asked to see in full. */
  const [openAll, setOpenAll] = useState<Record<string, boolean>>({});
  /*
   * Nothing until there is a level to spend.
   *
   * This component returns null when nothing is owed, but hooks run first —
   * so every player's device pulled four megabytes of spellbook, the feat
   * list and the class tables on load, whether or not they had levelled and
   * whether or not they cast anything at all. A fighter's phone was paying
   * for a wizard's picker.
   */
  const owing = owed > 0;
  const book = useSpellbook(owing);

  useEffect(() => {
    if (!owing) return;
    loadClassLevels().then(setLevels, () => setLevels({}));
    loadFeats().then(setFeats, () => setFeats([]));
    loadClasses().then(setClassList, () => setClassList([]));
  }, [owing]);

  if (!owing) return null;

  const conMod = build.abilityMods.con;
  /** Classes they do not have yet, offered as a dip. */
  const others = (classList ?? []).filter(
    (k) => !build.classes.some((c) => c.classId === k.id),
  );
  const isNew = !build.classes.some((c) => c.classId === classId);
  const block = isNew
    ? multiclassBlock({ from: build.classes, into: classId, abilities: build.abilities })
    : null;

  /** A dip rolls its new class's die, not the one they started with. */
  const newClass = (classList ?? []).find((k) => k.id === classId);
  const die = (isNew ? (newClass?.hitDie as DieSize | undefined) : undefined) ?? build.hitDie;
  const average = averageGain(die, conMod);
  const to = build.totalLevel + 1;

  /**
   * Which levels grant an improvement is per class — fighters get extra ones
   * at 6 and 14, rogues at 10 — so it comes from the table rather than a
   * remembered 4/8/12/16/19.
   */
  const nextLevel = build.classes.find((c) => c.classId === classId)?.level ?? 0;
  const grantsChoice = (levels?.[classId]?.[nextLevel]?.asi ?? false);

  /*
   * What this level actually gives them.
   *
   * The level-up asked for hit points and an improvement and stopped. It
   * never asked for a subclass — build at 1, reach 3, and nothing ever
   * prompted you — never said which spells were learned, and never named the
   * features gained. Every character meets that; only some multiclass.
   */
  const rows = levels?.[classId] ?? [];
  const row = rows[nextLevel];
  const previous = rows[nextLevel - 1];

  /** A choice this level opens and nobody has answered — the subclass at 3. */
  const allFeatures = rows.flatMap((r) => r.features.map((n) => ({ level: r.level, name: n })));
  const points = findChoices(allFeatures);
  /** Every name that IS an option, so a parenthetical can be told from one. */
  const options = new Set(points.flatMap((p) => p.options.map((o) => o.name)));
  const answered = new Set(build.choices.map((c) => c.of));
  const opening = choicesBy(points, to).filter((c) => !answered.has(c.of));

  /*
   * What THIS character gains, not what the class table lists.
   *
   * A compendium class table carries every subclass's features at every
   * level, so a cleric reaching 2 was told they gained "Fear and Surprise
   * (Inquisition Domain (HB))" and "Channel Divinity (Snack Domain (HB))".
   * A feature in parentheses belongs to an option; it is theirs only if they
   * took that option.
   */
  const mine = new Set(build.choices.map((c) => c.name));
  const gained = (row?.features ?? [])
    .filter((n) => !/^.{3,40}?:\s/.test(n))
    .filter((n) => {
      /*
       * A trailing parenthetical is an option name only if it IS one. Not
       * every one is: "Action Surge (one use)" is a plain class feature, and
       * a rule that read it as a subclass would drop it from the list of
       * things you just gained.
       */
      const owner = ownerOf(n, options);
      return owner === null || mine.has(owner);
    });

  /** How many more spells and cantrips the class table says they know. */
  const newCantrips = Math.max(0, (row?.cantrips ?? 0) - (previous?.cantrips ?? 0));
  const newSpells = Math.max(0, (row?.known ?? 0) - (previous?.known ?? 0));
  const owedSpells = newCantrips + newSpells;
  const classIds = build.classes.map((c) => c.classId);
  const have = new Set([...state.spells.map((sp) => sp.id), ...learned.map((sp) => sp.id)]);
  const offerable = (book ?? []).filter(
    (sp) =>
      !have.has(sp.id) &&
      // Same switch as the builder: this list is drawn from the same file.
      (homebrew || isCore(sp.name)) &&
      !isClassFeature(sp) &&
      classIds.some((c) => castableBy(sp, c, { homebrew })) &&
      (learned.filter((x) => x.level === 0).length < newCantrips
        ? sp.level === 0
        : sp.level > 0 && sp.level <= Math.ceil(to / 2)),
  );

  const spent = ABILITIES.reduce((n, a) => n + (bumps[a] ?? 0), 0);
  const chosenFeat = feats.find((f) => f.id === featId);
  /*
   * Who the prerequisites are measured against. The scores are the ones they
   * have now — a feat is taken at the same moment as the improvement it
   * replaces, so there is no bump to count.
   */
  const aspirant = {
    abilities: build.abilities,
    spellSlots: build.spellSlots,
    knowsSpells: build.spellSlots.some((n) => n > 0),
    race: build.race,
  };
  const choiceReady = block === null &&
    (!grantsChoice || (route === "asi" ? spent === 2 : chosenFeat !== undefined)) &&
    opening.every((c) => pick[c.of]) &&
    learned.length >= owedSpells;

  const gain = (rolled: number) => {
    append({
      type: "levelGained",
      who: build.id,
      classId,
      hpGain: Math.max(1, rolled + conMod),
      ...(isNew && newClass ? { hitDie: newClass.hitDie as DieSize } : {}),
      ...(grantsChoice && route === "asi" ? { abilities: bumps } : {}),
      /*
       * A half-feat's +1 goes through the same field an improvement does, so
       * the sheet moves. The feat itself stays recorded rather than
       * mechanised — this is the one number it is fair to be sure about.
       */
      ...(opening.some((c) => pick[c.of])
        ? {
            picks: opening
              .filter((c) => pick[c.of])
              .map((c) => ({ of: c.of, name: pick[c.of]! })),
          }
        : {}),
      ...(grantsChoice && route === "feat" && chosenFeat
        ? {
            feat: { id: chosenFeat.id, name: chosenFeat.name },
            ...(effectsOf(chosenFeat).increase
              ? { abilities: { [effectsOf(chosenFeat).increase!]: 1 } }
              : {}),
            ...(effectsOf(chosenFeat).saveProficiency
              ? { save: effectsOf(chosenFeat).saveProficiency }
              : {}),
          }
        : {}),
    });
    // A subclass and the spells it opens are their own events: undoing the
    // level should take back everything the level gave.
    for (const sp of learned) {
      append({ type: "spellLearned", who: build.id, spell: sp });
    }
    setOpen(false);
    setBumps({});
    setFeatId("");
    setPick({});
    setLearned([]);
  };

  return (
    <section className="card lv">
      <div className="lv-head">
        <span className="lv-k">Level up</span>
        <span className="lv-n">
          {build.classes.map((c) => c.classId).join(" / ")} {to}
        </span>
        <span className="lv-s">
          from level {build.totalLevel}
          {owed > 1 ? ` · ${owed} owed` : ""}
        </span>
      </div>

      {!open ? (
        <div className="card-body">
          <button onClick={() => setOpen(true)}>Resolve it</button>
          <p className="faint note">
            Nothing is waiting on this. Take it at a rest.
          </p>
        </div>
      ) : (
        <div className="card-body">
          {/*
            * Where this level goes. Multiclassing happens here rather than in
            * the builder because that is how it happens at a table: somebody
            * reaches 5 and dips warlock, having played four sessions as a
            * fighter.
            */}
          <div className="row mb-3">
            <span className="label">In</span>
            <select
              aria-label="Class to level"
              value={classId}
              style={{ width: "auto" }}
              onChange={(e) => setClassId(e.target.value as ClassId)}
            >
              {build.classes.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.classId} {c.level} → {c.level + 1}
                </option>
              ))}
              {others.length > 0 && (
                <optgroup label="Something new">
                  {others.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/*
            * The rule cuts both ways, and people forget the first half: a new
            * class asks for its own minimum AND the one you already have.
            */}
          {block && (
            <p className="lv-block">
              {block} Pick a class you qualify for, or raise the score first.
            </p>
          )}
          {isNew && !block && (
            <p className="cr-note mt-0">
              A first level in {classId} brings its hit die and its own
              proficiencies — not the ones a {classId} gets at level 1 from
              scratch. Saving throws stay with your first class.
            </p>
          )}

          {grantsChoice && (
            <div className="lv-choice">
              <span className="label cr-sub">This level, you may improve or take a feat</span>
              <div className="seg">
                <button
                  aria-pressed={route === "asi"}
                  className={route === "asi" ? "on" : ""}
                  onClick={() => setRoute("asi")}
                >
                  Raise abilities
                </button>
                <button
                  aria-pressed={route === "feat"}
                  className={route === "feat" ? "on" : ""}
                  disabled={feats.length === 0}
                  onClick={() => setRoute("feat")}
                >
                  Take a feat
                </button>
              </div>

              {route === "asi" ? (
                <>
                  <p className="faint note">
                    Two points: both into one ability, or one each into two.
                    Nothing goes above 20. {2 - spent} left.
                  </p>
                  <div className="lv-abils">
                    {ABILITIES.map((a) => {
                      const at = build.abilities[a];
                      const added = bumps[a] ?? 0;
                      const capped = at + added >= 20;
                      return (
                        <button
                          key={a}
                          className={`chip${added > 0 ? " on" : ""}`}
                          disabled={(spent >= 2 && added === 0) || capped}
                          aria-label={`Raise ${a}`}
                          onClick={() =>
                            setBumps((b) => ({ ...b, [a]: (b[a] ?? 0) + 1 }))
                          }
                        >
                          {a} {at + added}
                          {added > 0 ? ` (+${added})` : ""}
                        </button>
                      );
                    })}
                  </div>
                  {spent > 0 && (
                    <button onClick={() => setBumps({})} className="mt-2">
                      Start over
                    </button>
                  )}
                </>
              ) : (
                <FeatPick
                  feats={feats}
                  who={aspirant}
                  {...(featId ? { taken: featId } : {})}
                  onPick={(f) => setFeatId(f?.id ?? "")}
                />
              )}
            </div>
          )}

          {/*
            * What the level actually gives. It used to give hit points and an
            * improvement and say nothing else — so a character reached 3 and
            * was never asked for a subclass, learned spells nobody mentioned,
            * and gained features that appeared silently on the sheet.
            */}
          {/*
            * What changes, before what to choose.
            *
            * A level-up IS a diff, and the screen opened with a class
            * dropdown and a wall of options — so the one thing a player
            * actually wants to know, "what do I get", was the one thing it
            * did not say. Both rows are already in the class table; only the
            * arithmetic between them is new.
            */}
          {row && (
            <div className="ba">
              <div className="ba-col">
                <span className="label">{classId} {nextLevel}</span>
                <span className="ba-r"><span>Hit points</span><b>{build.maxHp}</b></span>
                <span className="ba-r">
                  <span>Proficiency</span><b>{formatModifier(previous?.profBonus ?? build.proficiencyBonus)}</b>
                </span>
                {(previous?.slots ?? []).some((n) => n > 0) && (
                  <span className="ba-r">
                    <span>Slots</span>
                    <b>{(previous?.slots ?? []).filter((n) => n > 0).join("/")}</b>
                  </span>
                )}
              </div>
              <span className="ba-arrow" aria-hidden="true">›</span>
              <div className="ba-col to">
                <span className="label">{classId} {nextLevel + 1}</span>
                {/* They have not rolled yet, so the average is the only
                    honest number to show — and it is the one most people
                    take. */}
                <span className="ba-r moved">
                  <span>Hit points</span><b>+{average} avg</b>
                </span>
                <span className={`ba-r${(row.profBonus ?? 0) !== (previous?.profBonus ?? 0) ? " moved" : ""}`}>
                  <span>Proficiency</span><b>{formatModifier(row.profBonus)}</b>
                </span>
                {row.slots.some((n) => n > 0) && (
                  <span
                    className={`ba-r${
                      row.slots.join("/") !== (previous?.slots ?? []).join("/") ? " moved" : ""
                    }`}
                  >
                    <span>Slots</span><b>{row.slots.filter((n) => n > 0).join("/")}</b>
                  </span>
                )}
              </div>
            </div>
          )}

          {gained.length > 0 && (
            <p className="lv-gains">
              <span className="label">You gain</span> {gained.join(" · ")}
            </p>
          )}

          {/*
            * A choice, not a wall.
            *
            * This was thirty fighting styles and forty archetypes as chips,
            * every one of them shown at once — and the homebrew switch that
            * reaches spells, feats, races and classes never reached here, so
            * three quarters of what was on screen was somebody else's. The
            * game's own are cards; everything else is behind a tap.
            */}
          {opening.map((c) => {
            // On the FULL name: the display name has its marker stripped, so
            // this filter matched everything and hid nothing.
            const core = c.options.filter((o) => isCore(o.full));
            const shown = (homebrew || core.length === 0 ? c.options : core)
              .slice(0, openAll[c.of] ? 200 : 6);
            const hidden = (homebrew ? c.options.length : core.length) - shown.length;
            const marked = c.options.length - core.length;
            return (
              <div className="lv-choice" key={c.of}>
                <span className="label">{c.of}</span>
                {/* Under the book that printed it — see books.ts. */}
                {byBook(shown).map(([book, options]) => (
                  <div className="lv-book" key={book}>
                    <span className="label q">{book}</span>
                    <div className="picks">
                      {options.map((o) => (
                        <button
                          key={o.name}
                          className={`pick${pick[c.of] === o.name ? " on" : ""}`}
                          aria-pressed={pick[c.of] === o.name}
                          aria-label={`${c.of}: ${o.name}`}
                          onClick={() => setPick({ ...pick, [c.of]: o.name })}
                        >
                          <span className="nm">{o.name}</span>
                          {o.text && (
                            <span className="faint">{o.text.slice(0, 90)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="row mt-2">
                  {hidden > 0 && (
                    <button
                      aria-label={`Browse all ${c.of}`}
                      onClick={() => setOpenAll({ ...openAll, [c.of]: !openAll[c.of] })}
                    >
                      {openAll[c.of] ? "Show fewer" : `Browse all ${hidden + shown.length}`}
                    </button>
                  )}
                  {marked > 0 && (
                    <HomebrewToggle on={homebrew} hidden={marked} onChange={setHomebrew} />
                  )}
                </div>
                {pick[c.of] && (
                  <p className="faint note">
                    {c.options.find((o) => o.name === pick[c.of])?.text?.slice(0, 220) ??
                      "Chosen. The features it grants are on your sheet."}
                  </p>
                )}
              </div>
            );
          })}

          {owedSpells > 0 && (
            <div className="lv-choice">
              <span className="label">
                {learned.length} of {owedSpells}{" "}
                {newCantrips > learned.filter((x) => x.level === 0).length
                  ? "cantrips"
                  : "spells"}
              </span>
              {(book ?? []).some((sp) => !isCore(sp.name)) && (
                <div className="row mb-2">
                  <HomebrewToggle
                    on={homebrew}
                    hidden={(book ?? []).filter((sp) => !isCore(sp.name)).length}
                    onChange={setHomebrew}
                  />
                </div>
              )}
              {book === null ? (
                <p className="faint note">
                  Looking up what you can learn…
                </p>
              ) : (
                <SpellPick
                  spells={offerable.slice(0, 60)}
                  actionLabel="Learn it"
                  onPick={(sp) => setLearned([...learned, toKnown(sp)])}
                />
              )}
              {learned.length > 0 && (
                <div className="chips mt-2">
                  {learned.map((sp) => (
                    <button
                      key={sp.id}
                      className="chip on"
                      aria-label={`Forget ${sp.name}`}
                      onClick={() => setLearned(learned.filter((x) => x.id !== sp.id))}
                    >
                      {sp.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="lv-ask">
            Roll a <strong>d{die}</strong> for hit points.
          </p>
          <p className="faint note">
            Add your Constitution modifier of {formatModifier(conMod)}. Tap what you rolled.
          </p>
          <div className="lv-pad">
            {Array.from({ length: die }, (_, i) => i + 1).map((face) => (
              <button key={face} disabled={!choiceReady} onClick={() => gain(face)}>
                {face}
              </button>
            ))}
          </div>

          <div className="lv-or"><i /><span>or</span><i /></div>
          <button className="lv-avg" disabled={!choiceReady} onClick={() => gain(average - conMod)}>
            Take the average · {average}
          </button>

          <p className="faint note">
            Everything derived moves with it — proficiency, skills, saves,
            attacks, hit dice. Choices like a new spell are yours to make,
            here or in your builder.
          </p>
        </div>
      )}
    </section>
  );
}
