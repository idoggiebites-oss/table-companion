/* The tab a table stares at.

   Five things were wrong with it and every one of them was found by taking a
   screenshot rather than by reading the code: the control a DM presses forty
   times an evening was one of five equal buttons, whose turn it was lived in
   a highlight, damage went through one box at the foot of the card that fed
   every row, opening conditions shoved the initiative order half a screen
   down, and two creatures typed with the same name were the same creature as
   far as the app was concerned. */
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

// --- between fights, which is most of a session ---------------------------
await go(player, "combat");
await player.waitForSelector(".ready-for", { timeout: 20000 });
const between = (await player.locator(".ready-for").innerText()).replace(/\s+/g, " ");
ok("the tab says what you would bring, not just 'no fight'",
  /what you would bring/i.test(between), true);
ok("naming the weapon in your hands", /Longbow/.test(between), true);
ok("what is left to spend", /HIT DICE/i.test(between), true);
ok("and how you are standing", /52 of 52 hit points/.test(between), true);
await player.screenshot({ path: `${OUT}/50-between-fights.png`, fullPage: true });

// --- two of a thing -------------------------------------------------------
await go(dm, "combat");
for (const [i, hp] of [[1, 22], [2, 22]]) {
  await dm.getByRole("button", { name: "Add creature" }).click();
  await dm.locator(`input[aria-label="Creature ${i} name"]`).fill("Ghoul");
  await dm.locator(`input[aria-label="Creature ${i} hp"]`).fill(String(hp));
}
await dm.getByRole("button", { name: "Roll for initiative" }).click();
await dm.waitForSelector('input[aria-label="Kira Vance initiative"]');
/* Typed as two Ghouls; they cannot both be "Ghoul" in a track, a log, or an
   aria-label — which is how this was found.

   Counted on the names rather than the prompts: identical creatures roll as
   one group now, so the number of inputs measures how the DM is asked, not
   whether the ghouls are told apart. They are two different claims and this
   assertion only ever meant the second. */
ok("two creatures typed alike are numbered apart",
  (await dm.locator(".init-waiting .chip").allInnerTexts())
    .filter((c) => /ghoul/i.test(c)).length, 2);
ok("and are asked for one roll between them, the way a table rolls them",
  await dm.locator('input[aria-label="Ghoul ×2 initiative"]').count(), 1);
