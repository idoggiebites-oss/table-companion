/* The spell list.

   The app earns its place at the moment of casting: it knows which slot a
   spell needs, which slots are left, and that a concentration spell displaces
   the one you were already holding. Doing those three by hand is where
   mistakes live, so they are one event — and undoing it gives all three back.

   Needs a compendium, because the SRD data this app ships has no spell list. */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { homedir } from "node:os";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const FILE = process.env.COMPENDIUM ?? `${homedir()}/Downloads/FC5 Compendium.xml`;
if (!existsSync(FILE)) {
  console.log(`SKIP  no compendium at ${FILE}`);
  process.exit(0);
}
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// A wizard at level 5: slots 4/3/2.
await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });
await page.selectOption('select[aria-label="Class"]', "wizard");
await page.waitForTimeout(400);
await page.locator('input[aria-label="Starting level"]').fill("5");
for (const s of ["Arcana", "History"]) {
  await page.getByRole("button", { name: s, exact: true }).click();
}
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Recommend" }).click();
await page.getByRole("button", { name: "nature", exact: true }).click();
await page.getByRole("button", { name: "animal handling", exact: true }).click();
await page.locator('input[aria-label="Background name"]').fill("Sage");
await page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
// And whatever the class asks about itself — a domain, a tradition.
const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls.count()); i++) await cls.nth(i).selectOption({ index: 1 });
// A wizard at 5 has passed level 4, so it owes an improvement too.
const rows = page.locator(".card", { hasText: "Improvements" }).locator(".chooser");
for (let i = 0; i < (await rows.count()); i++) {
  const chips = rows.nth(i).locator(".lv-abils .chip:not([disabled])");
  await chips.first().click();
  await chips.first().click();
}

/* Both pickers offer something.

   Capping the shared list before splitting it was silently fatal with a
   complete compendium: sorted by level, the first eighty entries are all
   cantrips, so the Spells picker was empty and said nothing about why. */
for (const [which, label] of [["Cantrips", /^Cantrips,/], ["Spells", /^Spells,/]]) {
  const hd = page.getByRole("button", { name: label }).first();
  await hd.scrollIntoViewIfNeeded();
  await hd.click();
  await page.waitForTimeout(1200);
  const offered = await page.locator(".chooser-list .menu-hd").count();
  ok(`the ${which.toLowerCase()} picker offers something to choose`, offered > 0, true);
  await hd.click();
  await page.waitForTimeout(200);
}

await page.waitForTimeout(400);
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });

ok("a caster gets a Spells tab", await page.locator('[data-tab="spells"]').count(), 1);
await go(page, "spells");
ok("led by the slots, because that is the first question",
  (await page.locator(".slot .num").allInnerTexts()), ["4", "3", "2"]);
ok("and says where spells come from when there are none",
  (await page.locator(".card").last().innerText()).toLowerCase().includes("compendium"), true);

// Import the SRD compendium for its 317 spells.
await go(page, "gear");
await page.getByRole("button", { name: "Add a compendium" }).click();
await page.locator('input[aria-label="Compendium file"]').setInputFiles(FILE);
await page.waitForSelector(".chips .chip", { timeout: 120000 });
await page.getByRole("button", { name: "Import", exact: true }).click();
await page.waitForSelector(".src-row:nth-child(2)", { timeout: 180000 });

await go(page, "spells");
await page.getByRole("button", { name: "Add spells" }).click();
await page.waitForSelector('input[aria-label="Search spells"]', { timeout: 20000 });

// Only what this class can cast, until asked otherwise.
// Exact: a complete compendium really does give "Mass Cure Wounds" to a UA
// wizard subclass, so a substring match would be testing the file's contents
// rather than the filter.
const exactly = (n) => page.locator(".menu-hd .nm").filter({ hasText: new RegExp(`^${n}$`, "i") });
await page.locator('input[aria-label="Search spells"]').fill("Cure Wounds");
await page.waitForTimeout(500);
ok("a wizard is not offered a cleric's spell", await exactly("Cure Wounds").count(), 0);
await page.getByRole("button", { name: /only/i }).click();
await page.waitForTimeout(400);
ok("unless they ask for everything", await exactly("Cure Wounds").count() > 0, true);

