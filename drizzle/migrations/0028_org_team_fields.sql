ALTER TABLE public.org_profiles ADD COLUMN IF NOT EXISTS decision_maker_name text;
ALTER TABLE public.org_profiles ADD COLUMN IF NOT EXISTS outreach_credentials text;

UPDATE public.org_profiles p
SET decision_maker_name = COALESCE(p.decision_maker_name, 'Marcelo'),
    outreach_credentials = COALESCE(
      p.outreach_credentials,
      'Dr. Juan Marcelo Gómez — doctoral research at Henley Business School (University of Reading, UK) on sustainability in the fine cacao and chocolate value chain: https://centaur.reading.ac.uk/115792/8/Gomez%2Band%2BMcKenzie%2B036.pdf'
    )
FROM public.organizations o
WHERE o.id = p.org_id AND o.slug IN ('iial', 'nahua-canada', 'grantdesk-qa');