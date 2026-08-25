import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getImportedExamSubjectKey, getTelegramExamCatalogLevel } from "./telegramExam";
import { isExcludedExamYear, levelKeyForSupabaseLevelOrder, normalizedArabicLabel, normalizedForm, SECONDARY_SOURCE_SUBJECT_NAMES, type SupabaseExamSyncResult, type SupabaseExamSyncSubjectResult } from "./supabaseExamSync";

type SourceLevel = { id: string; order_index: number };
type SourceSubject = { id: string; level_id: string; name: string; order_index: number };
type SourceForm = { form_id: string; form_name: string; order_index: number; hidden: boolean };
type SourceQuestion = {
  id: string;
  question_text: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_option: string | null;
  hint: string | null;
  explanation: string | null;
  exam_year: number | null;
  exam_form: string | null;
  status: string;
  created_at: string | null;
};

type SnapshotOptions = {
  dryRun?: boolean;
  onSubjectComplete?: (result: SupabaseExamSyncSubjectResult) => Promise<void> | void;
};

const DEFAULT_SUPABASE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co";
const PAGE_SIZE = 1000;

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY غير متاح لـ Snapshot البوت.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function assertNoError(error: { message?: string } | null, operation: string): void {
  if (error) throw new Error(`فشل ${operation}: ${error.message ?? "خطأ غير معروف"}`);
}

