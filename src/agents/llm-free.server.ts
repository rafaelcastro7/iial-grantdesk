// Gap-fill LLM entry point (enricher's missing-field cascade).
//
// Single provider: the Lovable AI Gateway. The old free-provider chain
// (Cerebras -> Groq -> Gemini -> local Ollama) is gone — one key, one
// endpoint, one model served for us. The name and result shape stay so the
// enricher and its callers keep working unchanged.

import { newRunId } from "@/lib/otel";
import { callLlm } from "@/agents/llm.server";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type Agent = "discoverer" | "enricher" | "evaluator" | "strategist" | "writer" | "critic";

export type FreeLlmOptions = {
  agent: Agent;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat?: "json";
  runId?: string;
  preferred?: string[];
};

export type FreeLlmResult = {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  runId: string;
  provider: string;
  model: string;
};

export function freeProvidersAvailable(): string[] {
  return ["lovable-ai"];
}

export async function callFreeLlm(opts: FreeLlmOptions): Promise<FreeLlmResult> {
  const result = await callLlm({
    agent: opts.agent,
    messages: opts.messages,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
    responseFormat: opts.responseFormat,
    runId: opts.runId ?? newRunId(),
  });
  return {
    text: result.text,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    runId: result.runId,
    provider: result.provider ?? "lovable-ai",
    model: result.model ?? "openai/gpt-6-astra",
  };
}
