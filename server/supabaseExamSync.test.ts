import { describe, expect, it } from "vitest";
import { isExcludedExamYear } from "./supabaseExamSync";
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

  it("يربط كل مهمة دورية بالمستوى الصحيح فقط", () => {
    expect(levelKeyForSupabaseSyncTask(SUPABASE_EXAM_SYNC_TASK_KEYS.l1)).toBe("l1");
    expect(levelKeyForSupabaseSyncTask(SUPABASE_EXAM_SYNC_TASK_KEYS.l4)).toBe("l4");
    expect(levelKeyForSupabaseSyncTask("unknown-task")).toBeUndefined();
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
