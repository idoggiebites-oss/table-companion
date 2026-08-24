/* The builder, once a compendium is in.

   Importing content is only worth it if the BUILDER can use it. Items and
   monsters merged into their loaders already; races and backgrounds were
   sitting in storage unread, which is the gap this closes. */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { homedir } from "node:os";

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

/* The builder is a flow now: one question per screen, and the rail is how you
   move between them. Every step is reachable at any time — which is also how a
   person changes their mind about a race after picking spells. */
const atStep = async (page, label) => {
  const node = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await node.count()) { await node.first().click(); await page.waitForTimeout(250); }
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

// Before importing: the shipped SRD list only.
await page.getByRole("button", { name: "Build a character" }).click();
await atStep(page, "Class");
await page.waitForSelector(".klass-cards", { timeout: 20000 });
const raceCount = async () => {
  // The rail only exists once the builder is open; race is its own step.
  await atStep(page, "Race");
  /* This suite is about what an import BRINGS, so it counts the whole list.
     The builder hides other people's material until it is asked for — see
     verify-homebrew-toggle — so ask for it. */
  const toggle = page.getByRole("button", { name: "Show homebrew and third-party content" });
  if ((await toggle.count()) && !/homebrew shown/i.test(await toggle.first().innerText())) {
    await toggle.first().click();
    await page.waitForTimeout(500);
  }
  return (await page.locator('select[aria-label="Race"] option').count()) - 1;
};
// A deployment built WITHOUT a compendium ships nine SRD races; one built
// with it already has hundreds. Both are valid, so this checks the shape
// rather than a number that depends on how the deployment was made.
const before = await raceCount();
const shipped = (await (await fetch(new global.URL("/content/index.json", URL))).status) === 200;
// Consolidated, so 605 flat compendium entries become ~269 races with
// subraces rather than 605 top-level ones.
ok(shipped ? "a shipped compendium is already in the list" : "the SRD list is nine long",
  shipped ? before > 200 : before === 9, true);
await page.getByRole("button", { name: "Cancel" }).click();
await page.waitForTimeout(400);

// Import.
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });
await go(page, "gear");
await page.getByRole("button", { name: "Add a compendium" }).click();
await page.locator('input[aria-label="Compendium file"]').setInputFiles(FILE);
await page.waitForSelector(".chips .chip", { timeout: 180000 });
await page.getByRole("button", { name: "Import", exact: true }).click();
await page.waitForSelector(".src-row:nth-child(2)", { timeout: 300000 });

await page.getByRole("button", { name: "Add character" }).click();
await page.getByRole("button", { name: "Build a character" }).click();
await atStep(page, "Class");
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await atStep(page, "Class");
await page.getByRole("button", { name: "Fighter", exact: true }).click();
await page.waitForTimeout(500);

await atStep(page, "Race");
ok("imported races reach the builder", (await raceCount()) > 200, true);
ok("and a list that long gets a filter",
  await page.locator('input[aria-label="Filter races"]').count(), 1);
await atStep(page, "Race");
await page.locator('input[aria-label="Filter races"]').fill("aasimar");
await page.waitForTimeout(400);
await atStep(page, "Race");
await atStep(page, "Race");
const narrowed = await page.locator('select[aria-label="Race"] option').allInnerTexts();
ok("which narrows it", narrowed.every((t, i) => i === 0 || /aasimar/i.test(t)), true);
ok("to something usable", narrowed.length - 1 > 0 && narrowed.length - 1 < 40, true);
await page.selectOption('select[aria-label="Race"]', { label: narrowed[1] });
await page.waitForTimeout(500);
await atStep(page, "Scores");
ok("and choosing one works like any other",
  (await page.locator(".cr-grid").innerText()).length > 0, true);
await page.screenshot({ path: `${OUT}/60-imported-race.png`, fullPage: true });

// Backgrounds: 270 imported, where the SRD ships one.
await atStep(page, "Class");
for (const s of ["Athletics", "Perception"]) {
  await atStep(page, "Skills");
  await page.getByRole("button", { name: `Train ${s.toLowerCase()}` }).click();
}
await atStep(page, "Scores");
await page.getByRole("button", { name: "Recommend" }).click();
await page.waitForTimeout(400);
await atStep(page, "Story");
ok("a background picker appears once there are backgrounds to pick",
  await page.locator('select[aria-label="Background"]').count(), 1);
await atStep(page, "Story");
await page.locator('input[aria-label="Filter backgrounds"]').fill("Acolyte");
await page.waitForTimeout(400);
await atStep(page, "Story");
await page.selectOption('select[aria-label="Background"]', { label: "Acolyte" });
await page.waitForTimeout(500);
await atStep(page, "Story");
ok("choosing one fills in its name",
  await page.locator('input[aria-label="Background name"]').inputValue(), "Acolyte");
const chosen = await page.locator(".chip.on").allInnerTexts();
ok("and the skills it grants",
  chosen.some((t) => /insight/i.test(t)) && chosen.some((t) => /religion/i.test(t)), true);

// The custom route has to survive alongside it. Background skills cap at two,
// so swapping means dropping one first.
await atStep(page, "Story");
await page.getByRole("button", { name: "religion", exact: true }).click();
await atStep(page, "Story");
await page.getByRole("button", { name: "history", exact: true }).click();
await atStep(page, "Story");
await page.locator('input[aria-label="Background name"]').fill("Greenwarden");
await page.waitForTimeout(400);
const edited = await page.locator(".chip.on").allInnerTexts();
ok("a chosen background can still be edited by hand",
  edited.some((t) => /history/i.test(t)) && !edited.some((t) => /religion/i.test(t)), true);
await atStep(page, "Story");
ok("including its name",
  await page.locator('input[aria-label="Background name"]').inputValue(), "Greenwarden");

await atStep(page, "Review");
await page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
await atStep(page, "Gear");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
// And whatever the class asks about itself — a domain, a fighting style.
await atStep(page, "Scores");
const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls.count()); i++) await cls.nth(i).selectOption({ index: 1 });
await page.waitForTimeout(300);
await page.waitForTimeout(300);
await atStep(page, "Review");
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });
await go(page, "sheet");
ok("the character is made from imported content and reads normally",
  (await page.locator(".hp-big").innerText()).includes("/"), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
