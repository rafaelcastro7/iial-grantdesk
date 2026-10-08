// Environment-aware LLM client.
//
// Single provider: the Lovable AI Gateway (see src/server/llm.ts). The old
// Cerebras/Groq/Gemini chain and the local Ollama floor are gone — one key,
// one endpoint, one model served for us. This module keeps the call shape the
// agents were written against (agent name, runId, token counts) and maps each
// agent to a gateway role.
import { logGenAI, newRunId } from "@/lib/otel";
import { callLlm as callGatewayLlm, type Role } from "@/server/llm";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmCallOptions = {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  agent: "discoverer" | "enricher" | "evaluator" | "strategist" | "writer" | "critic";
  runId?: string;
  responseFormat?: "json";
  // Optional schema guard — output that fails this check is treated as a
  // failure instead of returning unusable content. Pass the caller's Zod
  // parse (see critic.functions.ts).
  validate?: (text: string) => boolean;
  /** Free-tier providers only; never the paid gateway. */
  freeOnly?: boolean;
};

export type LlmCallResult = {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  runId: string;
  model?: string;
  provider?: string;
};

/** Extraction agents are volume work; judgement and prose get more thinking. */
function roleFor(agent: LlmCallOptions["agent"]): Role {
  switch (agent) {
    case "discoverer":
    case "enricher":
      return "extract";
    case "evaluator":
    case "critic":
      return "judge";
    case "strategist":
    case "writer":
      return "write";
  }
}

export async function callLlm(opts: LlmCallOptions): Promise<LlmCallResult> {
  const runId = opts.runId ?? newRunId();
  const t0 = Date.now();
  let ok = false;
  let errMsg: string | undefined;
  let text = "";
  let used: { provider?: string; model?: string; attempts?: string[] } = {};

  try {
    const result = await callGatewayLlm({
      role: roleFor(opts.agent),
      messages: opts.messages,
      json: opts.responseFormat === "json",
      maxTokens: opts.maxOutputTokens,
      temperature: opts.temperature,
      validate: opts.validate,
      freeOnly: opts.freeOnly,
    });
    text = result.text;
    used = { provider: result.provider, model: result.model, attempts: result.attempts };
    ok = true;
    return {
      text,
      runId,
      model: result.model,
      provider: result.provider,
    };
  } catch (error) {
    errMsg = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    logGenAI({
      // The provider that actually answered (free tier or the paid Lovable floor).
      "gen_ai.system": (used.provider ?? "none") as never,
      "gen_ai.request.model": (used.model ?? "none") as never,
      ...(used.attempts?.length ? { attempts: used.attempts.join(" | ").slice(0, 300) } : {}),
      "gen_ai.operation.name": "chat",
      latency_ms: Date.now() - t0,
      ok,
      agent: opts.agent,
      run_id: runId,
      ...(errMsg ? { error: errMsg } : {}),
    });
  }
}
