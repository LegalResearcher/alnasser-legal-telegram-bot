import type { Express } from "express";
import { claimImportantYemeniLawsSubscriptionReminder, getTelegramScheduledTaskByUid, listDueImportantYemeniLawsSubscriptionReminders, type PendingImportantYemeniLawsReminder } from "./db";
import { createTelegramSender, type TelegramSender } from "./telegram";
import { sdk } from "./_core/sdk";

export const DAILY_IMPORTANT_LAWS_REMINDER_TASK_KEY = "daily-important-laws-reminders";

type ReminderDependencies = {
  listDue: (now: Date) => Promise<PendingImportantYemeniLawsReminder[]>;
  claim: (requestId: number, now: Date) => Promise<boolean>;
  sender: TelegramSender;
};

function paymentMethodLabel(paymentMethod: string | null) {
  if (paymentMethod === "karimi") return "كريمي";
  if (paymentMethod === "jeeb") return "محفظة جيب";
  return "غير محددة";
}

function subscriberDisplayName(request: PendingImportantYemeniLawsReminder) {
  const name = [request.telegramFirstName, request.telegramLastName].filter(Boolean).join(" ").trim();
  return name || request.telegramUsername ? (name || `@${request.telegramUsername}`) : "غير متاح";
}

export async function sendDailyImportantLawsSubscriptionReminders(
  ownerChatId: number,
  dependencies: ReminderDependencies,
  now = new Date()
): Promise<{ sent: number; skipped: number; failed: number }> {
  const dueRequests = await dependencies.listDue(now);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const request of dueRequests) {
    if (!(await dependencies.claim(request.id, now))) {
      skipped += 1;
      continue;
    }
    try {
      await dependencies.sender.sendMessage(
        ownerChatId,
        [
          "⏰ تذكير بطلب اشتراك معلق",
          `رقم الطلب: #${request.id}`,
          `معرّف تيليغرام: ${request.telegramUserId}`,
          `الاسم الظاهر: ${subscriberDisplayName(request)}`,
          `اسم المستخدم: ${request.telegramUsername ? `@${request.telegramUsername}` : "غير متاح"}`,
          `طريقة التحويل: ${paymentMethodLabel(request.paymentMethod)}`,
          "مرّ على الطلب أكثر من 24 ساعة ولم يُعتمد أو يُرفض بعد.",
        ].join("\n")
      );
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, skipped, failed };
}

export function registerTelegramSubscriptionReminder(app: Express) {
  app.post("/api/scheduled/important-laws-reminders", async (req, res) => {
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
      if (task.taskKey !== DAILY_IMPORTANT_LAWS_REMINDER_TASK_KEY) {
        res.status(403).json({ error: "unexpected-task" });
        return;
      }
      const ownerChatId = Number(process.env.TELEGRAM_OWNER_ID ?? "");
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!Number.isSafeInteger(ownerChatId) || !token) {
        res.status(500).json({ error: "telegram-owner-or-token-unavailable" });
        return;
      }
      const result = await sendDailyImportantLawsSubscriptionReminders(ownerChatId, {
        listDue: now => listDueImportantYemeniLawsSubscriptionReminders(now),
        claim: (requestId, now) => claimImportantYemeniLawsSubscriptionReminder(requestId, now),
        sender: createTelegramSender(token),
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("[Telegram] Daily subscription reminder failed:", message);
      res.status(500).json({ error: message, timestamp: new Date().toISOString() });
    }
  });
}
