/* Two themes, three states.
 *
   The state that matters is the one nobody thinks to test: "system", which is
   the ABSENCE of a data-theme attribute. V2 shipped this as a hardcoded
   `useState("light")` while the stylesheet followed prefers-color-scheme, so
   on a phone in dark mode the app rendered dark, the toggle believed it was
   light, and the first press set what was already set — a button that
   visibly does nothing. That is what the second half of this suite is for.

   Driven from a real build in both system schemes, because a theme is one of
   the few things where the SETTING of the machine changes the answer. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://localhost:4173/";
const LIGHT = "rgb(250, 247, 242)";
const DARK = "rgb(19, 20, 22)";

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

/** What the page is actually painting, and what it says about itself. */
const look = (page) => page.evaluate(() => ({
  ground: getComputedStyle(document.body).backgroundColor,
  attr: document.documentElement.getAttribute("data-theme"),
  /* The browser's own chrome. Two tags with `media` while nothing is chosen,
     one plain tag once something is — a media query cannot see data-theme. */
  chrome: [...document.head.querySelectorAll('meta[name="theme-color"]')]
    .map((m) => `${m.getAttribute("content")}${m.hasAttribute("media") ? " @media" : ""}`),
}));

const open = async (scheme) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, colorScheme: scheme,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  return { ctx, page };
};

/* `exact`, because the sheet's own close control is "Close This device" and
   a substring match resolves to both. */
const toDevice = async (page) => {
  await page.getByRole("button", { name: "This device", exact: true }).click();
  await page.waitForTimeout(250);
};

// --- a phone set to light -------------------------------------------------
{
  const { ctx, page } = await open("light");
  await page.getByRole("button", { name: "Load sample" }).click();
  await page.waitForSelector(".tabs", { timeout: 20000 });
  ok("with nothing chosen, a light phone is light", (await look(page)).ground, LIGHT);
  ok("and no attribute is stamped", (await look(page)).attr, null);
  ok("both theme-colors stand, each behind its own query",
    (await look(page)).chrome, ["#faf7f2 @media", "#131416 @media"]);

  await toDevice(page);
  /* The label names what pressing it DOES, so on a light screen it offers dark. */
  await page.getByRole("button", { name: "Switch to the dark theme" }).click();
  await page.waitForTimeout(400);
  const after = await look(page);
  ok("pressing it actually changes the ground", after.ground, DARK);
  ok("and stamps the choice", after.attr, "dark");
  ok("and collapses the chrome to the one that is true", after.chrome, ["#131416"]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  ok("the choice survives a reload", (await look(page)).attr, "dark");
  await ctx.close();
}

// --- a phone set to dark, which is where the bug lived --------------------
{
  const { ctx, page } = await open("dark");
  await page.getByRole("button", { name: "Load sample" }).click();
  await page.waitForSelector(".tabs", { timeout: 20000 });
  ok("with nothing chosen, a dark phone is dark", (await look(page)).ground, DARK);
  ok("and still no attribute — system is the absence of one", (await look(page)).attr, null);

  await toDevice(page);
  /* THE assertion. If the control believed it was light it would offer dark
     here, and pressing it would set what the screen already showed. */
  ok("the control knows the screen is dark and offers light",
    await page.getByRole("button", { name: "Switch to the light theme" }).count(), 1);
  await page.getByRole("button", { name: "Switch to the light theme" }).click();
  await page.waitForTimeout(400);
  ok("and one press is enough to see a change", (await look(page)).ground, LIGHT);

  /* The sheet stays open across the press — a setting you may want to put
     back should not make you find the control twice. */
  await page.getByRole("button", { name: "Follow this phone" }).click();
  await page.waitForTimeout(400);
  const back = await look(page);
  ok("handing it back to the phone drops the attribute", back.attr, null);
  ok("and the dark phone is dark again", back.ground, DARK);
  ok("and both queried theme-colors are restored",
    back.chrome, ["#faf7f2 @media", "#131416 @media"]);
  await ctx.close();
}

await browser.close();
