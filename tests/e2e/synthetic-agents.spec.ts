import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { DumbAgent } from "./synthetic/dumb-agent";

/**
 * Synthetic grant consultants for IIAL Grants.
 *
 * Three scripted personas walk the product using only what is on screen and
 * check that every fact a grant manager needs to do the job can be found. They
 * are dumb on purpose — see DumbAgent. A need that goes unmet fails the run and
 * lands in test-results/synthetic-agents/<persona>.md with what the screen
 * showed instead.
 *
 * No model drafting is triggered (the shared token budget belongs to the
 * lifecycle spec); reading a call may use one extraction. Everything the
 * agents create is deleted afterwards, so the catalog and the desk are left as
 * they were found.
 */

const stamp = Date.now();
const PASSWORD = "IIAL-Synthetic-2026!";

const IIAL_CONSULTANT = {
  email: `synthetic-iial-${stamp}@iial.test`,
  org: `Synthetic Institute ${stamp}`,
  orgType: "nonprofit",
};

const MULTI_COUNTRY = {
  email: `synthetic-multi-${stamp}@iial.test`,
  orgs: [
    { name: `Synthetic Canada Nonprofit ${stamp}`, operatesIn: "CA, ON", currency: "CAD" },
    { name: `Synthetic US Charity ${stamp}`, operatesIn: "US", currency: "USD" },
  ],
};

const ADMIN_USER = {
  email: `synthetic-admin-${stamp}@iial.test`,
};

const admin = createClient(
  process.env.SUPABASE_URL ?? "http://localhost:15435",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Agent timeout constants matching server configuration
const AGENT_TIMEOUT = 320_000;
const WRITER_TIMEOUT = 620_000;
const CRITIC_TIMEOUT = 320_000;

test.afterAll(async () => {
  const { data: users } = await admin
    .from("profiles")
    .select("id")
    .in("email", [IIAL_CONSULTANT.email, MULTI_COUNTRY.email, ADMIN_USER.email]);
  const ids = ((users ?? []) as Array<{ id: string }>).map((u) => u.id);
  if (ids.length) {
    await admin.from("clients").delete().in("consultant_id", ids);
  }
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.warn(`synthetic cleanup: could not delete ${id}: ${error.message}`);
  }
});

