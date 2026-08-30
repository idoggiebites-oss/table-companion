/* Session zero: build a character in the app, and watch the consequences of
   each choice as it is made. */
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

/* Skills and saves sit behind a press now: the sheet stopped being forty rows
   to scroll past on the way to the hit points. The button says what it holds
   ("Skills, +7 best"); opening it is one tap. */
const openDrawer = async (page, which) => {
  const hd = page.getByRole("button", { name: new RegExp(`^${which}, `) });
  await hd.waitFor({ timeout: 20000 });
  if ((await hd.getAttribute("aria-expanded")) !== "true") await hd.click();
  await page.waitForTimeout(300);
};


/* Languages, tools and background skills are closed pickers now — sixteen and
   fifty-three of them laid out at once made this step three and a half screens
   tall. Open the one you want, then choose in it. */
const openPick = async (page, label) => {
  const hd = page.getByRole("button", { name: new RegExp(`^${label}, \\d+ chosen$`) });
  if ((await hd.count()) && (await hd.first().getAttribute("aria-expanded")) === "false") {
    await hd.first().click();
    await page.waitForTimeout(250);
  }
};

/* The builder is a flow now: one question per screen, and the rail is how you
   move between them. Every step is reachable at any time — which is also how a
   person changes their mind about a race after picking spells. */
const atStep = async (page, label) => {
  const node = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await node.count()) { await node.first().click(); await page.waitForTimeout(250); }
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
// The builder asks two kinds of question before it will finish: which martial
// weapon the kit means, and what the class asks about itself — a domain, a
// fighting style. Answer both.
const answerGear = async (page) => {
  // Two steps' worth of questions: what the class asks about itself, and
  // which martial weapon the kit meant.
  await atStep(page, "Scores");
  /* Every class choice, answered. A subclass is a readable list now, not a
     dropdown — open the first unanswered row and take it. "Take …" rather
     than the first button in the panel, because an already-answered
     chooser offers "Choose something else" and would be un-chosen. */
  for (let g = 0; g < 8; g++) {
    const card = page.locator(".card", { hasText: "Your class" });
  const head = card.locator('.chooser button.menu-hd[aria-expanded="false"]').first();
    if (!(await head.count())) break;
    await head.click();
    await page.waitForTimeout(250);
    const take = card.getByRole("button", { name: /^Take / }).first();
    if (!(await take.count())) break;
    await take.click();
    await page.waitForTimeout(300);
  }
  await atStep(page, "Gear");
  const sel = page.locator('select[aria-label^="Choose"]');
  for (let i = 0; i < (await sel.count()); i++) {
    await sel.nth(i).selectOption({ index: 1 });
  }
  /* Every class choice, answered — a readable list now, not a dropdown. */
  for (let g = 0; g < 8; g++) {
    const card = page.locator(".card", { hasText: "Your class" });
  const head = card.locator('.chooser button.menu-hd[aria-expanded="false"]').first();
    if (!(await head.count())) break;
    await head.click();
    await page.waitForTimeout(250);
    const take = card.getByRole("button", { name: /^Take / }).first();
    if (!(await take.count())) break;
    await take.click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(250);
};

/** Sections are tabs now; content is one tap away rather than a scroll. */
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1300 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}
const stat = (p, label) => p.locator(".cr-grid div", { hasText: label }).locator(".v");

const dm = await device("dm");
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();

const player = await device("player");
await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForTimeout(1200);

await player.page.getByRole("button", { name: "Build a character" }).click();
await atStep(player.page, "Class");
await player.page.waitForSelector(".klass-cards", { timeout: 20000 });

// class first — it is what lets everything after it advise
await atStep(player.page, "Class");
await atStep(player.page, "Race");
await atStep(player.page, "Class");
ok("class is asked first", await player.page.locator(".cr-step").first().innerText(), "1 · CLASS");

/* --- nothing is finished before it is asked ------------------------------

   Skills and Gear ticked themselves on a brand-new character. With no class
   there is nothing to pick, so "as many as are needed" was 0 === 0 and
   "nothing left unchosen" was vacuously true — and the rail told a player two
   steps were done before they had chosen anything at all.

   Read off the rail as a player sees it: a tick, or a number. */
const freshRail = await player.page.locator(".cr-rail .cr-dot").allInnerTexts();
ok("a brand-new build has nothing ticked",
  freshRail.filter((t) => t.trim() === "✓").length, 0);
/* Joined rather than compared as an array: innerText carries invisible
   characters that make two identical-looking lists unequal. */
