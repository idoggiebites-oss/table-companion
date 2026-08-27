/* Content that ships WITH the app.

   The compendium is baked in at deploy time, so a device gets 605 races and
   3,443 spells by opening the page — no file picker, no per-device ritual.
   The claim under test is that the builder uses it without being asked to.

   Skips when the deployment was built without a compendium, which is a valid
   way to build it. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const probe = await (await fetch(new global.URL("/content/index.json", URL))).status;
if (probe !== 200) {
  console.log("SKIP  no compendium built into this deployment");
  await browser.close();
  process.exit(0);
}
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
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// A brand new device, nothing imported.
await page.getByRole("button", { name: "Build a character" }).click();
await atStep(page, "Class");
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await page.waitForTimeout(1200);

// --- classes -------------------------------------------------------------
// Both sources describe the same twelve, so the merge has to dedupe them —
// and the SRD entry has to win, because only it carries a starting kit.
/* The twelve are cards; whatever a compendium adds stays in a list beneath
   them, because sixty cards is a scroll rather than a choice. */
await atStep(page, "Class");
await atStep(page, "Class");
const core = await page.locator(".klass .nm").allInnerTexts();
ok("the familiar classes are cards", core.length, 12);
ok("in alphabetical order", core[0].toLowerCase(), "barbarian");
ok("each saying what it plays like",
  await page.locator(".klass").first().locator(".ktag").count() > 0, true);
await atStep(page, "Class");
ok("and how much it asks of you",
  await page.locator(".klass").first().locator(".kcx i.f").count() > 0, true);

/* Other people's classes are behind the switch, not gone — this suite is
   about what a shipped compendium BRINGS, so it asks for them. */
const hbToggle = page.getByRole("button", { name: "Show homebrew and third-party content" });
ok("and the rest are behind a switch rather than in the list", await hbToggle.count(), 1);
await hbToggle.first().click();
await page.waitForTimeout(600);
const extra = (await page.locator('select[aria-label="Class"] option').allInnerTexts()).slice(1);
ok("which brings them", extra.length > 40, true);
const classNames = [...core, ...extra];
ok("and none is listed twice",
  new Set(classNames.map((n) => n.toLowerCase())).size, classNames.length);
ok("the SRD twelve appear once each",
  classNames.filter((n) => /^fighter$/i.test(n)).length, 1);

// A class only the compendium knows must still be completable.
await page.selectOption('select[aria-label="Class"]', { label: "Blood Hunter" });
await page.waitForTimeout(800);
await atStep(page, "Class");
ok("a compendium-only class derives its saves from the one proficiency line",
  /saves in DEX and INT/i.test(await page.locator(".cr-note").first().innerText()), true);
// Skills are a table now — a compendium-only class still fills one.
await atStep(page, "Class");
await atStep(page, "Skills");
ok("and its skill choices",
  (await page.locator(".skl tr:not(.shut)").count()) > 5, true);

await atStep(page, "Race");
await page.locator('input[aria-label="Filter races"]').fill("human");
await page.waitForTimeout(500);
await atStep(page, "Race");
await atStep(page, "Race");
const humanOpts = await page.locator('select[aria-label="Race"] option').allInnerTexts();
await page.selectOption('select[aria-label="Race"]', { label: humanOpts[1] });
await page.waitForTimeout(900);
await atStep(page, "Gear");
const gearText = (await page.locator(".gear-step").innerText()).replace(/\s+/g, " ");
// The compendium carries no starting kit, only wealth. Saying so beats an
// empty step or a silently equipmentless character.
await atStep(page, "Race");
ok("with starting wealth read from the file", /4d4 × 10 gp/i.test(gearText), true);
ok("worth the right amount", /100 gp/.test(gearText), true);
ok("and it says why there is no kit", /no kit written down/i.test(gearText), true);
await page.locator('input[aria-label="Filter races"]').fill("");
await page.waitForTimeout(300);

// --- what the class asks about itself ------------------------------------
// A cleric without a domain is not a cleric, and the builder was making them.
// The later steps need a race chosen, so pick one first.
await atStep(page, "Race");
await page.locator('input[aria-label="Filter races"]').fill("human");
await page.waitForTimeout(500);
await atStep(page, "Race");
await atStep(page, "Race");
const humans = await page.locator('select[aria-label="Race"] option').allInnerTexts();
await page.selectOption('select[aria-label="Race"]', { label: humans[1] });
await atStep(page, "Race");
await page.locator('input[aria-label="Filter races"]').fill("");
await atStep(page, "Class");
await page.getByRole("button", { name: "Cleric", exact: true }).click();
await page.waitForTimeout(1400);
await atStep(page, "Scores");
ok("a class with a level-1 subclass asks for it",
  await page.getByText("6 · Your class").count(), 1);
