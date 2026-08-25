import { describe, expect, it, vi } from "vitest";
import { isExcludedExamYear, levelKeyForSupabaseLevelOrder, normalizedForm } from "./supabaseExamSync";
import { buildSupabaseExamSyncFailureNotice, buildSupabaseExamSyncSuccessNotice, runSupabaseExamSync, SUPABASE_EXAM_SYNC_TASK_KEYS, levelKeyForSupabaseSyncTask } from "./supabaseExamSyncJob";

describe("Supabase exam synchronization policy", () => {
  it("يستثني 2020 و2021 للمستويات الثلاثة الأولى فقط", () => {
    for (const levelKey of ["l1", "l2", "l3"]) {
      expect(isExcludedExamYear(levelKey, 2020)).toBe(true);
      expect(isExcludedExamYear(levelKey, 2021)).toBe(true);
      expect(isExcludedExamYear(levelKey, 2022)).toBe(false);
    }
    expect(isExcludedExamYear("l4", 2020)).toBe(false);
    expect(isExcludedExamYear("l4", 2021)).toBe(false);
  });

  it("يربط ترتيب المستوى في Supabase بالقسم الصحيح، بما فيه الأدبي والعلمي", () => {
    expect(levelKeyForSupabaseLevelOrder(1)).toBe("l1");
    expect(levelKeyForSupabaseLevelOrder(4)).toBe("l4");
    expect(levelKeyForSupabaseLevelOrder(6)).toBe("secondary-literary");
    expect(levelKeyForSupabaseLevelOrder(7)).toBe("secondary-scientific");
    expect(levelKeyForSupabaseLevelOrder(5)).toBeUndefined();
  });

  it("يحافظ على formKey العلمي ويعرضه كنموذج 2026 سنوي", () => {
    expect(normalizedForm({
      formKey: "P.05-01",
      sourceName: "النموذج الأول",
      sourceOrder: 1,
      year: 2026,
      treatAsAnnual: true,
    })).toEqual({ formKey: "P.05-01", formName: "2026 النموذج الأول", sortOrder: 2026001 });
  });

  it("يربط كل مهمة دورية بالمستوى الصحيح فقط", () => {
    expect(levelKeyForSupabaseSyncTask(SUPABASE_EXAM_SYNC_TASK_KEYS.l1)).toBe("l1");
    expect(levelKeyForSupabaseSyncTask(SUPABASE_EXAM_SYNC_TASK_KEYS.l4)).toBe("l4");
    expect(levelKeyForSupabaseSyncTask("unknown-task")).toBeUndefined();
  });

  it("ينفذ dry-run للقسم العلمي ويحسب المواد دون الكتابة إلى قاعدة البوت", async () => {
    vi.stubEnv("SUPABASE_ANON_KEY", "test-read-key");
    const subjectNames = ["القرآن الكريم", "التربية الإسلامية", "اللغة العربية", "اللغة الإنجليزية", "الأحياء", "الفيزياء", "الكيمياء"];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/levels?")) return new Response(JSON.stringify([{ id: "level-7", order_index: 7 }]));
      if (url.includes("/subjects?")) return new Response(JSON.stringify(subjectNames.map((name, index) => ({ id: `subject-${index + 1}`, level_id: "level-7", name, order_index: index + 1 }))));
      if (url.includes("/subject_exam_forms?")) return new Response("[]");
      if (url.includes("/questions?")) return new Response("[]");
      throw new Error(`Unexpected URL: ${url}`);
    }));
    const { syncSupabaseExamLevel } = await import("./supabaseExamSync");
    const completedSubjects: string[] = [];
    const result = await syncSupabaseExamLevel("secondary-scientific", {
      dryRun: true,
      onSubjectComplete: subject => completedSubjects.push(subject.subjectName),
    });
    expect(result).toEqual({ levelKey: "secondary-scientific", subjects: 7, forms: 0, questions: 0, excludedQuestions: 0 });
    expect(completedSubjects).toEqual(subjectNames);
    expect(vi.mocked(fetch)).toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ينقل أسئلة النماذج التدريبية إلى مفتاح النموذج نفسه", async () => {
    vi.stubEnv("SUPABASE_ANON_KEY", "test-read-key");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/levels?")) return new Response(JSON.stringify([{ id: "level-1", order_index: 1 }]));
      if (url.includes("/subjects?")) return new Response(JSON.stringify([{ id: "subject-usul", level_id: "level-1", name: "اصول الفقه", order_index: 1 }]));
      if (url.includes("/subject_exam_forms?")) return new Response(JSON.stringify([{ form_id: "Model_1", form_name: "الموازي2025", order_index: 1, hidden: false }]));
      if (url.includes("/questions?")) return new Response(JSON.stringify([{
        id: "question-model-1",
        question_text: "سؤال تجريبي",
        option_a: "أ",
        option_b: "ب",
        option_c: "ج",
        option_d: "د",
        correct_option: "A",
        hint: null,
        explanation: "شرح",
        exam_year: null,
        exam_form: "Model_1",
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
      }]));
      throw new Error(`Unexpected URL: ${url}`);
    }));
    const { syncSupabaseExamLevel } = await import("./supabaseExamSync");
    const result = await syncSupabaseExamLevel("l1", { dryRun: true });
    expect(result).toEqual({ levelKey: "l1", subjects: 1, forms: 1, questions: 1, excludedQuestions: 0 });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ينبه المالك فقط عند الفشل دون نسخ نص الخطأ أو أي بيانات حساسة", async () => {
    const notices: Array<{ title: string; content: string }> = [];
    await expect(runSupabaseExamSync("l2", {
      sync: async () => { throw new Error("SUPABASE_ANON_KEY=سري"); },
      notify: async notice => { notices.push(notice); return true; },
    })).rejects.toThrow("SUPABASE_ANON_KEY=سري");

    expect(notices).toHaveLength(1);
    expect(notices[0]?.title).toContain("فشل مزامنة اختبارات Supabase");
    expect(notices[0]?.content).toContain("المستوى الثاني");
    expect(notices[0]?.content).not.toContain("SUPABASE_ANON_KEY");
    expect(buildSupabaseExamSyncFailureNotice("l4", new Date("2026-08-19T00:00:00.000Z")).content).toContain("المستوى الرابع");
  });

  it("ينبه المالك عند اكتمال كل مادة ويعرض اسمها وأعدادها فقط", async () => {
    const notices: Array<{ title: string; content: string }> = [];
    await runSupabaseExamSync("l1", {
      sync: async (_levelKey, options) => {
        await options?.onSubjectComplete?.({ levelKey: "l1", subjectKey: "l1_usul_fiqh", subjectName: "اصول الفقه", forms: 21, questions: 576, excludedQuestions: 5 });
        return { levelKey: "l1", subjects: 1, forms: 21, questions: 576, excludedQuestions: 5 };
      },
      notify: async notice => { notices.push(notice); return true; },
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]?.title).toContain("اكتمل استيراد مادة");
    expect(notices[0]?.content).toContain("اصول الفقه");
    expect(notices[0]?.content).toContain("النماذج المتزامنة: 21");
    expect(notices[0]?.content).toContain("الأسئلة المتزامنة: 576");
    expect(buildSupabaseExamSyncSuccessNotice({ levelKey: "l4", subjectKey: "civil_law", subjectName: "القانون المدني", forms: 11, questions: 610, excludedQuestions: 0 }).content).toContain("المستوى الرابع");
  });
});
