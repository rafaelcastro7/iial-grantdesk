import { serverEnv } from "@/lib/env.server";

/**
 * Language model access.
 *
 * Provider chain, in order: Cerebras, Groq, Gemini, and finally the Lovable
 * AI Gateway as the floor. The external providers carry the volume so the
 * gateway's credits are spent only when every external key is missing or
 * failing. What survives from the original design is the part that mattered —
 * a caller asks for a *role*, gets back the text plus a record of what was
 * attempted, and a failure is reported rather than silently degraded.
 */

export type Role = "extract" | "judge" | "write";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmRequest = {
  role: Role;
  messages: ChatMessage[];
  /** Ask the model to constrain its answer to a JSON object. */
  json?: boolean;
  /** Advisory only; stated in the prompt rather than sent as a parameter. */
  maxTokens?: number;
  /** Accepted for call-site compatibility; the served model fixes sampling. */
  temperature?: number;
  /** Reject a syntactically fine answer that fails the caller's own schema. */
  validate?: (text: string) => boolean;
  /** Do not wait out a rate limit; report it instead. */
  noWait?: boolean;
};

export type LlmResponse = {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
  /** What was tried and why it failed, in order, before this answer. */
  attempts: string[];
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

/** Extraction is volume work; judgement and prose get more thinking. */
function effortFor(role: Role): "low" | "medium" {
  return role === "extract" ? "low" : "medium";
}

/** "13.905s", "2m30s", or a bare number of seconds. */
export function parseDuration(raw: string): number | null {
  const trimmed = raw.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);

  const match = /^(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(trimmed);
  if (!match || (!match[1] && !match[2])) return null;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2] ?? 0);
  return Math.round((minutes * 60 + seconds) * 1000);
}

const HARD_FAILURE = /\b(402|403|payment required|insufficient|not registered|unauthorized)\b/i;
const RATE_LIMITED = /\b(429|rate limit|too many requests)\b/i;
const DAILY_EXHAUSTION = /\b(daily|per day|quota)\b/i;

/** How long to leave the gateway alone after this failure, in minutes. */
export function restMinutesFor(message: string): number {
  if (HARD_FAILURE.test(message)) return 30;
  if (RATE_LIMITED.test(message)) return DAILY_EXHAUSTION.test(message) ? 60 : 2;
  return 0;
}

export class LlmUnavailableError extends Error {
  constructor(public readonly attempts: string[]) {
    super(`the model could not be reached: ${attempts.join("; ")}`);
    this.name = "LlmUnavailableError";
  }
}

function inputFrom(messages: ChatMessage[], maxTokens?: number) {
  const input = messages.map((message) => ({ role: message.role, content: message.content }));
  if (maxTokens) {
    input.unshift({
      role: "system",
      // The served model rejects max_tokens, so the budget is stated instead.
      content: `Keep the answer under roughly ${Math.round(maxTokens * 0.7)} words.`,
    });
  }
  return input;
}

/**
 * Read the streamed answer to its end.
 *
 * Every call streams, including the one-shot extractions whose caller only
 * wants the final string: a buffered request that outlives its socket is billed
 * anyway and reports nothing.
 */
async function readStream(response: Response): Promise<string> {
  const body = response.body;
  if (!body) throw new Error("the gateway returned no body");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let event: { type?: string; delta?: string; response?: { error?: { message?: string } } };
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        text += event.delta;
      }
      if (event.type === "error" || event.type === "response.failed") {
        throw new Error(event.response?.error?.message ?? "the model reported an error");
      }
    }
  }

  return text.trim();
}

// ---- External providers (tried first, to save gateway credits) ----

type ExternalProvider = {
  name: string;
  model: string;
  call: (request: LlmRequest, apiKey: string) => Promise<string>;
};

/** OpenAI-compatible chat completions (Cerebras and Groq share the shape). */
function openAiCompatible(url: string, model: string): ExternalProvider["call"] {
  return async (request, apiKey) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
        ...(request.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`HTTP ${response.status}: ${detail.slice(0, 300)}`);
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("the model returned an empty answer");
    return text;
  };
}

