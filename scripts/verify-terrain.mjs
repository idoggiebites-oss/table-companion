/* What the room is like.

   Everything else about a roll the app works out for itself. This is the one
   thing it cannot see and will not guess: where the fight is happening. The DM
   says it once, and every turn afterwards carries it. */
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
const player = await device("player");
await dm.getByRole("button", { name: "Start a room" }).click();
await dm.waitForSelector(".rb-code");
const code = await dm.locator(".rb-code").innerText();
await dm.getByRole("button", { name: "Load sample" }).click();
await dm.waitForSelector(".seatbar");
await dm.selectOption('select[aria-label="Seat"]', "dm");
await dm.waitForSelector(".pm-name");

await player.locator('input[aria-label="Room code"]').fill(code);
await player.getByRole("button", { name: "Join", exact: true }).click();
await player.waitForSelector(".seatbar", { timeout: 20000 });
const join = player.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
await player.waitForSelector(".hp-big", { timeout: 20000 });

await go(dm, "fight");
await dm.getByRole("button", { name: "Add creature" }).click();
await dm.locator('input[aria-label="Creature 1 name"]').fill("Goblin");
await dm.locator('input[aria-label="Creature 1 hp"]').fill("20");
await dm.getByRole("button", { name: "Roll for initiative" }).click();
await dm.waitForSelector('input[aria-label="Kira Vance initiative"]');
for (const [n, v] of [["Kira Vance", 20], ["Goblin", 5]]) {
  await dm.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await dm.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await dm.getByRole("button", { name: "Begin", exact: true }).click();
await player.waitForSelector(".pt.acting", { timeout: 20000 });
await go(player, "fight");

// --- nothing said, nothing changed ---------------------------------------
ok("a fight starts on open ground",
  /open ground/i.test(await dm.locator(".scene-hd").innerText()), true);
ok("and the player is told nothing about the room",
  await player.locator(".room-is").count(), 0);

const swing = async () => {
  await player.locator(".pt-atk").click();
  await player.waitForTimeout(400);
  if (/attacking with/i.test(await player.locator(".swing-step").innerText())) {
    await player.locator(".tgt-row").first().click();
    await player.waitForTimeout(300);
  }
  await player.locator(".tgt-row", { hasText: "Goblin" }).first().click();
  await player.waitForTimeout(400);
  const ask = (await player.locator(".swing-step").innerText()).replace(/\s+/g, " ");
  const why = await player.locator(".stance").count();
  return { ask, why: why ? await player.locator(".stance").innerText() : null };
};
const backOut = async () => {
  for (let i = 0; i < 3; i++) {
    const b = player.locator(".swing-step").getByRole("button", { name: /^(Back|Cancel)$/ });
    if ((await player.locator(".swing-step").count()) === 0 || (await b.count()) === 0) break;
    await b.first().click();
    await player.waitForTimeout(300);
  }
};
const first = await swing();
ok("so the swing is one plain d20", /Roll a d20 and add/.test(first.ask), true);
await backOut();

// --- the DM says what the room is ----------------------------------------
await dm.getByRole("button", { name: "The room" }).click();
await dm.waitForTimeout(400);
await dm.getByRole("button", { name: "Light Dark" }).click();
await dm.waitForTimeout(300);
await dm.getByRole("button", { name: "Difficult ground" }).click();
await dm.waitForTimeout(300);
await dm.getByRole("button", { name: "Strong wind" }).click();
await player.waitForTimeout(1200);
await dm.screenshot({ path: `${OUT}/P0-room-dm.png`, fullPage: true });

ok("it reaches the player without them asking",
  /dark/i.test(await player.locator(".room-is").innerText()), true);
ok("naming every part of it",
  /difficult ground/i.test(await player.locator(".room-is").innerText()), true);

/* Difficult ground is the rule everybody knows and forgets, because the DM
   says it on one screen and the number it touches is on another. */
const mv = await player.locator(".mv-acts button").first().innerText();
ok("and the movement buttons say what a foot now costs", /×2/.test(mv), true);
const before = Number(await player.locator(".mv-n .num").innerText());
await player.locator(".mv-acts button").first().click();
await player.waitForTimeout(600);
const after = Number(await player.locator(".mv-n .num").innerText());
ok("five feet of rubble spends ten", before - after, 10);

// --- and the roll knows ---------------------------------------------------
const second = await swing();
ok("the swing is now two dice, take the lower",
  /Roll two d20s and take the lower/.test(second.ask), true);
ok("and says the room is why", /dark/i.test(second.why ?? ""), true);
await player.screenshot({ path: `${OUT}/P1-room-player.png`, fullPage: true });
await backOut();

/* Wind troubles arrows and not swords, and the sample character's longbow is
   a hand-typed attack that states no reach — so the app reads it as melee and
   correctly leaves the wind out of it. Which range each fact touches is the
   domain's question and is tested there; what belongs here is a fact that
   touches BOTH, so the room's contribution is visible either way. */
await dm.getByRole("button", { name: "Fog or smoke" }).click();
await player.waitForTimeout(1200);
const fogged = await swing();
ok("fog troubles the swing whatever it is",
  /cannot see through it/i.test(fogged.why ?? ""), true);
ok("alongside the dark, both named", /dark/i.test(fogged.why ?? ""), true);
await backOut();

// --- and it can be taken back --------------------------------------------
await dm.getByRole("button", { name: "Clear the room" }).click();
await player.waitForTimeout(1200);
ok("clearing it clears it everywhere", await player.locator(".room-is").count(), 0);
const third = await swing();
ok("and the swing is a plain d20 again", /Roll a d20 and add/.test(third.ask), true);
await backOut();

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
