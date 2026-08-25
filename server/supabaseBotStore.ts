import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LegalFolder, LegalSource, TelegramContractTemplate, TelegramContractTemplateType } from "../drizzle/schema";
import {
  ALL_YEMENI_LAWS_ROOT_FOLDER_ID,
  FEATURED_REFERENCES_ROOT_FOLDER_ID,
  ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID,
  IMPORTANT_YEMENI_LAWS_ROOT_FOLDER_ID,
  JUDICIAL_ROOT_FOLDER_ID,
  LEGAL_FORMS_ROOT_FOLDER_ID,
  LEGISLATION_ROOT_FOLDER_ID,
  YEMENI_LAWS_ROOT_FOLDER_ID,
} from "./db";
import { classifyTelegramContractTemplate } from "./telegramContractTypes";
import { getIllustratedLegalFormSource, getIllustratedLegalFormsFolderContents as getStaticIllustratedLegalFormsFolderContents } from "./illustratedLegalFormsCatalog";
import type {
  TelegramExamPollResolution,
  TelegramExamResultSummary,
  TelegramExamSessionRecord,
  TelegramGroupExamParticipantRecord,
  TelegramGroupExamPollResolution,
  TelegramGroupExamRoundRecord,
  TelegramLibraryStore,
  LegalCategory,
  TelegramManagedMenuItemRecord,
  TelegramManagedMessageRecord,
  TelegramManagedSectionRecord,
} from "./telegram";
import {
  advanceSupabaseBotExamWrittenQuestion,
  cancelSupabaseBotExamSession,
  getSupabaseBotExamResultSummary,
  getSupabaseBotExamSession,
  getSupabaseBotExamSessionByPoll,
  listSupabaseBotExamForms,
  listSupabaseBotExamQuestions,
  resolveSupabaseBotExamPoll,
  setSupabaseBotExamActivePoll,
  startSupabaseBotExamSession,
} from "./supabaseBotExamDb";

const DEFAULT_SUPABASE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co";
const PAGE_SIZE = 1000;
const LIBRARY_PAGE_SIZE = 7;
const SEARCH_TTL_MS = 10 * 60 * 1000;
const SOURCE_COLLECTIONS = ["judicial", "legislation", "yemeni_laws", "legal_forms", "illustrated_legal_forms", "all_yemeni_laws", "featured_references", "important_yemeni_laws"] as const;
type SourceCollection = (typeof SOURCE_COLLECTIONS)[number];
type SearchScope = "judicial" | "legislation" | "all_yemeni_laws" | "library" | "contract_templates";
type AccessScope = "important_laws" | "sharia_exams" | "secondary_exams";
type UserAccessScope = AccessScope | "managed_menu";

const ROOT_BY_COLLECTION: Record<SourceCollection, { id: string; name: string }> = {
  judicial: { id: JUDICIAL_ROOT_FOLDER_ID, name: "قواعد قضائية" },
  legislation: { id: LEGISLATION_ROOT_FOLDER_ID, name: "التشريعات اليمنية" },
  yemeni_laws: { id: YEMENI_LAWS_ROOT_FOLDER_ID, name: "القوانين اليمنية فهرس تفاعلي" },
  legal_forms: { id: LEGAL_FORMS_ROOT_FOLDER_ID, name: "نماذج وصيغ قانونية" },
  illustrated_legal_forms: { id: ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID, name: "نماذج مصورة وفق القوانين اليمنية" },
  all_yemeni_laws: { id: ALL_YEMENI_LAWS_ROOT_FOLDER_ID, name: "جميع القوانين اليمنية" },
  featured_references: { id: FEATURED_REFERENCES_ROOT_FOLDER_ID, name: "مراجع مميزة" },
  important_yemeni_laws: { id: IMPORTANT_YEMENI_LAWS_ROOT_FOLDER_ID, name: "أهم القوانين اليمنية بالفهرس التفاعلي" },
};

function getClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function throwIfError(error: { message?: string } | null, operation: string): void {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message ?? "unknown error"}`);
}

async function readAll<T>(table: string, select: string, configure: (query: any) => any): Promise<T[]> {
  const client = getClient();
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.from(table).select(select);
    query = configure(query).range(offset, offset + PAGE_SIZE - 1);
    const { data, error } = await query;
    throwIfError(error, `read ${table}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

