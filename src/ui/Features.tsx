/**
 * What your class has given you.
 *
 * The per-level table has carried these names since the compendium landed and
 * has never shown them, so a Blood Hunter at level 6 had no way to see what a
 * Blood Hunter at level 6 can do. For a first-time player that is most of
 * what their character IS.
 *
 * Grouped by the level that granted it, newest first, because the question is
 * almost always "what did I just get".
 */

import { useEffect, useMemo, useState } from "react";
import type { EffectiveBuild } from "../domain/build.js";
import { loadClassLevels, type ClassLevels } from "../store/srd.js";

export function Features({ build }: { build: EffectiveBuild }) {
  const [levels, setLevels] = useState<ClassLevels | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    loadClassLevels().then(setLevels, () => setLevels({}));
  }, []);

  const byLevel = useMemo(() => {
    if (!levels) return [];
    const out = new Map<number, string[]>();
    for (const entry of build.classes) {
      const table = levels[entry.classId] ?? [];
      for (const row of table.slice(0, entry.level)) {
        for (const name of row.features) {
          // Multiclass characters get the same generic rows twice.
          const at = out.get(row.level) ?? [];
          if (!at.includes(name)) at.push(name);
          out.set(row.level, at);
        }
      }
    }
    return [...out.entries()]
      .filter(([, names]) => names.length > 0)
      .sort((a, b) => b[0] - a[0]);
  }, [levels, build.classes]);

  if (byLevel.length === 0) return null;

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Features</span>
        <span className="label faint">
          {byLevel.reduce((n, [, names]) => n + names.length, 0)} so far
        </span>
      </div>
      {byLevel.map(([level, names]) => (
        <div className="feat-row" key={level}>
          <button
            className="feat-hd"
            aria-expanded={open === level}
            aria-label={`Level ${level} features`}
            onClick={() => setOpen(open === level ? null : level)}
          >
            <span className="nm">Level {level}</span>
            <span className="faint">{names.length}</span>
            <span className="chooser-mark">{open === level ? "−" : "+"}</span>
          </button>
          {open === level && (
            <div className="feat-list">
              {names.map((n) => (
                <span className="chip" key={n}>{n}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
