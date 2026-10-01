// On-demand health/quota check of the AI providers, for admins.
//
// Providers report quota differently: Groq returns per-day request headers,
// Gemini and Cerebras only reveal a spent quota through the error itself, and
// the Lovable gateway reports key/credit problems as HTTP errors. Each check
// is a single minimal request (1 output token) so it costs next to nothing;
// it is never run automatically.

import { serverEnv } from "@/lib/env.server";
import { providerCooldownSnapshot } from "@/server/llm";

export type ProviderState =
  | "available"
  | "quota_exhausted"
  | "rate_limited"
  | "billing_required"
  | "invalid_key"
  | "not_configured"
  | "error";

export type ProviderStatus = {
  provider: string;
  role: "free tier" | "paid floor";
  state: ProviderState;
  detail: string | null;
  remainingRequestsToday: number | null;
  requestsPerDay: number | null;
  coolingUntil: string | null;
  checkedAt: string;
};

function classify(status: number, body: string): { state: ProviderState; detail: string | null } {
  const text = body.slice(0, 400);
  if (status >= 200 && status < 300) return { state: "available", detail: null };
  if (status === 402)
    return { state: "billing_required", detail: "Provider requires payment / credits" };
  if (status === 401 || status === 403) {
    return {
      state: "invalid_key",
      detail: /not registered/i.test(text) ? "Key not registered for this project" : "Key rejected",
    };
  }
  if (status === 429) {
    return /quota|per day|TPD|RPD|daily/i.test(text)
      ? {
          state: "quota_exhausted",
          detail: "Daily quota used up; resets with the provider's daily window",
        }
      : { state: "rate_limited", detail: "Per-minute limit; retry shortly" };
  }
  return { state: "error", detail: `HTTP ${status}` };
}

async function probe(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: string; headers: Headers } | { error: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    return { status: res.status, body: await res.text(), headers: res.headers };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const json = (body: unknown, key: string): RequestInit => ({
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function checkAiProviders(): Promise<ProviderStatus[]> {
  const env = serverEnv();
  const checkedAt = new Date().toISOString();
  const cooldown = providerCooldownSnapshot();
  const base = (provider: string, role: ProviderStatus["role"]) => ({
    provider,
    role,
    remainingRequestsToday: null as number | null,
    requestsPerDay: null as number | null,
    coolingUntil: cooldown[provider] ? new Date(cooldown[provider]).toISOString() : null,
    checkedAt,
  });

  const checks: Array<Promise<ProviderStatus>> = [];

  const openAiStyle = (provider: string, url: string, model: string, key?: string) =>
    (async (): Promise<ProviderStatus> => {
      if (!key) return { ...base(provider, "free tier"), state: "not_configured", detail: null };
      const r = await probe(
        url,
        json({ model, messages: [{ role: "user", content: "ok" }], max_tokens: 1 }, key),
      );
      if ("error" in r) return { ...base(provider, "free tier"), state: "error", detail: r.error };
      const out: ProviderStatus = { ...base(provider, "free tier"), ...classify(r.status, r.body) };
      // Groq: the request limit headers are per day.
      const limit = Number(r.headers.get("x-ratelimit-limit-requests"));
      const remaining = Number(r.headers.get("x-ratelimit-remaining-requests"));
      if (Number.isFinite(limit) && limit > 0) out.requestsPerDay = limit;
      if (Number.isFinite(remaining) && r.headers.has("x-ratelimit-remaining-requests"))
        out.remainingRequestsToday = remaining;
      const remainingDay = Number(r.headers.get("x-ratelimit-remaining-requests-day"));
      if (Number.isFinite(remainingDay) && r.headers.has("x-ratelimit-remaining-requests-day"))
        out.remainingRequestsToday = remainingDay;
      return out;
    })();

  checks.push(
    openAiStyle(
      "groq",
      "https://api.groq.com/openai/v1/chat/completions",
      "qwen/qwen3.8-27b",
      env.GROQ_API_KEY,
    ),
  );
  checks.push(
    openAiStyle(
      "cerebras",
      "https://api.cerebras.ai/v1/chat/completions",
      "qwen-3.8-27b",
      env.CEREBRAS_API_KEY,
    ),
  );
  checks.push(
    (async (): Promise<ProviderStatus> => {
      const key = env.LOVABLE_API_KEY;
      if (!key)
        return { ...base("lovable-ai", "paid floor"), state: "not_configured", detail: null };
      const r = await probe(
        "https://ai.gateway.lovable.dev/v1/responses",
        json(
          { model: "openai/gpt-6-astra", input: "ok", max_output_tokens: 16, store: false },
          key,
        ),
      );
      if ("error" in r)
        return { ...base("lovable-ai", "paid floor"), state: "error", detail: r.error };
      return { ...base("lovable-ai", "paid floor"), ...classify(r.status, r.body) };
    })(),
  );

  return Promise.all(checks);
}
