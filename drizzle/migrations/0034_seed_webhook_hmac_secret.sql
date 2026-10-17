INSERT INTO public.webhook_config (key, value)
SELECT 'hmac_secret', encode(gen_random_bytes(48), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.webhook_config WHERE key = 'hmac_secret');