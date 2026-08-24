/* More than one class.

   The arithmetic nobody does right at a table without the book open: one
   effective caster level read off the full-caster table, hit dice as a pool
   rather than a die, and a prerequisite that cuts both ways. */
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

/* The builder is a flow now: one question per screen, and the rail is how you
   move between them. Every step is reachable at any time — which is also how a
   person changes their mind about a race after picking spells. */
const atStep = async (page, label) => {
  const node = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await node.count()) { await node.first().click(); await page.waitForTimeout(250); }
};
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(300);
};
const answerLevel = async (page) => {
  for (const chips of await page.locator(".lv-choice .chips").all()) {
    const first = chips.locator("button").first();
    if (await first.count()) { await first.click(); await page.waitForTimeout(300); }
  }
  for (let i = 0; i < 4; i++) {
    const head = page.locator(".lv-choice .menu-hd").first();
    if ((await head.count()) === 0) break;
    await head.click();
    await page.waitForTimeout(250);
    const take = page.getByRole("button", { name: "Learn it" }).first();
    if ((await take.count()) === 0) break;
    await take.click();
    await page.waitForTimeout(350);
  }
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// A cleric at 3 — a full caster, d8, Wisdom high enough to keep it and to dip.
await page.getByRole("button", { name: "Build a character" }).click();
await atStep(page, "Class");
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await atStep(page, "Class");
await page.getByRole("button", { name: "Cleric", exact: true }).click();
await page.waitForTimeout(500);
await atStep(page, "Class");
await page.locator('input[aria-label="Starting level"]').fill("3");
await page.waitForTimeout(400);
await atStep(page, "Class");
for (const s of ["Medicine", "Religion"]) {
  await atStep(page, "Skills");
  const b = page.getByRole("button", { name: `Train ${s.toLowerCase()}` });
  if (await b.count()) await b.first().click();
}
await atStep(page, "Race");
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(600);
await atStep(page, "Scores");
await page.getByRole("button", { name: "Recommend" }).click();
await page.waitForTimeout(500);
await atStep(page, "Story");
await page.getByRole("button", { name: "nature", exact: true }).click();
await atStep(page, "Story");
await page.getByRole("button", { name: "animal handling", exact: true }).click();
await atStep(page, "Story");
await page.locator('input[aria-label="Background name"]').fill("Acolyte");
await atStep(page, "Review");
await page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
await atStep(page, "Gear");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
await atStep(page, "Scores");
const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls.count()); i++) await cls.nth(i).selectOption({ index: 1 });
await atStep(page, "Gear");
const kit = page.locator(".kit select");
for (let i = 0; i < (await kit.count()); i++) await kit.nth(i).selectOption({ index: 1 });
await page.waitForTimeout(400);
await atStep(page, "Review");
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });

await go(page, "spells");
const before = await page.locator(".slot .num").allInnerTexts();
ok("a cleric at 3 has a cleric's slots", before, ["4", "2"]);

// The DM grants a level; the player takes it somewhere new.
await page.selectOption('select[aria-label="Seat"]', "dm");
await page.waitForTimeout(600);
await go(page, "party");
await page.getByRole("button", { name: "Milestone" }).click();
await page.waitForTimeout(500);
for (let i = 0; i < 3; i++) {
  await page.getByRole("button", { name: "Level the party" }).click();
  await page.waitForTimeout(800);
}
await page.selectOption('select[aria-label="Seat"]', { label: "Bel Ashcroft" });
await page.waitForTimeout(700);
await go(page, "sheet");
await page.getByRole("button", { name: "Resolve it" }).first().click();
await page.waitForTimeout(1500);

const picker = page.locator('select[aria-label="Class to level"]');
ok("the level can go somewhere new", await picker.count(), 1);
const options = await picker.locator("option").allInnerTexts();
ok("naming the class they have, and what it would become",
  options.some((o) => /cleric 3 . 4/i.test(o.replace(/[→>]/g, "."))), true);
ok("and offering classes they do not have", options.length > 5, true);
await page.screenshot({ path: `${OUT}/95-multiclass-pick.png`, fullPage: true });

/* A recommended cleric has Wisdom 16 and Intelligence left low, so wizard is
   the one they cannot have — and the app says which score, rather than just
   greying the option out. */
await picker.selectOption("wizard");
await page.waitForTimeout(600);
ok("a class they do not qualify for is refused",
  await page.locator(".lv-block").count(), 1);
ok("naming the score that stopped it",
  /intelligence 13/i.test(await page.locator(".lv-block").innerText()), true);
ok("and the roll stays blocked",
  await page.locator(".lv-pad button").first().isDisabled(), true);
await page.screenshot({ path: `${OUT}/96-multiclass-blocked.png`, fullPage: true });

/* Barbarian they do qualify for: Strength is high enough, and a cleric's own
   Wisdom minimum is met. Dipping it brings a d12 and no magic at all. */
await picker.selectOption("barbarian");
await page.waitForTimeout(700);
ok("one they do qualify for is not refused",
  await page.locator(".lv-block").count(), 0);
await atStep(page, "Class");
ok("and the app says what a first level in it brings",
  /hit die/i.test(await page.locator(".cr-note").first().innerText()), true);

await answerLevel(page);
const pad = await page.locator(".lv-pad button").allInnerTexts();
ok("rolling the new class's die, not the one they started with",
  pad.includes("12"), true);
await page.locator(".lv-pad button").first().click();
await page.waitForTimeout(1800);

await go(page, "sheet");
const sheet = (await page.locator(".app").innerText()).replace(/\s+/g, " ");
ok("the sheet names both classes",
  /cleric 3/i.test(sheet) && /barbarian 1/i.test(sheet), true);
