-- The verified-opportunities seed was pasted with a broken encoding: "—" became
-- "â€”" (and similar). Repair titles, summaries and notes. Idempotent.
UPDATE public.grants SET
  title = replace(replace(replace(replace(title, 'â€”', '—'), 'â€“', '–'), 'â€™', '’'), 'Ã©', 'é'),
  summary = replace(replace(replace(replace(summary, 'â€”', '—'), 'â€“', '–'), 'â€™', '’'), 'Ã©', 'é'),
  eligibility_note = replace(replace(replace(replace(eligibility_note, 'â€”', '—'), 'â€“', '–'), 'â€™', '’'), 'Ã©', 'é')
WHERE title LIKE '%â€%' OR title LIKE '%Ã%' OR summary LIKE '%â€%' OR eligibility_note LIKE '%â€%';
