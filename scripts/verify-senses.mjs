/* What a character can see.

   310 of the 605 races carry a Darkvision trait and 36 carry Sunlight
   Sensitivity — the same mechanic pointing the other way. The app showed both
   as prose in a trait list and knew neither, so it could not answer the
   question a table actually asks: it is dark, what do I roll? */
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
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(300);
};
const atStep = async (page, label) => {
  const n = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await n.count()) { await n.first().click(); await page.waitForTimeout(250); }
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// A dwarf: darkvision 60, and nothing else interesting about their eyes.
await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await page.getByRole("button", { name: "Fighter", exact: true }).click();
await page.waitForTimeout(400);
await atStep(page, "Skills");
for (const s of ["athletics", "perception"]) {
  const t = page.getByRole("button", { name: `Train ${s}` });
  if (await t.count()) await t.click();
}
await atStep(page, "Race");
await page.locator('input[aria-label="Filter races"]').fill("dwarf");
await page.waitForTimeout(600);
const dwarves = await page.locator('select[aria-label="Race"] option').allInnerTexts();
await page.selectOption('select[aria-label="Race"]', { label: dwarves[1] });
await page.waitForTimeout(700);
await atStep(page, "Scores");
await page.getByRole("button", { name: "Recommend" }).click();
await page.waitForTimeout(500);
const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls.count()); i++) await cls.nth(i).selectOption({ index: 1 });
await atStep(page, "Story");
await page.getByRole("button", { name: "nature", exact: true }).click();
await page.getByRole("button", { name: "insight", exact: true }).click();
await page.locator('input[aria-label="Background name"]').fill("Soldier");
await atStep(page, "Gear");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
const kit = page.locator(".kit select");
for (let i = 0; i < (await kit.count()); i++) await kit.nth(i).selectOption({ index: 1 });
await atStep(page, "Review");
await page.locator('input[aria-label="Character name"]').fill("Durn Stonefist");
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".hp-big", { timeout: 20000 });
await go(page, "sheet");

const card = page.locator(".card", { hasText: "Languages & tools" }).first();
await card.scrollIntoViewIfNeeded();
const said = (await card.innerText()).replace(/\s+/g, " ");
/* It was prose in a trait list the sheet never showed. Now it is a fact the
   sheet states and the fight can ask about. */
ok("the sheet says what they can see", /sees/i.test(said), true);
ok("with the range the trait stated", /darkvision 60 ft/i.test(said), true);
await page.screenshot({ path: `${OUT}/G0-senses.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
