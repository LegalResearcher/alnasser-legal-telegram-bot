import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateTelegramWebAppInitData } from "./telegramPlatformVisit";

function buildInitData(botToken: string, authDate: number, userId = 85820797) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAE-test-query",
    user: JSON.stringify({ id: userId, first_name: "معين" }),
  });
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("Telegram Web App platform visit validation", () => {
  const token = "123456:TEST_TOKEN";
  const now = 1_800_000_000;

  it("يقبل initData الموقعة حديثًا ويعيد معرّف المستخدم", () => {
    const result = validateTelegramWebAppInitData(buildInitData(token, now - 30), token, now);
    expect(result).toEqual({ telegramUserId: "85820797", authDate: now - 30 });
  });

  it("يرفض initData بعد تغيير محتواها أو توقيعها", () => {
    const data = new URLSearchParams(buildInitData(token, now - 30));
    data.set("user", JSON.stringify({ id: 42, first_name: "مستخدم" }));
    expect(validateTelegramWebAppInitData(data.toString(), token, now)).toBeUndefined();
  });

  it("يرفض initData المنتهية", () => {
    const result = validateTelegramWebAppInitData(buildInitData(token, now - 301), token, now);
    expect(result).toBeUndefined();
  });
});
