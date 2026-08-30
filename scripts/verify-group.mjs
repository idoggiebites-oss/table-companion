/* Rolling as a group, naming a creature, and taking a turn back.

   Three things Improved Initiative has that this did not, each of them a
   thing a table already does that the app was making harder:

   - The DMG rolls initiative once per group of identical monsters. The app
     asked for a number each: one player and six goblins is seven prompts,
     six of them filled with the same digits.
   - "Goblin 4" is enough to tell them apart in a list and not at a table.
   - Undo is complete and correct and lives in the Log tab, which is not
     where a DM is when they tap Next by mistake. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const dm = await ctx.newPage();
dm.on("pageerror", (e) => errors.push(`${e}`));
dm.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await dm.goto(URL, { waitUntil: "networkidle" });

await dm.getByRole("button", { name: "Start a room" }).click();
await dm.waitForSelector(".rb-code");
await dm.getByRole("button", { name: "Load sample" }).click();
await dm.waitForSelector('select[aria-label="Seat"], .join-row');
await dm.selectOption('select[aria-label="Seat"]', "dm");
await dm.waitForTimeout(700);
const go = async (tab) => {
  const t = dm.locator(`[data-tab="${tab}"]`);
  if (await t.count()) { await t.first().click(); await dm.waitForTimeout(400); }
};

// Six of a thing, typed by hand — a group does not need a catalogue.
await go("combat");
for (let i = 1; i <= 6; i++) {
  await dm.getByRole("button", { name: "Add creature" }).click();
  await dm.locator(`input[aria-label="Creature ${i} name"]`).fill("Goblin");
  await dm.locator(`input[aria-label="Creature ${i} hp"]`).fill("7");
}
await dm.getByRole("button", { name: "Roll for initiative" }).click();
await dm.waitForTimeout(500);

/* --- the measurement ---------------------------------------------------- */
const prompts = await dm.locator('input[aria-label$="initiative"]').count();
ok("one player and six goblins is two prompts, not seven", prompts, 2);
ok("and the group row says how many it speaks for",
  await dm.locator('input[aria-label="Goblin ×6 initiative"]').count(), 1);

/* The goblin on the roof genuinely is not with the others, so the group can
   be pulled apart in one press — and it must come apart into all six, not
   five and a remainder. */
ok("a group can be split", await dm.getByRole("button", { name: "Roll each Goblin separately" }).count(), 1);
await dm.getByRole("button", { name: "Roll each Goblin separately" }).click();
await dm.waitForTimeout(400);
ok("into one row each", await dm.locator('input[aria-label$="initiative"]').count(), 7);
ok("and the grouped row is gone",
  await dm.locator('input[aria-label="Goblin ×6 initiative"]').count(), 0);
// Back to grouped for the rest — restaging is the only way, so do it fresh.
await dm.getByRole("button", { name: "Cancel" }).click();
await dm.waitForTimeout(500);
for (let i = 1; i <= 6; i++) {
  await dm.getByRole("button", { name: "Add creature" }).click();
  await dm.locator(`input[aria-label="Creature ${i} name"]`).fill("Goblin");
  await dm.locator(`input[aria-label="Creature ${i} hp"]`).fill("7");
}
await dm.getByRole("button", { name: "Roll for initiative" }).click();
await dm.waitForTimeout(500);

await dm.locator('input[aria-label="Goblin ×6 initiative"]').fill("18");
await dm.getByRole("button", { name: "Set Goblin ×6 initiative" }).click();
await dm.waitForTimeout(500);
/* One number, six goblins. The chips are how every device sees who has
   rolled, so they are what proves it landed on all of them. */
/* Case-insensitive: innerText returns what is RENDERED, and these chips are
   uppercased in CSS. A /Goblin/ that matches nothing makes the next line's
   .every() pass on an empty set, so the count is asserted on its own. */
const chips = (await dm.locator(".init-waiting .chip.on").allInnerTexts())
  .filter((c) => /goblin/i.test(c));
