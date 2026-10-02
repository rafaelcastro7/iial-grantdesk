import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end: a consultant signs in, lands in the workspace, and walks the
 * main screens (dashboard, clients, grants, proposals). Fails on any
 * uncaught page error or on a screen that renders an error boundary.
 *
 * Credentials: E2E_EMAIL / E2E_PASSWORD (defaults to the shared test account).
 */
const EMAIL = process.env.E2E_EMAIL ?? "desk.test2@example.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "GrantDesk!2345";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function signIn(page: Page) {
  await page.goto("/auth");
  await page.locator("input[type=email]").fill(EMAIL);
  await page.locator("input[type=password]").fill(PASSWORD);
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
}

test("sign-in rejects a wrong password", async ({ page }) => {
  await page.goto("/auth");
  await page.locator("input[type=email]").fill(EMAIL);
  await page.locator("input[type=password]").fill("definitely-wrong-password");
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/auth/);
});

test("consultant signs in and walks the main screens", async ({ page }) => {
  const errors = trackErrors(page);
  await signIn(page);

  for (const path of ["/dashboard", "/clients", "/grants", "/proposals"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(path));
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/something went wrong|unexpected error/i)).toHaveCount(0);
    await page.screenshot({ path: `test-results/e2e${path.replace("/", "-")}.png` });
  }

  expect(errors, `page errors: ${errors.join(" | ")}`).toEqual([]);
});

test("grant search returns relevant results and opens a grant", async ({ page }) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto("/grants");
  const box = page
    .getByRole("searchbox", { name: "Search grants" })
    .or(page.getByLabel("Search grants"))
    .first();
  await expect(box).toBeVisible({ timeout: 30_000 });
  await box.fill("clean technology");
  await expect(page.locator('[data-search-mode="hybrid"]')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/meaning-based search is temporarily unavailable/i)).toHaveCount(0);
  const firstGrant = page.locator('a[href^="/grants/"]').first();
  await expect(firstGrant).toBeVisible({ timeout: 45_000 });
  await page.screenshot({ path: "test-results/e2e-grant-search.png" });
  await firstGrant.click();
  await expect(page).toHaveURL(/\/grants\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/something went wrong|unexpected error/i)).toHaveCount(0);
  await page.screenshot({ path: "test-results/e2e-grant-detail.png" });
  expect(errors, `page errors: ${errors.join(" | ")}`).toEqual([]);
});

test("a brand-new user can sign up and reach the dashboard", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/auth");
  await page
    .getByRole("button", { name: /sign up|create account|register/i })
    .first()
    .click();
  await page.locator("input[type=email]").fill(`e2e+${Date.now()}@example.com`);
  await page.locator("input[type=password]").fill("E2e-Signup-2026!");
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 });
  expect(errors, `page errors: ${errors.join(" | ")}`).toEqual([]);
});
