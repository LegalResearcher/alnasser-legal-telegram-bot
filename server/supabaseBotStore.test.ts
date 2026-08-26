import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseBotStore, listSupabaseBotManagedReferralRewards } from "./supabaseBotStore";
import { FEATURED_REFERENCES_ROOT_FOLDER_ID, ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID, JUDICIAL_ROOT_FOLDER_ID, LEGAL_FORMS_ROOT_FOLDER_ID } from "./db";

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

describe("Supabase bot store", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rpc/bot_admin_decide_subscription_request")) {
        return jsonResponse({ telegramUserId: "100", chatId: "200", accessScope: "important_laws", managedMenuItemId: null });
      }
      if (url.includes("/drive_folders")) {
        return jsonResponse([
          { id: 2, drive_id: JUDICIAL_ROOT_FOLDER_ID, name: "قواعد قضائية", parent_id: null, depth: 0, order_index: 0, is_premium: false, free_download: false },
          { id: 3, drive_id: "child-folder", name: "الأحكام المدنية", parent_id: JUDICIAL_ROOT_FOLDER_ID, depth: 1, order_index: 0, is_premium: false, free_download: false },
        ]);
      }
      if (url.includes("/drive_files")) {
        return jsonResponse([
          { id: 101, drive_id: "drive-file-101", name: "حكم مدني 2026.pdf", folder_id: "child-folder", mime_type: "application/pdf", view_url: "https://drive.google.com/file/d/drive-file-101/view", embed_url: null, download_url: null, order_index: 0, is_premium: false, view_count: 0, download_count: 0, extracted_title: null, download_locked: false, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
        ]);
      }
      if (url.includes("/legal_documents")) {
        return jsonResponse([{ id: 201, file_name: "عقد بيع عقار", display_order: 1, is_premium: false, content: [{ num: "1", text: "البند الأول" }] }]);
      }
      return jsonResponse([]);
    }));
  });

  it("يعرض مجلدات وملفات Drive بصيغة LegalSource المتوافقة", async () => {
    const store = createSupabaseBotStore();
    const result = await store.getJudicialFolderContents(JUDICIAL_ROOT_FOLDER_ID, 1);
    expect(result.folder?.driveFolderId).toBe(JUDICIAL_ROOT_FOLDER_ID);
    expect(result.folders[0]?.name).toBe("الأحكام المدنية");
    expect(result.totalSources).toBe(0);
    const child = await store.getJudicialFolderContents("child-folder", 1);
    expect(child.sources[0]).toMatchObject({ id: 101, driveFileId: "drive-file-101", collection: "judicial", title: "حكم مدني 2026.pdf" });
  });

  it("يعرض النماذج المصورة من فهرس روابط Drive دون تخزين الملفات في Supabase", async () => {
    const store = createSupabaseBotStore();
    const result = await store.getIllustratedLegalFormsFolderContents(ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID, 1);
    expect(result.folder?.driveFolderId).toBe(ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID);
    expect(result.folders).toHaveLength(0);
    expect(result.totalSources).toBe(17);
    expect(result.sources[0]).toMatchObject({ collection: "illustrated_legal_forms", title: "إشعارات واعلانات.pdf" });
    expect(result.sources[0]?.url).toContain("drive.google.com/uc?export=download");
    const source = await store.getSource(result.sources[0]!.id);
    expect(source?.driveFileId).toBe("1PV9925vCUqQMn3h4mCpwLIKwoUHD6FZr");
  });

  it("يعرض نماذج وصيغ قانونية من فهرس روابط Drive دون تخزين الملفات في Supabase", async () => {
    const store = createSupabaseBotStore();
    const result = await store.getLegalFormsFolderContents(LEGAL_FORMS_ROOT_FOLDER_ID, 1);
    expect(result.folder?.driveFolderId).toBe(LEGAL_FORMS_ROOT_FOLDER_ID);
    expect(result.folders).toHaveLength(0);
    expect(result.totalSources).toBe(217);
    expect(result.sources[0]).toMatchObject({ collection: "legal_forms", title: "005دعوى اخلاء عين مؤجرة.doc" });
    expect(result.sources[0]?.url).toContain("drive.google.com/uc?export=download");
    const source = await store.getSource(result.sources[0]!.id);
    expect(source?.driveFileId).toBe("1AEoWr4AY2H2IyDlX1DZXJF4QFo2U6V14");
  });

  it("يستخدم قسم مراجع مميزة مجلد نماذج وصيغ Drive نفسه", async () => {
    const store = createSupabaseBotStore();
    const result = await store.getFeaturedReferencesFolderContents(FEATURED_REFERENCES_ROOT_FOLDER_ID, 1);
    expect(result.folder?.driveFolderId).toBe(LEGAL_FORMS_ROOT_FOLDER_ID);
    expect(result.folder?.name).toBe("نماذج وصيغ قانونية");
    expect(result.totalSources).toBe(217);
    expect(result.sources[0]?.collection).toBe("legal_forms");
    expect(result.sources[0]?.url).toContain("drive.google.com/uc?export=download");
  });

  it("يقرأ ملخص مكافآت الإحالات من جداول Supabase المملوكة للبوت", async () => {
    const result = await listSupabaseBotManagedReferralRewards();
    expect(result.summary).toEqual({ qualifiedReferrals: 0, pendingReferrals: 0, activeRewards: 0 });
    expect(result.rewards).toEqual([]);
  });

  it("يعتمد طلب الاشتراك عبر RPC ذري بدل تحديثين منفصلين", async () => {
    const store = createSupabaseBotStore();
    const result = await store.approveImportantYemeniLawsSubscriptionRequest(99, "admin-user");
    expect(result).toEqual({ telegramUserId: "100", chatId: "200", accessScope: "important_laws", managedMenuItemId: null });
  });

  it("يقرأ القوالب القانونية من legal_documents مع تصنيفها", async () => {
    const store = createSupabaseBotStore();
    const result = await store.listContractTemplates(1);
    expect(result.total).toBe(1);
    expect(result.templates[0]).toMatchObject({ sourceDocumentId: 201, fileName: "عقد بيع عقار", contractType: "civil", isActive: true });
    expect(result.templates[0]?.content).toEqual([{ num: "1", text: "البند الأول" }]);
  });
});
