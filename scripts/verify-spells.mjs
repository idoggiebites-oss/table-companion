/* The spell list.

   The app earns its place at the moment of casting: it knows which slot a
   spell needs, which slots are left, and that a concentration spell displaces
   the one you were already holding. Doing those three by hand is where
   mistakes live, so they are one event — and undoing it gives all three back.

   Needs a compendium, because the SRD data this app ships has no spell list. */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { sitIn } from "./lib/seat.mjs";

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
  await page.waitForTimeout(250);
};
/* Casting from the Spells tab is two presses now: the grid shows a dozen
   spells at once, and a tile opens before it casts so a mis-tap cannot spend
   a slot. In a fight, casting happens on the turn and is still one press. */
const openSpell = async (page, name) => {
  const tile = page.locator(".sp-tile", { hasText: new RegExp(`^${name}`, "i") }).first();
  if ((await tile.getAttribute("aria-expanded")) !== "true") await tile.click();
  await page.waitForTimeout(250);
};
const castSpell = async (page, name) => {
  await openSpell(page, name);
  await page.getByRole("button", { name: `Cast ${name}` }).click();
  await page.waitForTimeout(400);
};
const castable = async (page, name) => {
  await openSpell(page, name);
  return !(await page.getByRole("button", { name: `Cast ${name}` }).isDisabled());
};

const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// A wizard at level 5: slots 4/3/2.
await page.getByRole("button", { name: "Build a character" }).click();
await atStep(page, "Class");
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await atStep(page, "Class");
await page.getByRole("button", { name: "Wizard", exact: true }).click();
await page.waitForTimeout(400);
await atStep(page, "Class");
await page.locator('input[aria-label="Starting level"]').fill("5");
await atStep(page, "Class");
for (const s of ["Arcana", "History"]) {
  await atStep(page, "Skills");
  await page.getByRole("button", { name: `Train ${s.toLowerCase()}` }).click();
}
await atStep(page, "Race");
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(600);
/* --- the rail does not tick a step nobody has answered ------------------

   With a class and a race chosen, the Spells step drew a green tick before
   the player had seen the list. Its condition was `klass !== undefined` —
   which asks whether the QUESTION exists, not whether it has been answered,
   the same mistake Skills and Gear made and one step further removed.

   Both halves are checked, because a `done` that is simply always false
   would pass the first on its own and be just as wrong. */
/* From another step: the one you are standing on shows its number rather than
   its state, so reading the Spells dot from Spells always says "6". */
const spellDot = async () => {
  await atStep(page, "Story");
  await page.waitForTimeout(300);
  /* The dot says it, and it says it to a screen reader: the rail carries no
     visible text now, so the tick lives in the node's own textContent behind
     `text-indent`. Found by accessible name, read by content. */
  return page.getByRole("button", { name: /^Step \d+, Spells$/ }).innerText();
};
ok("a caster with no spells chosen is not finished with Spells",
  /\u2713/.test(await spellDot()), false);

await atStep(page, "Scores");
await page.getByRole("button", { name: "Recommend" }).click();
await atStep(page, "Story");
await openPick(page, "Skills");
await page.getByRole("button", { name: "Train nature" }).click();
await atStep(page, "Story");
await openPick(page, "Skills");
await page.getByRole("button", { name: "Train animal handling" }).click();
await atStep(page, "Story");
await page.locator('input[aria-label="Background name"]').fill("Sage");
await atStep(page, "Review");
await page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
await atStep(page, "Gear");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
// And whatever the class asks about itself — a domain, a tradition.
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
// A wizard at 5 has passed level 4, so it owes an improvement too.
await atStep(page, "Scores");
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
  await atStep(page, "Spells");
  const hd = page.getByRole("button", { name: label }).first();
  await hd.scrollIntoViewIfNeeded();
  await hd.click();
  await page.waitForTimeout(1200);
  const offered = await page.locator(".chooser-list .menu-hd").count();
  ok(`the ${which.toLowerCase()} picker offers something to choose`, offered > 0, true);
  /* And offers the game's own first. Two thirds of a complete compendium is
     homebrew and third-party, and alphabetically it lands on top: the first
     thing a first-time wizard saw was "Acid Burn (HB)". */
  const first = await page.locator(".chooser-list .menu-hd .nm").first().innerText();
  ok(`the first ${which.toLowerCase()} offered comes from the game`,
    /\(/.test(first) ? first : "no marker", "no marker");
  await hd.click();
  await page.waitForTimeout(200);
}


