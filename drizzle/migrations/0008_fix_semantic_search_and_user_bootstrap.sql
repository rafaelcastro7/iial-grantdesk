-- Semantic catalog search now reads the populated grant_embeddings space
-- (gemini-embedding-2/768) instead of the never-populated grant_search_documents.
CREATE OR REPLACE FUNCTION public.match_grant_search_documents(query_embedding vector, match_threshold double precision DEFAULT 0.35, match_count integer DEFAULT 100)
 RETURNS TABLE(grant_id uuid, semantic_similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    e.grant_id,
    (1 - (e.embedding OPERATOR(public.<=>) query_embedding))::double precision as semantic_similarity
  from public.grant_embeddings e
  join public.grants g on g.id = e.grant_id
  where e.embedding is not null
    and e.model = 'gemini-embedding-2/768'
    and g.status not in ('archived', 'expired', 'lost')
    and 1 - (e.embedding OPERATOR(public.<=>) query_embedding) >= match_threshold
  order by e.embedding OPERATOR(public.<=>) query_embedding
  limit least(greatest(match_count, 1), 100);
$function$;

COMMENT ON TABLE public.grant_search_documents IS 'DEPRECATED: semantic search reads grant_embeddings';

-- Idempotent provisioning for the signed-in user (no trigger on auth.users is allowed here).
CREATE OR REPLACE FUNCTION public.ensure_current_user()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.profiles (id, preferred_lang) values (auth.uid(), 'en')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'member')
  on conflict do nothing;
end; $function$;

REVOKE ALL ON FUNCTION public.ensure_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_user() TO authenticated;

-- Internal privileged helpers are not for anonymous callers.
REVOKE EXECUTE ON FUNCTION public.auto_promote_stale_candidates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_consultant_by_email(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.replace_extracted_requirements(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_consultant() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
