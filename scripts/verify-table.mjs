/* The DM's table: planning without a character, per-member control, boons,
   the people in the world, and loot.

   The claim under test at the top is the one that was actually broken: the
   person who starts a room is the DM, and they were being asked to roll
   ability scores before they could do any of this. */
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

/* Skills and saves sit behind a press now: the sheet stopped being forty rows
   to scroll past on the way to the hit points. The button says what it holds
   ("Skills, +7 best"); opening it is one tap. */
const openDrawer = async (page, which) => {
  const hd = page.getByRole("button", { name: new RegExp(`^${which}, `) });
  await hd.waitFor({ timeout: 20000 });
  if ((await hd.getAttribute("aria-expanded")) !== "true") await hd.click();
  await page.waitForTimeout(300);
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
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}

const dm = await device("dm");
await dm.page.getByRole("button", { name: "The table", exact: true }).click();
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
await dm.page.waitForTimeout(800);

// --- the DM does not have to be a character -------------------------------
// Session zero used to be the ONLY thing here, which meant the person who
// starts the room — always the DM — had to roll ability scores before they
// could prep anything. It is now offered ALONGSIDE the planning surface,
// because an empty table is genuinely ambiguous: a DM about to prep, or
// someone who just opened the app wanting a character.
await go(dm.page, "prep");
ok("planning is available without making a character first",
  await dm.page.locator(".card", { hasText: "People" }).count(), 1);
ok("and so is prep — the encounter builder is right here",
  await dm.page.getByRole("button", { name: "Build" }).count(), 1);
await go(dm.page, "party");
ok("and session zero is still offered, not forced",
  await dm.page.getByRole("button", { name: "Build a character" }).count(), 1);

await go(dm.page, "book");
ok("and the monster reference, with nobody in the party yet",
  await dm.page.getByRole("button", { name: "Monsters" }).count(), 1);
await go(dm.page, "party");
await dm.page.getByRole("button", { name: "This device" }).click();
ok("making one is offered, not required",
  await dm.page.getByRole("button", { name: "Add character" }).count(), 1);
await dm.page.getByRole("button", { name: "Close This device" }).click();
await dm.page.screenshot({ path: `${OUT}/46-dm-table.png`, fullPage: true });

// --- an NPC who never rolls anything --------------------------------------
await go(dm.page, "prep");
await dm.page.getByRole("button", { name: "Add someone" }).click();
await dm.page.locator('input[aria-label="NPC name"]').fill("Marta the Harbourmaster");
await dm.page.locator('input[aria-label="NPC role"]').fill("harbourmaster");
await atStep(dm.page, "Story");
await dm.page.locator('textarea[aria-label="NPC notes"]').fill("Owes the party a favour. Knows about the bridge.");
ok("stock is not asked for by default",
  await dm.page.locator('input[aria-label="Find stock"]').count(), 0);
await dm.page.getByRole("button", { name: "Save", exact: true }).click();
await dm.page.waitForTimeout(500);
ok("saved with just notes",
  (await dm.page.locator(".npc-row").innerText()).includes("Owes the party a favour"), true);
ok("and nothing to open, because they sell nothing",
  await dm.page.getByRole("button", { name: /Open shop/ }).count(), 0);

// --- a trader -------------------------------------------------------------
await dm.page.getByRole("button", { name: "Add someone" }).click();
await dm.page.locator('input[aria-label="NPC name"]').fill("Halbrek");
await dm.page.locator('input[aria-label="NPC role"]').fill("fence");
await dm.page.getByRole("button", { name: "Trades with the party" }).click();
await dm.page.waitForTimeout(300);
ok("the flag is what makes stock exist",
  await dm.page.locator('input[aria-label="Find stock"]').count(), 1);

// This one charges more than the book — the entire point of a trader.
await dm.page.locator('input[aria-label="Find stock"]').fill("Rapier");
await dm.page.locator('input[aria-label="Asking price"]').fill("40 gp");
await dm.page.waitForTimeout(400);
await dm.page.locator(".inv-add", { hasText: "Rapier" }).first().click();
await dm.page.waitForTimeout(300);
ok("stock takes the DM's price, not the book's",
  (await dm.page.locator(".npc-stock .inv-row").innerText()).includes("40 gp"), true);
await dm.page.getByRole("button", { name: "Save", exact: true }).click();
await dm.page.waitForTimeout(600);

