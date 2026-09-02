/* What happened last time.

   The log has held every session in full since the first commit and has never
   been readable: three hundred rows of "Kira took 7", newest first. This is
   the same events read forwards — and the test that matters is not that the
   card renders, it is that a PLAYER's recap is built from a player's log. The
   DM's prep must not arrive summarised. */
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
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
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

// Nothing has happened yet beyond a character arriving.
await go(dm, "log");
ok("an empty campaign has no recap to show", await dm.locator(".rc-said").count(), 0);

// --- a session ------------------------------------------------------------
// Prep first, which is exactly what a player must not read afterwards.
await go(dm, "prep");
await dm.getByRole("button", { name: "Prepare one" }).click();
await dm.locator('input[aria-label="Place name"]').fill("The cellar under the mill");
await dm.getByRole("button", { name: "Prepare light Dark" }).click();
await dm.getByRole("button", { name: "Prepare Difficult ground" }).click();
await dm.getByRole("button", { name: "Keep it" }).click();
await dm.waitForSelector(".sc-row");

const player = await device("player");
await player.locator('input[aria-label="Room code"]').fill(code);
await player.getByRole("button", { name: "The table", exact: true }).click();
await player.getByRole("button", { name: "Join", exact: true }).click();
await player.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
const join = player.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
await player.waitForSelector(".hp-big", { timeout: 20000 });

await dm.getByRole("button", { name: "Open The cellar under the mill" }).click();
await dm.waitForTimeout(800);
await go(dm, "combat");
await dm.getByRole("button", { name: "Add creature" }).click();
await dm.locator('input[aria-label="Creature 1 name"]').fill("Ghoul");
await dm.locator('input[aria-label="Creature 1 hp"]').fill("22");
await dm.getByRole("button", { name: "Roll for initiative" }).click();
await dm.waitForSelector('input[aria-label="Ghoul initiative"]');
for (const [n, v] of [["Kira Vance", 18], ["Ghoul", 7]]) {
  await dm.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await dm.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await dm.getByRole("button", { name: "Begin", exact: true }).click();
await dm.waitForTimeout(700);

// The night goes badly: Kira takes a beating and goes down.
const row = () => dm.locator(".pm", { hasText: "Kira Vance" }).first();
const hurt = async (n) => {
  await dm.locator('input[aria-label="Kira Vance amount"]').fill(String(n));
  await row().getByRole("button", { name: "Damage", exact: true }).click();
  await dm.waitForTimeout(400);
};
await go(dm, "party");
await hurt(19);
await hurt(40);
await dm.waitForTimeout(600);

/* Down, and rolling for it. The death saves are on the player's own sheet,
   because it is the player who rolls them. */
await go(player, "sheet");
await player.waitForSelector(".down-help", { timeout: 20000 });
for (const r of ["failure", "success", "success"]) {
  await player.getByRole("button", { name: r, exact: true }).click();
  await player.waitForTimeout(400);
}

await go(dm, "log");
await dm.waitForSelector(".rc-said", { timeout: 20000 });
const said = (await dm.locator(".rc-said").innerText()).replace(/\s+/g, " ");
ok("the recap opens with where they were", /You fought in dark, difficult ground/i.test(said), true);
ok("and names the fight", /one fight/i.test(said), true);
ok("and who took the worst of it", /landed on Kira Vance, for 40/.test(said), true);
/* The most human line in it. One failed save is not a death — the recap has
   to know the difference, because a table certainly does. */
ok("and that somebody hit the floor", /Kira Vance went down/.test(said), true);
ok("without burying anyone who got back up",
  /did not get back up/.test(said), false);

const nums = Object.fromEntries(
  await Promise.all(
    (await dm.locator(".rc-n").all()).map(async (n) => [
      (await n.locator(".label").innerText()).toLowerCase(),
      await n.locator(".num").innerText(),
    ]),
  ),
);
ok("with the numbers kept out of the prose", nums["damage taken"], "59");
ok("counted, not narrated", nums["fights"], "1");
await dm.screenshot({ path: `${OUT}/31-recap-dm.png`, fullPage: true });

// --- and the player's copy ------------------------------------------------
await go(player, "log");
await player.waitForSelector(".rc-said", { timeout: 20000 });
const theirs = (await player.locator(".rc-said").innerText()).replace(/\s+/g, " ");
/* The room is public — the table watched it go dark — and so is the damage a
   player took. The place the DM WROTE DOWN is not: "The cellar under the
   mill" was never said out loud. */
ok("a player gets the same night", /You fought in dark, difficult ground/i.test(theirs), true);
ok("and the same beating", /landed on Kira Vance, for 40/.test(theirs), true);
ok("without the DM's prep in it", /cellar/i.test(theirs), false);
ok("nor anything the DM did behind the screen",
  /prepared/i.test(await player.locator(".feed").innerText()), false);
await player.screenshot({ path: `${OUT}/32-recap-player.png`, fullPage: true });

/* --- and what to do about it ---------------------------------------------
   The recap reported and stopped. These are the prompts above it: a fact and
   the screen that settles it. The seam matters here as much as in the recap
   itself — the DM's half is about prep, and prep is exactly what a player
   must not be handed. */
const promptsOn = async (page) =>
  (await page.locator(".wn-said").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));

const dmSays = await promptsOn(dm);
/* The fight was never ended — it is the one thing genuinely unfinished, and
   nothing else on this screen says so. */
ok("the DM is told the fight is still running",
  dmSays.some((t) => /A fight is still running — round 1\./.test(t)), true);
/* A place was prepared at the top of this suite. Being told the drawer is
   empty when it is not is the failure mode this rule is one line away from. */
ok("and not that nothing is prepared, because something is",
  dmSays.some((t) => /Nothing is prepared/i.test(t)), false);
/* One fight, and the XP for it never handed out. The campaign is on XP —
   which is the default — so this is a thing left undone rather than the app
   arguing with a milestone DM's decision. */
ok("and about the fight nobody was paid for",
  dmSays.some((t) => /One fight, and no XP awarded\./.test(t)), true);
ok("and the prompt carries the way there",
  await dm.locator(".wn-row", { hasText: "still running" }).locator(".wn-to").innerText(),
  "THE FIGHT");
/* Every button in this app is uppercase, because every other one is a label.
   These are sentences, and the global rule shouted all six words of them. */
ok("read as sentences, not as signs",
  dmSays.every((t) => t !== t.toUpperCase()), true);

const theirPrompts = await promptsOn(player);
ok("a player is told where the beating left them",
  theirPrompts.some((t) => /You are on 0 of 52 hit points\./.test(t)), true);
ok("and never the DM's half of it",
  theirPrompts.some((t) => /prepared|stash|still running/i.test(t)), false);
await player.screenshot({ path: `${OUT}/33-prompts-player.png`, fullPage: true });

/* Pressing it goes where it says. A prompt that names a screen and lands on
   another is worse than no prompt: the next one does not get pressed. */
await player.locator(".wn-row", { hasText: "hit points" }).click();
await player.waitForTimeout(400);
ok("and pressing it opens that screen",
  await player.locator(".hp-big").count() > 0, true);
await go(player, "log");

/* One session so far, so there is nothing to go back to — and a button that
   goes nowhere says there is. */
ok("no way back on the first night",
  await dm.getByRole("button", { name: "An earlier session" }).count(), 0);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