// --- what a compendium files under spells but is not one ------------------
// A complete compendium has 1,539 invocations, maneuvers, metamagics and
// runes among its 3,443 "spells", and 1,254 of them claim level 0 — so a
// warlock browsing cantrips would get a wall of invocations before a spell.
await page.locator('input[aria-label="Search spells"]').fill("");
await page.waitForTimeout(500);
const featureChip = page.locator(".chip", { hasText: /class features filed as spells/i });
const hasFeatures = (await featureChip.count()) > 0;
if (hasFeatures) {
  const shown = (await page.locator(".menu-hd .nm").allInnerTexts()).map((t) => t.toLowerCase());
  ok("class features are kept out of the spell list",
    shown.some((n) => /^[^:]{1,40}:\s/.test(n)), false);
  ok("but the app says how many it is hiding",
    /\d{3,}/.test(await featureChip.innerText()), true);
  await featureChip.click();
  await page.waitForTimeout(500);
  const withThem = (await page.locator(".menu-hd .nm").allInnerTexts()).map((t) => t.toLowerCase());
  ok("and will show them if asked — they are hidden, not discarded",
    withThem.some((n) => /^[^:]{1,40}:\s/.test(n)), true);
  await featureChip.click();
  await page.waitForTimeout(400);
} else {
  console.log("PASS  no class features in this compendium, nothing to hide: true");
}

await page.getByRole("button", { name: "Everything" }).click();
await page.waitForTimeout(300);
// A name is not a choice: opening one shows what it does before you take it.
await page.locator('input[aria-label="Search spells"]').fill("Fire Bolt");
await page.waitForTimeout(500);
ok("nothing is described until you point at it",
  await page.locator(".menu-more").count(), 0);
await page.locator(".menu-hd", { hasText: /^Fire Bolt/i }).first().click();
await page.waitForTimeout(300);
const detail = (await page.locator(".menu-more").innerText()).replace(/\s+/g, " ");
ok("opening one says what it costs and how far it reaches",
  /Takes 1 action/i.test(detail) && /Reaches 120 feet/i.test(detail), true);
ok("and what it actually does", /streak|fire/i.test(detail), true);
await page.getByRole("button", { name: "Learn it" }).click();
await page.waitForTimeout(400);