for (const [n, v] of [["Kira Vance", 18], ["Ghoul ×2", 12]]) {
  await dm.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await dm.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await dm.getByRole("button", { name: "Begin", exact: true }).click();
await dm.waitForTimeout(700);

// --- whose turn it is -----------------------------------------------------
const upNow = (await dm.locator(".up").innerText()).replace(/\s+/g, " ");
ok("whose turn it is, in words", /UP NOW Kira Vance/i.test(upNow), true);
ok("and who follows", /THEN Ghoul 1/i.test(upNow), true);

/* --- your turn, from wherever you are looking -----------------------------

   A player wanders off to their sheet between turns — which is what that
   screen is for — and then it is their turn and the app says so with a dot on
   a tab. The answer to "I did not notice" was never a louder dot.

   Both halves, because the bar and the padding that makes room for it come
   from ONE condition and must never disagree: a gap with no bar is a hole at
   the foot of the page, and a bar with no gap covers the last control on it.
   The first draft of this had exactly that bug — the padding condition left
   out the tab check. */
await go(player, "sheet");
await player.waitForTimeout(600);
console.log("      DEBUG seat:", await player.locator('select[aria-label="Seat"]').inputValue().catch(()=>"-"));
console.log("      DEBUG up now:", await player.locator(".up-now .n").innerText().catch(()=>"-"));
console.log("      DEBUG tabs dot:", await player.locator('[data-tab="combat"]').getAttribute("aria-label").catch(()=>"-"));
ok("on another tab during your turn, the turn comes with you",
  await player.locator(".turnbar").count(), 1);
ok("and the page keeps its own foot",
  await player.locator(".pane-main").evaluate((e) => getComputedStyle(e).paddingBottom),
  "84px");
await go(player, "combat");
await player.waitForTimeout(600);
ok("but not on the fight, where the whole turn is already on screen",
  await player.locator(".turnbar").count(), 0);
ok("and no gap is left behind it",
  await player.locator(".pane-main").evaluate((e) => getComputedStyle(e).paddingBottom),
  "0px");

ok("with the turn counted, not just the round",
  /turn 1 of 3/i.test(await dm.locator(".card-hd").first().innerText()), true);

/* --- stepping the turn where the turn is named ----------------------------

   Next turn stays the primary and is asserted below; this is the pair beside
   the NAME, for the two moments the big button is wrong for — the name
   showing is not the one you meant, or you want to see who is coming.

   Both directions, and the round is checked too: going forward and back
   should land on the same name in the same round, which a stepper that
   quietly advanced twice would not. */
const upLine = async () => (await dm.locator(".up").innerText()).replace(/\s+/g, " ");
ok("the turn can be stepped from where it is named",
  await dm.locator(".up-step .us").count(), 2);
ok("and back is refused before anything has been advanced",
  await dm.getByRole("button", { name: "Back a turn" }).first().isDisabled(), true);
await dm.locator(".up-step .us").last().click();
await dm.waitForTimeout(700);
ok("forward hands to the next in the order", /UP NOW Ghoul 1/i.test(await upLine()), true);
await dm.getByRole("button", { name: "Back a turn" }).first().click();
await dm.waitForTimeout(700);
ok("and back returns the same name", /UP NOW Kira Vance/i.test(await upLine()), true);
ok("in the same round, not a new one",
  /ROUND 1/i.test((await dm.locator(".card-hd").first().innerText()).replace(/\s+/g, " ")), true);

/* --- ending a round from its own header -----------------------------------

   It advances past everyone left to the top of the next round, which means
   those creatures do not act. That is a thing a DM sometimes wants and never
   wants by accident, so the control states the cost on its face.

   Three combatants, sitting on turn 1: it stands in for three presses and
   skips the two people who have not gone. Checked on the round AND the turn,
   because landing on turn 1 of the same round would also read as "turn 1 of
   3" and mean something completely different. */
const roundLine = async () =>
  (await dm.locator(".card-hd").first().innerText()).replace(/\s+/g, " ");
ok("the round can be ended from its own header",
  await dm.getByRole("button", { name: /^End round/ }).count(), 1);
ok("and it says how many turns that skips",
  /skips 2/i.test(await dm.locator(".end-round").innerText()), true);
await dm.getByRole("button", { name: /^End round/ }).click();
await dm.waitForTimeout(800);
ok("pressing it reaches the next round", /ROUND 2/i.test(await roundLine()), true);
ok("at the top of it", /TURN 1 OF 3/i.test(await roundLine()), true);
ok("with the first in the order up again",
  /UP NOW Kira Vance/i.test((await dm.locator(".up").innerText()).replace(/\s+/g, " ")), true);
/* And it is gone on the last turn, where Next turn already does this. */
await dm.getByRole("button", { name: "Next turn" }).click();
await dm.waitForTimeout(400);
await dm.getByRole("button", { name: "Next turn" }).click();
await dm.waitForTimeout(600);
ok("but not offered on the last turn, where Next turn ends it anyway",
  await dm.getByRole("button", { name: /^End round/ }).count(), 0);
/* Put the fight back where the rest of this suite expects it. */
await dm.getByRole("button", { name: "Next turn" }).click();
await dm.waitForTimeout(600);

const next = dm.getByRole("button", { name: "Next turn" });
ok("the control a DM presses most is its own", await next.count(), 1);
ok("and says who it hands to",
  /Ghoul 1 is up/i.test(await next.innerText()), true);
await next.click();
await dm.waitForTimeout(600);
ok("pressing it moves the fight on",
  /UP NOW Ghoul 1/i.test((await dm.locator(".up").innerText()).replace(/\s+/g, " ")), true);
await dm.screenshot({ path: `${OUT}/51-turn-tracker.png`, fullPage: true });

// --- hurting one thing, not every thing -----------------------------------
const hpOf = async (name) =>
  (await dm.locator(".cbt", { hasText: new RegExp(`^\\d+\\s*${name}`) }).first().locator(".hp").innerText()).trim();
await dm.getByRole("button", { name: "Hurt or heal Ghoul 2" }).click();
await dm.waitForTimeout(300);
await dm.locator('input[aria-label="Amount for Ghoul 2"]').fill("14");
await dm.getByRole("button", { name: "Damage Ghoul 2", exact: true }).click();
await dm.waitForTimeout(500);
ok("the number lands on the row it was typed on", await hpOf("Ghoul 2"), "8/22");
ok("and not on the one beside it", await hpOf("Ghoul 1"), "22/22");

/* Healing is the same control the other way. It has a ceiling: a ghoul
   patched up twice used to read 30/22, which is not a state the game has. */
await dm.getByRole("button", { name: "Hurt or heal Ghoul 2" }).click();
await dm.waitForTimeout(300);
await dm.locator('input[aria-label="Amount for Ghoul 2"]').fill("99");
await dm.getByRole("button", { name: "Heal Ghoul 2", exact: true }).click();
await dm.waitForTimeout(500);
ok("healing stops at what it started with", await hpOf("Ghoul 2"), "22/22");


/* --- a creature is two bands, not four ------------------------------------

   The row is a grid, and it had been sized for the five children that existed
   when it was written. Everything added since — the action economy, the
   condition +, the hurt menu — became a sixth, seventh and eighth child and
   fell onto implicit rows of its own. At 390px a creature stood FOUR ragged
   bands tall with its initiative number thirty-six pixels below its own name,
   and the left column alternating between two different x positions.

   Measured as distinct vertical bands rather than as a height, because a
   height can be got right by accident and this is a claim about alignment:
   the name line is exactly the player's, and everything a DM presses is one
   strip under it. */
const bandsOf = async (page, name) =>
  page.locator(".cbt", { hasText: name }).first().evaluate((row) => {
    const top = row.getBoundingClientRect().top;
    /* Clustered on each element's CENTRE, not its top: a 44px button and a
       21px number sitting on the same line have tops 12px apart, so bucketing
       tops splits one visual band into two and the count means nothing. */
    const centres = [];
    for (const el of row.querySelectorAll("*")) {
      if (el.children.length > 0) continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      centres.push(r.top - top + r.height / 2);
    }
    centres.sort((a, z) => a - z);
    let bands = 0, last = -Infinity;
    for (const y of centres) {
      if (y - last > 24) bands += 1;
      last = y;
    }
    return bands;
  });
await dm.setViewportSize({ width: 390, height: 1300 });
await dm.waitForTimeout(400);
ok("a creature's row is two bands: what it is, then what a DM presses",
  await bandsOf(dm, "Ghoul 1"), 2);
/* And the player row it has to line up with is one. */
ok("a character's row is one", await bandsOf(dm, "Kira Vance"), 1);
/* The initiative number sits on the name's line, which is the thing that
   actually broke: it had drifted a whole band below it. */
ok("the initiative number is on the same line as the name it belongs to",
  await dm.locator(".cbt", { hasText: "Ghoul 1" }).first().evaluate((row) => {
    const i = row.querySelector(".i").getBoundingClientRect();
    const n = row.querySelector(".nm").getBoundingClientRect();
    return Math.abs((i.top + i.height / 2) - (n.top + n.height / 2)) < 12;
  }), true);
await dm.setViewportSize({ width: 430, height: 1300 });
await dm.waitForTimeout(400);

// --- conditions, without moving the list ----------------------------------
const rowTop = async () =>
  Math.round((await dm.locator(".cbt").last().boundingBox()).y);
const before = await rowTop();
await dm.locator(".cbt", { hasText: "Ghoul 1" }).getByRole("button", { name: "Add a condition" }).click();
await dm.waitForSelector(".pop-pane", { timeout: 5000 });
ok("the picker opens as a sheet", await dm.locator(".pop-pane").count(), 1);
/* Over the page, not inside it — the rows behind it must not have moved. */
ok("and over the fight rather than inside it",
  await dm.evaluate(() => {
    const p = document.querySelector(".pop-pane");
    return p ? getComputedStyle(p).position : "none";
  }), "fixed");
ok("and the initiative order stays where it was", await rowTop(), before);
await dm.getByRole("button", { name: "prone", exact: true }).click();
await dm.waitForTimeout(500);
ok("what is wrong with it shows on its row",
  await dm.locator(".cbt", { hasText: "Ghoul 1" }).locator(".cnd.on").count(), 1);
/* Which is the whole point of tracking it: the player's dice change. */
await player.waitForTimeout(900);
ok("and the players can see it too",
  (await player.locator(".cbt", { hasText: "Ghoul 1" }).innerText()).toLowerCase().includes("prone"), true);

// --- something arrives ----------------------------------------------------
await dm.getByRole("button", { name: "Something arrives" }).click();
await dm.waitForTimeout(300);
await dm.locator('input[aria-label="Arrival name"]').fill("Ghast");
await dm.locator('input[aria-label="Arrival hit points"]').fill("36");
await dm.locator('input[aria-label="Arrival initiative"]').fill("15");
await dm.getByRole("button", { name: "It joins the fight" }).click();
await dm.waitForTimeout(700);
const order = await dm.locator(".cbt .nm").allInnerTexts();
ok("it lands in the order at its own initiative",
  order, ["Kira Vance", "Ghast", "Ghoul 1", "Ghoul 2"]);
/* Without stealing the turn that was in progress. */
ok("and nobody's turn is skipped",
  /UP NOW Ghoul 1/i.test((await dm.locator(".up").innerText()).replace(/\s+/g, " ")), true);
ok("it can be hurt like anything else",
  await dm.getByRole("button", { name: "Hurt or heal Ghast" }).count(), 1);
await dm.screenshot({ path: `${OUT}/52-reinforcements.png`, fullPage: true });


/* --- nothing on screen that was meant for the source ---------------------

   A block comment at JSX child position is literal TEXT. A fourteen-line
   note about how the combat screen is arranged shipped straight onto the
   combat screen, mid-fight, and every check passed: the suites measure
   positions and roles, and none of them read the page for prose that should
   not be there.

   The source is the wrong place to catch it — a regex cannot tell markup
   from code without parsing, and the attempt produced a hundred and two
   false positives. The PAGE can: comment punctuation is never legitimate
   visible text here. */
const noSourceOnScreen = async (pg, where) => {
  const stray = await pg.evaluate(() => {
    const t = document.body.innerText;
    const hits = [];
    for (const m of t.matchAll(/\/\*|\*\//g)) {
      hits.push(t.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, " "));
    }
    return [...new Set(hits)];
  });
  /* Joined, not compared as arrays: two empty arrays are not equal under
     the JSON compare this harness uses. */
  ok(`no source comment on ${where}`, stray.join(" | "), "");
};

await noSourceOnScreen(dm, "the fight");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