async function selectAll<T>(client: SupabaseClient, table: string, select: string, configure: (query: any) => any): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.from(table).select(select);
    query = configure(query).range(offset, offset + PAGE_SIZE - 1);
    const { data, error } = await query;
    assertNoError(error, `قراءة ${table}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

function parseYear(value: number | null | undefined): number | null {
  return Number.isInteger(value) && value ? Number(value) : null;
}

export async function snapshotSupabaseExamLevel(levelKey: string, options: SnapshotOptions = {}): Promise<SupabaseExamSyncResult> {
  const level = getTelegramExamCatalogLevel(levelKey);
  if (!level || level.comingSoon || level.hidden) throw new Error("المستوى المطلوب غير صالح لـ Snapshot البوت.");
  const client = getSupabase();
  const sourceLevels = await selectAll<SourceLevel>(client, "levels", "id,order_index", query => query.order("order_index", { ascending: true }));
  const sourceLevel = sourceLevels.find(item => levelKeyForSupabaseLevelOrder(Number(item.order_index)) === levelKey);
  if (!sourceLevel) throw new Error(`لم يُعثر على مستوى ${levelKey} في Supabase.`);
  const sourceSubjects = await selectAll<SourceSubject>(client, "subjects", "id,level_id,name,order_index", query => query.eq("level_id", sourceLevel.id).order("order_index", { ascending: true }));

  let subjects = 0;
  let forms = 0;
  let questions = 0;
  let excludedQuestions = 0;
  for (const sourceSubject of sourceSubjects) {
    const subjectOrder = Number(sourceSubject.order_index);
    const catalogSubject = level.subjects[subjectOrder - 1];
    const expectedName = SECONDARY_SOURCE_SUBJECT_NAMES[levelKey]?.[subjectOrder - 1];
    if (!catalogSubject) {
      if (expectedName) throw new Error(`المادة ${subjectOrder} غير موجودة في كتالوج ${levelKey}.`);
      continue;
    }
    if (expectedName && normalizedArabicLabel(sourceSubject.name) !== normalizedArabicLabel(expectedName)) {
      throw new Error(`اختلاف اسم مادة ${levelKey} رقم ${subjectOrder}: «${sourceSubject.name}» مقابل «${expectedName}».`);
    }
    const subjectKey = getImportedExamSubjectKey(levelKey, catalogSubject.key);
    if (!subjectKey) continue;

    const [sourceForms, sourceQuestions] = await Promise.all([
      selectAll<SourceForm>(client, "subject_exam_forms", "form_id,form_name,order_index,hidden", query => query.eq("subject_id", sourceSubject.id).order("order_index", { ascending: true }).order("form_name", { ascending: true })),
      selectAll<SourceQuestion>(client, "questions", "id,question_text,option_a,option_b,option_c,option_d,correct_option,hint,explanation,exam_year,exam_form,status,created_at", query => query.eq("subject_id", sourceSubject.id).eq("status", "active").order("exam_year", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true })),
    ]);
    const sourceFormByKey = new Map(sourceForms.filter(form => !form.hidden).map(form => [form.form_id, form]));
    const formsByKey = new Map<string, { formKey: string; formName: string; sortOrder: number }>();
    const questionsByForm = new Map<string, SourceQuestion[]>();
    for (const sourceForm of Array.from(sourceFormByKey.values())) {
      const form = normalizedForm({
        formKey: sourceForm.form_id,
        sourceName: sourceForm.form_name,
        sourceOrder: Number(sourceForm.order_index),
        treatAsAnnual: levelKey.startsWith("secondary-"),
        year: levelKey.startsWith("secondary-") ? 2026 : null,
      });
      if (!isExcludedExamYear(levelKey, Number(form.formName.match(/20\d{2}/)?.[0]))) formsByKey.set(form.formKey, form);
    }
    let subjectExcludedQuestions = 0;
    for (const sourceQuestion of sourceQuestions) {
      if (!["A", "B", "C", "D"].includes(sourceQuestion.correct_option ?? "")) continue;
      const year = parseYear(sourceQuestion.exam_year);
      if (isExcludedExamYear(levelKey, year)) {
        excludedQuestions += 1;
        subjectExcludedQuestions += 1;
        continue;
      }
      const sourceFormKey = sourceQuestion.exam_form?.trim() || "unclassified";
      const sourceForm = sourceFormByKey.get(sourceFormKey);
      const form = normalizedForm({
        formKey: sourceFormKey,
        sourceName: sourceForm?.form_name ?? (sourceFormKey === "unclassified" ? "أسئلة عامة" : undefined),
        sourceOrder: sourceForm?.order_index,
        year,
        treatAsAnnual: levelKey.startsWith("secondary-"),
      });
      formsByKey.set(form.formKey, form);
      const grouped = questionsByForm.get(form.formKey) ?? [];
      grouped.push(sourceQuestion);
      questionsByForm.set(form.formKey, grouped);
    }

    const subjectForms = Array.from(formsByKey.values())
      .sort((a, b) => a.sortOrder - b.sortOrder || a.formKey.localeCompare(b.formKey))
      .map((form, index) => ({ ...form, sortOrder: (levelKey.startsWith("secondary-") ? 2026000 : 100000) + index + 1 }));
    const subjectQuestions = Array.from(questionsByForm.values()).reduce((sum, batch) => sum + batch.length, 0);
    if (!options.dryRun) {
      const { error: deactivateFormsError } = await client.from("bot_exam_forms").update({ is_active: false, updated_at: new Date().toISOString() }).eq("subject_key", subjectKey);
      assertNoError(deactivateFormsError, "تعطيل نماذج البوت القديمة");
      const { error: deactivateQuestionsError } = await client.from("bot_exam_questions").update({ is_active: false, updated_at: new Date().toISOString() }).eq("subject_key", subjectKey);
      assertNoError(deactivateQuestionsError, "تعطيل أسئلة البوت القديمة");
      for (let offset = 0; offset < subjectForms.length; offset += 100) {
        const batch = subjectForms.slice(offset, offset + 100).map(form => ({ subject_key: subjectKey, form_key: form.formKey, form_name: form.formName, sort_order: form.sortOrder, is_active: true, updated_at: new Date().toISOString() }));
        if (batch.length) {
          const { error } = await client.from("bot_exam_forms").upsert(batch, { onConflict: "subject_key,form_key" });
          assertNoError(error, "حفظ نماذج البوت");
        }
      }
      for (const [formKey, grouped] of Array.from(questionsByForm.entries())) {
        const batch = grouped.map((question: SourceQuestion, index: number) => ({
          source_question_id: question.id,
          subject_key: subjectKey,
          section_key: formKey,
          question_text: question.question_text ?? "",
          option_a: question.option_a ?? "",
          option_b: question.option_b ?? "",
          option_c: question.option_c ?? "",
          option_d: question.option_d ?? "",
          correct_option: question.correct_option,
          explanation: question.explanation ?? "",
          hint: question.hint,
          sort_order: index + 1,
          is_active: true,
          updated_at: new Date().toISOString(),
        }));
        for (let offset = 0; offset < batch.length; offset += 100) {
          const chunk = batch.slice(offset, offset + 100);
          const { error } = await client.from("bot_exam_questions").upsert(chunk, { onConflict: "source_question_id" });
          assertNoError(error, "حفظ أسئلة البوت");
        }
      }
    }
    subjects += 1;
    forms += subjectForms.length;
    questions += subjectQuestions;
    await options.onSubjectComplete?.({ levelKey, subjectKey, subjectName: catalogSubject.name, forms: subjectForms.length, questions: subjectQuestions, excludedQuestions: subjectExcludedQuestions });
  }
  return { levelKey, subjects, forms, questions, excludedQuestions };
}

export async function snapshotAllSupabaseBotExams(options: SnapshotOptions = {}): Promise<SupabaseExamSyncResult[]> {
  const levels = ["l1", "l2", "l3", "l4", "secondary-literary", "secondary-scientific"];
  const results: SupabaseExamSyncResult[] = [];
  for (const levelKey of levels) results.push(await snapshotSupabaseExamLevel(levelKey, options));
  return results;
}