ok("every step shows its number instead",
  freshRail.map((t) => t.replace(/\D/g, "")).join(""), "1234567");

/* And a step whose question does not exist yet says so, rather than drawing
   an empty card with a Back and a Continue and nothing between them. */
await atStep(player.page, "Gear");
await player.page.waitForTimeout(500);
ok("a step you cannot answer yet says what it needs",
  /needs a class and a race/i.test(
    await player.page.locator(".cr-waiting").innerText().catch(() => "")),
  true);
await atStep(player.page, "Class");
// One question per screen: race is its own step now, reached after this one.
ok("race is not offered until then",
  await player.page.locator('select[aria-label="Race"]').count(), 0);
ok("but the flow says it is coming",
  await player.page.getByRole("button", { name: /^Step \d+, Race$/ }).count(), 1);

await atStep(player.page, "Class");
await player.page.getByRole("button", { name: "Ranger", exact: true }).click();
await player.page.waitForTimeout(300);
await atStep(player.page, "Class");
const note = await player.page.locator(".cr-note").first().innerText();
ok("the class states its own facts", note.includes("d10 hit die"), true);
ok("and its saves", note.includes("STR and DEX"), true);
ok("ranger does not claim to cast at level 1", note.includes("casts from level 1"), false);

/* --- and the rail does not change when you walk past it -------------------

   The step you are STANDING on used to hide its own tick, and that one
   condition is the whole of what was written down as "the rail settles":
   Gear is finished before you reach it, so it ticked and then lost the tick
   when you arrived; Class becomes finished while you stand there choosing,
   so it stayed a number until you left. Where you are is the gold dot;
   what is answered is the tick. Two marks, not one deciding between them. */
const dots = async () =>
  (await player.page.locator(".cr-rail .cr-dot").allInnerTexts()).map((t) => t.trim());
const railHere = await dots();
ok("the step you are on ticks where it is answered", railHere[0], "✓");
ok("and a step with its question still open keeps its number", railHere[4], "5");
await atStep(player.page, "Skills");
ok("and nothing moves by walking away from it", (await dots()).join(""), railHere.join(""));
await atStep(player.page, "Class");

// class skills: three from a list of eight
await atStep(player.page, "Skills");
await player.page.getByRole("button", { name: "Train stealth" }).click();
await atStep(player.page, "Skills");
await player.page.getByRole("button", { name: "Train perception" }).click();
await atStep(player.page, "Skills");
await player.page.getByRole("button", { name: "Train survival" }).click();
// Chips became a table: the consequence of taking a skill is a number, so
// the number is what is checked.
await atStep(player.page, "Skills");
ok("three class skills taken", await player.page.locator(".skl tr.on").count(), 3);
/* The point of the table: the total is the ability plus proficiency, and it
   moves when you take the skill. Parsed with the real minus sign the app
   renders (U+2212), not the hyphen a naive Number() expects. */
await atStep(player.page, "Class");
ok("and each rolls at its ability plus proficiency",
  await player.page.locator(".skl tr.on").evaluateAll((rows) =>
    rows.every((r) => {
      const td = [...r.querySelectorAll("td")].map((c) =>
        Number(c.textContent.replace(/\u2212/g, "-")));
      return td[3] === td[2] + 2;
    })),
  true);

await atStep(player.page, "Race");
await player.page.selectOption('select[aria-label="Race"]', "elf");
await player.page.waitForTimeout(400);
await atStep(player.page, "Race");
ok("a subrace is offered where the SRD has one",
  await player.page.locator('select[aria-label="Subrace"]').count(), 1);
await atStep(player.page, "Scores");
await player.page.waitForSelector(".cr-ab");

// consequences move as scores are assigned — the whole teaching mechanism
await atStep(player.page, "Scores");
const acBefore = await stat(player.page, "Armour class").innerText();
await player.page.locator(".chipv", { hasText: /^15$/ }).click();
await player.page.getByRole("button", { name: "dex", exact: true }).click();
await player.page.waitForTimeout(300);
await atStep(player.page, "Scores");
const acAfter = await stat(player.page, "Armour class").innerText();
ok("armour class moved when dexterity was set", acBefore !== acAfter, true);
ok("and is right: 10 + (15+2 elf) modifier", acAfter, "13");
ok("racial bonus is shown as its own term, not a mystery total",
  (await player.page.locator(".cr-ab", { hasText: "dex" }).first().innerText()).includes("+ 2"), true);

await atStep(player.page, "Scores");
await player.page.locator(".chipv", { hasText: /^14$/ }).click();
await player.page.getByRole("button", { name: "con", exact: true }).click();
await player.page.waitForTimeout(300);
ok("hit points follow constitution", await stat(player.page, "Hit points").innerText(), "12");

