/* Four megabytes, fetched at the right moment — and six that are not fetched
   at all.

   The spellbook is needed the instant a spell is pointed at something, and
   until it lands the aim screen can only say "looking up what it does". It
   used to start loading when the turn panel mounted — which is after the
   fight has BEGUN, when somebody is already waiting on it. A fight is staged
   a good minute earlier, while people are typing initiative rolls, and
   nothing is happening on the wire in between.

   Measured as requests on the wire rather than as a screen that eventually
   fills in: a spinner that resolves quickly is what this looked like before. */
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
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(300);
};
const spellHits = [];
const pulled = [];
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1300 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  // Every request for the book, whoever made it — and everything else the
  // device pulls, weighed.
  page.on("request", (r) => {
    if (/\/content\/spell\.json/.test(r.url())) spellHits.push(name);
  });
  page.on("response", async (r) => {
    if (!/\/(content|srd)\//.test(r.url())) return;
    let bytes = 0;
    try { bytes = (await r.body()).length; } catch { bytes = 0; }
    pulled.push({ who: name, file: r.url().split("/").slice(-2).join("/"), bytes });
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}
const hitsFrom = (name) => spellHits.filter((n) => n === name).length;

const dm = await device("dm");
await dm.getByRole("button", { name: "Start a room" }).click();
await dm.waitForSelector(".rb-code");
const code = await dm.locator(".rb-code").innerText();
await dm.getByRole("button", { name: "Load sample" }).click();
await dm.waitForSelector(".seatbar");
await dm.selectOption('select[aria-label="Seat"]', "dm");
await dm.waitForSelector(".pm-name");

const player = await device("player");
await player.locator('input[aria-label="Room code"]').fill(code);
await player.getByRole("button", { name: "Join", exact: true }).click();
await player.waitForSelector(".seatbar", { timeout: 20000 });
const join = player.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
await player.waitForSelector(".hp-big", { timeout: 20000 });
await go(player, "combat");
await player.waitForTimeout(1500);

/* Kira is a ranger with slots, so she is a caster — and out of a fight the
   book is still four megabytes nobody asked for. */
ok("nothing is fetched before a fight", hitsFrom("player"), 0);

/* And what IS fetched on load, weighed.

   The sheet prints a list of class feature names. It used to pay 6.3MB of
   feature descriptions for them, on every player's device, because the names
   and the text ship in one file. They ship in two now — and the number below
   is the one that would quietly grow again. */
const load = pulled.filter((p) => p.who === "player");
const megabytes = load.reduce((n, p) => n + p.bytes, 0) / 1e6;
console.log(`      ${load.map((p) => `${p.file} ${(p.bytes / 1e6).toFixed(2)}MB`).join(", ")}`);
ok("a player's device does not pull the class descriptions",
  load.some((p) => p.file.endsWith("content/class.json")), false);
/* Nor the slim copy, until somebody asks for it: the feature list moved
   behind a press when the sheet became a panel, so a session that never
   opens it never pays for it. */
ok("nor the class tables at all, before anybody opens their features",
  load.some((p) => p.file.includes("class")), false);
ok("and the whole load is under three megabytes", megabytes < 3, true);

await go(player, "sheet");
await player.getByRole("button", { name: /^Features, / }).click();
await player.waitForTimeout(1500);
const after = pulled.filter((p) => p.who === "player");
ok("opening them pulls the slim file, not the six-megabyte one",
  after.some((p) => p.file.endsWith("content/class-index.json"))
  && !after.some((p) => p.file.endsWith("content/class.json")), true);
await go(player, "combat");

// --- staged, not begun ---------------------------------------------------
await go(dm, "combat");
await dm.getByRole("button", { name: "Add creature" }).click();
await dm.locator('input[aria-label="Creature 1 name"]').fill("Goblin");
await dm.locator('input[aria-label="Creature 1 hp"]').fill("20");
await dm.getByRole("button", { name: "Roll for initiative" }).click();
await dm.waitForSelector('input[aria-label="Kira Vance initiative"]');
await player.waitForTimeout(2500);

ok("the book is on the wire as soon as the fight is staged", hitsFrom("player") >= 1, true);
ok("and the fight has not begun yet",
  await player.locator(".pt.acting").count(), 0);
/* The DM has the monsters, not the spellbook. Prefetching it on every device
   in the room is how you spend twenty megabytes on a table of five. */
ok("the DM's device does not pull it", hitsFrom("dm"), 0);

// --- and it is not fetched twice -----------------------------------------
for (const [n, v] of [["Kira Vance", 20], ["Goblin", 5]]) {
  await dm.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await dm.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await dm.getByRole("button", { name: "Begin", exact: true }).click();
await player.waitForSelector(".pt.acting", { timeout: 20000 });
await player.waitForTimeout(1500);

/* Once per device, not once per phase. The loader memoises, and the turn
   panel mounting is now the SECOND thing that would have asked for it. */
ok("the fight beginning does not ask for it again", hitsFrom("player"), 1);

/* And the turn opens on the actions rather than on a spinner. The sample
   ranger knows no spells, so what is asserted here is that the book is not
   what the turn is waiting for — the casting path itself is the spell
   suite's job, where there is a wizard with a spell list. */
await player.getByRole("button", { name: /What else can I do/i }).click();
await player.waitForTimeout(500);
ok("and the turn's actions are all there",
  (await player.locator(".hot").count()) > 0, true);
ok("with nothing still on the wire", hitsFrom("player"), 1);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
