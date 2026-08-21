import { describe, expect, it } from "vitest";
import { getTelegramVisitPeriodStart, selectManagedUploadFolderId } from "./db";

describe("selectManagedUploadFolderId", () => {
  it("يربط الملف المرفوع بالمجلد الجذري للقسم وليس بالمجلد الفرعي", () => {
    const folderId = selectManagedUploadFolderId("judicial", [
      { collection: "judicial", driveFolderId: "civil-child", parentDriveFolderId: "judicial-root", sortOrder: 1 },
      { collection: "judicial", driveFolderId: "judicial-root", parentDriveFolderId: null, sortOrder: 10 },
    ]);

    expect(folderId).toBe("judicial-root");
  });

  it("لا ينسب الملف إلى قسم لا يملك مجلدًا جذريًا", () => {
    const folderId = selectManagedUploadFolderId("legislation", [
      { collection: "judicial", driveFolderId: "judicial-root", parentDriveFolderId: null, sortOrder: 1 },
    ]);

    expect(folderId).toBeNull();
  });
});

describe("getTelegramVisitPeriodStart", () => {
  it("يحسب بداية نطاق زيارات اليوم والأسبوع والشهر بدقة", () => {
    const now = new Date("2030-04-15T12:00:00.000Z");
    expect(getTelegramVisitPeriodStart("day", now).toISOString()).toBe("2030-04-14T12:00:00.000Z");
    expect(getTelegramVisitPeriodStart("week", now).toISOString()).toBe("2030-04-08T12:00:00.000Z");
    expect(getTelegramVisitPeriodStart("month", now).toISOString()).toBe("2030-03-16T12:00:00.000Z");
  });
});
