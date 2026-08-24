/* Carrying things, and what being equipped does to the numbers.

   The claim worth testing is not that a list holds items — it is that
   equipping changes the sheet. Armour class and the attack list are derived,
   so they have to move the moment something is worn, and move back when it
   comes off. */
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
// The builder asks two kinds of question before it will finish: which martial
// weapon the kit means, and what the class asks about itself — a domain, a
// fighting style. Answer both.
const answerGear = async (page) => {
  const sel = page.locator('select[aria-label^="Choose"]');
  for (let i = 0; i < (await sel.count()); i++) {
    await sel.nth(i).selectOption({ index: 1 });
  }
  const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
  for (let i = 0; i < (await cls.count()); i++) {
    await cls.nth(i).selectOption({ index: 1 });
  }
  await page.waitForTimeout(250);
};

/** Sections are tabs now; content is one tap away rather than a scroll. */
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// Gear is its own tab now, and it carries the consequences of equipping —
// armour class and what you would roll — so the loop stays on one screen.
const strip = () => page.locator(".gear-sum b").first();
const attacks = () => page.locator(".gear-atk").allInnerTexts();
const addItem = async (name) => {
  await page.locator('input[aria-label="Search items"]').fill(name);
  await page.waitForTimeout(350);
  await page.locator(".inv-add", { hasText: new RegExp(`^${name}`) }).first().click();
  await page.waitForTimeout(350);
};

// A human fighter under Recommend: str 16 (+3), dex 14 (+2), con 15 — human
// adds +1 to everything, which is why these are one higher than the raw array.
await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await page.getByRole("button", { name: "Fighter", exact: true }).click();
await page.waitForTimeout(300);
for (const s of ["Athletics", "Perception"]) {
  await page.getByRole("button", { name: `Train ${s.toLowerCase()}` }).click();
}
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Recommend" }).click();
await page.getByRole("button", { name: "nature", exact: true }).click();
await page.getByRole("button", { name: "animal handling", exact: true }).click();
await page.locator('input[aria-label="Background name"]').fill("Soldier");
await page.locator('input[aria-label="Character name"]').fill("Kira Vance");
await answerGear(page);
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".hp-big", { timeout: 20000 });

await go(page, "gear");
const baseAc = Number(await strip().innerText());
// A character now arrives WEARING their kit rather than carrying it in a
// pack: chain mail 16 plus a shield. Leaving it packed meant a new player's
// first act was being told to go and equip something.
ok("arrives already wearing the kit", baseAc, 18);
ok("which is the kit the class gave them",
  (await page.locator(".card", { hasText: "Carrying" }).innerText()).toLowerCase()
    .includes("chain mail"), true);
ok("with an empty purse", await page.locator(".inv-purse").innerText(), "0 cp");

await page.locator(".card", { hasText: "Carrying" }).getByRole("button", { name: "Add" }).click();
await page.waitForSelector('input[aria-label="Search items"]');

// --- coins ----------------------------------------------------------------
await page.locator('input[aria-label="Coins"]').fill("10 gp");
await page.locator('input[aria-label="Coins"]').press("Enter");
await page.waitForTimeout(500);
ok("a bare unit is understood", await page.locator(".inv-purse").innerText(), "10 gp");
await page.locator('input[aria-label="Coins"]').fill("-5 sp");
await page.locator('input[aria-label="Coins"]').press("Enter");
await page.waitForTimeout(500);
// The reason money is integer copper: change has to be exact.
ok("and change is exact", await page.locator(".inv-purse").innerText(), "9 gp 5 sp");

// --- armour ---------------------------------------------------------------
await page.getByRole("button", { name: "Put away Chain Mail" }).click();
await page.waitForTimeout(500);
ok("taking the armour off drops the armour class to unarmoured plus shield",
  Number(await strip().innerText()), 12 + 2);

