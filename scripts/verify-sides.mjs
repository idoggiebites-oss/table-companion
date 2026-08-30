/* Damage crossing sides: the DM edits a player's sheet from the party view,
   the player sees it, and the feed says who did it. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = got === want;
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

/** Sections are tabs now; content is one tap away rather than a scroll. */
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}

const dm = await device("dm");
const player = await device("player");

await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
await dm.page.getByRole("button", { name: "Load sample" }).click();
await dm.page.waitForSelector('select[aria-label="Seat"], .join-row');
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForSelector(".pm-name");

await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 15000 });
await sitAs(player.page, "Kira Vance");
await player.page.waitForSelector(".hp-big", { timeout: 15000 });

ok("dm sees the party rather than a sheet", await dm.page.locator(".hp-big").count(), 0);
ok("dm sees the character in the party", await dm.page.locator(".pm-name").innerText(), "Kira Vance");
await dm.page.screenshot({ path: `${OUT}/22-party.png` });

// the DM narrates and types, without the player touching anything
await dm.page.locator('input[aria-label="Kira Vance amount"]').fill("12");
await dm.page.locator(".pm").getByRole("button", { name: "Damage" }).click();
await player.page.waitForTimeout(900);
ok("dm's damage reached the player's sheet",
  (await player.page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "40 / 52");
ok("dm sees it in the party view",
  (await dm.page.locator(".pm-hp").innerText()).replace(/\s+/g, " "), "40 / 52");

// and the feed says who
await go(dm.page, "log");
const dmFeed = (await dm.page.locator(".feed").innerText()).replace(/\s+/g, " ");
ok("feed attributes the DM", dmFeed.includes("Kira Vance took 12 DM"), true);
await go(player.page, "log");
const playerFeed = (await player.page.locator(".feed").innerText()).replace(/\s+/g, " ");
ok("player's feed shows the same attribution", playerFeed.includes("took 12 DM"), true);

// a player's own change is signed with their name
await go(player.page, "sheet");
await player.page.locator(".controls input").first().fill("4");
await player.page.getByRole("button", { name: "Heal", exact: true }).click();
await dm.page.waitForTimeout(900);
await go(dm.page, "party");
ok("player's heal reached the dm", (await dm.page.locator(".pm-hp").innerText()).replace(/\s+/g, " "), "44 / 52");
// A player's own action is NOT signed — a signature is for when someone else
// changed your sheet, and signing yourself is noise on every row.
await go(dm.page, "log");
ok("a player's own action is not signed",
  (await dm.page.locator(".feed").innerText()).replace(/\s+/g, " ").toLowerCase()
    .includes("kira vance healed 4 kira vance"), false);
ok("the row is still there",
  (await dm.page.locator(".feed").innerText()).replace(/\s+/g, " ").includes("healed 4"), true);
await player.page.screenshot({ path: `${OUT}/23-player-after-dm.png` });

// the party view carries state the DM needs at a glance
await player.page.locator('input[aria-label="Spell to concentrate on"]').fill("Hunter's Mark");
await player.page.getByRole("button", { name: "Concentrate", exact: true }).click();
await dm.page.waitForTimeout(900);
await go(dm.page, "party");
ok("dm sees concentration", (await dm.page.locator(".pm-meta .chip.conc").first().innerText()).toLowerCase(), "hunter's mark");

// damage from the DM owes the player a save, on the player's device
await dm.page.locator('input[aria-label="Kira Vance amount"]').fill("22");
await dm.page.locator(".pm").getByRole("button", { name: "Damage" }).click();
await player.page.waitForTimeout(900);
ok("the save is owed on the player's screen", await player.page.locator(".alarm").count(), 1);
ok("dm can see a save is owed too",
  (await dm.page.locator(".pm-meta").innerText()).toLowerCase().includes("save owed · dc 11"), true);

// undo from the DM reaches back across
await go(dm.page, "log");
await dm.page.locator(".fr", { hasText: "took 22" }).first().getByRole("button", { name: "Undo" }).click();
await player.page.waitForTimeout(900);
ok("undo cleared the save on the player", await player.page.locator(".alarm").count(), 0);
ok("undo restored the hit points",
  (await player.page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "44 / 52");

// --- what the player's log may say ---------------------------------------
// The log is the same on every device, which was quietly taken to mean
// everyone READS the same events — and a player's screen was printing the
// DM's prep, which undoes the disclosure ladder from behind.
await go(dm.page, "prep");
await dm.page.getByRole("button", { name: "Add someone" }).click();
await dm.page.locator('input[aria-label="NPC name"]').fill("Halbrek the Traitor");
await dm.page.getByRole("button", { name: "Save", exact: true }).click();
await dm.page.waitForTimeout(1400);

await go(player.page, "log");
const playerLog = (await player.page.locator(".feed").innerText()).replace(/\s+/g, " ");
ok("a player does not read the DM's prep", /Halbrek/i.test(playerLog), false);
await go(dm.page, "log");
ok("but the DM does",
  /Halbrek/i.test((await dm.page.locator(".feed").innerText())), true);

// And cannot take back what they did not do.
const dmRow = player.page.locator(".fr", { hasText: /took 12/i }).first();
ok("a player cannot undo the DM's action",
  await dmRow.getByRole("button", { name: /Undo/i }).count(), 0);
const own = player.page.locator(".fr", { hasText: /healed 4/i }).first();
ok("but can undo their own",
  await own.getByRole("button", { name: /Undo/i }).count(), 1);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
