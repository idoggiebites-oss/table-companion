/**
 * Choosing a path, a domain, an archetype.
 *
 * It was a dropdown of names. A dropdown is right for picking something you
 * already know and wrong for choosing between things you have never read —
 * and a subclass IS its description. "Path of the Battlerager" is not a
 * choice; what a Battlerager DOES is the choice.
 *
 * The text was there the whole time: all 454 official options carry one, and
 * the builder showed it — but only AFTER you had committed to something. So
 * reading them meant choosing one, reading, choosing another, reading, and
 * remembering the difference. Nine paths is nine round trips.
 *
 * The same collapsed list the feats and spells use: names under the book that
 * printed them, whole text on tap, one button to take it.
 *
 * Its own classes, not the feat picker's. Wearing another component's clothes
 * made `.feat-pick` match two different things, and the feats' own suite
 * started measuring this list instead — check-css exists to catch exactly
 * that and only sees classes a section CLAIMS, so borrowed ones slip past it.
 * The `menu-*` primitives are genuinely shared; the rest are not.
 */

import { useState } from "react";
import { bookOf, byBook } from "../domain/books.js";
import { HomebrewToggle } from "./HomebrewToggle.js";
import type { ChoiceOption } from "../domain/subclass.js";

export function SubclassPick({
  of, options, taken, hidden, homebrew, onHomebrew, onPick,
}: {
  /** "Primal Path", "Divine Domain" — what the class calls this choice. */
  of: string;
  options: readonly ChoiceOption[];
  /** The one already chosen, so it reads as chosen rather than as absent. */
  taken?: string | undefined;
  /** How many the compendium switch is holding back. */
  hidden: number;
  homebrew: boolean;
  onHomebrew: (on: boolean) => void;
  onPick: (name: string | null) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const kind = /fighting style/i.test(of) ? "style" : "subclass";
  const q = filter.trim().toLowerCase();
  const rows = options
    .filter((o) => !q || o.name.toLowerCase().includes(q))
    .slice(0, q ? 80 : 200);

  const chosen = taken ? options.find((o) => o.name === taken) : undefined;
  if (chosen) {
    const book = bookOf(chosen.name, kind);
    return (
      <div className="sub-took">
        <div className="menu-row">
          <div className="menu-hd" aria-label={`${chosen.name}, taken`}>
            <span className="nm">{chosen.name}</span>
            <span className="cost">taken</span>
          </div>
          <div className="menu-more">
            {book && <p className="what">{book.name}</p>}
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
    <div className="sub-pick">
      {options.length > 12 && (
        <input
          value={filter}
          aria-label={`Filter ${of}`}
          placeholder={`filter ${options.length}…`}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      {hidden > 0 && (
        <HomebrewToggle on={homebrew} hidden={hidden} onChange={onHomebrew} />
      )}
      <div className="menu sub-scroll">
        {/*
          * Under the book that printed it — see books.ts. Alphabetical across
          * sixty names tells you nothing about which your table actually owns.
          */}
        {byBook(rows, kind).map(([book, group]) => (
          <div className="sub-book" key={book}>
            <span className="label q">{book}</span>
            {group.map((o) => {
              const shown = open === o.name;
              return (
                <div className="menu-row" key={o.name}>
                  <button
                    className="menu-hd"
                    aria-expanded={shown}
                    aria-label={o.name}
                    onClick={() => setOpen(shown ? null : o.name)}
                  >
                    <span className="nm">{o.name}</span>
                    <span className="cost">level {o.level}</span>
                  </button>
                  {shown && (
                    <div className="menu-more">
                      <p className="then">
                        {o.text ?? "The compendium carries no description for this one."}
                      </p>
                      <button
                        className="menu-take"
                        aria-label={`Take ${o.name}`}
                        onClick={() => {
                          onPick(o.name);
                          setOpen(null);
                        }}
                      >
                        Take it
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
