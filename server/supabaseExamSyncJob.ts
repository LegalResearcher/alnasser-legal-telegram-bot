import type { Express } from "express";
import { getTelegramScheduledTaskByUid } from "./db";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { syncSupabaseExamLevel, type SupabaseExamSyncOptions, type SupabaseExamSyncSubjectResult } from "./supabaseExamSync";

export const SUPABASE_EXAM_SYNC_TASK_KEYS = {
  l1: "supabase-exam-sync-l1",
  l2: "supabase-exam-sync-l2",
  l3: "supabase-exam-sync-l3",
  l4: "supabase-exam-sync-l4",
} as const;

export function levelKeyForSupabaseSyncTask(taskKey: string): "l1" | "l2" | "l3" | "l4" | undefined {
  return (Object.entries(SUPABASE_EXAM_SYNC_TASK_KEYS).find(([, value]) => value === taskKey)?.[0] as "l1" | "l2" | "l3" | "l4" | undefined);
}

const levelLabels = { l1: "المستوى الأول", l2: "المستوى الثاني", l3: "المستوى الثالث", l4: "المستوى الرابع" } as const;
type SyncLevelKey = keyof typeof levelLabels;
type OwnerNotifier = (payload: { title: string; content: string }) => Promise<boolean>;

export function buildSupabaseExamSyncFailureNotice(levelKey: SyncLevelKey, failedAt = new Date()) {
  return {
    title: "فشل مزامنة اختبارات Supabase",
    content: [
      `المستوى المتأثر: ${levelLabels[levelKey]}`,
      `وقت الفشل: ${failedAt.toLocaleString("ar-YE", { timeZone: "Asia/Aden" })}`,
      "تعذر إكمال مهمة المزامنة الخلفية. لم تُرسل أي رسائل أو محتوى للمستخدمين.",
      "راجع سجل المهمة من إعدادات المشروع ثم أعد تشغيلها عند الحاجة.",
    ].join("\n"),
  };
}

export function buildSupabaseExamSyncSuccessNotice(result: SupabaseExamSyncSubjectResult) {
  return {
    title: "اكتمل استيراد مادة من Supabase",
    content: [
      `المستوى: ${levelLabels[result.levelKey as SyncLevelKey]}`,
      `المادة: ${result.subjectName}`,
      `النماذج المتزامنة: ${result.forms}`,
      `الأسئلة المتزامنة: ${result.questions}`,
      result.excludedQuestions > 0 ? `أسئلة مستثناة حسب سياسة الأعوام: ${result.excludedQuestions}` : "لم تُستثنَ أسئلة في هذه المادة.",
      "تم الحفظ في قاعدة البوت فقط، دون إرسال محتوى للمستخدمين.",
    ].join("\n"),
  };
}

export async function runSupabaseExamSync(
  levelKey: SyncLevelKey,
  dependencies: { sync?: (levelKey: string, options?: SupabaseExamSyncOptions) => ReturnType<typeof syncSupabaseExamLevel>; notify?: OwnerNotifier } = {}
) {
  const sync = dependencies.sync ?? syncSupabaseExamLevel;
  const notify = dependencies.notify ?? notifyOwner;
  try {
    return await sync(levelKey, {
      onSubjectComplete: async result => {
        try {
          await notify(buildSupabaseExamSyncSuccessNotice(result));
        } catch {
          // فشل الإشعار لا يوقف استيراد المادة التالية ولا يرسل إلى أي مستخدم.
        }
      },
    });
  } catch (error) {
    try {
      await notify(buildSupabaseExamSyncFailureNotice(levelKey));
    } catch {
      // يبقى فشل الإشعار معزولًا عن فشل المزامنة ولا يرسل إلى أي مستخدم.
    }
    throw error;
  }
}

export function registerSupabaseExamSyncJob(app: Express) {
  app.post("/api/scheduled/supabase-exam-sync", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        res.status(403).json({ error: "cron-only" });
        return;
      }
      const task = await getTelegramScheduledTaskByUid(user.taskUid);
      if (!task) {
        res.json({ ok: true, skipped: "orphan" });
        return;
      }
      const levelKey = levelKeyForSupabaseSyncTask(task.taskKey);
      if (!levelKey) {
        res.status(403).json({ error: "unexpected-task" });
        return;
      }
      const result = await runSupabaseExamSync(levelKey);
      res.json({ ok: true, ...result, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("[Supabase exam sync] failed:", message);
      res.status(500).json({ error: message, timestamp: new Date().toISOString() });
    }
  });
}