for (const name of ["Magic Missile", "Fireball", "Haste"]) {
  await page.locator('input[aria-label="Search spells"]').fill(name);
  await page.waitForTimeout(400);
  await page.locator(".menu-hd", { hasText: new RegExp(`^${name}`, "i") }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Learn it" }).click();
  await page.waitForTimeout(300);
}
await page.getByRole("button", { name: "Done" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/59-spells.png`, fullPage: true });

// --- casting spends the slot you chose ------------------------------------
await page.getByRole("button", { name: "Cast Magic Missile" }).click();
await page.waitForSelector(".sp-cast");
const offered = (await page.locator(".sp-cast .tgt-row").allInnerTexts()).map((t) => t.toLowerCase());
ok("a 1st-level spell offers higher slots too — upcasting, in the open",
  offered.length, 3);
ok("and never a slot below its own", offered[0].includes("1st"), true);
// Into a 2nd-level slot, leaving the 3rd-level ones for the spells below —
// a wizard at 5 has only two of those.
await page.locator(".sp-cast .tgt-row", { hasText: /2nd/i }).click();
await page.waitForTimeout(600);
ok("the slot you picked is the one spent",
  (await page.locator(".slot .num").allInnerTexts()), ["4", "2", "2"]);

// A cantrip asks nothing and costs nothing.
await page.getByRole("button", { name: "Cast Fire Bolt" }).click();
await page.waitForTimeout(500);
ok("a cantrip costs nothing and does not ask",
  (await page.locator(".slot .num").allInnerTexts()), ["4", "2", "2"]);

// --- concentration is exclusive -------------------------------------------
await page.getByRole("button", { name: "Cast Haste" }).click();
await page.waitForTimeout(600);
ok("a concentration spell takes hold",
  (await page.locator(".src-note").innerText()).toLowerCase().includes("haste"), true);
await go(page, "sheet");
ok("and the sheet agrees",
  (await page.locator(".chip.conc").innerText()).toLowerCase(), "haste");

await go(page, "spells");
await page.getByRole("button", { name: "Cast Fireball" }).click();
await page.waitForTimeout(600);
ok("casting a non-concentration spell leaves it alone",
  (await page.locator(".src-note").innerText()).toLowerCase().includes("haste"), true);

// --- preparing ------------------------------------------------------------
await page.getByRole("button", { name: "Unprepare Fireball" }).click();
await page.waitForTimeout(500);
ok("an unprepared spell cannot be cast",
  await page.getByRole("button", { name: "Cast Fireball" }).isDisabled(), true);
ok("but a cantrip never needs preparing",
  await page.getByRole("button", { name: "Cast Fire Bolt" }).isDisabled(), false);

// --- one undo returns the slot AND the concentration ----------------------
await go(page, "log");
await page.locator(".fr", { hasText: /cast Haste/i }).first().getByRole("button", { name: "Undo" }).click();
await page.waitForTimeout(700);
await go(page, "spells");
// Haste and Fireball each took a 3rd-level slot; undoing Haste returns one.
ok("undoing a cast gives back the slot",
  (await page.locator(".slot .num").allInnerTexts())[2], "1");
ok("and the concentration with it, in one go",
  await page.locator(".src-note").count(), 0);

// --- casting in a fight ---------------------------------------------------
// The same walkthrough a weapon gets, because a beginner should not meet two
// different ways of making an attack.
// One device, both chairs: staging a fight is the DM's, casting is the
// player's, and a solo device may be either.
await page.selectOption('select[aria-label="Seat"]', "dm");
await page.waitForTimeout(600);
await go(page, "fight");
await page.getByRole("button", { name: "Add creature" }).click();
await page.locator('input[aria-label="Creature 1 name"]').fill("Goblin");
await page.locator('input[aria-label="Creature 1 hp"]').fill("20");
await page.locator('input[aria-label="Creature 1 armour class"]').fill("13");
await page.getByRole("button", { name: "Roll for initiative" }).click();
await page.waitForSelector('input[aria-label="Bel Ashcroft initiative"]', { timeout: 20000 });
for (const [n, v] of [["Bel Ashcroft", 20], ["Goblin", 2]]) {
  await page.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await page.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await page.getByRole("button", { name: "Begin", exact: true }).click();
await page.waitForTimeout(900);
await page.selectOption('select[aria-label="Seat"]', { label: "Bel Ashcroft" });
await page.waitForTimeout(700);

// Casting lives on its own tab, so the turn menu has to say it exists —
// otherwise a new caster's turn offers them only a weapon they may not have.
await go(page, "fight");
await page.getByRole("button", { name: "What else can I do?" }).click();
await page.waitForSelector(".menu-row");
ok("the turn menu offers casting",
  (await page.locator(".menu-hd .nm").allInnerTexts()).some((t) => /cast a spell/i.test(t)), true);
await page.locator(".menu-hd", { hasText: /Cast a spell/i }).click();
await page.waitForTimeout(300);
ok("and says the cost varies rather than pretending it does not",
  /bonus action/i.test(await page.locator(".menu-more .what").innerText()), true);
await page.getByRole("button", { name: "Do it" }).click();
await page.waitForTimeout(600);
ok("taking it goes to the spells", await page.locator('[data-tab="spells"].on').count(), 1);

await page.getByRole("button", { name: "Cast Fire Bolt" }).click();
await page.waitForTimeout(600);
ok("casting in a fight asks what to aim at",
  (await page.locator(".tgt-row").allInnerTexts()).map((t) => t.toLowerCase()), ["goblin"]);
await page.locator(".tgt-row").first().click();
await page.waitForTimeout(400);

const asks = (await page.locator(".swing-step").innerText()).replace(/\s+/g, " ");
// A wizard at 5 casts Fire Bolt for 2d10 — the cantrip scales with the CASTER.
ok("it names the spell attack bonus", /Roll a d20 and add \+\d/.test(asks), true);
ok("and the damage at the caster's level, not the slot's", /Roll 2d10 fire/i.test(asks), true);

await page.locator('input[aria-label="Spell attack roll"]').fill("19");
await page.locator('input[aria-label="Spell damage roll"]').fill("9");
await page.getByRole("button", { name: "Send to the DM" }).click();
await page.waitForTimeout(700);

await page.selectOption('select[aria-label="Seat"]', "dm");
await page.waitForTimeout(600);
await go(page, "fight");
ok("nothing lands until the DM says so",
  (await page.locator(".cbt", { hasText: "Goblin" }).locator(".hp").innerText()), "20/20");
const claim = (await page.locator(".claim").innerText()).replace(/\s+/g, " ");
ok("the claim names the spell", /Fire Bolt/.test(claim), true);
ok("and works out the verdict", /19 against 13 — hits/i.test(claim), true);
await page.getByRole("button", { name: /Apply 9 to Goblin/ }).click();
await page.waitForTimeout(700);
ok("confirming applies it",
  (await page.locator(".cbt", { hasText: "Goblin" }).locator(".hp").innerText()), "11/20");

// The economy is the point of the second half: a cantrip still costs the
// action, and the app has to stop the next one.
await page.selectOption('select[aria-label="Seat"]', { label: "Bel Ashcroft" });
await page.waitForTimeout(700);
await go(page, "spells");
ok("the action is gone", await page.getByRole("button", { name: "Cast Fire Bolt" }).isDisabled(), true);
// The reason lives on the spell's own row, opened by tapping it.
await page.locator(".sp-main", { hasText: "Fire Bolt" }).click();
await page.waitForTimeout(300);
ok("and it says why",
  /action is gone/i.test(await page.locator(".sp-detail").first().innerText()), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
