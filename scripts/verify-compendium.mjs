/* Importing a compendium, with the real file.

   The engineering claim is the one worth testing: a 54MB XML must not be
   handed to DOMParser whole. It is scanned entry by entry so peak memory is
   one monster rather than a document — the difference between working at a
   table and crashing a phone. */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { sitIn } from "./lib/seat.mjs";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const FILE = process.env.COMPENDIUM ?? `${homedir()}/Downloads/Complete_Compendium_5e.xml`;
if (!existsSync(FILE)) {
  console.log(`SKIP  no compendium at ${FILE}`);
  process.exit(0);
}
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

/** Sit as a character: a device claims its own once, then picks a seat. */
const sitAs = async (page, name) => {
  // A device joining a campaign that already has characters is asked which
  // one it is, once; after that it is an ordinary seat change.
  const join = page.locator(".join-row", { hasText: name });
  if (await join.count()) await join.first().click();
  else await sitIn(page, name);
  await page.waitForTimeout(500);
};
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// A DM, so the Book tab is available.
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });
await sitIn(page, "dm");
await page.waitForTimeout(600);
await go(page, "book");

ok("the app says plainly that it ships the SRD only",
  (await page.locator(".src").innerText()).includes("Nothing imported"), true);

await page.getByRole("button", { name: "Add a compendium" }).click();
await page.locator('input[aria-label="Compendium file"]').setInputFiles(FILE);

// Reading 54MB and surveying it takes a while; the point is that it finishes.
await page.waitForSelector(".chips .chip", { timeout: 180000 });
const offered = (await page.locator(".chips .chip").allInnerTexts()).map((t) => t.toLowerCase());
ok("it surveys the file before parsing any of it", offered.length, 7);
ok("and reports what is really in there", offered.some((t) => /3443 spells/.test(t)), true);
ok("creatures are offered but not taken by default",
  await page.locator('.chips .chip:not(.on)').count(), 1);
await page.screenshot({ path: `${OUT}/57-compendium.png`, fullPage: true });

// Take spells and items only — the parts a player actually needs.
for (const t of offered) {
  const on = await page.locator(".chips .chip.on", { hasText: new RegExp(t, "i") }).count();
  if (on && !/spells|items/.test(t)) {
    await page.locator(".chips .chip", { hasText: new RegExp(t, "i") }).first().click();
  }
}
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Import", exact: true }).click();
await page.waitForSelector(".src-row:nth-child(2)", { timeout: 300000 });

const imported = await page.locator(".src-row").nth(1).innerText();
ok("the import is recorded with what it took", /3443 spells/.test(imported), true);
ok("and it did not quietly take the creatures", /creatures/.test(imported), false);
await page.screenshot({ path: `${OUT}/58-imported.png`, fullPage: true });

// The payoff: imported items appear wherever the SRD ones do, with prices.
await sitAs(page, "Kira Vance");
await page.waitForTimeout(800);
await go(page, "gear");
await page.locator(".card", { hasText: "Carrying" }).getByRole("button", { name: "Add" }).click();
await page.locator('input[aria-label="Search items"]').fill("Potion of Healing");
await page.waitForTimeout(600);
ok("a magic item from the compendium is now buyable",
  await page.locator(".inv-add", { hasText: "Potion of Healing" }).count() > 0, true);
// Case-insensitive: .inv-add is uppercased in CSS and innerText returns what
// is rendered, not what is in the source.
ok("with the price the file carries",
  /50 gp/i.test(await page.locator(".inv-add", { hasText: "Potion of Healing" }).first().innerText()), true);

// And it survives a reload, because it is on the device rather than in memory.
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".tabs", { timeout: 20000 });
await page.waitForTimeout(1200);
await go(page, "gear");
ok("still there after a reload",
  (await page.locator(".card", { hasText: "Sources" }).innerText()).toLowerCase()
    .includes("spells"), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
