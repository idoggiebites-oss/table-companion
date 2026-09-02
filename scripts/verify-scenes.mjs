/* A place, prepared before anybody sat down, opened in one press.

   The DM's prep was three saved things that nothing joined up: an encounter
   here, a room set by hand there, and the line they meant to read in a
   notebook. This is the join — and the test is that ONE press does all three
   at once, because the failure it exists to prevent is a fight that starts in
   daylight it was supposed to start in the dark. */
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
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(300);
};
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1300 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}

const dm = await device("dm");
await dm.getByRole("button", { name: "The table", exact: true }).click();
await dm.getByRole("button", { name: "Start a room" }).click();
await dm.waitForSelector(".rb-code");
const code = await dm.locator(".rb-code").innerText();
await dm.getByRole("button", { name: "Load sample" }).click();
await dm.waitForSelector('select[aria-label="Seat"], .join-row');
await dm.selectOption('select[aria-label="Seat"]', "dm");
await dm.waitForSelector(".pm-name");

// --- the night before: something to put in the place ---------------------
await go(dm, "prep");
await dm.getByRole("button", { name: "Build" }).click();
await dm.waitForSelector('input[aria-label="Add a monster"]', { timeout: 20000 });
await dm.locator('input[aria-label="Add a monster"]').fill("goblin");
await dm.waitForSelector(".pick");
await dm.locator(".pick", { hasText: /^Goblin/ }).first().click();
await dm.waitForSelector(".ent");
await dm.locator('button[aria-label="One more Goblin"]').click();
await dm.locator('input[aria-label="Encounter name"]').fill("Cellar ghouls");
await dm.getByRole("button", { name: "Save for later" }).click();
await go(dm, "prep");

// --- and the place itself ------------------------------------------------
await dm.getByRole("button", { name: "Prepare one" }).click();
await dm.waitForSelector('input[aria-label="Place name"]');
await dm.locator('input[aria-label="Place name"]').fill("The cellar under the mill");
await dm.getByRole("button", { name: "Prepare light Dark" }).click();
await dm.getByRole("button", { name: "Prepare Difficult ground" }).click();
await dm.selectOption('select[aria-label="Encounter waiting"]', { label: "Cellar ghouls" });
await dm.locator('textarea[aria-label="Note"]')
  .fill("The stair gives under your weight. Something below stops moving.");
await dm.screenshot({ path: `${OUT}/S0-scene-draft.png`, fullPage: true });
await dm.getByRole("button", { name: "Keep it" }).click();
await dm.waitForSelector(".sc-row");

/* The row says what is IN the place. A list of names the DM chose tells them
   nothing they did not already know when they typed it. */
const row = (await dm.locator(".sc-row").first().innerText()).replace(/\s+/g, " ");
ok("the row names the place", row.includes("The cellar under the mill"), true);
ok("and says how dark it is", /dark/i.test(row), true);
ok("and what is waiting in it", row.includes("Cellar ghouls"), true);
ok("and that there is something to say", /a note/.test(row), true);
ok("without spilling the note itself", row.includes("stair gives"), false);

// --- a player arrives, knowing none of it --------------------------------
const player = await device("player");
await player.locator('input[aria-label="Room code"]').fill(code);
await player.getByRole("button", { name: "The table", exact: true }).click();
await player.getByRole("button", { name: "Join", exact: true }).click();
await player.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
const join = player.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
await player.waitForSelector(".hp-big", { timeout: 20000 });
await player.waitForTimeout(1200);

await go(player, "combat");
ok("nothing has been said about any room yet", await player.locator(".room-is").count(), 0);
ok("and no fight is waiting", await player.locator(".cbt").count(), 0);

/* Prep is prep. "Prepared the cellar · dark · a note" in the player's log is
   the DM's session read out loud a scene early. */
await go(player, "log");
const log = await player.locator(".feed").innerText();
ok("the player's log does not carry the prep", /prepared/i.test(log), false);
ok("nor the name of a place they have not walked into",
  /cellar/i.test(log), false);
await go(player, "combat");

// --- one press -----------------------------------------------------------
await dm.getByRole("button", { name: "Open The cellar under the mill" }).click();
await player.waitForTimeout(1500);

/* The note is for the DM, on the DM's screen, at the moment they need it. A
   note filed where it must be hunted for is a note that gets skipped. */
