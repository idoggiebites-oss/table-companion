/* Spells a race hands you.

   158 of the 605 races grant one. The trait was shown as prose and the spell
   never reached the spell list — so a tiefling arrived at the table unable to
   cast the one thing their race is known for, with nothing on any screen
   saying why. */
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

/* Languages, tools and background skills are closed pickers now — sixteen and
   fifty-three of them laid out at once made this step three and a half screens
   tall. Open the one you want, then choose in it. */
const openPick = async (page, label) => {
  const hd = page.getByRole("button", { name: new RegExp(`^${label}, \\d+ chosen$`) });
  if ((await hd.count()) && (await hd.first().getAttribute("aria-expanded")) === "false") {
    await hd.first().click();
    await page.waitForTimeout(250);
  }
};
const atStep = async (page, label) => {
  const n = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await n.count()) { await n.first().click(); await page.waitForTimeout(250); }
};
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(300);
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await page.getByRole("button", { name: "Fighter", exact: true }).click();
await page.waitForTimeout(400);
await atStep(page, "Skills");
for (const s of ["athletics", "perception"]) {
  const t = page.getByRole("button", { name: `Train ${s}` });
  if (await t.count()) await t.click();
}

// A tiefling: Thaumaturgy now, Hellish Rebuke at 3.
await atStep(page, "Race");
await page.locator('input[aria-label="Filter races"]').fill("tiefling");
await page.waitForTimeout(700);
const opts = await page.locator('select[aria-label="Race"] option').allInnerTexts();
await page.selectOption('select[aria-label="Race"]', { label: opts[1] });
await page.waitForTimeout(1800);

const casts = page.locator(".cnt", { hasText: "casts" }).first();
ok("the race step says what the race casts", await casts.count(), 1);
const said = (await casts.innerText()).replace(/\s+/g, " ");
ok("naming what they know now", /thaumaturgy/i.test(said), true);
/* And what has not arrived yet, at the level it will — a spell that appears
   three sessions later with no warning is a surprise, not a feature. */
ok("and what comes later, with the level", /later:.*at 3/i.test(said), true);
await page.screenshot({ path: `${OUT}/H0-innate.png`, fullPage: true });

// Finish, and find it on the spell list rather than only in the prose.
await atStep(page, "Scores");
await page.getByRole("button", { name: "Recommend" }).click();
await page.waitForTimeout(600);
/* Every class choice, answered. A subclass is a readable list now, not a
   dropdown — open the first unanswered row and take it. "Take …" rather
   than the first button in the panel, because an already-answered
   chooser offers "Choose something else" and would be un-chosen. */
for (let g = 0; g < 8; g++) {
  const card = page.locator(".card", { hasText: "Your class" });
  const head = card.locator('.chooser button.menu-hd[aria-expanded="false"]').first();
  if (!(await head.count())) break;
  await head.click();
  await page.waitForTimeout(250);
  const take = card.getByRole("button", { name: /^Take / }).first();
  if (!(await take.count())) break;
  await take.click();
  await page.waitForTimeout(300);
}
await atStep(page, "Story");
await openPick(page, "Skills");
await page.getByRole("button", { name: "Train nature" }).click();
await openPick(page, "Skills");
await page.getByRole("button", { name: "Train insight" }).click();
await page.locator('input[aria-label="Background name"]').fill("Wanderer");
await atStep(page, "Gear");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
const kit = page.locator(".kit select");
for (let i = 0; i < (await kit.count()); i++) await kit.nth(i).selectOption({ index: 1 });
await atStep(page, "Review");
await page.locator('input[aria-label="Character name"]').fill("Ash Emberfell");
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".hp-big", { timeout: 20000 });

/* A fighter has no spell slots, so the Spells tab exists only BECAUSE the
   race granted something — which is the whole point. */
ok("a fighter tiefling gets a Spells tab at all",
  await page.locator('[data-tab="spells"]').count(), 1);
await go(page, "spells");
const list = (await page.locator(".app").innerText()).replace(/\s+/g, " ");
ok("with the spell their race gave them on it", /thaumaturgy/i.test(list), true);
ok("and not the one they have not earned", /hellish rebuke/i.test(list), false);
await page.screenshot({ path: `${OUT}/H1-innate-sheet.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