// Recommend fills the rest — advice, offered rather than applied
await atStep(player.page, "Scores");
await player.page.getByRole("button", { name: "Recommend" }).click();
await player.page.waitForTimeout(400);
await atStep(player.page, "Scores");
ok("recommend placed every score", await player.page.locator(".cr-ab.empty").count(), 0);
await player.page.screenshot({ path: `${OUT}/34-creation.png`, fullPage: true });

// custom background: two skills and a name
await atStep(player.page, "Story");
await openPick(player.page, "Skills");
await player.page.getByRole("button", { name: "Train nature" }).click();
await atStep(player.page, "Story");
await openPick(player.page, "Skills");
await player.page.getByRole("button", { name: "Train animal handling" }).click();
await atStep(player.page, "Story");
await player.page.locator('input[aria-label="Background name"]').fill("Greenwarden");
await atStep(player.page, "Review");
await player.page.locator('input[aria-label="Character name"]').fill("Kira Vance");
await player.page.waitForTimeout(300);

await answerGear(player.page);

await atStep(player.page, "Review");
const create = player.page.getByRole("button", { name: "Create character" });
ok("ready to create", await create.isDisabled(), false);
await create.click();
await player.page.waitForSelector(".hp-big", { timeout: 15000 });

// Recommend reassigns every score, so these are its deterministic output for
// a ranger: dex 15+2, wis 14, con 13, str 12, int 10+1, cha 8.
ok("hit points are the full die plus constitution",
  (await player.page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "11 / 11");
ok("proficiency at level 1", await player.page.locator(".strip div").nth(3).locator("b").innerText(), "+2");
ok("a class skill carries proficiency",
  await (await openDrawer(player.page, "Skills"),
    player.page.getByRole("button", { name: /^stealth/ }).locator(".v").innerText()), "+5");
ok("a background skill does too — int 11 gives +0, plus proficiency",
  await player.page.getByRole("button", { name: /^nature/ }).locator(".v").innerText(), "+2");
ok("and an unproficient skill does not",
  await player.page.getByRole("button", { name: /^arcana/ }).locator(".v").innerText(), "+0");

// and it reached the table
await dm.page.selectOption('select[aria-label="Seat"]', "dm").catch(() => {});
await dm.page.waitForTimeout(1200);
ok("the DM sees the new character", (await dm.page.locator(".pm-name").innerText()), "Kira Vance");


/* --- nothing spills out of its own box -----------------------------------

   A flex item's default `min-height: auto` is the only thing stopping it
   being squeezed below its own content — so giving every button a 44px
   minimum quietly let the class cards collapse to 44 and print their
   descriptions over the card beneath. It looked like overlapping text and it
   was a one-word CSS change three commits earlier.

   Measured the same way the tap targets are: content against its container,
   on the screen where a card is biggest. */
await atStep(player.page, "Class");
await player.page.waitForTimeout(400);
const spilling = await player.page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("button, .klass, .menu-row, .pick")) {
    const r = el.getBoundingClientRect();
    if (r.height === 0) continue;
    for (const kid of el.children) {
      const k = kid.getBoundingClientRect();
      if (k.height > 0 && k.bottom - r.bottom > 2) {
        out.push(`${(el.className || el.tagName).toString().split(" ")[0]} +${Math.round(k.bottom - r.bottom)}px`);
      }
    }
  }
  return [...new Set(out)];
});
ok("no card prints over the one beneath it", spilling.join(", "), "");


/* --- a step arrives, rather than changing underneath you -----------------

   Pressing Continue used to swap the content while the screen stayed
   scrolled to wherever the last question ended, so every step began with a
   scroll back up to find it. That is the difference between a page and an
   app, and it is measurable: where the screen is afterwards. */
const flow = await device("flow");
await flow.page.getByRole("button", { name: "Build a character" }).click();
await flow.page.waitForSelector(".klass-cards", { timeout: 20000 });
await flow.page.getByRole("button", { name: "Wizard", exact: true }).click();
await flow.page.waitForTimeout(400);
// Where a person is when they finish a long step.
await flow.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await flow.page.waitForTimeout(300);
const before = await flow.page.evaluate(() => Math.round(window.scrollY));
ok("a long step leaves you at the bottom of it", before > 200, true);

