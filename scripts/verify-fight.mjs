/* Starting a fight as a table rather than as one person with a notepad.

   The DM decides who is in it and who was ambushed; everyone rolls their own
   initiative on their own device; the order settles once. Then movement, a
   target, and the reaction that has been sitting on the waiting screen since
   phase two waiting for something to spend it on. */
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

/** Sit as a character: a device claims its own once, then picks a seat. */
const sitAs = async (page, name) => {
  // A device joining a campaign that already has characters is asked which
  // one it is, once; after that it is an ordinary seat change.
  const join = page.locator(".join-row", { hasText: name });
  if (await join.count()) await join.first().click();
  else await page.selectOption('select[aria-label="Seat"]', { label: name });
  await page.waitForTimeout(500);
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
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}
async function build(page, name, klass, skills) {
  await page.getByRole("button", { name: "Build a character" }).click();
  await page.waitForSelector(".klass-cards", { timeout: 20000 });
  await page.getByRole("button", {
    name: klass.charAt(0).toUpperCase() + klass.slice(1), exact: true,
  }).click();
  await page.waitForTimeout(300);
  // Named rather than "the first few chips": the background list uses the
  // same class, so picking positionally chose the wrong ones and left the
  // class-skill count unsatisfied.
  for (const s of skills) {
    await page.getByRole("button", { name: `Train ${s.toLowerCase()}` }).first().click();
  }
  await page.selectOption('select[aria-label="Race"]', "human");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Recommend" }).click();
  await page.getByRole("button", { name: "nature", exact: true }).click();
  await page.getByRole("button", { name: "animal handling", exact: true }).click();
  await page.locator('input[aria-label="Background name"]').fill("Soldier");
  await page.locator('input[aria-label="Character name"]').fill(name);
  await answerGear(page);
  await page.getByRole("button", { name: "Create character" }).click();
  await page.waitForSelector(".hp-big", { timeout: 20000 });
}

const dm = await device("dm");
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();

const p1 = await device("kira");
await p1.page.locator('input[aria-label="Room code"]').fill(code);
await p1.page.getByRole("button", { name: "Join", exact: true }).click();
await p1.page.waitForSelector('button:has-text("Build a character")', { timeout: 20000 });
await build(p1.page, "Kira Vance", "fighter", ["Athletics", "Perception"]);

const p2 = await device("bel");
await p2.page.locator('input[aria-label="Room code"]').fill(code);
await p2.page.getByRole("button", { name: "Join", exact: true }).click();
await p2.page.waitForSelector('button:has-text("Add character")', { timeout: 20000 });
await p2.page.getByRole("button", { name: "Add character" }).click();
await build(p2.page, "Bel Ashcroft", "rogue", ["Acrobatics", "Deception", "Investigation", "Stealth"]);
await p2.page.waitForTimeout(800);
await sitAs(p2.page, "Bel Ashcroft");
await dm.page.waitForTimeout(1800);

// --- the DM decides who is in it -----------------------------------------
await go(dm.page, "fight");
ok("both characters are offered", await dm.page.locator(".chips .chip").count() >= 2, true);
// The party split: Bel is on the roof and not in this fight.
await dm.page.getByRole("button", { name: "Bel Ashcroft", exact: true }).click();
await dm.page.getByRole("button", { name: "The encounter" }).click();
await dm.page.getByRole("button", { name: "Add creature" }).click();
await dm.page.locator('input[aria-label="Creature 1 name"]').fill("Goblin");
await dm.page.locator('input[aria-label="Creature 1 hp"]').fill("12");
// An armour class lets the DM's screen work out the verdict; without one it
// says so rather than guessing.
await dm.page.locator('input[aria-label="Creature 1 armour class"]').fill("15");
await dm.page.screenshot({ path: `${OUT}/53-surprise.png`, fullPage: true });
await dm.page.getByRole("button", { name: "Roll for initiative" }).click();
await p1.page.waitForTimeout(1800);

// --- everyone rolls on their own device ----------------------------------
ok("the player is asked for their own initiative",
  await p1.page.locator('input[aria-label="Kira Vance initiative"]').count(), 1);
ok("and is not asked for the monster's",
  await p1.page.locator('input[aria-label="Goblin initiative"]').count(), 0);
ok("a player left out of the fight is not asked at all",
  await p2.page.locator('input[aria-label="Bel Ashcroft initiative"]').count(), 0);
await p1.page.screenshot({ path: `${OUT}/49-initiative.png`, fullPage: true });

ok("the DM rolls for the monsters",
  await dm.page.locator('input[aria-label="Goblin initiative"]').count(), 1);
ok("nobody has rolled yet", (await dm.page.locator(".init-head .num").innerText()), "0 of 2");

