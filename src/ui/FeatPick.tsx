/**
 * Choosing a feat.
 *
 * It was a dropdown of eight hundred and fifty names, in two places. A
 * dropdown is right for picking something you already know and wrong for
 * choosing between things you have never read — and a feat IS its
 * description. "Sentinel" is not a choice; what Sentinel does is the choice.
 *
 * So: the same collapsed list the spells and the turn menu use. Names and
 * prerequisites, whole text on tap, and one button to take it. The ones this
 * app can prove you do not qualify for say so and cannot be taken; the ones
 * it cannot check state the requirement and let the table rule.
 */

import { useState } from "react";
import { byBook } from "../domain/books.js";
import { useHomebrew } from "./useHomebrew.js";
import { HomebrewToggle } from "./HomebrewToggle.js";
import { blocked, meets, type Aspirant, type FeatSource } from "../domain/feats.js";
import {
  baseName, effectsOf, featMark, groupVariants, hasChoice,
} from "../domain/featvariants.js";

export function FeatPick({
  feats, who, taken, onPick,
}: {
  feats: readonly FeatSource[];
  who: Aspirant;
  /** The one already chosen here, so it reads as chosen rather than absent. */
  taken?: string;
  onPick: (f: FeatSource | null) => void;
}) {
  const [homebrew, setHomebrew] = useHomebrew();
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  /*
   * Unfiltered, this is the game's own feats — all ninety-four of them, which
   * is a menu somebody can actually read. Typing searches the other seven
   * hundred and fifty-six as well.
   *
   * A flat cap was the wrong answer here for the reason it was wrong for
   * spells: sorted with the marked material last, the first sixty entries run
   * out at F, and Sentinel — one of the four feats a new player has actually
   * heard of — was unreachable without knowing to search for it.
   */
  /*
   * Grouped, because the compendium ships the choice already made: not
   * "Resilient" with a dropdown but six entries, one per ability. Collapsing
   * them back into one row is what turns the file's shape into a choice
   * somebody can make.
   *
   * Unfiltered this is the game's own feats. An ability or a damage type in
   * parentheses is an axis rather than a source — reading "(Constitution)"
   * the way "(HB)" is read hid Resilient, Observant, Athlete, Weapon Master
   * and Elemental Adept from the list entirely.
   */
  /*
   * The switch decides what is in the list; the filter searches what the
   * switch let in. It used to hide marked feats only while unfiltered, which
   * made searching a different list from browsing — and left somebody
   * wondering why a feat they could see yesterday was gone.
   */
  const q = filter.trim().toLowerCase();
  const allowed = feats.filter((f) => homebrew || featMark(f.name) === null);
  const rows = groupVariants(allowed.filter((f) => !q || f.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, q ? 60 : 200);

  const chosen = taken ? feats.find((f) => f.id === taken) : undefined;
  if (chosen) {
    const v = meets(chosen.prerequisite, who);
    return (
      <div className="feat-took">
        <div className="menu-row">
          <div className="menu-hd" aria-label={`${chosen.name}, taken`}>
            <span className="nm">{chosen.name}</span>
            <span className="cost">taken</span>
          </div>
          <div className="menu-more">
            {"unverified" in v && v.unverified && (
              <p className="what">Requires {v.unverified} — the DM decides.</p>
            )}
            <p className="then">{chosen.text}</p>
            <button className="menu-take" onClick={() => onPick(null)}>
              Choose something else
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="feat-pick">
      <input
        value={filter}
        aria-label="Filter feats"
        placeholder={`filter ${allowed.length} feats…`}
        onChange={(e) => setFilter(e.target.value)}
      />
      <HomebrewToggle
        on={homebrew}
        hidden={feats.length - allowed.length}
        onChange={setHomebrew}
      />
      <div className="menu feat-scroll">
        {/*
          * Under the book that printed it — see books.ts. Alphabetical across
          * two hundred names tells you nothing about which of them your table
          * actually owns.
          */}
        {byBook(rows, "feat").map(([book, group]) => (
        <div className="feat-book" key={book}>
        <span className="label q">{book}</span>
        {group.map((g) => {
          /* Every variant shares the prerequisite and the text; the first
             stands for the group until one is picked. */
          const head = g.variants[0]!;
          const v = meets(head.prerequisite, who);
          const no = blocked(v);
          const shown = open === g.name;
          return (
            <div className={`menu-row${no ? " off" : ""}`} key={g.name}>
              <button
                className="menu-hd"
                aria-expanded={shown}
                aria-label={g.name}
                onClick={() => setOpen(shown ? null : g.name)}
              >
                <span className="nm">{g.name}</span>
                <span className="cost">
                  {head.prerequisite || (hasChoice(g) ? `${g.variants.length} to choose from` : "")}
                </span>
              </button>
              {shown && (
                <div className="menu-more">
                  {no && <p className="what">{v.why}</p>}
                  {!no && "unverified" in v && v.unverified && (
                    <p className="what">Requires {v.unverified} — the DM decides.</p>
                  )}
                  <p className="then">{head.text}</p>
                  {!no && hasChoice(g) && (
                    <>
                      <p className="what">Which one?</p>
                      <div className="chips">
                        {g.variants.map((x) => (
                          <button
                            key={x.id}
                            className="chip"
                            aria-label={`Take ${x.name}`}
                            onClick={() => {
                              onPick(x);
                              setOpen(null);
                            }}
                          >
                            {x.name.slice(g.name.length).replace(/[()]/g, "").trim()}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {!no && !hasChoice(g) && (
                    <button
                      className="menu-take"
                      onClick={() => {
                        onPick(head);
                        setOpen(null);
                      }}
                    >
                      Take it
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
        ))}
        {rows.length === 0 && (
          <p className="faint note">
            Nothing matches.
          </p>
        )}
      </div>
    </div>
  );
}
