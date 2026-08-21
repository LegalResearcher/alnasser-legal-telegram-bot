import { describe, expect, it } from "vitest";

const SUPABASE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co";

describe("اعتماد Supabase لتوثيق زيارة Telegram Web App", () => {
  it("يقبل مفتاح Supabase الحالي عند الوصول إلى جدول زيارات المنصة", async () => {
    const apiKey = process.env.SUPABASE_ANON_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(`${SUPABASE_URL}/rest/v1/telegram_platform_visits?select=telegram_user_id&limit=1`, {
      headers: {
        apikey: apiKey!,
        Authorization: `Bearer ${apiKey!}`,
      },
    });

    expect(response.status).not.toBe(401);
    expect(response.status).toBeLessThan(500);
  }, 15_000);

  it("يقبل مفتاح Service Role الخادمي عند الوصول إلى جدول زيارات المنصة", async () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(serviceRoleKey).toBeTruthy();

    const response = await fetch(`${SUPABASE_URL}/rest/v1/telegram_platform_visits?select=telegram_user_id&limit=1`, {
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey!}`,
      },
    });

    expect(response.ok).toBe(true);
  }, 15_000);
});
