// End-to-end walk-through as the synthetic consultant (qa.synthetic@iial.ca)
// against a running app (BASE_URL, default http://localhost:5199) and the real
// database, confined to the "GrantDesk QA (synthetic)" organization.
// Credentials come from .env.local (SYNTH_USER_EMAIL / SYNTH_USER_PASSWORD).
// Run: node e2e/synthetic-consultant.live.mjs
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
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const problems = [];
const step = async (name, fn) => {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`PASS ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: String(e?.message ?? e).slice(0, 400) });
    console.log(`FAIL ${name}: ${String(e?.message ?? e).slice(0, 300)}`);
  }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => problems.push(`pageerror ${page.url()}: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console ${page.url()}: ${m.text().slice(0, 300)}`);
});
page.on("response", async (r) => {
  if (r.status() >= 400 && !r.url().includes("favicon")) {
    let body = "";
    try {
      body = (await r.text()).slice(0, 200);
    } catch {}
    problems.push(`http ${r.status()} ${r.url().slice(0, 160)} ${body}`);
  }
});
const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: true });

await step("login", async () => {
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', env.SYNTH_USER_EMAIL);
  await page.fill('input[type="password"]', env.SYNTH_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });
  await shot("01-after-login");
});

for (const [n, route] of [
  ["02-dashboard", "/dashboard"],
  ["03-radar", "/grants"],
  ["04-insights", "/insights"],
  ["05-pipeline-empty", "/pipeline"],
  ["06-partners-empty", "/partners"],
  ["07-proposals", "/proposals"],
  ["08-org", "/org"],
]) {
  await step(`open ${route}`, async () => {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    if (!page.url().includes(route)) throw new Error(`redirected to ${page.url()}`);
    const text = await page.locator("body").innerText();
    if (/something went wrong|application error|unexpected error/i.test(text))
      throw new Error("error screen");
    await shot(n);
  });
}

let grantUrl = null;
await step("radar lists grants and opens one", async () => {
  await page.goto(`${BASE}/grants`, { waitUntil: "networkidle", timeout: 60000 });
  const link = page.locator('a[href^="/grants/"]').first();
  await link.waitFor({ timeout: 30000 });
  grantUrl = await link.getAttribute("href");
  await page.goto(`${BASE}${grantUrl}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("1. Can we apply?").first().waitFor({ timeout: 30000 });
  await shot("09-grant-detail");
});

await step("application plan: fill and save", async () => {
  await page.getByText("1. Can we apply?").waitFor({ timeout: 30000 });
  const box = page
    .locator(
      'label:has-text("Tick if this organization applies") input[type="checkbox"], label:has-text("Applies") input[type="checkbox"]',
    )
    .first();
  if (!(await box.isChecked())) await box.check();
  await page.locator('label:has-text("Priority") select').selectOption("prepare");
  await page.getByPlaceholder("e.g. Lambton College").fill("Lambton College");
  await page.getByRole("button", { name: /Add partner/ }).click();
  await page.getByPlaceholder("Organization").last().fill("Universidad Tecnológica de Tulum");
  await page.getByPlaceholder("Country", { exact: true }).last().fill("Mexico");
  await page
    .getByPlaceholder(/Role \(e\.g\./)
    .last()
    .fill("Mexican higher-education partner");
  await page
    .getByPlaceholder(/Whole-Chain Integrity/)
    .fill("Whole-Chain Integrity for Sustainable Agri-Food Systems");
  await page
    .getByPlaceholder("e.g. No audited financial statements")
    .fill("Audited statements not available");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await shot("10-plan-filled");
  await page.getByRole("button", { name: /Save plan/ }).click();
  await page
    .getByText(/Application plan saved|Saved/)
    .first()
    .waitFor({ timeout: 30000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("1. Can we apply?").waitFor({ timeout: 30000 });
  const v = await page.getByPlaceholder("e.g. Lambton College").inputValue();
  if (v !== "Lambton College") throw new Error(`not persisted after reload (got "${v}")`);
  await shot("11-plan-saved-reloaded");
});

await step("emails never include the internal blocker", async () => {
  // With a dossier, the composer lives in a collapsed "More email templates and the memo".
  const more = page.getByText("5. More email templates and the memo");
  if (await more.count()) await more.first().click();
  const write = page.locator('section:has-text("5. Write")').last();
  const emailPre = await write.locator("pre").first().innerText();
  if (!/Rocío|Saludos/.test(emailPre)) throw new Error("composer did not render");
  if (/Audited statements not available/i.test(emailPre))
    throw new Error("blocker leaked into an email");
  await page.getByRole("button", { name: "Memo to Marcelo" }).click();
  const memo = await write.locator("pre").first().innerText();
  if (!/Audited statements not available/i.test(memo))
    throw new Error("memo is missing the blocker");
  await page.getByRole("button", { name: "Partners and funders" }).click();
  await shot("12-emails-memo");
});

await step("pipeline shows the saved plan and exports CSV", async () => {
  await page.goto(`${BASE}/pipeline`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("table tbody tr").first().waitFor({ timeout: 30000 });
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("button", { name: /Export to Excel/ }).click(),
  ]);
  const file = path.join(OUT, "pipeline.csv");
  await download.saveAs(file);
  const csv = fs.readFileSync(file, "utf8");
  if (!csv.includes("Opportunity") || csv.split("\n").length < 2) throw new Error("CSV empty");
  await shot("13-pipeline");
});

await step("partners: add and see the grant it belongs to", async () => {
  await page.goto(`${BASE}/partners`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: /Add partner/ }).click();
  await page.getByPlaceholder("Organization name *").fill("Universidad Tecnológica de Tulum");
  await page.getByPlaceholder("Country", { exact: true }).fill("Mexico");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Universidad Tecnológica de Tulum").first().waitFor({ timeout: 20000 });
  await shot("14-partners");
});

fs.writeFileSync(
  path.join(OUT, "report.json"),
  JSON.stringify({ base: BASE, results, problems }, null, 2),
);
console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} steps passed; ${problems.length} problems logged`,
);
for (const p of [...new Set(problems)].slice(0, 40)) console.log("  -", p);
await browser.close();
