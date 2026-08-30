/* Help, end to end.

   Help is a thing you do FOR somebody, and the sample table had one person in
   it — so the browser suite could only prove the step existed and said
   "nobody else is in this fight" honestly. Everything past that sentence was
   unreachable: naming an ally, spending the action, the tag landing on them,
   and their next attack rolling two dice because of it.

   With a second character there is somebody to help, and the whole chain can
   be walked: helper spends an action, the helped one is told WHY they are
   rolling two, and the tag dies when their turn opens — Help is "until your
   next turn" and an advantage that outlives its moment is a bug nobody
   notices. */
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
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}
const go = async (page, tab) => {
  const t = page.locator(`[data-tab="${tab}"]`);
  if (await t.count()) { await t.first().click(); await page.waitForTimeout(350); }
};

// --- a table of two -------------------------------------------------------
const dm = await device("dm");
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
await dm.page.getByRole("button", { name: "Load sample" }).click();
await dm.page.waitForSelector('select[aria-label="Seat"], .join-row');
/* The ally is a separate press, on purpose: "load the sample" means one known
   character on twenty screens, and quietly making it two would change what
   every one of them is showing. */
// The sample panel folds away once a character exists; Add character opens it.
await dm.page.getByRole("button", { name: "This device" }).click();
await dm.page.getByRole("button", { name: "Add character" }).click();
await dm.page.waitForTimeout(400);
await dm.page.getByRole("button", { name: "Add an ally" }).click();
await dm.page.waitForTimeout(700);
const cancel = dm.page.getByRole("button", { name: "Cancel" });
if (await cancel.count()) { await cancel.first().click(); await dm.page.waitForTimeout(400); }
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForTimeout(500);
ok("there are two people at the table now",
  await dm.page.locator(".pm-name").count(), 2);

// Two players, one each.
const kira = await device("kira");
const bram = await device("bram");
for (const [d, who] of [[kira, "Kira Vance"], [bram, "Bram Holt"]]) {
  await d.page.locator('input[aria-label="Room code"]').fill(code);
  await d.page.getByRole("button", { name: "Join", exact: true }).click();
  await d.page.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
  const row = d.page.locator(".join-row", { hasText: who });
  if (await row.count()) await row.first().click();
  await d.page.waitForSelector(".hp-big", { timeout: 20000 });
}
ok("and each device is holding one of them",
  (await bram.page.locator(".hp-big").first().innerText()).startsWith("68"), true);

// --- a fight where Bram goes first ---------------------------------------
await go(dm.page, "combat");
await dm.page.getByRole("button", { name: "Add creature" }).click();
await dm.page.locator('input[aria-label="Creature 1 name"]').fill("Ogre");
await dm.page.locator('input[aria-label="Creature 1 hp"]').fill("59");
await dm.page.getByRole("button", { name: "Roll for initiative" }).click();
await dm.page.waitForTimeout(500);
for (const [who, roll] of [["Bram Holt", 20], ["Kira Vance", 15], ["Ogre", 5]]) {
  await dm.page.locator(`input[aria-label="${who} initiative"]`).fill(String(roll));
  await dm.page.getByRole("button", { name: `Set ${who} initiative` }).click();
  await dm.page.waitForTimeout(150);
}
await dm.page.getByRole("button", { name: "Begin", exact: true }).click();
await dm.page.waitForTimeout(900);
ok("Bram is up first", await dm.page.locator(".cbt.on .nm").first().innerText(), "Bram Holt");

// --- the whole point ------------------------------------------------------
await go(bram.page, "combat");
await bram.page.getByRole("button", { name: "What else can I do?" }).click();
await bram.page.waitForTimeout(300);
await bram.page.getByRole("button", { name: "Help", exact: true }).click();
await bram.page.waitForTimeout(250);
await bram.page.getByRole("button", { name: "Do it" }).click();
await bram.page.waitForTimeout(400);
const step = () => bram.page.locator(".swing-step");
ok("Help asks who", /who are you helping/i.test(await step().innerText()), true);
/* The sentence this suite exists to stop being the only outcome. */
ok("and there is somebody to help",
  /nobody else is in this fight/i.test(await step().innerText()), false);
ok("named, on a row you can press",
  await step().getByRole("button", { name: "Kira Vance" }).count(), 1);
await step().getByRole("button", { name: "Kira Vance" }).click();
await bram.page.waitForTimeout(700);

/* It costs Bram his action — Help is an action, and a Help that cost nothing
   would be the best move in the game. */
await dm.page.waitForTimeout(600);
ok("helping spends the helper's action",
  await bram.page.getByRole("button", { name: "Help", exact: true }).count(), 0);

// --- and Kira is told why she is rolling two ------------------------------
await dm.page.getByRole("button", { name: "Next turn" }).click();
await dm.page.waitForTimeout(900);
ok("it is Kira's turn", await dm.page.locator(".cbt.on .nm").first().innerText(), "Kira Vance");
await go(kira.page, "combat");
await kira.page.waitForTimeout(600);
await kira.page.getByRole("button", { name: /^Attack/ }).first().click();
await kira.page.waitForTimeout(400);
// Which weapon first, then who with it.
await kira.page.getByRole("button", { name: /longbow/i }).first().click();
await kira.page.waitForTimeout(400);
const ogre = kira.page.locator(".tgt-row", { hasText: /ogre/i }).first();
if (await ogre.count()) { await ogre.click(); await kira.page.waitForTimeout(700); }
const said = await kira.page.locator(".swing-step").innerText().catch(() => "");
ok("she is told to roll two and take the higher",
  /two d20s and take the higher/i.test(said), true);
/* Named, not just applied. "Advantage: someone is helping you" teaches the
   rule while it is being used; "advantage" alone teaches nothing. */
ok("and told who is doing it for her", /someone is helping you/i.test(said), true);

/* --- and it expires off the HELPER's turn, not the helped one's ----------

   This is the half that was broken, and it was broken in the direction that
   makes the feature do nothing: `advance` cleared every tag on the creature
   whose turn was opening, so being helped and then having your go deleted
   the advantage one instant before it could apply. Help had never once
   worked.

   The rule times it off the helper: "before the start of YOUR next turn". So
   the order goes round to Bram, and only then does Kira stop rolling two. */
// Left mid-swing on purpose: the turn moving on is what closes it, and a
// player who walks away from a prompt is the ordinary case.
for (const _ of [0, 1]) {
  await dm.page.getByRole("button", { name: "Next turn" }).click();
  await dm.page.waitForTimeout(800);
}
ok("the order comes back round to the helper",
  await dm.page.locator(".cbt.on .nm").first().innerText(), "Bram Holt");

await dm.page.getByRole("button", { name: "Next turn" }).click();
await dm.page.waitForTimeout(900);
// She was left mid-swing; leaving the tab and coming back is what a person
// does, and it remounts her turn at the top.
await go(kira.page, "sheet");
await go(kira.page, "combat");
await kira.page.waitForTimeout(700);
await kira.page.getByRole("button", { name: /^Attack/ }).first().click();
await kira.page.waitForTimeout(400);
await kira.page.getByRole("button", { name: /longbow/i }).first().click();
await kira.page.waitForTimeout(400);
const again = kira.page.locator(".tgt-row", { hasText: /ogre/i }).first();
if (await again.count()) { await again.click(); await kira.page.waitForTimeout(700); }
const later = await kira.page.locator(".swing-step").innerText().catch(() => "");
ok("and by her next turn the help is spent", /take the higher/i.test(later), false);
ok("so it is one d20 again", /roll a d20/i.test(later), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
