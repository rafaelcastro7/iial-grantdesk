import { serverEnv } from "@/lib/env.server";

/**
 * Direct Anthropic API access with the workspace's own ANTHROPIC_API_KEY.
 * Used for features the user explicitly asked to run on their Claude account
 * (the automatic proposal checklist). Every call streams, even when the
 * caller only wants the final text: a buffered request that outlives its
 * socket is billed anyway and reports nothing.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5-5";

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
  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      ...(env.ANTHROPIC_WORKSPACE_ID
        ? { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID }
        : {}),
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
}
