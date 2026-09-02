/* Guidance on the action side.

   Two things a new player cannot get from a character sheet: what their turn
   actually offers, and what the DM just asked them for. The dice stay on the
   table — everything here asks for a number and never rolls one. */
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
  await page.waitForTimeout(250);
};
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  return { ctx, page, name };
}

const dm = await device("dm");
await dm.page.getByRole("button", { name: "The table", exact: true }).click();
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();

const p1 = await device("kira");
await p1.page.getByRole("button", { name: "The table", exact: true }).click();
await p1.page.locator('input[aria-label="Room code"]').fill(code);
await p1.page.getByRole("button", { name: "Join", exact: true }).click();
await p1.page.waitForSelector('button:has-text("Load sample")', { timeout: 20000 });
await p1.page.getByRole("button", { name: "Load sample" }).click();
await p1.page.waitForSelector(".tabs", { timeout: 20000 });
await dm.page.waitForTimeout(1500);

// --- what the DM just asked for ------------------------------------------
await go(dm.page, "party");
await dm.page.getByRole("button", { name: "Ask", exact: true }).click();
await dm.page.selectOption('select[aria-label="What to roll"]', "perception");
await dm.page.locator('input[aria-label="Difficulty"]').fill("15");
await dm.page.getByRole("button", { name: "Ask the table" }).click();
await p1.page.waitForTimeout(1600);

ok("the ask reaches the player", await p1.page.locator(".ask-mine").count(), 1);
const ask = (await p1.page.locator(".ask-mine").innerText()).replace(/\s+/g, " ");
// The modifier is worked out, because finding Perception on a sheet while
// five people wait is exactly the friction this removes.
ok("with the modifier already worked out", /add \+\d/.test(ask), true);
ok("and what it is for", /perception/i.test(ask), true);
ok("and the number to beat, since the DM gave one", /Beat 15/.test(ask), true);
await p1.page.screenshot({ path: `${OUT}/66-ask.png`, fullPage: true });

// It follows you: a roll owed now is not something to go and find.
await go(p1.page, "gear");
ok("it follows you between tabs", await p1.page.locator(".ask-mine").count(), 1);

await p1.page.locator('input[aria-label="Check total"]').fill("18");
await p1.page.getByRole("button", { name: "Send", exact: true }).click();
await p1.page.waitForTimeout(1200);
ok("answering closes it on their side", await p1.page.locator(".ask-mine.done").count(), 1);

const answers = (await dm.page.locator(".ask-answers").innerText()).replace(/\s+/g, " ");
ok("and the DM sees the number", /18/.test(answers), true);
ok("with the pass worked out against their own DC",
  (await dm.page.locator(".ask-answers .chip.on").count()) > 0, true);
await dm.page.getByRole("button", { name: "Done", exact: true }).click();
await dm.page.waitForTimeout(700);
ok("closing it clears both sides", await p1.page.locator(".ask-mine").count(), 0);

