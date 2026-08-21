import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { telegramExamForms } from "../drizzle/schema.ts";
import { getDb } from "../server/db.ts";
import { TELEGRAM_EXAM_CATALOG } from "../server/telegramExam.ts";

const SOURCE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co/rest/v1";
const keyResultPath = "/home/ubuntu/.mcp/tool-results/2026-08-19_00-46-35.679607970_supabase_get_publishable_keys_f530412f.json";
const levelKeyByOrder = { 1: "l1", 2: "l2", 3: "l3", 4: "l4" };
const configuredSubjectKeys = {
  "l1:l1-usul": "l1_usul_fiqh",
  "l1:l1-criminology": "l1_criminology",
};
const annualType = {
  General: { key: "general", name: "العام", priority: 1 },
  Parallel: { key: "parallel", name: "الموازي", priority: 2 },
  Mixed: { key: "mixed", name: "المختلط", priority: 3 },
};
const arabicOrdinals = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون"];

function isExcluded(formName, formKey) {
  return /(?:^|\D)(2020|2021)(?:\D|$)/.test(`${formName} ${formKey}`);
}

function displayTrainingForm(formKey) {
  const modelNumber = Number(formKey.match(/^Model_(\d+)$/i)?.[1] ?? 0);
  return modelNumber > 0 ? `القسم ${arabicOrdinals[modelNumber] ?? `رقم ${modelNumber}`}` : formKey;
}

async function getApiKey() {
  const source = JSON.parse(await readFile(keyResultPath, "utf8"));
  const apiKey = source.keys.find(entry => entry.id === "anon")?.api_key;
  if (!apiKey) throw new Error("تعذر العثور على مفتاح القراءة الخاص بـ Supabase.");
  return apiKey;
}

async function sourceSelectAll(table, params) {
  const apiKey = await getApiKey();
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const query = new URLSearchParams({ ...params, limit: "1000", offset: String(offset) });
    const response = await fetch(`${SOURCE_URL}/${table}?${query}`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`فشلت قراءة ${table}: ${response.status}`);
    const batch = await response.json();
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

const db = await getDb();
if (!db) throw new Error("تعذر الاتصال بقاعدة بيانات البوت.");

const [levels, subjects] = await Promise.all([
  sourceSelectAll("levels", { select: "id,order_index" }),
  sourceSelectAll("subjects", { select: "id,level_id,order_index" }),
]);
const levelOrderById = new Map(levels.map(level => [level.id, Number(level.order_index)]));
const synchronized = [];

for (const sourceSubject of subjects.sort((left, right) => Number(left.order_index) - Number(right.order_index))) {
  const levelKey = levelKeyByOrder[levelOrderById.get(sourceSubject.level_id)];
  if (!levelKey) continue;
  const catalogLevel = TELEGRAM_EXAM_CATALOG.find(level => level.key === levelKey);
  const catalogSubject = catalogLevel?.subjects[Number(sourceSubject.order_index) - 1];
  if (!catalogSubject) continue;
  if (levelKey === "l4" && catalogSubject.key === "l4-civil-law") continue;
  const subjectKey = configuredSubjectKeys[`${levelKey}:${catalogSubject.key}`] ?? `exam_${levelKey}_${catalogSubject.key.replace(/[^a-z0-9]+/gi, "_")}`;
  const [sourceForms, questionRows] = await Promise.all([
    sourceSelectAll("subject_exam_forms", {
      select: "form_id,form_name,order_index,hidden",
      subject_id: `eq.${sourceSubject.id}`,
      order: "order_index.asc,form_name.asc",
    }),
    sourceSelectAll("questions", {
      select: "exam_form,exam_year,status",
      subject_id: `eq.${sourceSubject.id}`,
      status: "eq.active",
    }),
  ]);

  const formsByKey = new Map();
  for (const form of sourceForms) {
    if (!form.hidden && !isExcluded(form.form_name, form.form_id)) {
      formsByKey.set(form.form_id, { formKey: form.form_id, formName: form.form_name, sortOrder: Number(form.order_index) + 1000 });
    }
  }
  for (const question of questionRows) {
    const sourceForm = String(question.exam_form ?? "").trim();
    if (!sourceForm) continue;
    const year = Number(question.exam_year ?? 0);
    const yearly = annualType[sourceForm];
    if (yearly && year > 0) {
      if (isExcluded(String(year), sourceForm)) continue;
      formsByKey.set(`${yearly.key}_${year}`, {
        formKey: `${yearly.key}_${year}`,
        formName: `${yearly.name} ${year}`,
        sortOrder: year * 10 + yearly.priority,
      });
      continue;
    }
    formsByKey.set(sourceForm, {
      formKey: sourceForm,
      formName: displayTrainingForm(sourceForm),
      sortOrder: 1000 + (Number(sourceForm.match(/^Model_(\d+)$/i)?.[1] ?? 900) || 900),
    });
  }

  const forms = [...formsByKey.values()];
  for (let start = 0; start < forms.length; start += 100) {
    const batch = forms.slice(start, start + 100).map(form => ({ ...form, subjectKey, isActive: true }));
    if (!batch.length) continue;
    await db.insert(telegramExamForms).values(batch).onDuplicateKeyUpdate({
      set: {
        formName: sql`VALUES(${telegramExamForms.formName})`,
        sortOrder: sql`VALUES(${telegramExamForms.sortOrder})`,
        isActive: true,
      },
    });
  }
  synchronized.push({ levelKey, catalogSubjectKey: catalogSubject.key, subjectKey, forms: forms.length });
  console.error(`فُهرست ${forms.length} نموذجًا: ${catalogLevel.name} ← ${catalogSubject.name}`);
}

console.log(JSON.stringify({ synchronizedSubjects: synchronized.length, synchronizedForms: synchronized.reduce((sum, subject) => sum + subject.forms, 0), subjects: synchronized }));
process.exit(0);
