import { and, eq, sql } from "drizzle-orm";
import { telegramExamForms, telegramExamQuestions } from "../drizzle/schema";
import { getDb } from "./db";
import { TELEGRAM_EXAM_CATALOG, getImportedExamSubjectKey } from "./telegramExam";

const SOURCE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co/rest/v1";
const LEVEL_KEY_BY_ORDER: Record<number, string> = { 1: "l1", 2: "l2", 3: "l3", 4: "l4" };
const ANNUAL_FORM_TYPES: Record<string, { key: string; name: string; priority: number }> = {
  General: { key: "general", name: "العام", priority: 1 },
  Parallel: { key: "parallel", name: "الموازي", priority: 2 },
  Mixed: { key: "mixed", name: "المختلط", priority: 3 },
};
const ARABIC_ORDINALS = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون"];

type SourceLevel = { id: string; order_index: number };
type SourceSubject = { id: string; level_id: string; order_index: number };
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

export type SupabaseExamSyncResult = { levelKey: string; subjects: number; forms: number; questions: number; excludedQuestions: number };
export type SupabaseExamSyncSubjectResult = { levelKey: string; subjectKey: string; subjectName: string; forms: number; questions: number; excludedQuestions: number };
export type SupabaseExamSyncOptions = { onSubjectComplete?: (result: SupabaseExamSyncSubjectResult) => Promise<void> | void };

export function isExcludedExamYear(levelKey: string, year: number | null | undefined): boolean {
  return ["l1", "l2", "l3"].includes(levelKey) && (year === 2020 || year === 2021);
}

function trainingDisplayName(formKey: string): string {
  const modelNumber = Number(formKey.match(/^Model_(\d+)$/i)?.[1] ?? 0);
  return modelNumber > 0 ? `القسم ${ARABIC_ORDINALS[modelNumber] ?? `رقم ${modelNumber}`}` : formKey;
}

function normalizedForm(input: { formKey: string; sourceName?: string; sourceOrder?: number; year?: number | null }): { formKey: string; formName: string; sortOrder: number } {
  const annual = ANNUAL_FORM_TYPES[input.formKey];
  if (annual && input.year) {
    return { formKey: `${annual.key}_${input.year}`, formName: `${annual.name} ${input.year}`, sortOrder: input.year * 10 + annual.priority };
  }
  const modelNumber = Number(input.formKey.match(/^Model_(\d+)$/i)?.[1] ?? 0);
  return {
    formKey: input.formKey,
    formName: modelNumber > 0 ? trainingDisplayName(input.formKey) : input.sourceName?.trim() || trainingDisplayName(input.formKey),
    sortOrder: 100000 + (modelNumber || input.sourceOrder || 900),
  };
}

