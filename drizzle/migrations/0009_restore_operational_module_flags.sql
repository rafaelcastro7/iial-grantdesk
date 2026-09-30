INSERT INTO public.module_flags (module, enabled, description, description_fr) VALUES
  ('grants', true, 'Grants discovery and catalog', 'Découverte et catalogue de subventions'),
  ('proposals', true, 'Proposal drafting workspace', 'Espace de rédaction de propositions'),
  ('submissions', true, 'Submission packaging and tracking', 'Conditionnement et suivi des soumissions'),
  ('org_profile', true, 'Organization profile and RAG knowledge', 'Profil de l''organisation et base RAG'),
  ('analytics', true, 'Operational metrics and dashboards', 'Métriques opérationnelles et tableaux de bord'),
  ('public_webhooks', true, 'Public webhook endpoints', 'Points de terminaison webhook publics'),
  ('compliance', true, 'Compliance center (PIPEDA, Law 25, AIDA)', 'Centre de conformité (LPRPDE, Loi 25, LIAD)'),
  ('privacy', true, 'Privacy center (consent, DSAR)', 'Centre de confidentialité (consentement, DDAR)'),
  ('grants_discovery', true, 'Automated grant discovery agent', 'Agent de découverte automatique de subventions')
ON CONFLICT (module) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description,
  description_fr = EXCLUDED.description_fr;