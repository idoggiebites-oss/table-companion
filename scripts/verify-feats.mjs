/* Feats, in the two places they are chosen.

   They were a dropdown of eight hundred and fifty names. A dropdown is right
   for picking something you already know and wrong for choosing between
   things you have never read — and a feat IS its description. So the test is
   whether you can read what one does BEFORE taking it, and whether the app
   says anything useful about the five hundred that have a prerequisite. */
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
const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// A fighter at 4 — the first level that owes an improvement.
await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });
await page.selectOption('select[aria-label="Class"]', "fighter");
await page.waitForTimeout(400);
for (const s of ["Athletics", "Perception"]) {
  await page.getByRole("button", { name: s, exact: true }).click();
}
await page.locator('input[aria-label="Starting level"]').fill("4");
await page.waitForTimeout(400);
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Recommend" }).click();
await page.waitForTimeout(500);

const picker = page.locator(".feat-pick").first();
await picker.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);

// The list itself, before anything is chosen.
const names = await picker.locator(".menu-hd .nm").allInnerTexts();
ok("the feats are a readable list, not a dropdown", names.length > 40, true);
ok("and it opens on the game's own, not somebody's homebrew",
  names.slice(0, 12).some((n) => n.includes("(")), false);
ok("with the ones people have heard of actually in it",
  ["Alert", "Sentinel", "Lucky", "War Caster"].every((n) =>
    names.some((x) => x.toLowerCase() === n.toLowerCase())), true);
ok("nothing is explained until you point at one",
  await picker.locator(".menu-more").count(), 0);

// What it does, before you take it.
const alert = picker.locator(".menu-row", { hasText: /^ALERT/i }).first();
await alert.locator(".menu-hd").click();
await page.waitForTimeout(300);
const text = await alert.innerText();
ok("opening one says what it actually does", /initiative/i.test(text), true);
ok("and only then offers to take it",
  await alert.getByRole("button", { name: "Take it" }).count(), 1);
await page.screenshot({ path: `${OUT}/60-feat-pick.png`, fullPage: true });

// A prerequisite the app can check, on a character who does not meet it.
// This character is a human, so a halfling-only feat is a clean probe — the
// recommended fighter has Strength 16 and passes every score gate there is.
await page.locator('input[aria-label="Filter feats"]').first().fill("bountiful luck");
await page.waitForTimeout(400);
const halflingOnly = picker.locator(".menu-row").first();
await halflingOnly.locator(".menu-hd").click();
await page.waitForTimeout(300);
ok("a feat you do not qualify for says why",
  /only for a halfling/i.test(await halflingOnly.innerText()), true);
ok("and cannot be taken",
  await halflingOnly.getByRole("button", { name: "Take it" }).count(), 0);

// One it cannot check is stated, never blocked — the table can say no, but
// the app saying no is the end of it.
await page.locator('input[aria-label="Filter feats"]').first().fill("heavily armored");
await page.waitForTimeout(400);
const heavy = picker.locator(".menu-row").first();
await heavy.locator(".menu-hd").click();
await page.waitForTimeout(300);
ok("a requirement it cannot check is stated rather than enforced",
  /the dm decides/i.test(await heavy.innerText()), true);
ok("and does not stop you",
  await heavy.getByRole("button", { name: "Take it" }).count(), 1);

// Take one, and the improvement reads as spent.
await page.locator('input[aria-label="Filter feats"]').first().fill("alert");
await page.waitForTimeout(400);
const again = picker.locator(".menu-row").first();
await again.locator(".menu-hd").click();
await page.waitForTimeout(250);
await again.getByRole("button", { name: "Take it" }).click();
await page.waitForTimeout(400);
ok("taking one shows what you took, not an empty box",
  /alert/i.test(await page.locator(".feat-took").first().innerText()), true);
ok("with a way back out of it",
  await page.getByRole("button", { name: "Choose something else" }).count(), 1);

// Finish the character so the level-up can be reached.
await page.getByRole("button", { name: "nature", exact: true }).click();
await page.getByRole("button", { name: "animal handling", exact: true }).click();
await page.locator('input[aria-label="Background name"]').fill("Soldier");
await page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls.count()); i++) await cls.nth(i).selectOption({ index: 1 });
const kit = page.locator(".kit select");
for (let i = 0; i < (await kit.count()); i++) await kit.nth(i).selectOption({ index: 1 });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });

// --- and the same picker at the table, levelling into an ASI --------------
await page.selectOption('select[aria-label="Seat"]', "dm");
await page.waitForTimeout(500);
await go(page, "party");
await page.getByRole("button", { name: "Milestone" }).click();
await page.waitForTimeout(400);
// A fighter's next improvement after 4 is at 6, so two levels. Read back
// rather than assumed: an award that silently did not land would look like a
// missing feature three steps later, which is how I spent an afternoon.
await page.getByRole("button", { name: "Level the party" }).click();
await page.waitForTimeout(900);
ok("one level awarded is one level owed",
  (await page.locator(".owe").first().innerText()).toLowerCase(), "1 level owed");
await page.getByRole("button", { name: "Level the party" }).click();
await page.waitForTimeout(900);
ok("and two is two — they stack",
  (await page.locator(".owe").first().innerText()).toLowerCase(), "2 levels owed");
await page.selectOption('select[aria-label="Seat"]', { label: "Bel Ashcroft" });
await page.waitForTimeout(600);
await go(page, "sheet");
await page.getByRole("button", { name: "Resolve it" }).first().click();
await page.waitForTimeout(600);

// Take the first of the two owed levels, then open the second — the one
// that offers the improvement.
for (let i = 0; i < 5; i++) {
  if (await page.getByRole("button", { name: "Take a feat" }).count()) break;
  const pad = page.locator(".lv-pad button").first();
  if (await pad.count()) { await pad.click(); await page.waitForTimeout(900); }
  const up = page.getByRole("button", { name: "Resolve it" }).first();
  if (await up.count()) { await up.click(); await page.waitForTimeout(600); }
}
ok("taking one of two owed levels leaves the other",
  await page.locator(".lv").count(), 1);
ok("the level that offers a feat says so",
  await page.getByRole("button", { name: "Take a feat" }).count(), 1);
await page.getByRole("button", { name: "Take a feat" }).click();
await page.waitForTimeout(500);
ok("and offers the same readable list here",
  await page.locator(".feat-pick .menu-hd").count() > 40, true);
const lvAlert = page.locator(".feat-pick .menu-row", { hasText: /^ALERT/i }).first();
await lvAlert.locator(".menu-hd").click();
await page.waitForTimeout(300);
ok("with the description in the same place",
  /initiative/i.test(await lvAlert.innerText()), true);
await page.screenshot({ path: `${OUT}/61-feat-levelup.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
