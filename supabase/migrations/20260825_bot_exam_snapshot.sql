-- One-time exam snapshot from the platform exam tables into bot-owned tables.
-- Run only after reviewing the dry-run counts. This does not modify source tables.

-- The arrays mirror the reviewed Telegram catalog order. Scientific mathematics is intentionally absent.
WITH catalog(level_order, subject_key, subject_order) AS (
  SELECT 1, key, ordinality::int FROM jsonb_array_elements_text('["l1_usul_fiqh","l1_criminology","exam_l1_l1_political_systems","exam_l1_l1_history_law","exam_l1_l1_economics","exam_l1_l1_national_culture","exam_l1_l1_worship","exam_l1_l1_computer","exam_l1_l1_fiqh_intro","exam_l1_l1_arab_conflict","exam_l1_l1_arabic","exam_l1_l1_law_intro","exam_l1_l1_hadith","exam_l1_l1_legal_terms"]') WITH ORDINALITY AS t(key, ordinality)
  UNION ALL SELECT 2, key, ordinality::int FROM jsonb_array_elements_text('["exam_l2_l2_admin_law","exam_l2_l2_civil_law","exam_l2_l2_arabic","exam_l2_l2_local_admin","exam_l2_l2_money_banks","exam_l2_l2_family","exam_l2_l2_organizations_rights","exam_l2_l2_penalties","exam_l2_l2_islamic_culture","exam_l2_l2_usul","exam_l2_l2_international_law","exam_l2_l2_transactions"]') WITH ORDINALITY AS t(key, ordinality)
  UNION ALL SELECT 3, key, ordinality::int FROM jsonb_array_elements_text('["exam_l3_l3_admin_judiciary","exam_l3_l3_civil_law","exam_l3_l3_labor_law","exam_l3_l3_commercial_law","exam_l3_l3_pleadings","exam_l3_l3_inheritance","exam_l3_l3_criminal_legislation","exam_l3_l3_sirah","exam_l3_l3_arabic","exam_l3_l3_maritime_air","exam_l3_l3_transactions","exam_l3_l3_special_penalties","exam_l3_l3_usul"]') WITH ORDINALITY AS t(key, ordinality)
  UNION ALL SELECT 4, key, ordinality::int FROM jsonb_array_elements_text('["exam_l4_l4_commercial_law","exam_l4_l4_compulsory_execution","exam_l4_l4_usul","exam_l4_l4_judiciary_proof","exam_l4_l4_private_international","exam_l4_l4_interpretation","exam_l4_l4_will_waqf","exam_l4_l4_conflict_laws","exam_l4_l4_finance_tax","exam_l4_l4_criminal_procedure","civil_law","exam_l4_l4_arabic","exam_l4_l4_research_methods"]') WITH ORDINALITY AS t(key, ordinality)
  UNION ALL SELECT 6, key, ordinality::int FROM jsonb_array_elements_text('["exam_secondary_literary_history","exam_secondary_literary_geography","exam_secondary_literary_philosophy","exam_secondary_literary_islamic","exam_secondary_literary_arabic","exam_secondary_literary_quran","exam_secondary_literary_english","exam_secondary_literary_math"]') WITH ORDINALITY AS t(key, ordinality)
  UNION ALL SELECT 7, key, ordinality::int FROM jsonb_array_elements_text('["exam_secondary_scientific_quran","exam_secondary_scientific_islamic","exam_secondary_scientific_arabic","exam_secondary_scientific_english","exam_secondary_scientific_biology","exam_secondary_scientific_physics","exam_secondary_scientific_chemistry"]') WITH ORDINALITY AS t(key, ordinality)
), raw_forms AS (
  SELECT c.subject_key, l.order_index AS level_order,
    CASE WHEN l.order_index IN (6, 7) AND f.form_id IN ('General', 'Parallel', 'Mixed') THEN lower(f.form_id) || '_2026' ELSE f.form_id END AS form_key,
    CASE WHEN l.order_index IN (6, 7) AND f.form_name !~ '20[0-9]{2}' THEN '2026 ' || f.form_name ELSE f.form_name END AS form_name,
    coalesce(f.order_index, 900) AS base_sort_order
  FROM public.levels l
  JOIN public.subjects s ON s.level_id = l.id
  JOIN catalog c ON c.level_order = l.order_index AND c.subject_order = s.order_index
  JOIN public.subject_exam_forms f ON f.subject_id = s.id
  WHERE l.order_index IN (1, 2, 3, 4, 6, 7) AND coalesce(f.hidden, false) = false
), source_forms AS (
  SELECT subject_key, form_key, form_name,
    CASE WHEN level_order IN (6, 7)
      THEN 2026000 + row_number() OVER (PARTITION BY subject_key ORDER BY base_sort_order, form_key)::int
      ELSE 100000 + row_number() OVER (PARTITION BY subject_key ORDER BY base_sort_order, form_key)::int
    END AS sort_order
  FROM raw_forms
)
INSERT INTO public.bot_exam_forms (subject_key, form_key, form_name, sort_order, is_active, updated_at)
SELECT subject_key, form_key, form_name, sort_order, true, now()
FROM source_forms
LIMIT 1000
ON CONFLICT (subject_key, form_key) DO UPDATE SET form_name = excluded.form_name, sort_order = excluded.sort_order, is_active = true, updated_at = now();

