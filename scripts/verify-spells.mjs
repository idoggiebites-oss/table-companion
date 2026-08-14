/* The spell list.

   The app earns its place at the moment of casting: it knows which slot a
   spell needs, which slots are left, and that a concentration spell displaces
   the one you were already holding. Doing those three by hand is where
   mistakes live, so they are one event — and undoing it gives all three back.

   Needs a compendium, because the SRD data this app ships has no spell list. */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { homedir } from "node:os";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const FILE = process.env.COMPENDIUM ?? `${homedir()}/Downloads/FC5 Compendium.xml`;
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
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// A wizard at level 5: slots 4/3/2.
await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });
await page.selectOption('select[aria-label="Class"]', "wizard");
await page.waitForTimeout(400);
await page.locator('input[aria-label="Starting level"]').fill("5");
for (const s of ["Arcana", "History"]) {
  await page.getByRole("button", { name: s, exact: true }).click();
}
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Recommend" }).click();
await page.getByRole("button", { name: "nature", exact: true }).click();
await page.getByRole("button", { name: "animal handling", exact: true }).click();
await page.locator('input[aria-label="Background name"]').fill("Sage");
await page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });

ok("a caster gets a Spells tab", await page.locator('[data-tab="spells"]').count(), 1);
await go(page, "spells");
ok("led by the slots, because that is the first question",
  (await page.locator(".slot .num").allInnerTexts()), ["4", "3", "2"]);
ok("and says where spells come from when there are none",
  (await page.locator(".card").last().innerText()).toLowerCase().includes("compendium"), true);

// Import the SRD compendium for its 317 spells.
await go(page, "gear");
await page.getByRole("button", { name: "Add a compendium" }).click();
await page.locator('input[aria-label="Compendium file"]').setInputFiles(FILE);
await page.waitForSelector(".chips .chip", { timeout: 120000 });
await page.getByRole("button", { name: "Import", exact: true }).click();
await page.waitForSelector(".src-row:nth-child(2)", { timeout: 180000 });

await go(page, "spells");
await page.getByRole("button", { name: "Add spells" }).click();
await page.waitForSelector('input[aria-label="Search spells"]', { timeout: 20000 });

// Only what this class can cast, until asked otherwise.
await page.locator('input[aria-label="Search spells"]').fill("Cure Wounds");
await page.waitForTimeout(500);
ok("a wizard is not offered a cleric's spell",
  await page.locator(".inv-add", { hasText: "Cure Wounds" }).count(), 0);
await page.getByRole("button", { name: /only/i }).click();
await page.waitForTimeout(400);
ok("unless they ask for everything",
  await page.locator(".inv-add", { hasText: "Cure Wounds" }).count() > 0, true);
await page.getByRole("button", { name: "Everything" }).click();
await page.waitForTimeout(300);

for (const name of ["Magic Missile", "Fireball", "Fire Bolt", "Haste"]) {
  await page.locator('input[aria-label="Search spells"]').fill(name);
  await page.waitForTimeout(400);
  await page.locator(".inv-add", { hasText: new RegExp(`^${name}`, "i") }).first().click();
  await page.waitForTimeout(300);
}
await page.getByRole("button", { name: "Done" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/59-spells.png`, fullPage: true });

// --- casting spends the slot you chose ------------------------------------
await page.getByRole("button", { name: "Cast Magic Missile" }).click();
await page.waitForSelector(".sp-cast");
const offered = (await page.locator(".sp-cast .tgt-row").allInnerTexts()).map((t) => t.toLowerCase());
ok("a 1st-level spell offers higher slots too — upcasting, in the open",
  offered.length, 3);
ok("and never a slot below its own", offered[0].includes("1st"), true);
// Into a 2nd-level slot, leaving the 3rd-level ones for the spells below —
// a wizard at 5 has only two of those.
await page.locator(".sp-cast .tgt-row", { hasText: /2nd/i }).click();
await page.waitForTimeout(600);
ok("the slot you picked is the one spent",
  (await page.locator(".slot .num").allInnerTexts()), ["4", "2", "2"]);

// A cantrip asks nothing and costs nothing.
await page.getByRole("button", { name: "Cast Fire Bolt" }).click();
await page.waitForTimeout(500);
ok("a cantrip costs nothing and does not ask",
  (await page.locator(".slot .num").allInnerTexts()), ["4", "2", "2"]);

// --- concentration is exclusive -------------------------------------------
await page.getByRole("button", { name: "Cast Haste" }).click();
await page.waitForTimeout(600);
ok("a concentration spell takes hold",
  (await page.locator(".src-note").innerText()).toLowerCase().includes("haste"), true);
await go(page, "sheet");
ok("and the sheet agrees",
  (await page.locator(".chip.conc").innerText()).toLowerCase(), "haste");

await go(page, "spells");
await page.getByRole("button", { name: "Cast Fireball" }).click();
await page.waitForTimeout(600);
ok("casting a non-concentration spell leaves it alone",
  (await page.locator(".src-note").innerText()).toLowerCase().includes("haste"), true);

// --- preparing ------------------------------------------------------------
await page.getByRole("button", { name: "Unprepare Fireball" }).click();
await page.waitForTimeout(500);
ok("an unprepared spell cannot be cast",
  await page.getByRole("button", { name: "Cast Fireball" }).isDisabled(), true);
ok("but a cantrip never needs preparing",
  await page.getByRole("button", { name: "Cast Fire Bolt" }).isDisabled(), false);

// --- one undo returns the slot AND the concentration ----------------------
await go(page, "log");
await page.locator(".fr", { hasText: /cast Haste/i }).first().getByRole("button", { name: "Undo" }).click();
await page.waitForTimeout(700);
await go(page, "spells");
// Haste and Fireball each took a 3rd-level slot; undoing Haste returns one.
ok("undoing a cast gives back the slot",
  (await page.locator(".slot .num").allInnerTexts())[2], "1");
ok("and the concentration with it, in one go",
  await page.locator(".src-note").count(), 0);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
