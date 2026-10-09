// Find grants → type (the page must not reload) → search the internet → one
// list of results → "Interested" → the grant opens and the agents research it.
// Run: node e2e/interested-flow.live.mjs [query]   (E2E_OUT, BASE_URL optional)
// Uses the live AI (free tier first): run it on purpose, not in CI.
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
const QUERY = process.argv[2] || "fondos para cadenas de valor de cacao en Perú 2026";
fs.mkdirSync(OUT, { recursive: true });
const fail = (m) => {
  console.error(`FAIL: ${m}`);
  process.exitCode = 1;
};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.setItem("iial.lang", "es"));
await p.fill('input[type="email"]', env.SYNTH_USER_EMAIL);
await p.fill('input[type="password"]', env.SYNTH_USER_PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/auth"));
await p.goto(`${BASE}/grants`, { waitUntil: "networkidle", timeout: 90000 });

// 1. Typing stays in the box: the page heading is the same element throughout.
const box = p.getByRole("textbox", { name: "Buscar grants" });
await box.waitFor();
await p
  .locator("h1")
  .first()
  .evaluate((el) => (el.dataset.mark = "same"));
await box.pressSequentially("cacao", { delay: 120 });
await p.waitForTimeout(1500);
if ((await p.locator('h1[data-mark="same"]').count()) !== 1)
  fail("the page re-mounted while typing");
if ((await box.inputValue()) !== "cacao") fail(`the box lost text: "${await box.inputValue()}"`);
console.log("typing: page stayed mounted, box kept the text");

// 2. Internet search: one list, no duplicated cards.
await box.fill(QUERY);
await box.press("Enter");
const t0 = Date.now();
const rows = p.getByRole("button", { name: /^(Nos interesa|Abrir)$/ });
await rows
  .first()
  .or(p.getByText(/La búsqueda web no pudo/))
  .first()
  .waitFor({ timeout: 180000 });
const n = await rows.count();
console.log(`web search: ${n} results in ${Math.round((Date.now() - t0) / 1000)} s`);
if (await p.getByText("Web en vivo").count()) fail("duplicated 'Web en vivo' cards still shown");
if (await p.locator("table").filter({ hasText: "Oportunidad" }).count())
  fail("duplicated table still shown");
await p.screenshot({ path: path.join(OUT, "interested-search.png"), fullPage: true });
if (!n) {
  await b.close();
  process.exit();
}

// 3. "Interested" → the grant opens and the agents research it on their own.
await rows.first().click();
const opened = await p
  .waitForURL(/\/grants\/[0-9a-f-]{36}/, { timeout: 120000 })
  .then(() => true)
  .catch(() => false);
if (!opened) {
  const err = await p
    .getByText(/No se pudo/)
    .first()
    .textContent()
    .catch(() => null);
  await p.screenshot({ path: path.join(OUT, "interested-import.png"), fullPage: true });
  fail(`the grant did not open after "Nos interesa"${err ? `: ${err}` : ""}`);
  console.log((await p.locator("main").innerText()).slice(0, 1500));
  await b.close();
  process.exit();
}
const t1 = Date.now();
await p
  .getByText(/^Preparado el/)
  .or(p.getByText(/No se pudo preparar/))
  .first()
  .waitFor({ timeout: 300000 });
await p.waitForTimeout(1500);
console.log(`research: ${Math.round((Date.now() - t1) / 1000)} s, ${p.url()}`);
const txt = await p.locator("main").innerText();
console.log(txt.slice(0, 5000));
await p.screenshot({ path: path.join(OUT, "interested-grant.png"), fullPage: true });
await b.close();