await page.getByRole("button", { name: "Equip Chain Mail" }).click();
await page.waitForTimeout(500);
ok("heavy armour sets armour class and ignores dexterity",
  Number(await strip().innerText()), 16 + 2);

// Medium armour caps dexterity — the most common place hand arithmetic
// disagrees with a sheet.
await page.getByRole("button", { name: "Put away Chain Mail" }).click();
await page.waitForTimeout(400);
await addItem("Half Plate Armor");
await page.getByRole("button", { name: "Equip Half Plate Armor" }).click();
await page.waitForTimeout(500);
ok("medium armour caps dexterity at +2", Number(await strip().innerText()), 15 + 2 + 2);
ok("and says why", (await page.locator(".gear-sum .faint").first().innerText()),
  "Half Plate Armor 15 + dex +2 + Shield 2");

// --- weapons --------------------------------------------------------------
// The kit already put a weapon in their hand — that is the point of it.
ok("the kit's weapon is already an attack",
  (await attacks()).length, 1);
await addItem("Longsword");
await page.getByRole("button", { name: "Equip Longsword" }).click();
await page.waitForTimeout(500);
const list = await attacks();
ok("drawing a second weapon adds a second attack", list.length, 2);
const sword = list.find((t) => t.startsWith("Longsword")) ?? "";
ok("with its damage and the versatile die",
  sword.replace(/\s+/g, " "),
  "Longsword 1d8+3 slashing · 1d10 in two hands +5");
ok("and the derived bonus — str +3, proficiency +2",
  await page.locator(".gear-atk", { hasText: "Longsword" }).locator(".m").innerText(), "+5");

await addItem("Longbow");
await page.getByRole("button", { name: "Equip Longbow" }).click();
await page.waitForTimeout(500);
const both = await attacks();
ok("and a third is a third", both.length, 3);
ok("a bow uses dexterity, and says what it needs",
  (both.find((t) => t.startsWith("Longbow")) ?? "").replace(/\s+/g, " "),
  "Longbow 1d8+2 piercing · 150/600 ft · needs ammunition +4");
await page.screenshot({ path: `${OUT}/45-inventory.png`, fullPage: true });

// --- putting it away is the same in reverse -------------------------------
await page.getByRole("button", { name: "Put away Longbow" }).click();
await page.waitForTimeout(500);
ok("sheathing a weapon takes its attack away", (await attacks()).length, 2);

// Selling armour has to take the armour class with it, even while equipped.
await page.getByRole("button", { name: "Drop Half Plate Armor" }).click();
await page.waitForTimeout(500);
// Unarmoured 12 plus the kit's shield, which is still worn.
ok("dropping worn armour drops its armour class too",
  Number(await strip().innerText()), 14);

// --- it survives a reload, because it is in the log ----------------------
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".tabs", { timeout: 20000 });
await page.waitForTimeout(1200);
await go(page, "gear");
ok("the purse survived", await page.locator(".inv-purse").innerText(), "9 gp 5 sp");
ok("so did what is drawn", (await attacks()).length, 2);
ok("and the armour class it implies", Number(await strip().innerText()), 14);

// Gear and the sheet are two tabs onto the same character: equipping on one
// has to be true on the other, or the split has quietly forked the numbers.
await go(page, "sheet");
ok("the sheet agrees with the gear screen",
  await page.locator(".strip div", { hasText: "Armour" }).locator("b").innerText(), "14");
ok("and carries the same attacks",
  (await page.locator(".atk .n").allInnerTexts()).length, 2);

await go(page, "log");
// The log is read by whoever is deciding what to undo, so it has to name
// things the way a person would.
const feed = await page.locator(".card", { hasText: "Action log" }).innerText();
ok("the log names items, not their ids", feed.includes("Kira Vance drew Half Plate Armor"), true);
ok("and never leaks a slug", /half-plate-armor|longsword\b(?![ ,])/.test(feed.toLowerCase()) &&
  feed.includes("half-plate-armor"), false);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
