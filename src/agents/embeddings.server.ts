// Embeddings client (server-only).
//
// Single provider: the Lovable AI Gateway, google/gemini-embedding-2 at 768
// dimensions (see src/server/embed.ts). The old local Ollama nomic-embed-text
// client is gone; this module keeps the embedText(input) shape its callers
// were written against.
import { embed, EMBED_DIMENSIONS, EMBED_MODEL } from "@/server/embed";

export const EMBEDDING_MODEL = EMBED_MODEL;
export const EMBEDDING_DIMS = EMBED_DIMENSIONS;

export async function embedText(input: string | string[]): Promise<number[][]> {
  const texts = Array.isArray(input) ? input : [input];
  return embed(texts);
}
