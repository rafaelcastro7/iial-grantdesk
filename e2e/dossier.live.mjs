// Prepares a grant dossier in the browser and prints it.
// Run: node e2e/dossier.live.mjs [grantId]   (E2E_OUT, BASE_URL optional)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const env = Object.fromEntries([".env", ".env.local"].filter((f) => fs.existsSync(f)).flatMap((f) => fs.readFileSync(f, "utf8").split(/\r?\n/)).filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const BASE = process.env.BASE_URL || "http://localhost:5199";
const OUT = process.env.E2E_OUT || "e2e-artifacts";
const GRANT = process.argv[2] || "4c434e92-d2b0-42ee-b7cd-67547e03fa34";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.setItem("iial.lang", "es"));
await p.fill('input[type="email"]', env.SYNTH_USER_EMAIL);
await p.fill('input[type="password"]', env.SYNTH_USER_PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/auth"));
await p.goto(`${BASE}/grants/${GRANT}`, { waitUntil: "networkidle", timeout: 90000 });
const btn = p.getByRole("button", { name: /Preparar el dossier|Actualizar/ }).first();
await btn.waitFor({ timeout: 60000 });
const t0 = Date.now();
await btn.click();
await p.getByText("¿Aplicamos?", { exact: true }).or(p.getByText(/No se pudo preparar/)).first().waitFor({ timeout: 300000 });
await p.waitForTimeout(1500);
const txt = await p.locator("main").innerText();
console.log(`(${Math.round((Date.now() - t0) / 1000)} s)\n` + txt.slice(0, 9000));
await p.screenshot({ path: path.join(OUT, "dossier.png"), fullPage: true });
await b.close();
