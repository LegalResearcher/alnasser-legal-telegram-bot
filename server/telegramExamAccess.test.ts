import { describe, expect, it } from "vitest";
import { examAccessScopeForLevel } from "./telegram";

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
});
