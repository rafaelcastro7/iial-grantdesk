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
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
}

test("sign-in rejects a wrong password", async ({ page }) => {
  await page.goto("/auth");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("definitely-wrong-password");
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
    await expect(page.locator("main, [role=main], body").first()).toBeVisible();
    await expect(page.getByText(/something went wrong|unexpected error/i)).toHaveCount(0);
    await page.screenshot({ path: `test-results/e2e${path.replace("/", "-")}.png` });
  }

  expect(errors, `page errors: ${errors.join(" | ")}`).toEqual([]);
});