ok("and hit dice become a pool you choose from",
  await page.locator('select[aria-label="Which hit die"]').count(), 1);
const sizes = await page.locator('select[aria-label="Which hit die"] option').allInnerTexts();
ok("with one entry per die size", sizes.length, 2);
await page.screenshot({ path: `${OUT}/97-multiclass-sheet.png`, fullPage: true });

/* Barbarian casts nothing, so the effective caster level is still 3 and the
   slots must not move. A table that added the two class tables together would
   hand out more here. */
await go(page, "spells");
ok("a dip into a non-caster leaves the slots exactly alone",
  await page.locator(".slot .num").allInnerTexts(), ["4", "2"]);


// --- and building one from scratch ---------------------------------------
/* Every screen before the review answers a single class's questions, which is
   what makes them legible. A rebuild happens in this order anyway: you know
   you are a Fighter 5 / Warlock 3, so you build the fighter and add the
   warlock. */
const p2 = await (await browser.newContext({ viewport: { width: 430, height: 1500 } })).newPage();
p2.on("pageerror", (e) => errors.push(`${e}`));
await p2.goto(URL, { waitUntil: "networkidle" });
await p2.getByRole("button", { name: "Build a character" }).click();
await p2.waitForSelector(".klass-cards", { timeout: 20000 });
await p2.getByRole("button", { name: "Fighter", exact: true }).click();
await p2.waitForTimeout(400);
await atStep(p2, "Skills");
for (const s of ["athletics", "perception"]) {
  const t = p2.getByRole("button", { name: `Train ${s}` });
  if (await t.count()) await t.click();
}
await atStep(p2, "Class");
await p2.locator('input[aria-label="Starting level"]').fill("5");
await p2.waitForTimeout(400);
await atStep(p2, "Race");
await p2.locator('input[aria-label="Filter races"]').fill("human");
await p2.waitForTimeout(600);
const hh = await p2.locator('select[aria-label="Race"] option').allInnerTexts();
await p2.selectOption('select[aria-label="Race"]', { label: hh[1] });
await p2.waitForTimeout(700);
await atStep(p2, "Scores");
await p2.getByRole("button", { name: "Recommend" }).click();
await p2.waitForTimeout(600);
const cls2 = p2.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls2.count()); i++) await cls2.nth(i).selectOption({ index: 1 });
const imp = p2.locator(".card", { hasText: "Improvements" }).locator(".chip:not([disabled])");
for (let i = 0; i < Math.min(2, await imp.count()); i++) {
  await imp.first().click();
  await p2.waitForTimeout(200);
}
await atStep(p2, "Story");
await p2.getByRole("button", { name: "nature", exact: true }).click();
await p2.getByRole("button", { name: "insight", exact: true }).click();
await p2.locator('input[aria-label="Background name"]').fill("Soldier");
await atStep(p2, "Gear");
const sel2 = p2.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel2.count()); i++) await sel2.nth(i).selectOption({ index: 1 });
const kit2 = p2.locator(".kit select");
for (let i = 0; i < (await kit2.count()); i++) await kit2.nth(i).selectOption({ index: 1 });
await atStep(p2, "Review");
await p2.locator('input[aria-label="Character name"]').fill("Bel Twiceborn");
await p2.waitForTimeout(500);

const adder = p2.locator('select[aria-label="Add a class"]');
ok("the review asks whether this is more than one class", await adder.count(), 1);
const totalLine = () => p2.locator(".mc .cnt b").first().innerText();
ok("counting the levels so far", await totalLine(), "5");

/* A recommended fighter has Charisma 8, so warlock is refused — and the app
   names the score rather than greying the option out. */
await adder.selectOption("warlock");
await p2.waitForTimeout(700);
ok("a class they do not qualify for is refused here too",
  /charisma 13/i.test(await p2.locator(".lv-block").innerText()), true);
const create2 = p2.getByRole("button", { name: "Create character" });
ok("and the character cannot be finished", await create2.isDisabled(), true);
await p2.getByRole("button", { name: "Remove Warlock" }).click();
await p2.waitForTimeout(500);

// Barbarian they do qualify for: Strength is high, and a fighter's own
// minimum is met. It also brings a d12, which the pool has to show.
await adder.selectOption("barbarian");
await p2.waitForTimeout(600);
await p2.locator('input[aria-label="Barbarian levels"]').fill("3");
await p2.waitForTimeout(600);
ok("adding a class adds its levels to the total", await totalLine(), "8");
ok("and it can be finished", await create2.isDisabled(), false);
await p2.screenshot({ path: `${OUT}/I0-multiclass-build.png`, fullPage: true });
await create2.click();
await p2.waitForSelector(".hp-big", { timeout: 20000 });

await go(p2, "sheet");
const sheet2 = (await p2.locator(".app").innerText()).replace(/\s+/g, " ");
ok("arriving as both classes",
  /fighter 5/i.test(sheet2) && /barbarian 3/i.test(sheet2), true);
ok("with hit dice as a pool it can choose from",
  await p2.locator('select[aria-label="Which hit die"]').count(), 1);
const sizes2 = await p2.locator('select[aria-label="Which hit die"] option').allInnerTexts();
ok("of the two sizes it actually has", sizes2.length, 2);
ok("of the sizes it actually has",
  sizes2.some((t) => /d10/.test(t)) && sizes2.some((t) => /d12/.test(t)), true);
/* Neither class casts, so the effective caster level is zero and there must
   be no Spells tab at all — a table that added class tables together would
   hand out slots here. */
ok("and no spells, because neither class casts",
  await p2.locator('[data-tab="spells"]').count(), 0);
await p2.screenshot({ path: `${OUT}/I1-multiclass-sheet.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