await p1.page.locator('input[aria-label="Kira Vance initiative"]').fill("18");
await p1.page.getByRole("button", { name: "Set Kira Vance initiative" }).click();
await dm.page.waitForTimeout(1600);
ok("the DM sees it land without being told", (await dm.page.locator(".init-head .num").innerText()), "1 of 2");

await dm.page.locator('input[aria-label="Goblin initiative"]').fill("9");
await dm.page.getByRole("button", { name: "Set Goblin initiative" }).click();
await dm.page.waitForTimeout(700);
await dm.page.getByRole("button", { name: "Begin", exact: true }).click();
await p1.page.waitForTimeout(1800);

// --- the fight ------------------------------------------------------------
ok("higher initiative goes first",
  (await dm.page.locator(".cbt .nm").first().innerText()), "Kira Vance");
ok("and it is the player's turn on their own device",
  /your turn/i.test(await p1.page.locator(".pt-turn").innerText()), true);

// --- movement -------------------------------------------------------------
ok("movement starts full", await p1.page.locator(".mv-n .num").innerText(), "30");
await p1.page.getByRole("button", { name: "Move 15 feet" }).click();
await p1.page.waitForTimeout(500);
ok("and spends", await p1.page.locator(".mv-n .num").innerText(), "15");
await p1.page.getByRole("button", { name: "Dash" }).click();
await p1.page.waitForTimeout(500);
ok("a dash gives the speed back on top", await p1.page.locator(".mv-n .num").innerText(), "45");

// --- a player's attack, one question at a time ----------------------------
// Written for somebody who has never played: the app names the weapon, the
// die and the modifier, and asks for one thing per screen.
await p1.page.getByRole("button", { name: /^Attack with/ }).click();
await p1.page.waitForSelector(".swing-step");
ok("it asks who, offering only what the player can see",
  (await p1.page.locator(".tgt-row").allInnerTexts()).map((t) => t.toLowerCase()), ["goblin"]);
await p1.page.locator(".tgt-row").first().click();
await p1.page.waitForTimeout(400);

const ask = (await p1.page.locator(".swing-ask").innerText()).replace(/\s+/g, " ");
ok("then names the die and the modifier in one sentence", /Roll a d20 and add \+\d/.test(ask), true);
ok("spending the action is not a second thing to remember",
  await p1.page.locator('[aria-label="Action spent"]').count(), 0);

await p1.page.locator('input[aria-label="Attack roll total"]').fill("18");
await p1.page.getByRole("button", { name: "Next" }).click();
await p1.page.waitForTimeout(400);
ok("then what damage to roll, by name",
  /Roll \dd\d/.test((await p1.page.locator(".swing-ask").innerText()).replace(/\s+/g, " ")), true);
await p1.page.screenshot({ path: `${OUT}/50-attack.png`, fullPage: true });

await p1.page.locator('input[aria-label="Damage roll total"]').fill("7");
await p1.page.getByRole("button", { name: "Send to the DM" }).click();
await p1.page.waitForTimeout(900);

// Nothing has happened yet. That is the point: a player who could apply
// damage themselves would learn a creature's armour class by trial.
ok("the action is spent once it is sent",
  await p1.page.locator('[aria-label="Action spent"]').count(), 1);
ok("but nothing has landed",
  (await dm.page.locator(".cbt", { hasText: "Goblin" }).locator(".hp").innerText()), "12/12");
ok("the player is told it is waiting",
  /nothing changes until/i.test(await p1.page.locator(".swing-step").innerText()), true);

// The DM sees the claim, with the verdict worked out but not taken.
await dm.page.waitForSelector(".claim", { timeout: 15000 });
const claim = (await dm.page.locator(".claim").innerText()).replace(/\s+/g, " ");
ok("the DM sees who swung at what", /Kira Vance → Goblin/.test(claim), true);
ok("with the roll against the armour class", /18 against 15 — hits/i.test(claim), true);
ok("and the damage they rolled", /7 slashing/i.test(claim), true);
await dm.page.screenshot({ path: `${OUT}/51-claim.png`, fullPage: true });

await dm.page.getByRole("button", { name: /Apply 7 to Goblin/ }).click();
await dm.page.waitForTimeout(900);
ok("confirming is what applies it",
  (await dm.page.locator(".cbt", { hasText: "Goblin" }).locator(".hp").innerText()), "5/12");
ok("and clears the queue", await dm.page.locator(".claim").count(), 0);

// --- surprise -------------------------------------------------------------
await dm.page.getByRole("button", { name: "Advance turn" }).click();
await dm.page.waitForTimeout(900);
ok("the surprised side is told it cannot act",
  (await dm.page.locator(".card", { hasText: "Round" }).innerText()).toLowerCase().includes("goblin"), true);

