/**
 * Import review.
 *
 * The adapter reports what a Fight Club export cannot carry rather than
 * inventing it, so this screen exists to show those gaps before anything is
 * created. "Fill the form" is the default action, not "use as is" — the point
 * of naming the gaps is that somebody closes them.
 */

import { useRef, useState } from "react";
import type { BuildBase } from "../domain/build.js";
import { ImportError, parseFightClubXml, type ImportIssue } from "../import/fightclub.js";

const KIND_LABEL: Record<ImportIssue["kind"], string> = {
  missing: "Not in the file",
  unmapped: "Not understood",
  assumed: "Check this",
};

/** Field names are internal; an issue has to say which one it is about. */
const FIELD_LABEL: Record<string, string> = {
  armourClass: "Armour class",
  spellSlots: "Spell slots",
  saveProficiencies: "Saving throws",
  skillProficiencies: "Skills",
  maxHp: "Max HP",
};
const fieldName = (f: string) =>
  FIELD_LABEL[f] ?? f.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export function ImportPanel({
  onPrefill, onUse,
}: {
  onPrefill: (base: BuildBase) => void;
  onUse: (base: BuildBase) => void;
}) {
  const [result, setResult] = useState<{ base: BuildBase; issues: readonly ImportIssue[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function read(xml: string) {
    try {
      setResult(parseFightClubXml(xml));
      setError(null);
    } catch (e) {
      setResult(null);
      setError(e instanceof ImportError ? e.message : "Could not read that file.");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    read(await file.text());
  }

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Import · Fight Club 5e XML</span>
        {result && (
          <button onClick={() => { setResult(null); if (fileRef.current) fileRef.current.value = ""; }}>
            Clear
          </button>
        )}
      </div>
      <div className="card-body">
        {!result && (
          <>
            <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" onChange={onFile} />
            <p className="faint" style={{ fontSize: ".85rem", marginTop: 10, marginBottom: 0 }}>
              Or paste the XML below.
            </p>
            <textarea
              className="paste"
              rows={4}
              placeholder="<character>…"
              onChange={(e) => e.target.value.trim() && read(e.target.value)}
            />
            {error && <p className="err">{error}</p>}
          </>
        )}

        {result && (
          <>
            <div className="read">
              <div className="ln"><span>Name</span><span className="v">{result.base.name}</span></div>
              <div className="ln">
                <span>Class</span>
                <span className="v">
                  {result.base.classes.map((c) => `${c.classId} ${c.level}`).join(" · ")}
                </span>
              </div>
              <div className="ln"><span>Race</span><span className="v">{result.base.race || "—"}</span></div>
              <div className="ln"><span>Max HP</span><span className="v">{result.base.maxHp}</span></div>
              <div className="ln">
                <span>Abilities</span>
                <span className="v">{Object.values(result.base.abilities).join(" · ")}</span>
              </div>
              <div className="ln">
                <span>Proficiencies</span>
                <span className="v">
                  {result.base.saveProficiencies.length} saves · {result.base.skillProficiencies.length} skills
                </span>
              </div>
            </div>

            {result.issues.length > 0 && (
              <div className="issues">
                <div className="label" style={{ marginBottom: 8 }}>
                  {result.issues.length} thing{result.issues.length === 1 ? "" : "s"} to check
                </div>
                {result.issues.map((i, n) => (
                  <div className="iss" key={n}>
                    <span className={`ikind k-${i.kind}`}>{KIND_LABEL[i.kind]}</span>
                    <span className="idetail">
                      <b className="ifield">{fieldName(i.field)}</b> — {i.detail}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="row" style={{ marginTop: 14 }}>
              <button onClick={() => onPrefill(result.base)}>Fill the form with this</button>
              <button onClick={() => onUse(result.base)}>Use as is</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
