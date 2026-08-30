/**
 * Where content comes from.
 *
 * The SRD is shipped; a compendium is yours. This app cannot bundle one —
 * those files are the published books — so it reads a file you already have
 * and keeps it on this device, exactly like homebrew. Nothing here crosses
 * the room: content is not campaign state.
 *
 * You choose what to take, because the sizes are wildly different. A complete
 * compendium is about 30MB parsed and the creatures are half of it; a player
 * who wants spells should not have to carry six thousand monsters to get
 * them. The survey runs before any parsing, so the counts shown are real.
 *
 * Parsing happens one kind at a time with a yield between, so the screen can
 * say what it is doing instead of freezing for eight seconds.
 */

import { useEffect, useState } from "react";
import {
  KINDS, looksLikeCompendium, parseKind, survey,
  type CompendiumKind,
} from "../import/compendium.js";
import {
  clearContent, readContentMeta, writeContent, writeContentMeta,
  type ContentMeta,
} from "../store/content.js";
import { forgetLoaded } from "../store/srd.js";

const LABEL: Record<CompendiumKind, string> = {
  race: "Races",
  class: "Classes",
  background: "Backgrounds",
  feat: "Feats",
  spell: "Spells",
  item: "Items",
  monster: "Creatures",
};

/** Everything but creatures: the bulk, and the part only a DM needs. */
const DEFAULT_KINDS: CompendiumKind[] = ["race", "class", "background", "feat", "spell", "item"];

const yield0 = () => new Promise((r) => setTimeout(r, 0));

export function Sources() {
  const [meta, setMeta] = useState<ContentMeta | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [xml, setXml] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [found, setFound] = useState<Record<CompendiumKind, number> | null>(null);
  const [want, setWant] = useState<CompendiumKind[]>(DEFAULT_KINDS);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void readContentMeta().then((m) => setMeta(m ?? null));
  }, []);

  async function chooseFile(file: File) {
    setError(null);
    setBusy(`Reading ${(file.size / 1e6).toFixed(0)}MB…`);
    setFileName(file.name.replace(/\.xml$/i, ""));
    try {
      const text = await file.text();
      const bad = looksLikeCompendium(text);
      if (bad) {
        setError(bad);
        setBusy(null);
        return;
      }
      await yield0();
      setBusy("Looking through it…");
      await yield0();
      const counts = survey(text);
      setFound(counts);
      setXml(text);
      setWant(DEFAULT_KINDS.filter((k) => counts[k] > 0));
    } catch {
      setError("Could not read that file.");
    } finally {
      setBusy(null);
    }
  }

  async function importNow() {
    if (!xml) return;
    setError(null);
    const counts: Partial<Record<CompendiumKind, number>> = {};
    try {
      for (const kind of KINDS) {
        if (!want.includes(kind)) continue;
        setBusy(`Reading ${LABEL[kind].toLowerCase()}…`);
        await yield0();
        const rows = parseKind(xml, kind);
        // Saved as we go: a 30MB import that fails at the end should still
        // leave you the parts that worked.
        await writeContent(kind, rows as never);
        counts[kind] = rows.length;
      }
      const next: ContentMeta = {
        name: fileName || "Compendium",
        importedAt: Date.now(),
        counts,
      };
      await writeContentMeta(next);
      forgetLoaded();
      setMeta(next);
      setXml(null);
      setFound(null);
      setOpen(false);
    } catch {
      setError("Ran out of room part way through. Take fewer sections and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function forget() {
    if (!confirm("Remove imported content from this device?")) return;
    await clearContent(KINDS);
    forgetLoaded();
    setMeta(null);
  }

  const total = meta ? Object.values(meta.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <section className="card">
      <div className="card-hd">
        <span className="label">Sources</span>
        <button onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Add a compendium"}</button>
      </div>

      <div className="src">
        <div className="src-row">
          <span className="nm">SRD 5.1</span>
          <span className="faint">shipped with the app</span>
        </div>
        {meta && (
          <div className="src-row">
            <span className="nm">{meta.name}</span>
            <span className="faint">
              {Object.entries(meta.counts)
                .map(([k, n]) => `${n} ${LABEL[k as CompendiumKind].toLowerCase()}`)
                .join(" · ")}
            </span>
            <button onClick={() => void forget()}>Forget</button>
          </div>
        )}
        {meta === null && (
          <p className="faint note">
            Nothing imported. The app ships the SRD only — a compendium is
            yours to supply.
          </p>
        )}
      </div>

      {open && (
        <div className="card-body">
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            aria-label="Compendium file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void chooseFile(f);
            }}
          />

          {busy && <p className="cr-note">{busy}</p>}
          {error && <p className="err">{error}</p>}

          {found && (
            <>
              <p className="cr-note">
                Take what you want. Creatures are the biggest part by far and
                only the DM needs them.
              </p>
              <div className="chips">
                {KINDS.filter((k) => found[k] > 0).map((k) => (
                  <button
                    key={k}
                    className={`chip${want.includes(k) ? " on" : ""}`}
                    aria-pressed={want.includes(k)}
                    onClick={() =>
                      setWant((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))
                    }
                  >
                    {found[k]} {LABEL[k].toLowerCase()}
                  </button>
                ))}
              </div>
              <div className="row mt-3">
                <button disabled={want.length === 0 || busy !== null} onClick={() => void importNow()}>
                  Import
                </button>
                <button onClick={() => { setXml(null); setFound(null); }}>Cancel</button>
              </div>
            </>
          )}

          {!found && !busy && (
            <p className="faint note">
              A Fight Club 5e compendium XML. It stays on this device and is
              never sent to the room — every device imports its own.
            </p>
          )}
        </div>
      )}

      {total > 0 && (
        <p className="faint src-note">
          Imported entries replace shipped ones of the same name, and appear
          everywhere the SRD does.
        </p>
      )}
    </section>
  );
}
