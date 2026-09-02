/* Carrying things, and what being equipped does to the numbers.

   The claim worth testing is not that a list holds items — it is that
   equipping changes the sheet. Armour class and the attack list are derived,
   so they have to move the moment something is worn, and move back when it
   comes off. */
import { chromium } from "playwright-core";
import { showInPack } from "./lib/pack.mjs";

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

/* The builder is a flow now: one question per screen, and the rail is how you
   move between them. Every step is reachable at any time — which is also how a
   person changes their mind about a race after picking spells. */
const atStep = async (page, label) => {
  const node = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await node.count()) { await node.first().click(); await page.waitForTimeout(250); }
};
// The builder asks two kinds of question before it will finish: which martial
// weapon the kit means, and what the class asks about itself — a domain, a
// fighting style. Answer both.
const answerGear = async (page) => {
  // Two steps' worth of questions: what the class asks about itself, and
  // which martial weapon the kit meant.
  await atStep(page, "Scores");
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
  await atStep(page, "Gear");
  const sel = page.locator('select[aria-label^="Choose"]');
  for (let i = 0; i < (await sel.count()); i++) {
    await sel.nth(i).selectOption({ index: 1 });
  }
  /* Every class choice, answered — a readable list now, not a dropdown. */
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
/* The armour class on the gear screen. It used to be the first `b` in the
   summary; the summary is now V2's carry band, where the number sits in its
   own crest beside the weight. Named, not positional — the last three times
   this moved, a positional read came back holding a different number. */
const strip = () => page.locator(".carry-ac");
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
await atStep(page, "Class");
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await atStep(page, "Class");
await page.getByRole("button", { name: "Fighter", exact: true }).click();
await page.waitForTimeout(300);
await atStep(page, "Class");
for (const s of ["Athletics", "Perception"]) {
  await atStep(page, "Skills");
  await page.getByRole("button", { name: `Train ${s.toLowerCase()}` }).click();
}
await atStep(page, "Race");
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(400);
await atStep(page, "Scores");
await page.getByRole("button", { name: "Recommend" }).click();
await atStep(page, "Story");
await openPick(page, "Skills");
await page.getByRole("button", { name: "Train nature" }).click();
await atStep(page, "Story");
await openPick(page, "Skills");
await page.getByRole("button", { name: "Train animal handling" }).click();
await atStep(page, "Story");
await page.locator('input[aria-label="Background name"]').fill("Soldier");
await atStep(page, "Review");
await page.locator('input[aria-label="Character name"]').fill("Kira Vance");
await answerGear(page);
await atStep(page, "Review");
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

/* The pack is four tabs; chain mail is under Armour. */
await showInPack(page, /chain mail/i);
await showInPack(page, /Chain\ Mail/i);
await page.getByRole("button", { name: "Equip Chain Mail" }).click();
await page.waitForTimeout(500);
ok("heavy armour sets armour class and ignores dexterity",
  Number(await strip().innerText()), 16 + 2);

// Medium armour caps dexterity — the most common place hand arithmetic
// disagrees with a sheet.
await page.getByRole("button", { name: "Put away Chain Mail" }).click();
await page.waitForTimeout(400);
await addItem("Half Plate Armor");
await showInPack(page, /Half\ Plate\ Armor/i);
await page.getByRole("button", { name: "Equip Half Plate Armor" }).click();
await page.waitForTimeout(500);
ok("medium armour caps dexterity at +2", Number(await strip().innerText()), 15 + 2 + 2);
/* The derivation, in the carry band's own line. It was `.gear-sum .faint`,
   which is now the first attack's detail — the sum moved into `.carry-from`
   when the band was ported, and a class-based read landed on whatever
   happened to be faint next. */
ok("and says why", (await page.locator(".carry-from").innerText()),
  "Half Plate Armor 15 + dex +2 + Shield 2");

// --- weapons --------------------------------------------------------------
// The kit already put a weapon in their hand — that is the point of it.
ok("the kit's weapon is already an attack",
  (await attacks()).length, 1);
await addItem("Longsword");
await showInPack(page, /Longsword/i);
await page.getByRole("button", { name: "Equip Longsword" }).click();
await page.waitForTimeout(500);
const list = await attacks();
ok("drawing a second weapon adds a second attack", list.length, 2);
const sword = list.find((t) => t.startsWith("Longsword")) ?? "";
/* A shield is up, so only the one-handed grip is offered — the versatile die
   used to be printed as a note here and then never rolled. */
ok("with its damage and the grip it is actually held in",
  sword.replace(/\s+/g, " "),
  "Longsword 1d8+3 slashing · one hand +5");
ok("and the derived bonus — str +3, proficiency +2",
  await page.locator(".gear-atk", { hasText: "Longsword" }).locator(".m").innerText(), "+5");
ok("and no two-handed row, because a shield is a hand",
  list.some((t) => /two-handed/i.test(t)), false);

/* Take the shield off and the second grip appears — 1d10, rolled rather than
   mentioned. This is the whole of the versatile rule and the app used to
   print it and ignore it. */
await page.getByRole("button", { name: "Put away Shield" }).click();
await page.waitForTimeout(500);
const freeHand = await attacks();
const twoH = freeHand.find((t) => /two-handed/i.test(t)) ?? "";
ok("a free hand offers the two-handed grip", twoH !== "", true);
ok("and it rolls the bigger die", /1d10/.test(twoH), true);
await showInPack(page, /Shield/i);
await page.getByRole("button", { name: "Equip Shield" }).click();
await page.waitForTimeout(500);

/* A longbow needs both hands, so putting it up takes down whatever was in
   them — as its own event, so the log says so. */
await addItem("Longbow");
await showInPack(page, /Longbow/i);
await page.getByRole("button", { name: "Equip Longbow" }).click();
await page.waitForTimeout(600);
const both = await attacks();
ok("a two-handed weapon takes the hands it needs",
  both.length, 1);
ok("a bow uses dexterity, and says what it needs",
  (both.find((t) => t.startsWith("Longbow")) ?? "").replace(/\s+/g, " "),
  "Longbow 1d8+2 piercing · 150/600 ft · needs ammunition +4");
/* And the shield went with them — which is the point: the app was handing
   out +2 armour class for a hand that was holding a bow. */
ok("including the shield, and its two points of armour",
  Number(await strip().innerText()), 15 + 2);
await page.screenshot({ path: `${OUT}/45-inventory.png`, fullPage: true });

// --- putting it away is the same in reverse -------------------------------
await page.getByRole("button", { name: "Put away Longbow" }).click();
await page.waitForTimeout(500);
ok("sheathing a weapon takes its attack away", (await attacks()).length, 0);
await showInPack(page, /Longsword/i);
await page.getByRole("button", { name: "Equip Longsword" }).click();
await page.waitForTimeout(500);

// Selling armour has to take the armour class with it, even while equipped.
await page.getByRole("button", { name: "Drop Half Plate Armor" }).click();
await page.waitForTimeout(500);
// Unarmoured 12, and the shield came off with the bow.
ok("dropping worn armour drops its armour class too",
  Number(await strip().innerText()), 12);

// --- it survives a reload, because it is in the log ----------------------
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".tabs", { timeout: 20000 });
await page.waitForTimeout(1200);
await go(page, "gear");
ok("the purse survived", await page.locator(".inv-purse").innerText(), "9 gp 5 sp");
ok("so did what is drawn", (await attacks()).length, 2);
ok("and the armour class it implies", Number(await strip().innerText()), 12);

// Gear and the sheet are two tabs onto the same character: equipping on one
// has to be true on the other, or the split has quietly forked the numbers.
await go(page, "sheet");
ok("the sheet agrees with the gear screen",
  /* By name: the strip's armour cell is labelled "AC" as the concept labels
     it, and hit points joined the strip in front of it, so neither the word
     nor the position it used to hold survived. */
  await page.locator(".strip > div").filter({ has: page.getByText("AC", { exact: true }) })
    .locator("b").innerText(), "12");
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