async function sourceSelectAll<T>(table: string, params: Record<string, string>): Promise<T[]> {
  const apiKey = process.env.SUPABASE_ANON_KEY;
  if (!apiKey) throw new Error("SUPABASE_ANON_KEY غير متاح للمزامنة.");
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const query = new URLSearchParams({ ...params, limit: "1000", offset: String(offset) });
    const response = await fetch(`${SOURCE_URL}/${table}?${query}`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`فشلت قراءة ${table} من Supabase: ${response.status}`);
    const batch = await response.json() as T[];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

export async function syncSupabaseExamLevel(levelKey: string, options: SupabaseExamSyncOptions = {}): Promise<SupabaseExamSyncResult> {
  const level = TELEGRAM_EXAM_CATALOG.find(item => item.key === levelKey && !item.comingSoon);
  if (!level) throw new Error("المستوى المطلوب غير صالح للمزامنة.");
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة بيانات البوت.");

  const [sourceLevels, sourceSubjects] = await Promise.all([
    sourceSelectAll<SourceLevel>("levels", { select: "id,order_index" }),
    sourceSelectAll<SourceSubject>("subjects", { select: "id,level_id,order_index" }),
  ]);
  const sourceLevel = sourceLevels.find(item => LEVEL_KEY_BY_ORDER[Number(item.order_index)] === levelKey);
  if (!sourceLevel) throw new Error("تعذر العثور على المستوى في Supabase.");

  let subjectCount = 0;
  let formCount = 0;
  let questionCount = 0;
  let excludedQuestions = 0;
  const levelSubjects = sourceSubjects.filter(item => item.level_id === sourceLevel.id).sort((left, right) => Number(left.order_index) - Number(right.order_index));

  for (const sourceSubject of levelSubjects) {
    const catalogSubject = level.subjects[Number(sourceSubject.order_index) - 1];
    if (!catalogSubject) continue;
    const subjectKey = getImportedExamSubjectKey(levelKey, catalogSubject.key);
    if (!subjectKey) continue;
    const [sourceForms, sourceQuestions] = await Promise.all([
      sourceSelectAll<SourceForm>("subject_exam_forms", {
        select: "form_id,form_name,order_index,hidden",
        subject_id: `eq.${sourceSubject.id}`,
        order: "order_index.asc,form_name.asc",
      }),
      sourceSelectAll<SourceQuestion>("questions", {
        select: "id,question_text,option_a,option_b,option_c,option_d,correct_option,hint,explanation,exam_year,exam_form,status,created_at",
        subject_id: `eq.${sourceSubject.id}`,
        status: "eq.active",
        order: "exam_year.asc,created_at.asc,id.asc",
      }),
    ]);
    const sourceFormByKey = new Map(sourceForms.filter(item => !item.hidden).map(item => [item.form_id, item]));
    const formsByKey = new Map<string, { formKey: string; formName: string; sortOrder: number }>();
    const questionsByForm = new Map<string, SourceQuestion[]>();

    for (const sourceForm of Array.from(sourceFormByKey.values())) {
      const normalized = normalizedForm({ formKey: sourceForm.form_id, sourceName: sourceForm.form_name, sourceOrder: Number(sourceForm.order_index) });
      if (!isExcludedExamYear(levelKey, Number(normalized.formName.match(/20\d{2}/)?.[0]))) formsByKey.set(normalized.formKey, normalized);
    }
    let subjectExcludedQuestions = 0;
    for (const question of sourceQuestions) {
      if (!["A", "B", "C", "D"].includes(question.correct_option ?? "")) continue;
      if (isExcludedExamYear(levelKey, Number(question.exam_year))) {
        excludedQuestions += 1;
        subjectExcludedQuestions += 1;
        continue;
      }
      const sourceFormKey = question.exam_form?.trim() || "unclassified";
      const sourceForm = sourceFormByKey.get(sourceFormKey);
      const normalized = normalizedForm({
        formKey: sourceFormKey,
        sourceName: sourceForm?.form_name ?? (sourceFormKey === "unclassified" ? "أسئلة عامة" : undefined),
        sourceOrder: sourceForm?.order_index,
        year: Number(question.exam_year) || null,
      });
      formsByKey.set(normalized.formKey, normalized);
      const questions = questionsByForm.get(normalized.formKey) ?? [];
      questions.push(question);
      questionsByForm.set(normalized.formKey, questions);
    }

    await db.update(telegramExamForms).set({ isActive: false }).where(eq(telegramExamForms.subjectKey, subjectKey));
    await db.update(telegramExamQuestions).set({ isActive: false }).where(eq(telegramExamQuestions.subjectKey, subjectKey));
    const forms = Array.from(formsByKey.values());
    for (let start = 0; start < forms.length; start += 100) {
      const batch = forms.slice(start, start + 100).map(form => ({ ...form, subjectKey, isActive: true }));
      if (!batch.length) continue;
      await db.insert(telegramExamForms).values(batch).onDuplicateKeyUpdate({
        set: { formName: sql`VALUES(${telegramExamForms.formName})`, sortOrder: sql`VALUES(${telegramExamForms.sortOrder})`, isActive: true },
      });
    }
    for (const [formKey, questions] of Array.from(questionsByForm.entries())) {
      for (let start = 0; start < questions.length; start += 100) {
        const batch = questions.slice(start, start + 100).map((question: SourceQuestion, index: number) => ({
          sourceQuestionId: question.id,
          subjectKey,
          sectionKey: formKey,
          questionText: question.question_text ?? "",
          optionA: question.option_a ?? "",
          optionB: question.option_b ?? "",
          optionC: question.option_c ?? "",
          optionD: question.option_d ?? "",
          correctOption: question.correct_option as "A" | "B" | "C" | "D",
          hint: question.hint ?? null,
          explanation: question.explanation ?? "",
          sortOrder: start + index + 1,
          isActive: true,
        }));
        if (!batch.length) continue;
        await db.insert(telegramExamQuestions).values(batch).onDuplicateKeyUpdate({
          set: {
            subjectKey: sql`VALUES(${telegramExamQuestions.subjectKey})`, sectionKey: sql`VALUES(${telegramExamQuestions.sectionKey})`,
            questionText: sql`VALUES(${telegramExamQuestions.questionText})`, optionA: sql`VALUES(${telegramExamQuestions.optionA})`,
            optionB: sql`VALUES(${telegramExamQuestions.optionB})`, optionC: sql`VALUES(${telegramExamQuestions.optionC})`,
            optionD: sql`VALUES(${telegramExamQuestions.optionD})`, correctOption: sql`VALUES(${telegramExamQuestions.correctOption})`,
            hint: sql`VALUES(${telegramExamQuestions.hint})`, explanation: sql`VALUES(${telegramExamQuestions.explanation})`,
            sortOrder: sql`VALUES(${telegramExamQuestions.sortOrder})`, isActive: true,
          },
        });
      }
    }
    subjectCount += 1;
    formCount += forms.length;
    const subjectQuestionCount = Array.from(questionsByForm.values()).reduce((sum, questions) => sum + questions.length, 0);
    questionCount += subjectQuestionCount;
    await options.onSubjectComplete?.({
      levelKey,
      subjectKey,
      subjectName: catalogSubject.name,
      forms: forms.length,
      questions: subjectQuestionCount,
      excludedQuestions: subjectExcludedQuestions,
    });
  }
  return { levelKey, subjects: subjectCount, forms: formCount, questions: questionCount, excludedQuestions };
}