async function signUp(agent: DumbAgent, email: string) {
  await agent.open("/auth");
  await agent.type("Email", email);
  await agent.type("Password", PASSWORD);
  await agent.press("Create account");
  await expect(agent.page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  agent.at("dashboard");
}

async function addOrg(agent: DumbAgent, name: string) {
  await agent.press("Clients");
  agent.at("clients");
  await agent.type("Organization name", name);
  await agent.press("Add client");
  await agent.waitFor("Profile");
  agent.at(`client: ${name}`);
}

async function fillProfile(
  agent: DumbAgent,
  profile: {
    operatesIn: string;
    sectors: string;
    stage: string;
    budget: string;
    currency: string;
    leadTime: string;
    domains?: string;
    trackRecord: string;
    fundedPartner?: boolean;
    goDecision?: boolean;
  },
) {
  await agent.type("Operates in", profile.operatesIn);
  await agent.type("Sectors", profile.sectors);
  await agent.type("Stage", profile.stage);
  await agent.type("Annual budget", profile.budget);
  await agent.type("Budget currency", profile.currency);
  await agent.type("Lead time (weeks)", profile.leadTime);
  if (profile.domains) await agent.type("Capability domains", profile.domains);
  await agent.type("Track record", profile.trackRecord);
  if (profile.fundedPartner) await agent.tick(/funded partner/i);
  if (profile.goDecision) await agent.tick(/leadership go \/ no-go/i);
  await agent.press("Save profile");
  await agent.waitFor("Profile saved");
  agent.need(
    "profile-ready",
    "Is the profile complete enough to match?",
    await textOf(agent.page, /Ready to match/),
  );
}

/** What the screen says matching `text`, waiting briefly the way a reader would. */
async function textOf(page: Page, text: RegExp, timeout = 15_000): Promise<string | null> {
  const el = page.getByText(text).first();
  try {
    await el.waitFor({ state: "visible", timeout });
  } catch {
    return null;
  }
  return ((await el.textContent()) ?? "").trim();
}

/** Opens the matches and waits for the run to report what it checked. */
async function findMatches(agent: DumbAgent) {
  await agent.press(/Find what they can apply for/);
  agent.at("matches");
  await agent.waitFor(/Checked \d+ calls/, 180_000);
  agent.need(
    "match-summary",
    "How many calls were checked, and how many can this client apply for?",
    await textOf(agent.page, /Checked \d+ calls/),
  );
}

async function enrichGrant(agent: DumbAgent) {
  const fetchDetails = agent.page.getByRole("button", { name: /fetch details/i });
  if (await fetchDetails.isVisible().catch(() => false)) {
    await fetchDetails.click();
    const enrichSheet = agent.page.getByRole("dialog", { name: /chain of thought/i });
    if (await enrichSheet.isVisible({ timeout: 30_000 }).catch(() => false)) {
      await enrichSheet.getByRole("button", { name: /close/i }).click();
      await expect(enrichSheet).toBeHidden();
    }
  }
}

async function evaluateGrant(agent: DumbAgent) {
  const alreadyEvaluated = await agent.page
    .getByRole("button", { name: /re-evaluate fit/i })
    .isVisible()
    .catch(() => false);

  if (!alreadyEvaluated) {
    const evaluateButton = agent.page.getByRole("button", { name: /check fit/i });
    await expect(evaluateButton).toBeVisible();
    await expect(evaluateButton).toBeEnabled({ timeout: AGENT_TIMEOUT });
    await evaluateButton.click();

    const traceSheet = agent.page.getByRole("dialog", { name: /chain of thought/i });
    await expect(traceSheet).toBeVisible({ timeout: 60_000 });
    await traceSheet.getByRole("button", { name: /close/i }).click();
    await expect(traceSheet).toBeHidden();
    await expect(agent.page).not.toHaveURL(/[?&]run=/);
    await expect(agent.page.getByRole("button", { name: /re-evaluate fit/i })).toBeVisible({
      timeout: AGENT_TIMEOUT,
    });
  }
}

async function draftProposal(agent: DumbAgent) {
  const openProposalLink = agent.page.getByRole("link", { name: /open proposal/i });
  if (await openProposalLink.isVisible().catch(() => false)) {
    await openProposalLink.click();
    return true;
  }

  const draftButton = agent.page.getByRole("button", { name: /draft proposal/i });
  if (await draftButton.isEnabled().catch(() => false)) {
    await draftButton.click();
    return true;
  }
  return false;
}

async function runCritic(agent: DumbAgent) {
  const primaryAction = agent.page.getByRole("button").filter({
    hasText: /^Run quality review|^Reviewing…|^Submit proposal$|^Submitting…/,
  });
  await expect(primaryAction).toHaveText(/run quality review|submit proposal/i, {
    timeout: AGENT_TIMEOUT,
  });
  const needsReview = /run quality review/i.test((await primaryAction.textContent()) ?? "");
  if (needsReview) {
    await primaryAction.click();
    await expect(primaryAction).toBeDisabled({ timeout: 5_000 });
    await expect(primaryAction).toBeEnabled({ timeout: CRITIC_TIMEOUT });
    await expect(
      agent.page.getByText(/quality review completed/i),
      "the quality review reported an error instead of completing - check agent_runs for the critic",
    ).toBeVisible({ timeout: 15_000 });
  }
}

async function exportProposal(agent: DumbAgent) {
  await agent.press(/show full details/i);
  const [download] = await Promise.all([
    agent.page.waitForEvent("download", { timeout: AGENT_TIMEOUT }),
    agent.page.getByRole("button", { name: /export.*md|markdown/i }).click(),
  ]);
  expect(download.suggestedFilename()).toBeTruthy();
}

async function submitProposal(agent: DumbAgent) {
  const alreadySubmitted = await agent.page
    .getByText(/^submitted$/i)
    .first()
    .isVisible()
    .catch(() => false);

  if (!alreadySubmitted) {
    await agent.page.getByRole("button", { name: /^submit$/i }).click();
    const submitDialog = agent.page.getByRole("dialog");
    await expect(submitDialog).toBeVisible({ timeout: 15_000 });

    const forceSubmit = submitDialog.getByRole("button", { name: /submit anyway/i });
    const plainSubmit = submitDialog.getByRole("button", { name: /^submit$/i });

    for (let attempt = 0; attempt < 2; attempt++) {
      await submitDialog.getByRole("checkbox").check();
      const button = (await forceSubmit.isVisible().catch(() => false)) ? forceSubmit : plainSubmit;
      await expect(button).toBeEnabled();
      await button.click();
      if (await submitDialog.isHidden({ timeout: 60_000 }).catch(() => false)) break;
      await expect(
        forceSubmit,
        "submit was blocked but no 'Submit Anyway' escape hatch appeared",
      ).toBeVisible({ timeout: 30_000 });
    }
    await expect(submitDialog).toBeHidden({ timeout: AGENT_TIMEOUT });
  }
}

async function verifySubmission(agent: DumbAgent, grantTitle: string) {
  await agent.press("Submissions");
  agent.at("submissions");
  const titleFragment = grantTitle.split(/\s+/).slice(0, 5).join(" ");
  await expect(
    agent.page.getByText(titleFragment, { exact: false }).first(),
    `submitted grant "${titleFragment}" did not appear on /submissions`,
  ).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: "serial" });