await page.waitForTimeout(400);
await atStep(page, "Review");
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
await castSpell(page, "Magic Missile");
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
await castSpell(page, "Fire Bolt");
await page.waitForTimeout(500);
ok("a cantrip costs nothing and does not ask",
  (await page.locator(".slot .num").allInnerTexts()), ["4", "2", "2"]);

// --- concentration is exclusive -------------------------------------------
await castSpell(page, "Haste");
await page.waitForTimeout(600);
ok("a concentration spell takes hold",
  (await page.locator(".src-note").innerText()).toLowerCase().includes("haste"), true);
await go(page, "sheet");
ok("and the sheet agrees",
  (await page.locator(".chip.conc").innerText()).toLowerCase(), "haste");

await go(page, "spells");
await castSpell(page, "Fireball");
await page.waitForTimeout(600);
ok("casting a non-concentration spell leaves it alone",
  (await page.locator(".src-note").innerText()).toLowerCase().includes("haste"), true);

// --- preparing ------------------------------------------------------------
await page.getByRole("button", { name: "Unprepare Fireball" }).click();
await page.waitForTimeout(500);
ok("an unprepared spell cannot be cast",
  !(await castable(page, "Fireball")), true);
ok("but a cantrip never needs preparing",
  !(await castable(page, "Fire Bolt")), false);

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
await sitIn(page, "dm");
await page.waitForTimeout(600);
await go(page, "combat");
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
await sitIn(page, "Bel Ashcroft");
await page.waitForTimeout(700);

/* Casting is on the turn itself — and it is the SPELLS that are on it, not a
   tile saying "opens your spells". The tile and the strip below it were two
   doors into the same room; the strip is the one you can see through. */
await go(page, "combat");

/* --- a caster's turn leads with what a caster does ------------------------

   It always led with the weapon. A wizard's turn opened with "Attack with
   Quarterstaff" — a thing a wizard does roughly never — and the cantrip was a
   tap further, behind a question; the small print beside it said "or something
   else", which sounds like every option on the turn and means another WEAPON.
   That wording is what sent ME to the weapon picker while looking for the
   spell, twice, which is enough evidence about the wording.

   Ranked on the numbers rather than on a guess about the class: this wizard
   swings at +1 and throws a Fire Bolt at +5. The ranger in verify-turns shoots
   at +7 and casts at +5 and must still lead with the bow — the control, and
   the half that makes this assertion mean anything. */
const primaries = await page.locator(".pt-atk").allInnerTexts();
ok("a wizard's turn leads with the spell, not the quarterstaff",
  /cast fire bolt/i.test(primaries[0] ?? ""), true);
ok("and the weapon is still offered, second",
  primaries.some((t) => /attack with/i.test(t)), true);
/* The small print names what it opens. */
ok("the weapon's small print says weapon",
  /another weapon/i.test(primaries.join(" ")), true);
ok("and nothing says the vague thing that misled two readings",
  /something else/i.test(primaries.join(" ")), false);

/* And it does what it says: one tap from the turn to aiming that spell. */
await page.locator(".pt-atk").first().click();
await page.waitForTimeout(700);
ok("pressing it aims that spell rather than opening a menu",
  await page.locator(".tgt-row").count() > 0, true);
await page.getByRole("button", { name: /Never mind|Back|Cancel/ }).first().click();
await page.waitForTimeout(500);

await page.getByRole("button", { name: "What else can I do?" }).click();
await page.waitForSelector(".hotbar");
ok("the turn does not offer a door to a room it is already in",
  (await page.locator(".hot .ht").allInnerTexts()).some((t) => /cast a spell/i.test(t)), false);
const ready = await page.locator(".pt-strip .sp-tile .nm").allInnerTexts();
ok("it offers the spells themselves",
  ready.some((t) => /fire bolt/i.test(t)), true);
ok("and what each one costs",
  (await page.locator(".pt-strip .sp-tile .cost").allInnerTexts()).some((t) => /cantrip/i.test(t)),
  true);

// Straight from the tile into the aim, without leaving the fight.
await page.locator(".pt-strip .sp-tile", { hasText: /fire bolt/i }).first().click();
await page.waitForTimeout(600);
ok("taking it does not leave the fight",
  await page.locator('[data-tab="combat"].on').count(), 1);