ok("the DM is holding the line to read",
  (await dm.locator(".sc-said").innerText()).includes("Something below stops moving"), true);
ok("and the player is not", await player.locator(".sc-said").count(), 0);
await dm.screenshot({ path: `${OUT}/S1-scene-live.png`, fullPage: true });
await player.screenshot({ path: `${OUT}/S2-scene-player.png`, fullPage: true });

await go(dm, "combat");
await dm.waitForSelector('input[aria-label$="initiative"]', { timeout: 20000 });

/* Rolling initiative is when there is TIME to talk about the room, and it is
   where opening a prepared place lands the DM. Both sides can see it there
   now: the DM to change it, the player because being told the room is pitch
   dark on your own turn is being told too late to do anything about it. */
await player.waitForTimeout(800);
ok("the player is told the room while initiative is still going round",
  /dark/i.test(await player.locator(".room-is").innerText()), true);
ok("and the DM can still change it before Begin",
  await dm.locator(".scene-hd").count(), 1);
/* Read off the roster rather than off the prompts: identical creatures roll
   as one group now, so the number of inputs says how the DM is asked, not
   who is in the fight. This assertion only ever meant the second. */
const inOrder = (await dm.locator(".init-waiting .chip").allInnerTexts())
  .map((t) => t.split("\n")[0].trim());
ok("what was waiting is already in the initiative order",
  inOrder.filter((n) => /^goblin/i.test(n)).length, 2);
ok("alongside the party", inOrder.some((n) => /kira vance/i.test(n)), true);
const staged = await Promise.all(
  (await dm.locator('input[aria-label$="initiative"]').all())
    .map(async (b) => (await b.getAttribute("aria-label")).replace(/ initiative$/, "")),
);

/* And the room the place carried is on the dice, not just in the header. The
   banner appears on the turn of whoever is acting in it. */
for (const [i, who] of staged.entries()) {
  await dm.locator(`input[aria-label="${who} initiative"]`).fill(String(20 - i));
  await dm.getByRole("button", { name: `Set ${who} initiative` }).click();
}
await dm.getByRole("button", { name: "Begin", exact: true }).click();
await player.waitForSelector(".pt.acting", { timeout: 20000 });
ok("and the DM's room control agrees with the place they opened",
  /dark/i.test(await dm.locator(".scene-hd").innerText()), true);
const fighting = await player.locator(".cbt .nm").allInnerTexts();
ok("the fight the place carried is the fight being run",
  fighting.filter((n) => n.startsWith("Goblin")).length, 2);
ok("the room stays put once the fight is running",
  /dark/i.test(await player.locator(".room-is").innerText()), true);
ok("with the ground they are fighting on",
  /difficult ground/i.test(await player.locator(".room-is").innerText()), true);

/* Opening a place is public — the table can see the room went dark — even
   though preparing it was not. */
await go(player, "log");
const after = await player.locator(".feed").innerText();
ok("the player's log says the room changed", /dark/i.test(after), true);

// --- and it is still there tomorrow --------------------------------------
const second = await device("second");
await second.locator('input[aria-label="Room code"]').fill(code);
await second.getByRole("button", { name: "The table", exact: true }).click();
await second.getByRole("button", { name: "Join", exact: true }).click();
await second.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
/* The table's own controls live in a sheet now — the header keeps the code
   and a dot, and everything pressed is behind the gear. "The room" is a
   different thing on this screen: the place the fight is in. */
await dm.getByRole("button", { name: "The table" }).click();
await dm.getByRole("button", { name: "DM key" }).click();
const dmKey = await dm.locator(".rm-key").innerText();
await dm.getByRole("button", { name: "Close The table" }).click();
await second.getByRole("button", { name: "The table" }).click();
await second.getByRole("button", { name: /I.m the DM/ }).click();
await second.locator('input[aria-label="DM key"]').fill(dmKey);
await second.getByRole("button", { name: "Claim DM" }).click();
await second.getByRole("button", { name: "Close The table" }).click();
await second.waitForTimeout(1200);
await second.selectOption('select[aria-label="Seat"]', "dm");
await second.waitForTimeout(600);
await go(second, "prep");
await second.waitForSelector(".sc-row", { timeout: 20000 });
ok("the place is on the DM's other device too",
  (await second.locator(".sc-row").first().innerText()).includes("The cellar under the mill"), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
