"use server";

/**
 * Reports where agent prompts actually go, so the UI can say so honestly.
 *
 * Agent calls try the external providers first (Cerebras, Groq, Gemini) and
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
    providers.push(process.env.LOVABLE_API_KEY ? "Lovable AI (principal)" : "Lovable AI (key missing)");
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_KEY) providers.push("Gemini");
    if (process.env.GROQ_API_KEY) providers.push("Groq");
    if (process.env.CEREBRAS_API_KEY) providers.push("Cerebras");
    return { cloudProviders: providers, localOnly: false };
  });
