import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TelegramLibraryStore } from "./telegram";
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

function client(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function throwIfError(error: { message?: string } | null, operation: string): void {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message ?? "unknown error"}`);
}

async function hasAccess(table: "bot_platform_access" | "bot_hasad_access", telegramUserId: string): Promise<boolean> {
  const { data, error } = await client().from(table).select("telegram_user_id").eq("telegram_user_id", telegramUserId).limit(1).maybeSingle();
  throwIfError(error, `check ${table}`);
  return Boolean(data);
}

const emptyArrayMethods = new Set([
  "listSourcesByCategory", "searchSources", "listFavorites", "listRecentSources", "listFeaturedSources", "listPopularSources",
  "listContractTemplates", "listContractTemplateTypes", "listContractTemplatesByType", "listLegislationSourcesByType", "listLegislationYears", "listLegislationSourcesByYear",
  "listNewSupportRequests", "listReferralHistory", "listPendingImportantYemeniLawsSubscriptionRequests", "getGroupExamLeaderboard",
]);

export function createSupabaseBotStore(): TelegramLibraryStore {
  const base: Partial<TelegramLibraryStore> = {
    hasConfirmedPlatformAccess: telegramUserId => hasAccess("bot_platform_access", telegramUserId),
    hasConfirmedHasadAccess: telegramUserId => hasAccess("bot_hasad_access", telegramUserId),
    listManagedMenuItems: async () => [],
    listManagedSections: async () => [],
    listManagedMessages: async () => [],
    listSourcesByCategory: async () => ({ sources: [], total: 0 }),
    searchSources: async () => [],
    getSource: async () => undefined,
    saveFavorite: async () => "unavailable",
    listFavorites: async () => [],
    removeFavorite: async () => false,
    listRecentSources: async () => [],
    listFeaturedSources: async () => [],
    listPopularSources: async () => [],
    listContractTemplates: async () => ({ templates: [], total: 0 }),
    listContractTemplateTypes: async () => [],
    listContractTemplatesByType: async () => ({ templates: [], total: 0 }),
    getContractTemplate: async () => undefined,
    beginContractTemplateSearch: async () => undefined,
    consumeContractTemplateSearchQuery: async () => undefined,
    searchContractTemplates: async () => undefined,
    listLegislationSourcesByType: async () => ({ sources: [], total: 0 }),
    listLegislationYears: async () => [],
    listLegislationSourcesByYear: async () => ({ sources: [], total: 0 }),
    recordUsage: async (telegramUserId, eventType, options) => {
      const { error } = await client().from("bot_usage_events").insert({ telegram_user_id: telegramUserId, event_type: eventType, section_key: options?.sectionKey ?? null, query: options?.query ?? null, source_id: options?.sourceId ?? null });
      throwIfError(error, "record usage");
    },
    createSupportRequest: async (telegramUserId, chatId, message) => {
      const { error } = await client().from("bot_support_requests").insert({ telegram_user_id: telegramUserId, chat_id: chatId, message });
      throwIfError(error, "create support request");
    },
    getOwnerStatistics: async () => ({ totalEvents: 0, totalSupportRequests: 0, topQueries: [] }),
    listNewSupportRequests: async () => [],
    registerSubscriber: async (chatId, telegramUserId, profile) => {
      const { error } = await client().from("bot_subscribers").upsert({ chat_id: chatId, telegram_user_id: telegramUserId, telegram_username: profile?.telegramUsername ?? null, telegram_first_name: profile?.telegramFirstName ?? null, telegram_last_name: profile?.telegramLastName ?? null, last_seen_at: new Date().toISOString() }, { onConflict: "chat_id" });
      throwIfError(error, "register subscriber");
      return true;
    },
    listSubscriberChatIds: async () => {
      const { data, error } = await client().from("bot_subscribers").select("chat_id").limit(10000);
      throwIfError(error, "list subscribers");
      return ((data ?? []) as Array<{ chat_id: string }>).map(row => row.chat_id);
    },
    createBroadcastDraft: async () => undefined,
    getBroadcastDraft: async () => undefined,
    cancelBroadcastDraft: async () => false,
    beginBroadcast: async () => false,
    completeBroadcast: async () => false,
    getJudicialFolderContents: async () => ({ folder: undefined, folders: [], sources: [], totalSources: 0 }),
    beginJudicialSearch: async () => undefined,
    consumeJudicialSearchQuery: async () => undefined,
    searchJudicialSources: async () => undefined,
    getLegislationFolderContents: async () => ({ folder: undefined, folders: [], sources: [], totalSources: 0 }),
    getYemeniLawsFolderContents: async () => ({ folder: undefined, folders: [], sources: [], totalSources: 0 }),
    getLegalFormsFolderContents: async () => ({ folder: undefined, folders: [], sources: [], totalSources: 0 }),
    getIllustratedLegalFormsFolderContents: async () => ({ folder: undefined, folders: [], sources: [], totalSources: 0 }),
    getAllYemeniLawsFolderContents: async () => ({ folder: undefined, folders: [], sources: [], totalSources: 0 }),
    getFeaturedReferencesFolderContents: async () => ({ folder: undefined, folders: [], sources: [], totalSources: 0 }),
    getImportantYemeniLawsFolderContents: async () => ({ folder: undefined, folders: [], sources: [], totalSources: 0 }),
    hasImportantYemeniLawsAccess: async () => false,
    hasManagedMenuItemPremiumAccess: async () => false,
    hasReferralPremiumAccess: async () => false,
    createReferral: async () => "unavailable",
    qualifyReferral: async () => ({ qualified: false }),
    getReferralProgress: async () => ({ qualifiedCount: 0, pendingCount: 0, remainingCount: 3, activeAccessExpiresAt: null }),
    createImportantYemeniLawsSubscriptionRequest: async () => undefined,
    approveImportantYemeniLawsSubscriptionRequest: async () => undefined,
    rejectImportantYemeniLawsSubscriptionRequest: async () => undefined,
    beginLegislationSearch: async () => undefined,
    consumeLegislationSearchQuery: async () => undefined,
    searchLegislationSources: async () => undefined,
    beginAllYemeniLawsSearch: async () => undefined,
    consumeAllYemeniLawsSearchQuery: async () => undefined,
    searchAllYemeniLawsSources: async () => undefined,
    beginLibrarySearch: async () => undefined,
    consumeLibrarySearchQuery: async () => undefined,
    searchLibrarySources: async () => undefined,
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
    getGroupExamWaitingRound: async () => undefined,
    createGroupExamRound: async () => undefined,
    joinGroupExamRound: async () => undefined,
    activateGroupExamRound: async () => undefined,
    getGroupExamRound: async () => undefined,
    cancelGroupExamRound: async () => false,
    setGroupExamActivePoll: async () => false,
    getGroupExamRoundByPoll: async () => undefined,
    recordGroupExamAnswer: async () => false,
    resolveGroupExamPoll: async () => undefined,
  };

  return new Proxy(base as TelegramLibraryStore, {
    get(target, property: string | symbol, receiver) {
      if (property in target) return Reflect.get(target, property, receiver);
      if (typeof property !== "string") return undefined;
      if (emptyArrayMethods.has(property)) return async () => [];
      return async () => undefined;
    },
  });
}

export async function confirmSupabaseBotPlatformAccess(telegramUserId: string, region?: string | null): Promise<void> {
  const { error } = await client().from("bot_platform_access").upsert({ telegram_user_id: telegramUserId, confirmed_at: new Date().toISOString(), web_app_verified_at: new Date().toISOString(), region: region ?? null }, { onConflict: "telegram_user_id" });
  throwIfError(error, "confirm platform access");
}

export async function confirmSupabaseBotHasadAccess(telegramUserId: string, region?: string | null): Promise<void> {
  const { error } = await client().from("bot_hasad_access").upsert({ telegram_user_id: telegramUserId, visited_at: new Date().toISOString(), region: region ?? null }, { onConflict: "telegram_user_id" });
  throwIfError(error, "confirm Hasad access");
}
