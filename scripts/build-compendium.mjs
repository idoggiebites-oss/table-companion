/*
 * Bakes a Fight Club compendium into shipped content.
 *
 *   node --max-old-space-size=8192 scripts/build-compendium.mjs "<file.xml>"
 *
 * The heap flag is not optional for a complete compendium: 54MB of XML plus
 * the parsed rows plus their serialised form does not fit in the default.
 *
 * Writes public/content/<kind>.json plus an index, which the app loads exactly
 * like it loads the SRD data. That removes the per-device import: four players
 * hand-feeding the same 54MB file is a ritual, not a feature.
 *
 * The output is NOT committed — public/content is ignored. These files are the
 * published books; they live on whatever machine is doing the deploying, and
 * the repository stays clean of them.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { homedir } from "node:os";
import { Window } from "happy-dom";

const raw = process.argv[2];
if (!raw) {
  console.error('usage: node scripts/build-compendium.mjs "<file.xml>"');
  process.exit(2);
}
const path = raw.replace(/^~/, homedir());
const OUT = "public/content";

const win = new Window();
globalThis.DOMParser = win.DOMParser;
const { KINDS, classIndex, parseKind, survey, looksLikeCompendium } =
  await import("../src/import/compendium.ts");

const xml = readFileSync(path, "utf8");
const bad = looksLikeCompendium(xml);
if (bad) {
  console.error(bad);
  process.exit(1);
}
console.log(`${path}  ${(statSync(path).size / 1e6).toFixed(1)} MB`);
console.log("found:", survey(xml));

mkdirSync(OUT, { recursive: true });
const counts = {};
let onDisk = 0;
let overWire = 0;

for (const kind of KINDS) {
  const rows = parseKind(xml, kind);
  if (rows.length === 0) continue;
  const json = JSON.stringify(rows);
  writeFileSync(`${OUT}/${kind}.json`, json);
  counts[kind] = rows.length;
  onDisk += json.length;
  const gz = gzipSync(json).length;
  overWire += gz;
  console.log(
    `  ${kind.padEnd(11)} ${String(rows.length).padStart(6)} rows  ` +
    `${(json.length / 1e6).toFixed(2)} MB  →  ${(gz / 1e6).toFixed(2)} MB gzipped`,
  );

  /*
   * And a second, tiny copy of the classes: names and levels, no descriptions.
   *
   * Every player's device was pulling the full 6.3MB so their sheet could
   * print a list of feature NAMES. The builder still reads the full file —
   * offering a class without saying what it does is the thing this app exists
   * not to be — but a sheet never needs a word of it.
   */
  if (kind === "class") {
    const index = JSON.stringify(classIndex(rows));
    writeFileSync(`${OUT}/class-index.json`, index);
    onDisk += index.length;
    const igz = gzipSync(index).length;
    overWire += igz;
    console.log(
      `  ${"class-index".padEnd(11)} ${String(rows.length).padStart(6)} rows  ` +
      `${(index.length / 1e6).toFixed(2)} MB  →  ${(igz / 1e6).toFixed(2)} MB gzipped`,
    );
  }
}

const name = path.split("/").pop().replace(/\.xml$/i, "");
writeFileSync(`${OUT}/index.json`, JSON.stringify({ name, builtAt: Date.now(), counts }));
console.log(
  `\n${(onDisk / 1e6).toFixed(1)} MB on disk, about ${(overWire / 1e6).toFixed(1)} MB over the wire.`,
);
