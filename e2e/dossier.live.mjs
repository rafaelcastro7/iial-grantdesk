// Opens a grant as the synthetic user and verifies that its autonomous dossier is complete.
// Run: LIVE_CLOUD=1 node e2e/dossier.live.mjs [grantId]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

if (process.env.LIVE_CLOUD !== "1") throw new Error("Set LIVE_CLOUD=1 for live AI tests.");
const env = Object.fromEntries(
  [".env", ".env.local"]
    .filter((file) => fs.existsSync(file))
    .flatMap((file) => fs.readFileSync(file, "utf8").split(/\r?\n/))
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => [
      line.slice(0, line.indexOf("=")).trim(),
      line.slice(line.indexOf("=") + 1).trim(),
    ]),
);
const base = process.env.BASE_URL || "http://localhost:5173";
const out = process.env.E2E_OUT || "e2e-artifacts";
const grantId = process.argv[2] || "4c434e92-d2b0-42ee-b7cd-67547e03fa34";
const dossierTimeout = Number(process.env.DOSSIER_TIMEOUT_MS || 300000);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto(`${base}/auth`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(() => localStorage.setItem("iial.lang", "es"));
  await page.fill('input[type="email"]', env.SYNTH_USER_EMAIL);
  await page.fill('input[type="password"]', env.SYNTH_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"));

  const startedAt = Date.now();
  await page.goto(`${base}/grants/${grantId}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  try {
    await page
      .getByText(/Los 8 datos de decisi.n (?:fueron )?revisados|All 8 decision facts reviewed/)
      .or(page.getByText(/No se pudo preparar/))
      .first()
      .waitFor({ timeout: dossierTimeout });
  } catch (error) {
    const diagnostic = (await page.locator("body").innerText()).slice(0, 4000);
    await page.screenshot({ path: path.join(out, "dossier-failure.png"), fullPage: true });
    throw new Error(`Dossier wait failed at ${page.url()}:\n${diagnostic}`, { cause: error });
  }
  const text = await page.locator("main").innerText();
  if (!/Los 8 datos de decisi.n (?:fueron )?revisados|All 8 decision facts reviewed/.test(text))
    throw new Error("The autonomous dossier did not account for all eight facts.");
  if (/Nos interesa.+investigarlo|Research it for me/.test(text))
    throw new Error("The reader is still being asked to operate a research agent manually.");
  console.log(`PASS autonomous dossier (${Math.round((Date.now() - startedAt) / 1000)} s)`);
  await page.screenshot({ path: path.join(out, "dossier.png"), fullPage: true });
} finally {
  await browser.close();
}