ok("naming the question the book asks",
  await page.locator('select[aria-label="Divine Domain"]').count(), 1);
const domains = await page.locator('select[aria-label="Divine Domain"] option').count();
ok("with the options read out of its own feature list", domains > 10, true);
ok("and a filter, because there are dozens",
  await page.locator('input[aria-label="Filter Divine Domain"]').count(), 1);

await atStep(page, "Class");
await page.getByRole("button", { name: "Fighter", exact: true }).click();
await page.waitForTimeout(1200);
// The same reading finds Fighting Style, which is written the same way.
await atStep(page, "Scores");
ok("a fighter is asked for a fighting style at 1",
  await page.locator('select[aria-label="Fighting Style"]').count(), 1);
ok("but not for an archetype it has not reached",
  await page.locator('select[aria-label="Martial Archetype"]').count(), 0);

await atStep(page, "Class");
await page.getByRole("button", { name: "Wizard", exact: true }).click();
await page.waitForTimeout(900);
await atStep(page, "Scores");
ok("a wizard at 1 is asked nothing — its tradition comes at 2",
  await page.getByText("6 · Your class").count(), 0);

await atStep(page, "Race");
const races = (await page.locator('select[aria-label="Race"] option').count()) - 1;
ok("races arrive without importing anything", races > 200, true);

// A compendium lists "Halfling, Lightfoot" as its own race where the SRD
// nests it. Both lists together used to offer Halfling AND both of its
// subraces as three separate ways to pick the same person.
await atStep(page, "Race");
await page.locator('input[aria-label="Filter races"]').fill("halfling");
await page.waitForTimeout(500);
// The filter deliberately keeps whatever is already selected visible, so
// this looks only at what matched.
await atStep(page, "Race");
const halflings = (await page.locator('select[aria-label="Race"] option').allInnerTexts())
  .filter((t) => /halfling/i.test(t));
await atStep(page, "Race");
ok("a race with variants appears exactly once", halflings, ["Halfling"]);
await page.selectOption('select[aria-label="Race"]', { label: "Halfling" });
await page.waitForTimeout(600);
await atStep(page, "Race");
await atStep(page, "Race");
const subs = await page.locator('select[aria-label="Subrace"] option').allInnerTexts();
ok("its variants became subraces", subs.length > 5, true);
ok("named without repeating the race", subs.some((t) => /halfling/i.test(t)), false);
ok("and listed once each", new Set(subs.map((t) => t.toLowerCase())).size, subs.length);
await page.locator('input[aria-label="Filter races"]').fill("");
await page.waitForTimeout(400);
await atStep(page, "Race");
ok("and the list is filterable, being long",
  await page.locator('input[aria-label="Filter races"]').count(), 1);

/* The split is by BOOK now, not "core" and "everything else" — which put a
   Volo's tabaxi, a Ravnica loxodon and a stranger's homebrew in one bucket
   of two hundred. */
const raceCore = await page
  .locator('select[aria-label="Race"] optgroup')
  .first().locator("option").allInnerTexts();
ok("races lead with the Player's Handbook", raceCore.length > 8, true);
ok("starting where the book does", raceCore[0], "Dragonborn");

// Filtering has to keep the split, or narrowing throws you back into one
// long list at the moment you were trying to narrow it.
await atStep(page, "Race");
await page.locator('input[aria-label="Filter races"]').fill("elf");
await page.waitForTimeout(500);
const split = await page
  .locator('select[aria-label="Race"] optgroup')
  .evaluateAll((g) => g.map((x) => x.label));
await atStep(page, "Race");
ok("and the grouping survives a filter",
  split.length > 0 && split[0] === "Player's Handbook", true);
await page.locator('input[aria-label="Filter races"]').fill("");
await page.waitForTimeout(300);

await atStep(page, "Race");
await page.locator('input[aria-label="Filter races"]').fill("tiefling");
await page.waitForTimeout(400);
await atStep(page, "Race");
await atStep(page, "Race");
const opts = await page.locator('select[aria-label="Race"] option').allInnerTexts();
await page.selectOption('select[aria-label="Race"]', { label: opts[1] });
await page.waitForTimeout(600);

