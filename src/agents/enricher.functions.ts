import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EnricherOutput, PROMPTS } from "@/agents/schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_ENRICH_ATTEMPTS } from "@/agents/pipeline-stages.shared";
import { grantTitleTokens, pageLooksRelevantToGrant } from "@/agents/deep-crawl-relevance.shared";

export type EnricherResult = {
  ok: boolean;
  runId: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
  filled?: string[];
  deterministic_counts?: Record<string, number>;
  provider?: string;
  attempts?: import("@/lib/web-fetch.server").FetchAttempt[];
};

type EnricherDb = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Supabase query builder is intentional
  from: (table: string) => any;
};

export async function enrichGrantImpl(
  grantId: string,
  opts?: { db?: EnricherDb; userId?: string | null; force?: boolean },
): Promise<EnricherResult> {
  const data = { grantId };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { newRunId } = await import("@/lib/otel");
  const { scrapeWithFallback } = await import("@/lib/web-fetch.server");
  const { extractAmounts } = await import("@/agents/extractors/amounts.server");
  const { extractDeadline } = await import("@/agents/extractors/deadlines.server");
  const { extractEligibility } = await import("@/agents/extractors/eligibility.server");
  const { extractSectors } = await import("@/agents/extractors/sectors.server");
  const { extractGrantFacets } = await import("@/agents/extractors/facets.server");
  const { stripBoilerplate, looksLikeErrorPage } =
    await import("@/agents/extractors/boilerplate.shared");
  const { recordEvidence, snippetIsGrounded } = await import("@/agents/evidence.server");
  const { traceStep } = await import("@/agents/trace.server");
  const db = opts?.db ?? supabaseAdmin;
  const actorUserId = opts?.userId ?? null;

  const runId = newRunId();
  const t0 = Date.now();
  const trace = (
    step: string,
    message: string,
    status: "info" | "ok" | "warn" | "error" | "start" | "done" = "info",
    payload?: Record<string, unknown>,
  ) =>
    traceStep({
      runId,
      grantId: data.grantId,
      agent: "enricher",
      step,
      status,
      message,
      payload,
      db,
    });

  await trace("init", `Starting enrichment for grant ${data.grantId.slice(0, 8)}`, "start");

  const { data: g, error } = await db
    .from("grants")
    .select(
      "id, title, summary, eligibility_note, language, url, status, amount_cad_min, amount_cad_max, deadline, eligibility, sectors, applicant_types, populations_served, funding_uses, funder_type, deadline_kind, source_freshness_at, enrich_attempts, confirmed_source_urls, country, funder:funders(name)",
    )
    .eq("id", data.grantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!g) throw new Error("grant_not_found");
  if (g.status !== "discovered" && !opts?.force) {
    await trace("skip", `Skipped - status is "${g.status}", not "discovered"`, "warn");
    return { ok: true, skipped: true, reason: `status=${g.status}`, runId };
  }
  const currentAttempts = (g as { enrich_attempts?: number }).enrich_attempts ?? 0;
  if (currentAttempts >= MAX_ENRICH_ATTEMPTS && !opts?.force) {
    await trace("skip", `Skipped - max ${MAX_ENRICH_ATTEMPTS} enrich attempts reached`, "warn");
    return { ok: true, skipped: true, reason: "max_attempts_reached", runId };
  }

  // Atomically claim this enrichment slot (optimistic lock). The extra .eq()
  // guards mean only ONE concurrent worker can advance enrich_attempts from
  // currentAttempts while the grant is still "discovered" — the loser matches
  // zero rows and skips. This also makes the attempt counter exact (the
  // increment happens once, here, instead of read-modify-write on each
  // failure path).
  let claimQuery = db
    .from("grants")
    .update({
      enrich_attempts: currentAttempts + 1,
      enrich_last_attempt_at: new Date().toISOString(),
    })
    .eq("id", g.id);

  if (!opts?.force) {
    if ((g as { enrich_attempts?: number | null }).enrich_attempts == null) {
      claimQuery = claimQuery.is("enrich_attempts", null);
    } else {
      claimQuery = claimQuery.eq("enrich_attempts", currentAttempts);
    }
    claimQuery = claimQuery.eq("status", "discovered");
  }
  const { data: claimed, error: claimErr } = await claimQuery.select("id");
  if (claimErr) throw new Error(claimErr.message);
  if (!opts?.force && (!claimed || (Array.isArray(claimed) && claimed.length === 0))) {
    await trace("skip", "Skipped - another worker claimed this grant concurrently", "warn");
    return { ok: true, skipped: true, reason: "claimed_by_another_worker", runId };
  }

  const hasAmountMin = g.amount_cad_min != null;
  const hasAmountMax = g.amount_cad_max != null;
  const hasAmount = hasAmountMin || hasAmountMax;
  // A deadline already in the past belongs to an earlier cycle: treat it as
  // missing so this run looks for the current one.
  const hasDeadline = !!g.deadline && g.deadline >= new Date().toISOString().slice(0, 10);
  const hasSectors = Array.isArray(g.sectors) && g.sectors.length > 0;
  const eligObj = (g.eligibility ?? {}) as Record<string, unknown>;
  const hasEligibility = Object.keys(eligObj).length > 0;

  await trace(
    "inventory",
    `Existing fields: ${[hasAmount && "amount", hasDeadline && "deadline", hasSectors && "sectors", hasEligibility && "eligibility"].filter(Boolean).join(", ") || "(none)"}`,
    "info",
    { hasAmount, hasAmountMin, hasAmountMax, hasDeadline, hasSectors, hasEligibility },
  );

  if (hasAmount && hasDeadline && hasSectors && hasEligibility && !opts?.force) {
    await trace("done", "Grant already complete - marking enriched without scraping", "done");
    await db
      .from("grants")
      .update({
        status: "enriched",
        enriched_at: new Date().toISOString(),
      })
      .eq("id", g.id);
    await db.from("agent_runs").insert({
      run_id: runId,
      agent: "enricher",
      status: "succeeded",
      model: "noop",
      input_tokens: 0,
      output_tokens: 0,
      latency_ms: Date.now() - t0,
      user_id: actorUserId,
      grant_id: g.id,
      metadata: { mode: "already_complete" },
    });
    return { ok: true, runId, skipped: true, reason: "already_complete" };
  }

  await trace("scrape", `Fetching ${g.url}`, "start");
  const tScrape = Date.now();
  const rawScrape = await scrapeWithFallback(g.url);
  // A soft-404 (HTTP 200 + "page not found" body) is a failed scrape: its site
  // menus were being read as grant facts. Fall back to the stored text instead.
  const softNotFound = rawScrape.ok && looksLikeErrorPage(rawScrape.markdown);
  // A moved/removed page usually still has an archived copy from when it was
  // live; that beats the short stored summary. The evidence cites the archive
  // URL so a reviewer can see the facts are from a past capture.
  const archived = softNotFound
    ? await (await import("@/lib/web-fetch.server")).lastGoodArchivedPage(g.url)
    : null;
  const usableArchive = archived && !looksLikeErrorPage(archived.markdown) ? archived : null;
  const scraped = usableArchive
    ? {
        ...rawScrape,
        ok: true as const,
        url: usableArchive.url,
        markdown: usableArchive.markdown,
        via: "wayback" as const,
      }
    : softNotFound
      ? { ...rawScrape, ok: false as const, error: "soft_404_error_page", markdown: "" }
      : rawScrape;
  const sourceUrl = usableArchive ? usableArchive.url : g.url;
  if (usableArchive) {
    await trace(
      "scrape",
      `Live page is a 404; using archived capture from ${usableArchive.capturedAt}`,
      "warn",
      { archive_url: usableArchive.url },
    );
  }
  const fetchAttempts = scraped.attempts ?? [];

  let sourceMarkdown = scraped.ok ? scraped.markdown : "";
  let sourceVia = scraped.ok ? scraped.via : "none";

  if (!scraped.ok) {
    // If the live web fetch failed, check if we have stored summary or eligibility note
    const held = [g.title, g.summary, (g as { eligibility_note?: string | null }).eligibility_note]
      .filter(Boolean)
      .join("\n\n");
    if (held.trim().length >= 50) {
      sourceMarkdown = held;
      sourceVia = "stored_summary";
      await trace(
        "scrape",
        `Live scrape unavailable (${scraped.error}), using stored grant text (${held.length} chars)`,
        "warn",
        {
          via: sourceVia,
          duration_ms: Date.now() - tScrape,
          attempts: fetchAttempts,
        },
      );
    } else {
      const msg = `scrape_failed: ${scraped.error}`;
      await trace("scrape", msg, "error", {
        via: scraped.via,
        duration_ms: Date.now() - tScrape,
        attempts: fetchAttempts,
      });
      await db
        .from("grants")
        .update({
          enrich_last_error: msg.slice(0, 500),
          enrich_last_attempt_at: new Date().toISOString(),
        })
        .eq("id", g.id);
      await db.from("agent_runs").insert({
        run_id: runId,
        agent: "enricher",
        status: "failed",
        model: "scrape",
        latency_ms: Date.now() - t0,
        user_id: actorUserId,
        grant_id: g.id,
        error: msg,
        metadata: { via: scraped.via, fetch_attempts: fetchAttempts },
      });
      return { ok: false, runId, error: msg, attempts: fetchAttempts };
    }
  }

  const language = (g.language as "en" | "fr") ?? "en";
  const patch: Record<string, unknown> = {};
  const methodCounts = { regex: 0, chrono: 0, rule: 0, llm: 0 };
  const pages: Array<{ url: string; markdown: string }> = [
    { url: sourceUrl, markdown: sourceMarkdown },
  ];
  if (/^https?:\/\/(?:www\.)?grants\.gov\/search-results-detail\//i.test(g.url)) {
    try {
      const { fetchGrantsGovOpportunitySource } =
        await import("@/agents/sources/grants-gov-opportunity.server");
      const official = await fetchGrantsGovOpportunitySource(g.url);
      if (official?.markdown) {
        // The Grants.gov HTML page is a JS shell (session modal, no data);
        // reading it produced same-day "deadlines" from "expire in 3 minutes".
        pages[0] = { url: g.url, markdown: official.markdown };
        if (official.detailUrl && !pages.some((page) => page.url === official.detailUrl)) {
          const detail = await scrapeWithFallback(official.detailUrl);
          if (detail.ok) pages.push({ url: official.detailUrl, markdown: detail.markdown });
        }
        // Past awards for the program's assistance listing (USAspending), and
        // the listing numbers themselves. Best-effort, separate write.
        // With many listings (umbrella NIH notices) the first one is arbitrary
        // and its awards would mislead; only use history for 1-2 listings.
        const listing =
          official.assistanceListings.length <= 2 ? official.assistanceListings[0] : undefined;
        if (listing) {
          try {
            const { fetchUsAwardsForListing } = await import("@/agents/sources/us-awards.server");
            const history = await fetchUsAwardsForListing(listing.number, listing.title);
            const { error: historyError } = await db
              .from("grants")
              .update({
                assistance_listings: official.assistanceListings.map((item) => item.number),
                ...(history ? { historical_awards: history } : {}),
              } as never)
              .eq("id", g.id);
            if (history && !historyError) {
              await trace(
                "history",
                `${history.sample} recent awards for CFDA ${listing.number} (median $${history.median})`,
                "done",
              );
            }
          } catch {
            // No history: enrichment continues.
          }
        }
        await trace("official_api", "Loaded structured Grants.gov opportunity details", "done", {
          chars: official.markdown.length,
          detail_url: official.detailUrl,
        });
      }
    } catch (apiError) {
      await trace(
        "official_api",
        `Structured Grants.gov details unavailable: ${apiError instanceof Error ? apiError.message : String(apiError)}`,
        "warn",
      );
    }
  }
  // Past federal awards for Canadian programs (context for a realistic ask).
  // Written separately and best-effort so a missing column or an unreachable
  // dataset never fails the enrichment itself.
  if ((g as { country?: string | null }).country === "CA") {
    try {
      const { fetchHistoricalAwards } = await import("@/agents/sources/canada-gc-awards.server");
      const funderRel = (g as { funder?: { name?: string } | Array<{ name?: string }> | null })
        .funder;
      const funderName = Array.isArray(funderRel) ? funderRel[0]?.name : funderRel?.name;
      const history = await fetchHistoricalAwards(g.title, funderName);
      if (history) {
        const { error: historyError } = await db
          .from("grants")
          .update({ historical_awards: history } as never)
          .eq("id", g.id);
        await trace(
          "history",
          historyError
            ? `Historical awards found but not stored: ${historyError.message}`
            : `${history.count} past awards for "${history.program}" (median ${history.median})`,
          historyError ? "warn" : "done",
        );
      }
    } catch (historyErr) {
      await trace(
        "history",
        `Historical awards unavailable: ${String(historyErr).slice(0, 120)}`,
        "warn",
      );
    }
  }

  const missingFields = () => {
    const missing: string[] = [];
    if (!hasAmountMin && patch.amount_cad_min == null) missing.push("amount_cad_min");
    if (!hasAmountMax && patch.amount_cad_max == null) missing.push("amount_cad_max");
    if (!hasDeadline && patch.deadline == null) missing.push("deadline");
    if (!hasEligibility && patch.eligibility == null) missing.push("eligibility");
    if (!hasSectors && patch.sectors == null) missing.push("sectors");
    return missing;
  };
  const pageForQuote = (quote: string) =>
    pages.find((page) => snippetIsGrounded(quote, page.markdown)) ?? null;
  const titleTokens = grantTitleTokens(g.title);
  const isRelevantPage = (page: { url: string; markdown: string }) =>
    !looksLikeErrorPage(page.markdown) && pageLooksRelevantToGrant(page, titleTokens);
  const supportedFacetValues = new Map<string, Set<string>>();

  await trace("scrape", `Scraped ${sourceMarkdown.length} chars via ${sourceVia}`, "done", {
    via: sourceVia,
    chars: sourceMarkdown.length,
    duration_ms: Date.now() - tScrape,
    attempts: fetchAttempts,
  });

  await trace("extractors", "Running deterministic extractors (regex / chrono / rules)", "start");

  const runExtractorsOnPage = async (
    page: { url: string; markdown: string },
    stage: "main" | "deep",
  ) => {
    // Mutates the shared page so evidence grounding and the LLM stage see the
    // same chrome-free text the extractors read.
    page.markdown = stripBoilerplate(page.markdown);
    const facetMatches = extractGrantFacets(page.markdown);
    for (const match of facetMatches) {
      methodCounts.rule++;
      await recordEvidence({
        grantId: g.id,
        agent: "enricher",
        field: `facet.${match.field}`,
        value: { assertion: match.assertion, values: [match.value] },
        sourceUrl: page.url,
        snippet: match.snippet,
        snippetOffset: match.matchOffset,
        method: "rule",
        runId,
        db,
      });
      if (match.assertion === "supports") {
        const values = supportedFacetValues.get(match.field) ?? new Set<string>();
        values.add(match.value);
        supportedFacetValues.set(match.field, values);
      }
    }
    for (const field of ["applicant_types", "populations_served", "funding_uses"] as const) {
      const values = supportedFacetValues.get(field);
      if (values?.size) patch[field] = [...values];
    }
    const funderTypes = supportedFacetValues.get("funder_type");
    // Multiple supported scalar claims are retained in evidence as a conflict;
    // avoid choosing one arbitrarily for the display column.
    if (funderTypes?.size === 1) patch.funder_type = [...funderTypes][0];

    const needAmountMin = !hasAmountMin && patch.amount_cad_min == null;
    const needAmountMax = !hasAmountMax && patch.amount_cad_max == null;
    if (needAmountMin || needAmountMax) {
      const amountMatch = extractAmounts(page.markdown);
      if (amountMatch) {
        let foundAmount = false;
        if (needAmountMin && amountMatch.min != null) {
          patch.amount_cad_min = amountMatch.min;
          foundAmount = true;
          await recordEvidence({
            grantId: g.id,
            agent: "enricher",
            field: "amount_cad_min",
            value: amountMatch.min,
            sourceUrl: page.url,
            snippet: amountMatch.snippet,
            snippetOffset: amountMatch.matchOffset,
            method: "regex",
            runId,
            db,
          });
        }
        if (needAmountMax && amountMatch.max != null) {
          patch.amount_cad_max = amountMatch.max;
          foundAmount = true;
          await recordEvidence({
            grantId: g.id,
            agent: "enricher",
            field: "amount_cad_max",
            value: amountMatch.max,
            sourceUrl: page.url,
            snippet: amountMatch.snippet,
            snippetOffset: amountMatch.matchOffset,
            method: "regex",
            runId,
            db,
          });
        }
        if (foundAmount) {
          methodCounts.regex++;
          await trace(
            "regex_amount",
            `Found amount on ${stage} page: $${amountMatch.min ?? "?"} - $${amountMatch.max ?? "?"}`,
            "ok",
            {
              page: page.url,
              snippet: amountMatch.snippet.slice(0, 200),
            },
          );
        } else if (stage === "main") {
          await trace("regex_amount", "No usable amount detected by regex", "info");
        }
      } else if (stage === "main") {
        await trace("regex_amount", "No amount detected by regex", "info");
      }
    }

    if (!hasDeadline && patch.deadline == null) {
      const deadlineMatch = extractDeadline(page.markdown, language);
      // extractDeadline returns the sentinel iso:"Rolling" for continuous-
      // intake language — NOT a real ISO date. `deadline` is a typed date
      // column/Zod field (/^\d{4}-\d{2}-\d{2}$/), so writing "Rolling" into it
      // used to fail EnricherOutput.partial().safeParse() for the ENTIRE
      // patch (amount, eligibility, sectors included), not just this field —
      // after 3 such failures the grant was permanently stuck in "discovered"
      // with everything else it had already correctly extracted discarded.
      // The evaluator's isRollingIntake() independently re-detects rolling
      // intake from the grant's stored text, so leaving deadline unset here
      // loses nothing.
      if (deadlineMatch && deadlineMatch.iso === "Rolling") {
        patch.deadline_kind = "rolling";
        patch.deadline_confidence = 0.95;
        await recordEvidence({
          grantId: g.id,
          agent: "enricher",
          field: "facet.deadline_kind",
          value: { assertion: "supports", values: ["rolling"] },
          sourceUrl: page.url,
          snippet: deadlineMatch.snippet,
          snippetOffset: deadlineMatch.matchOffset,
          method: "chrono",
          runId,
          db,
        });
        await trace(
          "chrono_deadline",
          `Rolling/continuous intake detected on ${stage} page (leaving deadline unset)`,
          "info",
          { page: page.url, snippet: deadlineMatch.snippet.slice(0, 200) },
        );
      } else if (deadlineMatch) {
        patch.deadline = deadlineMatch.iso;
        patch.deadline_kind = "confirmed";
        patch.deadline_confidence = 0.95;
        methodCounts.chrono++;
        await trace(
          "chrono_deadline",
          `Found deadline on ${stage} page: ${deadlineMatch.iso}`,
          "ok",
          {
            page: page.url,
            snippet: deadlineMatch.snippet.slice(0, 200),
          },
        );
        const deadlineEvidence = await recordEvidence({
          grantId: g.id,
          agent: "enricher",
          field: "deadline",
          value: deadlineMatch.iso,
          sourceUrl: page.url,
          snippet: deadlineMatch.snippet,
          snippetOffset: deadlineMatch.matchOffset,
          method: "chrono",
          runId,
          db,
        });
        await db.from("grant_deadline_observations").upsert(
          {
            grant_id: g.id,
            observed_deadline: deadlineMatch.iso,
            source_url: page.url,
            evidence_span_id: deadlineEvidence.id ?? null,
          },
          { onConflict: "grant_id,observed_deadline,source_url", ignoreDuplicates: true },
        );
        const { data: observations } = await db
          .from("grant_deadline_observations")
          .select("observed_deadline")
          .eq("grant_id", g.id)
          .order("observed_deadline", { ascending: true });
        const { predictNextDeadline } = await import("@/lib/grant-history-signals.shared");
        const prediction = predictNextDeadline({
          observedDeadlines: (observations ?? []).map(
            (row: { observed_deadline: string }) => row.observed_deadline,
          ),
        });
        if (prediction) {
          patch.next_expected_deadline = prediction.date;
          patch.next_expected_deadline_confidence = prediction.confidence;
          patch.next_expected_deadline_basis = prediction.basis;
        }
        await recordEvidence({
          grantId: g.id,
          agent: "enricher",
          field: "facet.deadline_kind",
          value: { assertion: "supports", values: ["confirmed"] },
          sourceUrl: page.url,
          snippet: deadlineMatch.snippet,
          snippetOffset: deadlineMatch.matchOffset,
          method: "chrono",
          runId,
          db,
        });
      } else if (stage === "main") {
        await trace("chrono_deadline", "No deadline detected", "info");
      }
    }

    if (!hasEligibility && patch.eligibility == null) {
      const eligibilityMatches = extractEligibility(page.markdown);
      if (eligibilityMatches.length > 0) {
        const eligibility: Record<string, true> = {};
        for (const match of eligibilityMatches) {
          eligibility[match.tag] = true;
          methodCounts.rule++;
          await recordEvidence({
            grantId: g.id,
            agent: "enricher",
            field: `eligibility.${match.tag}`,
            value: true,
            sourceUrl: page.url,
            snippet: match.snippet,
            snippetOffset: match.matchOffset,
            method: "rule",
            runId,
            db,
          });
        }
        patch.eligibility = eligibility as never;
        await trace(
          "rule_eligibility",
          `Matched eligibility tags on ${stage} page: ${eligibilityMatches.map((match) => match.tag).join(", ")}`,
          "ok",
          { page: page.url, tags: eligibilityMatches.map((match) => match.tag) },
        );
      } else if (stage === "main") {
        await trace("rule_eligibility", "No eligibility tags matched", "info");
      }
    }

    if (!hasSectors && patch.sectors == null) {
      const sectorMatches = extractSectors(page.markdown);
      if (sectorMatches.length > 0) {
        patch.sectors = sectorMatches.map((match) => match.sector);
        for (const match of sectorMatches) {
          methodCounts.rule++;
          await recordEvidence({
            grantId: g.id,
            agent: "enricher",
            field: `sectors.${match.sector}`,
            value: match.sector,
            sourceUrl: page.url,
            snippet: match.snippet,
            snippetOffset: match.matchOffset,
            method: "rule",
            runId,
            db,
          });
        }
        await trace(
          "rule_sectors",
          `Detected sectors on ${stage} page: ${sectorMatches.map((match) => match.sector).join(", ")}`,
          "ok",
          { page: page.url, sectors: sectorMatches.map((match) => match.sector) },
        );
      } else if (stage === "main") {
        await trace("rule_sectors", "No sectors detected", "info");
      }
    }
  };

  for (const [index, page] of pages.entries()) {
    if (missingFields().length === 0) break;
    await runExtractorsOnPage(page, index === 0 ? "main" : "deep");
  }

  const missingAfterMain = missingFields();
  const confirmedDeadline = (patch.deadline as string | undefined) ?? g.deadline;
  const isRolling = patch.deadline_kind === "rolling" || g.deadline_kind === "rolling";
  const isPastDeadline = Boolean(
    confirmedDeadline &&
    !isRolling &&
    !Number.isNaN(new Date(confirmedDeadline).getTime()) &&
    new Date(confirmedDeadline).getTime() < Date.now() - 30 * 86_400_000,
  );

  if (isPastDeadline && missingAfterMain.length > 0 && !opts?.force) {
    await trace(
      "early_exit_expired",
      `Grant deadline (${confirmedDeadline}) is closed/expired (>30 days ago) and not rolling — skipping deep crawl to conserve tokens and network calls`,
      "info",
      { deadline: confirmedDeadline, missing: missingAfterMain },
    );
  } else if (missingAfterMain.length > 0) {
    const { gatherDeepMarkdown } = await import("@/lib/deep-crawl.server");
    await trace(
      "deep_crawl",
      `Partial data after main page. Following official detail pages for: ${missingAfterMain.join(", ")}`,
      "start",
      { missing: missingAfterMain },
    );
    const pinnedUrls = Array.isArray(g.confirmed_source_urls)
      ? (g.confirmed_source_urls as unknown[]).filter((u): u is string => typeof u === "string")
      : [];
    let deepPages: Awaited<ReturnType<typeof gatherDeepMarkdown>> = [];
    try {
      deepPages = await gatherDeepMarkdown(g.url, sourceMarkdown, {
        // Was 3 — raised so a grant missing critical fields gets a genuinely
        // thorough look at the funder's site (inline links, then HTML-
        // discovered links, then sitemap.xml — gatherDeepMarkdown widens
        // through all three tiers internally) before we accept "missing" as
        // the honest final answer.
        max: 6,
        title: g.title,
        pinnedUrls: pinnedUrls.length > 0 ? pinnedUrls : undefined,
        onSearchError: (query, searchError) =>
          trace("deep_crawl_search", `Official site search failed: ${searchError}`, "warn", {
            query,
            error: searchError,
          }),
      });
    } catch (e) {
      await trace(
        "deep_crawl",
        `Deep crawl failed: ${e instanceof Error ? e.message : String(e)}`,
        "warn",
      );
    }
    if (deepPages.length > 0) {
      const relevantDeepPages: typeof deepPages = [];
      for (const page of deepPages) {
        if (isRelevantPage(page)) {
          relevantDeepPages.push(page);
        } else {
          await trace("deep_crawl_filter", "Skipped low-relevance detail page", "warn", {
            page: page.url,
            grant_title: g.title,
          });
        }
      }
      // Only relevant pages are kept in `pages` (which later feeds the LLM
      // gap-fill prompt below) — previously ALL deepPages were pushed here
      // regardless of relevance, and only the extraction loop skipped
      // irrelevant ones. Raising max 3→6 roughly doubled how much irrelevant
      // page content could ride along into the prompt, which is what turned
      // the enricher's 4096-token context budget from marginal into
      // consistently blown by large multi-page prompts.
      pages.push(...relevantDeepPages);
      await trace(
        "deep_crawl",
        `Fetched ${deepPages.length} official detail page(s), ${relevantDeepPages.length} relevant`,
        "done",
        { pages: deepPages.map((page) => page.url) },
      );
      // Pin these URLs so a future retry re-fetches the SAME pages instead of
      // re-running the (partly live-search-dependent, non-reproducible)
      // discovery cascade. Only pin on a fresh discovery, not when we already
      // fetched via pinnedUrls (nothing new was discovered in that case).
      if (pinnedUrls.length === 0 && relevantDeepPages.length > 0) {
        await db
          .from("grants")
          .update({ confirmed_source_urls: relevantDeepPages.map((page) => page.url) })
          .eq("id", g.id);
      }
      for (const page of relevantDeepPages) {
        if (missingFields().length === 0) break;
        await runExtractorsOnPage(page, "deep");
      }
    } else {
      await trace("deep_crawl", "No additional official detail pages found", "warn");
    }
  }

  await trace(
    "extractors",
    `Deterministic done - regex:${methodCounts.regex} chrono:${methodCounts.chrono} rule:${methodCounts.rule}`,
    "done",
    {
      ...methodCounts,
      pages_consulted: pages.map((page) => page.url),
    },
  );

  // Only ask the model for a field the sources could contain: with no money
  // figure anywhere it cannot find an amount, with no date it cannot find a
  // deadline. Asking anyway spent tokens on guaranteed "not found" answers.
  const sourceText = pages.map((page) => page.markdown).join("\n");
  const FIELD_CUES: Record<string, RegExp> = {
    amount_cad_min: /\$\s?\d|\d[\d,.\s]*(?:\$|CAD|USD|dollars?|million)/i,
    amount_cad_max: /\$\s?\d|\d[\d,.\s]*(?:\$|CAD|USD|dollars?|million)/i,
    deadline:
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)|rolling|ongoing|continuous/i,
  };
  const missingBeforeCues = missingFields();
  const stillMissing = missingBeforeCues.filter((field) => {
    const cue = FIELD_CUES[field];
    return !cue || cue.test(sourceText);
  });
  if (stillMissing.length < missingBeforeCues.length) {
    await trace(
      "llm_scope",
      `Not asking the model for ${missingBeforeCues.filter((f) => !stillMissing.includes(f)).join(", ")}: no cue in the sources`,
      "info",
    );
  }

  // Security: sanitize markdown + enforce size limit
  const { sanitizeMarkdown, validateTotalMarkdownSize } =
    await import("@/lib/prompt-safety.server");
  const { extractTargetedMarkdown } = await import("@/agents/extractors/targeted-chunks.server");
  const sanitizedPages = pages.map((p) => ({ ...p, markdown: sanitizeMarkdown(p.markdown) }));
  // Global budget across ALL pages, with semantic windowing per page:
  // Instead of dumping raw top-of-page text, targeted chunks prioritize paragraphs
  // matching stillMissing fields (deadlines, amounts, eligibility, sectors), reducing
  // token consumption by 60–75% while keeping verbatim grounding intact.
  const ENRICHER_LLM_MARKDOWN_BUDGET = 8_000;
  let remainingMarkdownBudget = ENRICHER_LLM_MARKDOWN_BUDGET;
  const combinedMarkdown = sanitizedPages
    .map((page, index) => {
      if (remainingMarkdownBudget <= 0) return null;
      const perPageLimit = Math.min(2500, remainingMarkdownBudget);
      const slice = extractTargetedMarkdown(page.markdown, stillMissing, {
        maxChars: perPageLimit,
        leadChars: 250,
      });
      remainingMarkdownBudget -= slice.length;
      return `Source ${index + 1}: ${page.url}\n${slice}`;
    })
    .filter((entry): entry is string => entry !== null)
    .join("\n\n");

  const sizeCheck = validateTotalMarkdownSize(combinedMarkdown.length);
  if (!sizeCheck.valid) {
    const msg = `markdown_overflow: ${sizeCheck.error}`;
    await trace("security", msg, "warn");
    // Persist the diagnosis like every other failure path — the attempt was
    // already consumed by the atomic claim, so leave a visible reason behind.
    await db
      .from("grants")
      .update({
        enrich_last_error: msg.slice(0, 500),
        enrich_last_attempt_at: new Date().toISOString(),
      })
      .eq("id", g.id);
    await db.from("agent_runs").insert({
      run_id: runId,
      agent: "enricher",
      status: "failed",
      model: "security-gate",
      latency_ms: Date.now() - t0,
      user_id: actorUserId,
      grant_id: g.id,
      error: msg.slice(0, 500),
      metadata: { via: scraped.via, pages_consulted: pages.map((p) => p.url) },
    });
    return { ok: false, runId, error: sizeCheck.error, attempts: fetchAttempts };
  }

  let llmInfo: {
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
  } | null = null;

  if (stillMissing.length > 0 && isPastDeadline && !opts?.force) {
    await trace(
      "llm_skip_expired",
      `Skipping LLM gap-fill for closed/expired grant (deadline: ${confirmedDeadline}) — preserving 0 tokens`,
      "info",
      { deadline: confirmedDeadline, missing: stillMissing },
    );
  } else if (stillMissing.length > 0) {
    const fieldDescriptions: Record<string, string> = {
      deadline: "confirmed deadline (ISO YYYY-MM-DD) or rolling intake",
      amount_cad_min: "minimum funding amount in CAD",
      amount_cad_max: "maximum funding amount in CAD",
      eligibility: "applicant eligibility criteria / eligible applicant types",
      sectors: "relevant industry sectors / focus areas",
    };
    const targetFieldsPrompt = stillMissing
      .map((f) => `${f} (${fieldDescriptions[f] ?? f})`)
      .join(", ");

    await trace(
      "llm_gap",
      `Missing fields after extractors: ${stillMissing.join(", ")} - invoking LLM cascade`,
      "start",
      { missing: stillMissing, target_fields: targetFieldsPrompt },
    );
    const { callFreeLlm, freeProvidersAvailable } = await import("@/agents/llm-free.server");
    const available = freeProvidersAvailable();
    const hasFree = available.length > 0;
    const { firecrawlAvailable, firecrawlScrape } = await import("@/lib/firecrawl.server");
    await trace(
      "llm_providers",
      `Free providers available: ${available.join(", ") || "(none)"} | firecrawl=${firecrawlAvailable()}`,
      "info",
      {
        providers: available,
        firecrawl: firecrawlAvailable(),
      },
    );

    let llmResultText: string | null = null;
    let llmProvider = "none";
    let llmModel = "none";
    let llmInTok: number | undefined;
    let llmOutTok: number | undefined;

    if (hasFree) {
      const tLlm = Date.now();
      await trace("llm_cascade", "Calling local LLM cascade (primary -> fallback)", "start");
      try {
        const llm = await callFreeLlm({
          agent: "enricher",
          runId,
          temperature: 0.1,
          responseFormat: "json",
          messages: [
            {
              role: "system",
              content:
                `${PROMPTS.enricher.system}\nPrompt version: ${PROMPTS.enricher.version}\n` +
                `Target fields to fill: [${targetFieldsPrompt}]. ` +
                `You MUST quote literal text from the provided source pages to justify every field you fill. ` +
                `Return JSON: { "fields": { "<field>": { "value": ..., "quote": "literal text from source pages" } } }. ` +
                `If you cannot find justification in the source pages, omit the field. Never invent.`,
            },
            {
              role: "user",
              content: JSON.stringify({
                needs: stillMissing,
                target_fields: targetFieldsPrompt,
                source_language: language,
                source_url: g.url,
                combined_markdown: combinedMarkdown,
              }),
            },
          ],
        });
        llmResultText = llm.text;
        llmProvider = llm.provider;
        llmModel = llm.model;
        llmInTok = llm.inputTokens;
        llmOutTok = llm.outputTokens;
        await trace(
          "llm_cascade",
          `LLM responded via ${llm.provider}/${llm.model} (${llm.outputTokens ?? "?"} tokens, ${Date.now() - tLlm}ms)`,
          "done",
          {
            provider: llm.provider,
            model: llm.model,
            in: llm.inputTokens,
            out: llm.outputTokens,
          },
        );
      } catch (e) {
        await trace(
          "llm_cascade",
          `All free providers failed - ${e instanceof Error ? e.message : String(e)}`,
          "warn",
        );
      }
    }

    if (!llmResultText && firecrawlAvailable()) {
      const props: Record<string, unknown> = {};
      const needSchema = (type: string) => ({
        type: "object",
        properties: {
          value: { type },
          quote: {
            type: "string",
            description: "Verbatim sentence from the page that justifies this value.",
          },
        },
        required: ["value", "quote"],
      });
      if (stillMissing.includes("amount_cad_min")) props.amount_cad_min = needSchema("number");
      if (stillMissing.includes("amount_cad_max")) props.amount_cad_max = needSchema("number");
      if (stillMissing.includes("deadline")) props.deadline = needSchema("string");
      if (stillMissing.includes("eligibility")) {
        props.eligibility = {
          type: "object",
          properties: { value: { type: "object" }, quote: { type: "string" } },
          required: ["value", "quote"],
        };
      }
      if (stillMissing.includes("sectors")) {
        props.sectors = {
          type: "object",
          properties: {
            value: { type: "array", items: { type: "string" } },
            quote: { type: "string" },
          },
          required: ["value", "quote"],
        };
      }
      const fcSchema = {
        type: "object",
        properties: { fields: { type: "object", properties: props } },
      };
      const fc = await firecrawlScrape(g.url, {
        jsonSchema: fcSchema,
        jsonPrompt:
          "Extract the requested grant fields. For each field, copy a verbatim sentence from the page into quote. If the page does not state a field, omit it. Amounts must be CAD numbers. Deadlines must be ISO YYYY-MM-DD.",
      });
      if (fc.ok && fc.json) {
        llmResultText = JSON.stringify(fc.json);
        llmProvider = "firecrawl";
        llmModel = "firecrawl-extract";
      }
    }

    if (!llmResultText && !hasFree && !firecrawlAvailable()) {
      try {
        const llm = await callFreeLlm({
          agent: "enricher",
          runId,
          temperature: 0.1,
          responseFormat: "json",
          messages: [
            {
              role: "system",
              content: `${PROMPTS.enricher.system}\nTarget fields to fill: [${targetFieldsPrompt}].\nReturn JSON {"fields":{"<field>":{"value":...,"quote":"..."}}}. Quote literal page text. Never invent.`,
            },
            {
              role: "user",
              content: JSON.stringify({
                needs: stillMissing,
                target_fields: targetFieldsPrompt,
                source_language: language,
                source_url: g.url,
                combined_markdown: combinedMarkdown,
              }),
            },
          ],
        });
        llmResultText = llm.text;
        llmProvider = llm.provider;
        llmModel = llm.model;
        llmInTok = llm.inputTokens;
        llmOutTok = llm.outputTokens;
      } catch {
        // fall through
      }
    }

    llmInfo = {
      provider: llmProvider,
      model: llmModel,
      inputTokens: llmInTok,
      outputTokens: llmOutTok,
    };

    if (llmResultText) {
      try {
        await trace(
          "llm_validate",
          "Validating LLM output: per-field schema + grounded-quote check",
          "start",
        );

        const rawJson = JSON.parse(llmResultText) as { fields?: Record<string, unknown> };
        const { evaluateLlmFields } = await import("@/agents/enricher-steps.server");
        // Pure decision step (unit-tested in enricher-steps.test.ts); the IO
        // below just applies accepted decisions and records their evidence.
        const { accepted, rejected } = evaluateLlmFields({
          fieldsObj: rawJson.fields ?? {},
          stillMissing,
          pageForQuote,
        });
        for (const d of accepted) {
          patch[d.field] = d.value as never;
          methodCounts.llm++;
          await recordEvidence({
            grantId: g.id,
            agent: "enricher",
            field: d.field,
            value: d.value,
            sourceUrl: d.page.url,
            snippet: d.quote,
            method: "llm",
            sourceMarkdown: d.page.markdown,
            model: llmModel,
            runId,
            db,
          });
        }
        await trace(
          "llm_validate",
          `Accepted: ${accepted.map((d) => d.field).join(", ") || "(none)"} | Rejected: ${rejected.join(", ") || "(none)"}`,
          accepted.length ? "done" : "warn",
          { accepted: accepted.map((d) => d.field), rejected },
        );
      } catch (e) {
        const msg = `llm_gap_fill_failed: ${e instanceof Error ? e.message : String(e)}`;
        await trace("llm_validate", msg, "error");
        await db.from("agent_runs").insert({
          run_id: runId,
          agent: "enricher",
          status: "degraded",
          model: llmInfo?.model ?? "free-cascade",
          input_tokens: llmInfo?.inputTokens,
          output_tokens: llmInfo?.outputTokens,
          latency_ms: Date.now() - t0,
          user_id: actorUserId,
          grant_id: g.id,
          error: msg.slice(0, 500),
          metadata: {
            provider: llmInfo?.provider,
            missing: stillMissing,
            via: scraped.via,
            pages_consulted: pages.map((page) => page.url),
          },
        });
      }
    }
  }

  try {
    const { translateStringsToEnglish, looksFrench } = await import("@/agents/translate.server");
    if (Array.isArray(patch.sectors)) {
      const arr = (patch.sectors as unknown[]).map(String);
      if (arr.some(looksFrench)) {
        patch.sectors = await translateStringsToEnglish({ strings: arr, agent: "enricher", runId });
        await trace("translate_sectors", "Translated French sector labels to English", "ok");
      }
    }
    if (patch.eligibility && typeof patch.eligibility === "object") {
      const eligibility = patch.eligibility as Record<string, unknown>;
      const stringEntries = Object.entries(eligibility).filter(
        ([, value]) => typeof value === "string",
      ) as Array<[string, string]>;
      const frEntries = stringEntries.filter(([, value]) => looksFrench(value));
      if (frEntries.length) {
        const translated = await translateStringsToEnglish({
          strings: frEntries.map(([, value]) => value),
          agent: "enricher",
          runId,
        });
        frEntries.forEach(([key], index) => {
          eligibility[key] = translated[index];
        });
        patch.eligibility = eligibility as never;
        await trace(
          "translate_eligibility",
          `Translated ${frEntries.length} French eligibility value(s)`,
          "ok",
        );
      }
    }
  } catch (e) {
    await trace(
      "translate",
      `Translation pass failed (non-fatal): ${e instanceof Error ? e.message : String(e)}`,
      "warn",
    );
  }

  const built = EnricherOutput.partial().safeParse(patch);
  if (!built.success) {
    await trace("schema", `Schema validation failed: ${built.error.message}`, "error");
    await db
      .from("grants")
      .update({
        enrich_last_error: `schema_validation: ${built.error.message}`.slice(0, 500),
        enrich_last_attempt_at: new Date().toISOString(),
      })
      .eq("id", g.id);
    return { ok: false, runId, error: "schema_validation" };
  }

  // Additional validation: min/max invariant
  const parsedPatch = built.data;
  if (
    parsedPatch.amount_cad_min != null &&
    parsedPatch.amount_cad_max != null &&
    parsedPatch.amount_cad_min > parsedPatch.amount_cad_max
  ) {
    // Min and max usually come from different sentences (a per-intern stipend
    // vs a per-project cap). Halting threw away every other field; drop the
    // floor instead and keep the rest.
    await trace(
      "schema",
      `amount_cad_min (${parsedPatch.amount_cad_min}) > amount_cad_max (${parsedPatch.amount_cad_max}); dropping min`,
      "warn",
    );
    delete patch.amount_cad_min;
    delete (parsedPatch as { amount_cad_min?: number | null }).amount_cad_min;
  }

  const extractedKeys = Object.keys(patch);
  const llmCascadeFailed = stillMissing.length > 0 && llmInfo?.provider === "none";
  // Critical fields for downstream evaluation. If the LLM returned but extracted
  // zero critical fields, treat as failure — the grant stays in "discovered" for
  // retry rather than being marked "enriched" with only cosmetic data.
  if (extractedKeys.length === 0 && llmCascadeFailed) {
    const reason = "no_extraction: deterministic=0 llm_cascade=all_providers_failed";
    await trace("commit", reason, "error", { still_missing: stillMissing });
    await db
      .from("grants")
      .update({
        enrich_last_error: reason.slice(0, 500),
        enrich_last_attempt_at: new Date().toISOString(),
      })
      .eq("id", g.id);
    await db.from("agent_runs").insert({
      run_id: runId,
      agent: "enricher",
      status: "failed",
      model: "free-cascade",
      latency_ms: Date.now() - t0,
      user_id: actorUserId,
      grant_id: g.id,
      error: reason,
      metadata: {
        via: scraped.via,
        provider: "none",
        deterministic_counts: methodCounts,
        still_missing: stillMissing,
        fetch_attempts: fetchAttempts,
        scraped_bytes: scraped.ok ? scraped.markdown.length : 0,
        pages_consulted: pages.map((page) => page.url),
      },
    });
    return {
      ok: false,
      runId,
      error: reason,
      deterministic_counts: methodCounts,
      provider: "none",
      attempts: fetchAttempts,
    };
  }

  // RFP-style requirements (documents to submit, process constraints) —
  // deterministic pattern extraction over everything we scraped, persisted so
  // the detail page can show what to prepare BEFORE drafting. Non-fatal.
  try {
    const { analyzeGrantRequirements } =
      await import("@/agents/grant-requirements-analyzer.server");
    const reqs = analyzeGrantRequirements(combinedMarkdown);
    if (reqs.requirements.length > 0) {
      patch.requirements = reqs.requirements;
      for (const requirement of reqs.requirements) {
        if (!requirement.value) continue;
        await recordEvidence({
          grantId: g.id,
          agent: "enricher",
          field: `requirement:${requirement.category}`,
          value: requirement,
          sourceUrl: g.url,
          sourceMarkdown: combinedMarkdown,
          snippet: requirement.value,
          method: "rule",
          confidence: 0.95,
          runId,
          db,
        });
      }
      await trace("requirements", reqs.summary, "ok", {
        count: reqs.requirements.length,
        critical: reqs.requirements.filter((r) => r.isCritical).length,
      });
    }
  } catch (e) {
    await trace(
      "requirements",
      `Requirements analysis failed (non-fatal): ${e instanceof Error ? e.message : String(e)}`,
      "warn",
    );
  }

  // Facts a person entered by hand win over anything extracted. Read
  // separately and tolerate failure: the column is newer than this code path.
  const { data: manualRow } = await db
    .from("grants")
    .select("manual_fields" as never)
    .eq("id", g.id)
    .maybeSingle();
  const manualFields = Object.keys(
    ((manualRow as { manual_fields?: Record<string, unknown> } | null)?.manual_fields ??
      {}) as object,
  );
  for (const field of manualFields) {
    if (field in patch) {
      delete patch[field];
      await trace("manual", `Kept the human-entered ${field}; extraction not applied`, "info");
    }
  }

  // Record what was looked for and not found, so the UI can say "searched,
  // not found" and invite a person to complete it.
  const checkedAt = new Date().toISOString();
  const notFound = missingBeforeCues.filter(
    (field) => !(field in patch) && !manualFields.includes(field),
  );
  const searchStatus = Object.fromEntries(
    notFound.map((field) => [field, { status: "not_found", checked_at: checkedAt }]),
  );
  {
    const { error: statusError } = await db
      .from("grants")
      .update({ field_search_status: searchStatus } as never)
      .eq("id", g.id);
    if (!statusError && notFound.length > 0) {
      await trace("search_status", `Searched, not found: ${notFound.join(", ")}`, "info");
    }
  }

  // Fix: ensure amount_cad_min <= amount_cad_max before update
  const finalMin = patch.amount_cad_min ?? g.amount_cad_min;
  const finalMax = patch.amount_cad_max ?? g.amount_cad_max;
  if (finalMin != null && finalMax != null && finalMin > finalMax) {
    // Drop only what this run extracted; a stored value that was fine on its
    // own stays (clearing both showed "Not published" for a known amount).
    const newMin = patch.amount_cad_min != null;
    const newMax = patch.amount_cad_max != null;
    if (newMin && !newMax) delete patch.amount_cad_min;
    else if (newMax && !newMin) delete patch.amount_cad_max;
    else {
      patch.amount_cad_min = null;
      patch.amount_cad_max = null;
    }
    await trace(
      "schema",
      `amount_cad_min (${finalMin}) > amount_cad_max (${finalMax}) — clearing both to avoid constraint violation`,
      "warn",
    );
  }

  // Description: when the stored one is missing or a stub, take the first
  // substantial paragraph of the grant page (0 tokens). A manual edit wins.
  if ((g.summary ?? "").trim().length < 80 && !manualFields.includes("summary")) {
    const lead = leadParagraph(pages[0]?.markdown ?? "");
    if (lead) {
      patch.summary = lead;
      await trace(
        "summary",
        `Description filled from the grant page (${lead.length} chars)`,
        "info",
      );
    }
  }

  // Rechecking an archived/expired/lost record may refresh its facts, but must
  // not reopen it or violate the lifecycle transition enforced by the database.
  patch.status = ["archived", "expired", "lost"].includes(g.status) ? g.status : "enriched";
  patch.enriched_at = new Date().toISOString();
  patch.source_freshness_at = new Date().toISOString();
  patch.source_confidence = (sourceVia as string) === "direct" ? 0.95 : 0.85;
  patch.enrich_last_error = null;
  patch.enrich_last_attempt_at = new Date().toISOString();
  const { error: updateError } = await db
    .from("grants")
    .update(patch as never)
    .eq("id", g.id);
  if (updateError) throw new Error(`grant_update_failed: ${updateError.message}`);

  const filled = Object.keys(patch).filter((key) => key !== "status" && key !== "enriched_at");
  await trace(
    "commit",
    `Grant marked enriched - fields filled: ${filled.join(", ") || "(none)"} | total ${Date.now() - t0}ms`,
    "done",
    {
      filled,
      total_ms: Date.now() - t0,
    },
  );

  await db.from("agent_runs").insert({
    run_id: runId,
    agent: "enricher",
    status: "succeeded",
    model: llmInfo?.model ?? "deterministic",
    input_tokens: llmInfo?.inputTokens ?? 0,
    output_tokens: llmInfo?.outputTokens ?? 0,
    latency_ms: Date.now() - t0,
    user_id: actorUserId,
    grant_id: g.id,
    metadata: {
      via: sourceVia,
      provider: llmInfo?.provider ?? "none",
      deterministic_counts: methodCounts,
      still_missing_after: missingFields(),
      fetch_attempts: fetchAttempts,
      pages_consulted: pages.map((page) => page.url),
    },
  });
  return {
    ok: true,
    runId,
    filled,
    deterministic_counts: methodCounts,
    provider: llmInfo?.provider ?? "none",
    attempts: fetchAttempts,
  };
}

export const runEnricher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ grantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin-guard");
    await assertAdmin(context.userId, context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return enrichGrantImpl(data.grantId, {
      db: supabaseAdmin as never,
      userId: context.userId,
      force: true,
    });
  });

/** First paragraph that reads like a description: prose, not menus, links or headings. */
function leadParagraph(markdown: string): string | null {
  for (const raw of markdown.split(/\n\s*\n/)) {
    const text = raw
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`>#]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 120 || text.length > 1200) continue;
    if (/^(skip to|menu|home|search|cookie|sign in|language|share)/i.test(text)) continue;
    const words = text.split(" ");
    const sentences = (text.match(/[.!?](\s|$)/g) ?? []).length;
    if (words.length < 20 || sentences < 1) continue;
    return text.length > 600 ? `${text.slice(0, 597).replace(/\s+\S*$/, "")}…` : text;
  }
  return null;
}
