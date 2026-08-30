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

/* --- the order, pinned ---------------------------------------------------

   VISION law 7: a screen is ordered by the questions it raises, not by the
   order its features were built. Nothing enforces that on its own — a new
   card has to go somewhere and the bottom is always free, which is exactly
   how conditions and concentration ended up below fourteen hundred pixels of
   equipment.

   So the order is written down here. This assertion is not defending these
   six cards; it is defending the decision. A seventh card fails it, and the
   only way past is to look at the list and say where the new one belongs. */
const order = await page.evaluate(() =>
  [...document.querySelectorAll(".card")]
    .filter((c) => !c.parentElement.closest(".card"))
    .map((c) => (c.querySelector(".card-hd .label, .label")?.textContent ?? "?").trim()));
ok("the sheet asks its questions in order: what is true of you, what you can do, what you are",
  order.join(" > "),
  "ranger 8 > Hit points > State > Pools > Attacks > Worn & wielded");

/* --- a press is acknowledged ---------------------------------------------

   A hundred and forty buttons and not one of them moved when pressed. On a
   phone the finger covers the target, so the only confirmation a tap
   registered was whatever changed afterwards — and in this app "afterwards"
   is often a round trip to another device. It is a good part of what reads as
   clunky.

   Measured on the live element rather than by reading the stylesheet, because
   a rule that exists and a rule that WINS are different claims. A pixel, not
   a scale: these sit in lists of 44px rows and anything that changes a
   button's size reflows the row under a thumb still resting on it. */
/* The tab already showing, so the press is a no-op — pressing any OTHER
   button here navigates, and the two assertions further down then measure a
   screen that is not the sheet. */
const tab = page.locator('.tabs [data-tab="sheet"]').first();
const atRest = await tab.evaluate((e) => getComputedStyle(e).transform);
const seat = await tab.boundingBox();
await page.mouse.move(seat.x + seat.width / 2, seat.y + seat.height / 2);
await page.mouse.down();
await page.waitForTimeout(200);
const held = await tab.evaluate((e) => ({
  transform: getComputedStyle(e).transform,
  background: getComputedStyle(e).backgroundColor,
}));
await page.mouse.up();
await page.waitForTimeout(250);
ok("a button at rest is not translated", atRest, "none");
ok("and moves one pixel down while held", held.transform, "matrix(1, 0, 0, 1, 0, 1)");
ok("and darkens, so the press reads even under a finger",
  held.background, "rgb(22, 26, 24)");
ok("returning when released", await tab.evaluate((e) => getComputedStyle(e).transform), "none");

/* One landmark, so a screen reader can skip the room code, the seat selector
   and the tab bar to reach what the page is actually about. */
ok("the content region is a landmark", await page.locator("main").count(), 1);

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

/* A longbow is held in both hands, so there is no off hand to fill — the
   slot says which weapon has it rather than drawing an inviting empty box,
   and it cannot be pressed. Equipping a shortsword there anyway would be a
   picture of something that cannot happen. */
ok("a two-handed weapon leaves no off hand",
  await page.getByRole("button", { name: /^Off hand, holding Longbow/ }).count(), 1);
ok("and it cannot be filled",
  await page.getByRole("button", { name: /^Off hand, holding Longbow/ }).isDisabled(), true);

/* Putting a one-handed weapon up takes the bow down, as its own event — a
   swap is one tap and the log says both halves of it. */
await page.getByRole("button", { name: /^Main hand: Longbow/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Take off Longbow/ }).click();
await page.waitForTimeout(500);
/* A lone weapon goes to the main hand — the off hand is for the SECOND one,
   which is what slotFor means by "taken". */
await page.getByRole("button", { name: "Main hand, empty" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Wear Shortsword/i }).click();
await page.waitForTimeout(600);
ok("a one-handed weapon goes up, and the other hand is free again",
  await page.locator('.dl-slot[aria-label^="Main hand: Shortsword"]').count(), 1);
ok("with a real empty off hand this time",
  await page.getByRole("button", { name: "Off hand, empty" }).count(), 1);

/* The case that forces the number to move. A shield is +2 on top of whatever
   you were standing at, and it goes in the hand rather than on the body —
   the free one, beside the sword. */
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
