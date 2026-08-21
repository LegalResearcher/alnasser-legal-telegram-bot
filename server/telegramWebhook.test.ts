import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelegramLibraryStorageKey, isPlatformAdministrator, isValidTelegramWebhookSecret, normalizeScheduledBroadcastTime, normalizeTelegramRegion, resolveTelegramLibraryUploadContentType, scheduledBroadcastCron } from "./telegramWebhook";

describe("Telegram webhook secret", () => {
  it("يقبل الترويسة المطابقة فقط", () => {
    expect(isValidTelegramWebhookSecret("secret-123", "secret-123")).toBe(true);
    expect(isValidTelegramWebhookSecret("secret-124", "secret-123")).toBe(false);
    expect(isValidTelegramWebhookSecret(undefined, "secret-123")).toBe(false);
    expect(isValidTelegramWebhookSecret("secret-123", undefined)).toBe(false);
  });

  it("يقبل منطقة زمنية مجمعة فقط ويرفض أي قيمة غير صالحة", () => {
    expect(normalizeTelegramRegion("Asia/Aden")).toBe("Asia/Aden");
    expect(normalizeTelegramRegion("location:15.3,44.2")).toBeNull();
    expect(normalizeTelegramRegion(undefined)).toBeNull();
  });

  it("يطبع مهمة بث مؤجل دقيقة ويمنع الموعد القريب جدًا أو البعيد جدًا", () => {
    const now = new Date("2030-05-09T10:00:00.000Z");
    const scheduled = normalizeScheduledBroadcastTime("2030-05-09T14:05:37.000Z", now);
    expect(scheduled?.toISOString()).toBe("2030-05-09T14:05:00.000Z");
    expect(scheduledBroadcastCron(scheduled!)).toBe("0 5 14 9 5 *");
    expect(normalizeScheduledBroadcastTime("2030-05-09T10:00:30.000Z", now)).toBeUndefined();
    expect(normalizeScheduledBroadcastTime("2032-01-01T00:00:00.000Z", now)).toBeUndefined();
    expect(normalizeScheduledBroadcastTime("موعد غير صالح", now)).toBeUndefined();
  });

  it("يستنتج نوع ملفات المكتبة من الامتداد عند غياب نوع المتصفح", () => {
    expect(resolveTelegramLibraryUploadContentType("قانون مدني.docx", "")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(resolveTelegramLibraryUploadContentType("rules.PDF", "application/octet-stream")).toBe("application/pdf");
    expect(resolveTelegramLibraryUploadContentType("notes.txt", "text/plain;charset=utf-8")).toBe("text/plain");
    expect(resolveTelegramLibraryUploadContentType("archive.zip", "application/octet-stream")).toBeUndefined();
  });

  it("ينشئ مفتاح تخزين ASCII حتى عند رفع ملف باسمه العربي", () => {
    const key = createTelegramLibraryStorageKey("قانون المرافعات اليمني.docx", 12345, "safe-id-123");
    expect(key).toBe("telegram-library/12345-safe-id-123.docx");
    expect(/^[\x00-\x7F]+$/.test(key)).toBe(true);
  });

  it("يرفض طلب إحصاءات المنصة من دون جلسة مسؤول صالحة", async () => {
    expect(await isPlatformAdministrator(undefined)).toBe(false);
  });

  it("يتحقق من دور المسؤول في Supabase قبل إرجاع إحصاءات البوت", async () => {
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "admin-id" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ role: "admin" }]) }));

    await expect(isPlatformAdministrator("Bearer platform-session-token")).resolves.toBe(true);
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