await flow.page.getByRole("button", { name: "Continue" }).click();
await flow.page.waitForTimeout(900);
const landed = await flow.page.evaluate(() => ({
  rail: Math.round(document.querySelector(".cr-rail").getBoundingClientRect().top),
  anim: getComputedStyle(document.querySelector(".cr-steps")).animationName,
  scrollY: Math.round(window.scrollY),
  viewH: window.innerHeight,
}));
/* Two claims, because one of them used to stand in for both and stopped
   being true the moment a SHORT step followed a long one: the rail sat at
   its natural 333 with nothing scrolled past, which is right, and an
   assertion about its distance from the top called that a failure.

   What is actually meant is that you are no longer where you were, and that
   the steps are on screen — both of which hold whether the next step fills
   the page or not. */
ok("you are no longer at the bottom of the last step", landed.scrollY < before, true);
ok("and the steps are on screen",
  landed.rail >= 0 && landed.rail < landed.viewH, true);
ok("arriving from the side it came from", landed.anim, "cr-arrive");

await flow.page.getByRole("button", { name: "Back" }).click();
await flow.page.waitForTimeout(600);
ok("and from the other side going back",
  await flow.page.evaluate(
    () => getComputedStyle(document.querySelector(".cr-steps")).animationName,
  ),
  "cr-arrive-back");


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

await noSourceOnScreen(player.page, "the builder");

/* --- and the Spells step ticks when it HAS been answered -----------------

   The other half of the check in verify-spells, which asserts a fresh caster
   is NOT finished with Spells. On its own that would also pass if `done` were
   simply always false, so this builds the smallest caster there is — a warlock
   at one, two cantrips and two spells — and fills the allowance.

   Its own device: the wizard over in verify-spells is deliberately created
   with no spells at all, because the Spells tab has to explain where they
   come from, and taking any here would remove the thing that suite measures. */
const caster = await device("caster");
await caster.page.locator('input[aria-label="Room code"]').fill(code);
await caster.page.getByRole("button", { name: "Join", exact: true }).click();
await caster.page.waitForTimeout(1200);
await caster.page.getByRole("button", { name: "Build a character" }).click();
await atStep(caster.page, "Class");
await caster.page.waitForSelector(".klass-cards", { timeout: 20000 });
await caster.page.getByRole("button", { name: "Warlock", exact: true }).click();
await caster.page.waitForTimeout(600);
await atStep(caster.page, "Race");
await caster.page.selectOption('select[aria-label="Race"]', "human");
await caster.page.waitForTimeout(800);

/* Read from somewhere else on the rail. The step you are STANDING on shows
   its number rather than its state, so asking the Spells dot while sitting on
   Spells always answers "6" — which reads exactly like "not done" and would
   have made this pass for the wrong reason. */
const spellDot = async () => {
  await atStep(caster.page, "Story");
  await caster.page.waitForTimeout(300);
  return caster.page.locator(".cr-rail button", { hasText: /SPELLS/i }).innerText();
};
ok("a fresh warlock is not finished with Spells either",
  /\u2713/.test(await spellDot()), false);

/* Fill both allowances. Bounded rather than counted, because the number is
   the class table's business and this is checking the rail, not the table. */
for (let i = 0; i < 12; i++) {
  if (/\u2713/.test(await spellDot())) break;
  await atStep(caster.page, "Spells");
  const heads = caster.page.getByRole("button", { name: /^(Cantrips|Spells), / });
  let opened = false;
  for (let h = 0; h < (await heads.count()); h++) {
    const one = heads.nth(h);
    /* The aria-label, not innerText: these headers are uppercased in CSS, so
       innerText reads "0 OF 2" and a lowercase "of" never matches. The
       accessible name keeps the case the source wrote. */
    const m = /(\d+) of (\d+)/.exec((await one.getAttribute("aria-label")) ?? "");
    if (!m || m[1] === m[2]) continue;
    if ((await one.getAttribute("aria-expanded")) !== "true") {
      await one.scrollIntoViewIfNeeded();
      await one.click();
      await caster.page.waitForTimeout(600);
    }
    opened = true;
    break;
  }
  if (!opened) break;
  /* A name alone is not a choice here: the row opens to its description and
     the take sits inside it, which is the point of this picker. */
  const row = caster.page.locator('.chooser-list .menu-hd[aria-expanded="false"]').first();
  if (!(await row.count())) break;
  await row.click();
  await caster.page.waitForTimeout(300);
  const take = caster.page.locator(".chooser-list").getByRole("button", { name: "Take it" }).first();
  if (!(await take.count())) break;
  await take.click();
  await caster.page.waitForTimeout(400);
}
ok("and is finished once the allowance is filled", /\u2713/.test(await spellDot()), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
