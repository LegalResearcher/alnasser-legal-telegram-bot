import { describe, expect, it } from "vitest";
import type { PendingImportantYemeniLawsReminder } from "./db";
import type { TelegramSender } from "./telegram";
import { sendDailyImportantLawsSubscriptionReminders } from "./telegramSubscriptionReminder";

function reminderRequest(id: number, paymentMethod: string | null): PendingImportantYemeniLawsReminder {
  return {
    id,
    telegramUserId: String(700000000 + id),
    chatId: String(700000000 + id),
    telegramUsername: id === 1 ? "legal_student" : null,
    telegramFirstName: id === 1 ? "أحمد" : null,
    telegramLastName: id === 1 ? "القانوني" : null,
    paymentMethod,
    createdAt: new Date("2026-08-16T09:00:00.000Z"),
  };
}

describe("daily important laws subscription reminders", () => {
  it("يرسل تذكيرًا واحدًا للطلبات المطالبة ويمنع إعادة الطلب المحجوز", async () => {
    const messages: Array<{ chatId: number; text: string }> = [];
    const sender: TelegramSender = {
      sendMessage: async (chatId, text) => { messages.push({ chatId, text }); },
      sendDocument: async () => undefined,
      sendDocumentByFileId: async () => undefined,
      sendPhotoByFileId: async () => undefined,
      answerCallbackQuery: async () => undefined,
    };
    const claimed: number[] = [];
    const result = await sendDailyImportantLawsSubscriptionReminders(85820797, {
      listDue: async () => [reminderRequest(1, "karimi"), reminderRequest(2, "jeeb")],
      claim: async requestId => {
        claimed.push(requestId);
        return requestId === 1;
      },
      sender,
    }, new Date("2026-08-19T10:00:00.000Z"));

    expect(result).toEqual({ sent: 1, skipped: 1, failed: 0 });
    expect(claimed).toEqual([1, 2]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ chatId: 85820797 });
    expect(messages[0]?.text).toContain("تذكير بطلب اشتراك معلق");
    expect(messages[0]?.text).toContain("رقم الطلب: #1");
    expect(messages[0]?.text).toContain("طريقة التحويل: كريمي");
  });
});
