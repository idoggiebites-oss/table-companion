/* Joining a campaign already in progress.

   The claim under test is structural, not cosmetic: a character built at level
   8 must be a BASE at level 8 — the same shape an import of one produces — not
   level 1 carrying seven deltas. Everything derived has to follow from that on
   its own. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = got === want;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

/** Sit as a character: a device claims its own once, then picks a seat. */
const sitAs = async (page, name) => {
  // A device joining a campaign that already has characters is asked which
  // one it is, once; after that it is an ordinary seat change.
  const join = page.locator(".join-row", { hasText: name });
  if (await join.count()) await join.first().click();
  else await page.selectOption('select[aria-label="Seat"]', { label: name });
  await page.waitForTimeout(500);
};
// The class kit can ask which martial weapon; answer it before creating.
const answerGear = async (page) => {
  const sel = page.locator('select[aria-label^="Choose"]');
  for (let i = 0; i < (await sel.count()); i++) {
    await sel.nth(i).selectOption({ index: 1 });
  }
  await page.waitForTimeout(200);
};

/** Sections are tabs now; content is one tap away rather than a scroll. */
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1300 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}
const stat = (p, label) => p.locator(".cr-grid div", { hasText: label }).locator(".v");

const dm = await device("dm");
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();

const player = await device("player");
await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForTimeout(1200);
await player.page.getByRole("button", { name: "Build a character" }).click();
await player.page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });

// The level control only means anything once a class is chosen, so it lives
// with the class and not above it.
ok("no level asked before a class", await player.page.locator('input[aria-label="Starting level"]').count(), 0);
await player.page.selectOption('select[aria-label="Class"]', "ranger");
await player.page.waitForTimeout(400);
const lvl = player.page.locator('input[aria-label="Starting level"]');
ok("level appears with the class", await lvl.count(), 1);
ok("and defaults to one", await lvl.inputValue(), "1");
ok("level 1 says nothing about joining", await player.page.getByText("joining a campaign in progress").count(), 0);

await player.page.getByRole("button", { name: "Stealth", exact: true }).click();
await player.page.getByRole("button", { name: "Perception", exact: true }).click();
await player.page.getByRole("button", { name: "Survival", exact: true }).click();
await player.page.selectOption('select[aria-label="Race"]', "elf");
await player.page.waitForTimeout(400);
await player.page.waitForSelector(".cr-ab");
await player.page.getByRole("button", { name: "Recommend" }).click();
await player.page.waitForTimeout(400);

// Recommend's deterministic ranger spread: dex 15(+2 elf), wis 14, con 13,
// str 12, int 10(+1), cha 8 — so con is +1.
const hp1 = await stat(player.page, "Hit points").innerText();
ok("hit points at level one are the full die plus con", hp1, "11");

await lvl.fill("8");
await player.page.waitForTimeout(400);
ok("now it says what a high level means", await player.page.getByText("joining a campaign in progress").count(), 1);

// d10, con +1: 11 at first, then seven levels of 6+1.
ok("hit points recomputed for the level", await stat(player.page, "Hit points").innerText(), "60");
const brief = await player.page.locator(".cr-note").filter({ hasText: "Level 8" }).innerText();
ok("proficiency is stated before you commit", brief.includes("+3"), true);
ok("so are the spell slots", brief.includes("4/3"), true);
ok("and the ability points still owed", brief.includes("4 ability points"), true);
// The preview is the teaching surface, so it must show the level-8 number and
// not the level-1 one — a wrong bonus here is worse than no bonus.
ok("the skill preview uses the level's proficiency, not level one's",
  await player.page.locator(".cr-srow", { hasText: "stealth" }).locator(".num").innerText(), "+6");
await player.page.screenshot({ path: `${OUT}/40-level-8.png`, fullPage: true });

// out of range in both directions
await lvl.fill("40");
await player.page.waitForTimeout(250);
ok("clamped above the table", await lvl.inputValue(), "20");
await lvl.fill("0");
await player.page.waitForTimeout(250);
ok("clamped below it", await lvl.inputValue(), "1");
await lvl.fill("8");
await player.page.waitForTimeout(300);

await player.page.getByRole("button", { name: "nature", exact: true }).click();
await player.page.getByRole("button", { name: "animal handling", exact: true }).click();
await player.page.locator('input[aria-label="Background name"]').fill("Greenwarden");
await player.page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
await player.page.waitForTimeout(300);
await answerGear(player.page);
await player.page.getByRole("button", { name: "Create character" }).click();
await player.page.waitForSelector(".hp-big", { timeout: 15000 });

ok("arrives at the table with the right hit points",
  (await player.page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "60 / 60");
ok("proficiency is a level-8 bonus, not a level-1 one",
  await player.page.locator(".strip div").nth(3).locator("b").innerText(), "+3");
ok("a class skill carries the larger bonus — dex +3, proficiency +3",
  await player.page.getByRole("button", { name: /^stealth/ }).locator(".m").innerText(), "+6");

ok("eight hit dice, one per level",
  await player.page.locator(".controls", { hasText: "Hit die" }).locator(".faint").last().innerText(), "8 left");

// Slots are the reason the per-level table exists: a ranger has none at level
// 1 and 4/3 at level 8, so a wrong reading here is visible rather than subtle.
const pool = (name) => player.page.locator(".pool").filter({ hasText: name }).locator(".ct");
ok("first-level slots come from the class table", await pool("Level 1 slots").innerText(), "4 of 4");
ok("and second-level ones the ranger has no other way to get",
  await pool("Level 2 slots").innerText(), "3 of 3");
await player.page.screenshot({ path: `${OUT}/41-level-8-sheet.png`, fullPage: true });

// The DM's view is where the structural claim shows: one class entry at level
// 8, and nothing owed — a mid-campaign joiner is not behind on levelling.
await dm.page.selectOption('select[aria-label="Seat"]', "dm").catch(() => {});
await dm.page.waitForTimeout(1500);
const prow = dm.page.locator(".prow").filter({ hasText: "Bel Ashcroft" });
ok("the DM sees one class at level 8", (await prow.locator(".cls").innerText()).trim().toLowerCase(), "ranger 8");
ok("and nothing is owed", (await prow.locator(".owe").innerText()).trim().toLowerCase(), "level 8");
await dm.page.screenshot({ path: `${OUT}/42-level-8-dm.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
