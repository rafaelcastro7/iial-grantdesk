// Grant agent end to end: recommend grants → readable steps → follow-ups →
// "Analyze in depth" on a card → work plan opens and highlights the grant.
// Uses paid/own-key AI calls. Run: node e2e/agent-chat.live.mjs
// (BASE_URL defaults to the published app; SYNTH_USER_EMAIL/PASSWORD in .env.local)
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
const BASE = process.env.BASE_URL || "https://iial-grantdesk.lovable.app";
const OUT = process.env.E2E_OUT || "e2e-artifacts";
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("iial.lang", "es"));
  await page.fill('input[type="email"]', process.env.SYNTH_USER_EMAIL || env.SYNTH_USER_EMAIL);
  await page.fill('input[type="password"]', process.env.SYNTH_USER_PASSWORD || env.SYNTH_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });

  await page.goto(`${BASE}/agent`, { waitUntil: "networkidle" });
  const box = page.locator("textarea").first();
  await box.fill("Busca grants vigentes donde podamos ser principales, agroalimentos en Latinoamérica");
  await box.press("Enter");
  await page.waitForURL(/\/agent\/[0-9a-f-]{36}/, { timeout: 30000 });

  const t0 = Date.now();
  const cards = page.getByRole("button", { name: "Analizar a fondo" });
  await cards.first().waitFor({ timeout: 240000 }).catch(() => null);
  check("recommended grant cards appear", (await cards.count()) > 0, `${Math.round((Date.now() - t0) / 1000)}s`);

  const body = await page.locator("body").innerText();
  check("no 'no fallback keys' error", !/sin claves de respaldo|no fallback keys/i.test(body));
  check("no raw tool JSON shown", !/"input":|"output":|toolCallId/.test(body));
  check("readable steps shown", /Buscando en el catálogo|Buscando en internet|Leyendo la página oficial/.test(body));

  await page.getByRole("button", { name: /^Compara estos grants|^Analiza a fondo:/ }).first()
    .waitFor({ timeout: 30000 }).catch(() => null);
  check("follow-up suggestions appear",
    (await page.getByRole("button", { name: /^Compara estos grants|^Analiza a fondo:/ }).count()) > 0);
  check("copy answer action", (await page.getByRole("button", { name: "Copiar respuesta" }).count()) > 0);
  await page.screenshot({ path: path.join(OUT, "agent-1-recommend.png"), fullPage: true });

  if ((await cards.count()) > 0) {
    const t1 = Date.now();
    await cards.first().click();
    const highlighted = page.locator("aside .ring-2");
    await highlighted.first().waitFor({ timeout: 300000 }).catch(() => null);
    check("work plan highlights analyzed grant", (await highlighted.count()) > 0, `${Math.round((Date.now() - t1) / 1000)}s`);
    await page.screenshot({ path: path.join(OUT, "agent-2-analyze.png"), fullPage: true });
  }
} catch (e) {
  check("run completed", false, e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots in ${OUT}/`);
process.exit(failed ? 1 : 0);
