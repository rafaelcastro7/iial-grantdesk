import { z } from "zod";

/**
 * Server-side configuration, validated at first use.
 *
 * Everything here is injected by Lovable Cloud at request time, so it is read
 * lazily rather than at module scope: a missing or malformed value fails here,
 * once, with the variable's name.
 */
const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10).optional(),
  /** Lovable AI Gateway. One key for chat models and embeddings alike. */
  LOVABLE_API_KEY: z.string().min(10).optional(),
  /** External chat providers, tried before the gateway to save its credits. */
  CEREBRAS_API_KEY: z.string().min(10).optional(),
  GROQ_API_KEY: z.string().min(10).optional(),
  GEMINI_API_KEY: z.string().min(10).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

export function serverEnv(): ServerEnv {
  const envMapped = {
    ...process.env,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://qcuzwryknrniujjfvvvr.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_MYWEgMbOfoqZcOdKPsq7gg_-PXnH2zU",
  };
  const parsed = schema.safeParse(envMapped);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment: ${missing}.`);
  }
  return parsed.data;
}