// --- a player arrives -----------------------------------------------------
const player = await device("player");
await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "The table", exact: true }).click();
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector('button:has-text("Build a character")', { timeout: 20000 });
await player.page.getByRole("button", { name: "Build a character" }).click();
await atStep(player.page, "Class");
await player.page.waitForSelector(".klass-cards", { timeout: 20000 });
await atStep(player.page, "Class");
await player.page.getByRole("button", { name: "Fighter", exact: true }).click();
await player.page.waitForTimeout(300);
await atStep(player.page, "Class");
for (const s of ["Athletics", "Perception"]) {
  await atStep(player.page, "Skills");
  await player.page.getByRole("button", { name: `Train ${s.toLowerCase()}` }).click();
}
await atStep(player.page, "Race");
await player.page.selectOption('select[aria-label="Race"]', "human");
await player.page.waitForTimeout(400);
await atStep(player.page, "Scores");
await player.page.getByRole("button", { name: "Recommend" }).click();
await atStep(player.page, "Story");
await openPick(player.page, "Skills");
await player.page.getByRole("button", { name: "Train nature" }).click();
await atStep(player.page, "Story");
await openPick(player.page, "Skills");
await player.page.getByRole("button", { name: "Train animal handling" }).click();
await atStep(player.page, "Story");
await player.page.locator('input[aria-label="Background name"]').fill("Soldier");
await atStep(player.page, "Review");
await player.page.locator('input[aria-label="Character name"]').fill("Kira Vance");
await answerGear(player.page);
await atStep(player.page, "Review");
await player.page.getByRole("button", { name: "Create character" }).click();
await player.page.waitForSelector(".hp-big", { timeout: 20000 });
await dm.page.waitForTimeout(1500);

// --- the shop is only there while the DM has it open ----------------------
// Asserted from the Gear tab itself — checking for absence while sitting on
// another tab would pass for the wrong reason.
await go(player.page, "gear");
ok("no shop before the party walks into one",
  await player.page.getByRole("button", { name: "Buy Rapier" }).count(), 0);

await go(dm.page, "prep");
await dm.page.getByRole("button", { name: /Open Halbrek's shop/ }).click();
await player.page.waitForTimeout(1600);
ok("opening it puts it on the player's screen",
  await player.page.getByRole("button", { name: "Buy Rapier" }).count(), 1);
ok("and marks the tab, so it is noticed from anywhere",
  await player.page.locator('[data-tab="gear"] .tab-dot').count(), 1);
ok("what you cannot afford is shown, not hidden",
  await player.page.getByRole("button", { name: "Buy Rapier" }).isDisabled(), true);

// --- loot, to the party and then divided ----------------------------------
await go(dm.page, "party");
await dm.page.locator('input[aria-label="Loot"]').fill("120 gp");
await dm.page.getByRole("button", { name: "To the party" }).click();
await dm.page.waitForTimeout(600);
ok("party loot waits to be divided rather than vanishing",
  (await dm.page.locator(".stash .inv-row").first().innerText()).includes("120 gp"), true);
await dm.page.getByRole("button", { name: /Split 1 way/ }).click();
await player.page.waitForTimeout(1600);
ok("a share reaches the player", await player.page.locator(".inv-purse").first().innerText(), "120 gp");
ok("and now they can afford it",
  await player.page.getByRole("button", { name: "Buy Rapier" }).isDisabled(), false);

await player.page.getByRole("button", { name: "Buy Rapier" }).click();
await player.page.waitForTimeout(900);
ok("buying takes the DM's price, not the book's",
  await player.page.locator(".inv-purse").first().innerText(), "80 gp");
ok("and the rapier is carried",
  (await player.page.locator(".card", { hasText: "Carrying" }).innerText()).includes("Rapier"), true);
await player.page.screenshot({ path: `${OUT}/47-shop.png`, fullPage: true });

// --- boons: per member, shown and never applied ---------------------------
await go(dm.page, "party");
await dm.page.getByRole("button", { name: /Give Kira Vance a boon/ }).click();
await dm.page.getByRole("button", { name: "Bless +1d4" }).click();
await player.page.waitForTimeout(1600);
await go(player.page, "sheet");
ok("the boon reaches the player",
  /bless \+1d4/i.test(await player.page.locator(".card", { hasText: "Yours until they end" }).innerText()), true);

// Equip the rapier so there is an attack to roll.
await go(player.page, "gear");
await player.page.getByRole("button", { name: "Equip Rapier" }).click();
await go(player.page, "sheet");
await player.page.waitForTimeout(500);
const toHit = await player.page.locator(".atk .m").first().innerText();
await player.page.locator(".atk").first().click();
await player.page.waitForSelector(".rp-boon");
ok("it surfaces on the attack it touches",
  (await player.page.locator(".rp-boon").innerText()).replace(/\s+/g, " "), "Bless +1d4");
ok("and is NOT folded into the printed bonus",
  await player.page.locator(".rp-mod, .rp-head .num").first().innerText().catch(() => toHit), toHit);
await player.page.screenshot({ path: `${OUT}/48-boon-roll.png`, fullPage: true });
await player.page.keyboard.press("Escape");
await player.page.waitForTimeout(400);

// A Bless says nothing about a skill check, and must stay out of the way.
await openDrawer(player.page, "Skills");
await player.page.getByRole("button", { name: /^stealth/ }).click();
await player.page.waitForTimeout(400);
ok("but stays out of the way of a check it does not touch",
  await player.page.locator(".rp-boon").count(), 0);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
