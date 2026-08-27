/* Press and hold to find out what something is — and a shop that can run out.

   Two questions a table asks constantly and the app answered neither: "what
   does this spell actually do" (four hundred words that cannot live on a
   40px row) and "how many has he got" (a shopkeeper form that asked a price
   and hardcoded an endless supply). */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1200 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });
const go = async (tab) => {
  const t = page.locator(`[data-tab="${tab}"]`);
  if (await t.count()) { await t.first().click(); await page.waitForTimeout(400); }
};
/** A real press and hold: down, wait past the threshold, up. */
const hold = async (locator) => {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.waitForTimeout(400);
};

await page.getByRole("button", { name: "Start a room" }).click();
await page.waitForSelector(".rb-code");
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".seatbar");
/* The device that starts a room is the DM, and gear is a player's screen. */
await page.selectOption('select[aria-label="Seat"]', { label: "Kira Vance" });
await page.waitForTimeout(800);

/* --- holding an item ---------------------------------------------------- */
await go("gear");
await page.waitForTimeout(600);
// The sample character carries nothing, so put something in the bag first.
await page.locator(".card", { hasText: "Carrying" }).first()
  .getByRole("button", { name: "Add" }).click();
await page.waitForTimeout(500);
await page.locator('input[aria-label="Search items"]').fill("Longsword");
await page.waitForTimeout(600);
await page.locator(".inv-add", { hasText: /^Longsword/ }).first().click();
await page.waitForTimeout(500);
const first = page.locator(".inv-row .nm").first();
const name = await first.innerText();
await hold(first);
ok("holding a thing says what it is", await page.locator(".pop-pane").count(), 1);
const facts = (await page.locator(".pop-pane").innerText()).replace(/\s+/g, " ");
ok("naming the thing held", facts.toLowerCase().includes(name.toLowerCase().split("\n")[0].trim()), true);
/* Honest about the gap rather than showing an empty panel: not one of the
   10,760 items in the compendium carries a description. */
ok("and saying why there is no prose", /ships no description/i.test(facts), true);
await page.getByRole("button", { name: "Close", exact: true }).click();
await page.waitForTimeout(300);
ok("and it closes", await page.locator(".pop-pane").count(), 0);

/* A tap is not a hold — the row must keep meaning what it meant. */
await first.click();
await page.waitForTimeout(400);
ok("a tap does not open it", await page.locator(".pop-pane").count(), 0);

/* --- a shopkeeper with three of a thing --------------------------------- */
// Prep is the DM's screen.
await page.selectOption('select[aria-label="Seat"]', "dm");
await page.waitForTimeout(700);
await go("prep");
await page.waitForTimeout(500);
const people = page.locator(".card", { hasText: "People" }).first();
await people.getByRole("button", { name: "Add someone" }).click();
await page.waitForTimeout(500);
await page.locator('input[aria-label="NPC name"]').fill("Garrick");
await page.getByRole("button", { name: "Trades with the party" }).click();
await page.waitForTimeout(400);
await page.locator('input[aria-label="Find stock"]').fill("Longsword");
await page.waitForTimeout(700);
ok("the form asks how many, rather than assuming endless",
  await page.locator('input[aria-label="How many"]').count(), 1);
await page.locator('input[aria-label="How many"]').fill("3");
await page.locator("button.inv-add").first().click();
await page.waitForTimeout(500);
const shelf = (await page.locator(".npc-stock").innerText()).replace(/\s+/g, " ");
ok("and the shelf says how many are left", /3 left/i.test(shelf), true);

/* Blank still means endless — a rope merchant does not run out, and the
   default must not have moved just because the question is now asked. */
await page.locator('input[aria-label="Find stock"]').fill("Rope");
await page.waitForTimeout(700);
await page.locator("button.inv-add").first().click();
await page.waitForTimeout(500);
const both = (await page.locator(".npc-stock").innerText()).replace(/\s+/g, " ");
ok("leaving it blank still means an endless supply",
  /rope/i.test(both) && !/rope[^·]*\d+ left/i.test(both), true);

/* And a shelf can be changed later without re-adding the item, which would
   lose the asking price with it. */
await page.locator('input[aria-label="How many Longsword"]').fill("1");
await page.waitForTimeout(400);
ok("a count can be corrected in place",
  /1 left/i.test((await page.locator(".npc-stock").innerText()).replace(/\s+/g, " ")), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
