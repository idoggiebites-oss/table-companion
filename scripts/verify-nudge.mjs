/* Whose phone should ring, and when.

   The delivery path is verified in verify-push.mjs. What is verified here is
   the decision: the device that appends the events works out who is being
   waited for, and sends exactly that — no more. Read off the socket, because
   a nudge that is never sent and a nudge that is sent to nobody look the same
   from the screen. */
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

const sent = [];
async function device(name, watchSocket = false) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1300 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  if (watchSocket) {
    page.on("websocket", (ws) => {
      ws.on("framesent", ({ payload }) => {
        try {
          const msg = JSON.parse(String(payload));
          if (msg.t === "nudge") sent.push(...msg.nudges);
        } catch {
          // Not one of ours.
        }
      });
    });
  }
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}

const dm = await device("dm", true);
await dm.getByRole("button", { name: "Start a room" }).click();
await dm.waitForSelector(".rb-code");
const code = await dm.locator(".rb-code").innerText();
await dm.getByRole("button", { name: "Load sample" }).click();
await dm.waitForSelector('select[aria-label="Seat"], .join-row');
await dm.selectOption('select[aria-label="Seat"]', "dm");
await dm.waitForSelector(".pm-name");

const player = await device("player");
await player.locator('input[aria-label="Room code"]').fill(code);
await player.getByRole("button", { name: "Join", exact: true }).click();
await player.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
const join = player.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
await player.waitForSelector(".hp-big", { timeout: 20000 });
/* The character id as the PLAYER's device holds it — a nudge is addressed to
   one, and it is the player's claim that decides which. Device-local state
   lives in IndexedDB here, not localStorage: it never enters the log. */
const kira = await player.evaluate(async () => {
  const build = document.querySelector(".seatbar select");
  const chosen = build instanceof HTMLSelectElement ? build.value : "";
  // The seat control's value carries a prefix; the nudge carries the id.
  return chosen.replace(/^[a-z]+:/, "");
});

// --- the button -----------------------------------------------------------
await go(player, "combat");
await player.waitForSelector(".buzz", { timeout: 20000 });
const say = await player.locator(".buzz-say").innerText();
ok("the offer says exactly what will ring", /your turn/i.test(say), true);
ok("and what will not", /nothing else|when the DM asks/i.test(say), true);

// --- initiative -----------------------------------------------------------
sent.length = 0;
await go(dm, "combat");
await dm.getByRole("button", { name: "Add creature" }).click();
await dm.locator('input[aria-label="Creature 1 name"]').fill("Ghoul");
await dm.locator('input[aria-label="Creature 1 hp"]').fill("22");
await dm.getByRole("button", { name: "Roll for initiative" }).click();
await dm.waitForSelector('input[aria-label="Kira Vance initiative"]');
await dm.waitForTimeout(700);
ok("staging a fight calls the table for initiative", sent.length, 1);
ok("by name", sent[0]?.title, "Roll for initiative");

// --- the turn -------------------------------------------------------------
sent.length = 0;
for (const [n, v] of [["Kira Vance", 18], ["Ghoul", 7]]) {
  await dm.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await dm.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await dm.getByRole("button", { name: "Begin", exact: true }).click();
await dm.waitForTimeout(800);
ok("beginning it tells whoever is up", sent.map((n) => n.title), ["Your turn"]);
ok("and says who, so a locked phone is enough", /Kira Vance is up/.test(sent[0]?.body ?? ""), true);

sent.length = 0;
await dm.getByRole("button", { name: "Next turn" }).click();
await dm.waitForTimeout(800);
/* The ghoul is up. Nobody is waiting on a phone, so nothing rings — this is
   the assertion that keeps notifications worth reading. */
ok("passing to a creature rings nothing", sent.length, 0);

sent.length = 0;
await dm.getByRole("button", { name: "Next turn" }).click();
await dm.waitForTimeout(800);
ok("coming back round rings again", sent.map((n) => n.to), [kira]);

// --- a roll the DM asked for ----------------------------------------------
sent.length = 0;
await go(dm, "party");
await dm.getByRole("button", { name: "Ask", exact: true }).click();
await dm.selectOption('select[aria-label="What to roll"]', "perception");
await dm.locator('input[aria-label="Difficulty"]').fill("15");
await dm.getByRole("button", { name: "Ask the table" }).click();
await dm.waitForTimeout(900);
ok("asking for a roll rings the person asked",
  sent.length > 0 && sent.every((n) => n.to === kira), true);
ok("and says what for", /perception/i.test(sent[0]?.body ?? ""), true);

// --- and what stays quiet -------------------------------------------------
sent.length = 0;
await go(dm, "party");
await dm.locator('input[aria-label="Kira Vance amount"]').fill("7");
await dm.locator(".pm", { hasText: "Kira Vance" }).first()
  .getByRole("button", { name: "Damage", exact: true }).click();
await dm.waitForTimeout(800);
ok("taking damage does not ring a phone", sent.length, 0);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