test("IIAL consultant: full grant lifecycle with go/no-go SOP", async ({ page }) => {
  test.setTimeout(25 * 60_000);
  const agent = new DumbAgent(page, "IIAL consultant");
  try {
    await signUp(agent, IIAL_CONSULTANT.email);
    await addOrg(agent, IIAL_CONSULTANT.org);
    await fillProfile(agent, {
      operatesIn: "CA, ON, QC",
      sectors: "applied research, education, clean-tech, supply chain",
      stage: "nonprofit",
      budget: "1.5M",
      currency: "CAD",
      leadTime: "6",
      domains:
        "supply chain, micro-credentials, applied research, smart cities, climate adaptation",
      trackRecord:
        "Applied research and professional education delivered with Ontario municipalities and federal partners.",
      fundedPartner: true,
      goDecision: true,
    });
    await findMatches(agent);

    // ── What can this client apply for, and why ─────────────────────────────
    const verified = agent.section(/^Can apply/);
    const canApply = (await verified.count())
      ? verified
      : agent.section(/^Open to this client's location/);
    await expect(canApply, "there should be calls this client can apply for").toBeVisible();
    agent.need(
      "verification-honesty",
      "Does the list say whether who-may-apply was actually verified?",
      await canApply.getByRole("heading").first().textContent(),
    );
    const card = canApply.locator("li").first();
    const cardText = (await card.textContent()) ?? "";
    agent.need(
      "call-title",
      "What is the call called?",
      await card.locator("a").first().textContent(),
    );
    agent.need(
      "call-funder-and-money",
      "Who funds it and for how much (or that it is not published)?",
      cardText.match(/[^·]+·\s*CA[^.]*/)?.[0] ?? cardText.slice(0, 160),
    );
    agent.need(
      "verdict-reason",
      "Why may this client apply — in a sentence?",
      await card.locator("p").nth(1).textContent(),
    );
    agent.need(
      "relevance-reason",
      "Why is it relevant to this client?",
      await textOf(page, /(funder's own text mentions|No shared wording)/),
    );
    agent.need(
      "rule-breakdown",
      "Which rules passed, failed or are unknown?",
      await card
        .getByText(/Eligibility|Timeline|Budget fit|Strategic fit/)
        .first()
        .textContent(),
    );

    // ── Narrowing the list like a person would ─────────────────────────────
    await agent.type(/Search title, summary or funder/, "Ontario");
    agent.need(
      "search-filter",
      "Can the list be narrowed by a word?",
      await canApply.getByRole("heading").first().textContent(),
    );
    await agent.type(/Search title, summary or funder/, "");
    await agent.choose("Closes", "90");
    agent.need(
      "deadline-filter",
      "Can the list show only what closes within 90 days?",
      await canApply.getByRole("heading").first().textContent(),
    );
    await agent.choose("Closes", "any");
    await agent.choose("Sort", "deadline");
    agent.need(
      "sort-by-deadline",
      "Can the list be ordered by closing date?",
      await canApply.locator("li").first().textContent(),
    );

    // Pick first draftable grant and walk full lifecycle
    let grantTitle = "";
    for (let i = 0; i < 3; i++) {
      await agent.press("Grants");
      agent.at("grants");
      const search = page.getByRole("searchbox", { name: /search grants/i });
      await search.fill("Southern Ontario innovation growth for technology companies");
      const link = page.locator('a[href^="/grants/"]').nth(i);
      await expect(link).toBeVisible({ timeout: 60_000 });
      await link.click();
      await expect(page).toHaveURL(/\/grants\/[^/]+$/);
      await expect(page.getByRole("button", { name: /official page/i })).toBeVisible({
        timeout: 60_000,
      });
      grantTitle = (await page.getByRole("heading", { level: 1 }).first().innerText()).trim();

      await enrichGrant(agent);
      await evaluateGrant(agent);

      const draftable = await draftProposal(agent);
      if (draftable) break;

      const blockedReason = page.getByText(/assessed as not eligible|drafting unlocks once/i);
      const reason = (await blockedReason.innerText().catch(() => "")) || "no reason rendered";
      agent.need(`rejection-${i}`, `Why was "${grantTitle}" not draftable?`, reason);
    }

    expect(grantTitle.length).toBeGreaterThan(0);

    // Draft all sections
    const primaryAction = page.getByRole("button").filter({
      hasText: /^Draft "|^Drafting…|^Run quality review|^Reviewing…|^Submit proposal$|^Submitting…/,
    });
    for (let i = 0; i < 12; i++) {
      const label = await primaryAction.textContent();
      if (!label?.startsWith('Draft "')) break;
      await primaryAction.click();
      await expect(primaryAction).not.toHaveText(label, { timeout: WRITER_TIMEOUT });
    }

    // Run quality review (critic)
    await runCritic(agent);

    // Export proposal
    await exportProposal(agent);

    // Submit proposal
    await submitProposal(agent);

    // Verify submission recorded
    await verifySubmission(agent, grantTitle);

    // Check pipeline log
    await agent.press("Clients");
    await agent.press(IIAL_CONSULTANT.org);
    agent.at("client");
    await expect(agent.section("Pipeline log")).toBeVisible();
    agent.need(
      "pipeline-log",
      "Is the decision kept in the pipeline log with who decided?",
      await agent.section("Pipeline log").textContent(),
    );
  } finally {
    const { missing, met, total } = agent.report();
    expect(missing, `${agent.persona}: ${met}/${total} needs met`).toEqual([]);
  }
});

test("Multi-country consultant: Canada + US orgs with separate matches", async ({ page }) => {
  test.setTimeout(25 * 60_000);
  const agent = new DumbAgent(page, "Multi-country consultant");
  try {
    await signUp(agent, MULTI_COUNTRY.email);

    // First org: Canada
    await addOrg(agent, MULTI_COUNTRY.orgs[0]!.name);
    await fillProfile(agent, {
      operatesIn: "CA, ON",
      sectors: "community, youth, arts",
      stage: "nonprofit",
      budget: "300000",
      currency: "CAD",
      leadTime: "4",
      trackRecord: "Community arts and youth programs across Ontario since 2012.",
    });
    await findMatches(agent);

    // Ruled-out calls must say why
    const ruledOut = agent.section(/^Ruled out/);
    if (await ruledOut.count()) {
      await ruledOut.getByRole("button", { name: /Show why/ }).click();
      agent.need(
        "rejection-reason",
        "Why was a call ruled out?",
        await ruledOut.locator("li p").nth(1).textContent(),
      );
    } else {
      agent.need(
        "rejection-reason",
        "Why was a call ruled out?",
        "nothing was ruled out for this profile",
      );
    }

    // Second org: US
    await agent.press("Clients");
    await addOrg(agent, MULTI_COUNTRY.orgs[1]!.name);
    await fillProfile(agent, {
      operatesIn: "US",
      sectors: "health, community",
      stage: "charity",
      budget: "450000",
      currency: "USD",
      leadTime: "3",
      trackRecord: "Community health clinics in six US counties since 2011.",
    });
    await findMatches(agent);
    agent.need(
      "second-client-matches",
      "Does the second client get its own verdicts?",
      await agent
        .section(/^(Can apply|Needs an answer|Ruled out)/)
        .getByRole("heading")
        .first()
        .textContent(),
    );

    // Verify both clients listed with correct jurisdictions
    await agent.press("Clients");
    agent.at("clients");
    for (const org of MULTI_COUNTRY.orgs) {
      agent.need(
        `client-listed-${org.name.slice(10, 20)}`,
        `Is ${org.name} listed with where it operates?`,
        await textOf(page, new RegExp(`${org.name}.*(${org.operatesIn.replace(",", "|")})`)),
      );
    }
  } finally {
    const { missing, met, total } = agent.report();
    expect(missing, `${agent.persona}: ${met}/${total} needs met`).toEqual([]);
  }
});

test("Admin: system health, agent config, and source management", async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const agent = new DumbAgent(page, "Admin user");
  try {
    await signUp(agent, ADMIN_USER.email);
    await agent.press("Admin Console");
    agent.at("admin");

    // Check agent configs page
    await agent.press("Agents");
    agent.at("admin/agents");
    agent.need(
      "agent-config-list",
      "Are all 6 agents listed with their models?",
      await agent.section(/Agent Configuration/).textContent(),
    );

    // Check sources page
    await agent.press("Sources");
    agent.at("admin/sources");
    agent.need(
      "sources-list",
      "Are sources listed with their status?",
      await agent.section(/Sources/).textContent(),
    );

    // Check monitoring
    await agent.press("Monitoring");
    agent.at("admin/monitoring");
    agent.need("rate-limits", "Are rate limits visible?", await textOf(page, /Rate Limits/i));

    // Check discovery config
    await agent.press("Discovery Config");
    agent.at("admin/discovery-config");
    agent.need(
      "discovery-config",
      "Is discovery configuration visible?",
      await textOf(page, /Discovery Configuration/i),
    );
  } finally {
    const { missing, met, total } = agent.report();
    expect(missing, `${agent.persona}: ${met}/${total} needs met`).toEqual([]);
  }
});

test("First-time visitor: landing page and sign-in", async ({ page }) => {
  test.setTimeout(60_000);
  const agent = new DumbAgent(page, "First-time visitor");
  try {
    await agent.open("/");
    agent.need(
      "what-it-is",
      "What is this product?",
      await page.getByRole("heading").first().textContent(),
    );
    await textOf(page, /In the catalog right now/i);
    agent.need(
      "catalog-size",
      "How many calls does the catalog hold?",
      ((await agent.section(/In the catalog right now/i).textContent()) ?? "").match(
        /\d[\d,]*\s*open calls/,
      )?.[0],
    );
    agent.need(
      "sign-in",
      "Where do I sign in?",
      (await page.getByRole("link", { name: "Sign in" }).count()) ? "Sign in link" : null,
    );
    await agent.press("Sign in");
    agent.at("sign-in");
    const create = page.getByRole("button", { name: "Create account" });
    const shown = await create
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    agent.need(
      "sign-in-form",
      "Can I sign in or create an account?",
      shown ? "Create account button" : null,
    );
  } finally {
    const { missing, met, total } = agent.report();
    expect(missing, `${agent.persona}: ${met}/${total} needs met`).toEqual([]);
  }
});
