import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { telegramExamForms, telegramExamQuestions } from "/home/ubuntu/moieen-legal-bot/drizzle/schema.ts";
import { getDb } from "/home/ubuntu/moieen-legal-bot/server/db.ts";

const [sourceSubjectId, subjectKey] = process.argv.slice(2);
const SOURCE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co/rest/v1";
const keyResultPath = "/home/ubuntu/.mcp/tool-results/2026-08-19_00-46-35.679607970_supabase_get_publishable_keys_f530412f.json";

if (!sourceSubjectId || !subjectKey) {
  throw new Error("يلزم تمرير معرّف المادة المصدرية ومفتاح المادة المحلي.");
}

function isExcludedForm(formName, formKey) {
  const earlyLevel = /^(l1|l2|l3)_/.test(subjectKey);
  return earlyLevel && /(?:^|\D)(2020|2021)(?:\D|$)/.test(`${formName} ${formKey}`);
}

const supplementalFormsBySubject = {
  l1_criminology: [
    ["Model_1", "القسم الأول", 1], ["Model_2", "القسم الثاني", 2], ["Model_3", "القسم الثالث", 3],
    ["Model_4", "القسم الرابع", 4], ["Model_5", "القسم الخامس", 5], ["Model_6", "القسم السادس", 6],
    ["Model_7", "القسم السابع", 7], ["Model_8", "القسم الثامن", 8], ["Model_9", "القسم التاسع", 9],
    ["Model_10", "القسم العاشر", 10], ["Model_11", "القسم الحادي عشر", 11], ["Model_12", "القسم الثاني عشر", 12],
    ["Model_13", "القسم الثالث عشر", 13], ["Model_14", "القسم الرابع عشر", 14], ["Model_15", "القسم الخامس عشر", 15],
  ].map(([form_id, form_name, order_index]) => ({ form_id, form_name, order_index, hidden: false })),
};

async function getApiKey() {
  const source = JSON.parse(await readFile(keyResultPath, "utf8"));
  const apiKey = source.keys.find((entry) => entry.id === "anon")?.api_key;
  if (!apiKey) throw new Error("تعذر العثور على مفتاح قراءة منصة الناصر.");
  return apiKey;
}

async function sourceSelectAll(table, params) {
  const apiKey = await getApiKey();
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const query = new URLSearchParams({ ...params, limit: "1000", offset: String(offset) });
    let response;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await fetch(`${SOURCE_URL}/${table}?${query}`, {
          headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(30_000),
        });
        break;
      } catch (error) {
        if (attempt === 3) throw new Error(`تعذر الاتصال بجدول ${table} بعد ثلاث محاولات: ${String(error)}`);
      }
    }
    if (!response) throw new Error(`تعذر إنشاء طلب القراءة من ${table}.`);
    if (!response.ok) throw new Error(`فشلت قراءة ${table}: ${response.status}`);
    const batch = await response.json();
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

const db = await getDb();
if (!db) throw new Error("تعذر الاتصال بقاعدة بيانات البوت.");

const sourceForms = await sourceSelectAll("subject_exam_forms", {
  select: "form_id,form_name,order_index,hidden",
  subject_id: `eq.${sourceSubjectId}`,
  hidden: "eq.false",
  order: "order_index.asc,form_name.asc",
});
const supplementalForms = supplementalFormsBySubject[subjectKey] ?? [];
const formByKey = new Map(sourceForms.map(form => [form.form_id, form]));
for (const form of supplementalForms) formByKey.set(form.form_id, form);
const forms = [...formByKey.values()]
  .filter((form) => !isExcludedForm(form.form_name, form.form_id))
  .sort((left, right) => left.order_index - right.order_index || left.form_name.localeCompare(right.form_name, "ar"));
const imported = [];

for (const form of forms) {
  console.error(`استيراد النموذج: ${form.form_name}`);
  const questions = await sourceSelectAll("questions", {
    select: "id,question_text,option_a,option_b,option_c,option_d,correct_option,hint,explanation,created_at",
    subject_id: `eq.${sourceSubjectId}`,
    exam_form: `eq.${form.form_id}`,
    status: "eq.active",
    order: "created_at.asc,id.asc",
  });
  const normalizedQuestions = questions
    .filter((question) => ["A", "B", "C", "D"].includes(question.correct_option))
    .map((question, index) => ({
      sourceQuestionId: question.id,
      subjectKey,
      sectionKey: form.form_id,
      questionText: question.question_text ?? "",
      optionA: question.option_a ?? "",
      optionB: question.option_b ?? "",
      optionC: question.option_c ?? "",
      optionD: question.option_d ?? "",
      correctOption: question.correct_option,
      hint: question.hint ?? null,
      explanation: question.explanation ?? "",
      sortOrder: index + 1,
      isActive: true,
    }));

  await db.insert(telegramExamForms).values({
    subjectKey,
    formKey: form.form_id,
    formName: form.form_name,
    sortOrder: form.order_index,
    isActive: true,
  }).onDuplicateKeyUpdate({
    set: {
      formName: sql`VALUES(${telegramExamForms.formName})`,
      sortOrder: sql`VALUES(${telegramExamForms.sortOrder})`,
      isActive: true,
    },
  });

  for (let start = 0; start < normalizedQuestions.length; start += 100) {
    const batch = normalizedQuestions.slice(start, start + 100);
    if (!batch.length) continue;
    await db.insert(telegramExamQuestions).values(batch).onDuplicateKeyUpdate({
      set: {
        subjectKey: sql`VALUES(${telegramExamQuestions.subjectKey})`,
        sectionKey: sql`VALUES(${telegramExamQuestions.sectionKey})`,
        questionText: sql`VALUES(${telegramExamQuestions.questionText})`,
        optionA: sql`VALUES(${telegramExamQuestions.optionA})`,
        optionB: sql`VALUES(${telegramExamQuestions.optionB})`,
        optionC: sql`VALUES(${telegramExamQuestions.optionC})`,
        optionD: sql`VALUES(${telegramExamQuestions.optionD})`,
        correctOption: sql`VALUES(${telegramExamQuestions.correctOption})`,
        hint: sql`VALUES(${telegramExamQuestions.hint})`,
        explanation: sql`VALUES(${telegramExamQuestions.explanation})`,
        sortOrder: sql`VALUES(${telegramExamQuestions.sortOrder})`,
        isActive: true,
      },
    });
  }
  imported.push({ formKey: form.form_id, formName: form.form_name, questions: normalizedQuestions.length });
  console.error(`اكتمل النموذج: ${form.form_name} (${normalizedQuestions.length} سؤالًا)`);
}

console.log(JSON.stringify({ subjectKey, forms: imported, totalQuestions: imported.reduce((sum, form) => sum + form.questions, 0) }));
process.exit(0);