WITH catalog(level_order, subject_key, subject_order) AS (
  SELECT 1, key, ordinality::int FROM jsonb_array_elements_text('["l1_usul_fiqh","l1_criminology","exam_l1_l1_political_systems","exam_l1_l1_history_law","exam_l1_l1_economics","exam_l1_l1_national_culture","exam_l1_l1_worship","exam_l1_l1_computer","exam_l1_l1_fiqh_intro","exam_l1_l1_arab_conflict","exam_l1_l1_arabic","exam_l1_l1_law_intro","exam_l1_l1_hadith","exam_l1_l1_legal_terms"]') WITH ORDINALITY AS t(key, ordinality)
  UNION ALL SELECT 2, key, ordinality::int FROM jsonb_array_elements_text('["exam_l2_l2_admin_law","exam_l2_l2_civil_law","exam_l2_l2_arabic","exam_l2_l2_local_admin","exam_l2_l2_money_banks","exam_l2_l2_family","exam_l2_l2_organizations_rights","exam_l2_l2_penalties","exam_l2_l2_islamic_culture","exam_l2_l2_usul","exam_l2_l2_international_law","exam_l2_l2_transactions"]') WITH ORDINALITY AS t(key, ordinality)
  UNION ALL SELECT 3, key, ordinality::int FROM jsonb_array_elements_text('["exam_l3_l3_admin_judiciary","exam_l3_l3_civil_law","exam_l3_l3_labor_law","exam_l3_l3_commercial_law","exam_l3_l3_pleadings","exam_l3_l3_inheritance","exam_l3_l3_criminal_legislation","exam_l3_l3_sirah","exam_l3_l3_arabic","exam_l3_l3_maritime_air","exam_l3_l3_transactions","exam_l3_l3_special_penalties","exam_l3_l3_usul"]') WITH ORDINALITY AS t(key, ordinality)
  UNION ALL SELECT 4, key, ordinality::int FROM jsonb_array_elements_text('["exam_l4_l4_commercial_law","exam_l4_l4_compulsory_execution","exam_l4_l4_usul","exam_l4_l4_judiciary_proof","exam_l4_l4_private_international","exam_l4_l4_interpretation","exam_l4_l4_will_waqf","exam_l4_l4_conflict_laws","exam_l4_l4_finance_tax","exam_l4_l4_criminal_procedure","civil_law","exam_l4_l4_arabic","exam_l4_l4_research_methods"]') WITH ORDINALITY AS t(key, ordinality)
  UNION ALL SELECT 6, key, ordinality::int FROM jsonb_array_elements_text('["exam_secondary_literary_history","exam_secondary_literary_geography","exam_secondary_literary_philosophy","exam_secondary_literary_islamic","exam_secondary_literary_arabic","exam_secondary_literary_quran","exam_secondary_literary_english","exam_secondary_literary_math"]') WITH ORDINALITY AS t(key, ordinality)
  UNION ALL SELECT 7, key, ordinality::int FROM jsonb_array_elements_text('["exam_secondary_scientific_quran","exam_secondary_scientific_islamic","exam_secondary_scientific_arabic","exam_secondary_scientific_english","exam_secondary_scientific_biology","exam_secondary_scientific_physics","exam_secondary_scientific_chemistry"]') WITH ORDINALITY AS t(key, ordinality)
), source_questions AS (
  SELECT c.subject_key, l.order_index AS level_order, q.*,
    CASE WHEN l.order_index IN (6, 7) AND coalesce(q.exam_form, 'unclassified') IN ('General', 'Parallel', 'Mixed') THEN lower(coalesce(q.exam_form, 'unclassified')) || '_2026' ELSE coalesce(q.exam_form, 'unclassified') END AS section_key
  FROM public.levels l
  JOIN public.subjects s ON s.level_id = l.id
  JOIN catalog c ON c.level_order = l.order_index AND c.subject_order = s.order_index
  JOIN public.questions q ON q.subject_id = s.id
  WHERE l.order_index IN (1, 2, 3, 4, 6, 7)
    AND q.status = 'active'
    AND trim(coalesce(q.correct_option, '')) IN ('A', 'B', 'C', 'D')
    AND NOT (l.order_index IN (1, 2, 3) AND q.exam_year IN (2020, 2021))
)
INSERT INTO public.bot_exam_questions (source_question_id, subject_key, section_key, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, hint, sort_order, is_active, updated_at)
SELECT id::text, subject_key, section_key, coalesce(question_text, ''), coalesce(option_a, ''), coalesce(option_b, ''), coalesce(option_c, ''), coalesce(option_d, ''), trim(correct_option)::char(1), coalesce(explanation, ''), hint,
  row_number() OVER (PARTITION BY subject_key, section_key ORDER BY coalesce(created_at, now()), id)::int,
  true, now()
FROM source_questions
LIMIT 100000
ON CONFLICT (source_question_id) DO UPDATE SET subject_key = excluded.subject_key, section_key = excluded.section_key, question_text = excluded.question_text, option_a = excluded.option_a, option_b = excluded.option_b, option_c = excluded.option_c, option_d = excluded.option_d, correct_option = excluded.correct_option, explanation = excluded.explanation, hint = excluded.hint, sort_order = excluded.sort_order, is_active = true, updated_at = now();
