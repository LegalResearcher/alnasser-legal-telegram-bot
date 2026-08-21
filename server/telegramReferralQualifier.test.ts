import { describe, expect, it, vi } from "vitest";
import { runTelegramReferralQualification } from "./telegramReferralQualifier";

describe("Telegram referral qualification", () => {
  it("يؤهل الإحالات المستحقة ويبلغ صاحب مكافأة الإحالة مرة واحدة", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const result = await runTelegramReferralQualification({
      qualifyDue: async () => ({ qualified: 2, events: [{ referrerChatId: "85820797", qualifiedCount: 3, remainingCount: 2 }] }),
      sender: { sendMessage } as never,
    });
    expect(result).toEqual({ qualified: 2, notificationsSent: 1, notificationFailures: 0 });
    expect(sendMessage).toHaveBeenCalledWith(85820797, expect.stringContaining("تم احتساب إحالة جديدة بنجاح"));
  });

  it("لا يوقف التأهيل عند تعذر إشعار إحدى المكافآت", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("unavailable"));
    const result = await runTelegramReferralQualification({
      qualifyDue: async () => ({ qualified: 1, events: [{ referrerChatId: "85820797", qualifiedCount: 1, remainingCount: 4 }] }),
      sender: { sendMessage } as never,
    });
    expect(result).toEqual({ qualified: 1, notificationsSent: 0, notificationFailures: 1 });
  });
});
