import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public health check. Reports only whether required configuration is
 * present — never URLs, keys or data.
 */
export const healthCheck = createServerFn({ method: "GET" })
  .inputValidator(z.object({}))
  .handler(async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: "lovable-cloud",
      ai: { provider: "lovable-ai-gateway", configured: !!process.env.LOVABLE_API_KEY },
      database: { configured: !!process.env.SUPABASE_URL },
    };
  });