// --- what your turn actually offers --------------------------------------
await go(dm.page, "combat");
await dm.page.getByRole("button", { name: "Add creature" }).click();
await dm.page.locator('input[aria-label="Creature 1 name"]').fill("Goblin");
await dm.page.getByRole("button", { name: "Roll for initiative" }).click();
await dm.page.waitForSelector('input[aria-label="Kira Vance initiative"]', { timeout: 20000 });
for (const [n, v] of [["Kira Vance", 20], ["Goblin", 2]]) {
  await dm.page.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await dm.page.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await dm.page.getByRole("button", { name: "Begin", exact: true }).click();
await p1.page.waitForTimeout(1600);

await p1.page.getByRole("button", { name: "What else can I do?" }).click();
await p1.page.waitForSelector(".hotbar");
const menu = (await p1.page.locator(".hot .ht").allInnerTexts()).map((t) => t.toLowerCase());
// Nobody discovers these from a character sheet.
for (const name of ["dodge", "disengage", "hide", "help", "shove", "ready"]) {
  ok(`the turn offers ${name}`, menu.some((m) => m.includes(name)), true);
}
/* Costs are a coloured dot, not the word "action" twelve times — but every
   mark keeps its name, because an unlabelled icon is its own kind of
   unreadable and this table has not played a session yet. */
ok("every mark keeps its name", menu.every((m) => m.trim().length > 0), true);
ok("and the whole turn fits on one screen",
  await p1.page.locator(".hot").count() <= 12, true);
ok("nothing is explained until asked", await p1.page.locator(".hot-say").count(), 0);

await p1.page.getByRole("button", { name: "Disengage", exact: true }).click();
await p1.page.waitForTimeout(300);
ok("pointing at one explains it, and only it",
  await p1.page.locator(".hot-say").count(), 1);
ok("in play terms",
  /without anyone getting a free swing/i.test(await p1.page.locator(".hot-say .what").innerText()),
  true);
/* The count that started this: twelve options used to arrive as twelve
   sentences, with a thirteenth when you pointed at one. */
const words = (await p1.page.locator(".pt.acting").innerText())
  .split(/\s+/).filter((w) => /[a-z]{3,}/i.test(w)).length;
console.log(`  (words on the turn screen: ${words})`);
ok("the turn is marks and numbers, not paragraphs", words < 60, true);
await p1.page.screenshot({ path: `${OUT}/67-menu.png`, fullPage: true });

await p1.page.getByRole("button", { name: "Dodge", exact: true }).click();
await p1.page.waitForTimeout(300);
await p1.page.getByRole("button", { name: "Do it" }).click();
await p1.page.waitForTimeout(700);
ok("taking one spends the action",
  await p1.page.locator('[aria-label="Action spent"]').count(), 1);
ok("and says what to tell the table",
  /dodge taken/i.test(await p1.page.locator(".pt-took").innerText()), true);

await p1.page.getByRole("button", { name: "What else can I do?" }).click();
await p1.page.waitForTimeout(400);
/* Spent marks dim rather than disappear — a turn you cannot take is still
   part of the turn. The reason rides on the mark itself rather than needing
   a tap, because a control you cannot press cannot be asked. */
ok("a spent action dims the marks that needed it",
  (await p1.page.locator('.hot[data-cost="action"]:disabled').count()) > 5, true);
ok("and each still says why",
  /your action is gone/i.test(
    await p1.page.locator('.hot[data-cost="action"]:disabled').first().getAttribute("title"),
  ), true);
ok("with no way to take them",
  await p1.page.locator('.hot[data-cost="action"]:not(:disabled)').count(), 0);

// --- the building half ----------------------------------------------------
// "d10 hit die · saves in STR and DEX" tells a returning player what they
// need and a new one nothing at all.
const b = await device("builder");
await b.page.getByRole("button", { name: "Build a character" }).click();
await atStep(b.page, "Class");
await b.page.waitForSelector(".klass-cards", { timeout: 20000 });
ok("nothing is explained before a class is chosen",
  await b.page.locator(".cr-blurb").count(), 0);

await atStep(b.page, "Class");
await b.page.getByRole("button", { name: "Fighter", exact: true }).click();
await b.page.waitForTimeout(700);
const blurb = await b.page.locator(".cr-blurb").first().innerText();
ok("choosing one says what it is LIKE to play",
  /hit things|simplest place to start/i.test(blurb), true);
await atStep(b.page, "Class");
ok("and keeps the mechanical line underneath",
  /d10 hit die/i.test(await b.page.locator(".cr-note").first().innerText()), true);

await atStep(b.page, "Race");
await b.page.locator('input[aria-label="Filter races"]').fill("human");
await b.page.waitForTimeout(400);
await atStep(b.page, "Race");
const ro = await b.page.locator('select[aria-label="Race"] option').allInnerTexts();
await b.page.selectOption('select[aria-label="Race"]', { label: ro[1] });
await b.page.waitForTimeout(800);

// Class advice sits on the class step; the score advice with the scores.
const advice = [
  await (async () => { await atStep(b.page, "Class"); return (await b.page.locator(".cr-blurb").allInnerTexts()).join(" "); })(),
  await (async () => { await atStep(b.page, "Scores"); return (await b.page.locator(".cr-blurb").allInnerTexts()).join(" "); })(),
].join(" ");
ok("and which scores matter for it", /Strength and Constitution matter most/i.test(advice), true);

// Concise by default: six explanations at once is the wall of text the turn
// menu had to be rescued from.
await atStep(b.page, "Scores");
ok("the abilities are not explained until asked",
  await b.page.locator(".cr-abils-help").count(), 0);
await b.page.getByRole("button", { name: "What do these do?" }).click();
await b.page.waitForTimeout(300);
await atStep(b.page, "Scores");
const help = (await b.page.locator(".cr-abils-help").innerText()).toLowerCase();
ok("asking explains all six", (help.match(/strength|dexterity|constitution|intelligence|wisdom|charisma/g) ?? []).length >= 6, true);
ok("leading with what they change",
  /hit points/.test(help) && /armour class/.test(help), true);
// --- races and backgrounds, where there are hundreds ---------------------
await atStep(b.page, "Race");
const raceBlurbs = await b.page.locator(".cr-blurb").allInnerTexts();
ok("a shipped race says what it is",
  raceBlurbs.some((t) => /little of everything/i.test(t)), true);
/* This used to check that the SRD human offered nothing, because the shipped
   entry carried no traits at all. That thinness was the bug — the two ability
   points a variant human is owed lived in a trait the app never read — so the
   shipped nine are filled from the compendium now, and the human has traits
   like everyone else. What is still true is that the list is CLOSED until
   asked for. */
ok("a race's traits are offered rather than dumped",
  await b.page.getByRole("button", { name: "What does this give me?" }).count(), 1);
ok("and stay closed until asked",
  await b.page.locator(".cr-abils-help").count(), 0);

await atStep(b.page, "Race");
await b.page.locator('input[aria-label="Filter races"]').fill("halfling");
await b.page.waitForTimeout(500);
await atStep(b.page, "Race");
const hf = await b.page.locator('select[aria-label="Race"] option').allInnerTexts();
await b.page.selectOption('select[aria-label="Race"]', { label: hf[1] });
await b.page.waitForTimeout(700);
ok("one with traits offers them, unopened",
  await b.page.getByRole("button", { name: "What does this give me?" }).count(), 1);
await b.page.getByRole("button", { name: "What does this give me?" }).click();
await b.page.waitForTimeout(300);
const traitText = (await b.page.locator(".cr-abils-help").allInnerTexts()).join(" ");
ok("listing what the data says, not something invented",
  /Lucky/.test(traitText) && /Brave/.test(traitText), true);

// An imported race has no hand-written line, and uses its own description.
await atStep(b.page, "Race");
await b.page.locator('input[aria-label="Filter races"]').fill("aasimar");
await b.page.waitForTimeout(500);
await atStep(b.page, "Race");
const opts = await b.page.locator('select[aria-label="Race"] option').allInnerTexts();
if (opts.length > 1) {
  await b.page.selectOption('select[aria-label="Race"]', { label: opts[1] });
  await b.page.waitForTimeout(700);
  const after = (await b.page.locator(".cr-blurb").allInnerTexts()).join(" ");
  ok("an imported race falls back to its own description",
    after.length > 0 && !/little of everything/i.test(after), true);
}
await atStep(b.page, "Race");
await b.page.locator('input[aria-label="Filter races"]').fill("human");
await b.page.waitForTimeout(400);
await atStep(b.page, "Race");
const back = await b.page.locator('select[aria-label="Race"] option').allInnerTexts();
await b.page.selectOption('select[aria-label="Race"]', { label: back[1] });
await b.page.waitForTimeout(600);

// A background's one mechanical line is the one worth showing.
await atStep(b.page, "Story");
await b.page.locator('input[aria-label="Filter backgrounds"]').fill("Acolyte");
await b.page.waitForTimeout(400);
await atStep(b.page, "Story");
await b.page.selectOption('select[aria-label="Background"]', { label: "Acolyte" });
await b.page.waitForTimeout(700);
// The card, not every card that says the word — the languages step mentions
// backgrounds too, because a background is two languages or tools.
await atStep(b.page, "Story");
const bgText = (await b.page
  .locator(".card", { has: b.page.locator('select[aria-label="Background"]') })
  .innerText()).replace(/\s+/g, " ");
ok("a background shows the feature it grants", /Feature: Shelter of the Faithful/i.test(bgText), true);

await b.page.screenshot({ path: `${OUT}/68-builder-guidance.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
