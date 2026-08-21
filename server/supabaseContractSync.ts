import { sql } from "drizzle-orm";
import { telegramContractTemplates, type TelegramContractTemplateContentBlock } from "../drizzle/schema";
import { getDb } from "./db";
import { classifyTelegramContractTemplate } from "./telegramContractTypes";

const SOURCE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co/rest/v1";

type SourceContractTemplate = {
  id: number;
  file_name: string | null;
  display_order: number | null;
  is_premium: boolean | null;
  content: unknown;
};

function normalizedContent(value: unknown): TelegramContractTemplateContentBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === "object")
    .map(block => ({
      num: typeof block.num === "string" ? block.num : undefined,
      text: typeof block.text === "string" ? block.text : undefined,
      type: typeof block.type === "string" ? block.type : undefined,
    }))
    .filter(block => Boolean(block.text?.trim()));
}

async function sourceSelectAll(): Promise<SourceContractTemplate[]> {
  const apiKey = process.env.SUPABASE_ANON_KEY;
  if (!apiKey) throw new Error("SUPABASE_ANON_KEY غير متاح لاستيراد صيغ العقود.");
  const rows: SourceContractTemplate[] = [];
  for (let offset = 0; ; offset += 1000) {
    const query = new URLSearchParams({
      select: "id,file_name,display_order,is_premium,content",
      category: "eq.contract_template",
      order: "display_order.asc,id.asc",
      limit: "1000",
      offset: String(offset),
    });
    const response = await fetch(`${SOURCE_URL}/legal_documents?${query}`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`فشلت قراءة صيغ العقود من Supabase: ${response.status}`);
    const batch = await response.json() as SourceContractTemplate[];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

export async function syncSupabaseContractTemplates(): Promise<{ templates: number; skipped: number }> {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة بيانات البوت.");
  const sourceTemplates = await sourceSelectAll();
  const templates = sourceTemplates.map(source => ({
    sourceDocumentId: Number(source.id),
    fileName: source.file_name?.trim() || `نموذج قانوني ${source.id}`,
    content: normalizedContent(source.content),
    sortOrder: Number(source.display_order ?? 0),
    contractType: classifyTelegramContractTemplate(source.file_name?.trim() || `نموذج قانوني ${source.id}`),
    isPremium: Boolean(source.is_premium),
    isActive: true,
  })).filter(template => template.content.length > 0);

  await db.update(telegramContractTemplates).set({ isActive: false });
  for (let start = 0; start < templates.length; start += 100) {
    const batch = templates.slice(start, start + 100);
    await db.insert(telegramContractTemplates).values(batch).onDuplicateKeyUpdate({
      set: {
        fileName: sql`VALUES(${telegramContractTemplates.fileName})`,
        content: sql`VALUES(${telegramContractTemplates.content})`,
        sortOrder: sql`VALUES(${telegramContractTemplates.sortOrder})`,
        contractType: sql`VALUES(${telegramContractTemplates.contractType})`,
        isPremium: sql`VALUES(${telegramContractTemplates.isPremium})`,
        isActive: true,
      },
    });
  }
  return { templates: templates.length, skipped: sourceTemplates.length - templates.length };
}
