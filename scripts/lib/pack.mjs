/*
 * Finding a thing in the pack.
 *
 * The pack is four tabs — Weapons, Armour, Gear, Consumables — as the concept
 * draws it, so a row is only in the DOM while its own tab is showing. A suite
 * that adds chain mail and then looks for it while Weapons is open finds
 * nothing, and reports that as the item having gone missing.
 *
 * These open the tab the thing is under. They do not assert it is there: the
 * caller's own assertion still has to do that, and a helper that quietly
 * passed when nothing matched would be worse than the problem.
 */

const TABS = ["Weapons", "Armour", "Gear", "Consumables"];

/** Show whichever bucket holds a row matching `text`. Returns whether one did. */
export async function showInPack(page, text) {
  const rx = text instanceof RegExp ? text : new RegExp(text, "i");
  for (const label of TABS) {
    const tab = page.locator(".pk-tab", { hasText: new RegExp(`^${label}`) });
    if (!(await tab.count())) continue;
    await tab.first().click();
    await page.waitForTimeout(250);
    if (await page.locator(".inv-row").filter({ hasText: rx }).count()) return true;
  }
  return false;
}

/** Every row across all four buckets, which is what "the pack" used to mean. */
export async function wholePack(page) {
  const names = [];
  for (const label of TABS) {
    const tab = page.locator(".pk-tab", { hasText: new RegExp(`^${label}`) });
    if (!(await tab.count())) continue;
    await tab.first().click();
    await page.waitForTimeout(250);
    names.push(...(await page.locator(".inv .nm").allInnerTexts()));
  }
  return names;
}