// --- the DM's side of an attack ------------------------------------------
// A monster swinging at a PLAYER had no route from this screen at all: the
// only way was to leave the fight for the party tab, which is the one thing
// you cannot do in the middle of a turn.
ok("the sides are named, not pronouns",
  (await dm.page.locator(".card", { hasText: "Round" }).innerText()).includes("We are"), false);

await dm.page.getByRole("button", { name: /^Attack/ }).click();
await dm.page.waitForSelector(".tgt");
ok("the DM can aim at a player", (await dm.page.locator(".tgt-row").allInnerTexts())
  .map((t) => t.toLowerCase()).includes("kira vance"), true);
ok("but not at whoever is swinging",
  (await dm.page.locator(".tgt-row").allInnerTexts()).map((t) => t.toLowerCase()).includes("goblin"), false);
await dm.page.screenshot({ path: `${OUT}/54-dm-attack.png`, clip: { x: 0, y: 0, width: 430, height: 900 } });
await dm.page.locator(".tgt-row", { hasText: /Kira/i }).click();
await dm.page.locator('input[aria-label="Damage dealt"]').fill("6");
await dm.page.getByRole("button", { name: "It hits" }).click();
await p1.page.waitForTimeout(1200);
await go(p1.page, "sheet");
ok("and it lands on the player's own sheet",
  (await p1.page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "6 / 12");
await go(p1.page, "fight");


// --- the DM's opportunity attack ------------------------------------------
// Off-turn the attacker is NOT whoever is active — attributing it to them
// would credit the player whose turn provoked it.
await dm.page.getByRole("button", { name: "Advance turn" }).click();
await dm.page.waitForTimeout(700);
ok("off a creature's turn the DM is offered a reaction, not an action",
  await dm.page.getByRole("button", { name: "Opportunity attack" }).count(), 1);
await dm.page.getByRole("button", { name: "Opportunity attack" }).click();
await dm.page.waitForSelector(".tgt");
ok("and is asked which of theirs reacts",
  (await dm.page.locator(".tgt-row").allInnerTexts()).map((t) => t.toLowerCase()), ["goblin"]);
await dm.page.locator(".tgt-row").first().click();
await dm.page.waitForTimeout(300);
ok("then who it swings at",
  (await dm.page.locator(".tgt-row").allInnerTexts()).map((t) => t.toLowerCase()).includes("kira vance"), true);
await dm.page.locator(".tgt-row", { hasText: /Kira/i }).click();
await dm.page.locator('input[aria-label="Damage dealt"]').fill("2");
await dm.page.getByRole("button", { name: "It hits" }).click();
await p1.page.waitForTimeout(1200);
await go(p1.page, "sheet");
ok("it lands", (await p1.page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "4 / 12");
await go(p1.page, "fight");

// One reaction, like everyone else's.
await dm.page.getByRole("button", { name: "Opportunity attack" }).click();
await dm.page.waitForSelector(".tgt");
ok("and a creature only gets one until its turn comes round",
  (await dm.page.locator(".tgt").innerText()).toLowerCase().includes("nothing of yours"), true);
await dm.page.getByRole("button", { name: "Cancel" }).click();

// Back to the creature's turn, so the PLAYER is the one waiting.
await dm.page.getByRole("button", { name: "Advance turn" }).click();
await dm.page.waitForTimeout(700);

// --- the opportunity attack the reaction pip was always for ---------------
await p1.page.waitForTimeout(600);
ok("a waiting player is offered one",
  await p1.page.getByRole("button", { name: "Opportunity attack" }).count(), 1);
// The same walkthrough off-turn, so a beginner is not shown a second,
// different way to make an attack.
await p1.page.getByRole("button", { name: "Opportunity attack" }).click();
await p1.page.waitForSelector(".swing-step");
await p1.page.locator(".tgt-row").first().click();
await p1.page.waitForTimeout(400);
await p1.page.locator('input[aria-label="Attack roll total"]').fill("16");
await p1.page.getByRole("button", { name: "Next" }).click();
await p1.page.locator('input[aria-label="Damage roll total"]').fill("5");
await p1.page.getByRole("button", { name: "Send to the DM" }).click();
await p1.page.waitForTimeout(900);
ok("taking it spends the reaction",
  await p1.page.locator('[aria-label="Reaction spent"]').count(), 1);
ok("and it is not offered twice",
  await p1.page.getByRole("button", { name: "Opportunity attack" }).count(), 0);

await dm.page.waitForSelector(".claim", { timeout: 15000 });
await dm.page.getByRole("button", { name: /Apply 5 to Goblin/ }).click();
await dm.page.waitForTimeout(900);
ok("its damage lands too, once confirmed",
  (await dm.page.locator(".cbt", { hasText: "Goblin" }).locator(".hp").innerText()), "0/12");

await go(dm.page, "log");
const feed = await dm.page.locator(".card", { hasText: "Action log" }).innerText();
ok("the log says who took it", feed.includes("Opportunity attack by Kira Vance"), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
