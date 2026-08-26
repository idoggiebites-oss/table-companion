/* The player's own screen, as an interface rather than a document.

   It was a 3,131 pixel scroll of eight cards: forty rows of skills, saves and
   features that a player walks past every time to reach their hit points. Now
   the things that change during a session are on the panel, what you are
   wearing is a figure with slots, and the rest is three buttons that carry
   their own answer.

   Measured, not eyeballed: the height of the screen and the count of what is
   on it are the whole claim. */
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
const ctx = await browser.newContext({ viewport: { width: 430, height: 1200 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });
await page.waitForTimeout(1200);
await go(page, "sheet");
await page.waitForSelector(".dl", { timeout: 20000 });

// --- the panel ------------------------------------------------------------
const tall = await page.evaluate(() => document.body.scrollHeight);
ok("the sheet is no longer a document to scroll past", tall < 2600, true);
console.log(`      ${tall}px tall, was 3131`);

ok("skills are not on it", await page.locator(".dw-list").count(), 0);
ok("nor forty rows of features", await page.locator(".feat-row").count(), 0);
/* They are three buttons that answer the question without being opened. */
const openers = await page.locator(".dw-open").allInnerTexts();
ok("but the answer to 'what am I good at' is", /\+7/.test(openers.join(" ")), true);
ok("and to 'which save'", /dex/i.test(openers.join(" ")), true);

await page.getByRole("button", { name: /^Skills, / }).click();
await page.waitForTimeout(300);
const skills = await page.locator(".dw-row").allInnerTexts();
ok("opening skills lists all eighteen", skills.length, 18);
ok("best first, because that is what gets rolled", /stealth/i.test(skills[0]), true);
ok("and the trained ones are marked",
  await page.locator(".dw-row.on").count() > 0, true);
/* Over the panel, not instead of it — the hit points are still on screen. */
ok("with the panel still behind it", await page.locator(".hp-big").count(), 1);
await page.screenshot({ path: `${OUT}/40-panel-skills.png`, fullPage: true });

// --- the doll -------------------------------------------------------------
const empty = await page.locator(".dl-slot.empty").count();
ok("a character carrying nothing has six empty slots", empty, 6);

await go(page, "gear");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.waitForSelector('input[aria-label="Search items"]', { timeout: 20000 });
for (const [what, pick] of [
  ["studded", /^Studded Leather/i], ["longbow", /^Longbow/i],
  ["shortsword", /^Shortsword/i], ["shield", /^Shield/i],
]) {
  await page.locator('input[aria-label="Search items"]').fill(what);
  await page.waitForTimeout(600);
  await page.locator(".inv-add", { hasText: pick }).first().click();
  await page.waitForTimeout(400);
}
await go(page, "sheet");
await page.waitForSelector(".dl", { timeout: 20000 });

/* Carried is not worn. The doll shows what is ON you, and the bag is the
   bag — which is the distinction the old flat list could not make. */
ok("carrying three things fills no slots", await page.locator(".dl-slot.empty").count(), 6);

const acNow = async () =>
  Number((await page.locator(".strip .num").first().innerText()).replace(/\D/g, ""));
const before = await acNow();
await page.getByRole("button", { name: "Body, empty" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Wear Studded Leather/i }).click();
await page.waitForTimeout(600);
ok("wearing the armour fills the body slot",
  await page.locator('.dl-slot[aria-label^="Body:"]').count(), 1);
/* And the armour class does NOT move, which is correct and is the control:
   studded leather is 12 plus a +4 dexterity, and Kira stands at 16 without
   it. A test that asserted a rise here would be asserting a bug. */
ok("armour that changes nothing changes nothing", await acNow(), before);

await page.getByRole("button", { name: "Main hand, empty" }).click();
await page.waitForTimeout(300);
const offered = await page.locator(".dl-row .n").allInnerTexts();
ok("the hand offers only what a hand takes",
  offered.some((t) => /longbow/i.test(t)) && !offered.some((t) => /studded/i.test(t)), true);
await page.getByRole("button", { name: /^Wear Longbow/i }).click();
await page.waitForTimeout(600);

await page.getByRole("button", { name: "Off hand, empty" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Wear Shortsword/i }).click();
await page.waitForTimeout(600);
ok("a second weapon lands in the other hand, not on top of the first",
  await page.locator('.dl-slot[aria-label^="Main hand: Longbow"]').count(), 1);
ok("both hands full", await page.locator(".dl-slot.empty").count(), 3);

/* The case that forces the number to move. A shield is +2 on top of whatever
   you were standing at, and it goes in the hand rather than on the body. */
await page.getByRole("button", { name: /^Off hand: Shortsword/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Take off Shortsword/ }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Off hand, empty" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Wear Shield/i }).click();
await page.waitForTimeout(600);
ok("a shield goes in the hand, not on the body",
  await page.locator('.dl-slot[aria-label^="Off hand: Shield"]').count(), 1);
ok("and it is worth two points of armour", await acNow(), before + 2);
await page.screenshot({ path: `${OUT}/41-panel-doll.png`, fullPage: true });

// and taking something off puts the slot back
await page.getByRole("button", { name: /^Off hand: Shield/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Take off Shield/ }).click();
await page.waitForTimeout(600);
ok("taking it off empties the slot again", await page.locator(".dl-slot.empty").count(), 4);
ok("and the armour class falls with it", await acNow(), before);
await go(page, "gear");
ok("without dropping it",
  (await page.locator(".inv .nm").allInnerTexts()).some((t) => /shield/i.test(t)), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
