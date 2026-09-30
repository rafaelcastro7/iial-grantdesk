// Model router — maps each agent to its model.
//
// Provider chain: Cerebras -> Groq -> Gemini first, Lovable AI Gateway as the
// paid floor (see src/server/llm.ts). The per-agent assignment is kept as a
// record of each agent's role (extraction vs judgement vs prose) so call
// sites and traces still carry a meaningful name.

import type { AgentName } from "@/lib/agent-config.server";

export type ModelAssignment = {
  primary: string;
  fallback: string | null;
  reason: string;
};

const GATEWAY_MODEL = "openai/gpt-6-astra";
export const PROVIDER_CHAIN = "cerebras/qwen-3.8-27b → groq/qwen3.8-27b → gemini/3.1-flash-lite → lovable";

export const AGENT_MODEL_MAP: Record<AgentName, ModelAssignment> = {
  discoverer: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Extracción estructurada de alto volumen, vía cadena externa con respaldo Lovable.",
  },
  enricher: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Relleno de campos en lote, modo JSON, vía cadena externa con respaldo Lovable.",
  },
  evaluator: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Scoring de fit; las reglas deterministas hacen el trabajo pesado.",
  },
  strategist: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Razonamiento para planificar la propuesta, vía cadena externa con respaldo Lovable.",
  },
  writer: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Generación de prosa, vía cadena externa con respaldo Lovable.",
  },
  critic: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Revisión crítica, vía cadena externa con respaldo Lovable.",
  },
};

export function resolveModel(agent: AgentName, preferFallback = false): string {
  const assignment = AGENT_MODEL_MAP[agent];
  if (!assignment) return GATEWAY_MODEL;
  return preferFallback && assignment.fallback ? assignment.fallback : assignment.primary;
}

export function resolveFallback(agent: AgentName): string | null {
  return AGENT_MODEL_MAP[agent]?.fallback ?? null;
}

export function getModelReason(agent: AgentName): string {
  return AGENT_MODEL_MAP[agent]?.reason ?? "";
}
