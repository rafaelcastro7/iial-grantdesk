import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env.server";

/**
 * Embeddings for the semantic half of retrieval, through Lovable AI.
 *
 * Multilingual on purpose: the product claims the Américas in four languages,
 * and with an English-only embedder every French and Spanish call in the
 * catalog was reachable by exact wording alone. See migration 0014.
 *
 * Two widths, kept apart on purpose. Grant vectors are 1024 wide, matching the
 * `vector(1024)` column, and answer-library vectors are 768, matching theirs.
 * The two spaces never meet: grant vectors are only ever compared to grant
 * queries, answer vectors only to requirement queries. A width change would
 * corrupt every distance in its table, so it is a migration, never a swap.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const GATEWAY_MODEL = "google/gemini-embedding-2";

export const EMBED_MODEL = "gemini-embedding-2/1024";
export const EMBED_DIMENSIONS = 1024;

export const ANSWER_EMBED_MODEL = "gemini-embedding-2/768";
export const ANSWER_EMBED_DIMENSIONS = 768;

/** Rows per request: grant descriptions run to 8000 characters each. */
const EMBED_BATCH = 16;

/** Re-embedding unchanged text is the main avoidable cost, so content is hashed. */
export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function embed(texts: string[], model: string = EMBED_MODEL): Promise<number[][]> {
  const env = serverEnv();
  const out: number[][] = [];
  const dimensions = model === ANSWER_EMBED_MODEL ? ANSWER_EMBED_DIMENSIONS : EMBED_DIMENSIONS;

  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const chunk = texts.slice(i, i + EMBED_BATCH);
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: GATEWAY_MODEL, input: chunk, dimensions }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`embedding failed: HTTP ${response.status} ${detail.slice(0, 300)}`);
    }
    const body = (await response.json()) as {
      data?: Array<{ index: number; embedding: number[] }>;
    };
    const items = body.data ?? [];
    if (items.length !== chunk.length) {
      throw new Error(`embedder returned ${items.length} vectors for ${chunk.length} inputs`);
    }
    // Order is by `index`, not arrival: a reordered batch would attach every
    // vector to the wrong row and the error would be invisible.
    const ordered = [...items].sort((a, b) => a.index - b.index);
    for (const item of ordered) {
      if (item.embedding.length !== dimensions) {
        throw new Error(
          `${model} returned ${item.embedding.length} dimensions, but its column is ${dimensions}`,
        );
      }
      out.push(item.embedding);
    }
  }

  return out;
}

export async function embedOne(text: string, model: string = EMBED_MODEL): Promise<number[]> {
  const [vector] = await embed([text], model);
  if (!vector) throw new Error("the embedder returned no vector");
  return vector;
}

/** What a grant is embedded *as*. Kept in one place so the query side matches. */
export function grantText(grant: {
  title: string;
  summary?: string | null;
  eligibility_note?: string | null;
}): string {
  return [grant.title, grant.summary, grant.eligibility_note]
    .filter((part) => !!part && String(part).trim().length > 0)
    .join("\n\n")
    .slice(0, 8000);
}

export type EmbedCatalogResult = {
  considered: number;
  embedded: number;
  unchanged: number;
};

/**
 * Bring the embedding table up to date with the catalog.
 *
 * Only rows whose text actually changed are re-embedded, so a nightly run over
 * an unchanged catalog costs one query rather than a full pass.
 */
export async function embedCatalog(
  supabase: SupabaseClient,
  options: { limit?: number } = {},
): Promise<EmbedCatalogResult> {
  const { data: grants, error } = await supabase
    .from("grants")
    .select("id, title, summary, eligibility_note")
    .eq("status", "open")
    .limit(options.limit ?? 5000);
  if (error) throw new Error(`could not read grants: ${error.message}`);

  const rows = (grants ?? []) as Array<{
    id: string;
    title: string;
    summary: string | null;
    eligibility_note: string | null;
  }>;

  const { data: existing } = await supabase
    .from("grant_embeddings")
    .select("grant_id, content_hash");
  const known = new Map(
    ((existing ?? []) as Array<{ grant_id: string; content_hash: string }>).map((r) => [
      r.grant_id,
      r.content_hash,
    ]),
  );

  const stale = rows
    .map((row) => ({ row, text: grantText(row), hash: contentHash(grantText(row)) }))
    .filter((item) => known.get(item.row.id) !== item.hash);

  let embedded = 0;
  for (let i = 0; i < stale.length; i += 64) {
    const batch = stale.slice(i, i + 64);
    const vectors = await embed(batch.map((item) => item.text));
    const { error: writeError } = await supabase.from("grant_embeddings").upsert(
      batch.map((item, index) => ({
        grant_id: item.row.id,
        embedding: JSON.stringify(vectors[index]),
        content_hash: item.hash,
        model: EMBED_MODEL,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "grant_id" },
    );
    if (writeError) throw new Error(`could not store embeddings: ${writeError.message}`);
    embedded += batch.length;
  }

  return { considered: rows.length, embedded, unchanged: rows.length - stale.length };
}

/**
 * Back-fill answers that were stored without an embedding.
 *
 * `saveAnswer` deliberately keeps a consultant's work even when the local
 * embedder is unreachable — losing what they wrote because a model was down
 * would be far worse. But nothing ever came back for those rows, so an answer
 * saved during one bad minute was silently excluded from reuse forever, and the
 * library quietly stopped being worth anything for that client.
 *
 * Run alongside the catalog embed; it is a no-op when there is nothing to fix.
 */
export async function embedPendingAnswers(supabase: SupabaseClient): Promise<{ embedded: number }> {
  const { data, error } = await supabase
    .from("answer_library")
    .select("id, label, content")
    .is("embedding", null)
    .limit(500);
  if (error) throw new Error(`could not read the answer library: ${error.message}`);

  const rows = (data ?? []) as Array<{ id: string; label: string; content: string }>;
  if (rows.length === 0) return { embedded: 0 };

  const texts = rows.map((row) => `${row.label}. ${row.content}`.slice(0, 4000));
  const vectors = await embed(texts, ANSWER_EMBED_MODEL);

  for (let i = 0; i < rows.length; i++) {
    const { error: writeError } = await supabase
      .from("answer_library")
      .update({
        embedding: JSON.stringify(vectors[i]),
        content_hash: contentHash(texts[i]!),
      })
      .eq("id", rows[i]!.id);
    if (writeError) throw new Error(`could not store an answer embedding: ${writeError.message}`);
  }

  return { embedded: rows.length };
}
