// The Grant Copilot explains a "not a fit", searches the web and proposes
// updates that Rocío applies with one click; then the fit is re-checked.
// Run: node e2e/copilot-acts.live.mjs  (GRANT_ID optional; default FONTAGRO)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  [".env", ".env.local"]
    .filter((f) => fs.existsSync(f))
    .flatMap((f) => fs.readFileSync(f, "utf8").split(/\r?\n/))
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const BASE = process.env.BASE_URL || "http://localhost:5199";
const OUT = process.env.E2E_OUT || "e2e-artifacts";
const GRANT = process.env.GRANT_ID || "b89abd98-606e-4489-8fba-90f293d93a7a";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("iial.lang", "es"));
await page.fill('input[type="email"]', env.SYNTH_USER_EMAIL);
await page.fill('input[type="password"]', env.SYNTH_USER_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });
await page.goto(`${BASE}/grants/${GRANT}`, { waitUntil: "networkidle", timeout: 90000 });
await page.getByText(/1\. ¿Podemos aplicar\?|1\. Can we apply\?/).waitFor({ timeout: 60000 });
const step1 = await page
  .locator("section")
  .filter({ hasText: /1\. (¿Podemos aplicar\?|Can we apply\?)/ })
  .first()
  .innerText();
console.log("STEP 1 (reasons shown):\n", step1.slice(0, 600));

await page
  .getByRole("button", { name: /Más|More/ })
  .first()
  .click();
await page.getByRole("menuitem", { name: /Copilot/ }).click();
const box = page.locator("textarea").last();
await box.waitFor({ timeout: 20000 });
await box.fill(
  "¿Por qué no es elegible para nosotros y qué tendríamos que ajustar para poder participar? Busca en la web la información oficial y actualiza lo que haga falta.",
);
await box.press("Enter");
const t0 = Date.now();
await page.waitForTimeout(3000);
await page
  .waitForFunction(
    () => !/Analizando la oportunidad|Analyzing the opportunity/.test(document.body.innerText),
    null,
    {
      timeout: 300000,
    },
  )
  .catch(() => null);
await page.waitForTimeout(1500);
const sheet = await page.locator('[role="dialog"]').last().innerText();
console.log(`\nCOPILOT (${Math.round((Date.now() - t0) / 1000)} s):\n`, sheet.slice(-3500));
await page.screenshot({ path: path.join(OUT, "copilot-acts.png"), fullPage: true });
const dialog = page.locator('[role="dialog"]').last();
const applyPlan = dialog.getByRole("button", { name: "Aplicar al plan y revalidar" }).last();
const applyFacts = dialog.getByRole("button", { name: "Aplicar y revalidar" }).last();
for (const [name, btn] of [
  ["plan", applyPlan],
  ["facts", applyFacts],
]) {
  if (await btn.count()) {
    await btn.click();
    await dialog
      .getByRole("button", { name: /Aplicado/ })
      .first()
      .waitFor({ timeout: 60000 })
      .then(
        () => console.log(`APPLIED ${name}`),
        async () =>
          console.log(
            `NOT APPLIED ${name}:`,
            (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" | "),
          ),
      );
  } else console.log(`no ${name} card`);
}
await page.keyboard.press("Escape");
await page.reload({ waitUntil: "networkidle" });
await page.getByText(/2\. Nuestra decisión/).waitFor({ timeout: 60000 });
const decision = await page.locator("section").filter({ hasText: "2. Nuestra decisión" }).first();
const role = await decision.locator("select").nth(1).inputValue();
console.log(
  "PLAN after apply → role:",
  role,
  "| notes contain Copilot:",
  (await page.locator("textarea").evaluateAll((els) => els.map((e) => e.value))).some((v) =>
    v.includes("(Copilot)"),
  ),
);
await page.screenshot({ path: path.join(OUT, "copilot-applied.png"), fullPage: true });
await browser.close();
