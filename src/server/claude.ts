import { serverEnv } from "@/lib/env.server";

/**
 * Direct Anthropic API access with the workspace's own ANTHROPIC_API_KEY.
 * Used for features the user explicitly asked to run on their Claude account
 * (the automatic proposal checklist). Every call streams, even when the
 * caller only wants the final text: a buffered request that outlives its
 * socket is billed anyway and reports nothing.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

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

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let event: {
        type?: string;
        delta?: { type?: string; text?: string };
        error?: { message?: string };
      };
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        text += event.delta.text ?? "";
      }
      if (event.type === "error") {
        throw new Error(event.error?.message ?? "Claude reported an error");
      }
    }
  }

  return text.trim();
}

export async function callClaude(opts: {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}): Promise<ClaudeResponse> {
  const env = serverEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured in the project secrets");
  }
  const started = Date.now();

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      messages: opts.messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Claude HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }

  const text = await readAnthropicStream(response);
  if (!text) throw new Error("Claude returned an empty answer");

  return { text, model: MODEL, latencyMs: Date.now() - started };
}
