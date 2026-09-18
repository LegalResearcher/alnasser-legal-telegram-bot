import { describe, expect, it } from "vitest";
import { examAccessScopeForLevel, extractTelegramSubscriptionLinkToken } from "./telegram";

describe("Telegram exam access scopes", () => {
  it("maps law levels to isolated subscription scopes", () => {
    expect(examAccessScopeForLevel("l1")).toBe("level_1");
    expect(examAccessScopeForLevel("l2")).toBe("level_2");
    expect(examAccessScopeForLevel("l3")).toBe("level_3");
    expect(examAccessScopeForLevel("l4")).toBe("level_4");
  });

  it("keeps literary and scientific secondary scopes separate", () => {
    expect(examAccessScopeForLevel("secondary-literary")).toBe("secondary_literary");
    expect(examAccessScopeForLevel("secondary-scientific")).toBe("secondary_scientific");
    expect(examAccessScopeForLevel("secondary")).toBeUndefined();
  });

  it("accepts the copied deep-link command with a bot username", () => {
    expect(extractTelegramSubscriptionLinkToken("/start@Moieen2025Bot link_abc-123_X")).toBe("abc-123_X");
    expect(extractTelegramSubscriptionLinkToken("/link abc-123_X")).toBe("abc-123_X");
  });

  it("accepts a copied Telegram deep-link URL", () => {
    expect(extractTelegramSubscriptionLinkToken("https://t.me/Moieen2025Bot?start=link_abc-123_X")).toBe("abc-123_X");
  });

  it("does not treat unrelated text as a subscription link", () => {
    expect(extractTelegramSubscriptionLinkToken("اختبار ومراجعة")).toBeUndefined();
  });
});
