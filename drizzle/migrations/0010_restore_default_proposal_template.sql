INSERT INTO public.proposal_templates (owner_id, name, name_fr, description, sections, is_global)
SELECT NULL, 'Standard Canadian Grant', 'Subvention canadienne standard',
  'Default template covering the sections required by most federal/provincial grant programs.',
  '[
    {"kind":"summary","heading_en":"Executive Summary","heading_fr":"Résumé"},
    {"kind":"problem","heading_en":"Problem Statement","heading_fr":"Énoncé du problème"},
    {"kind":"solution","heading_en":"Proposed Solution","heading_fr":"Solution proposée"},
    {"kind":"impact","heading_en":"Expected Impact","heading_fr":"Impact attendu"},
    {"kind":"budget","heading_en":"Budget","heading_fr":"Budget"},
    {"kind":"team","heading_en":"Team","heading_fr":"Équipe"},
    {"kind":"timeline","heading_en":"Timeline","heading_fr":"Calendrier"},
    {"kind":"sustainability","heading_en":"Sustainability","heading_fr":"Durabilité"},
    {"kind":"evaluation","heading_en":"Evaluation Plan","heading_fr":"Plan d''évaluation"}
  ]'::jsonb,
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.proposal_templates WHERE is_global = TRUE);