ok("one roll settles the whole group", chips.length, 6);
ok("all of them on the same number",
  chips.filter((c) => /18/.test(c)).length, 6);
ok("and the player is still waiting on their own",
  await dm.locator('input[aria-label="Kira Vance initiative"]').count(), 1);

await dm.locator('input[aria-label="Kira Vance initiative"]').fill("12");
await dm.getByRole("button", { name: "Set Kira Vance initiative" }).click();
await dm.waitForTimeout(400);
await dm.getByRole("button", { name: "Begin", exact: true }).click();
await dm.waitForTimeout(800);

/* --- "the one with the net" --------------------------------------------- */
ok("the fight opens on a numbered goblin",
  await dm.locator(".cbt.on .nm").first().innerText(), "Goblin 1");
await dm.getByRole("button", { name: "Rename Goblin 1" }).click();
await dm.waitForTimeout(300);
await dm.locator('input[aria-label="New name for Goblin 1"]').fill("The one with the net");
await dm.getByRole("button", { name: /^Call it/ }).click();
await dm.waitForTimeout(600);
ok("a creature can be called what the table calls it",
  await dm.locator(".cbt.on .nm").first().innerText(), "The one with the net");
ok("and the others are untouched",
  await dm.locator('.cbt .nm', { hasText: /^Goblin \d$/ }).count(), 5);
/* A rename is an event like any other, so it is in the log and undoable —
   which is the difference between renaming and editing. */
await go("log");
ok("and it went through the log rather than around it",
  (await dm.locator(".feed, .fr").first().innerText()).includes("Now called"), true);
await go("combat");

/* --- back a turn -------------------------------------------------------- */
await go("log");
const before = await dm.locator(".fr").count();
await go("combat");
const whoFirst = await dm.locator(".cbt.on .nm").first().innerText();
await dm.getByRole("button", { name: "Next turn" }).click();
await dm.waitForTimeout(600);
const whoSecond = await dm.locator(".cbt.on .nm").first().innerText();
ok("Next turn moves the fight on", whoSecond !== whoFirst, true);
ok("and there is a way back without leaving the fight",
  await dm.getByRole("button", { name: "Back a turn" }).count(), 1);
await dm.getByRole("button", { name: "Back a turn" }).click();
await dm.waitForTimeout(700);
ok("which puts the turn back where it was",
  await dm.locator(".cbt.on .nm").first().innerText(), whoFirst);
await go("log");
const after = await dm.locator(".fr").count();

/* Undo, not a rewind. The feed deliberately does not print turn advances —
   it would be nothing but them — so what is checked is that going back took
   nothing away: everything that had happened is still listed afterwards. */
ok("going back removes nothing that happened", after >= before, true);
ok("including the rename from before the advance",
  (await dm.locator(".feed").innerText()).includes("Now called"), true);

/* And it composes, because each press appends its own marker rather than
   mutating a cursor. */
await go("combat");
await dm.getByRole("button", { name: "Next turn" }).click();
await dm.waitForTimeout(500);
await dm.getByRole("button", { name: "Back a turn" }).click();
await dm.waitForTimeout(600);
ok("a second correction works the same way",
  await dm.locator(".cbt.on .nm").first().innerText(), whoFirst);

/* --- and every one of these is thumb-sized -----------------------------

   The 44px rule has been broken three times, each time by something that
   looked like text rather than a control: 30px chips, 39px feat rows, an
   18px skills tick. A creature's name is exactly that shape. */
await go("combat");
const small = await dm.evaluate(() =>
  [...document.querySelectorAll(".cbt button, .init-row button, .turn-back")]
    .map((b) => ({ label: b.getAttribute("aria-label") ?? b.innerText, h: Math.round(b.getBoundingClientRect().height) }))
    .filter((x) => x.h > 0 && x.h < 44));
ok("nothing in the fight is smaller than a thumb", small, []);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