function dateValue(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value ?? Date.now()));
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[\u064B-\u065F\u0670]/g, "").replace(/ـ/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\u0621-\u063A\u0641-\u064A0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchScore(query: string, text: string): number {
  const needle = normalizeSearch(query);
  const haystack = normalizeSearch(text);
  if (!needle || needle.length < 2) return 0;
  if (haystack.includes(needle)) return 100;
  const words = haystack.split(" ").filter(word => word.length > 1);
  return needle.split(" ").filter(Boolean).reduce((score, word) => score + (words.some(candidate => candidate.startsWith(word) || word.startsWith(candidate)) ? 2 : 0), 0);
}

function sourceCategory(name: string): LegalCategory {
  const normalized = normalizeSearch(name);
  if (/(فقه|شريع|اسلام)/.test(normalized)) return "fiqh";
  if (/(مدني|عقار|ملكيه)/.test(normalized)) return "civil";
  if (/(تجاري|شركه)/.test(normalized)) return "commercial";
  if (/(جنائي|جزائي|عقوب|مرافع|نياب)/.test(normalized)) return "procedure";
  return "general";
}

function sourceDocumentType(name: string): "law" | "regulation" | "decision" | "agreement" | "treaty" | "decree" | "other" {
  const normalized = normalizeSearch(name);
  if (/لائح/.test(normalized)) return "regulation";
  if (/قرار/.test(normalized)) return "decision";
  if (/اتفاق|اتفاقي/.test(normalized)) return "agreement";
  if (/معاهد/.test(normalized)) return "treaty";
  if (/مرسوم/.test(normalized)) return "decree";
  if (/قانون|تشريع/.test(normalized)) return "law";
  return "other";
}

function sourceYear(name: string): number | null {
  const year = name.match(/(?:19|20)\d{2}/)?.[0];
  return year ? Number(year) : null;
}

type DriveFolderRow = { id: number; drive_id: string; name: string; parent_id: string | null; depth: number | null; order_index: number | null; is_premium: boolean | null; free_download: boolean | null };
type DriveFileRow = { id: number; drive_id: string; name: string; folder_id: string | null; mime_type: string | null; view_url: string | null; embed_url: string | null; download_url: string | null; order_index: number | null; is_premium: boolean | null; view_count: number | null; download_count: number | null; extracted_title: string | null; download_locked: boolean | null; created_at: string | null; updated_at: string | null };

function mapFolder(row: DriveFolderRow, collection: SourceCollection, path: string): LegalFolder {
  return {
    id: Number(row.id),
    driveFolderId: row.drive_id,
    parentDriveFolderId: row.parent_id,
    collection,
    name: row.name,
    path,
    sortOrder: Number(row.order_index ?? 0),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function mapFile(row: DriveFileRow, collection: SourceCollection, folderPath: string): LegalSource {
  const title = row.extracted_title?.trim() || row.name.trim() || `ملف ${row.id}`;
  const url = row.download_url || row.view_url || row.embed_url || `https://drive.google.com/file/d/${encodeURIComponent(row.drive_id)}/view`;
  return {
    id: Number(row.id),
    category: sourceCategory(title),
    collection,
    sortOrder: Number(row.order_index ?? 0),
    driveFileId: row.drive_id,
    driveFolderId: row.folder_id,
    folderSortOrder: Number(row.order_index ?? 0),
    title,
    description: folderPath ? `${title}\nالمجلد: ${folderPath}` : title,
    url,
    documentType: sourceDocumentType(title),
    legislationYear: sourceYear(title),
    issuingAuthority: null,
    isFeatured: false,
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
  };
}

async function loadDriveIndex() {
  const [folders, files] = await Promise.all([
    readAll<DriveFolderRow>("drive_folders", "id,drive_id,name,parent_id,depth,order_index,is_premium,free_download", query => query.order("depth", { ascending: true }).order("order_index", { ascending: true }).order("id", { ascending: true })),
    readAll<DriveFileRow>("drive_files", "id,drive_id,name,folder_id,mime_type,view_url,embed_url,download_url,order_index,is_premium,view_count,download_count,extracted_title,download_locked,created_at,updated_at", query => query.order("folder_id", { ascending: true }).order("order_index", { ascending: true }).order("id", { ascending: true })),
  ]);
  const foldersByDriveId = new Map(folders.map(folder => [folder.drive_id, folder]));
  const collectionCache = new Map<string, SourceCollection | undefined>();
  const rootCollection = new Map<string, SourceCollection>(Object.entries(ROOT_BY_COLLECTION).map(([collection, root]) => [root.id, collection as SourceCollection]));
  const collectionForFolder = (driveId: string | null): SourceCollection | undefined => {
    if (!driveId) return undefined;
    if (collectionCache.has(driveId)) return collectionCache.get(driveId);
    const seen = new Set<string>();
    let current = foldersByDriveId.get(driveId);
    while (current && !seen.has(current.drive_id)) {
      const direct = rootCollection.get(current.drive_id);
      if (direct) { collectionCache.set(driveId, direct); return direct; }
      seen.add(current.drive_id);
      current = current.parent_id ? foldersByDriveId.get(current.parent_id) : undefined;
    }
    collectionCache.set(driveId, undefined);
    return undefined;
  };
  const folderPath = (driveId: string): string => {
    const parts: string[] = [];
    const seen = new Set<string>();
    let current = foldersByDriveId.get(driveId);
    while (current && !seen.has(current.drive_id)) {
      parts.unshift(current.name);
      seen.add(current.drive_id);
      current = current.parent_id ? foldersByDriveId.get(current.parent_id) : undefined;
    }
    const collection = collectionForFolder(driveId);
    const rootName = collection ? ROOT_BY_COLLECTION[collection].name : "";
    return parts.join(" / ") || rootName;
  };
  const sourceRows = files.map(file => {
    const collection = collectionForFolder(file.folder_id);
    return collection ? { file, collection, source: mapFile(file, collection, file.folder_id ? folderPath(file.folder_id) : "") } : undefined;
  }).filter((value): value is { file: DriveFileRow; collection: SourceCollection; source: LegalSource } => Boolean(value));
  return { folders, files, foldersByDriveId, collectionForFolder, folderPath, sourceRows };
}

function virtualFolder(collection: SourceCollection): LegalFolder {
  const root = ROOT_BY_COLLECTION[collection];
  return { id: 0, driveFolderId: root.id, parentDriveFolderId: null, collection, name: root.name, path: root.name, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
}

async function folderContents(collection: SourceCollection, folderId: string, page: number) {
  const index = await loadDriveIndex();
  const row = index.foldersByDriveId.get(folderId);
  const actualCollection = index.collectionForFolder(folderId);
  const folder = row && actualCollection === collection ? mapFolder(row, collection, index.folderPath(folderId)) : folderId === ROOT_BY_COLLECTION[collection].id ? virtualFolder(collection) : undefined;
  if (!folder) return { folder: undefined, folders: [], sources: [], totalSources: 0 };
  const children = index.folders.filter(child => child.parent_id === folderId && index.collectionForFolder(child.drive_id) === collection).sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0) || a.name.localeCompare(b.name)).slice(0, 60).map(child => mapFolder(child, collection, index.folderPath(child.drive_id)));
  const allSources = index.sourceRows.filter(item => item.collection === collection && item.file.folder_id === folderId).sort((a, b) => Number(a.file.order_index ?? 0) - Number(b.file.order_index ?? 0) || a.file.id - b.file.id).map(item => item.source);
  const safePage = Math.max(1, Math.trunc(page) || 1);
  return { folder, folders: children, sources: allSources.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), totalSources: allSources.length };
}

async function listSources(collection: SourceCollection, page: number, predicate: (source: LegalSource) => boolean = () => true) {
  const index = await loadDriveIndex();
  const all = index.sourceRows.filter(item => item.collection === collection).map(item => item.source).filter(predicate).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const safePage = Math.max(1, Math.trunc(page) || 1);
  return { sources: all.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), total: all.length };
}

async function getDriveSource(id: number): Promise<LegalSource | undefined> {
  const index = await loadDriveIndex();
  return index.sourceRows.find(item => item.source.id === id)?.source;
}

async function getBotSource(id: number): Promise<LegalSource | undefined> {
  return getIllustratedLegalFormSource(id) ?? getDriveSource(id);
}

type ContractRow = { id: number; file_name: string | null; display_order: number | null; is_premium: boolean | null; content: unknown; };
function normalizeContractContent(value: unknown): Array<{ num?: string; text?: string; type?: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === "object").map(block => ({ num: typeof block.num === "string" ? block.num : undefined, text: typeof block.text === "string" ? block.text : undefined, type: typeof block.type === "string" ? block.type : undefined })).filter(block => Boolean(block.text?.trim()));
}
function mapContract(row: ContractRow): TelegramContractTemplate {
  return { id: Number(row.id), sourceDocumentId: Number(row.id), fileName: row.file_name?.trim() || `نموذج قانوني ${row.id}`, content: normalizeContractContent(row.content), sortOrder: Number(row.display_order ?? 0), contractType: classifyTelegramContractTemplate(row.file_name?.trim() || ""), isPremium: Boolean(row.is_premium), isActive: true, createdAt: new Date(), updatedAt: new Date() };
}
async function loadContracts(): Promise<TelegramContractTemplate[]> {
  const rows = await readAll<ContractRow>("legal_documents", "id,file_name,display_order,is_premium,content", query => query.eq("category", "contract_template").order("display_order", { ascending: true }).order("id", { ascending: true }));
  return rows.map(mapContract).filter(template => template.content.length > 0);
}

