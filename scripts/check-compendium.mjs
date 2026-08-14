/* Validates the compendium parser against a REAL file, outside the test suite
   because these files are tens of megabytes and belong to whoever downloaded
   them. Run: node scripts/check-compendium.mjs "<path to xml>" */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/check-compendium.mjs <file.xml>");
  process.exit(2);
}
const win = new Window();
globalThis.DOMParser = win.DOMParser;
globalThis.Element = win.Element;
globalThis.Document = win.Document;

const { KINDS, parseKind, survey, looksLikeCompendium } = await import("../src/import/compendium.ts");

const xml = readFileSync(path, "utf8");
console.log(`${path}  ${(xml.length / 1e6).toFixed(1)} MB`);
const bad = looksLikeCompendium(xml);
if (bad) { console.error("REJECTED:", bad); process.exit(1); }

console.log("survey:", survey(xml));

let totalBytes = 0;
for (const kind of KINDS) {
  const t0 = Date.now();
  const rows = parseKind(xml, kind);
  const bytes = JSON.stringify(rows).length;
  totalBytes += bytes;
  const named = rows.filter((r) => r.name && r.name.length > 0).length;
  console.log(
    `  ${kind.padEnd(11)} ${String(rows.length).padStart(6)} rows  ` +
    `${(bytes / 1e6).toFixed(2)} MB  ${Date.now() - t0}ms  named ${named}/${rows.length}`,
  );
  if (rows.length) console.log(`      e.g. ${JSON.stringify(rows[0]).slice(0, 150)}`);
}
console.log(`stored total ≈ ${(totalBytes / 1e6).toFixed(1)} MB`);
