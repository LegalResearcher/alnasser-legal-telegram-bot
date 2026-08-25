import { afterEach, describe, expect, it, vi } from "vitest";
import health from "./health";

describe("Telegram health endpoint", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("يعلن Supabase وconfigured عند وجود البيئة المطلوبة", () => {
    vi.stubEnv("BOT_STORAGE_MODE", "supabase");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "test-secret");
    const response = { status: vi.fn(() => ({ json: vi.fn() })) };
    health({}, response);
    const json = response.status.mock.results[0]?.value.json as ReturnType<typeof vi.fn>;
    expect(response.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ ok: true, storage: "supabase", configured: true });
  });

  it("لا يعتبر البيئة مهيأة عند غياب أسرار Telegram", () => {
    vi.stubEnv("BOT_STORAGE_MODE", "supabase");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
    const json = vi.fn();
    health({}, { status: () => ({ json }) });
    expect(json).toHaveBeenCalledWith({ ok: true, storage: "supabase", configured: false });
  });
});
