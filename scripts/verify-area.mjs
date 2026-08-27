/* A fireball across both sides of the table, applied in one pass and taken
   back in one undo. */
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
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1100 } });
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
await dm.page.waitForSelector(".seatbar");
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForSelector(".pm-name");

await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector(".seatbar", { timeout: 15000 });
await sitAs(player.page, "Kira Vance");
await player.page.waitForSelector(".hp-big", { timeout: 15000 });

// a fight with three goblins and the character
for (const [n, , hp] of [[1, 15, 12], [2, 14, 12], [3, 13, 12]]) {
  await go(dm.page, "combat");
await dm.page.getByRole("button", { name: "Add creature" }).click();
  await dm.page.locator(`input[aria-label="Creature ${n} name"]`).fill(`Goblin ${n}`);
  await dm.page.locator(`input[aria-label="Creature ${n} hp"]`).fill(String(hp));
}
// Initiative is rolled after staging now, not typed on the setup panel.
await dm.page.getByRole("button", { name: "Roll for initiative" }).click();
await dm.page.waitForSelector('input[aria-label="Kira Vance initiative"]');
/* Identical creatures roll as one group now, and "Goblin 1/2/3" are three of
   the same goblin however they were typed. This suite wants them at three
   different initiatives on purpose — which is exactly what Split is for. */
await dm.page.getByRole("button", { name: "Roll each Goblin separately" }).click();
await dm.page.waitForTimeout(300);
for (const [name, roll] of [["Kira Vance", 16], ["Goblin 1", 15], ["Goblin 2", 14], ["Goblin 3", 13]]) {
  await dm.page.locator(`input[aria-label="${name} initiative"]`).fill(String(roll));
  await dm.page.getByRole("button", { name: `Set ${name} initiative` }).click();
}
await dm.page.getByRole("button", { name: "Begin", exact: true }).click();
await dm.page.waitForSelector(".cbt");
await player.page.waitForSelector(".cbt", { timeout: 15000 });

// the player concentrates, so the blast has to owe them a save
await go(player.page, "sheet");
await player.page.locator('input[aria-label="Spell to concentrate on"]').fill("Hunter's Mark");
await player.page.getByRole("button", { name: "Concentrate", exact: true }).click();
await dm.page.waitForTimeout(700);

await dm.page.getByRole("button", { name: "Area damage" }).click();
await dm.page.waitForSelector(".area");
ok("every combatant is offered as a target", await dm.page.locator(".arow").count(), 4);
ok("nobody is in the blast until ticked", await dm.page.locator(".tick.on").count(), 0);

// two goblins and the character are caught; the character saves
await dm.page.locator('button[aria-label="Goblin 1 in the blast"]').click();
await dm.page.locator('button[aria-label="Goblin 2 in the blast"]').click();
await dm.page.locator('button[aria-label="Kira Vance in the blast"]').click();
await dm.page.locator('button[aria-label="Kira Vance saved"]').click();
ok("three in, one out", await dm.page.locator(".tick.on").count(), 3);
await dm.page.screenshot({ path: `${OUT}/24-area.png` });

await dm.page.getByRole("button", { name: /^Apply to 3$/ }).click();
await player.page.waitForTimeout(900);
await go(dm.page, "combat");

await go(dm.page, "combat");
ok("goblins in the blast dropped", await dm.page.locator(".cbt", { hasText: "Goblin 1" }).locator(".hp").innerText(), "0/12");
ok("the goblin left out is untouched", await dm.page.locator(".cbt", { hasText: "Goblin 3" }).locator(".hp").innerText(), "12/12");
ok("the character took half", (await player.page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "38 / 52");
ok("and owes a save against what they actually took",
  (await player.page.locator(".alarm-q").innerText()).replace(/\s+/g, " "), "A Constitution save is owed · DC 10");

await go(dm.page, "log");
const feed = (await dm.page.locator(".feed").innerText()).replace(/\s+/g, " ");
ok("the feed shows one line for the whole blast", feed.includes("Fireball · 28 fire · 3 targets · 1 saved"), true);

// one undo puts all of it back
await dm.page.locator(".fr", { hasText: "Fireball" }).first().getByRole("button", { name: "Undo" }).click();
await player.page.waitForTimeout(900);
await go(dm.page, "combat");
ok("one undo restored both goblins", await dm.page.locator(".cbt", { hasText: "Goblin 1" }).locator(".hp").innerText(), "12/12");
ok("and the character", (await player.page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "52 / 52");
ok("and cleared the save it owed", await player.page.locator(".alarm").count(), 0);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