async function clearSearch(chatId: string) {
  const { error } = await getClient().from("bot_search_sessions").delete().eq("chat_id", chatId);
  throwIfError(error, "clear search sessions");
}
async function beginSearch(chatId: string, scope: SearchScope): Promise<void> {
  await clearSearch(chatId);
  const { error } = await getClient().from("bot_search_sessions").upsert({ chat_id: chatId, scope, query: null, status: "awaiting", expires_at: new Date(Date.now() + SEARCH_TTL_MS).toISOString(), updated_at: new Date().toISOString() }, { onConflict: "chat_id,scope" });
  throwIfError(error, "begin search");
}
async function consumeSearch(chatId: string, scope: SearchScope, query: string): Promise<{ id: number } | undefined> {
  const normalized = query.trim().slice(0, 255);
  if (!normalized) return undefined;
  const { data, error } = await getClient().from("bot_search_sessions").select("id").eq("chat_id", chatId).eq("scope", scope).eq("status", "awaiting").gt("expires_at", new Date().toISOString()).limit(1).maybeSingle();
  throwIfError(error, "read search session");
  if (!data) return undefined;
  const { error: updateError } = await getClient().from("bot_search_sessions").update({ query: normalized, status: "ready", expires_at: new Date(Date.now() + SEARCH_TTL_MS).toISOString(), updated_at: new Date().toISOString() }).eq("id", Number((data as { id: number }).id));
  throwIfError(updateError, "save search query");
  return { id: Number((data as { id: number }).id) };
}
async function sessionQuery(id: number, scope: SearchScope): Promise<string | undefined> {
  const { data, error } = await getClient().from("bot_search_sessions").select("query").eq("id", id).eq("scope", scope).eq("status", "ready").gt("expires_at", new Date().toISOString()).limit(1).maybeSingle();
  throwIfError(error, "read ready search");
  const query = (data as { query?: string | null } | null)?.query;
  return query?.trim() || undefined;
}
async function searchSourceScope(scope: SearchScope, sessionId: number, page: number, collection: SourceCollection): Promise<{ query: string; sources: LegalSource[]; total: number; matchType: "exact" | "approximate" } | undefined> {
  const query = await sessionQuery(sessionId, scope);
  if (!query) return undefined;
  const index = await loadDriveIndex();
  const candidates = index.sourceRows.filter(item => item.collection === collection).map(item => item.source);
  const exact = candidates.filter(source => normalizeSearch(`${source.title} ${source.description}`).includes(normalizeSearch(query)));
  const ranked = exact.length > 0 ? exact : candidates.map(source => ({ source, score: matchScore(query, `${source.title} ${source.description}`) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.source.sortOrder - b.source.sortOrder || a.source.id - b.source.id).map(item => item.source);
  const safePage = Math.max(1, Math.trunc(page) || 1);
  return { query, sources: ranked.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), total: ranked.length, matchType: exact.length > 0 ? "exact" : "approximate" };
}

async function hasAccess(scope: "bot_platform_access" | "bot_hasad_access", telegramUserId: string): Promise<boolean> {
  const { data, error } = await getClient().from(scope).select("telegram_user_id").eq("telegram_user_id", telegramUserId).limit(1).maybeSingle();
  throwIfError(error, `check ${scope}`);
  return Boolean(data);
}
async function hasScopedAccess(telegramUserId: string, accessScope: UserAccessScope, managedMenuItemId?: number): Promise<boolean> {
  const { data, error } = await getClient().from("bot_user_access").select("managed_menu_item_id,expires_at").eq("telegram_user_id", telegramUserId).eq("access_scope", accessScope).limit(100);
  throwIfError(error, "check scoped access");
  const now = Date.now();
  return ((data ?? []) as Array<{ managed_menu_item_id: number | null; expires_at: string | null }>).some(row => (managedMenuItemId === undefined || Number(row.managed_menu_item_id) === managedMenuItemId) && (!row.expires_at || new Date(row.expires_at).getTime() > now));
}
async function upsertScopedAccess(telegramUserId: string, accessScope: UserAccessScope, approvedBy: string, managedMenuItemId: number | null = null): Promise<void> {
  const { error } = await getClient().from("bot_user_access").upsert({ telegram_user_id: telegramUserId, access_scope: accessScope, managed_menu_item_id: managedMenuItemId, approved_by: approvedBy, expires_at: null, updated_at: new Date().toISOString() }, { onConflict: "telegram_user_id,access_scope,managed_menu_item_id" });
  throwIfError(error, "grant scoped access");
}

function mapRound(row: any): TelegramGroupExamRoundRecord {
  return { id: Number(row.id), chatId: String(row.chat_id), creatorTelegramUserId: row.creator_telegram_user_id, subjectKey: row.subject_key, sectionKey: row.section_key, status: row.status, questionIndex: Number(row.question_index), timeLimitSeconds: Number(row.time_limit_seconds), activePollId: row.active_poll_id, startedAt: row.started_at ? dateValue(row.started_at) : null };
}
async function getRoundById(roundId: number): Promise<TelegramGroupExamRoundRecord | undefined> {
  const { data, error } = await getClient().from("bot_group_exam_rounds").select("id,chat_id,creator_telegram_user_id,subject_key,section_key,status,question_index,time_limit_seconds,active_poll_id,started_at").eq("id", roundId).limit(1).maybeSingle();
  throwIfError(error, "read group round");
  return data ? mapRound(data) : undefined;
}

export function createSupabaseBotStore(): TelegramLibraryStore {
  const store: TelegramLibraryStore = {
    hasConfirmedPlatformAccess: telegramUserId => hasAccess("bot_platform_access", telegramUserId),
    hasConfirmedHasadAccess: telegramUserId => hasAccess("bot_hasad_access", telegramUserId),
    listManagedMenuItems: async (): Promise<TelegramManagedMenuItemRecord[]> => [],
    listManagedSections: async (): Promise<TelegramManagedSectionRecord[]> => [],
    listManagedMessages: async (): Promise<TelegramManagedMessageRecord[]> => [],
    listSourcesByCategory: async (category, page) => listSources("judicial", page, source => source.category === category),
    searchSources: async query => {
      const index = await loadDriveIndex();
      return index.sourceRows.map(item => item.source).filter(source => source.collection === "judicial" && matchScore(query, `${source.title} ${source.description}`) > 0).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).slice(0, 20);
    },
    getSource: getBotSource,
    saveFavorite: async (telegramUserId, sourceId) => {
      if (!await getBotSource(sourceId)) return "unavailable";
      const client = getClient();
      const { data, error } = await client.from("bot_favorites").select("source_id").eq("telegram_user_id", telegramUserId).eq("source_id", sourceId).limit(1).maybeSingle();
      throwIfError(error, "check favorite");
      if (data) return "exists";
      const { error: insertError } = await client.from("bot_favorites").insert({ telegram_user_id: telegramUserId, source_id: sourceId });
      throwIfError(insertError, "save favorite");
      return "added";
    },
    listFavorites: async telegramUserId => {
      const { data, error } = await getClient().from("bot_favorites").select("source_id,created_at").eq("telegram_user_id", telegramUserId).order("created_at", { ascending: false }).limit(50);
      throwIfError(error, "list favorites");
      const result: Array<{ source: LegalSource }> = [];
      for (const row of (data ?? []) as Array<{ source_id: number }>) {
        const source = await getBotSource(Number(row.source_id));
        if (source) result.push({ source });
      }
      return result;
    },
    removeFavorite: async (telegramUserId, sourceId) => {
      const { data, error } = await getClient().from("bot_favorites").delete().eq("telegram_user_id", telegramUserId).eq("source_id", sourceId).select("source_id");
      throwIfError(error, "remove favorite");
      return Array.isArray(data) && data.length > 0;
    },
    listRecentSources: async () => {
      const index = await loadDriveIndex();
      return index.sourceRows.filter(item => item.collection !== "important_yemeni_laws").map(item => item.source).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id).slice(0, 6);
    },
    listFeaturedSources: async () => {
      const index = await loadDriveIndex();
      return index.sourceRows.filter(item => item.collection !== "important_yemeni_laws" && item.file.is_premium !== true).map(item => item.source).slice(0, 6);
    },
    listPopularSources: async () => {
      const index = await loadDriveIndex();
      const counts = new Map<number, number>();
      const events = await readAll<{ source_id: number | null }>("bot_usage_events", "source_id", query => query.eq("event_type", "document_request").not("source_id", "is", null).order("created_at", { ascending: false }).limit(1000));
      for (const event of events) if (event.source_id) counts.set(Number(event.source_id), (counts.get(Number(event.source_id)) ?? 0) + 1);
      const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([id]) => id);
      const sources = ranked.map(id => index.sourceRows.find(item => item.source.id === id)?.source).filter((source): source is LegalSource => Boolean(source));
      return sources.slice(0, 6);
    },
    listContractTemplates: async page => { const all = await loadContracts(); const safePage = Math.max(1, Math.trunc(page) || 1); return { templates: all.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), total: all.length }; },
    listContractTemplateTypes: async () => { const all = await loadContracts(); return (["civil", "commercial", "labor", "personal", "judicial", "general"] as TelegramContractTemplateType[]).map(contractType => ({ contractType, count: all.filter(template => template.contractType === contractType).length })).filter(item => item.count > 0); },
    listContractTemplatesByType: async (contractType, page) => { const all = (await loadContracts()).filter(template => template.contractType === contractType); const safePage = Math.max(1, Math.trunc(page) || 1); return { templates: all.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), total: all.length }; },
    getContractTemplate: async id => (await loadContracts()).find(template => template.id === id),
    beginContractTemplateSearch: chatId => beginSearch(chatId, "contract_templates"),
    consumeContractTemplateSearchQuery: async (chatId, query) => consumeSearch(chatId, "contract_templates", query),
    searchContractTemplates: async (sessionId, page) => { const query = await sessionQuery(sessionId, "contract_templates"); if (!query) return undefined; const all = await loadContracts(); const exact = all.filter(template => normalizeSearch(template.fileName).includes(normalizeSearch(query))); const ranked = exact.length ? exact : all.map(template => ({ template, score: matchScore(query, template.fileName) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.template.sortOrder - b.template.sortOrder).map(item => item.template); const safePage = Math.max(1, Math.trunc(page) || 1); return { query, templates: ranked.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), total: ranked.length, matchType: exact.length ? "exact" as const : "approximate" as const }; },
    listLegislationSourcesByType: async (documentType, page) => listSources("legislation", page, source => source.documentType === documentType),
    listLegislationYears: async () => { const index = await loadDriveIndex(); return Array.from(new Set(index.sourceRows.filter(item => item.collection === "legislation").map(item => item.source.legislationYear).filter((year): year is number => Boolean(year)))).sort((a, b) => b - a); },
    listLegislationSourcesByYear: async (year, page) => listSources("legislation", page, source => source.legislationYear === year),
    recordUsage: async (telegramUserId, eventType, options) => { const { error } = await getClient().from("bot_usage_events").insert({ telegram_user_id: telegramUserId, event_type: eventType, section_key: options?.sectionKey ?? null, query: options?.query?.slice(0, 255) ?? null, source_id: options?.sourceId ?? null }); throwIfError(error, "record usage"); },
    createSupportRequest: async (telegramUserId, chatId, message) => { const { error } = await getClient().from("bot_support_requests").insert({ telegram_user_id: telegramUserId, chat_id: chatId, message: message.trim().slice(0, 2000) }); throwIfError(error, "create support request"); },
    getOwnerStatistics: async () => { const events = await readAll<{ telegram_user_id: string; event_type: string; query: string | null }>("bot_usage_events", "telegram_user_id,event_type,query", query => query.order("created_at", { ascending: false }).limit(10000)); const supports = await readAll<{ id: number }>("bot_support_requests", "id", query => query.limit(10000)); const queryCounts = new Map<string, number>(); for (const event of events) if (event.query) queryCounts.set(event.query, (queryCounts.get(event.query) ?? 0) + 1); return { totalEvents: events.length, totalSupportRequests: supports.length, topQueries: Array.from(queryCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([query, count]) => ({ query, count })) }; },
    listNewSupportRequests: async () => { const { data, error } = await getClient().from("bot_support_requests").select("id,message,created_at").eq("status", "new").order("created_at", { ascending: true }).limit(20); throwIfError(error, "list support requests"); return ((data ?? []) as Array<{ id: number; message: string; created_at: string }>).map(row => ({ id: Number(row.id), message: row.message, createdAt: dateValue(row.created_at) })); },
    registerSubscriber: async (chatId, telegramUserId, profile) => { const { error } = await getClient().from("bot_subscribers").upsert({ chat_id: chatId, telegram_user_id: telegramUserId, telegram_username: profile?.telegramUsername ?? null, telegram_first_name: profile?.telegramFirstName ?? null, telegram_last_name: profile?.telegramLastName ?? null, last_seen_at: new Date().toISOString() }, { onConflict: "chat_id" }); throwIfError(error, "register subscriber"); return true; },
    listSubscriberChatIds: async () => { const rows = await readAll<{ chat_id: string }>("bot_subscribers", "chat_id", query => query.order("chat_id", { ascending: true }).limit(10000)); return rows.map(row => row.chat_id); },
    createBroadcastDraft: async input => { const subscriberIds = await store.listSubscriberChatIds(); const { data, error } = await getClient().from("bot_broadcasts").insert({ owner_telegram_user_id: input.ownerTelegramUserId, kind: input.kind, message: input.message?.trim().slice(0, 4000) ?? null, file_id: input.fileId ?? null, file_name: input.fileName?.slice(0, 255) ?? null, caption: input.caption?.trim().slice(0, 1000) ?? null, recipient_count: subscriberIds.length }).select("id,owner_telegram_user_id,kind,message,file_id,file_name,caption,status,recipient_count").limit(1).maybeSingle(); throwIfError(error, "create broadcast"); return data ? { id: Number((data as any).id), ownerTelegramUserId: (data as any).owner_telegram_user_id, kind: (data as any).kind, message: (data as any).message, fileId: (data as any).file_id, fileName: (data as any).file_name, caption: (data as any).caption, status: (data as any).status, recipientCount: Number((data as any).recipient_count) } : undefined; },
    getBroadcastDraft: async (id, ownerTelegramUserId) => { const { data, error } = await getClient().from("bot_broadcasts").select("id,owner_telegram_user_id,kind,message,file_id,file_name,caption,status,recipient_count").eq("id", id).eq("owner_telegram_user_id", ownerTelegramUserId).limit(1).maybeSingle(); throwIfError(error, "get broadcast"); return data ? { id: Number((data as any).id), ownerTelegramUserId: (data as any).owner_telegram_user_id, kind: (data as any).kind, message: (data as any).message, fileId: (data as any).file_id, fileName: (data as any).file_name, caption: (data as any).caption, status: (data as any).status, recipientCount: Number((data as any).recipient_count) } : undefined; },
    cancelBroadcastDraft: async (id, ownerTelegramUserId) => { const { data, error } = await getClient().from("bot_broadcasts").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", id).eq("owner_telegram_user_id", ownerTelegramUserId).eq("status", "draft").select("id"); throwIfError(error, "cancel broadcast"); return Array.isArray(data) && data.length > 0; },
    beginBroadcast: async (id, ownerTelegramUserId) => { const { data, error } = await getClient().from("bot_broadcasts").update({ status: "sending" }).eq("id", id).eq("owner_telegram_user_id", ownerTelegramUserId).eq("status", "draft").select("id"); throwIfError(error, "begin broadcast"); return Array.isArray(data) && data.length > 0; },
    completeBroadcast: async (id, ownerTelegramUserId, successCount, failureCount) => { const { data, error } = await getClient().from("bot_broadcasts").update({ status: "sent", success_count: successCount, failure_count: failureCount, completed_at: new Date().toISOString() }).eq("id", id).eq("owner_telegram_user_id", ownerTelegramUserId).eq("status", "sending").select("id"); throwIfError(error, "complete broadcast"); return Array.isArray(data) && data.length > 0; },
    getJudicialFolderContents: (folderId, page) => folderContents("judicial", folderId, page),
    beginJudicialSearch: chatId => beginSearch(chatId, "judicial"),
    consumeJudicialSearchQuery: (chatId, query) => consumeSearch(chatId, "judicial", query),
    searchJudicialSources: (sessionId, page) => searchSourceScope("judicial", sessionId, page, "judicial"),
    getLegislationFolderContents: (folderId, page) => folderContents("legislation", folderId, page),
    getYemeniLawsFolderContents: (folderId, page) => folderContents("yemeni_laws", folderId, page),
    getLegalFormsFolderContents: (folderId, page) => folderContents("legal_forms", folderId, page),
    getIllustratedLegalFormsFolderContents: (folderId, page) => Promise.resolve(getStaticIllustratedLegalFormsFolderContents(folderId, page)),
    getAllYemeniLawsFolderContents: (folderId, page) => folderContents("all_yemeni_laws", folderId, page),
    getFeaturedReferencesFolderContents: (folderId, page) => folderContents("featured_references", folderId, page),
    getImportantYemeniLawsFolderContents: (folderId, page) => folderContents("important_yemeni_laws", folderId, page),
    hasImportantYemeniLawsAccess: telegramUserId => hasScopedAccess(telegramUserId, "important_laws"),
    hasManagedMenuItemPremiumAccess: (telegramUserId, menuItemId) => hasScopedAccess(telegramUserId, "managed_menu", menuItemId),
    hasReferralPremiumAccess: (telegramUserId, scope) => hasScopedAccess(telegramUserId, scope),
    createReferral: async (referrerTelegramUserId, refereeTelegramUserId, refereeChatId) => { if (referrerTelegramUserId === refereeTelegramUserId) return "self_referral"; const referrer = await getClient().from("bot_subscribers").select("telegram_user_id").eq("telegram_user_id", referrerTelegramUserId).limit(1).maybeSingle(); throwIfError(referrer.error, "check referrer"); if (!referrer.data) return "referrer_not_found"; const existing = await getClient().from("bot_referrals").select("status").eq("referee_telegram_user_id", refereeTelegramUserId).limit(1).maybeSingle(); throwIfError(existing.error, "check referral"); if (existing.data) return "already_referred"; const { error } = await getClient().from("bot_referrals").insert({ referrer_telegram_user_id: referrerTelegramUserId, referee_telegram_user_id: refereeTelegramUserId, referee_chat_id: refereeChatId }); throwIfError(error, "create referral"); return "created"; },
    qualifyReferral: async refereeTelegramUserId => { const client = getClient(); const pending = await client.from("bot_referrals").select("id,referrer_telegram_user_id,referee_chat_id").eq("referee_telegram_user_id", refereeTelegramUserId).eq("status", "pending").limit(1).maybeSingle(); throwIfError(pending.error, "find referral"); if (!pending.data) return { qualified: false }; const referral = pending.data as any; const { data: updated, error: updateError } = await client.from("bot_referrals").update({ status: "qualified", qualified_at: new Date().toISOString() }).eq("id", referral.id).eq("status", "pending").select("id"); throwIfError(updateError, "qualify referral"); if (!Array.isArray(updated) || updated.length === 0) return { qualified: false }; const countResult = await client.from("bot_referrals").select("id", { count: "exact", head: true }).eq("referrer_telegram_user_id", referral.referrer_telegram_user_id).eq("status", "qualified"); throwIfError(countResult.error, "count referrals"); const qualifiedCount = Number(countResult.count ?? 0); if (qualifiedCount > 0 && qualifiedCount % 5 === 0) { const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); for (const scope of ["sharia_exams", "secondary_exams"] as AccessScope[]) { const { error } = await client.from("bot_referral_rewards").insert({ referrer_telegram_user_id: referral.referrer_telegram_user_id, qualified_count: qualifiedCount, access_scope: scope, access_expires_at: expiresAt }); throwIfError(error, "create referral reward"); const { error: accessError } = await client.from("bot_user_access").upsert({ telegram_user_id: referral.referrer_telegram_user_id, access_scope: scope, managed_menu_item_id: null, expires_at: expiresAt, updated_at: new Date().toISOString() }, { onConflict: "telegram_user_id,access_scope,managed_menu_item_id" }); throwIfError(accessError, "grant referral access"); } } const referrerSubscriber = await client.from("bot_subscribers").select("chat_id").eq("telegram_user_id", referral.referrer_telegram_user_id).limit(1).maybeSingle(); throwIfError(referrerSubscriber.error, "read referrer chat"); const referrerChatId = String((referrerSubscriber.data as { chat_id?: string } | null)?.chat_id ?? referral.referee_chat_id); return { qualified: true, event: { referrerChatId, qualifiedCount, remainingCount: Math.max(0, 5 - (qualifiedCount % 5 || 5)), rewardExpiresAt: qualifiedCount % 5 === 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined } }; },
    getReferralProgress: async telegramUserId => { const client = getClient(); const [qualified, pending, rewards] = await Promise.all([client.from("bot_referrals").select("id", { count: "exact", head: true }).eq("referrer_telegram_user_id", telegramUserId).eq("status", "qualified"), client.from("bot_referrals").select("id", { count: "exact", head: true }).eq("referrer_telegram_user_id", telegramUserId).eq("status", "pending"), client.from("bot_user_access").select("expires_at").eq("telegram_user_id", telegramUserId).in("access_scope", ["sharia_exams", "secondary_exams"]).not("expires_at", "is", null).gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(2)]); throwIfError(qualified.error, "count qualified referrals"); throwIfError(pending.error, "count pending referrals"); throwIfError(rewards.error, "read referral rewards"); const rewardDates = ((rewards.data ?? []) as Array<{ expires_at: string }>).map(row => dateValue(row.expires_at)); return { qualifiedCount: Number(qualified.count ?? 0), pendingCount: Number(pending.count ?? 0), remainingCount: Math.max(0, 5 - (Number(qualified.count ?? 0) % 5 || 5)), activeAccessExpiresAt: rewardDates[0] ?? null }; },
    listReferralHistory: async telegramUserId => { const { data, error } = await getClient().from("bot_referrals").select("id,status,created_at,qualified_at,rejected_at,rejection_reason").eq("referrer_telegram_user_id", telegramUserId).order("created_at", { ascending: false }).limit(50); throwIfError(error, "list referral history"); return ((data ?? []) as any[]).map(row => ({ id: Number(row.id), status: row.status, createdAt: dateValue(row.created_at), qualifiedAt: row.qualified_at ? dateValue(row.qualified_at) : null, rejectedAt: row.rejected_at ? dateValue(row.rejected_at) : null, rejectionReason: row.rejection_reason })); },
    createImportantYemeniLawsSubscriptionRequest: async (telegramUserId, chatId, profile) => { const accessScope = (profile?.accessScope ?? "important_laws") as string; const managedMenuItemId = Number.isInteger(profile?.managedMenuItemId) ? Number(profile?.managedMenuItemId) : null; const existing = await getClient().from("bot_subscription_requests").select("id").eq("telegram_user_id", telegramUserId).eq("access_scope", accessScope).eq("status", "pending").limit(1).maybeSingle(); throwIfError(existing.error, "check subscription request"); if (existing.data) return { id: Number((existing.data as any).id), created: false }; const { data, error } = await getClient().from("bot_subscription_requests").insert({ telegram_user_id: telegramUserId, chat_id: chatId, access_scope: accessScope, managed_menu_item_id: managedMenuItemId, telegram_username: profile?.username?.replace(/^@/, "").slice(0, 64) ?? null, telegram_first_name: profile?.firstName?.slice(0, 128) ?? null, telegram_last_name: profile?.lastName?.slice(0, 128) ?? null, payment_method: profile?.paymentMethod?.slice(0, 32) ?? null }).select("id").limit(1).maybeSingle(); throwIfError(error, "create subscription request"); return data ? { id: Number((data as any).id), created: true } : undefined; },
    approveImportantYemeniLawsSubscriptionRequest: async (requestId, ownerTelegramUserId) => { const client = getClient(); const pending = await client.from("bot_subscription_requests").select("id,telegram_user_id,chat_id,access_scope,managed_menu_item_id").eq("id", requestId).eq("status", "pending").limit(1).maybeSingle(); throwIfError(pending.error, "find subscription request"); if (!pending.data) return undefined; const request = pending.data as any; const { data, error } = await client.from("bot_subscription_requests").update({ status: "approved", reviewed_by: ownerTelegramUserId, reviewed_at: new Date().toISOString() }).eq("id", requestId).eq("status", "pending").select("id"); throwIfError(error, "approve subscription request"); if (!Array.isArray(data) || data.length === 0) return undefined; if (request.access_scope === "important_laws") await upsertScopedAccess(request.telegram_user_id, request.managed_menu_item_id ? "managed_menu" : "important_laws", ownerTelegramUserId, request.managed_menu_item_id ? Number(request.managed_menu_item_id) : null); else await upsertScopedAccess(request.telegram_user_id, request.access_scope as AccessScope, ownerTelegramUserId); return { telegramUserId: request.telegram_user_id, chatId: request.chat_id, accessScope: request.access_scope, managedMenuItemId: request.managed_menu_item_id ? Number(request.managed_menu_item_id) : null }; },
    rejectImportantYemeniLawsSubscriptionRequest: async (requestId, ownerTelegramUserId) => { const { data: pending, error: findError } = await getClient().from("bot_subscription_requests").select("id,telegram_user_id,chat_id,access_scope,managed_menu_item_id").eq("id", requestId).eq("status", "pending").limit(1).maybeSingle(); throwIfError(findError, "find subscription request"); if (!pending) return undefined; const { data, error } = await getClient().from("bot_subscription_requests").update({ status: "rejected", reviewed_by: ownerTelegramUserId, reviewed_at: new Date().toISOString() }).eq("id", requestId).eq("status", "pending").select("id"); throwIfError(error, "reject subscription request"); if (!Array.isArray(data) || data.length === 0) return undefined; const request = pending as any; return { telegramUserId: request.telegram_user_id, chatId: request.chat_id, accessScope: request.access_scope, managedMenuItemId: request.managed_menu_item_id ? Number(request.managed_menu_item_id) : null }; },
    listPendingImportantYemeniLawsSubscriptionRequests: async () => { const { data, error } = await getClient().from("bot_subscription_requests").select("id,telegram_user_id,chat_id,access_scope,managed_menu_item_id,telegram_username,telegram_first_name,telegram_last_name,payment_method,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(20); throwIfError(error, "list pending subscriptions"); return ((data ?? []) as any[]).map(row => ({ id: Number(row.id), telegramUserId: row.telegram_user_id, chatId: row.chat_id, accessScope: row.access_scope, managedMenuItemId: row.managed_menu_item_id ? Number(row.managed_menu_item_id) : null, telegramUsername: row.telegram_username, telegramFirstName: row.telegram_first_name, telegramLastName: row.telegram_last_name, paymentMethod: row.payment_method, createdAt: dateValue(row.created_at) })); },
    beginLegislationSearch: chatId => beginSearch(chatId, "legislation"),
    consumeLegislationSearchQuery: (chatId, query) => consumeSearch(chatId, "legislation", query),
    searchLegislationSources: (sessionId, page) => searchSourceScope("legislation", sessionId, page, "legislation"),
    beginAllYemeniLawsSearch: chatId => beginSearch(chatId, "all_yemeni_laws"),
    consumeAllYemeniLawsSearchQuery: (chatId, query) => consumeSearch(chatId, "all_yemeni_laws", query),
    searchAllYemeniLawsSources: (sessionId, page) => searchSourceScope("all_yemeni_laws", sessionId, page, "all_yemeni_laws"),
    beginLibrarySearch: chatId => beginSearch(chatId, "library"),
    consumeLibrarySearchQuery: (chatId, query) => consumeSearch(chatId, "library", query),
    searchLibrarySources: (sessionId, page) => searchSourceScope("library", sessionId, page, "judicial"),
    listExamForms: listSupabaseBotExamForms,
    listExamQuestions: listSupabaseBotExamQuestions,
    startExamSession: startSupabaseBotExamSession,
    getExamSession: getSupabaseBotExamSession,
    setExamActivePoll: setSupabaseBotExamActivePoll,
    getExamSessionByPoll: getSupabaseBotExamSessionByPoll,
    cancelExamSession: cancelSupabaseBotExamSession,
    resolveExamPoll: resolveSupabaseBotExamPoll,
    advanceExamWrittenQuestion: advanceSupabaseBotExamWrittenQuestion,
    getExamResultSummary: getSupabaseBotExamResultSummary,
    getGroupExamWaitingRound: async (chatId, subjectKey, sectionKey) => { const { data, error } = await getClient().from("bot_group_exam_rounds").select("id,chat_id,creator_telegram_user_id,subject_key,section_key,status,question_index,time_limit_seconds,active_poll_id,started_at").eq("chat_id", chatId).eq("subject_key", subjectKey).eq("section_key", sectionKey).eq("status", "waiting").order("updated_at", { ascending: false }).limit(1).maybeSingle(); throwIfError(error, "find waiting group round"); return data ? mapRound(data) : undefined; },
    createGroupExamRound: async input => { const existing = await store.getGroupExamWaitingRound(input.chatId, input.subjectKey, input.sectionKey); if (existing) return { round: existing, created: false }; const { data, error } = await getClient().from("bot_group_exam_rounds").insert({ chat_id: input.chatId, creator_telegram_user_id: input.creatorTelegramUserId, subject_key: input.subjectKey, section_key: input.sectionKey, time_limit_seconds: input.timeLimitSeconds }).select("id,chat_id,creator_telegram_user_id,subject_key,section_key,status,question_index,time_limit_seconds,active_poll_id,started_at").limit(1).maybeSingle(); throwIfError(error, "create group round"); return data ? { round: mapRound(data), created: true } : undefined; },
    joinGroupExamRound: async input => { const client = getClient(); const round = await getRoundById(input.roundId); if (!round || round.status !== "waiting") return undefined; const { data: existing, error: existingError } = await client.from("bot_group_exam_participants").select("telegram_user_id").eq("round_id", input.roundId).eq("telegram_user_id", input.telegramUserId).limit(1).maybeSingle(); throwIfError(existingError, "check group participant"); if (!existing) { const { error } = await client.from("bot_group_exam_participants").insert({ round_id: input.roundId, telegram_user_id: input.telegramUserId, display_name: input.displayName.slice(0, 128), username: input.username?.slice(0, 64) ?? null }); throwIfError(error, "join group round"); } const { count, error: countError } = await client.from("bot_group_exam_participants").select("telegram_user_id", { count: "exact", head: true }).eq("round_id", input.roundId); throwIfError(countError, "count group participants"); return { round, participantCount: Number(count ?? 0), joined: !existing }; },
    activateGroupExamRound: async roundId => { const { data, error } = await getClient().from("bot_group_exam_rounds").update({ status: "active", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", roundId).eq("status", "waiting").select("id,chat_id,creator_telegram_user_id,subject_key,section_key,status,question_index,time_limit_seconds,active_poll_id,started_at").limit(1).maybeSingle(); throwIfError(error, "activate group round"); return data ? mapRound(data) : undefined; },
    getGroupExamRound: getRoundById,
    cancelGroupExamRound: async roundId => { const { data, error } = await getClient().from("bot_group_exam_rounds").update({ status: "cancelled", active_poll_id: null, updated_at: new Date().toISOString() }).eq("id", roundId).in("status", ["waiting", "active"]).select("id"); throwIfError(error, "cancel group round"); return Array.isArray(data) && data.length > 0; },
    setGroupExamActivePoll: async input => { const { data, error } = await getClient().from("bot_group_exam_rounds").update({ active_poll_id: input.pollId, question_index: input.questionIndex, updated_at: new Date().toISOString() }).eq("id", input.roundId).eq("status", "active").select("id"); throwIfError(error, "set group poll"); return Array.isArray(data) && data.length > 0; },
    getGroupExamRoundByPoll: async pollId => { const { data, error } = await getClient().from("bot_group_exam_rounds").select("id,chat_id,creator_telegram_user_id,subject_key,section_key,status,question_index,time_limit_seconds,active_poll_id,started_at").eq("active_poll_id", pollId).eq("status", "active").limit(1).maybeSingle(); throwIfError(error, "find group poll"); return data ? mapRound(data) : undefined; },
    recordGroupExamAnswer: async input => { const round = await store.getGroupExamRoundByPoll(input.pollId); if (!round) return false; const { error } = await getClient().from("bot_group_exam_answers").upsert({ round_id: round.id, poll_id: input.pollId, telegram_user_id: input.telegramUserId, answer: input.answer }, { onConflict: "round_id,poll_id,telegram_user_id" }); throwIfError(error, "record group answer"); return true; },
    resolveGroupExamPoll: async pollId => { const round = await store.getGroupExamRoundByPoll(pollId); if (!round) return undefined; const questions = await listSupabaseBotExamQuestions(round.subjectKey, round.sectionKey); const question = questions[round.questionIndex]; if (!question) return undefined; const answers = await getClient().from("bot_group_exam_answers").select("telegram_user_id,answer").eq("round_id", round.id).eq("poll_id", pollId).limit(1000); throwIfError(answers.error, "read group answers"); const participants = await getClient().from("bot_group_exam_participants").select("telegram_user_id,score,incorrect_count,missed_count").eq("round_id", round.id).limit(100); throwIfError(participants.error, "read group participants"); const participantRows = (participants.data ?? []) as any[]; const answerRows = (answers.data ?? []) as Array<{ telegram_user_id: string; answer: string }>; const byUser = new Map(answerRows.map(row => [row.telegram_user_id, row.answer])); let correctCount = 0; let incorrectCount = 0; let missedCount = 0; for (const participant of participantRows) { const answer = byUser.get(participant.telegram_user_id); const isCorrect = answer === question.correctOption; if (!answer) missedCount += 1; else if (isCorrect) correctCount += 1; else incorrectCount += 1; const patch = { score: Number(participant.score) + (isCorrect ? 1 : 0), incorrect_count: Number(participant.incorrect_count) + (!isCorrect && answer ? 1 : 0), missed_count: Number(participant.missed_count) + (!answer ? 1 : 0) }; const { error } = await getClient().from("bot_group_exam_participants").update(patch).eq("round_id", round.id).eq("telegram_user_id", participant.telegram_user_id); throwIfError(error, "update group score"); } const nextQuestionIndex = round.questionIndex + 1; const completed = nextQuestionIndex >= questions.length; const { error: roundError } = await getClient().from("bot_group_exam_rounds").update({ question_index: nextQuestionIndex, active_poll_id: null, status: completed ? "completed" : "active", updated_at: new Date().toISOString() }).eq("id", round.id); throwIfError(roundError, "advance group round"); const result: TelegramGroupExamPollResolution = { question, correctCount, incorrectCount, missedCount, participantCount: participantRows.length, nextQuestionIndex, total: questions.length, completed }; return result; },
    getGroupExamLeaderboard: async roundId => { const { data, error } = await getClient().from("bot_group_exam_participants").select("telegram_user_id,display_name,score,incorrect_count,missed_count").eq("round_id", roundId).order("score", { ascending: false }).order("incorrect_count", { ascending: true }).order("missed_count", { ascending: true }).limit(100); throwIfError(error, "group leaderboard"); return ((data ?? []) as any[]).map(row => ({ telegramUserId: row.telegram_user_id, displayName: row.display_name, score: Number(row.score), incorrectCount: Number(row.incorrect_count), missedCount: Number(row.missed_count) })) as TelegramGroupExamParticipantRecord[]; },
  };
  return store;
}

function mapManagedMenuItem(row: any): TelegramManagedMenuItemRecord {
  return { id: Number(row.id), label: String(row.label ?? ""), actionType: row.action_type, actionValue: String(row.action_value ?? ""), rowIndex: Number(row.row_index ?? 0), sortOrder: Number(row.sort_order ?? 0), accessMode: row.access_mode };
}
function mapManagedSection(row: any): TelegramManagedSectionRecord {
  return { sectionKey: String(row.section_key), displayLabel: String(row.display_label ?? ""), enabled: Boolean(row.enabled), accessMode: row.access_mode, sortOrder: Number(row.sort_order ?? 0) };
}
function mapManagedMessage(row: any): TelegramManagedMessageRecord {
  return { messageKey: row.message_key, content: String(row.content ?? "") };
}

export async function listSupabaseBotManagedMenuItems(includeDisabled = false): Promise<TelegramManagedMenuItemRecord[]> {
  let query = getClient().from("bot_managed_menu_items").select("id,label,action_type,action_value,row_index,sort_order,access_mode,enabled").order("row_index", { ascending: true }).order("sort_order", { ascending: true }).order("id", { ascending: true }).limit(200);
  if (!includeDisabled) query = query.eq("enabled", true);
  const { data, error } = await query;
  throwIfError(error, "list managed menu items");
  return ((data ?? []) as any[]).map(mapManagedMenuItem);
}

export async function createSupabaseBotManagedMenuItem(input: any, adminUserId: string): Promise<TelegramManagedMenuItemRecord | undefined> {
  const label = typeof input?.label === "string" ? input.label.trim().slice(0, 255) : "";
  const actionType = input?.actionType;
  const actionValue = typeof input?.actionValue === "string" ? input.actionValue.trim().slice(0, 4000) : "";
  if (!label || !["url", "message", "file"].includes(actionType) || !actionValue) return undefined;
  const payload = { label, action_type: actionType, action_value: actionValue, row_index: Number.isInteger(input?.rowIndex) ? input.rowIndex : 0, sort_order: Number.isInteger(input?.sortOrder) ? input.sortOrder : 0, access_mode: ["free", "premium", "hasad"].includes(input?.accessMode) ? input.accessMode : "free", enabled: input?.enabled !== false };
  const { data, error } = await getClient().from("bot_managed_menu_items").insert(payload).select("id,label,action_type,action_value,row_index,sort_order,access_mode,enabled").limit(1).maybeSingle();
  throwIfError(error, "create managed menu item");
  if (!data) return undefined;
  await recordSupabaseBotAdminAudit(adminUserId, "create", "managed_menu_item", Number((data as any).id), payload);
  return mapManagedMenuItem(data);
}

export async function updateSupabaseBotManagedMenuItem(id: number, input: any, adminUserId: string): Promise<TelegramManagedMenuItemRecord | undefined> {
  if (!Number.isInteger(id) || id < 1) return undefined;
  const patch: any = {};
  if (typeof input?.label === "string" && input.label.trim()) patch.label = input.label.trim().slice(0, 255);
  if (["url", "message", "file"].includes(input?.actionType)) patch.action_type = input.actionType;
  if (typeof input?.actionValue === "string" && input.actionValue.trim()) patch.action_value = input.actionValue.trim().slice(0, 4000);
  if (Number.isInteger(input?.rowIndex)) patch.row_index = input.rowIndex;
  if (Number.isInteger(input?.sortOrder)) patch.sort_order = input.sortOrder;
  if (["free", "premium", "hasad"].includes(input?.accessMode)) patch.access_mode = input.accessMode;
  if (typeof input?.enabled === "boolean") patch.enabled = input.enabled;
  if (Object.keys(patch).length === 0) return undefined;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await getClient().from("bot_managed_menu_items").update(patch).eq("id", id).select("id,label,action_type,action_value,row_index,sort_order,access_mode,enabled").limit(1).maybeSingle();
  throwIfError(error, "update managed menu item");
  if (!data) return undefined;
  await recordSupabaseBotAdminAudit(adminUserId, "update", "managed_menu_item", id, patch);
  return mapManagedMenuItem(data);
}

export async function deleteSupabaseBotManagedMenuItem(id: number, adminUserId: string): Promise<boolean> {
  const { data, error } = await getClient().from("bot_managed_menu_items").delete().eq("id", id).select("id");
  throwIfError(error, "delete managed menu item");
  if (!Array.isArray(data) || data.length === 0) return false;
  await recordSupabaseBotAdminAudit(adminUserId, "delete", "managed_menu_item", id, {});
  return true;
}

export async function listSupabaseBotManagedSections(): Promise<TelegramManagedSectionRecord[]> {
  const { data, error } = await getClient().from("bot_managed_sections").select("section_key,display_label,enabled,access_mode,sort_order").order("sort_order", { ascending: true }).limit(100);
  throwIfError(error, "list managed sections");
  return ((data ?? []) as any[]).map(mapManagedSection);
}
export async function updateSupabaseBotManagedSection(sectionKey: string, input: any, adminUserId: string): Promise<TelegramManagedSectionRecord | undefined> {
  const key = sectionKey.trim().slice(0, 64);
  if (!key) return undefined;
  const payload = { section_key: key, display_label: typeof input?.displayLabel === "string" && input.displayLabel.trim() ? input.displayLabel.trim().slice(0, 255) : key, enabled: input?.enabled !== false, access_mode: ["subscription", "free", "premium", "hasad"].includes(input?.accessMode) ? input.accessMode : "premium", sort_order: Number.isInteger(input?.sortOrder) ? input.sortOrder : 0, updated_at: new Date().toISOString() };
  const { data, error } = await getClient().from("bot_managed_sections").upsert(payload, { onConflict: "section_key" }).select("section_key,display_label,enabled,access_mode,sort_order").limit(1).maybeSingle();
  throwIfError(error, "update managed section");
  if (!data) return undefined;
  await recordSupabaseBotAdminAudit(adminUserId, "update", "managed_section", key, payload);
  return mapManagedSection(data);
}
export async function listSupabaseBotManagedMessages(): Promise<TelegramManagedMessageRecord[]> {
  const { data, error } = await getClient().from("bot_managed_messages").select("message_key,content").order("message_key", { ascending: true }).limit(20);
  throwIfError(error, "list managed messages");
  return ((data ?? []) as any[]).map(mapManagedMessage);
}
export async function updateSupabaseBotManagedMessage(messageKey: string, content: unknown, adminUserId: string): Promise<TelegramManagedMessageRecord | undefined> {
  if (!["welcome", "about", "help"].includes(messageKey) || typeof content !== "string" || !content.trim()) return undefined;
  const payload = { message_key: messageKey, content: content.trim().slice(0, 4000), updated_at: new Date().toISOString() };
  const { data, error } = await getClient().from("bot_managed_messages").upsert(payload, { onConflict: "message_key" }).select("message_key,content").limit(1).maybeSingle();
  throwIfError(error, "update managed message");
  if (!data) return undefined;
  await recordSupabaseBotAdminAudit(adminUserId, "update", "managed_message", messageKey, payload);
  return mapManagedMessage(data);
}
export async function listSupabaseBotBroadcasts(limit = 20): Promise<any[]> {
  const { data, error } = await getClient().from("bot_broadcasts").select("id,kind,message,status,recipient_count,success_count,failure_count,created_at,completed_at").order("created_at", { ascending: false }).limit(Math.max(1, Math.min(100, limit)));
  throwIfError(error, "list broadcasts");
  return ((data ?? []) as any[]).map(row => ({ id: Number(row.id), kind: row.kind, message: row.message, status: row.status, recipientCount: Number(row.recipient_count ?? 0), successCount: Number(row.success_count ?? 0), failureCount: Number(row.failure_count ?? 0), createdAt: dateValue(row.created_at), completedAt: row.completed_at ? dateValue(row.completed_at) : null }));
}
export async function listSupabaseBotAdminAuditLogs(limit = 100): Promise<any[]> {
  const { data, error } = await getClient().from("bot_admin_audit_logs").select("id,admin_user_id,action,entity_type,entity_id,details,created_at").order("created_at", { ascending: false }).limit(Math.max(1, Math.min(200, limit)));
  throwIfError(error, "list admin audit logs");
  return ((data ?? []) as any[]).map(row => ({ id: Number(row.id), adminUserId: row.admin_user_id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, details: row.details, createdAt: dateValue(row.created_at) }));
}
export async function recordSupabaseBotAdminAudit(adminUserId: string, action: string, entityType: string, entityId: number | string | null, details: Record<string, unknown> = {}): Promise<void> {
  const { error } = await getClient().from("bot_admin_audit_logs").insert({ admin_user_id: adminUserId, action, entity_type: entityType, entity_id: entityId === null ? null : String(entityId), details });
  throwIfError(error, "record admin audit");
}

export async function confirmSupabaseBotPlatformAccess(telegramUserId: string, region?: string | null): Promise<void> {
  const { error } = await getClient().from("bot_platform_access").upsert({ telegram_user_id: telegramUserId, confirmed_at: new Date().toISOString(), web_app_verified_at: new Date().toISOString(), region: region ?? null }, { onConflict: "telegram_user_id" });
  throwIfError(error, "confirm platform access");
}

export async function confirmSupabaseBotHasadAccess(telegramUserId: string, region?: string | null): Promise<void> {
  const { error } = await getClient().from("bot_hasad_access").upsert({ telegram_user_id: telegramUserId, visited_at: new Date().toISOString(), region: region ?? null }, { onConflict: "telegram_user_id" });
  throwIfError(error, "confirm Hasad access");
}