// All the way through, from the turn: aim, roll, and into the DM's queue.
// The tile IS the choice of spell, so the next question is who it is aimed at.
await page.locator(".tgt-row", { hasText: "Goblin" }).first().click();
await page.waitForTimeout(400);
await page.locator('input[aria-label="Spell attack roll"]').fill("18");
await page.locator('input[aria-label="Spell damage roll"]').fill("7");
await page.getByRole("button", { name: "Send to the DM" }).click();
await page.waitForTimeout(700);
ok("a spell cast from the turn spends the action", await page.locator(".ec.spent").count(), 1);
await sitIn(page, "dm");
await page.waitForTimeout(700);
await go(page, "combat");
ok("and reaches the DM exactly as a weapon attack does",
  /fire bolt/i.test(await page.locator(".claim").first().innerText()), true);

/* Confirmed, not rejected — the earlier version of this rejected the claim,
   so the in-turn path's damage was never actually asserted to land. */
const hpBefore = await page.locator(".cbt", { hasText: "Goblin" }).locator(".hp").innerText();
await page.locator(".claim").first().getByRole("button", { name: /^Apply/ }).click();
await page.waitForTimeout(700);
const hpAfter = await page.locator(".cbt", { hasText: "Goblin" }).locator(".hp").innerText();
ok("and the damage lands on the creature", hpBefore !== hpAfter, true);
ok("by the amount that was rolled",
  Number(hpBefore.split("/")[0]) - Number(hpAfter.split("/")[0]), 7);

// A fresh turn, so the rest of this suite has an action to spend. The Spells
// tab still casts — it is where you go when you are NOT in the middle of a
// turn, and it must not have been broken by moving the turn's copy.
for (let i = 0; i < 2; i++) {
  await page.getByRole("button", { name: "Next turn" }).click();
  await page.waitForTimeout(700);
}
await sitIn(page, "Bel Ashcroft");
await page.waitForTimeout(700);
await go(page, "spells");

/* Walking away from an aim costs nothing.

   It used to cost everything: the slot and the action were spent the moment
   you pressed Cast, and the aim lived in this tab — which the fight had just
   sent you to. Switching back to look at the goblin threw the aim away, so no
   claim ever reached the DM and the player was left with the slot gone, the
   action gone, and nothing cast. */
const slotsNow = () => page.locator(".slot .num").allInnerTexts();
const actionUp = async () => {
  await go(page, "combat");
  const n = await page.locator('.econ .ec[aria-label="Action available"]').count();
  await go(page, "spells");
  return n === 1;
};
const castsOf = async (name) => {
  await go(page, "log");
  const n = await page.locator(".fr", { hasText: new RegExp(`cast ${name}`, "i") }).count();
  await go(page, "spells");
  return n;
};
const slotsBefore = await slotsNow();
// Counted, not searched: this spell was cast earlier in the session, so its
// presence in the log says nothing — only a change in the count does.
const castsBefore = await castsOf("Fire Bolt");
await castSpell(page, "Fire Bolt");
await page.waitForTimeout(500);
ok("pressing Cast asks who first", await page.locator(".swing-step").count(), 1);
ok("and spends nothing yet", await actionUp(), true);

ok("nothing is cast until it is aimed", await castsOf("Fire Bolt"), castsBefore);
ok("and the slots are where they were", await slotsNow(), slotsBefore);

// Backing out on purpose says so, and still costs nothing.
await castSpell(page, "Fire Bolt");
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Never mind" }).click();
await page.waitForTimeout(400);
ok("thinking better of it costs nothing", await actionUp(), true);

await castSpell(page, "Fire Bolt");
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

await sitIn(page, "dm");
await page.waitForTimeout(600);
await go(page, "combat");
/* Relative, because a spell was already cast at this goblin from the turn
   earlier in this suite — an absolute number here would encode the order the
   assertions happen to run in. */
const hpNow = () => page.locator(".cbt", { hasText: "Goblin" }).locator(".hp").innerText();
const before9 = Number((await hpNow()).split("/")[0]);
const claim = (await page.locator(".claim").innerText()).replace(/\s+/g, " ");
ok("the claim names the spell", /Fire Bolt/.test(claim), true);
ok("and works out the verdict", /19 against 13 — hits/i.test(claim), true);
ok("nothing lands until the DM says so", Number((await hpNow()).split("/")[0]), before9);
await page.getByRole("button", { name: /Apply 9 to Goblin/ }).click();
await page.waitForTimeout(700);
ok("confirming applies it", before9 - Number((await hpNow()).split("/")[0]), 9);