/** Gemini generateContent (non-streamed; these calls are short gap-fills). */
async function callGemini(request: LlmRequest, apiKey: string): Promise<string> {
  const model = "gemini-2.5-flash";
  const system = request.messages.find((m) => m.role === "system")?.content;
  const turns = request.messages.filter((m) => m.role !== "system");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: turns.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          ...(request.maxTokens ? { maxOutputTokens: request.maxTokens } : {}),
          ...(request.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("the model returned an empty answer");
  return text;
}

const EXTERNAL_PROVIDERS: (ExternalProvider & { envKey: "CEREBRAS_API_KEY" | "GROQ_API_KEY" | "GEMINI_API_KEY" })[] = [
  { name: "gemini", model: "gemini-2.5-flash", envKey: "GEMINI_API_KEY", call: callGemini },
  {
    name: "groq",
    model: "qwen/qwen3.8-27b",
    envKey: "GROQ_API_KEY",
    call: openAiCompatible("https://api.groq.com/openai/v1/chat/completions", "qwen/qwen3.8-27b"),
  },
  {
    name: "cerebras",
    model: "qwen-3.8-27b",
    envKey: "CEREBRAS_API_KEY",
    call: openAiCompatible("https://api.cerebras.ai/v1/chat/completions", "qwen-3.8-27b"),
  },
];

async function callGateway(request: LlmRequest): Promise<LlmResponse> {
  const env = serverEnv();
  if (!env.LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }
  const started = Date.now();

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      input: inputFrom(request.messages, request.maxTokens),
      reasoning: { effort: effortFor(request.role) },
      store: false,
      stream: true,
      ...(request.json ? { text: { format: { type: "json_object" } } } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 400)}`);
  }

  const text = await readStream(response);
  if (!text) throw new Error("the model returned an empty answer");

  return {
    text,
    provider: "lovable-ai",
    model: MODEL,
    latencyMs: Date.now() - started,
    attempts: [],
  };
}

/**
 * Only 429 and 5xx are worth trying again, and only a couple of times: a
 * refusal, a bad request, or an account problem does not improve on a retry.
 */
function retryable(message: string): boolean {
  return /\b(429|5\d\d)\b/.test(message) || /rate limit|timeout|aborted/i.test(message);
}

export async function callLlm(
  request: LlmRequest,
  // Accepted for call-site compatibility and deliberately unused: a deadline
  // here would abandon a generation that still finishes and still bills.
  _options: { timeoutMs?: number } = {},
): Promise<LlmResponse> {
  const attempts: string[] = [];
  const env = serverEnv();

  // External providers first: each gets one shot, then we move on. Their
  // free tiers carry the volume; the gateway below is the paid floor.
  for (const provider of EXTERNAL_PROVIDERS) {
    const apiKey = env[provider.envKey];
    if (!apiKey) continue;
    for (let tryIdx = 0; tryIdx < 2; tryIdx++) {
      const started = Date.now();
      try {
        const text = await provider.call(request, apiKey);
        if (request.validate && !request.validate(text)) {
          attempts.push(`${provider.name}: failed caller validation`);
          break;
        }
        return {
          text,
          provider: provider.name,
          model: provider.model,
          latencyMs: Date.now() - started,
          attempts,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push(`${provider.name}: ${message}`);
        if (tryIdx === 0 && (message.includes("429") || message.includes("rate limit"))) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        break;
      }
    }
  }

  if (env.LOVABLE_API_KEY) {
    const maxTries = request.noWait ? 1 : 3;

    for (let attempt = 0; attempt < maxTries; attempt++) {
      try {
        const result = await callGateway(request);
        if (request.validate && !request.validate(result.text)) {
          attempts.push("lovable-ai: failed caller validation");
          continue;
        }
        return { ...result, attempts };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push(`lovable-ai: ${message}`);
        if (!retryable(message) || attempt === maxTries - 1) break;
        await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** attempt + Math.random() * 400));
      }
    }
  }

  throw new LlmUnavailableError(attempts);
}
