// Synthetic Rocío replays her ChatGPT workflow in the app, with the AI on
// (free tier), and saves every answer with its timing to rocio-replay.md for
// review. Run: node e2e/rocio-replay.live.mjs  (BASE_URL, E2E_OUT optional)
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
const SSHRC =
  "https://sshrc-crsh.canada.ca/en/funding/opportunities/supplements/sustainable-agriculture-research-initiative-connection-grants.aspx";
fs.mkdirSync(OUT, { recursive: true });

const log = [];
const record = (ask, ms, answer, note = "") => {
  log.push(
    `## «${ask}»\n_${Math.round(ms / 1000)} s_ ${note}\n\n${answer.trim().slice(0, 6000)}\n`,
  );
  console.log(`✓ ${ask} (${Math.round(ms / 1000)} s)`);
};
const fail = (ask, e) => {
  log.push(`## «${ask}»\n**FALLÓ:** ${String(e?.message ?? e).slice(0, 400)}\n`);
  console.log(`✗ ${ask}: ${String(e?.message ?? e).slice(0, 200)}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await ctx.newPage();
const shot = (n) => page.screenshot({ path: path.join(OUT, `replay-${n}.png`), fullPage: true });
const main = () => page.locator("main").innerText();

await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("iial.lang", "es"));
await page.fill('input[type="email"]', env.SYNTH_USER_EMAIL);
await page.fill('input[type="password"]', env.SYNTH_USER_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });

// 1. Búsqueda (lo primero que pedía a ChatGPT)
let ask =
  "Busca grants vigentes o por abrir donde IIAL pueda aplicar como principal, con cacao o agroalimentos en Latinoamérica";
try {
  const t0 = Date.now();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  const box = page.getByRole("textbox", { name: "Buscar grants" });
  await box.waitFor({ timeout: 60000 });
  await box.fill("grants cacao agroalimentos Latinoamérica 2026 2027 abiertos");
  await box.press("Enter");
  await page.waitForURL(/\/grants$/, { timeout: 30000 });
  await page
    .getByText(/Se encontraron \d+|La búsqueda web no pudo/)
    .first()
    .waitFor({ timeout: 180000 });
  const t = await main();
  const i = t.indexOf("En internet");
  record(ask, Date.now() - t0, t.slice(i, i + 4500));
  await shot("1-search");
} catch (e) {
  fail(ask, e);
  await shot("1-search");
}

// 2. Analiza este grant (pega el enlace)
ask = "Analiza este grant (pega el enlace oficial de SSHRC)";
let grantUrl = null;
try {
  const t0 = Date.now();
  await page.goto(`${BASE}/grants`, { waitUntil: "domcontentloaded" });
  const box = page.getByRole("textbox", { name: "Buscar grants" });
  await box.waitFor({ timeout: 60000 });
  await box.fill(SSHRC);
  await box.press("Enter");
  await page.waitForURL(/\/grants\/[0-9a-f-]{36}/, { timeout: 120000 });
  grantUrl = page.url();
  const prep = page.getByRole("button", { name: "Preparar el dossier" });
  await prep
    .or(page.getByText("¿Aplicamos?", { exact: true }))
    .first()
    .waitFor({ timeout: 120000 });
  if (await prep.isVisible()) await prep.click();
  await page.getByText("¿Aplicamos?", { exact: true }).waitFor({ timeout: 300000 });
  await page.waitForTimeout(2000);
  const t = await main();
  record(ask, Date.now() - t0, t.slice(0, t.indexOf("Nuestro plan de trabajo")));
  await shot("2-dossier");
} catch (e) {
  fail(ask, e);
  await shot("2-dossier");
}

// 3. Mensaje a Marcelo
ask =
  "Mensaje a Marcelo: de qué trata, si aplica WCIS, requisitos, plazos, monto y qué nos falta para decidir";
try {
  const t0 = Date.now();
  await page.getByRole("tab", { name: /Mensajes/ }).click();
  const t = await main();
  const i = t.indexOf("Para: Marcelo");
  const wa = i >= 0 ? t.slice(i, i + 1200) : "(no hay mensaje a Marcelo en el dossier)";
  const more = page.getByText("5. Más plantillas de correo y el memo");
  if (await more.count()) await more.first().click();
  await page.getByRole("button", { name: "Memo para Marcelo" }).click();
  const memo = await page.locator('section:has-text("5. Redactar") pre').last().innerText();
  record(ask, Date.now() - t0, `### WhatsApp del dossier\n${wa}\n\n### Memo del plan\n${memo}`);
} catch (e) {
  fail(ask, e);
}

// 4. Glosario / Copilot
ask =
  "¿Qué significa SSHRC? ¿Qué es la Organization Attestation y los estados financieros que piden?";
try {
  const t0 = Date.now();
  await page.getByRole("button", { name: /^Más$/ }).first().click();
  await page.getByRole("menuitem", { name: /Copilot/ }).click();
  const ta = page.locator('[role="dialog"] textarea').last();
  await ta.waitFor({ timeout: 20000 });
  await ta.fill(
    "¿Qué significa SSHRC? ¿Y qué es la Organization Attestation y qué estados financieros piden? Explícamelo simple. Y dime si IIAL puede registrarse aunque no aplique todavía.",
  );
  await ta.press("Enter");
  await page.waitForTimeout(3000);
  await page
    .waitForFunction(() => !/Analizando la oportunidad/.test(document.body.innerText), null, {
      timeout: 240000,
    })
    .catch(() => null);
  const d = await page.locator('[role="dialog"]').last().innerText();
  const i = d.lastIndexOf("Explícamelo simple");
  record(ask, Date.now() - t0, d.slice(i, i + 4000));
  await shot("4-copilot");
  await page.keyboard.press("Escape");
} catch (e) {
  fail(ask, e);
}

// 5. Email de seguimiento al rector con plazos ajustados
ask = "Email de seguimiento al rector de la universidad, indicando que los plazos están ajustados";
try {
  const t0 = Date.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("1. ¿Podemos aplicar?").waitFor({ timeout: 60000 });
  const more = page.getByText("5. Más plantillas de correo y el memo");
  if (await more.count()) await more.first().click();
  const write = page.locator('section:has-text("5. Redactar")').last();
  await page.getByRole("button", { name: "Socios y financiadores" }).click();
  await write.locator("select").first().selectOption("deadline_reminder");
  await write.locator("select").nth(1).selectOption("es");
  record(ask, Date.now() - t0, await write.locator("pre").first().innerText());
} catch (e) {
  fail(ask, e);
}

// 6. ¿Y Nahua? (empresa de 1 mes)
ask = "¿Y Nahua Canada? Se acaba de crear hace 1 mes y empezamos a operar — ¿puede aplicar?";
try {
  const t0 = Date.now();
  const t = await main();
  const i = t.indexOf("1. ¿Podemos aplicar?");
  record(
    ask,
    Date.now() - t0,
    t.slice(i, i + 900),
    "(el usuario QA solo pertenece a la organización QA: para Nahua, Rocío cambia de organización arriba)",
  );
} catch (e) {
  fail(ask, e);
}

// 7. Un solo email con varios grants
ask = "Un solo email a Marcelo que hable de todos los grants que estamos trabajando";
try {
  const t0 = Date.now();
  await page.goto(`${BASE}/pipeline`, { waitUntil: "domcontentloaded" });
  await page.locator("table tbody tr").first().waitFor({ timeout: 60000 });
  await page.getByRole("checkbox").first().check();
  const pre = page.locator("section pre").last();
  await pre.waitFor({ timeout: 10000 });
  record(ask, Date.now() - t0, await pre.innerText());
  await shot("7-digest");
} catch (e) {
  fail(ask, e);
}

fs.writeFileSync(
  path.join(OUT, "rocio-replay.md"),
  `# Rocío — replay de sus pedidos a ChatGPT\n\n${log.join("\n---\n")}`,
);
console.log("\nreport:", path.join(OUT, "rocio-replay.md"));
await browser.close();
