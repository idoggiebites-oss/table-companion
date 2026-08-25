/* The half of a racial bonus the race does not decide for you.

   A half-elf gets +2 Charisma and "two different ability scores of your
   choice increase by 1"; a variant human gets nothing fixed, two free points,
   a skill and a feat. The builder applied the fixed half and silently dropped
   the rest — so a half-elf arrived two points short of what the book says, on
   the one screen whose whole job is showing consequences. */
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
const atStep = async (page, label) => {
  const n = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await n.count()) { await n.first().click(); await page.waitForTimeout(250); }
};
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(300);
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await page.getByRole("button", { name: "Fighter", exact: true }).click();
await page.waitForTimeout(400);
await atStep(page, "Skills");
for (const s of ["athletics", "perception"]) {
  const t = page.getByRole("button", { name: `Train ${s}` });
  if (await t.count()) await t.click();
}

// A race that decides for you asks for nothing.
await atStep(page, "Race");
await page.locator('input[aria-label="Filter races"]').fill("dwarf, hill");
await page.waitForTimeout(600);
const dw = await page.locator('select[aria-label="Race"] option').allInnerTexts();
await page.selectOption('select[aria-label="Race"]', { label: dw[1] });
await page.waitForTimeout(700);
ok("a race that decides for you asks for nothing",
  await page.getByRole("button", { name: "Raise str" }).count(), 0);

// A half-elf leaves two points.
await page.locator('input[aria-label="Filter races"]').fill("half-elf");
await page.waitForTimeout(600);
const he = await page.locator('select[aria-label="Race"] option').allInnerTexts();
await page.selectOption('select[aria-label="Race"]', { label: he[1] });
await page.waitForTimeout(800);
const said = (await page.locator(".card-body").filter({ hasText: "leaves" }).first().innerText())
  .replace(/\s+/g, " ");
ok("a half-elf leaves two points to you", /leaves 2 points/i.test(said), true);
ok("and counts them off", /0 of 2/.test(said), true);
await page.screenshot({ path: `${OUT}/G1-race-choice.png`, fullPage: true });

/* Unspent points block the finish — a character two short of the book is not
   a finished character. */
await atStep(page, "Review");
ok("and will not finish until they are spent",
  /racial ability points/i.test(await page.locator(".card", { hasText: "Your hero" }).innerText()), true);

await atStep(page, "Race");
await page.getByRole("button", { name: "Raise str" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Raise con" }).click();
await page.waitForTimeout(400);
ok("spending them satisfies it",
  /2 of 2/.test(await page.locator(".card-body").filter({ hasText: "leaves" }).first().innerText()),
  true);
ok("and they must be different abilities",
  await page.getByRole("button", { name: "Raise dex" }).isDisabled(), true);

// The score has actually moved.
await atStep(page, "Scores");
await page.getByRole("button", { name: "Recommend" }).click();
await page.waitForTimeout(600);
const strRow = await page.locator(".cr-ab", { hasText: "str" }).first().innerText();
ok("the racial term is shown as its own, not a mystery total",
  /\+ ?1/.test(strRow.replace(/\s+/g, " ")), true);

/* And the number MOVES. Showing the term while the total stays put is
   exactly what a silently-dropped spread looks like, and it is what happened
   the first time this was wired. */
const scoreOf = async (a) => {
  const t = (await page.locator(".cr-ab", { hasText: a }).first().innerText()).replace(/\s+/g, " ");
  return Number(t.match(/\b(\d{1,2})\b(?!.*\b\d{1,2}\b)/)?.[1] ?? 0);
};
const strTotal = await scoreOf("str");
await atStep(page, "Race");
await page.getByRole("button", { name: "Raise str" }).click();
await page.waitForTimeout(400);
await atStep(page, "Scores");
ok("giving a point back lowers the total", (await scoreOf("str")) < strTotal, true);
await atStep(page, "Race");
await page.getByRole("button", { name: "Raise str" }).click();
await page.waitForTimeout(400);
await atStep(page, "Scores");
ok("and taking it again raises it", await scoreOf("str"), strTotal);

/* A half-elf's Skill Versatility is two more skills, and the gate holds for
   those too — this suite forgot them and the review said so, which is the
   gate doing its job. */
await atStep(page, "Race");
await page.getByRole("button", { name: "Race skill acrobatics" }).click();
await page.getByRole("button", { name: "Race skill stealth" }).click();
await page.waitForTimeout(400);

// The character arrives with it.
await atStep(page, "Story");
await openPick(page, "Skills");
await page.getByRole("button", { name: "Train nature" }).click();
await openPick(page, "Skills");
await page.getByRole("button", { name: "Train insight" }).click();
await page.locator('input[aria-label="Background name"]').fill("Wanderer");
await atStep(page, "Gear");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
const kit = page.locator(".kit select");
for (let i = 0; i < (await kit.count()); i++) await kit.nth(i).selectOption({ index: 1 });
await atStep(page, "Scores");
const cls2 = page.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls2.count()); i++) await cls2.nth(i).selectOption({ index: 1 });
await atStep(page, "Review");
await page.locator('input[aria-label="Character name"]').fill("Ilda Brightwood");
await page.waitForTimeout(400);
const create = page.getByRole("button", { name: "Create character" });
ok("and the character can now be finished", await create.isDisabled(), false);
await create.click();
await page.waitForSelector(".hp-big", { timeout: 20000 });
await go(page, "sheet");
const sheet = (await page.locator(".app").innerText()).replace(/\s+/g, " ");
ok("arriving at the table with the racial skills",
  /acrobatics/i.test(sheet) && /stealth/i.test(sheet), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
