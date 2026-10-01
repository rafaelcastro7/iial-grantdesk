"use server";

/**
 * Reports where agent prompts actually go, so the UI can say so honestly.
 *
 * Agent calls try the external providers first (Groq, Cerebras) and
 * fall back to the Lovable AI Gateway. The status is derived from
 * configuration rather than hardcoded, and returns provider names only —
 * never key material.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LlmRouteStatus = {
  /** AI providers in use, in the order calls reach them. */
  cloudProviders: string[];
  /** True only when prompts never leave the machine — not the case here. */
  localOnly: boolean;
};

export const getLlmRouteStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({}))
  .handler(async (): Promise<LlmRouteStatus> => {
    const providers: string[] = [];
    // Same order as callLlm in src/server/llm.ts: free tier first, Lovable last.
    if (process.env.GROQ_API_KEY) providers.push("Groq");
    if (process.env.CEREBRAS_API_KEY) providers.push("Cerebras");
    providers.push(process.env.LOVABLE_API_KEY ? "Lovable AI" : "Lovable AI (key missing)");
    return { cloudProviders: providers, localOnly: false };
  });

/**
 * Admin-only, on-demand provider check: availability and any quota the
 * provider reports. One 1-token request per configured provider; never run on
 * page load so viewing the page spends nothing.
 */
export const checkAiProviderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({}))
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin-guard");
    // The caller's own session can read its role; no service key needed.
    await assertAdmin(context.userId, context.supabase as never);
    const { checkAiProviders } = await import("@/server/ai-provider-status");
    return checkAiProviders();
  });
