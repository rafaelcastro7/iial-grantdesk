// Bilingual check: opens the consultant's pages in Spanish and in English and
// lists interface text (buttons, labels, headings, table headers, placeholders,
// aria-labels, menu) that is in the other language. Catalog data (grant titles,
// summaries, AI rationales) is not interface text and is not checked.
// Run: node e2e/bilingual.live.mjs   (BASE_URL, E2E_OUT optional)
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

// Words that only appear in one language's interface text.
const EN_WORDS =
  /\b(the|and|with|your|our|we|you|save|add|search|find|show|open|copy|delete|edit|missing|ready|deadline|amount|partners?|grants? we|more|details|select|export|choose|loading|nothing|today|apply|decision|documents?|write|country|email|priority|status|role|next step|settings|profile|sign (in|out)|language)\b/i;
const ES_WORDS =
  /\b(el|los|las|del|con|nuestr[oa]s?|guardar|agregar|añadir|buscar|mostrar|abrir|copiar|eliminar|editar|falta|listo|fecha|monto|socios|más|detalles|seleccionar|exportar|elegir|cargando|nada|hoy|aplicar|decisión|documentos|escribir|país|correo|prioridad|estado|rol|próximo|perfil|idioma|iniciar sesión)\b/i;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', env.SYNTH_USER_EMAIL);
await page.fill('input[type="password"]', env.SYNTH_USER_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });

const collect = () =>
  page.evaluate(() => {
    const out = [];
    const sel =
      "button, label, h1, h2, h3, h4, th, summary, nav a, [role=tab], option, dt, legend";
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest("[data-no-i18n], pre, [contenteditable]")) continue;
      const t = (el.innerText || "").trim().replace(/\s+/g, " ");
      if (t && t.length > 2 && t.length < 120) out.push(t);
    }
    for (const el of document.querySelectorAll("[placeholder], [aria-label], [title]")) {
      for (const a of ["placeholder", "aria-label", "title"]) {
        const v = el.getAttribute(a);
        if (v && v.length > 2 && v.length < 120 && !/^https?:/.test(v)) out.push(v);
      }
    }
    return [...new Set(out)];
  });

const report = {};
let grantPath = null;
for (const lang of ["es", "en"]) {
  await page.evaluate((l) => localStorage.setItem("iial.lang", l), lang);
  const routes = ["/dashboard", "/grants", "/pipeline", "/partners", "/org"];
  if (grantPath) routes.splice(2, 0, grantPath);
  for (const r of routes) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(r === "/grants" ? 10000 : 3000);
    if (r === "/grants" && !grantPath) {
      grantPath = await page.locator('a[href^="/grants/"]').first().getAttribute("href").catch(() => null);
      if (grantPath) routes.splice(2, 0, grantPath);
    }
    const texts = await collect();
    const wrong = texts.filter((t) =>
      lang === "es" ? EN_WORDS.test(t) && !ES_WORDS.test(t) : ES_WORDS.test(t) && !EN_WORDS.test(t),
    );
    report[`${lang} ${r}`] = wrong;
    await page.screenshot({ path: path.join(OUT, `i18n-${lang}${r.replace(/\//g, "_")}.png`), fullPage: true });
    console.log(`${lang.toUpperCase()} ${r}: ${wrong.length} strings in the other language`);
    for (const w of wrong.slice(0, 25)) console.log("    ·", w);
  }
}
fs.writeFileSync(path.join(OUT, "bilingual-report.json"), JSON.stringify(report, null, 2));
const total = Object.values(report).reduce((n, a) => n + a.length, 0);
console.log(`\n${total} interface strings in the wrong language`);
await browser.close();
