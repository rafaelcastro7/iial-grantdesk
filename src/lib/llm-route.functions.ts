"use server";

/**
 * Reports where agent prompts actually go, so the UI can say so honestly.
 *
 * All agent calls go through the Lovable AI Gateway — one provider, one key,
 * no local models. The status is still derived from configuration rather than
 * hardcoded, and returns provider names only — never key material.
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
    const configured = !!process.env.LOVABLE_API_KEY;
    return {
      cloudProviders: configured ? ["Lovable AI"] : ["Lovable AI (key missing)"],
      localOnly: false,
    };
  });
