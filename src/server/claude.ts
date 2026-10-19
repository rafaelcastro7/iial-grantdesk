import { serverEnv } from "@/lib/env.server";

/**
 * Claude through the Lovable AI Gateway (native Messages endpoint), billed to
 * Lovable credits — the user chose this over their own Anthropic key. Every
 * call streams, even when the caller only wants the final text.
 *
 * Rescue: when the gateway is out of credits (402) or unreachable, the same
 * checklist work falls back to the user's own keys (Groq, then Cerebras) via
 * OpenAI-compatible chat completions, so the action keeps working. Direct
 * Anthropic credentials are not used: the saved key is not scoped to a
 * workspace and cannot serve requests.
 */

const ANTHROPIC_URL = "https://ai.gateway.lovable.dev/v1/messages";
const DEFAULT_MODEL = "anthropic/claude-sonnet-5";

export type ClaudeMessage = { role: "user" | "assistant"; content: string };

export type ClaudeResponse = {
  text: string;
  model: string;
  latencyMs: number;
};

/** Read the streamed answer to its end, accumulating text deltas. */
async function readAnthropicStream(response: Response): Promise<string> {
  const body = response.body;
  if (!body) throw new Error("Claude returned no body");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let event: {
      type?: string;
      delta?: { type?: string; text?: string };
      error?: { message?: string };
    };
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      text += event.delta.text ?? "";
    }
    if (event.type === "error") {
      throw new Error(event.error?.message ?? "Claude reported an error");
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consume(line);
  }
  buffer += decoder.decode();
  for (const line of buffer.split("\n")) consume(line);

  return text.trim();
}

/** Rescue providers: the user's own keys, cheapest adequate first. */
const RESCUE_PROVIDERS = [
  {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "openai/gpt-oss-120b",
    envKey: "GROQ_API_KEY" as const,
  },
  {
    name: "cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    model: "qwen-3.8-27b",
    envKey: "CEREBRAS_API_KEY" as const,
  },
];

export async function callClaude(opts: {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}): Promise<ClaudeResponse> {
  const env = serverEnv();
  const started = Date.now();
  const errors: string[] = [];

  if (!env.LOVABLE_API_KEY) {
    errors.push("LOVABLE_API_KEY is not configured");
  } else {
    const model = DEFAULT_MODEL;
    try {
      const response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.LOVABLE_API_KEY}`,
          "X-Lovable-AIG-SDK": "fetch",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: opts.maxTokens ?? 4000,
          system: opts.system,
          messages: opts.messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        let message = detail.slice(0, 300);
        try {
          const parsed = JSON.parse(detail) as { error?: { message?: string } };
          message = parsed.error?.message?.trim() || message;
        } catch {
          // Preserve Anthropic's plain-text response when it is not JSON.
        }
        throw new Error(`Claude HTTP ${response.status}: ${message}`);
      }

      const text = await readAnthropicStream(response);
      if (!text) throw new Error("Claude returned an empty answer");

      return { text, model, latencyMs: Date.now() - started };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  for (const provider of RESCUE_PROVIDERS) {
    const apiKey = env[provider.envKey];
    if (!apiKey) continue;
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: opts.maxTokens ?? 4000,
          messages: [{ role: "system", content: opts.system }, ...opts.messages],
        }),
      });
      if (!response.ok) {
        errors.push(`${provider.name} HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
        continue;
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        errors.push(`${provider.name}: empty answer`);
        continue;
      }
      return { text, model: provider.model, latencyMs: Date.now() - started };
    } catch (error) {
      errors.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Claude unavailable: ${errors.join("; ")}`);
}
