/* One switch for other people's material.

   A complete compendium is mostly not the game: 81% of the races carry a
   provenance marker, 89% of the feats, 65% of the spells. Somebody building
   their first character should not scroll past three hundred homebrew races
   to reach an elf — and somebody running a homebrew campaign needs every one
   of them. Both are right, so it is a switch. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};
const atStep = async (page, label) => {
  const node = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await node.count()) { await node.first().click(); await page.waitForTimeout(250); }
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector(".klass-cards", { timeout: 20000 });

const toggle = () => page.getByRole("button", { name: "Show homebrew and third-party content" });
const raceCount = async () =>
  (await page.locator('select[aria-label="Race"] option').count()) - 1;

// --- the class step -------------------------------------------------------
ok("the switch is offered where there is something to hide", await toggle().count(), 1);
ok("and says how much", /more from your compendium/i.test(await toggle().innerText()), true);
ok("with the game's own classes still cards", await page.locator(".klass").count(), 12);
await page.screenshot({ path: `${OUT}/C0-toggle-off.png`, fullPage: true });

// --- races: the list this exists for --------------------------------------
await page.getByRole("button", { name: "Fighter", exact: true }).click();
await page.waitForTimeout(400);
await atStep(page, "Race");
const quiet = await raceCount();
ok("a race list you can read rather than search", quiet < 140, true);

await toggle().first().click();
await page.waitForTimeout(600);
const loud = await raceCount();
ok("turning it on brings the rest", loud > quiet * 2, true);
ok("and the switch says so", /homebrew shown/i.test(await toggle().first().innerText()), true);
await page.screenshot({ path: `${OUT}/C1-toggle-on.png`, fullPage: true });

/* It is one preference, not one per list — a person who learns the switch on
   the class step should not have to find it again on the spell step. */
await atStep(page, "Class");
ok("the same switch is on every step that needs it",
  /homebrew shown/i.test(await toggle().first().innerText()), true);

// --- and it survives a reload, because it is a preference -----------------
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector(".klass-cards", { timeout: 20000 });
ok("it is remembered", /homebrew shown/i.test(await toggle().first().innerText()), true);

await toggle().first().click();
await page.waitForTimeout(500);
ok("and turns back off", /more from your compendium/i.test(await toggle().first().innerText()), true);

// --- choosing something hidden keeps it listed ---------------------------
await page.getByRole("button", { name: "Fighter", exact: true }).click();
await page.waitForTimeout(400);
await atStep(page, "Race");
await toggle().first().click();
await page.waitForTimeout(600);
const marked = await page.locator('select[aria-label="Race"] option')
  .filter({ hasText: /\(HB\)/ }).first().textContent();
await page.selectOption('select[aria-label="Race"]', { label: marked.trim() });
await page.waitForTimeout(400);
await toggle().first().click();
await page.waitForTimeout(600);
/* A switch must never silently un-choose something. */
ok("a chosen race stays listed when the switch goes off",
  await page.locator('select[aria-label="Race"]').inputValue() !== "", true);


/* --- the spell pickers, which is where this was reported ----------------
   The Spells TAB honoured the switch and the two pickers that actually
   matter during creation did not: a first-time wizard choosing cantrips met
   two thirds somebody else's. */
await atStep(page, "Class");
await page.getByRole("button", { name: "Wizard", exact: true }).click();
await page.waitForTimeout(500);
for (const s of ["arcana", "history"]) {
  const t = page.getByRole("button", { name: `Train ${s}` });
  if (await t.count()) await t.click();
}
await atStep(page, "Race");
await page.selectOption('select[aria-label="Race"]', { index: 1 });
await page.waitForTimeout(600);
await atStep(page, "Spells");
await page.waitForTimeout(1500);

const cantrips = page.getByRole("button", { name: /^Cantrips,/ }).first();
await cantrips.click();
await page.waitForTimeout(1200);
const offered = () => page.locator(".chooser-list .menu-hd .nm").allInnerTexts();
const quietSpells = await offered();
ok("the builder's cantrips are the game's own",
  quietSpells.length > 0 && quietSpells.every((n) => !/\((?:HB|TP|UA|Alt)\)/i.test(n)), true);

const spellToggle = page.locator(".chooser").locator("..")
  .getByRole("button", { name: "Show homebrew and third-party content" }).first();
ok("with a switch of their own", await spellToggle.count(), 1);
await spellToggle.click();
await page.waitForTimeout(900);
const loudSpells = await offered();
ok("that brings the rest when asked", loudSpells.length >= quietSpells.length, true);
ok("including somebody else's",
  loudSpells.some((n) => /\((?:HB|TP|UA|Alt)\)/i.test(n)), true);
await page.screenshot({ path: `${OUT}/C2-spell-toggle.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
