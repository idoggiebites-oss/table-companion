/**
 * The DM looking up a spell.
 *
 * There was nowhere to do it. A player casts Hold Person, the table looks at
 * the DM, and the DM had the whole bestiary at hand and not one spell — while
 * the player two seats away was reading the text on their own screen. The
 * person who has to RULE on a spell had less access to it than the person
 * casting it.
 *
 * Same shape as the monster reference beside it: closed until asked for,
 * because four megabytes should not load to render a tab nobody opened.
 */

import { useEffect, useMemo, useState } from "react";
import { isCore } from "../domain/marks.js";
import { levelLabel } from "../domain/spells.js";
import { costOf } from "../domain/spellcast.js";
import {
  primaryRole, rolesOf, ROLE_LABEL, ROLE_ORDER, type SpellRole,
} from "../domain/spellrole.js";
import type { CompendiumSpell } from "../import/compendium.js";
import { loadSpells } from "../store/srd.js";
import { HomebrewToggle } from "./HomebrewToggle.js";
import { useHomebrew } from "./useHomebrew.js";

export function SpellLookup() {
  const [all, setAll] = useState<CompendiumSpell[] | null>(null);
  const [error, setError] = useState(false);
  const [shown, setShown] = useState(false);
  const [text, setText] = useState("");
  const [role, setRole] = useState<SpellRole | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [homebrew, setHomebrew] = useHomebrew();

  useEffect(() => {
    if (!shown || all || error) return;
    loadSpells().then(setAll, () => setError(true));
  }, [shown, all, error]);

  const allowed = useMemo(
    () => (all ?? []).filter((s) => homebrew || isCore(s.name)),
    [all, homebrew],
  );

  const counts = useMemo(() => {
    const out = new Map<SpellRole, number>();
    for (const s of allowed) {
      for (const r of rolesOf(s)) out.set(r, (out.get(r) ?? 0) + 1);
    }
    return out;
  }, [allowed]);

  const results = useMemo(() => {
    const q = text.trim().toLowerCase();
    return allowed
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .filter((s) => role === null || rolesOf(s).includes(role))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [allowed, text, role]);

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Spells</span>
        <button onClick={() => setShown((v) => !v)}>{shown ? "Hide" : "Look one up"}</button>
      </div>

      {shown && (
        <div className="card-body">
          {error && <p className="err">Could not load the spell data.</p>}
          {!all && !error && <p className="faint note">Loading…</p>}

          {all && (
            <>
              <div className="row">
                <input
                  value={text}
                  aria-label="Search spells"
                  placeholder="hold person, fireball…"
                  style={{ flex: "2 1 160px", width: "auto" }}
                  onChange={(e) => setText(e.target.value)}
                />
                <HomebrewToggle
                  on={homebrew}
                  hidden={(all?.length ?? 0) - allowed.length}
                  onChange={setHomebrew}
                />
              </div>

              <div className="roles mt-2">
                {ROLE_ORDER.filter((r) => (counts.get(r) ?? 0) > 0).map((r) => (
                  <button
                    key={r}
                    className={`role r-${r}${role === r ? " on" : ""}`}
                    aria-pressed={role === r}
                    aria-label={`Only ${ROLE_LABEL[r]}`}
                    onClick={() => setRole(role === r ? null : r)}
                  >
                    {ROLE_LABEL[r]} <span className="n">{counts.get(r)}</span>
                  </button>
                ))}
              </div>

              <p className="faint note">
                {results.length} of {allowed.length}
              </p>

              <div className="menu ref-scroll">
                {results.map((s) => {
                  const isOpen = open === s.id;
                  return (
                    <div className="menu-row" key={s.id}>
                      <button
                        className="menu-hd"
                        aria-expanded={isOpen}
                        aria-label={s.name}
                        onClick={() => setOpen(isOpen ? null : s.id)}
                      >
                        <span className="nm">{s.name}</span>
                        <span className={`role r-${primaryRole(s)}`}>
                          {ROLE_LABEL[primaryRole(s)]}
                        </span>
                        <span className="cost">
                          {s.level === 0 ? "cantrip" : levelLabel(s.level)}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="menu-more">
                          <p className="what">
                            {[
                              s.school,
                              s.time && `takes ${s.time.toLowerCase()}`,
                              s.range && `reaches ${s.range.toLowerCase()}`,
                              s.duration && `lasts ${s.duration.toLowerCase()}`,
                              costOf(s.time) === "long" ? "not in a fight" : "",
                            ].filter(Boolean).join(" · ")}
                          </p>
                          {/* Whole, not truncated: the DM is here to rule on
                              it, and the sentence that matters is usually the
                              last one. */}
                          <p className="then">{s.text}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {results.length === 0 && (
                  <p className="faint note">
                    Nothing matches.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
