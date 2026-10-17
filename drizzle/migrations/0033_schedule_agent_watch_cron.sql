create extension if not exists pg_cron;
create extension if not exists pg_net;

DO $$
declare
  hook_base text := coalesce(
    current_setting('app.hook_base_url', true),
    'https://iial-grantdesk.lovable.app'
  );
begin
  begin perform cron.unschedule('iial-agent-watch-daily'); exception when others then null; end;

  perform cron.schedule('iial-agent-watch-daily','30 11 * * *', format($job$
    WITH p AS (
      SELECT EXTRACT(EPOCH FROM NOW())::bigint::text AS ts,
             encode(gen_random_bytes(16),'hex') AS nonce,
             '{"trigger":"cron"}'::text AS body,
             (SELECT value FROM public.webhook_config WHERE key='hmac_secret') AS secret
    )
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-iial-timestamp', p.ts,
        'x-iial-nonce', p.nonce,
        'x-iial-signature', encode(extensions.hmac(p.ts || '.' || p.nonce || '.' || p.body, p.secret, 'sha256'),'hex')
      ),
      body := p.body::jsonb
    ) FROM p;
  $job$, hook_base || '/api/public/hooks/agent-watch'));
end $$;