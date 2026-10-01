-- Read-only: exports the latest proposals with their sections and the AI
-- runs that produced them, as one JSON value to copy back for review.
-- Paste into Cloud -> Database -> SQL editor and copy the single result cell.
SELECT jsonb_pretty(jsonb_agg(p_json ORDER BY created_at DESC)) AS proposals
FROM (
  SELECT p.created_at,
    jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'status', p.status,
      'language', p.language,
      'created_at', p.created_at,
      'metadata', p.metadata,
      'grant', (SELECT jsonb_build_object('id', g.id, 'title', g.title, 'status', g.status,
                  'amount_cad_max', g.amount_cad_max, 'deadline', g.deadline)
                FROM public.grants g WHERE g.id = p.grant_id),
      'sections', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                    'ord', s.ord, 'kind', s.kind, 'heading_en', s.heading_en,
                    'words_en', coalesce(array_length(regexp_split_to_array(trim(s.content_en), '\s+'), 1), 0),
                    'content_en', left(s.content_en, 4000),
                    'critic_notes', s.critic_notes,
                    'updated_at', s.updated_at) ORDER BY s.ord), '[]'::jsonb)
                   FROM public.proposal_sections s WHERE s.proposal_id = p.id),
      'runs', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'agent', r.agent, 'status', r.status, 'model', r.model,
                 'input_tokens', r.input_tokens, 'output_tokens', r.output_tokens,
                 'error', left(r.error, 500), 'created_at', r.created_at) ORDER BY r.created_at), '[]'::jsonb)
               FROM public.agent_runs r
               WHERE r.created_at >= p.created_at - interval '5 minutes'
                 AND r.agent IN ('strategist', 'writer', 'critic')
                 AND (r.metadata->>'proposal_id' = p.id::text
                      OR r.run_id::text = p.metadata->>'strategist_run'))
    ) AS p_json
  FROM public.proposals p
  ORDER BY p.created_at DESC
  LIMIT 5
) t;
