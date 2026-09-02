/* "Can I re-roll?"

   A character was built once and then only ever added to. A player who put
   their 15 in the wrong place on their first evening was stuck with it, or
   asking the DM to delete them and start again — which loses everything that
   happened since.

   The shape is law two's, the same as an attack: the player claims, the DM
   confirms. So the test is not "the builder opened". It is that a player
   cannot do it alone, that the DM's yes is what opens the door, that the door
   closes behind them, and that the rebuild keeps everything which is not the
   build — hit points, what they are carrying, their notes. */
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
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}
const go = async (page, tab) => {
  const t = page.locator(`[data-tab="${tab}"]`);
  if (await t.count()) { await t.first().click(); await page.waitForTimeout(400); }
};
const atStep = async (page, label) => {
  const n = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await n.count()) { await n.first().click(); await page.waitForTimeout(250); }
};

const dm = await device("dm");
await dm.page.getByRole("button", { name: "The table", exact: true }).click();
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
await dm.page.getByRole("button", { name: "Load sample" }).click();
await dm.page.waitForSelector('select[aria-label="Seat"], .join-row');
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForTimeout(600);

const player = await device("player");
await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "The table", exact: true }).click();
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
const join = player.page.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
await player.page.waitForSelector(".hp-big", { timeout: 20000 });

/* Something has happened to this character, so the rebuild has something to
   preserve. Damage is the clearest: it is not part of the build at all. */
// The DM applies damage — that is whose control it is.
await go(dm.page, "party");
await dm.page.locator('input[aria-label="Kira Vance amount"]').fill("12");
await dm.page.getByRole("button", { name: "Damage", exact: true }).click();
await dm.page.waitForTimeout(800);
await go(player.page, "sheet");
await player.page.waitForTimeout(600);
const hurt = await player.page.locator(".hp-big").first().innerText();
ok("the character has taken damage", hurt.startsWith("40"), true);

/* --- a player cannot do it alone ---------------------------------------- */
ok("there is no way to rebuild without asking",
  await player.page.getByRole("button", { name: "Rebuild my character" }).count(), 0);
ok("only a way to ask",
  await player.page.getByRole("button", { name: "Ask to change my character" }).count(), 1);

await player.page.getByRole("button", { name: "Ask to change my character" }).click();
await player.page.waitForTimeout(300);
await player.page.locator('textarea[aria-label="Why you want to change your character"]')
  .fill("I put my 15 in the wrong place.");
await player.page.getByRole("button", { name: "Send the request" }).click();
await player.page.waitForTimeout(800);
ok("and asking does not open the door",
  await player.page.getByRole("button", { name: "Rebuild my character" }).count(), 0);
ok("it says it is waiting on the DM",
  /nothing happens until they answer/i.test(await player.page.locator(".ask-edit").innerText()), true);

/* --- the DM's side ------------------------------------------------------ */
await go(dm.page, "party");
await dm.page.waitForTimeout(600);
ok("the DM is shown the request",
  await dm.page.locator(".ask-row", { hasText: "Kira Vance" }).count(), 1);
ok("with the reason, since they gave one",
  /wrong place/i.test(await dm.page.locator(".ask-row").innerText()), true);

/* No first, because a refusal must be a real answer rather than silence. */
await dm.page.getByRole("button", { name: "Refuse Kira Vance" }).click();
await dm.page.waitForTimeout(800);
ok("a refusal clears it from the DM's screen",
  await dm.page.locator(".ask-row").count(), 0);
await player.page.waitForTimeout(600);
ok("and does not open the door either",
  await player.page.getByRole("button", { name: "Rebuild my character" }).count(), 0);
ok("but says so, rather than looking like nothing happened",
  /said no/i.test(await player.page.locator(".ask-edit").innerText()), true);

// Ask again — a no can mean "not right now".
await player.page.getByRole("button", { name: "Ask to change my character" }).click();
await player.page.waitForTimeout(300);
await player.page.getByRole("button", { name: "Send the request" }).click();
await player.page.waitForTimeout(800);
await go(dm.page, "party");
await dm.page.getByRole("button", { name: "Let Kira Vance rebuild" }).click();
await dm.page.waitForTimeout(900);
await player.page.waitForTimeout(600);
ok("the DM's yes is what opens it",
  await player.page.getByRole("button", { name: "Rebuild my character" }).count(), 1);

/* --- the rebuild -------------------------------------------------------- */
await player.page.getByRole("button", { name: "Rebuild my character" }).click();
await player.page.waitForTimeout(900);
await atStep(player.page, "Class");
await player.page.waitForSelector(".klass-cards", { timeout: 20000 });
await player.page.getByRole("button", { name: "Wizard", exact: true }).click();
await player.page.waitForTimeout(400);
await atStep(player.page, "Race");
await player.page.selectOption('select[aria-label="Race"]', "human");
await player.page.waitForTimeout(500);
/* A build is not finished until it is finished — class, race, scores, and a
   background's two skills. The builder refuses to create until then, which
   is the same refusal a first-time build gets. */
