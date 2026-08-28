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
/* And no picker where there is nothing to pick. An acolyte gets two
   languages and no tools; the tools list was still underneath offering
   fifty-four of them with an allowance of zero, which reads as a choice
   somebody forgot to make. */
ok("a background that grants no tool shows no tool picker",
  await card.locator('.pl', { hasText: /^TOOLS/ }).count(), 0);
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

/* --- what a background hands you outright --------------------------------

   The bug this section exists for: the card said "Gladiator gives you
   Disguise kits" and the finished sheet had no disguise kit on it. The
   background's own tools were read, shown in the sentence, and then passed
   along as an empty list — so the one part of the line that is NOT a
   decision was the part that never arrived.

   Checked as "given, and therefore not asked": a granted tool must be
   absent from the picker, because offering something you already have is
   the other way to get this wrong. */
const criminalGrant = await pickBackground("Criminal");
ok("a granted tool is stated as given", /thieves' tools/i.test(criminalGrant), true);
await openPick(page, "Gaming sets");
ok("and is not also offered as a choice",
  await card.getByRole("button", { name: /^Use Thieves' Tools$/ }).count(), 0);
ok("the picker offers the family that IS the choice",
  await card.getByRole("button", { name: "Use Dice Set" }).count(), 1);

/* Two asks for the same family are one question. A bard who took the
   gladiator background is asked for three musical instruments and then for
   one, and the second row is identical to the first — which reads as a bug
   and lets the same flute answer both. */
await atStep(page, "Class");
await page.getByRole("button", { name: "Bard", exact: true }).click();
await page.waitForTimeout(500);
const gladiator = await pickBackground("Gladiator");
ok("a bard-gladiator is asked for instruments once, not twice",
  await card.getByRole("button", { name: /^Musical instruments, \d+ chosen$/ }).count(), 1);
ok("for the two lines added together",
  /4 tools to choose\./.test(gladiator), true);

// Back to the rogue and the acolyte for the rest of this suite's arithmetic.
await atStep(page, "Class");
await page.getByRole("button", { name: "Rogue", exact: true }).click();
await page.waitForTimeout(500);
for (const sk of ["Stealth", "Perception", "Acrobatics", "Deception"]) {
  await atStep(page, "Skills");
  const btn = page.getByRole("button", { name: `Train ${sk.toLowerCase()}` });
  if (await btn.count()) await btn.first().click();
}
// Back to the acolyte for the rest of this suite's arithmetic.
await pickBackground("Acolyte");
await page.screenshot({ path: `${OUT}/80-tongues.png`, fullPage: true });

/* The tool list is the compendium's, not one somebody typed out — checked
   against a background that actually grants a tool, since an acolyte's
   picker is correctly absent.

   And it is the list the book asked for. "One type of artisan's tools" was
   fifty-four tools with an allowance of one, which is not that question: it
   let a guild artisan come away proficient with a set of dice. The row says
   which family it is, because the label is the question. */
await pickBackground("Guild Artisan");
ok("a picker is named for what was asked for, not just 'tools'",
  await card.getByRole("button", { name: /^Artisan's tools, \d+ chosen$/ }).count(), 1);
await openPick(page, "Artisan's tools");
const tools = await card.locator('.pl-row[aria-label^="Use "]').allInnerTexts();
ok("tools come from the item catalogue", tools.length > 10, true);
ok("and are the mundane ones, not treasure",
  tools.some((t) => /Smith's Tools/i.test(t)) && !tools.some((t) => /legendary/i.test(t)), true);
ok("narrowed to the family the book named",
  tools.some((t) => /Herbalism Kit|Dice Set/i.test(t)), false);

/* An acolyte's two are both languages — the tool list is offered as reading,
   not as a choice, and taking one is refused. */
await pickBackground("Acolyte");
await openPick(page, "Languages");
await card.getByRole("button", { name: "Speak Elvish" }).click();
await page.waitForTimeout(200);
/* Not "offered and refused" — not offered at all, which is the stronger
   version of the same claim. */
ok("a background that grants no tool offers no tool to take",
  await card.getByRole("button", { name: "Use Herbalism Kit" }).count(), 0);
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
/* One per list that HAS something in it. An acolyte's tools do not, so an
   acolyte gets one picker here and a guild artisan gets two. */
ok("one for each list with something to choose from", shape.pickers >= 1, true);
ok("and the whole step fits in about two screens", shape.screens < 2.6, true);

/* Opening the longest list must not undo that — it scrolls inside itself.
   Checked on a background that grants a tool, since an acolyte has no tool
   list to open. */
await pickBackground("Guild Artisan");
await openPick(page, "Languages");
await page.waitForTimeout(300);
const opened = await page.evaluate(() => ({
  screens: document.documentElement.scrollHeight / window.innerHeight,
  rows: document.querySelectorAll(".pl-row").length,
  boxed: (() => { const e = document.querySelector(".pl-rows"); return !!e && e.scrollHeight > e.clientHeight; })(),
}));
// Languages, since narrowing means no tool list is long enough to overflow.
ok("opening the long list offers all of it", opened.rows > 12, true);
ok("inside a box rather than down the page", opened.boxed, true);
ok("so the step barely grows", opened.screens < 3, true);

await openPick(page, "Languages");
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
