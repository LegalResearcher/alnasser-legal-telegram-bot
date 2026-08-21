import { describe, expect, it } from "vitest";

const SOURCE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co/rest/v1";

describe("Supabase source credentials", () => {
  it("يتحقق من مفتاح القراءة عبر طلب خفيف إلى جدول المستويات", async () => {
    const apiKey = process.env.SUPABASE_ANON_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(`${SOURCE_URL}/levels?select=id&limit=1`, {
      headers: { apikey: apiKey ?? "", Authorization: `Bearer ${apiKey ?? ""}` },
      signal: AbortSignal.timeout(15_000),
    });

    expect(response.ok).toBe(true);
  }, 20_000);
});