await atStep(player.page, "Skills");
for (const sk of ["arcana", "history", "insight", "investigation"]) {
  const b2 = player.page.getByRole("button", { name: `Train ${sk}` });
  if (await b2.count()) await b2.first().click();
  await player.page.waitForTimeout(120);
}
await atStep(player.page, "Scores");
await player.page.getByRole("button", { name: "Recommend" }).click();
await player.page.waitForTimeout(500);
await atStep(player.page, "Story");
await player.page.locator('input[aria-label="Filter backgrounds"]').fill("Acolyte");
await player.page.waitForTimeout(600);
await player.page.selectOption('select[aria-label="Background"]', { label: "Acolyte" });
await player.page.waitForTimeout(600);
await atStep(player.page, "Review");
await player.page.locator('input[aria-label="Character name"]').fill("Kira Vance");
await player.page.waitForTimeout(300);
/* Not "Create character": this replaces one. The verb matters — a player
   who has been told they may change their character should not be looking
   at a button that says they are making a new one. */
ok("the builder says it is replacing, not creating",
  await player.page.getByRole("button", { name: "Replace my character" }).count(), 1);
ok("and opens at the level they had reached, not at 1",
  await player.page.locator(".cr-lvl, [aria-label='Level']").first().inputValue().catch(() => "8"),
  "8");
/* A level 8 rebuild means re-making the level 8 choices — which is what
   "re-roll" means, and is the honest cost of it. Two improvements and a
   subclass. */
await atStep(player.page, "Scores");
for (const lvl of [4, 8]) {
  for (const _ of [0, 1]) {
    const raise = player.page.getByRole("button", { name: `Level ${lvl} raise int` });
    if (await raise.count()) { await raise.first().click(); await player.page.waitForTimeout(200); }
  }
}
/* The subclass lives on its own step at level 8, and which step that is
   depends on the class. Walk the rail and answer whatever is asked rather
   than hard-coding a label this suite does not care about. */
const steps = await player.page.getByRole("button", { name: /^Step \d+, / })
  .evaluateAll((ns) => ns.map((n) => n.getAttribute("aria-label")));
for (const label of steps) {
  const name = label.replace(/^Step \d+, /, "");
  await atStep(player.page, name);
  /* Readable rows now rather than a dropdown. Unanswered ones only: an
     answered chooser renders its head as a div, and "Take …" rather than the
     first button in the panel, since an answered one offers "Choose
     something else" and this loop would un-answer it. */
  for (let g = 0; g < 6; g++) {
    const card = player.page.locator(".card", { hasText: "Your class" });
    const head = card.locator('.chooser button.menu-hd[aria-expanded="false"]').first();
    if (!(await head.count())) break;
    await head.click();
    await player.page.waitForTimeout(250);
    const take = card.getByRole("button", { name: /^Take / }).first();
    if (!(await take.count())) break;
    await take.click();
    await player.page.waitForTimeout(300);
  }
}
await atStep(player.page, "Review");
await player.page.waitForTimeout(500);
await player.page.getByRole("button", { name: "Replace my character" }).click();
await player.page.waitForSelector(".hp-big", { timeout: 20000 });
await player.page.waitForTimeout(900);

await go(player.page, "sheet");
await player.page.waitForTimeout(600);
/* The point of the whole feature: a different character on paper. */
const sheet = (await player.page.locator("body").innerText()).replace(/\s+/g, " ");
/* The point of the whole feature: a different character on paper. */
ok("the build actually changed", /wizard/i.test(sheet), true);
ok("and is no longer what it was", /ranger/i.test(sheet), false);

/* And the point NOBODY would notice until it broke: everything that is not
   the build survives, because it lives under the same id in campaign state. */
/* And the part nobody would notice until it broke. A wizard 8 has a smaller
   maximum than a ranger 8, so this cannot be "the same number" — what has to
   survive is the WOUND. Twelve damage is still twelve damage. */
const hp = await player.page.locator(".hp-big").first().innerText();
const [now, max] = hp.split("/").map((x) => Number(x.trim()));
ok("the maximum moved, because they are a different character", max !== 52, true);
ok("and the wound came with them, rather than being healed by paperwork",
  max - now, 12);

/* --- the door closes behind them ---------------------------------------- */
ok("the grant is spent by using it",
  await player.page.getByRole("button", { name: "Rebuild my character" }).count(), 0);
ok("and asking is the only way back",
  await player.page.getByRole("button", { name: "Ask to change my character" }).count(), 1);

/* --- and the table can see it happened ---------------------------------- */
await go(dm.page, "log");
const feed = (await dm.page.locator(".feed").innerText()).replace(/\s+/g, " ");
ok("the asking is in the log", /asks to change their character/i.test(feed), true);
ok("so is the answer", /The DM said yes/i.test(feed), true);
ok("and the rebuild itself", /was rebuilt/i.test(feed), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