await atStep(page, "Story");
ok("backgrounds too", await page.locator('select[aria-label="Background"]').count(), 1);

// The spell step, sized by the class table.
await atStep(page, "Spells");
ok("a caster is asked for spells", await page.getByText("6 · Spells").count(), 1);
const budget = await page.locator(".card", { hasText: "6 · Spells" }).locator(".faint").first().innerText();
// A wizard at level 1: three cantrips, six spells.
// A wizard prepares from a book, so the SRD table records no "spells known"
// — three cantrips is a real limit, the rest is a count with nothing to hit.
ok("with the counts the class table actually gives",
  /0 of 3 cantrips · 0 spells/i.test(budget), true);
await page.screenshot({ path: `${OUT}/62-shipped-spells.png`, fullPage: true });

// Cantrips and spells are separate choosers: one flat list of everything a
// sorcerer can cast ran off the bottom of the card.
await atStep(page, "Spells");
ok("the step stays closed until asked",
  await page.locator(".chooser-list").count(), 0);
const cardHeight = async () =>
  (await page.locator(".card", { hasText: "6 · Spells" }).boundingBox())?.height ?? 0;
const closed = await cardHeight();

await page.getByRole("button", { name: /^Cantrips/ }).click();
await page.waitForTimeout(500);
await atStep(page, "Spells");
ok("opening one shows only its own kind",
  (await page.locator(".chooser-list .menu-hd .cost").allInnerTexts())
    .every((t) => /cantrip/i.test(t)), true);
ok("and the card does not grow without limit",
  (await cardHeight()) - closed < 900, true);
await page.screenshot({ path: `${OUT}/63-choosers.png`, fullPage: true });

await page.locator('input[aria-label="Filter cantrips"]').fill("Fire Bolt");
await page.waitForTimeout(500);
// A name is not a choice — open it, read it, then take it.
await atStep(page, "Spells");
await page.locator(".chooser-list .menu-hd", { hasText: /^Fire Bolt/i }).first().click();
await page.waitForTimeout(300);
await atStep(page, "Spells");
ok("the builder describes a spell before you take it",
  /Takes 1 action/i.test(await page.locator(".chooser-list .menu-more").innerText()), true);
await page.getByRole("button", { name: "Take it" }).click();
await page.waitForTimeout(300);

await page.getByRole("button", { name: /^Spells/ }).click();
await page.waitForTimeout(500);
await atStep(page, "Spells");
ok("opening the other closes the first",
  await page.locator(".chooser-list").count(), 1);
await atStep(page, "Spells");
ok("and offers no cantrips",
  (await page.locator(".chooser-list .menu-hd .cost").allInnerTexts())
    .some((t) => /cantrip/i.test(t)), false);
await page.locator('input[aria-label="Filter spells"]').fill("Magic Missile");
await page.waitForTimeout(500);
await atStep(page, "Spells");
await page.locator(".chooser-list .menu-hd", { hasText: /^Magic Missile/i }).first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Take it" }).click();
await page.waitForTimeout(400);
ok("choices count against the budget",
  /1 of 3 cantrips · 1 spells/i.test(
    await page.locator(".card", { hasText: "6 · Spells" }).locator(".faint").first().innerText(),
  ), true);

// Only what a wizard could actually cast at this level.
await page.locator('input[aria-label="Filter spells"]').fill("Fireball");
await page.waitForTimeout(500);
await atStep(page, "Spells");
ok("nothing above the best slot you have — a tease, not a choice",
  await page.locator(".chooser-list .menu-hd", { hasText: /^Fireball/i }).count(), 0);
await page.locator('input[aria-label="Filter spells"]').fill("");
await page.waitForTimeout(400);

await atStep(page, "Class");
for (const s of ["Arcana", "History"]) {
  await atStep(page, "Skills");
  await page.getByRole("button", { name: `Train ${s.toLowerCase()}` }).click();
}
await atStep(page, "Scores");
await page.getByRole("button", { name: "Recommend" }).click();
await atStep(page, "Story");
await page.locator('input[aria-label="Filter backgrounds"]').fill("Sage");
await page.waitForTimeout(400);
await atStep(page, "Story");
await page.selectOption('select[aria-label="Background"]', { label: "Sage" });
await atStep(page, "Review");
await page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
await atStep(page, "Gear");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
await page.waitForTimeout(400);
await atStep(page, "Review");
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });

