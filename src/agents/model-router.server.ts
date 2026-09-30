// Model router — maps each agent to its model.
//
// Single provider: the Lovable AI Gateway. Every agent resolves to the one
// served model; the per-agent assignment is kept as a record of each agent's
// role (extraction vs judgement vs prose) so call sites and traces still
// carry a meaningful name.

import type { AgentName } from "@/lib/agent-config.server";

export type ModelAssignment = {
  primary: string;
  fallback: string | null;
  reason: string;
};

const GATEWAY_MODEL = "openai/gpt-6-astra";

export const AGENT_MODEL_MAP: Record<AgentName, ModelAssignment> = {
  discoverer: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Extracción estructurada de alto volumen, vía Lovable AI Gateway.",
  },
  enricher: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Relleno de campos en lote, modo JSON, vía Lovable AI Gateway.",
  },
  evaluator: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Scoring de fit; las reglas deterministas hacen el trabajo pesado.",
  },
  strategist: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Razonamiento para planificar la propuesta, vía Lovable AI Gateway.",
  },
  writer: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Generación de prosa, vía Lovable AI Gateway.",
  },
  critic: {
    primary: GATEWAY_MODEL,
    fallback: null,
    reason: "Revisión crítica, vía Lovable AI Gateway.",
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
