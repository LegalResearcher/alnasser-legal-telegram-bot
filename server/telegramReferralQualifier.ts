import type { Express } from "express";
import { getTelegramScheduledTaskByUid, qualifyDueTelegramReferrals, type TelegramReferralQualificationEvent } from "./db";
import { createTelegramSender, type TelegramSender } from "./telegram";
import { sdk } from "./_core/sdk";

export const DAILY_TELEGRAM_REFERRAL_QUALIFIER_TASK_KEY = "daily-telegram-referral-qualification";

export async function runTelegramReferralQualification(
  dependencies: { qualifyDue: () => Promise<{ qualified: number; events: TelegramReferralQualificationEvent[] }>; sender: TelegramSender }
): Promise<{ qualified: number; notificationsSent: number; notificationFailures: number }> {
  const result = await dependencies.qualifyDue();
  let notificationsSent = 0;
  let notificationFailures = 0;
  for (const event of result.events) {
    const chatId = Number(event.referrerChatId);
    if (!Number.isSafeInteger(chatId)) {
      notificationFailures += 1;
      continue;
    }
    try {
      const reward = event.rewardExpiresAt ? `\n\n🎉 اكتملت خمس إحالات مؤهلة. فُعّل لك وصول مجاني لمدة شهر إلى الأقسام المميزة حتى ${event.rewardExpiresAt.toLocaleDateString("ar-YE", { year: "numeric", month: "long", day: "numeric" })}.` : "";
      await dependencies.sender.sendMessage(chatId, `✅ تم احتساب إحالة جديدة بنجاح.\n📊 إحالاتك المحتسبة: ${event.qualifiedCount} | المتبقي للمكافأة التالية: ${event.remainingCount}.${reward}`);
      notificationsSent += 1;
    } catch {
      notificationFailures += 1;
    }
  }
  return { qualified: result.qualified, notificationsSent, notificationFailures };
}

export function registerTelegramReferralQualifier(app: Express) {
  app.post("/api/scheduled/telegram-referral-qualification", async (req, res) => {
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
      if (task.taskKey !== DAILY_TELEGRAM_REFERRAL_QUALIFIER_TASK_KEY) {
        res.status(403).json({ error: "unexpected-task" });
        return;
      }
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        res.status(500).json({ error: "telegram-token-unavailable" });
        return;
      }
      res.json({ ok: true, ...(await runTelegramReferralQualification({ qualifyDue: () => qualifyDueTelegramReferrals(), sender: createTelegramSender(token) })) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("[Telegram] Referral qualification failed:", message);
      res.status(500).json({ error: message, timestamp: new Date().toISOString() });
    }
  });
}
