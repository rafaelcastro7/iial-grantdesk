// Synthetic "Rocío": replays, in the browser, the requests the IIAL consultant
// used to make to ChatGPT, and checks the app answers each one. Runs as the
// QA user (qa.synthetic@iial.ca) in the QA organization; no AI calls.
// Run: node e2e/rocio-persona.live.mjs   (BASE_URL, E2E_OUT optional)
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
const ask = async (request, fn) => {
  try {
    await fn();
    results.push({ request, ok: true });
    console.log(`PASS «${request}»`);
  } catch (e) {
    results.push({ request, ok: false, error: String(e?.message ?? e).slice(0, 400) });
    console.log(`FAIL «${request}»: ${String(e?.message ?? e).slice(0, 300)}`);
  }
};
const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await ctx.newPage();
page.on("pageerror", (e) => problems.push(`pageerror ${page.url()}: ${e.message}`));
page.on("response", (r) => {
  if (r.status() >= 500) problems.push(`http ${r.status()} ${r.url().slice(0, 160)}`);
});
const shot = (n) => page.screenshot({ path: path.join(OUT, `rocio-${n}.png`), fullPage: true });
const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
const pre = (section) => page.locator(`section:has-text("${section}") pre`).first().innerText();

await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', env.SYNTH_USER_EMAIL);
await page.fill('input[type="password"]', env.SYNTH_USER_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });

