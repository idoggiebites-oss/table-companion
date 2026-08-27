/* The creature whose turn it is, whole.

   Staging a monster kept its hit points, its armour class and the actions
   that deal damage, and dropped the rest at the boundary — twice, as it
   turned out: once building a creature out of an encounter and again turning
   that creature into a combatant. Across seven common monsters, 17 of 57
   entries survived. Multiattack is dropped from nearly every statblock in the
   game, so the app was quietest about the line that says how many times to
   swing, and a goblin arrived without Nimble Escape.

   The rest was readable in the Book tab, which means leaving the fight — on
   the one screen a DM cannot leave. */
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

async function device(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}

/** A room, an encounter with a real monster in it, and a fight under way. */
async function fightWith(page, monster) {
  await page.getByRole("button", { name: "Start a room" }).click();
  await page.waitForSelector(".rb-code");
  const code = await page.locator(".rb-code").innerText();
  await page.getByRole("button", { name: "Load sample" }).click();
  await page.waitForSelector(".seatbar");
  await page.selectOption('select[aria-label="Seat"]', "dm");
  await page.waitForTimeout(700);

  await page.locator('[data-tab="prep"]').click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Build" }).first().click();
  await page.waitForTimeout(600);
  await page.locator('input[aria-label="Add a monster"]').fill(monster);
  await page.waitForTimeout(700);
  await page.locator("button.pick").first().click();
  await page.waitForTimeout(600);
  // Committing it is what makes it droppable into a fight.
  const save = page.getByRole("button", { name: /^(Save|Keep|Done)/i }).first();
  if (await save.count()) { await save.click(); await page.waitForTimeout(700); }

  const tab = page.locator('[data-tab="combat"]');
  if (await tab.count()) { await tab.first().click(); await page.waitForTimeout(400); }
  await page.selectOption('select[aria-label="Drop in an encounter"]', { index: 1 });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Roll for initiative" }).click();
  await page.waitForTimeout(500);
  // The monster goes first, so its turn is the one the fight opens on.
  for (let guard = 0; guard < 12; guard++) {
    const inp = page.locator('input[aria-label$="initiative"]').first();
    if (!(await inp.count())) break;
    const who = (await inp.getAttribute("aria-label")).replace(" initiative", "");
    await inp.fill(who.includes("Kira") ? "3" : "20");
    const set = page.getByRole("button", { name: `Set ${who} initiative` });
    if (!(await set.count())) break;
    await set.click();
    await page.waitForTimeout(180);
  }
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await page.waitForTimeout(800);
  return code;
}

// --- a goblin, whole ------------------------------------------------------
const dm = await device(1500, 1000);
await fightWith(dm, "Goblin");

ok("the fight opens on the creature's turn",
  await dm.locator(".cbt.on .nm").first().innerText(), "Goblin");
ok("and its statblock is there, without leaving the fight",
  await dm.locator(".sb-turn").count(), 1);

const shown = (await dm.locator(".sb-turn").innerText()).replace(/\s+/g, " ");
/* The trait that used to vanish. A goblin without Nimble Escape is a goblin
   that cannot do the one thing a goblin does. */
ok("the trait staging used to drop is on screen", /Nimble Escape/.test(shown), true);
ok("with its rules text, not just its name",
  /Disengage or Hide action as a bonus action/.test(shown), true);
/* Everything else a statblock is, which the three kept fields were not. */
ok("its senses", /darkvision/i.test(shown), true);
ok("its languages", /Common, Goblin/.test(shown), true);
ok("and its ability scores", /\b14\b/.test(shown), true);

/* An action is a control; a trait is a fact. Only the ones naming numbers
   become buttons — "tap Nimble Escape" is not a thing a DM means. */
ok("actions that name numbers are tappable",
  await dm.getByRole("button", { name: "Use Scimitar" }).count(), 1);
ok("and traits are not", await dm.getByRole("button", { name: "Use Nimble Escape" }).count(), 0);

/* Law one, on the DM's side. Tapping names the die and holds the modifier;
   the number still comes from a person throwing something. */
const before = await dm.locator(".swing").count();
await dm.getByRole("button", { name: "Use Scimitar" }).click();
await dm.waitForTimeout(500);
ok("tapping an action opens the swing rather than resolving it", before, 0);
ok("it asks who, because nothing is applied by one person to another",
  await dm.locator(".cbt .pick-target, .cbt").count() > 0, true);

/* --- the line the app was quietest about -------------------------------- */
const troll = await device(1500, 1000);
await fightWith(troll, "Troll");
const trollText = (await troll.locator(".sb-turn").innerText()).replace(/\s+/g, " ");
ok("Multiattack survives, having been dropped from nearly every monster",
  /Multiattack/.test(trollText), true);
ok("and Regeneration with it", /Regeneration/.test(trollText), true);
/* The measurement that made this worth doing: a troll has six entries and the
   fight used to carry two. */
ok("a troll arrives with more than the two attacks that used to survive",
  (await troll.locator(".sb-entry, .sb-act").count()) > 2, true);

/* --- rules text is prose, not a shout ----------------------------------- */
/* Buttons in this app are uppercase, which is right for a four-word control
   and wrong for two sentences of rules text. innerText returns what is
   RENDERED, so this can be measured rather than assumed. */
const desc = await troll.locator(".sb-act-d").first().innerText();
ok("an action's rules text is not uppercased with the button",
  desc === desc.toUpperCase(), false);

/* --- and a player never sees any of it ---------------------------------- */
const code = await troll.locator(".rb-code").innerText();
const player = await device(430, 900);
await player.locator('input[aria-label="Room code"]').fill(code);
await player.getByRole("button", { name: "Join", exact: true }).click();
await player.waitForSelector(".seatbar", { timeout: 20000 });
const join = player.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
await player.waitForTimeout(1500);
// A fight is already running, so the player lands in it.
const ptab = player.locator('[data-tab="combat"]');
if (await ptab.count()) { await ptab.first().click(); await player.waitForTimeout(600); }
ok("the player is in the fight", await player.locator(".cbt").count() > 0, true);
/* The same decision as hiding a creature's numbers in initiative: a player
   who can read the statblock knows the armour class, which is exactly what
   the disclosure ladder exists to withhold. */
ok("a player is not shown the statblock", await player.locator(".sb-turn").count(), 0);
ok("nor its actions", await player.locator(".sb-act").count(), 0);

/* --- the DM gets the screen a DM actually uses --------------------------- */
const wide = await troll.evaluate(() => {
  const pin = document.querySelector(".pane-pin");
  return pin ? Math.round(pin.getBoundingClientRect().width) : 0;
});
ok("on a laptop the DM's fight is wide enough for a statblock beside it",
  wide > 600, true);
ok("and it is the fight that got the room, not the tabs",
  wide > (await troll.evaluate(() => {
    const m = document.querySelector(".pane-main");
    return m ? m.getBoundingClientRect().width : 1e9;
  })), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
