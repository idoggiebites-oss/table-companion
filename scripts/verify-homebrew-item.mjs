/* A thing the DM made up, that the app reads as a thing.

   The homebrew tool could only make creatures, so a magic sword lived in
   somebody's notes: it could not be carried, equipped, swung, priced or sold,
   and the app had no idea it was a weapon.

   The test is not that the form saves. It is that NOTHING DOWNSTREAM KNOWS:
   the sword turns up in the bag, goes in a hand, puts its own damage on the
   sheet, brings both grips because it is versatile, and displaces a shield
   when it needs the hand. None of those code paths were told about homebrew. */
import { chromium } from "playwright-core";
import { sitIn } from "./lib/seat.mjs";
import { showInPack } from "./lib/pack.mjs";



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
const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });
const go = async (tab) => {
  const t = page.locator(`[data-tab="${tab}"]`);
  if (await t.count()) { await t.first().click(); await page.waitForTimeout(400); }
};

await page.getByRole("button", { name: "The table", exact: true }).click();
await page.getByRole("button", { name: "Start a room" }).click();
await page.waitForSelector(".rb-code");
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector('select[aria-label="Seat"], [data-testid="seat"], .join-row');
await page.waitForTimeout(600);

// --- write up a versatile sword ------------------------------------------
await go("prep");
const card = page.locator(".card", { hasText: "Homebrew" }).first();
await card.getByRole("button", { name: "A thing" }).click();
await page.waitForTimeout(400);
ok("the tool can make things, not only creatures",
  await page.getByRole("button", { name: "It is a weapon" }).count(), 1);

await page.locator('input[aria-label="Item name"]').fill("Ashbrand");
await page.locator('input[aria-label="Item price"]').fill("50 gp");
await page.locator('input[aria-label="Damage dice"]').fill("1d8");
await page.locator('input[aria-label="Damage type"]').fill("fire");
await page.getByRole("button", { name: "Martial weapon" }).click();
await page.getByRole("button", { name: "Property versatile" }).click();
await page.waitForTimeout(300);
await page.locator('input[aria-label="Two-handed damage"]').fill("1d10");
await page.waitForTimeout(400);

/* The panel is the point of the screen: what the APP reads, not what was
   typed, produced by the same function that saves it. */
const reads = (await page.locator(".hb-reads").innerText()).replace(/\s+/g, " ");
ok("the tool says what it read, not what was typed", /1d8 fire/i.test(reads), true);
ok("including the second grip", /1d10 in two hands/i.test(reads), true);
ok("and that it is a martial weapon", /martial/i.test(reads), true);
ok("and that it goes in a hand", /goes in a hand/i.test(reads), true);

await page.getByRole("button", { name: "Save the item" }).click();
await page.waitForTimeout(600);
ok("and it is written up", await page.locator(".sv-row", { hasText: "Ashbrand" }).count(), 1);

// --- now: does anything downstream know it is homebrew? ------------------
await sitIn(page, "Kira Vance");
await page.waitForTimeout(800);
await go("gear");
await page.locator(".card", { hasText: "Carrying" }).first()
  .getByRole("button", { name: "Add" }).click();
await page.waitForTimeout(500);
await page.locator('input[aria-label="Search items"]').fill("Ashbrand");
await page.waitForTimeout(700);
/* Marked (HB) like every other piece of homebrew, so provenance survives and
   the same filters and badges apply. */
ok("a made-up thing is findable in the catalogue",
  await page.locator(".inv-add", { hasText: /Ashbrand/ }).count(), 1);
ok("carrying its provenance",
  /\(HB\)/.test(await page.locator(".inv-add", { hasText: /Ashbrand/ }).first().innerText()), true);
await page.locator(".inv-add", { hasText: /Ashbrand/ }).first().click();
await page.waitForTimeout(500);

const attacks = () => page.locator(".gear-atk").allInnerTexts();
const before = (await attacks()).length;
await page.getByRole("button", { name: /^Equip Ashbrand/ }).click();
await page.waitForTimeout(700);
const after = await attacks();
/* The whole claim: a weapon the DM invented swings. Nothing in the attack
   path was told about homebrew. */
ok("equipping it puts an attack on the sheet", after.length > before, true);
const row = after.find((t) => /Ashbrand/.test(t)) ?? "";
ok("with the damage that was written up", /1d8/.test(row), true);
ok("and the damage type", /fire/i.test(row), true);
/* Versatile, read by the same rule that reads a longsword's. */
/* The provenance marker sits in the name, so the grip reads "Ashbrand (HB),
   two-handed" — matched loosely on purpose, since where the marker goes is
   not what this assertion is about. */
ok("and the second grip, because it is versatile",
  after.some((t) => /Ashbrand.*two-handed/i.test(t)), true);