await ask("Busca grants donde IIAL pueda aplicar como principal (cacao, agri-food)", async () => {
  await page.goto(`${BASE}/grants`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('a[href^="/grants/"]').first().waitFor({ timeout: 60000 });
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill("agri");
  await page.waitForTimeout(8000);
  const n = await page.locator('a[href^="/grants/"]').count();
  must(n > 0, "no results for 'agri'");
  await shot("01-search");
});

let grantHref = null;
await ask("Analiza este grant: ¿se puede aplicar ahora? ¿IIAL o Nahua?", async () => {
  grantHref = await page.locator('a[href^="/grants/"]').first().getAttribute("href");
  await page.goto(`${BASE}${grantHref}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByText("1. Can we apply?").waitFor({ timeout: 30000 });
  const text = await page.locator("body").innerText();
  must(
    /Eligible|To confirm|Not eligible|Needs/i.test(text),
    "no eligibility verdict per organization",
  );
  must(/deadline|intake|rolling|no fixed/i.test(text), "no call status / deadline");
});

await ask(
  "¿A qué se refiere 'financial statements' y 'Organization Attestation'? Explícamelo simple",
  async () => {
    const sum = page.getByText("What these requirements mean");
    await sum.waitFor({ timeout: 15000 });
    await sum.click();
    const t = await page.locator('details:has-text("What these requirements mean")').innerText();
    must(/financial|CRA|registration|letter of support/i.test(t), "glossary is empty");
  },
);

await ask("Adopta la ruta sugerida (Ruta B / R&D o Consorcio) con un solo clic", async () => {
  const routesSection = page.locator('section:has-text("2. Our decision")');
  await routesSection.getByText("Strategic suggested routes").waitFor({ timeout: 15000 });
  const adoptBtn = routesSection.getByRole("button", { name: /Adopt route/i }).first();
  if (await adoptBtn.isVisible()) {
    await adoptBtn.click();
    await page.waitForTimeout(500);
    const text = await routesSection.innerText();
    must(/Active route/i.test(text), "route not marked active after adoption");
  }
});

await ask(
  "Mensaje a Marcelo: de qué trata, WCIS, requisitos, plazos, monto, qué falta, qué gana IIAL",
  async () => {
    await page.getByRole("button", { name: "Memo to Marcelo" }).click();
    const memo = await pre("5. Write");
    for (const s of ["Hi Marcelo", "Money and dates", "What we are missing", "Recommendation"])
      must(memo.includes(s), `memo missing "${s}"`);
    must(/What .* get(s)?/i.test(memo), 'memo missing "What [Org] gets"');
  },
);

await ask(
  "Le mandé invitación por Teams el lunes 1 de junio 11am hora Perú; que sugiera otra hora",
  async () => {
    await page.getByRole("button", { name: "Partners and funders" }).click();
    const emails = page.locator('section:has-text("5. Write")');
    await emails.locator("select").first().selectOption("meeting_invite");
    await emails.locator("select").nth(1).selectOption("es");
    await page
      .getByPlaceholder(/Proposed meeting/)
      .fill("lunes 1 de junio a las 11:00 (hora de Perú) por Teams");
    const body = await emails.locator("pre").innerText();
    must(
      body.includes("lunes 1 de junio a las 11:00 (hora de Perú) por Teams"),
      "meeting time not in email",
    );
    must(/sugerir otro horario/.test(body), "no 'suggest another time'");
    must(!/audited|auditad/i.test(body), "internal blocker leaked");
    await shot("02-meeting-invite");
  },
);

await ask("Por WhatsApp mandarle quiénes somos y la presentación", async () => {
  const emails = page.locator('section:has-text("5. Write")');
  await emails.locator("select").first().selectOption("whatsapp_intro");
  const body = await emails.locator("pre").innerText();
  must(/WCIS/.test(body) && /iial\.ca/.test(body), "WhatsApp text lacks WCIS or link");
  const href = await page.getByRole("link", { name: /Open in WhatsApp/ }).getAttribute("href");
  must(href?.startsWith("https://wa.me/?text="), "no WhatsApp link");
});

await ask(
  "Dame el paso 1 y paso 2: solicitar el paquete y la inscripción (emails separados)",
  async () => {
    const emails = page.locator('section:has-text("5. Write")');
    await emails.locator("select").first().selectOption("package_request");
    must(
      /paquete de aplicación|application package/i.test(await emails.innerText()),
      "no package email",
    );
    await emails.locator("select").first().selectOption("portal_registration");
    must(/registr/i.test(await emails.locator("pre").innerText()), "no registration email");
  },
);

await ask("Un solo email a Marcelo que hable de todos los grants", async () => {
  await page.goto(`${BASE}/pipeline`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("table tbody tr").first().waitFor({ timeout: 30000 });
  await page.getByLabel("Select all").check();
  const body = await pre("One email to Marcelo");
  must(body.startsWith("Hi Marcelo"), "digest not built");
  must(/What we need/.test(body) && /Deadline/.test(body), "digest lacks needs/deadline");
  await page.locator('section:has-text("One email to Marcelo") select').selectOption("es");
  must((await pre("One email to Marcelo")).startsWith("Hola Marcelo"), "Spanish digest not built");
  await shot("03-digest");
});

await ask("¿Qué grants abren pronto? (próximos ciclos: FONTAGRO 2027, BID 2027)", async () => {
  await page.getByRole("button", { name: "Upcoming cycles" }).click();
  await page.waitForTimeout(500);
  const t = await page.locator("main").innerText();
  must(!/something went wrong/i.test(t), "pipeline upcoming filter broke the page");

  // Also check radar status filter
  await page.goto(`${BASE}/grants`, { waitUntil: "networkidle", timeout: 60000 });
  const statusTrigger = page.locator('button[aria-label="Status"]');
  if (await statusTrigger.isVisible()) {
    await statusTrigger.click();
    await page.getByRole("option", { name: "Upcoming cycles" }).click();
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    must(!/something went wrong/i.test(body), "radar upcoming filter broke the page");
  }
});

await ask("Resumen B1 para Marcelo de esta cooperativa, con servicios y link", async () => {
  await page.goto(`${BASE}/partners`, { waitUntil: "networkidle", timeout: 60000 });
  const card = page.locator("article").first();
  await card.waitFor({ timeout: 20000 });
  await card.getByRole("button", { name: "Copy brief for Marcelo" }).click();
  await page.waitForTimeout(500);
  const text = await clipboard();
  must(/^Subject: Possible partner:/.test(text) && text.includes("Hi Marcelo"), "brief not copied");
  await shot("04-partners");
});

await ask(
  "@Busca en la web: AI Web Scout switches inline in Radar with quick query pills and live search bar",
  async () => {
    await page.goto(`${BASE}/grants`, { waitUntil: "networkidle", timeout: 60000 });
    const scoutTab = page.getByRole("button", { name: /AI Web Scout/i });
    must(await scoutTab.isVisible(), "AI Web Scout tab not visible on radar toolbar");
    await scoutTab.click();
    await page.waitForTimeout(600);
    const promptInput = page.getByPlaceholder(/Ask anything to search the live web/i);
    must(await promptInput.isVisible(), "Live web search input not visible in Radar");
    const quickPill = page.getByRole("button", { name: /Canada Agri-Food 2026/i }).first();
    must(await quickPill.isVisible(), "Quick query pills not visible in Radar");
    await shot("05-web-scout-inline");
  },
);

await ask("¿Qué tengo pendiente hoy? (plazos, documentos, socios por contactar)", async () => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 60000 });
  const today = page.getByRole("list", { name: "Today" });
  await today.waitFor({ timeout: 30000 });
  const t = await today.innerText();
  must(
    /missing|Contact|Follow up|Deadline|Decide|Overdue|Register/i.test(t),
    "Today list is empty",
  );
  must(
    !/Run the grant operation/i.test(await page.locator("body").innerText()),
    "old hero still shown",
  );
  await shot("05-today");
});

fs.writeFileSync(
  path.join(OUT, "rocio-report.json"),
  JSON.stringify({ base: BASE, results, problems }, null, 2),
);
console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} requests answered; ${problems.length} problems`,
);
for (const p of [...new Set(problems)].slice(0, 20)) console.log("  -", p);
await browser.close();
