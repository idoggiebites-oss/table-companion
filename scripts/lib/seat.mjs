/*
 * Sitting in a seat, whichever shape the control is in.
 *
 * The seat is a `<select>` only while there is something to choose between. A
 * device holding one character that cannot be the DM has exactly one option,
 * and one option is not a dropdown — it is a pill saying who you are. So
 * "sit as X" on such a device is a claim that is ALREADY TRUE, and the honest
 * check is that the pill says so rather than that a select can be driven.
 *
 * Shared, rather than the copy-per-suite this replaced: sixty-five call sites
 * across thirty-five files were reaching for the select directly, and every
 * one of them would have to be found again the next time this control changes
 * shape. `[data-testid="seat"]` is on both shapes.
 */

/**
 * Sit as `name`, or as the DM with `"dm"`.
 *
 * WAITS for the seat to be reachable rather than assuming it already is. A
 * device that has just joined a room has not replayed the log yet, so for a
 * moment it holds no characters and the control is a pill reading "The DM" —
 * and a suite that looked for "any seat control" found that pill and carried
 * on before the character existed. What is actually being waited for is the
 * SEAT, not a control: a join row offering it, a select containing it, or a
 * pill already saying it.
 */
export async function sitIn(page, name, timeout = 20000) {
  const want = name === "dm" ? "The DM" : name;
  const deadline = Date.now() + timeout;
  for (;;) {
    const join = page.locator(".join-row", { hasText: name });
    if (name !== "dm" && (await join.count())) {
      await join.first().click();
      await page.waitForTimeout(500);
      return;
    }
    const pick = page.locator('select[aria-label="Seat"]');
    if (await pick.count()) {
      const options = await pick.locator("option").allInnerTexts();
      if (options.some((o) => o.trim().toLowerCase() === want.toLowerCase())) {
        await pick.selectOption(name === "dm" ? "dm" : { label: name });
        await page.waitForTimeout(500);
        return;
      }
    } else {
      const one = page.locator('[data-testid="seat"]');
      if (await one.count()) {
        const said = (await one.innerText()).trim();
        /* Already true, and nothing to change it with — which is the whole
           point of the pill: one option is not a choice. */
        if (said.toLowerCase() === want.toLowerCase()) return;
      }
    }
    if (Date.now() > deadline) {
      const said = await page.locator('[data-testid="seat"]').innerText().catch(() => "(no control)");
      throw new Error(`waited ${timeout}ms to sit as "${want}"; the seat says "${said.trim()}"`);
    }
    await page.waitForTimeout(250);
  }
}

/** Whatever the control offers, as a list. One entry means a pill. */
export async function seatsOffered(page) {
  const pick = page.locator('select[aria-label="Seat"]');
  if (await pick.count()) return pick.locator("option").allInnerTexts();
  const one = page.locator('[data-testid="seat"]');
  return (await one.count()) ? [(await one.innerText()).trim()] : [];
}

/**
 * Claim whichever character this device is being offered.
 *
 * For the suites that do not care WHICH — they join a room that holds one
 * character and take it. Same race as `sitIn`: the offer only appears once the
 * log has replayed, and a bare `if (await row.count())` runs before it has.
 */
export async function claimAny(page, timeout = 20000) {
  await page.waitForSelector(".join-row", { timeout });
  await page.locator(".join-row").first().click();
  await page.waitForTimeout(500);
}

/**
 * Claim the nth character offered, waiting until that many are on offer.
 *
 * The offers arrive with the log, so `rows.count()` asked too early answers 0
 * or 1 and a suite meaning "take the OTHER one" quietly takes the same one.
 * That is how a notes-privacy check passed while both devices sat in the same
 * character: nothing was being kept out, because there was only ever one of
 * them.
 */
export async function claimNth(page, n, timeout = 20000) {
  const rows = page.locator(".join-row");
  const deadline = Date.now() + timeout;
  while ((await rows.count()) <= n) {
    if (Date.now() > deadline) {
      throw new Error(`waited ${timeout}ms for ${n + 1} characters on offer; ${await rows.count()} arrived`);
    }
    await page.waitForTimeout(250);
  }
  await rows.nth(n).click();
  await page.waitForTimeout(500);
}