// The economy is the point of the second half: a cantrip still costs the
// action, and the app has to stop the next one.
await sitIn(page, "Bel Ashcroft");
await page.waitForTimeout(700);
await go(page, "spells");
ok("the action is gone", !(await castable(page, "Fire Bolt")), true);
// The reason lives on the spell's own tile, opened by tapping it.
await openSpell(page, "Fire Bolt");
ok("and it says why",
  /action is gone/i.test(await page.locator(".sp-detail").first().innerText()), true);


/* --- a save that halves it ------------------------------------------------

   The last place the app handed the DM arithmetic. A player rolls 8d6, the
   goblin makes its save, and somebody divides by two out loud after the dice
   are already on the table. The spell's own last sentence says which rule
   applies, and only the CASTER's device has the spellbook — so the claim
   carries it across. */
await go(page, "spells");
await page.getByRole("button", { name: "Add spells" }).click();
await page.waitForSelector('input[aria-label="Search spells"]', { timeout: 20000 });
await page.locator('input[aria-label="Search spells"]').fill("burning hands");
await page.waitForTimeout(900);
await page.locator(".menu-hd", { hasText: /^Burning Hands/ }).first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Learn it" }).first().click();
await page.waitForTimeout(600);

/* A fresh fight, and a goblin with enough hit points left to take half of
   anything. The one in the fight above is on its last four, and damage that
   clamps at zero proves nothing about halving. */
await sitIn(page, "dm");
await page.waitForTimeout(600);
await go(page, "combat");
await page.getByRole("button", { name: "End combat" }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Add creature" }).click();
await page.locator('input[aria-label="Creature 1 name"]').fill("Ogre");
await page.locator('input[aria-label="Creature 1 hp"]').fill("59");
await page.getByRole("button", { name: "Roll for initiative" }).click();
await page.waitForSelector('input[aria-label="Ogre initiative"]');
for (const [who, v] of [["Bel Ashcroft", 20], ["Ogre", 5]]) {
  await page.locator(`input[aria-label="${who} initiative"]`).fill(String(v));
  await page.getByRole("button", { name: `Set ${who} initiative` }).click();
}
await page.getByRole("button", { name: "Begin", exact: true }).click();
await page.waitForTimeout(700);
await sitIn(page, "Bel Ashcroft");
await page.waitForTimeout(700);
await go(page, "spells");
await castSpell(page, "Burning Hands");
// A levelled spell asks which slot first.
const slot = page.locator(".tgt-row", { hasText: /1st/ }).first();
if (await slot.count()) { await slot.click(); await page.waitForTimeout(500); }
await page.locator(".tgt-row", { hasText: "Ogre" }).first().click();
await page.waitForTimeout(500);

const saveAsk = (await page.locator(".swing-step").innerText()).replace(/\s+/g, " ");
ok("a save spell asks the target to roll, not the caster",
  /DEX save against your DC \d+/i.test(saveAsk), true);
/* The rule, before the dice rather than after them. */
ok("and says what a success costs", /success takes half/i.test(saveAsk), true);
ok("no attack roll is asked for",
  await page.locator('input[aria-label="Spell attack roll"]').count(), 0);

await page.locator('input[aria-label="Spell damage roll"]').fill("13");
await page.getByRole("button", { name: "Send to the DM" }).click();
await page.waitForTimeout(700);

await sitIn(page, "dm");
await page.waitForTimeout(700);
await go(page, "combat");
const saveClaim = (await page.locator(".claim").first().innerText()).replace(/\s+/g, " ");
/* "they save or they do not" was true and useless: it told the DM neither
   what to roll against nor what a success was worth. */
ok("the DM's row names the save and the DC", /DEX \d+/.test(saveClaim), true);
ok("and which rule this spell uses", /half on a save/i.test(saveClaim), true);

const gobHp = () => page.locator(".cbt", { hasText: "Ogre" }).locator(".hp").innerText();
const beforeSave = Number((await gobHp()).split("/")[0]);
ok("both outcomes are one press, and the app has done the halving",
  await page.locator(".claim").first().getByRole("button", { name: /Apply 6 to Ogre on a save/ }).count(),
  1);
await page.screenshot({ path: `${OUT}/30-half-on-save.png` });
await page.locator(".claim").first().getByRole("button", { name: /on a save/ }).click();
await page.waitForTimeout(700);
ok("half of thirteen is six, rounded down",
  beforeSave - Number((await gobHp()).split("/")[0]), 6);
ok("and the claim leaves the queue", await page.locator(".claim").count(), 0);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