await go(page, "spells");
const known = (await page.locator(".sp-tile .nm").allInnerTexts()).map((t) => t.toLowerCase());
ok("the spells chosen at creation are on the sheet",
  known.some((n) => /fire bolt/.test(n)) && known.some((n) => /magic missile/.test(n)), true);
const missile = page.locator(".sp-tile", { hasText: /^Magic Missile/i }).first();
await missile.click();
await page.waitForTimeout(300);
ok("and are castable straight away",
  await page.getByRole("button", { name: "Cast Magic Missile" }).isDisabled(), false);
ok("the builder said why there was no spell limit",
  /prepares from a book/i.test(await page.content()), false);


/* --- the slim class file ---------------------------------------------------

   A sheet prints a list of feature NAMES; the full class file is 6.3MB of
   feature TEXT, and every player's device was pulling the lot on load to get
   at the names. The slim copy is written beside it at deploy time.

   What has to hold is not "the small file is small" but that it says the same
   thing: the same {level, name} pairs, in the same order, for every class. If
   it ever does not, a sheet quietly loses features and nothing else notices. */
const sizes = await page.evaluate(async () => {
  const at = async (f) => {
    const t = await (await fetch(f)).text();
    return { bytes: t.length, rows: JSON.parse(t) };
  };
  const full = await at("/content/class.json");
  const slim = await at("/content/class-index.json");
  const pairs = (rows) =>
    Object.fromEntries(
      rows.map((c) => [c.id, (c.features ?? []).map((f) => `${f.level}:${f.name}`)]),
    );
  const slots = (rows) => Object.fromEntries(rows.map((c) => [c.id, JSON.stringify(c.slots)]));
  return {
    fullBytes: full.bytes,
    slimBytes: slim.bytes,
    classes: full.rows.length,
    samePairs: JSON.stringify(pairs(full.rows)) === JSON.stringify(pairs(slim.rows)),
    sameSlots: JSON.stringify(slots(full.rows)) === JSON.stringify(slots(slim.rows)),
    sameIds:
      JSON.stringify(full.rows.map((c) => c.id)) === JSON.stringify(slim.rows.map((c) => c.id)),
    /*
     * The descriptions are what made the full file six megabytes, and a
     * sheet reads none of them. The slim copy keeps them for exactly one
     * kind of row — the CHOICES, and only the game's own — because a picker
     * that hands over a list of names and nothing else sends the person
     * holding it to a wiki.
     */
    textOnChoices: slim.rows.every((c) =>
      (c.features ?? []).every(
        (f) => !("text" in f) || (/^.{3,40}?:\s/.test(f.name) && !/\((HB|TP|UA)\)/.test(f.name)),
      ),
    ),
    described: slim.rows.reduce(
      (n, c) => n + (c.features ?? []).filter((f) => "text" in f).length, 0,
    ),
  };
});
ok("every class is in the slim file", sizes.sameIds, true);
ok("with the same feature names, at the same levels", sizes.samePairs, true);
ok("and the same slot table", sizes.sameSlots, true);
ok("carrying descriptions only where a choice is made", sizes.textOnChoices, true);
ok("which is a few hundred rows, not thirty thousand",
  sizes.described > 300 && sizes.described < 1200, true);
ok("which is most of the file",
  sizes.slimBytes < sizes.fullBytes / 5, true);
console.log(
  `      ${(sizes.fullBytes / 1e6).toFixed(2)} MB → ${(sizes.slimBytes / 1e6).toFixed(2)} MB ` +
  `across ${sizes.classes} classes`,
);

/* And the sheet still shows what the merge is FOR: names that exist only in
   the compendium, not in the SRD's own per-level table. */
await go(page, "sheet");
// Behind its own button since the sheet became a panel.
await page.getByRole("button", { name: /^Features, / }).click();
await page.waitForSelector(".feat-row", { timeout: 20000 });
// Grouped by the level that granted them, closed until asked, and only one
// open at a time — so they are collected one level at a time.
const chips = [];
for (const hd of await page.locator(".feat-hd").all()) {
  await hd.click();
  await page.waitForTimeout(100);
  chips.push(...(await page.locator(".feat-list .chip").allInnerTexts()));
  await hd.click();
  await page.waitForTimeout(60);
}
const feats = chips.join(" | ");
ok("a wizard's features are listed", feats.length > 0, true);
ok("including ones the SRD table does not carry",
  /Arcane Recovery|Spellcasting|Arcane Tradition/i.test(feats), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
