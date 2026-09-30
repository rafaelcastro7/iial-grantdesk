import { expect, test, type Page } from "@playwright/test";

/**
 * Live regression for the published app: search returns grants for common
 * queries, nonsense returns nothing, and the dashboard never contradicts
 * itself (a scored grant must not be labelled "Needs fit check").
 *
 * Runs only with LIVE_CLOUD=1 (it hits the real cloud). Credentials:
 * E2E_EMAIL / E2E_PASSWORD for a user that already has an org profile.
 *   LIVE_CLOUD=1 E2E_BASE_URL=https://iial-grantdesk.lovable.app \
 *   E2E_EMAIL=... E2E_PASSWORD=... npx playwright test live-search-dashboard
 */
test.skip(process.env.LIVE_CLOUD !== "1", "live cloud test; set LIVE_CLOUD=1");

const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

// Each query must return at least this many grants on the current catalog.
const EXPECTED_MIN: Record<string, number> = {
  health: 5,
  innovation: 5,
  "clean technology": 2,
  NRC: 5,
  loan: 1,
  "R&D": 1,
};

async function signIn(page: Page) {
  await page.goto("/auth");
  await page.locator("input[type=email]").fill(EMAIL);
  await page.locator("input[type=password]").fill(PASSWORD);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 45_000 });
}

async function search(page: Page, query: string): Promise<number> {
  await page.goto("/grants");
  const box = page.locator('input[type=search], input[placeholder*="earch" i]').first();
  await box.waitFor({ timeout: 45_000 });
  await box.fill(query);
  await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(3_000);
  const hrefs = await page
    .locator('a[href^="/grants/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  return new Set(hrefs.filter((h) => /\/grants\/[0-9a-f-]{36}$/.test(h))).size;
}

test("login screen is translated", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByText("auth.signIn")).toHaveCount(0);
  await expect(page.locator("form button[type=submit]").first()).toHaveText(/sign in/i);
});

test("search returns grants for common queries and nothing for nonsense", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page);
  for (const [query, min] of Object.entries(EXPECTED_MIN)) {
    expect(await search(page, query), `results for "${query}"`).toBeGreaterThanOrEqual(min);
  }
  expect(await search(page, "zzqxnotaword")).toBe(0);
});

test("dashboard labels agree with evaluations", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(page.getByText(/Scored/)).toBeVisible({ timeout: 45_000 });
  // The queue loads after the headline numbers; wait until it settles.
  await page.waitForLoadState("networkidle");
  const rows = page.locator('a[href^="/grants/"]').filter({ hasText: /fit score/i });
  const scored = Number(
    (
      await page
        .getByText(/^Scored$/)
        .locator("..")
        .innerText()
    ).match(/\d+/)?.[0] ?? 0,
  );
  if (scored > 0) await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  for (const row of await rows.all()) {
    const text = await row.innerText();
    const hasScore = /\n\s*\d{1,3}\s*\n\s*fit score/i.test(text);
    if (hasScore) expect(text, "scored grant labelled as unchecked").not.toMatch(/Needs fit check/);
  }
});
