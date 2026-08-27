/* Languages and tool proficiencies.

   The builder asked for skills, saves, spells, feats and gear, then produced
   a character who spoke nothing and could use nothing. The data was in the
   compendium the whole time — 603 of 605 races carry a Languages trait and
   every class states its tools — and it was read past. */
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
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// A rogue: the one core class whose tool line names something outright.
await page.getByRole("button", { name: "Build a character" }).click();
await atStep(page, "Class");
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await atStep(page, "Class");
await page.getByRole("button", { name: "Rogue", exact: true }).click();
await page.waitForTimeout(500);
await atStep(page, "Class");
for (const s of ["Stealth", "Perception", "Acrobatics", "Deception"]) {
  await atStep(page, "Skills");
  const b = page.getByRole("button", { name: `Train ${s.toLowerCase()}` });
  if (await b.count()) await b.first().click();
}
await atStep(page, "Race");
await page.selectOption('select[aria-label="Race"]', "dwarf");
await page.waitForTimeout(700);
await atStep(page, "Scores");
await page.getByRole("button", { name: "Recommend" }).click();
await page.waitForTimeout(500);

await atStep(page, "Story");
const card = page.locator(".card", { hasText: "Languages & tools" }).first();
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
const said = (await card.innerText()).replace(/\s+/g, " ");

ok("the race's own languages are stated, not asked for",
  /dwarf gives you common, dwarvish/i.test(said), true);
ok("and the class's tools with them",
  /thieves' tools/i.test(said), true);
ok("neither is offered as a choice — you already have them",
  await (async () => {
    await openPick(page, "Languages");
    return card.getByRole("button", { name: "Speak Dwarvish" }).count();
  })(), 0);
/* --- what the BACKGROUND gives ------------------------------------------

   Not two picks to spend either way, which is a rule no edition has. In 2014
   the background decides: an acolyte gets two languages and no tools, a
   criminal two tools and no languages, a guild artisan one of each. The
   builder offered the choice, so a criminal could walk away speaking
   Draconic and knowing no trade. */
const pickBackground = async (label) => {
  await atStep(page, "Story");
  await page.locator('input[aria-label="Filter backgrounds"]').fill(label);
  await page.waitForTimeout(500);
  await page.selectOption('select[aria-label="Background"]', { label });
  await page.waitForTimeout(600);
  await card.scrollIntoViewIfNeeded();
  return (await card.innerText()).replace(/\s+/g, " ");
};

const acolyte = await pickBackground("Acolyte");
ok("an acolyte is told what the book gives them",
  /Acolyte gives you two languages\./.test(acolyte), true);
ok("and is asked for exactly that", /2 languages to choose\./.test(acolyte), true);
ok("with no tool asked for at all", /tool to choose|tools to choose/.test(acolyte), false);
ok("the count agrees",
  (await card.locator(".card-hd .faint").innerText()).trim(), "0 of 2");

const criminal = await pickBackground("Criminal");
ok("a criminal gets tools instead, one named and one chosen",
  /Criminal gives you thieves' tools and a gaming set of your choice\./.test(criminal), true);
ok("so the ask is a tool, not a language",
  /1 tool to choose\./.test(criminal), true);
ok("and no language is offered", /language to choose/.test(criminal), false);

const artisan = await pickBackground("Guild Artisan");
ok("a guild artisan gets one of each",
  /Guild Artisan gives you a language and an artisan's tools of your choice\./.test(artisan), true);
ok("and is asked for one of each",
  /1 language and 1 tool to choose\./.test(artisan), true);

// Back to the acolyte for the rest of this suite's arithmetic.
await pickBackground("Acolyte");
await page.screenshot({ path: `${OUT}/80-tongues.png`, fullPage: true });

// The tool list is the compendium's, not one somebody typed out.
await openPick(page, "Tools");
const tools = await card.locator('.pl-row[aria-label^="Use "]').allInnerTexts();
ok("tools come from the item catalogue", tools.length > 30, true);
ok("and are the mundane ones, not treasure",
  tools.some((t) => /Herbalism Kit/i.test(t)) && !tools.some((t) => /legendary/i.test(t)), true);

/* An acolyte's two are both languages — the tool list is offered as reading,
   not as a choice, and taking one is refused. */
await openPick(page, "Languages");
await card.getByRole("button", { name: "Speak Elvish" }).click();
await page.waitForTimeout(200);
await openPick(page, "Tools");
ok("a background that grants no tool does not let you take one",
  await card.getByRole("button", { name: "Use Herbalism Kit" }).isDisabled(), true);
await openPick(page, "Languages");
await card.getByRole("button", { name: "Speak Orc" }).click();
await page.waitForTimeout(200);
await page.waitForTimeout(300);
/* --- and it fits on a screen ---------------------------------------------
   Sixteen languages and fifty-three tools laid out at once, with a real 44px
   tap target, made this step three and a half screens tall. Eighty-six chips
   is not a choice, it is a search with no search box. */
const shape = await page.evaluate(() => ({
  screens: document.documentElement.scrollHeight / window.innerHeight,
  chips: document.querySelectorAll(".chips .chip").length,
  pickers: document.querySelectorAll(".pl").length,
}));
ok("the step is closed pickers rather than a chip wall", shape.chips, 0);
ok("one for each list", shape.pickers >= 3, true);
ok("and the whole step fits in about two screens", shape.screens < 2.6, true);

/* Opening the longest list must not undo that — it scrolls inside itself. */
await openPick(page, "Tools");
await page.waitForTimeout(300);
const opened = await page.evaluate(() => ({
  screens: document.documentElement.scrollHeight / window.innerHeight,
  rows: document.querySelectorAll(".pl-row").length,
  boxed: (() => { const e = document.querySelector(".pl-rows"); return !!e && e.scrollHeight > e.clientHeight; })(),
}));
ok("opening fifty-odd tools offers all of them", opened.rows > 40, true);
ok("inside a box rather than down the page", opened.boxed, true);
ok("so the step barely grows", opened.screens < 3, true);

ok("two picks fills the background's allowance",
  (await card.locator(".card-hd .faint").innerText()).trim(), "2 of 2");
ok("and a third is refused rather than silently ignored",
  await (async () => {
    await openPick(page, "Languages");
    return card.getByRole("button", { name: "Speak Giant" }).isDisabled();
  })(), true);

/* Finish, and see it on the sheet. The background's own two skills came with
   it when it was chosen — the step is full, and asking for more is refused. */
await atStep(page, "Story");
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
await page.waitForSelector(".hp-big", { timeout: 20000 });
await go(page, "sheet");

await atStep(page, "Story");
const sheet = page.locator(".card", { hasText: "Languages & tools" }).first();
await sheet.scrollIntoViewIfNeeded();
const shown = (await sheet.innerText()).replace(/\s+/g, " ");
ok("the sheet says what they speak", /common, dwarvish, elvish, orc/i.test(shown), true);
// The rogue's own, since an acolyte grants none.
ok("and what they can use", /thieves' tools/i.test(shown), true);
ok("with Common listed once, though two sources gave it",
  (shown.match(/common/gi) ?? []).length, 1);
await page.screenshot({ path: `${OUT}/81-tongues-sheet.png`, fullPage: true });


// --- who they are ---------------------------------------------------------
// The builder asked for every number a character has and never once asked
// this. It is the difference between a build and somebody's character.


console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