ok("which rolls the bigger die",
  /1d10/.test(after.find((t) => /two-handed/i.test(t)) ?? ""), true);

/* --- armour the DM made up moves the number ------------------------------

   The claim is not "it saved". It is that armourClass() reads it — including
   the dexterity cap, which is the most common place hand arithmetic
   disagrees with a sheet. */
await sitIn(page, "dm");
await page.waitForTimeout(700);
await go("prep");
await page.locator(".card", { hasText: "Homebrew" }).first()
  .getByRole("button", { name: "A thing" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "It is a armour" }).click();
await page.waitForTimeout(300);
await page.locator('input[aria-label="Item name"]').fill("Cinder Mail");
await page.getByRole("button", { name: "Medium armour" }).click();
await page.waitForTimeout(300);
await page.locator('input[aria-label="Base armour class"]').fill("15");
await page.waitForTimeout(400);
ok("medium armour says it caps dexterity",
  /capped at \+2/i.test(await page.locator(".card-body", { hasText: "What the app reads" }).innerText()),
  true);
await page.getByRole("button", { name: "Save the item" }).click();
await page.waitForTimeout(600);

await sitIn(page, "Kira Vance");
await page.waitForTimeout(800);
await go("gear");
const acNow = async () =>
  /* The armour class, by name. It was the first `b` in the gear summary or
     the strip; the summary is V2's carry band now, where the number sits in
     its own crest, and hit points lead the strip. */
  Number(await page.locator(".carry-ac").innerText());
const acBefore = await acNow();
await page.locator(".card", { hasText: "Carrying" }).first()
  .getByRole("button", { name: "Add" }).click();
await page.waitForTimeout(400);
await page.locator('input[aria-label="Search items"]').fill("Cinder Mail");
await page.waitForTimeout(700);
await page.locator(".inv-add", { hasText: /Cinder Mail/ }).first().click();
await page.waitForTimeout(400);
/* A homebrew suit of armour lands under the Armour heading, and the pack is
   four tabs — so the row is only in the DOM once that tab is showing. */
await showInPack(page, /Cinder Mail/i);
await page.getByRole("button", { name: /^Equip Cinder Mail/ }).click();
await page.waitForTimeout(700);
const acAfter = await acNow();
ok("armour the DM invented moves the armour class", acAfter !== acBefore, true);
/* Kira has dex 18 (+4), and medium armour caps it at +2 — so 15 + 2, not
   15 + 4. The cap is the point: it is where hand arithmetic goes wrong. */
ok("and caps dexterity the way medium armour does", acAfter, 17);
ok("saying so on the sheet",
  /capped/i.test(await page.locator(".gear-sum").innerText()), true);

/* --- and it can be sold ---------------------------------------------------

   A shopkeeper who cannot stock the sword the DM invented last week is a
   shopkeeper with the wrong stock. It is already an item everywhere else. */
await sitIn(page, "dm");
await page.waitForTimeout(700);
await go("prep");
await page.locator(".card", { hasText: "People" }).first()
  .getByRole("button", { name: "Add someone" }).click();
await page.waitForTimeout(500);
await page.locator('input[aria-label="NPC name"]').fill("Garrick");
await page.getByRole("button", { name: "Trades with the party" }).click();
await page.waitForTimeout(400);
await page.locator('input[aria-label="Find stock"]').fill("Ashbrand");
await page.waitForTimeout(700);
ok("a made-up thing can go on a shelf",
  await page.locator("button.inv-add", { hasText: /Ashbrand/ }).count(), 1);
await page.locator('input[aria-label="How many"]').fill("1");
await page.locator("button.inv-add").first().click();
await page.waitForTimeout(500);
ok("with a count, because there is only one of it",
  /1 left/i.test((await page.locator(".npc-stock").innerText()).replace(/\s+/g, " ")), true);

/* --- two tools, not one form with a mode ---------------------------------

   A creature has hit dice and a challenge rating; a sword has damage and a
   price. They share the word "homebrew" and nothing else, and mixing them
   into one form is how a DM ends up giving a sword a walking speed. */
await sitIn(page, "dm");
await page.waitForTimeout(700);
await go("prep");
const hb = page.locator(".card", { hasText: "Homebrew" }).first();
await hb.getByRole("button", { name: "A creature" }).click();
await page.waitForTimeout(400);
ok("the creature tool asks for hit dice",
  await page.locator('input[aria-label="Homebrew hit dice"]').count(), 1);
ok("and not for a price",
  await page.locator('input[aria-label="Item price"]').count(), 0);
await hb.getByRole("button", { name: "A thing" }).click();
await page.waitForTimeout(400);
ok("the thing tool asks for a price",
  await page.locator('input[aria-label="Item price"]').count(), 1);
ok("and not for hit dice",
  await page.locator('input[aria-label="Homebrew hit dice"]').count(), 0);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
