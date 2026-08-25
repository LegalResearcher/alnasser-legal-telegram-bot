import { describe, expect, it } from "vitest";
import type { LegalFolder, LegalSource, TelegramContractTemplate } from "../drizzle/schema";
import type { TelegramContentStatistics } from "./telegram";
import { approximateArabicMatchScore, fallbackJudicialSearchResults, normalizeArabicSearch } from "./db";
import { BOT_COMMANDS, buttonLabel, canDeliverDocumentSource, createTelegramSender, documentFilename, driveDownloadUrl, FileDeliveryError, handleTelegramUpdate, highlightSearchTerm, isFinalTelegramWebhookUrl, isTelegramOwner, OWNER_COMMANDS, synchronizeTelegramConfiguration, type TelegramDocumentProvider, type TelegramLibraryStore, type TelegramSender } from "./telegram";
import { examPollOptionText, TELEGRAM_EXAM_CATALOG } from "./telegramExam";

const sampleSource: LegalSource = {
  id: 7,
  category: "civil",
  collection: "judicial",
  sortOrder: 1,
  driveFileId: "file-7",
  driveFolderId: "folder-civil",
  folderSortOrder: 1,
  title: "مبادئ القانون المدني",
  description: "مرجع موجز في المبادئ العامة للقانون المدني.",
  url: "https://example.com/civil-law",
  documentType: "other",
  legislationYear: null,
  issuingAuthority: null,
  isFeatured: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const judicialRoot: LegalFolder = {
  id: 1,
  driveFolderId: "13jDFI3IkNoK1kAyifU1KODZ0_j6DGpoq",
  parentDriveFolderId: null,
  collection: "judicial",
  name: "قواعد قضائية",
  path: "قواعد قضائية",
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const judicialChild: LegalFolder = {
  ...judicialRoot,
  id: 2,
  driveFolderId: "folder-civil",
  parentDriveFolderId: judicialRoot.driveFolderId,
  name: "الأحكام المدنية",
  path: "قواعد قضائية / الأحكام المدنية",
};

const legislationRoot: LegalFolder = {
  id: 3,
  driveFolderId: "1bEkLg2uaeQOULqZi6yIEfU0aKtMMB3J4",
  parentDriveFolderId: null,
  collection: "legislation",
  name: "التشريعات اليمنية",
  path: "التشريعات اليمنية",
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const yemeniLawsRoot: LegalFolder = {
  ...legislationRoot,
  id: 4,
  driveFolderId: "15ZWnJtqszUggVJcQVsyyfZZRXGtUgK0J",
  parentDriveFolderId: "important-yemeni-laws-interactive",
  collection: "important_yemeni_laws",
  name: "القوانين اليمنية فهرس تفاعلي",
  path: "أهم القوانين اليمنية التفاعلي / القوانين اليمنية فهرس تفاعلي",
};

const legalFormsRoot: LegalFolder = {
  ...legislationRoot,
  id: 5,
  driveFolderId: "1ABgTWPMDWPgj1HmFkRaV9rnTDU4kZ4h9",
  collection: "legal_forms",
  name: "نماذج وصيغ قانونية",
  path: "نماذج وصيغ قانونية",
};

const illustratedLegalFormsRoot: LegalFolder = {
  ...legislationRoot,
  id: 15,
  driveFolderId: "17Yx06hL5bJXp2i80qW39n7yys3MqqztT",
  collection: "illustrated_legal_forms",
  name: "نماذج مصورة وفق القوانين اليمنية",
  path: "نماذج مصورة وفق القوانين اليمنية",
};

const allYemeniLawsRoot: LegalFolder = {
  ...legislationRoot,
  id: 16,
  driveFolderId: "all-yemeni-laws-root",
  collection: "all_yemeni_laws",
  name: "جميع القوانين اليمنية",
  path: "جميع القوانين اليمنية",
};

const featuredReferencesRoot: LegalFolder = {
  ...legislationRoot,
  id: 6,
  driveFolderId: "17QASX45F7JlN4EIYICMUHN2NtfsEvuIu",
  collection: "featured_references",
  name: "مراجع مميزة",
  path: "مراجع مميزة",
};

const importantYemeniLawsRoot: LegalFolder = {
  ...legislationRoot,
  id: 7,
  driveFolderId: "important-yemeni-laws-interactive",
  collection: "important_yemeni_laws",
  name: "أهم القوانين اليمنية التفاعلي",
  path: "أهم القوانين اليمنية التفاعلي",
};

const legislationSource: LegalSource = {
  ...sampleSource,
  id: 8,
  collection: "legislation",
  sortOrder: 1,
  driveFileId: "legislation-file-8",
  driveFolderId: legislationRoot.driveFolderId,
  folderSortOrder: 1,
  title: "قانون التحكيم اليمني.pdf",
  description: "تشريع يمني مستورد من فهرس التشريعات اليمنية.",
  url: "https://example.com/yemen-arbitration-law",
  documentType: "law",
  legislationYear: 2002,
  issuingAuthority: "الجمهورية اليمنية",
};

const yemeniLawsSource: LegalSource = {
  ...legislationSource,
  id: 9,
  collection: "important_yemeni_laws",
  driveFileId: "yemeni-laws-file-9",
  driveFolderId: yemeniLawsRoot.driveFolderId,
  title: "قانون الإجراءات الجزائية اليمني.pdf",
  url: "https://example.com/yemeni-criminal-procedure-law",
};

const legalFormsSource: LegalSource = {
  ...sampleSource,
  id: 10,
  collection: "legal_forms",
  driveFileId: "legal-forms-file-10",
  driveFolderId: legalFormsRoot.driveFolderId,
  folderSortOrder: 1,
  title: "24مذكره_بالرد_على_اسباب_الطعن_بالنقض_ايجارات (1).doc",
  description: "نموذج قانوني مستورد من فهرس النماذج والصيغ القانونية.",
  url: "https://example.com/legal-form",
};

const illustratedLegalFormsSource: LegalSource = {
  ...sampleSource,
  id: 13,
  collection: "illustrated_legal_forms",
  driveFileId: "1RCXV8qFSDHqIg80w1h1mu5op7gm83tUN",
  driveFolderId: illustratedLegalFormsRoot.driveFolderId,
  folderSortOrder: 1,
  title: "استئناف.pdf",
  description: "مستورد من مكتبة أ. معين الناصر: نماذج مصورة وفق القوانين اليمنية.",
  url: "https://example.com/illustrated-appeal-form",
};

const allYemeniLawsSource: LegalSource = {
  ...sampleSource,
  id: 14,
  collection: "all_yemeni_laws",
  driveFileId: "static:yemeni-laws:Yemeni_Laws2.pdf",
  driveFolderId: allYemeniLawsRoot.driveFolderId,
  folderSortOrder: 1,
  title: "قانون الإجراءات الجزائية: قرار جمهوري بالقانون رقم 13 لسنة 1994",
  description: "مستورد من مكتبة أ. معين الناصر: جميع القوانين اليمنية.",
  url: "/manus-storage/Yemeni_Laws2_0362c915.pdf",
};

const featuredReferenceSource: LegalSource = {
  ...sampleSource,
  id: 11,
  collection: "featured_references",
  driveFileId: "featured-reference-file-11",
  driveFolderId: featuredReferencesRoot.driveFolderId,
  folderSortOrder: 1,
  title: "إصدار وصياغة الأحكام القضائية - الجنداري_تطبيق الباحث القانوني_أ.معين الناصر.pdf",
  description: "مرجع قانوني مميز مستورد من الفهرس المحدد.",
  url: "https://example.com/featured-reference",
};

const importantYemeniLawsSource: LegalSource = {
  ...sampleSource,
  id: 12,
  collection: "important_yemeni_laws",
  driveFileId: "important-yemeni-laws-file-12",
  driveFolderId: importantYemeniLawsRoot.driveFolderId,
  folderSortOrder: 1,
  title: "أهم القوانين اليمنية التفاعلي.doc",
  description: "مرجع خاص بالمشتركين المعتمدين في القسم المقيد.",
  url: "https://example.com/important-yemeni-laws",
};

const contractTemplate: TelegramContractTemplate = {
  id: 31,
  sourceDocumentId: 274,
  fileName: "١ - موافقة بالبناء",
  content: [{ type: "article", text: "نموذج موافقة بالبناء وفقًا للصيغة القانونية." }],
  sortOrder: 1,
  contractType: "civil",
  isPremium: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const leaseContractTemplate: TelegramContractTemplate = {
  ...contractTemplate,
  id: 32,
  sourceDocumentId: 275,
  fileName: "عقد_إيجار_محل.docx",
  sortOrder: 2,
  contractType: "commercial",
};

const laborContractTemplate: TelegramContractTemplate = {
  ...contractTemplate,
  id: 33,
  sourceDocumentId: 276,
  fileName: "عقد العمل (أجير خاص)",
  sortOrder: 3,
  contractType: "labor",
};

function createStore(
  platformConfirmed = true,
  initialImportantLawsAccess = false,
  options: { recentSources?: LegalSource[]; managedMenuItems?: Array<{ id: number; label: string; actionType: "url" | "message" | "file"; actionValue: string; rowIndex: number; sortOrder: number; accessMode?: "free" | "premium" | "hasad" }>; managedSections?: Array<{ sectionKey: string; displayLabel: string; enabled: boolean; accessMode?: "subscription" | "free" | "premium" | "hasad"; sortOrder: number }>; managedMessages?: Array<{ messageKey: "welcome" | "about" | "help"; content: string }>; contentStatistics?: TelegramContentStatistics; onUsage?: (eventType: string, options?: { query?: string; sourceId?: number; sectionKey?: string }) => void; referralPremiumAccess?: boolean; managedMenuPremiumAccess?: boolean; hasadConfirmed?: boolean; onReferralCreated?: (referrerTelegramUserId: string, refereeTelegramUserId: string, refereeChatId: string) => void; referralProgress?: { qualifiedCount: number; pendingCount: number; remainingCount: number; activeAccessExpiresAt: Date | null }; referralHistory?: Array<{ id: number; status: "pending" | "qualified" | "rejected"; createdAt: Date; qualifiedAt: Date | null; rejectionReason: string | null }>; secondaryQuranWrittenQuestion?: boolean } = {}
): TelegramLibraryStore {
  let confirmed = platformConfirmed;
  const hasadConfirmed = options.hasadConfirmed ?? true;
  let importantLawsAccess = initialImportantLawsAccess;
  let pendingImportantRequest: { id: number; telegramUserId: string; chatId: string; paymentMethod: string | null; createdAt: Date } | undefined;
  let awaitingContractTemplateSearch = false;
  let contractTemplateSearchQuery: string | undefined;
  const examQuestions = options.secondaryQuranWrittenQuestion ? [
    { id: 1, questionText: "سؤال موضوعي في القرآن الكريم", optionA: "الإجابة صحيحة", optionB: "الإجابة خاطئة", optionC: "", optionD: "", correctOption: "A" as const, explanation: "", hint: null, sortOrder: 1 },
    { id: 47, questionText: "اكتب (احفظ ورقة الأسئلة) من قوله تعالى: (يَا أَيُّهَا الَّذِينَ آمَنُوا لَا تَدْخُلُوا بُيُوتًا غَيْرَ بُيُوتِكُمْ) إلى قوله تعالى: (مَا تُبْدُونَ وَمَا تَكْتُمُونَ).", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "A" as const, explanation: "", hint: null, sortOrder: 47 },
  ] : [
    { id: 1, questionText: "ما المقصود بالملحقات؟", optionA: "المنتجات", optionB: "الثمار", optionC: "ما أعد بصفة دائمة لخدمة الشيء", optionD: "لا شيء مما سبق", correctOption: "C" as const, explanation: "الملحقات تعد بصفة دائمة لاستعمال الشيء المملوك وخدمته.", hint: "ركز على ما أُعد لخدمة الشيء بصورة دائمة.", sortOrder: 1 },
    { id: 2, questionText: "حق الشرب في القانون اليمني هو:", optionA: "قيد قانوني", optionB: "حق ارتفاق اتفاقي", optionC: "حق شخصي", optionD: "لا شيء مما سبق", correctOption: "B" as const, explanation: "ينشأ حق الشرب بالاتفاق بين الجيران.", hint: null, sortOrder: 2 },
  ];
  let examSession: { id: number; telegramUserId: string; chatId: string; subjectKey: string; sectionKey: string; status: "active" | "completed" | "cancelled"; questionIndex: number; score: number; incorrectCount: number; missedCount: number; timeLimitSeconds: number; activePollId: string | null; startedAt: Date } | undefined;
  let groupRound: { id: number; chatId: string; creatorTelegramUserId: string | null; subjectKey: string; sectionKey: string; status: "waiting" | "active" | "completed" | "cancelled"; questionIndex: number; timeLimitSeconds: number; activePollId: string | null; startedAt: Date | null } | undefined;
  const groupParticipants = new Map<string, { telegramUserId: string; displayName: string; score: number; incorrectCount: number; missedCount: number }>();
  const groupAnswers = new Map<string, "A" | "B" | "C" | "D">();
  const sources = [sampleSource, legislationSource, yemeniLawsSource, legalFormsSource, illustratedLegalFormsSource, allYemeniLawsSource, featuredReferenceSource, importantYemeniLawsSource];
  const favoriteSourceIds = new Map<string, number[]>();
  const registeredSubscriberChatIds = new Set<string>();
  return {
    hasConfirmedPlatformAccess: async () => confirmed,
    hasConfirmedHasadAccess: async () => hasadConfirmed,
    listManagedMenuItems: async () => options.managedMenuItems ?? [],
    listManagedSections: async () => options.managedSections ?? [],
    listManagedMessages: async () => options.managedMessages ?? [],
    listSourcesByCategory: async category => ({ sources: category === "civil" ? [sampleSource] : [], total: category === "civil" ? 1 : 0 }),
    searchSources: async query => (query.includes("مدني") ? [sampleSource] : []),
    getSource: async id => sources.find(source => source.id === id),
    saveFavorite: async (telegramUserId, sourceId) => {
      if (!sources.some(source => source.id === sourceId)) return "unavailable";
      const current = favoriteSourceIds.get(telegramUserId) ?? [];
      if (current.includes(sourceId)) return "exists";
      favoriteSourceIds.set(telegramUserId, [...current, sourceId]);
      return "added";
    },
    listFavorites: async telegramUserId => (favoriteSourceIds.get(telegramUserId) ?? [])
      .map(sourceId => sources.find(source => source.id === sourceId))
      .filter((source): source is LegalSource => Boolean(source))
      .map(source => ({ source })),
    removeFavorite: async (telegramUserId, sourceId) => {
      const current = favoriteSourceIds.get(telegramUserId) ?? [];
      if (!current.includes(sourceId)) return false;
      favoriteSourceIds.set(telegramUserId, current.filter(id => id !== sourceId));
      return true;
    },
    listRecentSources: async () => options.recentSources ?? [legislationSource],
    listFeaturedSources: async () => [sampleSource],
    listPopularSources: async () => [sampleSource],
    listContractTemplates: async page => ({ templates: page === 1 ? [contractTemplate, leaseContractTemplate, laborContractTemplate] : [], total: 3 }),
    listContractTemplateTypes: async () => [
      { contractType: "civil" as const, count: 1 },
      { contractType: "commercial" as const, count: 1 },
      { contractType: "labor" as const, count: 1 },
    ],
    listContractTemplatesByType: async contractType => ({
      templates: contractType === "civil" ? [contractTemplate] : contractType === "commercial" ? [leaseContractTemplate] : contractType === "labor" ? [laborContractTemplate] : [],
      total: ["civil", "commercial", "labor"].includes(contractType) ? 1 : 0,
    }),
    getContractTemplate: async id => id === contractTemplate.id ? contractTemplate : id === leaseContractTemplate.id ? leaseContractTemplate : id === laborContractTemplate.id ? laborContractTemplate : undefined,
    beginContractTemplateSearch: async () => {
      awaitingContractTemplateSearch = true;
      contractTemplateSearchQuery = undefined;
    },
    consumeContractTemplateSearchQuery: async (_chatId, query) => {
      if (!awaitingContractTemplateSearch || !query.trim()) return undefined;
      awaitingContractTemplateSearch = false;
      contractTemplateSearchQuery = query.trim();
      return { id: 81 };
    },
    searchContractTemplates: async sessionId => {
      if (sessionId !== 81 || !contractTemplateSearchQuery) return undefined;
      if (contractTemplateSearchQuery === "موافقه") return { query: contractTemplateSearchQuery, templates: [contractTemplate], total: 1, matchType: "approximate" as const };
      if (contractTemplateSearchQuery.includes("إيجار")) return { query: contractTemplateSearchQuery, templates: [leaseContractTemplate], total: 1, matchType: "exact" as const };
      return { query: contractTemplateSearchQuery, templates: [], total: 0, matchType: "exact" as const };
    },
    listLegislationSourcesByType: async documentType => ({ sources: documentType === "law" ? [legislationSource] : [], total: documentType === "law" ? 1 : 0 }),
    listLegislationYears: async () => [2002],
    listLegislationSourcesByYear: async year => ({ sources: year === 2002 ? [legislationSource] : [], total: year === 2002 ? 1 : 0 }),
    recordUsage: async (_telegramUserId, eventType, usageOptions) => { options.onUsage?.(eventType, usageOptions); },
    createSupportRequest: async () => undefined,
    getOwnerStatistics: async () => ({ totalEvents: 3, totalSupportRequests: 1, topQueries: [{ query: "مدني", count: 2 }] }),
    getContentStatistics: async () => options.contentStatistics ?? {
      questionCount: 1250,
      examFormCount: 42,
      examSubjectCount: 9,
      examLevelCount: 3,
      totalExams: 15233,
      userCount: 61900,
      libraryFileCount: 240,
      librarySectionsCount: 8,
      libraryFilesBySection: [{ label: "نماذج وصيغ قانونية", count: 217 }, { label: "نماذج مصورة", count: 17 }],
      lastUpdatedAt: new Date("2026-08-26T20:00:00.000Z"),
    },
    listNewSupportRequests: async () => [],
    registerSubscriber: async chatId => {
      const firstUse = !registeredSubscriberChatIds.has(chatId);
      registeredSubscriberChatIds.add(chatId);
      return firstUse;
    },
    listSubscriberChatIds: async () => [],
    createBroadcastDraft: async () => undefined,
    getBroadcastDraft: async () => undefined,
    cancelBroadcastDraft: async () => false,
    beginBroadcast: async () => false,
    completeBroadcast: async () => false,
    getJudicialFolderContents: async (folderId, page) => ({
      folder: folderId === judicialRoot.driveFolderId ? judicialRoot : folderId === judicialChild.driveFolderId ? judicialChild : undefined,
      folders: folderId === judicialRoot.driveFolderId ? [judicialChild] : [],
      sources: folderId === judicialChild.driveFolderId && page === 1 ? [sampleSource] : [],
      totalSources: folderId === judicialChild.driveFolderId ? 1 : 0,
    }),
    beginJudicialSearch: async () => undefined,
    consumeJudicialSearchQuery: async (_chatId, query) => (query.includes("مدني") ? { id: 25 } : undefined),
    searchJudicialSources: async (sessionId, page) => sessionId === 25 && page === 1 ? { query: "مدني", sources: [sampleSource], total: 1, matchType: "exact" } : undefined,
    getLegislationFolderContents: async (folderId, page) => ({
      folder: folderId === legislationRoot.driveFolderId ? legislationRoot : undefined,
      folders: [],
      sources: folderId === legislationRoot.driveFolderId && page === 1 ? [legislationSource] : [],
      totalSources: folderId === legislationRoot.driveFolderId ? 1 : 0,
    }),
    getYemeniLawsFolderContents: async (folderId, page) => ({
      folder: undefined,
      folders: [],
      sources: [],
      totalSources: 0,
    }),
    getLegalFormsFolderContents: async (folderId, page) => ({
      folder: folderId === legalFormsRoot.driveFolderId ? legalFormsRoot : undefined,
      folders: [],
      sources: folderId === legalFormsRoot.driveFolderId && page === 1 ? [legalFormsSource] : [],
      totalSources: folderId === legalFormsRoot.driveFolderId ? 1 : 0,
    }),
    getIllustratedLegalFormsFolderContents: async (folderId, page) => ({
      folder: folderId === illustratedLegalFormsRoot.driveFolderId ? illustratedLegalFormsRoot : undefined,
      folders: [],
      sources: folderId === illustratedLegalFormsRoot.driveFolderId && page === 1 ? [illustratedLegalFormsSource] : [],
      totalSources: folderId === illustratedLegalFormsRoot.driveFolderId ? 17 : 0,
    }),
    getAllYemeniLawsFolderContents: async (folderId, page) => ({
      folder: folderId === allYemeniLawsRoot.driveFolderId ? allYemeniLawsRoot : undefined,
      folders: [],
      sources: folderId === allYemeniLawsRoot.driveFolderId && page === 1 ? [allYemeniLawsSource] : [],
      totalSources: folderId === allYemeniLawsRoot.driveFolderId ? 146 : 0,
    }),
    getFeaturedReferencesFolderContents: async (folderId, page) => ({
      folder: folderId === featuredReferencesRoot.driveFolderId ? featuredReferencesRoot : undefined,
      folders: [],
      sources: folderId === featuredReferencesRoot.driveFolderId && page === 1 ? [featuredReferenceSource] : [],
      totalSources: folderId === featuredReferencesRoot.driveFolderId ? 1 : 0,
    }),
    getImportantYemeniLawsFolderContents: async (folderId, page) => ({
      folder: folderId === importantYemeniLawsRoot.driveFolderId ? importantYemeniLawsRoot : folderId === yemeniLawsRoot.driveFolderId ? yemeniLawsRoot : undefined,
      folders: folderId === importantYemeniLawsRoot.driveFolderId ? [yemeniLawsRoot] : [],
      sources: folderId === importantYemeniLawsRoot.driveFolderId && page === 1 ? [importantYemeniLawsSource] : folderId === yemeniLawsRoot.driveFolderId && page === 1 ? [yemeniLawsSource] : [],
      totalSources: folderId === importantYemeniLawsRoot.driveFolderId || folderId === yemeniLawsRoot.driveFolderId ? 1 : 0,
    }),
    hasImportantYemeniLawsAccess: async () => importantLawsAccess,
    hasReferralPremiumAccess: async () => options.referralPremiumAccess ?? true,
    hasManagedMenuItemPremiumAccess: async () => options.managedMenuPremiumAccess ?? false,
    createReferral: async (referrerTelegramUserId, refereeTelegramUserId, refereeChatId) => { options.onReferralCreated?.(referrerTelegramUserId, refereeTelegramUserId, refereeChatId); return "created"; },
    qualifyReferral: async () => ({ qualified: false }),
    getReferralProgress: async () => options.referralProgress ?? ({ qualifiedCount: 0, pendingCount: 0, remainingCount: 5, activeAccessExpiresAt: null }),
    listReferralHistory: async () => options.referralHistory ?? [],
    createImportantYemeniLawsSubscriptionRequest: async (telegramUserId, chatId, profile) => {
      if (pendingImportantRequest) return { id: pendingImportantRequest.id, created: false };
      pendingImportantRequest = { id: 1, telegramUserId, chatId, paymentMethod: profile?.paymentMethod ?? null, createdAt: new Date() };
      return { id: 1, created: true };
    },
    approveImportantYemeniLawsSubscriptionRequest: async requestId => {
      if (!pendingImportantRequest || requestId !== pendingImportantRequest.id) return undefined;
      importantLawsAccess = true;
      const request = pendingImportantRequest;
      pendingImportantRequest = undefined;
      return { telegramUserId: request.telegramUserId, chatId: request.chatId };
    },
    rejectImportantYemeniLawsSubscriptionRequest: async requestId => {
      if (!pendingImportantRequest || requestId !== pendingImportantRequest.id) return undefined;
      const request = pendingImportantRequest;
      pendingImportantRequest = undefined;
      return { telegramUserId: request.telegramUserId, chatId: request.chatId };
    },
    listPendingImportantYemeniLawsSubscriptionRequests: async () => pendingImportantRequest ? [pendingImportantRequest] : [],
    beginLegislationSearch: async () => undefined,
    consumeLegislationSearchQuery: async (_chatId, query) => (query.includes("تحكيم") ? { id: 26 } : undefined),
    searchLegislationSources: async (sessionId, page) => sessionId === 26 && page === 1 ? { query: "تحكيم", sources: [legislationSource], total: 1, matchType: "exact" } : undefined,
    beginAllYemeniLawsSearch: async () => undefined,
    consumeAllYemeniLawsSearchQuery: async (_chatId, query) => (query.includes("جزائية") ? { id: 28 } : undefined),
    searchAllYemeniLawsSources: async (sessionId, page) => sessionId === 28 && page === 1 ? { query: "جزائية", sources: [allYemeniLawsSource], total: 1, matchType: "exact" } : undefined,
    beginLibrarySearch: async () => undefined,
    consumeLibrarySearchQuery: async (_chatId, query) => (query.includes("مكتبة") ? { id: 27 } : undefined),
    searchLibrarySources: async (sessionId, page) => sessionId === 27 && page === 1 ? { query: "مكتبة", sources: [sampleSource], total: 1, matchType: "exact" } : undefined,
    listExamForms: async subjectKey => {
      const resolvedSubjectKey = subjectKey.startsWith("exam_secondary_literary_")
        ? subjectKey.replace("exam_secondary_literary_", "exam_secondary_")
        : subjectKey;
      return resolvedSubjectKey === "l1_usul_fiqh" ? [
      { formKey: "Model_1", formName: "الموازي2025", sortOrder: 1 },
      { formKey: "Model_2", formName: "القسم الأول", sortOrder: 2 },
      { formKey: "general_2022", formName: "العام 2022", sortOrder: 100 },
      { formKey: "general_2023", formName: "العام 2023", sortOrder: 101 },
      { formKey: "parallel_2023", formName: "الموازي 2023", sortOrder: 102 },
      { formKey: "general_2024", formName: "العام 2024", sortOrder: 103 },
      { formKey: "parallel_2024", formName: "الموازي 2024", sortOrder: 104 },
      { formKey: "general_2025", formName: "العام 2025", sortOrder: 105 },
      { formKey: "parallel_2025", formName: "الموازي 2025", sortOrder: 106 },
    ] : subjectKey === "l1_criminology" ? [
      { formKey: "Model_1", formName: "القسم الأول", sortOrder: 1 },
      { formKey: "general_2022", formName: "العام 2022", sortOrder: 100 },
      { formKey: "general_2023", formName: "العام 2023", sortOrder: 101 },
      { formKey: "parallel_2023", formName: "الموازي 2023", sortOrder: 102 },
      { formKey: "general_2024", formName: "العام 2024", sortOrder: 103 },
      { formKey: "parallel_2024", formName: "الموازي 2024", sortOrder: 104 },
      { formKey: "general_2025", formName: "العام 2025", sortOrder: 105 },
      { formKey: "parallel_2025", formName: "الموازي 2025", sortOrder: 106 },
      { formKey: "mixed_2025", formName: "المختلط 2025", sortOrder: 107 },
    ] : subjectKey === "exam_l1_l1_political_systems" ? [
      { formKey: "general_2025", formName: "العام 2025", sortOrder: 20251, questionCount: 0 },
    ] : resolvedSubjectKey === "exam_secondary_math" ? [
      { formKey: "secondary_math_model_1", formName: "النموذج الأول — رياضيات أدبي", sortOrder: 1, questionCount: 40 },
      { formKey: "secondary_math_model_2", formName: "النموذج الثاني — رياضيات أدبي", sortOrder: 2, questionCount: 40 },
      { formKey: "secondary_math_model_3", formName: "النموذج الثالث — رياضيات أدبي", sortOrder: 3, questionCount: 40 },
      { formKey: "secondary_math_model_4", formName: "النموذج الرابع — رياضيات أدبي", sortOrder: 4, questionCount: 40 },
    ] : resolvedSubjectKey === "exam_secondary_history" ? [
      { formKey: "secondary_history_model_1", formName: "النموذج الأول — تاريخ أدبي", sortOrder: 1, questionCount: 50 },
      { formKey: "secondary_history_model_2", formName: "النموذج الثاني — تاريخ أدبي", sortOrder: 2, questionCount: 50 },
      { formKey: "secondary_history_model_3", formName: "النموذج الثالث — تاريخ أدبي", sortOrder: 3, questionCount: 50 },
      { formKey: "secondary_history_model_4", formName: "النموذج الرابع — تاريخ أدبي", sortOrder: 4, questionCount: 50 },
      { formKey: "secondary_history_model_5", formName: "النموذج الخامس — تاريخ أدبي", sortOrder: 5, questionCount: 50 },
      { formKey: "secondary_history_model_6", formName: "النموذج السادس — تاريخ أدبي", sortOrder: 6, questionCount: 50 },
    ] : resolvedSubjectKey === "exam_secondary_arabic" ? [
      { formKey: "secondary_arabic_model_1", formName: "النموذج الأول - لغة عربية أدبي", sortOrder: 1, questionCount: 46 },
      { formKey: "secondary_arabic_model_2", formName: "النموذج الثاني - لغة عربية أدبي", sortOrder: 2, questionCount: 46 },
      { formKey: "secondary_arabic_model_3", formName: "النموذج الثالث - لغة عربية أدبي", sortOrder: 3, questionCount: 46 },
      { formKey: "secondary_arabic_model_4", formName: "النموذج الرابع - لغة عربية أدبي", sortOrder: 4, questionCount: 46 },
      { formKey: "secondary_arabic_model_5", formName: "النموذج الخامس - لغة عربية أدبي", sortOrder: 5, questionCount: 46 },
      { formKey: "secondary_arabic_model_6", formName: "النموذج السادس - لغة عربية أدبي", sortOrder: 6, questionCount: 46 },
      { formKey: "secondary_arabic_model_7", formName: "النموذج السابع - لغة عربية أدبي", sortOrder: 7, questionCount: 46 },
    ] : resolvedSubjectKey === "exam_secondary_geography" ? [
      { formKey: "secondary_geography_model_1", formName: "النموذج الأول - جغرافيا أدبي", sortOrder: 1, questionCount: 50 },
      { formKey: "secondary_geography_model_2", formName: "النموذج الثاني - جغرافيا أدبي", sortOrder: 2, questionCount: 50 },
      { formKey: "secondary_geography_model_3", formName: "النموذج الثالث - جغرافيا أدبي", sortOrder: 3, questionCount: 50 },
      { formKey: "secondary_geography_model_4", formName: "النموذج الرابع - جغرافيا أدبي", sortOrder: 4, questionCount: 50 },
      { formKey: "secondary_geography_model_5", formName: "النموذج الخامس - جغرافيا أدبي", sortOrder: 5, questionCount: 50 },
      { formKey: "secondary_geography_model_6", formName: "النموذج السادس - جغرافيا أدبي", sortOrder: 6, questionCount: 50 },
      { formKey: "secondary_geography_model_7", formName: "النموذج السابع - جغرافيا أدبي", sortOrder: 7, questionCount: 50 },
    ] : resolvedSubjectKey === "exam_secondary_quran" ? [
      { formKey: "secondary_quran_model_1", formName: "النموذج الأول - قرآن كريم أدبي", sortOrder: 1, questionCount: options.secondaryQuranWrittenQuestion ? 2 : 47 },
      { formKey: "secondary_quran_model_2", formName: "النموذج الثاني - قرآن كريم أدبي", sortOrder: 2, questionCount: 47 },
      { formKey: "secondary_quran_model_3", formName: "النموذج الثالث - قرآن كريم أدبي", sortOrder: 3, questionCount: 47 },
      { formKey: "secondary_quran_model_4", formName: "النموذج الرابع - قرآن كريم أدبي", sortOrder: 4, questionCount: 47 },
      { formKey: "secondary_quran_model_5", formName: "النموذج الخامس - قرآن كريم أدبي", sortOrder: 5, questionCount: 47 },
      { formKey: "secondary_quran_model_6", formName: "النموذج السادس - قرآن كريم أدبي", sortOrder: 6, questionCount: 47 },
      { formKey: "secondary_quran_model_7", formName: "النموذج السابع - قرآن كريم أدبي", sortOrder: 7, questionCount: 47 },
    ] : resolvedSubjectKey === "exam_secondary_philosophy" ? [
      { formKey: "secondary_philosophy_model_1", formName: "النموذج الأول - الفلسفة والمنطق وعلم النفس أدبي", sortOrder: 1, questionCount: 50 },
      { formKey: "secondary_philosophy_model_2", formName: "النموذج الثاني - الفلسفة والمنطق وعلم النفس أدبي", sortOrder: 2, questionCount: 50 },
      { formKey: "secondary_philosophy_model_3", formName: "النموذج الثالث - الفلسفة والمنطق وعلم النفس أدبي", sortOrder: 3, questionCount: 50 },
      { formKey: "secondary_philosophy_model_4", formName: "النموذج الرابع - الفلسفة والمنطق وعلم النفس أدبي", sortOrder: 4, questionCount: 50 },
      { formKey: "secondary_philosophy_model_5", formName: "النموذج الخامس - الفلسفة والمنطق وعلم النفس أدبي", sortOrder: 5, questionCount: 50 },
      { formKey: "secondary_philosophy_model_6", formName: "النموذج السادس - الفلسفة والمنطق وعلم النفس أدبي", sortOrder: 6, questionCount: 50 },
      { formKey: "secondary_philosophy_model_7", formName: "النموذج السابع - الفلسفة والمنطق وعلم النفس أدبي", sortOrder: 7, questionCount: 50 },
    ] : resolvedSubjectKey === "exam_secondary_islamic" ? [
      { formKey: "secondary_islamic_model_1", formName: "النموذج الأول - التربية الإسلامية أدبي", sortOrder: 1, questionCount: 50 },
      { formKey: "secondary_islamic_model_2", formName: "النموذج الثاني - التربية الإسلامية أدبي", sortOrder: 2, questionCount: 50 },
      { formKey: "secondary_islamic_model_3", formName: "النموذج الثالث - التربية الإسلامية أدبي", sortOrder: 3, questionCount: 50 },
      { formKey: "secondary_islamic_model_4", formName: "النموذج الرابع - التربية الإسلامية أدبي", sortOrder: 4, questionCount: 50 },
      { formKey: "secondary_islamic_model_5", formName: "النموذج الخامس - التربية الإسلامية أدبي", sortOrder: 5, questionCount: 50 },
      { formKey: "secondary_islamic_model_6", formName: "النموذج السادس - التربية الإسلامية أدبي", sortOrder: 6, questionCount: 50 },
      { formKey: "secondary_islamic_model_7", formName: "النموذج السابع - التربية الإسلامية أدبي", sortOrder: 7, questionCount: 50 },
    ] : resolvedSubjectKey === "exam_secondary_english" ? [
      { formKey: "secondary_english_model_1", formName: "النموذج الأول - اللغة الإنجليزية أدبي", sortOrder: 1, questionCount: 50 },
      { formKey: "secondary_english_model_2", formName: "النموذج الثاني - اللغة الإنجليزية أدبي", sortOrder: 2, questionCount: 50 },
      { formKey: "secondary_english_model_3", formName: "النموذج الثالث - اللغة الإنجليزية أدبي", sortOrder: 3, questionCount: 50 },
      { formKey: "secondary_english_model_4", formName: "النموذج الرابع - اللغة الإنجليزية أدبي", sortOrder: 4, questionCount: 50 },
      { formKey: "secondary_english_model_5", formName: "النموذج الخامس - اللغة الإنجليزية أدبي", sortOrder: 5, questionCount: 50 },
      { formKey: "secondary_english_model_6", formName: "النموذج السادس - اللغة الإنجليزية أدبي", sortOrder: 6, questionCount: 50 },
      { formKey: "secondary_english_model_7", formName: "النموذج السابع - اللغة الإنجليزية أدبي", sortOrder: 7, questionCount: 50 },
    ] : ["exam_secondary_scientific_quran", "exam_secondary_scientific_islamic", "exam_secondary_scientific_arabic", "exam_secondary_scientific_english", "exam_secondary_scientific_biology", "exam_secondary_scientific_physics", "exam_secondary_scientific_chemistry"].includes(subjectKey) ? [
      { formKey: `${subjectKey}-01`, formName: "2026 النموذج 1", sortOrder: 2026001, questionCount: 2 },
      ...(subjectKey === "exam_secondary_scientific_physics" ? [
        { formKey: `${subjectKey}-02`, formName: "2026 النموذج 2", sortOrder: 2026002, questionCount: 2 },
        { formKey: `${subjectKey}-03`, formName: "2026 النموذج 3", sortOrder: 2026003, questionCount: 2 },
      ] : []),
    ] : resolvedSubjectKey === "civil_law" ? [
      { formKey: "general_2025", formName: "العام 2025", sortOrder: 20251, questionCount: 2 },
    ] : [];
    },
    listExamQuestions: async subjectKey => ["civil_law", "l1_usul_fiqh", "l1_criminology", "exam_secondary_math", "exam_secondary_history", "exam_secondary_arabic", "exam_secondary_geography", "exam_secondary_quran", "exam_secondary_philosophy", "exam_secondary_islamic", "exam_secondary_english", "exam_secondary_literary_math", "exam_secondary_literary_history", "exam_secondary_literary_arabic", "exam_secondary_literary_geography", "exam_secondary_literary_quran", "exam_secondary_literary_philosophy", "exam_secondary_literary_islamic", "exam_secondary_literary_english", "exam_secondary_scientific_quran", "exam_secondary_scientific_islamic", "exam_secondary_scientific_arabic", "exam_secondary_scientific_english", "exam_secondary_scientific_biology", "exam_secondary_scientific_physics", "exam_secondary_scientific_chemistry"].includes(subjectKey) ? examQuestions : [],
    startExamSession: async (telegramUserId, chatId, subjectKey, sectionKey, timeLimitSeconds) => {
      examSession = { id: 91, telegramUserId, chatId, subjectKey, sectionKey, status: "active", questionIndex: 0, score: 0, incorrectCount: 0, missedCount: 0, timeLimitSeconds, activePollId: null, startedAt: new Date() };
      return { id: examSession.id };
    },
    getExamSession: async (sessionId, telegramUserId) => examSession?.id === sessionId && examSession.telegramUserId === telegramUserId ? examSession : undefined,
    setExamActivePoll: async input => {
      if (!examSession || examSession.id !== input.sessionId || examSession.telegramUserId !== input.telegramUserId || examSession.questionIndex !== input.questionIndex || examSession.activePollId) return false;
      examSession.activePollId = input.pollId;
      return true;
    },
    getExamSessionByPoll: async pollId => examSession?.activePollId === pollId ? examSession : undefined,
    cancelExamSession: async (telegramUserId, chatId) => {
      if (!examSession || examSession.telegramUserId !== telegramUserId || examSession.chatId !== chatId || examSession.status !== "active") return undefined;
      examSession.status = "cancelled";
      examSession.activePollId = null;
      return { subjectKey: examSession.subjectKey, sectionKey: examSession.sectionKey };
    },
    resolveExamPoll: async input => {
      if (!examSession || examSession.id !== input.sessionId || examSession.telegramUserId !== input.telegramUserId || examSession.status !== "active" || examSession.questionIndex !== input.questionIndex || examSession.activePollId !== input.pollId) return undefined;
      const question = examQuestions[input.questionIndex];
      if (!question) return undefined;
      const missed = !input.answer;
      const isCorrect = !missed && question.correctOption === input.answer;
      examSession.score += isCorrect ? 1 : 0;
      examSession.incorrectCount += !missed && !isCorrect ? 1 : 0;
      examSession.missedCount += missed ? 1 : 0;
      examSession.questionIndex += 1;
      examSession.activePollId = null;
      const completed = examSession.questionIndex >= examQuestions.length;
      if (completed) examSession.status = "completed";
      return { question, isCorrect, missed, score: examSession.score, incorrectCount: examSession.incorrectCount, missedCount: examSession.missedCount, nextQuestionIndex: examSession.questionIndex, total: examQuestions.length, completed, elapsedSeconds: 10 };
    },
    advanceExamWrittenQuestion: async input => {
      if (!examSession || examSession.id !== input.sessionId || examSession.telegramUserId !== input.telegramUserId || examSession.status !== "active" || examSession.questionIndex !== input.questionIndex || examSession.activePollId) return undefined;
      const question = examQuestions[input.questionIndex];
      if (!question || [question.optionA, question.optionB, question.optionC, question.optionD].some(option => option.trim())) return undefined;
      examSession.questionIndex += 1;
      const completed = examSession.questionIndex >= examQuestions.length;
      if (completed) examSession.status = "completed";
      return { score: examSession.score, incorrectCount: examSession.incorrectCount, missedCount: examSession.missedCount, nextQuestionIndex: examSession.questionIndex, total: examQuestions.length, completed, elapsedSeconds: 10 };
    },
    getExamResultSummary: async () => examSession ? {
      previousBest: { score: 2, incorrectCount: 0, missedCount: 0, elapsedSeconds: 8 },
      leaderboardResult: { score: 2, incorrectCount: 0, missedCount: 0, elapsedSeconds: 8 },
      rank: 1,
      totalParticipants: 1,
      percentile: 100,
    } : undefined,
    getGroupExamWaitingRound: async (chatId, subjectKey, sectionKey) => groupRound?.status === "waiting" && groupRound.chatId === chatId && groupRound.subjectKey === subjectKey && groupRound.sectionKey === sectionKey ? groupRound : undefined,
    createGroupExamRound: async input => {
      if (groupRound?.status === "active" || groupRound?.status === "waiting") return { round: groupRound, created: false };
      groupRound = { id: 301, chatId: input.chatId, creatorTelegramUserId: input.creatorTelegramUserId, subjectKey: input.subjectKey, sectionKey: input.sectionKey, status: "waiting", questionIndex: 0, timeLimitSeconds: input.timeLimitSeconds, activePollId: null, startedAt: null };
      groupParticipants.clear();
      groupAnswers.clear();
      return { round: groupRound, created: true };
    },
    joinGroupExamRound: async input => {
      if (!groupRound || groupRound.id !== input.roundId || groupRound.status !== "waiting") return undefined;
      const joined = !groupParticipants.has(input.telegramUserId);
      if (joined) groupParticipants.set(input.telegramUserId, { telegramUserId: input.telegramUserId, displayName: input.displayName, score: 0, incorrectCount: 0, missedCount: 0 });
      return { round: groupRound, participantCount: groupParticipants.size, joined };
    },
    activateGroupExamRound: async roundId => {
      if (!groupRound || groupRound.id !== roundId || groupRound.status !== "waiting" || groupParticipants.size < 3) return undefined;
      groupRound.status = "active";
      groupRound.startedAt = new Date();
      return groupRound;
    },
    getGroupExamRound: async roundId => groupRound?.id === roundId ? groupRound : undefined,
    cancelGroupExamRound: async roundId => {
      if (!groupRound || groupRound.id !== roundId || !["waiting", "active"].includes(groupRound.status)) return false;
      groupRound.status = "cancelled";
      groupRound.activePollId = null;
      return true;
    },
    setGroupExamActivePoll: async input => {
      if (!groupRound || groupRound.id !== input.roundId || groupRound.status !== "active" || groupRound.questionIndex !== input.questionIndex || groupRound.activePollId) return false;
      groupRound.activePollId = input.pollId;
      return true;
    },
    getGroupExamRoundByPoll: async pollId => groupRound?.activePollId === pollId ? groupRound : undefined,
    recordGroupExamAnswer: async input => {
      if (!groupRound || groupRound.activePollId !== input.pollId || !groupParticipants.has(input.telegramUserId)) return false;
      groupAnswers.set(`${groupRound.questionIndex}:${input.telegramUserId}`, input.answer);
      return true;
    },
    resolveGroupExamPoll: async pollId => {
      if (!groupRound || groupRound.status !== "active" || groupRound.activePollId !== pollId) return undefined;
      const question = examQuestions[groupRound.questionIndex];
      if (!question) return undefined;
      let correctCount = 0;
      let incorrectCount = 0;
      let missedCount = 0;
      for (const participant of groupParticipants.values()) {
        const answer = groupAnswers.get(`${groupRound.questionIndex}:${participant.telegramUserId}`);
        if (!answer) {
          missedCount += 1;
          participant.missedCount += 1;
        } else if (answer === question.correctOption) {
          correctCount += 1;
          participant.score += 1;
        } else {
          incorrectCount += 1;
          participant.incorrectCount += 1;
        }
      }
      groupRound.questionIndex += 1;
      groupRound.activePollId = null;
      const completed = groupRound.questionIndex >= examQuestions.length;
      if (completed) groupRound.status = "completed";
      return { question, correctCount, incorrectCount, missedCount, participantCount: groupParticipants.size, nextQuestionIndex: groupRound.questionIndex, total: examQuestions.length, completed };
    },
    getGroupExamLeaderboard: async () => [...groupParticipants.values()].sort((a, b) => b.score - a.score || a.incorrectCount - b.incorrectCount || a.missedCount - b.missedCount || a.displayName.localeCompare(b.displayName, "ar")),
  };
}

function createSender() {
  const messages: Array<{ chatId: number; text: string; replyMarkup?: unknown }> = [];
  const editedMessages: Array<{ chatId: number; messageId: number; text: string; replyMarkup?: unknown }> = [];
  const documents: Array<{ chatId: number; filename: string; caption: string }> = [];
  const fileIdDocuments: Array<{ chatId: number; fileId: string; caption?: string }> = [];
  const fileIdPhotos: Array<{ chatId: number; fileId: string; caption?: string }> = [];
  const polls: Array<{ chatId: number; question: string; options: string[]; explanation: string; openPeriodSeconds: number }> = [];
  const callbacks: string[] = [];
  const sender: TelegramSender = {
    sendMessage: async (chatId, text, replyMarkup) => {
      messages.push({ chatId, text, replyMarkup });
    },
    sendDocument: async (chatId, document) => {
      documents.push({ chatId, filename: document.filename, caption: document.caption });
    },
    sendDocumentByFileId: async (chatId, fileId, caption) => {
      fileIdDocuments.push({ chatId, fileId, caption });
    },
    sendPhotoByFileId: async (chatId, fileId, caption) => {
      fileIdPhotos.push({ chatId, fileId, caption });
    },
    sendQuizPoll: async (chatId, poll) => {
      polls.push({ chatId, question: poll.question, options: poll.options, explanation: poll.explanation, openPeriodSeconds: poll.openPeriodSeconds });
      return { pollId: `poll-${polls.length}` };
    },
    answerCallbackQuery: async callbackQueryId => {
      callbacks.push(callbackQueryId);
    },
    editMessageText: async (chatId, messageId, text, replyMarkup) => {
      editedMessages.push({ chatId, messageId, text, replyMarkup });
    },
    isChatAdministrator: async () => false,
  };
  return { sender, messages, editedMessages, documents, fileIdDocuments, fileIdPhotos, polls, callbacks };
}

function createDocumentProvider() {
  const requestedSources: LegalSource[] = [];
  const provider: TelegramDocumentProvider = {
    download: async source => {
      requestedSources.push(source);
      return { filename: source.title, contentType: "application/pdf", data: new Uint8Array([1, 2, 3]), caption: `المكتبة القانونية — ${source.title}` };
    },
  };
  return { provider, requestedSources };
}

describe("Telegram library conversation", () => {
  it("لا يسجل Webhook إلا برابط HTTPS النهائي الصحيح", () => {
    expect(isFinalTelegramWebhookUrl("https://example.com/api/telegram/webhook")).toBe(true);
    expect(isFinalTelegramWebhookUrl("http://example.com/api/telegram/webhook")).toBe(false);
    expect(isFinalTelegramWebhookUrl("https://example.com/api/telegram/health")).toBe(false);
    expect(isFinalTelegramWebhookUrl(undefined)).toBe(false);
  });

  it("يقصر أدوات الإدارة على معرّف المالك المهيأ", () => {
    expect(isTelegramOwner("100", "100")).toBe(true);
    expect(isTelegramOwner("101", "100")).toBe(false);
    expect(isTelegramOwner("100", "")).toBe(false);
  });

  it("يحمّل معرّف مالك البوت من البيئة ويقبله لأوامر الإدارة", () => {
    const configuredOwnerId = process.env.TELEGRAM_OWNER_ID;
    expect(configuredOwnerId).toBeTruthy();
    expect(isTelegramOwner(configuredOwnerId ?? "")).toBe(true);
  });

  it("يبني رابط تنزيل Drive من معرّف الملف دون استخدام رابط العرض", () => {
    const url = driveDownloadUrl("file-7");
    expect(url).toContain("drive.usercontent.google.com/download");
    expect(url).toContain("id=file-7");
    expect(url).not.toContain("/file/d/");
  });

  it("يقبل ملف التخزين الداخلي للإرسال حتى من دون معرّف Google Drive", () => {
    expect(canDeliverDocumentSource({ driveFileId: null, url: "/manus-storage/telegram-library/test-file.pdf" })).toBe(true);
    expect(canDeliverDocumentSource({ driveFileId: null, url: "https://example.com/preview" })).toBe(false);
  });

  it("يحفظ امتداد المصدر في اسم المستند عند إرسال ملف التخزين", () => {
    expect(documentFilename({ title: "العليا", url: "/manus-storage/telegram-library/upload_123.pdf" }, "application/pdf")).toBe("العليا.pdf");
    expect(documentFilename({ title: "مذكرة.docx", url: "/manus-storage/telegram-library/upload_123.docx" }, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("مذكرة.docx");
  });

  it("يعرض رسالة البداية والقائمة العربية", async () => {
    const { sender, messages } = createSender();
    const store = createStore();
    await handleTelegramUpdate({ message: { chat: { id: 12, type: "private" }, text: "/start" } }, store, sender);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("منصة معرفية وتعليمية بإشراف أ. معين الناصر");
    expect(messages[0]?.text).toContain("مبادرة تعليمية مستقلة");
    const keyboard = JSON.stringify(messages[0]?.replyMarkup);
    expect(keyboard).toContain("🔎 البحث القانوني");
    expect(keyboard).toContain("📚 المكتبة القانونية");
    expect(keyboard).toContain("📝 بنك الأسئلة والاختبارات");
    expect(keyboard).toContain("📄 النماذج والصيغ القانونية");
    expect(keyboard).toContain("📌 المراجع المميزة");
    expect(keyboard).toContain("🛠 الخدمات والأدوات");
    expect(keyboard).toContain("menu:library");
    expect(keyboard).toContain("menu:exams");
    expect(keyboard).not.toContain("📚 تصفح المكتبة");
    expect(keyboard).not.toContain("⚖️ قواعد قضائية");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain('"url":"https://alnaseer.org/"');
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain('"url":"https://t.me/muen2025"');
    expect(keyboard).toContain("قناة منصة الناصر القانونية");

    await handleTelegramUpdate({ message: { chat: { id: 12, type: "private" }, text: "/start" } }, store, sender);
    expect(messages[1]?.text).toContain("مرحباً بك في بوت الناصر القانوني");
    expect(messages[1]?.text).not.toContain("منصة معرفية وتعليمية بإشراف أ. معين الناصر");
  });

  it("يعرض إحصاءات البوت وعدد المستخدمين بصيغة بارزة ويحدث الرسالة نفسها", async () => {
    const { sender, messages, editedMessages } = createSender();
    const store = createStore(true, false, {
      contentStatistics: {
        questionCount: 1250,
        examFormCount: 42,
        examSubjectCount: 9,
        examLevelCount: 3,
        totalExams: 15233,
        userCount: 61900,
        libraryFileCount: 240,
        librarySectionsCount: 8,
        libraryFilesBySection: [{ label: "نماذج وصيغ قانونية", count: 217 }],
        lastUpdatedAt: new Date("2026-08-26T20:00:00.000Z"),
      },
    });

    await handleTelegramUpdate({ callback_query: { id: "open-help", data: "menu:help", from: { id: 12 }, message: { chat: { id: 12, type: "private" }, message_id: 88 } } }, store, sender);
    expect(editedMessages.at(-1)?.messageId).toBe(88);
    expect(JSON.stringify(editedMessages.at(-1)?.replyMarkup)).toContain('"callback_data":"stats"');

    await handleTelegramUpdate({ callback_query: { id: "open-stats", data: "stats", from: { id: 12 }, message: { chat: { id: 12, type: "private" }, message_id: 88 } } }, store, sender);
    expect(messages).toHaveLength(0);
    expect(editedMessages.at(-1)?.text).toContain("📊 إحصاءات البوت");
    expect(editedMessages.at(-1)?.text).toContain("٦١٬٩٠٠ مستخدمًا");
    expect(editedMessages.at(-1)?.text).toContain("✅ الاختبارات المنجزة: ١٥٬٢٣٣");
    expect(JSON.stringify(editedMessages.at(-1)?.replyMarkup)).toContain("stats:refresh");

    await handleTelegramUpdate({ callback_query: { id: "refresh-stats", data: "stats:refresh", from: { id: 12 }, message: { chat: { id: 12, type: "private" }, message_id: 88 } } }, store, sender);
    expect(editedMessages).toHaveLength(3);
    expect(editedMessages.at(-1)?.messageId).toBe(88);
  });

  it("يسجل رابط الإحالة في أول بدء ويشرح متابعة الإحالات للمستخدم", async () => {
    const referrals: Array<{ referrer: string; referee: string; chat: string }> = [];
    const { sender, messages } = createSender();
    const store = createStore(true, false, {
      onReferralCreated: (referrer, referee, chat) => referrals.push({ referrer, referee, chat }),
      referralProgress: { qualifiedCount: 3, pendingCount: 1, remainingCount: 2, activeAccessExpiresAt: null },
    });
    await handleTelegramUpdate({ message: { from: { id: 12 }, chat: { id: 12, type: "private" }, text: "/start ref_99" } }, store, sender);
    expect(referrals).toEqual([{ referrer: "99", referee: "12", chat: "12" }]);
    expect(messages.some(message => message.text.includes("تم تسجيل الإحالة بنجاح"))).toBe(true);

    await handleTelegramUpdate({ callback_query: { id: "referral", data: "premium:referral", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.at(-1)?.text).toContain("رابط إحالتك الشخصي");
    expect(messages.at(-1)?.text).toContain("ref_12");
    expect(messages.at(-1)?.text).toContain("إحالاتك المحتسبة: 3");
  });

  it("يطلب توثيق زيارة حصاد اليوم قبل فتح القواعد القضائية والصيغ والعقود", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, { referralPremiumAccess: false, hasadConfirmed: false });
    await handleTelegramUpdate({ callback_query: { id: "judicial-blocked", data: "judicial", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.at(-1)?.text).toContain("توثيق زيارة واحدة لموقع حصاد اليوم");
    expect(messages.at(-1)?.text).toContain("القواعد القضائية");
    expect(messages.at(-1)?.text).not.toContain("الصيغ والعقود القانونية");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("https://alnasser-legal-telegram-bot-supabase-git-sup-f04e08-hasadalyoum.vercel.app/telegram-hasad-visit.html");

    await handleTelegramUpdate({ callback_query: { id: "contracts-blocked", data: "contract-templates", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.at(-1)?.text).toContain("توثيق زيارة واحدة لموقع حصاد اليوم");
    expect(messages.at(-1)?.text).toContain("الصيغ والعقود القانونية");
    expect(messages.at(-1)?.text).not.toContain("القواعد القضائية");
  });

  it("يفتح القواعد القضائية مجانًا للمستخدم الذي سبق توثيق زيارته لحصاد اليوم", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, { referralPremiumAccess: false, hasadConfirmed: true });
    await handleTelegramUpdate({ callback_query: { id: "judicial-open", data: "judicial", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.some(message => message.text.includes("المبادئ والقواعد القضائية"))).toBe(true);
    expect(messages.some(message => message.text.includes("متاح باشتراك نشط أو بمكافأة الإحالة"))).toBe(false);
  });

  it("يتجاوز بوابة حصاد اليوم للأقسام الحالية التي حولتها الإدارة إلى مجاني", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, {
      hasadConfirmed: false,
      managedSections: [
        { sectionKey: "judicial", displayLabel: "⚖️ قواعد قضائية", enabled: true, accessMode: "free", sortOrder: 30 },
        { sectionKey: "contract-templates", displayLabel: "📄 صيغ وعقود قانونية", enabled: true, accessMode: "free", sortOrder: 80 },
      ],
    });

    await handleTelegramUpdate({ callback_query: { id: "judicial-admin-free", data: "judicial", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.some(message => message.text.includes("المبادئ والقواعد القضائية"))).toBe(true);
    expect(messages.some(message => message.text.includes("توثيق زيارة واحدة لموقع حصاد اليوم"))).toBe(false);

    messages.length = 0;
    await handleTelegramUpdate({ callback_query: { id: "contracts-admin-free", data: "contract-templates", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.some(message => message.text.includes("توثيق زيارة واحدة لموقع حصاد اليوم"))).toBe(false);
  });

  it("يفرض توثيق حصاد اليوم عند اختياره كنمط وصول لقسم الاختبارات", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, {
      hasadConfirmed: false,
      managedSections: [{ sectionKey: "exams", displayLabel: "📝 اختبارات الشريعة والقانون", enabled: true, accessMode: "hasad", sortOrder: 90 }],
    });
    await handleTelegramUpdate({ callback_query: { id: "exam-hasad", data: "exams", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.at(-1)?.text).toContain("توثيق زيارة واحدة لموقع حصاد اليوم");
  });

  it("يفتح اختبارات الشريعة والقانون مجانًا بعد توثيق زيارة حصاد اليوم", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, { referralPremiumAccess: false, hasadConfirmed: true });
    await handleTelegramUpdate({ callback_query: { id: "exam-free-hasad", data: "exams", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    const response = messages.at(-1);
    expect(response?.text).toContain("📝 اختبارات الشريعة والقانون");
    expect(response?.text).toContain("بنك أسئلة مؤتمت ونماذج أسئلة تجريبية مع الشرح المفصل مبنية وفقاً لنماذج الأختبارات للأعوام السابقة لكلية الشريعة والقانون \"جامعة صنعاء\" من عام 2020 وحتى عام 2026، مع التحديث والترقية المستمرة للأعوام المقبلة.");
    expect(response?.text).toContain("اختر المادة من القائمة أدناه أو استخدم الأمر المناسب.");
    expect(response?.text).not.toContain("دعم اختياري");
    expect(response?.text).not.toContain("الاشتراك المدفوع");
  });

  it("يفتح اختبارات الثانوية العامة مجانًا بعد توثيق زيارة حصاد اليوم", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, { referralPremiumAccess: false, hasadConfirmed: true });
    await handleTelegramUpdate({ callback_query: { id: "secondary-free-hasad", data: "secondary-exams", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    const response = messages.at(-1);
    expect(response?.text).toContain("اختبارات الثانوية العامة");
    expect(response?.text).not.toContain("دعم اختياري");
    expect(response?.text).not.toContain("الاشتراك المدفوع");
  });

  it("يفتح قسم الاختبارات مباشرة عند تحويله إداريًا إلى الوصول المجاني", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, {
      referralPremiumAccess: false,
      hasadConfirmed: true,
      managedSections: [{ sectionKey: "exams", displayLabel: "📝 اختبارات الشريعة والقانون", enabled: true, accessMode: "free", sortOrder: 90 }],
    });
    await handleTelegramUpdate({ callback_query: { id: "exam-free", data: "exams", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    const response = messages.at(-1);
    expect(response?.text).toContain("اختر المادة من القائمة");
    expect(response?.text).not.toContain("دعم اختياري");
    expect(JSON.stringify(response?.replyMarkup)).not.toContain("premium:request:sharia_exams");
  });

  it("يفتح أهم القوانين مباشرة عند تحويله إداريًا إلى الوصول المجاني من دون حذف حالة الاشتراك", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, {
      managedSections: [{ sectionKey: "important-laws", displayLabel: "🔐 أهم القوانين اليمنية التفاعلي", enabled: true, accessMode: "free", sortOrder: 50 }],
    });
    await handleTelegramUpdate({ callback_query: { id: "important-free", data: "important-laws", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.some(message => message.text.includes("قسم خاص"))).toBe(false);
    expect(messages.some(message => message.text.includes("يمكنك مشاركة رابط"))).toBe(false);
  });

  it("يعرض سجل الإحالات مع العداد الفوري من دون كشف هوية الأشخاص المُحالين", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, {
      referralProgress: { qualifiedCount: 2, pendingCount: 1, remainingCount: 3, activeAccessExpiresAt: null },
      referralHistory: [
        { id: 2, status: "pending", createdAt: new Date("2030-01-10T00:00:00.000Z"), qualifiedAt: null, rejectedAt: null, rejectionReason: null },
        { id: 1, status: "qualified", createdAt: new Date("2030-01-01T00:00:00.000Z"), qualifiedAt: new Date("2030-01-02T00:00:00.000Z"), rejectedAt: null, rejectionReason: null },
      ],
    });
    await handleTelegramUpdate({ callback_query: { id: "referral-history", data: "premium:referrals", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.at(-1)?.text).toContain("إحالاتك المحتسبة: 2");
    expect(messages.at(-1)?.text).toContain("قيد التأهيل: 1");
    expect(messages.at(-1)?.text).toContain("✅ محتسبة بنجاح");
    expect(messages.at(-1)?.text).toContain("⏳ قيد التأهيل");
    expect(messages.at(-1)?.text).toContain("لا تظهر هويات الأشخاص المُحالين");
  });

  it("يعرض الأزرار المدارة ويعالج الرسالة المخصصة من لوحة المنصة", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, { managedMenuItems: [{
      id: 91,
      label: "📣 تنبيه إداري",
      actionType: "message",
      actionValue: "هذه رسالة مخصصة تُدار من لوحة منصة الناصر.",
      rowIndex: 100,
      sortOrder: 1,
    }] });

    await handleTelegramUpdate({ message: { chat: { id: 12, type: "private" }, text: "/start" } }, store, sender);
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("📣 تنبيه إداري");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("managed:91");

    await handleTelegramUpdate({ callback_query: { id: "managed-item", data: "managed:91", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.at(-1)?.text).toContain("هذه رسالة مخصصة تُدار من لوحة منصة الناصر.");
  });

  it("يطبق الوصول المجاني أو المدفوع/الإحالة على الزر المخصص", async () => {
    const premiumItem = {
      id: 92,
      label: "📚 قسم مخصص",
      actionType: "message" as const,
      actionValue: "محتوى القسم المخصص.",
      rowIndex: 100,
      sortOrder: 1,
      accessMode: "premium" as const,
    };
    const blocked = createStore(true, false, { managedMenuItems: [premiumItem], referralPremiumAccess: false, managedMenuPremiumAccess: false });
    const blockedSender = createSender();
    await handleTelegramUpdate({ callback_query: { id: "custom-premium-blocked", data: "managed:92", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, blocked, blockedSender.sender);
    expect(blockedSender.messages.at(-1)?.text).toContain("الدعم الاختياري أو الإحالة");
    expect(JSON.stringify(blockedSender.messages.at(-1)?.replyMarkup)).toContain("managed-premium:request:92");

    const allowed = createStore(true, false, { managedMenuItems: [premiumItem], managedMenuPremiumAccess: true });
    const allowedSender = createSender();
    await handleTelegramUpdate({ callback_query: { id: "custom-premium-open", data: "managed:92", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, allowed, allowedSender.sender);
    expect(allowedSender.messages.at(-1)?.text).toContain("محتوى القسم المخصص.");
  });

  it("يعرض زر الملف المخصص كزر تفاعلي دون كشف رابط التخزين", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, { managedMenuItems: [{
      id: 93,
      label: "📄 ملف خاص",
      actionType: "file",
      actionValue: "/manus-storage/telegram-library/private-file.pdf",
      rowIndex: 100,
      sortOrder: 1,
      accessMode: "premium",
    }] });

    await handleTelegramUpdate({ message: { chat: { id: 12, type: "private" }, text: "/start" } }, store, sender);
    const keyboard = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(keyboard).toContain("managed:93");
    expect(keyboard).not.toContain("/manus-storage/");
  });

  it("يفرض زيارة حصاد اليوم على الزر المخصص عند اختيار هذا النمط", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, {
      hasadConfirmed: false,
      managedMenuItems: [{ id: 94, label: "محتوى خاص", actionType: "message", actionValue: "محتوى الزر", rowIndex: 100, sortOrder: 1, accessMode: "hasad" }],
    });
    await handleTelegramUpdate({ callback_query: { id: "custom-hasad", data: "managed:94", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);
    expect(messages.at(-1)?.text).toContain("توثيق زيارة واحدة لموقع حصاد اليوم");
  });

  it("يطبق إخفاء وتسمية وترتيب الأقسام المدارة في القائمة الرئيسية", async () => {
    const { sender, messages, editedMessages } = createSender();
    const store = createStore(true, false, { managedSections: [
      { sectionKey: "browse", displayLabel: "مكتبة الناصر", enabled: true, sortOrder: 500 },
      { sectionKey: "secondary-exams", displayLabel: "اختبارات الثانوية", enabled: false, sortOrder: 100 },
    ] });

    await handleTelegramUpdate({ message: { chat: { id: 12, type: "private" }, text: "/start" } }, store, sender);
    await handleTelegramUpdate({ callback_query: { id: "open-library-category", data: "menu:library", from: { id: 12 }, message: { chat: { id: 12, type: "private" }, message_id: 77 } } }, store, sender);
    const libraryEdit = editedMessages.at(-1);
    const keyboard = JSON.stringify(libraryEdit?.replyMarkup);
    expect(libraryEdit?.messageId).toBe(77);
    expect(keyboard).toContain("مكتبة الناصر");
    expect(keyboard).toContain("⚖️ القواعد والمبادئ القضائية");
    await handleTelegramUpdate({ callback_query: { id: "open-exams-category", data: "menu:exams", from: { id: 12 }, message: { chat: { id: 12, type: "private" }, message_id: 77 } } }, store, sender);
    expect(editedMessages.at(-1)?.text).toContain("بنك الأسئلة والاختبارات");
    expect(JSON.stringify(editedMessages.at(-1)?.replyMarkup)).not.toContain("اختبارات الثانوية");
  });

  it("يسجل مفتاح القسم عند فتح قسم التشريعات لدعم التحليلات المجمعة", async () => {
    const { sender } = createSender();
    const events: Array<{ eventType: string; sectionKey?: string }> = [];
    const store = createStore(true, false, { onUsage: (eventType, options) => events.push({ eventType, sectionKey: options?.sectionKey }) });

    await handleTelegramUpdate({ callback_query: { id: "open-legislation", data: "legislation", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } }, store, sender);

    expect(events).toContainEqual({ eventType: "browse", sectionKey: "legislation" });
  });

  it("يستخدم قالب الترحيب المعتمد من مركز الإدارة", async () => {
    const { sender, messages } = createSender();
    const store = createStore(true, false, { managedMessages: [{ messageKey: "welcome", content: "رسالة ترحيب تجريبية معتمدة من لوحة الإدارة." }] });
    await handleTelegramUpdate({ message: { chat: { id: 12, type: "private" }, text: "/start" } }, store, sender);
    await handleTelegramUpdate({ message: { chat: { id: 12, type: "private" }, text: "/start" } }, store, sender);
    expect(messages[1]?.text).toBe("رسالة ترحيب تجريبية معتمدة من لوحة الإدارة.");
  });

  it("يسجل أوامر الاختبارات السريعة من دون أوامر اللغة أو المساعدة في القائمة الجانبية", () => {
    const commands = JSON.stringify(BOT_COMMANDS);
    expect(commands).toContain('"command":"newquiz"');
    expect(commands).toContain('"command":"quizzes"');
    expect(commands).toContain('"command":"stop"');
    expect(commands).not.toContain('"command":"lang"');
    expect(commands).not.toContain('"command":"help"');
  });

  it("ينفذ /newquiz و/quizzes ويجهز اختبار المجموعة من الأمر السريع", async () => {
    const { sender, messages } = createSender();
    const store = createStore();
    await handleTelegramUpdate({ message: { from: { id: 12 }, chat: { id: 12, type: "private" }, text: "/newquiz" } }, store, sender);
    expect(messages.at(-1)?.text).toContain("/newquiz");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:level:l1");

    await handleTelegramUpdate({ message: { from: { id: 12 }, chat: { id: 12, type: "private" }, text: "/quizzes" } }, store, sender);
    expect(messages.at(-1)?.text).toContain("/quizzes");

    await handleTelegramUpdate({ message: { from: { id: 12 }, chat: { id: -2001, type: "supergroup" }, text: "/newquiz" } }, store, sender);
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("gexam:open");
  });

  it("يحافظ على ترتيب المستويات ويُبقي بوابة التأهيل فارغة مع حالة قريبًا", async () => {
    expect(TELEGRAM_EXAM_CATALOG.map(level => level.name)).toEqual([
      "المستوى الأول",
      "المستوى الثاني",
      "المستوى الثالث",
      "المستوى الرابع",
      "اختبارات الثانوية العامة",
      "ثالث ثانوي – القسم الأدبي",
      "ثالث ثانوي – القسم العلمي",
      "بوابة التأهيل القضائي والأكاديمي",
    ]);
    expect(TELEGRAM_EXAM_CATALOG.flatMap(level => level.subjects)).toHaveLength(76);
    expect(TELEGRAM_EXAM_CATALOG[0]?.subjects.slice(0, 3).map(subject => subject.name)).toEqual(["اصول الفقه", "علم الاجرام والعقاب", "النظم السياسية"]);
    expect(TELEGRAM_EXAM_CATALOG[3]?.subjects[10]).toMatchObject({ name: "القانون المدني", hasQuestions: true });
    expect(TELEGRAM_EXAM_CATALOG[4]).toMatchObject({ name: "اختبارات الثانوية العامة", hidden: true });
    expect(TELEGRAM_EXAM_CATALOG[5]?.subjects.map(subject => subject.key)).toEqual(["history", "geography", "philosophy", "islamic", "arabic", "quran", "english", "math"]);
    expect(TELEGRAM_EXAM_CATALOG[6]?.subjects.map(subject => subject.key)).toEqual(["quran", "islamic", "arabic", "english", "biology", "physics", "chemistry"]);
    expect(TELEGRAM_EXAM_CATALOG[7]).toMatchObject({ name: "بوابة التأهيل القضائي والأكاديمي", subjects: [], comingSoon: true });

    const { sender, messages } = createSender();
    await handleTelegramUpdate(
      { callback_query: { id: "empty-subject", data: "exam:subject:l1:l1-criminology:1", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      createStore(),
      sender
    );
    expect(messages.at(-1)?.text).toContain("علم الاجرام والعقاب");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("2022 العام");

    await handleTelegramUpdate(
      { callback_query: { id: "judicial-academic", data: "exam:level:judicial-academic", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      createStore(),
      sender
    );
    expect(messages.at(-1)?.text).toContain("فارغة حاليًا");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("قريبًا");
  });

  it("يفصل اختبارات الثانوية إلى الأدبي والعلمي ويبدأ نموذجًا محليًا من كل قسم", async () => {
    const { sender, messages, polls } = createSender();
    const store = createStore();
    const callback = (id: string, data: string) => handleTelegramUpdate(
      { callback_query: { id, data, from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );

    await callback("secondary-menu", "secondary-exams");
    const sectionsMenu = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(messages.at(-1)?.text).toContain("🧮 اختبارات الثانوية العامة");
    expect(messages.at(-1)?.text).toContain("نماذج أوائل الجمهورية اليمنية للصف الثالث ثانوي للعام الدراسي 2025م—2026م");
    expect(messages.at(-1)?.text).toContain("اختر القسم المطلوب.");
    expect(sectionsMenu).toContain("exam:level:secondary-literary");
    expect(sectionsMenu).toContain("exam:level:secondary-scientific");
    expect(sectionsMenu).not.toContain("exam:subject:secondary:");

    await callback("literary-level", "exam:level:secondary-literary");
    const literarySubjects = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(literarySubjects).toContain("exam:subject:secondary-literary:history:1");
    expect(literarySubjects).not.toContain("biology");
    await callback("literary-next", "exam:level:secondary-literary:2");
    const literarySubjectsPageTwo = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(literarySubjectsPageTwo).toContain("exam:subject:secondary-literary:math:2");

    await callback("literary-math", "exam:subject:secondary-literary:math:2");
    expect(messages.at(-1)?.text).toContain("نماذج أوائل الجمهورية اليمنية مادة الرياضيات للعام الدراسي 2023م");
    const literaryForms = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(literaryForms).toContain("exam:form:secondary-literary:math:2:1");

    await callback("literary-form", "exam:form:secondary-literary:math:2:1");
    expect(messages.at(-1)?.text).toContain("النموذج الثاني — رياضيات أدبي");
    const literaryTimeMenu = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(literaryTimeMenu).toContain("exam:time:exam_secondary_literary_math:2:15");
    expect(literaryTimeMenu.length).toBeLessThan(4096);

    await callback("literary-time", "exam:time:exam_secondary_literary_math:2:15");
    await callback("literary-ready", "exam:ready:91");
    expect(polls.at(-1)?.question).toContain("[1/2]");

    await callback("scientific-level", "exam:level:secondary-scientific");
    const scientificSubjects = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(scientificSubjects).toContain("exam:subject:secondary-scientific:biology:1");
    expect(scientificSubjects).toContain("exam:subject:secondary-scientific:physics:1");
    expect(scientificSubjects).toContain("exam:subject:secondary-scientific:chemistry:1");
    expect(scientificSubjects).not.toContain("math");

    await callback("scientific-physics", "exam:subject:secondary-scientific:physics:1");
    expect(messages.at(-1)?.text).toContain("الفيزياء");
    const scientificForms = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(scientificForms).toContain("2026 النموذج 1");
    expect(scientificForms).toContain("2026 النموذج 2");
    expect(scientificForms).toContain("2026 النموذج 3");
    expect(scientificForms).not.toContain("🧪 أسئلة تجريبية");
    expect(scientificForms.indexOf("2026 النموذج 1")).toBeLessThan(scientificForms.indexOf("2026 النموذج 2"));
    expect(scientificForms.indexOf("2026 النموذج 2")).toBeLessThan(scientificForms.indexOf("2026 النموذج 3"));
    expect(scientificForms).toContain("exam:form:secondary-scientific:physics:2026001:1");

    await callback("scientific-form", "exam:form:secondary-scientific:physics:2026001:1");
    expect(messages.at(-1)?.text).toContain("2026 النموذج 1");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:time:exam_secondary_scientific_physics:2026001:15");
  });

  it("يبقي سؤال الحفظ رقم 47 في نموذج القرآن الكريم نصًا كتابيًا ثم ينهي الاختبار بلا خيارات", async () => {
    const { sender, messages, polls } = createSender();
    const store = createStore(true, false, { secondaryQuranWrittenQuestion: true });
    const callback = (id: string, data: string) => handleTelegramUpdate(
      { callback_query: { id, data, from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );

    await callback("secondary-quran", "exam:subject:secondary-literary:quran:1");
    expect(messages.at(-1)?.text).toContain("نماذج أوائل الجمهورية اليمنية مادة القرآن الكريم للعام الدراسي 2025—2026م");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("النموذج الرابع - قرآن كريم أدبي");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("النموذج السابع - قرآن كريم أدبي");
    await callback("secondary-quran-form", "exam:form:secondary-literary:quran:secondary_quran_model_1:1");
    await callback("secondary-quran-time", "exam:time:exam_secondary_literary_quran:secondary_quran_model_1:15");
    await callback("secondary-quran-ready", "exam:ready:91");
    expect(polls.at(-1)?.question).toContain("[1/2]");

    await handleTelegramUpdate({ poll_answer: { poll_id: "poll-1", user: { id: 12 }, option_ids: [0] } }, store, sender);
    expect(messages.at(-1)?.text).toContain("[2/2]");
    expect(messages.at(-1)?.text).toContain("اكتب (احفظ ورقة الأسئلة)");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:written-next:91");
    expect(polls).toHaveLength(1);

    await callback("secondary-quran-written-next", "exam:written-next:91");
    expect(messages.at(-1)?.text).toContain("🏁 انتهى الاختبار");
    expect(messages.at(-1)?.text).toContain("🎯 النتيجة: 1/1 (100%)");
  });

  it("يعرض خياري الصح والخطأ في الثانوية بعبارات كاملة من دون تغيير مفتاح الإجابة", () => {
    expect(examPollOptionText("exam_secondary_arabic", "A", "ص")).toBe("الإجابة صحيحة");
    expect(examPollOptionText("exam_secondary_arabic", "B", "خ")).toBe("الإجابة خاطئة");
    expect(examPollOptionText("exam_secondary_arabic", "C", "خيار ثالث")).toBe("خيار ثالث");
    expect(examPollOptionText("civil_law", "A", "ص")).toBe("ص");
  });

  it("يؤكد ضغط الزر قبل أي تحقق خارجي من عضوية القنوات", async () => {
    const { sender, callbacks, messages } = createSender();
    const membershipChecker = {
      check: async () => {
        expect(callbacks).toContain("menu-after-proof");
        return "subscribed" as const;
      },
    };

    await handleTelegramUpdate(
      { callback_query: { id: "menu-after-proof", data: "menu", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      createStore(),
      sender,
      undefined,
      membershipChecker
    );
    expect(messages[0]?.text).toContain("بوت الناصر القانوني");
  });

  it("ينفذ اختبار القانون المدني كاستطلاع مؤقت مع إجابة فائتة ونتيجة تفصيلية", async () => {
    const { sender, messages, polls } = createSender();
    const store = createStore();
    const callback = (id: string, data: string) => handleTelegramUpdate(
      { callback_query: { id, data, from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );

    await callback("exam-menu", "exams");
    expect(messages[0]?.text).toContain("📝 اختبارات الشريعة والقانون");
    expect(messages[0]?.text).toContain("بنك أسئلة مؤتمت ونماذج أسئلة تجريبية");
    expect(messages[0]?.text).toContain("اختر المادة من القائمة أدناه أو استخدم الأمر المناسب.");
    expect(messages[0]?.text).not.toContain("/newquiz");
    expect(messages[0]?.text).not.toContain("/quizzes");
    expect(messages[0]?.text).not.toContain("/stop");
    expect(messages[0]?.text).not.toContain("/help");
    expect(messages[0]?.text).not.toContain("/lang");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("exam:level:l1");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("exam:level:l4");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("exam:level:judicial-academic");

    await callback("level-four", "exam:level:l4:2");
    expect(messages[1]?.text).toContain("المستوى الرابع");
    expect(JSON.stringify(messages[1]?.replyMarkup)).toContain("exam:subject:l4:l4-civil-law:2");

    await callback("exam-civil", "exam:subject:l4:l4-civil-law:2");
    expect(messages[2]?.text).toContain("القانون المدني");
    expect(JSON.stringify(messages[2]?.replyMarkup)).toContain("2025 العام");

    await callback("exam-section", "exam:form:l4:l4-civil-law:general_2025:1");
    expect(messages[3]?.text).toContain("⚙️ تجهيز الاختبار");
    expect(messages[3]?.text).toContain("📝 عدد الأسئلة: 2");
    expect(messages[3]?.text).toContain("لن يُرسل السؤال الأول قبل تأكيدك");
    expect(JSON.stringify(messages[3]?.replyMarkup)).toContain("exam:time:civil_law:20251:15");

    await callback("exam-time", "exam:time:civil_law:20251:15");
    expect(messages[4]?.text).toContain("15 ث لكل سؤال");
    expect(JSON.stringify(messages[4]?.replyMarkup)).toContain("▶️ ابدأ الآن");

    await callback("exam-ready", "exam:ready:91");
    expect(polls[0]?.question).toContain("[1/2]");
    expect(polls[0]?.openPeriodSeconds).toBe(15);
    expect(polls[0]?.explanation).toContain("سيظهر الشرح المفصل");

    await handleTelegramUpdate({ poll_answer: { poll_id: "poll-1", user: { id: 12 }, option_ids: [2] } }, store, sender);
    expect(messages.at(-1)?.text).toContain("الشرح المفصل");
    expect(polls[1]?.question).toContain("[2/2]");

    await handleTelegramUpdate({ poll: { id: "poll-2", is_closed: true } }, store, sender);
    const result = messages.at(-1)?.text ?? "";
    expect(result).toContain("🏁 انتهى الاختبار");
    expect(result).toContain("📊 ملخص المحاولة");
    expect(result).toContain("✅ الصحيحة: 1");
    expect(result).toContain("⏳ الفائتة: 1");
    expect(result).toContain("🎯 النتيجة: 1/2 (50%)");
    expect(result).toContain("🏅 أفضل نتيجة سابقة لك");
    expect(result).toContain("🏆 أفضل نتيجة محتسبة للترتيب");
    expect(result).toContain("📈 ترتيبك: المركز 1 من أصل 1");
    expect(result).not.toContain("لن يتغير ترتيبك");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:retry");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:forms:l4:l4-civil-law:1");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:level:l4");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain('"callback_data":"menu"');
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("t.me/share/url");

    await callback("exam-retry", "exam:retry");
    expect(messages.at(-1)?.text).toContain("اختر المدة");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:time:30");
  });

  it("يحدّث بطاقة تجهيز الاختبار وبطاقة الاستعداد داخل الرسالة نفسها", async () => {
    const { sender, messages, editedMessages } = createSender();
    const store = createStore();
    const callback = (id: string, data: string) => handleTelegramUpdate(
      {
        callback_query: {
          id,
          data,
          from: { id: 12 },
          message: { message_id: 700, chat: { id: 12, type: "private" } },
        },
      },
      store,
      sender
    );

    await callback("same-message-form", "exam:form:l4:l4-civil-law:general_2025:1");
    expect(messages).toHaveLength(0);
    expect(editedMessages.at(-1)?.messageId).toBe(700);
    expect(editedMessages.at(-1)?.text).toContain("⚙️ تجهيز الاختبار");

    await callback("same-message-time", "exam:time:civil_law:20251:30");
    expect(messages).toHaveLength(0);
    expect(editedMessages.at(-1)?.messageId).toBe(700);
    expect(editedMessages.at(-1)?.text).toContain("✅ تم إعداد الاختبار");
    expect(JSON.stringify(editedMessages.at(-1)?.replyMarkup)).toContain("▶️ ابدأ الآن");
  });

  it("يعرض التلميح عند الإجابة الخاطئة فقط قبل الإجابة الصحيحة والشرح", async () => {
    const { sender, messages, polls } = createSender();
    const store = createStore();
    const callback = (id: string, data: string) => handleTelegramUpdate(
      { callback_query: { id, data, from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );

    await callback("exam-time-direct", "exam:time:15");
    await callback("exam-ready-direct", "exam:ready:91");
    await handleTelegramUpdate({ poll_answer: { poll_id: "poll-1", user: { id: 12 }, option_ids: [0] } }, store, sender);
    const wrongFeedback = messages.at(-1)?.text ?? "";
    expect(wrongFeedback).toContain("💡 التلميح:");
    expect(wrongFeedback.indexOf("💡 التلميح:")).toBeLessThan(wrongFeedback.indexOf("الإجابة الصحيحة:"));
    expect(wrongFeedback.indexOf("الإجابة الصحيحة:")).toBeLessThan(wrongFeedback.indexOf("📖 الشرح المفصل:"));
    expect(wrongFeedback).toContain("الإجابة الصحيحة: ج.");
    expect(wrongFeedback).not.toContain("الإجابة الصحيحة: C.");
    expect(polls[1]?.question).toContain("[2/2]");

    await handleTelegramUpdate({ poll_answer: { poll_id: "poll-2", user: { id: 12 }, option_ids: [1] } }, store, sender);
    const correctFeedback = messages.at(-2)?.text ?? "";
    expect(correctFeedback).toContain("✅ إجابتك صحيحة.");
    expect(correctFeedback).toContain("الإجابة الصحيحة: ب.");
    expect(correctFeedback).not.toContain("الإجابة الصحيحة: B.");
    expect(correctFeedback).toContain("📖 الشرح المفصل:");
    expect(correctFeedback).not.toContain("💡 التلميح:");
  });

  it("يعيد أمر إيقاف الاختبار إلى نماذج المادة التي أُوقفت بدل القانون المدني", async () => {
    const { sender, messages } = createSender();
    const store = createStore();
    await handleTelegramUpdate(
      { callback_query: { id: "criminology-time", data: "exam:time:l1_criminology:general_2022:15", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    await handleTelegramUpdate(
      { message: { from: { id: 12 }, chat: { id: 12, type: "private" }, text: "/stop" } },
      store,
      sender
    );

    expect(messages.at(-1)?.text).toContain("علم الاجرام والعقاب");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:form:l1:l1-criminology:");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).not.toContain("exam:civil");
  });

  it("يعرض نماذج اصول الفقه المستوردة ويبدأ النموذج المحدد بالمدة المختارة", async () => {
    const { sender, messages, polls } = createSender();
    const store = createStore();
    const callback = (id: string, data: string) => handleTelegramUpdate(
      { callback_query: { id, data, from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );

    await callback("level-one", "exam:level:l1");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:subject:l1:l1-usul:1");
    await callback("usul-subject", "exam:subject:l1:l1-usul:1");
    expect(messages.at(-1)?.text).toContain("اصول الفقه");
    const annualUsulMenu = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(annualUsulMenu).toContain("2022 العام");
    expect(annualUsulMenu).toContain("2023 العام");
    expect(annualUsulMenu).toContain("2024 العام");
    expect(annualUsulMenu).toContain("2024 الموازي");
    expect(annualUsulMenu).toContain("2025 العام");
    expect(annualUsulMenu).toContain("2025 الموازي");
    expect(annualUsulMenu).not.toContain("القسم الأول");
    expect(annualUsulMenu).toContain("🧪 أسئلة تجريبية");
    await callback("usul-training", "exam:training:l1:l1-usul:1");
    expect(messages.at(-1)?.text).toContain("الأسئلة التجريبية ستكون متاحة قريبًا");
    const usulTrainingMenu = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(usulTrainingMenu).toContain("رجوع إلى النماذج الأساسية");
    expect(usulTrainingMenu).not.toContain("القسم الأول");
    await callback("usul-form", "exam:form:l1:l1-usul:106:1");
    expect(messages.at(-1)?.text).toContain("الموازي 2025");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:time:l1_usul_fiqh:106:15");
    await callback("usul-time", "exam:time:l1_usul_fiqh:106:15");
    expect(messages.at(-1)?.text).toContain("✅ تم إعداد الاختبار");
    expect(messages.at(-1)?.text).toContain("📚 المادة: اصول الفقه");
    expect(messages.at(-1)?.text).toContain("📄 النموذج: الموازي 2025");
    await callback("usul-ready", "exam:ready:91");
    expect(polls.at(-1)?.question).toContain("[1/2]");
  });

  it("يعرض نماذج علم الاجرام والعقاب المستوردة ويبدأ النموذج السنوي", async () => {
    const { sender, messages, polls } = createSender();
    const store = createStore();
    const callback = (id: string, data: string) => handleTelegramUpdate(
      { callback_query: { id, data, from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );

    await callback("criminology-subject", "exam:subject:l1:l1-criminology:1");
    expect(messages.at(-1)?.text).toContain("علم الاجرام والعقاب");
    const annualCriminologyMenu = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(annualCriminologyMenu).toContain("2022 العام");
    expect(annualCriminologyMenu).toContain("2023 العام");
    expect(annualCriminologyMenu).toContain("2024 العام");
    expect(annualCriminologyMenu).toContain("2024 الموازي");
    expect(annualCriminologyMenu).toContain("2025 العام");
    expect(annualCriminologyMenu).toContain("2025 الموازي");
    expect(annualCriminologyMenu).not.toContain("المختلط 2025");
    expect(annualCriminologyMenu).toContain("🧪 أسئلة تجريبية");
    await callback("criminology-training", "exam:training:l1:l1-criminology:1");
    expect(messages.at(-1)?.text).toContain("الأسئلة التجريبية ستكون متاحة قريبًا");
    const criminologyTrainingMenu = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(criminologyTrainingMenu).toContain("رجوع إلى النماذج الأساسية");
    expect(criminologyTrainingMenu).not.toContain("القسم الأول");
    await callback("criminology-form", "exam:form:l1:l1-criminology:general_2022:1");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("exam:time:l1_criminology:100:15");
    await callback("criminology-time", "exam:time:l1_criminology:general_2022:30");
    expect(messages.at(-1)?.text).toContain("✅ تم إعداد الاختبار");
    expect(messages.at(-1)?.text).toContain("📚 المادة: علم الاجرام والعقاب");
    expect(messages.at(-1)?.text).toContain("📄 النموذج: العام 2022");
    await callback("criminology-ready", "exam:ready:91");
    expect(polls.at(-1)?.question).toContain("[1/2]");
  });

  it("لا يعرض نموذجًا مفهرسًا بلا أسئلة في القائمة الرئيسية", async () => {
    const { sender, messages } = createSender();
    const store = createStore();
    const callback = (id: string, data: string) => handleTelegramUpdate(
      { callback_query: { id, data, from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );

    await callback("political-subject", "exam:subject:l1:l1-political-systems:1");
    expect(messages.at(-1)?.text).toContain("النظم السياسية");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).not.toContain("2025 العام");
    await callback("political-form", "exam:form:l1:l1-political-systems:general_2025:1");
    expect(messages.at(-1)?.text).toContain("لا تتوافر أسئلة هذا النموذج حاليًا");
  });

  it("يبدأ اختبارًا جماعيًا بعد اختيار المدة واستعداد ثلاثة أعضاء ويعرض ترتيبهم بعد الجولة", async () => {
    const { sender, messages, polls } = createSender();
    const store = createStore();
    const callback = (id: string, data: string, userId: number, firstName: string) => handleTelegramUpdate(
      { callback_query: { id, data, from: { id: userId, first_name: firstName }, message: { chat: { id: -1001, type: "supergroup" } } } },
      store,
      sender
    );

    await handleTelegramUpdate({ message: { from: { id: 11, first_name: "أحمد" }, chat: { id: -1001, type: "supergroup" }, text: "/start groupquiz" } }, store, sender);
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("gexam:open");
    await callback("group-open", "gexam:open", 11, "أحمد");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("gexam:time:15");
    await callback("group-time", "gexam:time:15", 11, "أحمد");
    expect(messages.at(-1)?.text).toContain("بطاقة استعداد");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("gexam:ready:301");

    await callback("group-ready-1", "gexam:ready:301", 11, "أحمد");
    expect(messages.at(-1)?.text).toContain("1 من 3");
    await callback("group-ready-2", "gexam:ready:301", 12, "بدر");
    expect(messages.at(-1)?.text).toContain("2 من 3");
    await callback("group-ready-3", "gexam:ready:301", 13, "خالد");
    expect(messages.at(-1)?.text).toContain("بدأت الجولة الجماعية");
    expect(polls[0]?.question).toContain("[1/2]");
    expect(polls[0]?.openPeriodSeconds).toBe(15);

    await handleTelegramUpdate({ poll_answer: { poll_id: "poll-1", user: { id: 11 }, option_ids: [2] } }, store, sender);
    await handleTelegramUpdate({ poll_answer: { poll_id: "poll-1", user: { id: 12 }, option_ids: [0] } }, store, sender);
    await handleTelegramUpdate({ poll: { id: "poll-1", is_closed: true } }, store, sender);
    expect(messages.at(-1)?.text).toContain("نتائج السؤال 1 من 2");
    expect(messages.at(-1)?.text).toContain("صحيحة: 1");
    expect(messages.at(-1)?.text).toContain("خاطئة: 1");
    expect(messages.at(-1)?.text).toContain("فائتة: 1");
    expect(messages.at(-1)?.text).toContain("الإجابة الصحيحة: ج.");
    expect(messages.at(-1)?.text).not.toContain("الإجابة الصحيحة: C.");
    expect(polls[1]?.question).toContain("[2/2]");

    await handleTelegramUpdate({ poll_answer: { poll_id: "poll-2", user: { id: 11 }, option_ids: [1] } }, store, sender);
    await handleTelegramUpdate({ poll_answer: { poll_id: "poll-2", user: { id: 12 }, option_ids: [0] } }, store, sender);
    await handleTelegramUpdate({ poll: { id: "poll-2", is_closed: true } }, store, sender);
    const result = messages.at(-1)?.text ?? "";
    expect(result).toContain("انتهت الجولة الجماعية");
    expect(result).toContain("لوحة المتصدرين");
    expect(result).toContain("1. أحمد — ✅ 2");
    expect(result).toContain("2. خالد — ✅ 0 | ❌ 0 | ⌛️ 2");
    expect(result).toContain("3. بدر — ✅ 0 | ❌ 2 | ⌛️ 0");
  });

  it("يقصر إنهاء الجولة الجماعية على منشئها أو مشرف المجموعة", async () => {
    const base = createSender();
    const store = createStore();
    const creatorCallback = (id: string, data: string) => handleTelegramUpdate(
      { callback_query: { id, data, from: { id: 11, first_name: "أحمد" }, message: { chat: { id: -1002, type: "supergroup" } } } },
      store,
      base.sender
    );

    await creatorCallback("open", "gexam:open");
    await creatorCallback("time", "gexam:time:30");
    await handleTelegramUpdate(
      { callback_query: { id: "non-owner-cancel", data: "gexam:cancel:301", from: { id: 12, first_name: "بدر" }, message: { chat: { id: -1002, type: "supergroup" } } } },
      store,
      base.sender
    );
    expect(base.messages.at(-1)?.text).toContain("منشئها أو لمشرفي المجموعة");

    const adminSender: TelegramSender = { ...base.sender, isChatAdministrator: async (_chatId, userId) => userId === "99" };
    await handleTelegramUpdate(
      { callback_query: { id: "admin-cancel", data: "gexam:cancel:301", from: { id: 99, first_name: "المشرف" }, message: { chat: { id: -1002, type: "supergroup" } } } },
      store,
      adminSender
    );
    expect(base.messages.at(-1)?.text).toContain("تم إنهاء الجولة الجماعية");
  });

  it("يفرض الاشتراك في القناة قبل الوصول إلى خدمات البوت", async () => {
    const { sender, messages } = createSender();
    const subscriptions: Record<string, boolean> = { "@muen2025": true, "@hasadalyoum": false };
    const membershipChecker = { check: async (_telegramUserId: string, channelHandle: string) => subscriptions[channelHandle] ? "subscribed" as const : "not_subscribed" as const };

    await handleTelegramUpdate({ message: { from: { id: 42 }, chat: { id: 12 }, text: "/browse" } }, createStore(), sender, undefined, membershipChecker);
    expect(messages[0]?.text).toContain("🔐 لم يكتمل التحقق من متطلبات استخدام البوت");
    expect(messages[0]?.text).toContain("✅ قناة منصة الناصر القانونية (@muen2025): مكتمل");
    expect(messages[0]?.text).toContain("❌ قناة حصاد اليوم الإخباري (@hasadalyoum): لم يكتمل الاشتراك");
    expect(messages[0]?.text).toContain("✅ منصة الناصر القانونية: تمت الزيارة والتحقق");
    const firstGateMarkup = JSON.stringify(messages[0]?.replyMarkup);
    expect(firstGateMarkup).toContain("https://t.me/muen2025");
    expect(firstGateMarkup).toContain("https://t.me/hasadalyoum");
    expect(firstGateMarkup).toContain('"web_app":{"url":"https://alnasser-legal-telegram-bot-supabase-git-sup-f04e08-hasadalyoum.vercel.app/telegram-platform-visit.html"}');
    expect(firstGateMarkup).toContain("فتح منصة الناصر القانونية والتحقق");
    expect(firstGateMarkup).toContain("channel:check");
    expect(firstGateMarkup.indexOf("https://t.me/muen2025")).toBeLessThan(firstGateMarkup.indexOf("https://t.me/hasadalyoum"));
    expect(firstGateMarkup.indexOf("https://t.me/hasadalyoum")).toBeLessThan(firstGateMarkup.indexOf('"web_app":{"url":"https://alnasser-legal-telegram-bot-supabase-git-sup-f04e08-hasadalyoum.vercel.app/telegram-platform-visit.html"}'));

    subscriptions["@hasadalyoum"] = true;
    await handleTelegramUpdate(
      { callback_query: { id: "callback-channel", data: "channel:check", from: { id: 42 }, message: { chat: { id: 12 } } } },
      createStore(),
      sender,
      undefined,
      membershipChecker
    );
    expect(messages[1]?.text).toContain("بوت الناصر القانوني");
  });

  it("يوضح تعذر التحقق من اشتراك القناة ولا يسمح بتجاوز البوابة", async () => {
    const { sender, messages } = createSender();
    const membershipChecker = { check: async () => "unavailable" as const };

    await handleTelegramUpdate({ message: { from: { id: 42 }, chat: { id: 12 }, text: "/start" } }, createStore(), sender, undefined, membershipChecker);
    expect(messages[0]?.text).toContain("منصة معرفية وتعليمية بإشراف أ. معين الناصر");
    expect(messages[1]?.text).toContain("⚠️ قناة منصة الناصر القانونية (@muen2025): تعذر التحقق حاليًا");
    expect(messages[1]?.text).toContain("⚠️ قناة حصاد اليوم الإخباري (@hasadalyoum): تعذر التحقق حاليًا");
    expect(JSON.stringify(messages[1]?.replyMarkup)).toContain("channel:check");
  });

  it("يعرض البحث الموحد ويحفظ طلب الدعم داخل تدفق خاص", async () => {
    const { sender, messages } = createSender();
    const store = createStore();

    await handleTelegramUpdate({ callback_query: { id: "callback-search", data: "search", message: { chat: { id: 12 } } } }, store, sender);
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("search:library");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("jsearch");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("lsearch");

    await handleTelegramUpdate({ callback_query: { id: "callback-library-search", data: "search:library", message: { chat: { id: 12 } } } }, store, sender);
    expect(messages[1]?.text).toContain("البحث في المكتبة الرقمية");

    await handleTelegramUpdate({ message: { chat: { id: 12 }, text: "مكتبة" } }, store, sender);
    expect(messages[2]?.text).toContain("نتائج «مكتبة» داخل المكتبة الرقمية");
    expect(JSON.stringify(messages[2]?.replyMarkup)).toContain("source:7");

    await handleTelegramUpdate({ message: { chat: { id: 12 }, text: "/support أحتاج مرجعاً جديداً" } }, store, sender);
    expect(messages[3]?.text).toContain("تم حفظ طلبك للمراجعة");
  });

  it("يعرض أقسام أحدث الإضافات والأكثر طلبًا وفهرس المراجع المميزة", async () => {
    const { sender, messages } = createSender();
    const store = createStore();

    await handleTelegramUpdate({ callback_query: { id: "callback-latest", data: "latest", message: { chat: { id: 12 } } } }, store, sender);
    expect(messages[0]?.text).toContain("أحدث الإضافات");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("source:8");

    await handleTelegramUpdate({ callback_query: { id: "callback-popular", data: "popular", message: { chat: { id: 12 } } } }, store, sender);
    expect(messages[1]?.text).toContain("الأكثر طلبًا");
    expect(JSON.stringify(messages[1]?.replyMarkup)).toContain("source:7");

    await handleTelegramUpdate({ callback_query: { id: "callback-featured", data: "featured", message: { chat: { id: 12 } } } }, store, sender);
    expect(messages[2]?.text).toContain("مراجع مميزة");
    expect(messages[2]?.text).toContain("اختر المرجع أو الملف المطلوب");
    expect(messages[2]?.text).not.toContain("المسار:");
    expect(messages[2]?.text).not.toContain("الصفحة");
    expect(JSON.stringify(messages[2]?.replyMarkup)).toContain("rfile:11:17QASX45F7JlN4EIYICMUHN2NtfsEvuIu:1");
  });

  it("يستبعد ملفات القسم المدفوع من أحدث الإضافات ويمنع طلبها من زر عام دون اعتماد", async () => {
    const { sender, messages, documents } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    const store = createStore(true, false, { recentSources: [importantYemeniLawsSource, legislationSource] });

    await handleTelegramUpdate({ callback_query: { id: "callback-latest-public", data: "latest", message: { chat: { id: 12, type: "private" } } } }, store, sender, provider);
    expect(messages[0]?.text).toContain("أحدث الإضافات");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("source:8");
    expect(JSON.stringify(messages[0]?.replyMarkup)).not.toContain("source:12");
    expect(JSON.stringify(messages[0]?.replyMarkup)).not.toContain("أهم القوانين اليمنية التفاعلي.doc");

    await handleTelegramUpdate({ callback_query: { id: "callback-paid-source-public", data: "source:12", message: { chat: { id: 12, type: "private" } } } }, store, sender, provider);
    expect(messages[1]?.text).toContain("قسم خاص");
    expect(requestedSources).toEqual([]);
    expect(documents).toEqual([]);
  });

  it("يفلتر التشريعات اليمنية حسب النوع والسنة من بيانات وصفية فعلية", async () => {
    const { sender, messages } = createSender();
    const store = createStore();

    await handleTelegramUpdate({ callback_query: { id: "callback-filters", data: "lfilters", message: { chat: { id: 12 } } } }, store, sender);
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("ltypes");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("lyears");

    await handleTelegramUpdate({ callback_query: { id: "callback-years", data: "lyears", message: { chat: { id: 12 } } } }, store, sender);
    expect(JSON.stringify(messages[1]?.replyMarkup)).toContain("lyear:2002:1");

    await handleTelegramUpdate({ callback_query: { id: "callback-year", data: "lyear:2002:1", message: { chat: { id: 12 } } } }, store, sender);
    expect(messages[2]?.text).toContain("تشريعات سنة 2002");
    expect(JSON.stringify(messages[2]?.replyMarkup)).toContain("source:8");
  });

  it("يعرض الإحصاءات وطلبات الدعم للمالك المهيأ فقط", async () => {
    const { sender, messages } = createSender();
    const ownerId = process.env.TELEGRAM_OWNER_ID ?? "";

    await handleTelegramUpdate({ message: { from: { id: Number(ownerId) }, chat: { id: 12 }, text: "/stats" } }, createStore(), sender);
    expect(messages[0]?.text).toContain("إحصاءات المالك");

    await handleTelegramUpdate({ message: { from: { id: Number(ownerId) }, chat: { id: 12 }, text: "/supportrequests" } }, createStore(), sender);
    expect(messages[1]?.text).toContain("طلبات الدعم الجديدة");
  });

  it("يعرض فهرس التشريعات اليمنية ويبحث فيه ويسلم ملفه خاصًا", async () => {
    const { sender, messages, documents } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "callback-legislation", data: "legislation", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("التشريعات اليمنية");
    expect(messages[0]?.text).toContain("اختر التشريع أو الملف المطلوب");
    expect(messages[0]?.text).not.toContain("المسار:");
    expect(messages[0]?.text).not.toContain("الصفحة");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("lfile:8:1bEkLg2uaeQOULqZi6yIEfU0aKtMMB3J4:1");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("lsearch");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-legislation-search", data: "lsearch", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages[1]?.text).toContain("البحث السريع في التشريعات اليمنية");
    expect(JSON.stringify(messages[1]?.replyMarkup)).toContain("lq:تحكيم");

    await handleTelegramUpdate({ message: { chat: { id: 12, type: "private" }, text: "تحكيم" } }, store, sender, provider);
    expect(messages[2]?.text).toContain("نتائج «تحكيم» داخل التشريعات اليمنية");
    expect(JSON.stringify(messages[2]?.replyMarkup)).toContain("lresultfile:8:26:1");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-legislation-file", data: "lresultfile:8:26:1", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(requestedSources[0]?.id).toBe(legislationSource.id);
    expect(documents).toEqual([{ chatId: 12, filename: legislationSource.title, caption: `مستورد من مكتبة أ. معين الناصر\n${legislationSource.title}` }]);
  });

  it("يوجه مسار فهرس القوانين اليمنية القديم إلى بوابة الاشتراك ويعرضه داخل القسم المقيد بعد الاعتماد", async () => {
    const { sender, messages, documents } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "callback-yemeni-laws", data: "yemeni-laws", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages[0]?.text).toContain("قسم خاص");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("important-laws:request");
    expect(documents).toEqual([]);

    const approvedStore = createStore(true, true);
    const approvedSender = createSender();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-important-laws-approved", data: "important-laws", message: { chat: { id: 12, type: "private" } } } },
      approvedStore,
      approvedSender.sender,
      provider
    );
    expect(approvedSender.messages[0]?.text).toContain("المجلدات الفرعية: 1");
    expect(JSON.stringify(approvedSender.messages[0]?.replyMarkup)).toContain("iindex:15ZWnJtqszUggVJcQVsyyfZZRXGtUgK0J:1");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-yemeni-laws-file", data: "ifile:9:15ZWnJtqszUggVJcQVsyyfZZRXGtUgK0J:1", message: { chat: { id: 12, type: "private" } } } },
      approvedStore,
      approvedSender.sender,
      provider
    );
    expect(requestedSources[0]?.id).toBe(yemeniLawsSource.id);
    expect(approvedSender.documents).toEqual([{ chatId: 12, filename: yemeniLawsSource.title, caption: `مستورد من مكتبة أ. معين الناصر\n${yemeniLawsSource.title}` }]);
  });

  it("يعرض فهرس النماذج والصيغ القانونية بأسماء ملفات منظفة ويسلم الملف في المحادثة الخاصة", async () => {
    const { sender, messages, documents } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "callback-legal-forms", data: "legal-forms", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("نماذج وصيغ قانونية");
    expect(messages[0]?.text).toContain("اختر النموذج أو العقد المطلوب");
    expect(messages[0]?.text).not.toContain("المسار:");
    expect(messages[0]?.text).not.toContain("الصفحة");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("مذكره بالرد على اسباب الطعن بالنقض ايجارات");
    expect(JSON.stringify(messages[0]?.replyMarkup)).not.toContain(".doc");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("fform:10:1ABgTWPMDWPgj1HmFkRaV9rnTDU4kZ4h9:1");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-legal-forms-file", data: "fform:10:1ABgTWPMDWPgj1HmFkRaV9rnTDU4kZ4h9:1", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(requestedSources[0]?.id).toBe(legalFormsSource.id);
    expect(documents).toEqual([{ chatId: 12, filename: legalFormsSource.title, caption: `مستورد من مكتبة أ. معين الناصر\n${legalFormsSource.title}` }]);
  });

  it("يعرض النماذج المصورة بأسماء مجردة ولا يسلمها إلا عند اختيارها في المحادثة الخاصة", async () => {
    const { sender, messages, documents } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "callback-illustrated-forms", data: "illustrated-legal-forms", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("نماذج مصورة وفق القوانين اليمنية");
    expect(messages[0]?.text).toContain("اختر النموذج المطلوب");
    expect(messages[0]?.text).not.toContain("المسار:");
    expect(messages[0]?.text).not.toContain("17 عنصرًا");
    expect(messages[0]?.text).not.toContain("الصفحة");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("استئناف");
    expect(JSON.stringify(messages[0]?.replyMarkup)).not.toContain("استئناف.pdf");
    expect(JSON.stringify(messages[0]?.replyMarkup)).not.toContain("ملف:");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("vfile:13:17Yx06hL5bJXp2i80qW39n7yys3MqqztT:1");
    expect(documents).toEqual([]);

    await handleTelegramUpdate(
      { callback_query: { id: "callback-illustrated-forms-file", data: "vfile:13:17Yx06hL5bJXp2i80qW39n7yys3MqqztT:1", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(requestedSources[0]?.id).toBe(illustratedLegalFormsSource.id);
    expect(documents).toEqual([{ chatId: 12, filename: illustratedLegalFormsSource.title, caption: "مستورد من مكتبة أ. معين الناصر" }]);
  });

  it("يعرض جميع القوانين اليمنية بأسماء مقروءة ويبحث فيها ويسلمها في المحادثة الخاصة فقط", async () => {
    const { sender, messages, documents } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "callback-all-yemeni-laws", data: "all-yemeni-laws", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("جميع القوانين اليمنية");
    expect(messages[0]?.text).toContain("اختر القانون أو اللائحة المطلوبة");
    expect(messages[0]?.text).not.toContain("146 قانونًا أو لائحة");
    expect(messages[0]?.text).not.toContain("الصفحة");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("قانون الإجراءات الجزائية");
    expect(JSON.stringify(messages[0]?.replyMarkup)).not.toContain("ملف:");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("ayfile:14:all-yemeni-laws-root:1");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-all-yemeni-laws-file", data: "ayfile:14:all-yemeni-laws-root:1", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(requestedSources[0]?.id).toBe(allYemeniLawsSource.id);
    expect(documents).toEqual([{ chatId: 12, filename: allYemeniLawsSource.title, caption: `مستورد من مكتبة أ. معين الناصر\n${allYemeniLawsSource.title}` }]);

    await handleTelegramUpdate(
      { message: { chat: { id: 12, type: "private" }, text: "/qyl جزائية" } },
      store,
      sender,
      provider
    );
    expect(messages.at(-1)?.text).toContain("نتائج «جزائية» داخل جميع القوانين اليمنية");
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("ayresultfile:14:28:1");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-all-yemeni-laws-group", data: "ayfile:14:all-yemeni-laws-root:1", message: { chat: { id: -100, type: "group" } } } },
      store,
      sender,
      provider
    );
    expect(documents).toHaveLength(1);
  });

  it("لا يسلّم النموذج المصور عند طلبه من داخل مجموعة", async () => {
    const { sender, documents } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-illustrated-forms-group", data: "vfile:13:17Yx06hL5bJXp2i80qW39n7yys3MqqztT:1", message: { chat: { id: -100, type: "group" } } } },
      createStore(),
      sender,
      provider
    );
    expect(requestedSources).toEqual([]);
    expect(documents).toEqual([]);
  });

  it("يعرض الصيغ والعقود كأزرار فرعية ولا يرسل ملف Word إلا عند اختيار نموذج محدد", async () => {
    const { sender, messages, documents } = createSender();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "callback-contract-templates", data: "contract-templates", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(messages[0]?.text).toContain("صيغ وعقود قانونية");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("موافقة بالبناء");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("بحث داخل الصيغ والعقود");
    expect(JSON.stringify(messages[0]?.replyMarkup)).not.toContain("ملف:");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("ctemplate:31:1");
    expect(documents).toEqual([]);

    await handleTelegramUpdate(
      { callback_query: { id: "callback-contract-template-file", data: "ctemplate:31:1", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(documents).toEqual([{ chatId: 12, filename: "١ - موافقة بالبناء.docx", caption: "مستورد من مكتبة أ. معين الناصر\n١ - موافقة بالبناء" }]);
  });

  it("يعرض أنواع العقود ويصفّي النماذج حسب النوع المختار من دون إرسال ملف تلقائي", async () => {
    const { sender, messages, documents } = createSender();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "callback-contract-types", data: "ctypes", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(messages[0]?.text).toContain("تصفية حسب نوع العقد");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("عقود مدنية (1)");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("عقود تجارية (1)");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("عقود عمالية (1)");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-contract-commercial", data: "ctype:commercial:1", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(messages[1]?.text).toContain("عقود تجارية");
    expect(JSON.stringify(messages[1]?.replyMarkup)).toContain("عقد إيجار محل");
    expect(JSON.stringify(messages[1]?.replyMarkup)).not.toContain("موافقة بالبناء");
    expect(documents).toEqual([]);
  });

  it("يبحث داخل الصيغ والعقود من المحادثة الخاصة ويعرض النتيجة قبل تسليم الملف", async () => {
    const { sender, messages, documents } = createSender();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "callback-contract-search", data: "ctsearch", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(messages[0]?.text).toContain("اكتب اسم النموذج");
    expect(documents).toEqual([]);

    await handleTelegramUpdate(
      { message: { from: { id: 12 }, chat: { id: 12, type: "private" }, text: "إيجار" } },
      store,
      sender
    );
    expect(messages[1]?.text).toContain("نتائج «إيجار»");
    expect(JSON.stringify(messages[1]?.replyMarkup)).toContain("عقد إيجار محل");
    expect(JSON.stringify(messages[1]?.replyMarkup)).not.toContain("ملف:");
    expect(documents).toEqual([]);

    await handleTelegramUpdate(
      { callback_query: { id: "callback-contract-search-file", data: "ctemplate:32:search:81:1", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(documents).toEqual([{ chatId: 12, filename: "عقد إيجار محل.docx", caption: "مستورد من مكتبة أ. معين الناصر\nعقد_إيجار_محل.docx" }]);
  });

  it("يعرض تطابقًا تقريبيًا أو حالة فارغة عند البحث في الصيغ والعقود", async () => {
    const approximate = createSender();
    const approximateStore = createStore();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-contract-approximate", data: "ctsearch", message: { chat: { id: 12, type: "private" } } } },
      approximateStore,
      approximate.sender
    );
    await handleTelegramUpdate(
      { message: { from: { id: 12 }, chat: { id: 12, type: "private" }, text: "موافقه" } },
      approximateStore,
      approximate.sender
    );
    expect(approximate.messages[1]?.text).toContain("نتائج قريبة");

    const empty = createSender();
    const emptyStore = createStore();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-contract-empty", data: "ctsearch", message: { chat: { id: 12, type: "private" } } } },
      emptyStore,
      empty.sender
    );
    await handleTelegramUpdate(
      { message: { from: { id: 12 }, chat: { id: 12, type: "private" }, text: "نموذج غير موجود" } },
      emptyStore,
      empty.sender
    );
    expect(empty.messages[1]?.text).toContain("لا توجد نتائج");
  });

  it("يوصل زر المراجع المميزة إلى الفهرس المستورد بأسماء منظفة ويسلم الملف في المحادثة الخاصة", async () => {
    const { sender, messages, documents } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "callback-featured-references", data: "featured", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("مراجع مميزة");
    expect(messages[0]?.text).toContain("اختر المرجع أو الملف المطلوب");
    expect(messages[0]?.text).not.toContain("المسار:");
    expect(messages[0]?.text).not.toContain("الصفحة");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("إصدار وصياغة الأحكام القضائية الجنداري");
    expect(JSON.stringify(messages[0]?.replyMarkup)).not.toContain("تطبيق الباحث القانوني");
    expect(JSON.stringify(messages[0]?.replyMarkup)).not.toContain(".pdf");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("rfile:11:17QASX45F7JlN4EIYICMUHN2NtfsEvuIu:1");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-featured-references-file", data: "rfile:11:17QASX45F7JlN4EIYICMUHN2NtfsEvuIu:1", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(requestedSources[0]?.id).toBe(featuredReferenceSource.id);
    expect(documents).toEqual([{ chatId: 12, filename: featuredReferenceSource.title, caption: `مستورد من مكتبة أ. معين الناصر\n${featuredReferenceSource.title}` }]);
  });

  it("يقيد أهم القوانين اليمنية بطلب تحويل وصورة إثبات واعتماد يدوي قبل عرض الفهرس أو تسليم الملف", async () => {
    const { sender, messages, documents, fileIdPhotos } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    const store = createStore();
    const ownerId = Number(process.env.TELEGRAM_OWNER_ID ?? "0");

    await handleTelegramUpdate(
      { callback_query: { id: "important-laws-locked", data: "important-laws", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages[0]?.text).toContain("قسم خاص");
    expect(messages[0]?.text).toContain("قيمة الاشتراك: 3000 ريال");
    expect(messages[0]?.text).toContain("قانون المرافعات والتنفيذ المدني");
    expect(messages[0]?.text).toContain("3007145477");
    expect(messages[0]?.text).toContain("488281");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("important-laws:request");

    await handleTelegramUpdate(
      { callback_query: { id: "important-laws-request", data: "important-laws:request", from: { id: 12, username: "legal_student", first_name: "أحمد", last_name: "القانوني" }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages[1]?.text).toContain("اختر طريقة التحويل");
    expect(JSON.stringify(messages[1]?.replyMarkup)).toContain("important-laws:payment:karimi");

    await handleTelegramUpdate(
      { callback_query: { id: "important-laws-payment", data: "important-laws:payment:karimi", from: { id: 12, username: "legal_student", first_name: "أحمد", last_name: "القانوني" }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages[2]?.text).toContain("أرسل الآن صورة واضحة لإثبات الإيداع");

    await handleTelegramUpdate(
      { message: { from: { id: 12, username: "legal_student", first_name: "أحمد", last_name: "القانوني" }, chat: { id: 12, type: "private" }, photo: [{ file_id: "proof-small" }, { file_id: "proof-full" }] } },
      store,
      sender,
      provider
    );
    expect(messages[3]?.text).toContain("تم إرسال طلب الاشتراك وصورة إثبات الإيداع");
    expect(messages[4]?.chatId).toBe(ownerId);
    expect(messages[4]?.text).toContain("الاسم الظاهر: أحمد القانوني");
    expect(messages[4]?.text).toContain("اسم المستخدم: @legal_student");
    expect(messages[4]?.text).toContain("طريقة التحويل المختارة: كريمي");
    expect(messages[4]?.text).toContain("رقم حساب كريمي: 3007145477");
    expect(JSON.stringify(messages[4]?.replyMarkup)).toContain("important-laws:approve:1");
    expect(JSON.stringify(messages[4]?.replyMarkup)).toContain("https://t.me/legal_student");
    expect(fileIdPhotos).toEqual([{ chatId: ownerId, fileId: "proof-full", caption: "إثبات إيداع الطلب #1" }]);

    await handleTelegramUpdate(
      { callback_query: { id: "important-laws-file-before-approval", data: "ifile:12:important-yemeni-laws-interactive:1", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(requestedSources).toEqual([]);
    expect(documents).toEqual([]);

    await handleTelegramUpdate(
      { callback_query: { id: "important-laws-approve", data: "important-laws:approve:1", from: { id: ownerId }, message: { chat: { id: ownerId, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(messages.some(message => message.chatId === 12 && message.text.includes("تم اعتماد اشتراكك"))).toBe(true);
    const ownerApprovalNotice = messages.find(message => message.chatId === ownerId && message.text.includes("إشعار تأكيد اعتماد الاشتراك"));
    expect(ownerApprovalNotice?.text).toContain("معرّف المشترك: 12");
    expect(ownerApprovalNotice?.text).toContain("حالة إشعار المشترك: تم إرساله بنجاح.");

    await handleTelegramUpdate(
      { callback_query: { id: "important-laws-open", data: "important-laws", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(JSON.stringify(messages.at(-1)?.replyMarkup)).toContain("ifile:12:important-yemeni-laws-interactive:1");

    await handleTelegramUpdate(
      { callback_query: { id: "important-laws-file-approved", data: "ifile:12:important-yemeni-laws-interactive:1", from: { id: 12 }, message: { chat: { id: 12, type: "private" } } } },
      store,
      sender,
      provider
    );
    expect(requestedSources[0]?.id).toBe(importantYemeniLawsSource.id);
    expect(documents).toEqual([{ chatId: 12, filename: importantYemeniLawsSource.title, caption: `مستورد من مكتبة أ. معين الناصر\n${importantYemeniLawsSource.title}` }]);
  });

  it("لا يرسل ملف تشريع يمني عند اختياره من مجموعة أو قناة", async () => {
    const { sender, messages, documents } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-legislation-group", data: "lfile:8:1bEkLg2uaeQOULqZi6yIEfU0aKtMMB3J4:1", message: { chat: { id: -100, type: "group" } } } },
      createStore(),
      sender,
      provider
    );

    expect(messages).toEqual([]);
    expect(documents).toEqual([]);
    expect(requestedSources).toEqual([]);
  });

  it("يتطلب زيارة منصة الناصر الموثقة ولا يقبل callback التأكيد اليدوي القديم", async () => {
    const { sender, messages, callbacks } = createSender();
    const store = createStore(false);

    await handleTelegramUpdate({ message: { from: { id: 120 }, chat: { id: 12 }, text: "/browse" } }, store, sender);
    expect(messages[0]?.text).toContain("✅ قناة منصة الناصر القانونية (@muen2025): مكتمل");
    expect(messages[0]?.text).toContain("✅ قناة حصاد اليوم الإخباري (@hasadalyoum): مكتمل");
    expect(messages[0]?.text).toContain("❌ منصة الناصر القانونية: لم تتم الزيارة أو لم يُتحقق منها بعد");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain('"web_app":{"url":"https://alnasser-legal-telegram-bot-supabase-git-sup-f04e08-hasadalyoum.vercel.app/telegram-platform-visit.html"}');
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("https://t.me/muen2025");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("https://t.me/hasadalyoum");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-platform-confirmed", data: "platform:confirmed", from: { id: 120 }, message: { chat: { id: 12 } } } },
      store,
      sender
    );
    expect(callbacks).toContain("callback-platform-confirmed");
    expect(messages[1]?.text).toContain("❌ منصة الناصر القانونية: لم تتم الزيارة أو لم يُتحقق منها بعد");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-channel-complete", data: "channel:check", from: { id: 120 }, message: { chat: { id: 12 } } } },
      store,
      sender
    );
    expect(messages[2]?.text).toContain("❌ منصة الناصر القانونية: لم تتم الزيارة أو لم يُتحقق منها بعد");

    await handleTelegramUpdate({ message: { from: { id: 120 }, chat: { id: 12 }, text: "/browse" } }, store, sender);
    expect(messages[3]?.text).toContain("❌ منصة الناصر القانونية: لم تتم الزيارة أو لم يُتحقق منها بعد");
  });

  it("يعرض النصوص والأزرار العربية المحدثة لخدمات القائمة الرئيسة", async () => {
    const { sender, messages } = createSender();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "callback-browse", data: "browse", message: { chat: { id: 12 } } } },
      store,
      sender
    );
    expect(messages[0]?.text).toContain("تصنيفات المكتبة الرقمية");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("📙 القانون المدني");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("📕 الفقه وأصوله والشريعة الإسلامية");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-search-intro", data: "search", message: { chat: { id: 12 } } } },
      store,
      sender
    );
    expect(messages[1]?.text).toContain("محرك البحث القانوني");
    expect(messages[1]?.text).toContain("/search عقد البيع");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-help", data: "help", message: { chat: { id: 12 } } } },
      store,
      sender
    );
    expect(messages[2]?.text).toContain("دليل الاستخدام والدعم");
    expect(messages[2]?.text).toContain("/browse");

    await handleTelegramUpdate(
      { callback_query: { id: "callback-about", data: "about", message: { chat: { id: 12 } } } },
      store,
      sender
    );
    expect(messages[3]?.text).toContain("منصة معرفية وتعليمية بإشراف أ. معين الناصر");
    expect(messages[3]?.text).toContain("نماذج الاختبارات الإلكترونية");
    expect(messages[3]?.text).toContain("مبادرة تعليمية مستقلة");
  });

  it("يبحث في المصادر ويعرض نتيجة قابلة للاختيار", async () => {
    const { sender, messages } = createSender();
    await handleTelegramUpdate({ message: { chat: { id: 12 }, text: "/search مدني" } }, createStore(), sender);

    expect(messages[0]?.text).toContain("نتائج البحث");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain(sampleSource.title);
  });

  it("يعرض المصادر عند اختيار تصنيف من القائمة", async () => {
    const { sender, messages } = createSender();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-category", data: "category:civil", message: { chat: { id: 12 } } } },
      createStore(),
      sender
    );

    expect(messages[0]?.text).toContain("مصادر تصنيف 📙 القانون المدني");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain(sampleSource.title);
  });

  it("يقسم التصنيف الكبير إلى صفحات ويحافظ على تنقل المستخدم", async () => {
    const sources = Array.from({ length: 17 }, (_, index) => ({
      ...sampleSource,
      id: index + 1,
      sortOrder: index + 1,
      title: `مصدر مدني ${index + 1}`,
    }));
    const pagedStore: TelegramLibraryStore = {
      ...createStore(),
      listSourcesByCategory: async (category, page) => ({
        sources: category === "civil" ? sources.slice((page - 1) * 8, page * 8) : [],
        total: category === "civil" ? sources.length : 0,
      }),
    };
    const { sender, messages } = createSender();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-page", data: "category:civil:2", message: { chat: { id: 12 } } } },
      pagedStore,
      sender
    );

    expect(messages[0]?.text).toContain("الصفحة 2 من 3");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("مصدر مدني 9");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("category:civil:1");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("category:civil:3");
  });

  it("يرسل المصدر المختار كمرفق خاص من دون كشف رابطه", async () => {
    const { sender, messages, documents, callbacks } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-1", data: "source:7", message: { chat: { id: 12, type: "private" } } } },
      createStore(),
      sender,
      provider
    );

    expect(callbacks).toEqual(["callback-1"]);
    expect(messages[0]?.text).toContain("انتظر قليلًا");
    expect(messages[0]?.text).not.toContain("https://example.com/civil-law");
    expect(requestedSources[0]?.id).toBe(sampleSource.id);
    expect(documents).toEqual([{ chatId: 12, filename: sampleSource.title, caption: `مستورد من مكتبة أ. معين الناصر\n${sampleSource.title}` }]);
  });

  it("لا يرسل ملفًا عند اختياره من مجموعة أو قناة", async () => {
    const { sender, messages, documents } = createSender();
    const { provider, requestedSources } = createDocumentProvider();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-group", data: "source:7", message: { chat: { id: -100, type: "group" } } } },
      createStore(),
      sender,
      provider
    );

    expect(messages).toEqual([]);
    expect(documents).toEqual([]);
    expect(requestedSources).toEqual([]);
  });

  it("يوضح سبب فشل تسليم ملف كبير ولا يرسل رابط Drive", async () => {
    const tooLargeProvider: TelegramDocumentProvider = { download: async () => { throw new FileDeliveryError("TOO_LARGE"); } };
    const { sender, messages, documents } = createSender();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-large", data: "source:7", message: { chat: { id: 12, type: "private" } } } },
      createStore(),
      sender,
      tooLargeProvider
    );

    expect(messages).toHaveLength(2);
    expect(messages[1]?.text).toContain("أكبر من الحد الآمن");
    expect(JSON.stringify(messages)).not.toContain("drive.google.com");
    expect(documents).toEqual([]);
  });

  it("يعرض فهرس قواعد قضائية بتسلسل مجلد ثم ملفات", async () => {
    const { sender, messages } = createSender();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-judicial", data: "judicial", message: { chat: { id: 12 } } } },
      createStore(),
      sender
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("المبادئ والقواعد القضائية");
    expect(messages[0]?.text).toContain("اختر المجال أو الملف المطلوب");
    expect(messages[0]?.text).not.toContain("المسار:");
    expect(messages[0]?.text).not.toContain("الصفحة");
    const markup = JSON.stringify(messages[0]?.replyMarkup);
    expect(markup).toContain("الأحكام المدنية");
    expect(markup).not.toContain("مجلد:");
    expect(markup).not.toContain("ملف:");
    expect(markup).toContain("index:folder-civil:1");
  });

  it("يعرض اسم المجلد واسم الملف فقط أثناء التصفح ولا يرسل ملفًا قبل اختياره", async () => {
    const { sender, messages, documents } = createSender();
    const store = createStore();
    await handleTelegramUpdate(
      { callback_query: { id: "plain-judicial-root", data: "judicial", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    await handleTelegramUpdate(
      { callback_query: { id: "plain-judicial-folder", data: "index:folder-civil:1", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    const markup = JSON.stringify(messages.at(-1)?.replyMarkup);
    expect(markup).toContain("مبادئ القانون المدني");
    expect(markup).not.toContain("ملف:");
    expect(markup).not.toContain("مجلد:");
    expect(documents).toEqual([]);
  });

  it("يبدأ البحث القضائي ثم يعرض نتائجه ضمن الفهرس فقط", async () => {
    const { sender, messages } = createSender();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-search", data: "jsearch", message: { chat: { id: 12 } } } },
      createStore(),
      sender
    );
    expect(messages[0]?.text).toContain("البحث السريع في القواعد القضائية");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("jq:مدني");

    await handleTelegramUpdate({ message: { chat: { id: 12 }, text: "مدني" } }, createStore(), sender);
    expect(messages[1]?.text).toContain("نتائج «مدني» داخل قواعد قضائية");
    expect(JSON.stringify(messages[1]?.replyMarkup)).toContain("jresultfile:7:25:1");
  });

  it("ينفذ البحث السريع من الزر أو الأمر مباشرة داخل القواعد والتشريعات", async () => {
    const judicial = createSender();
    const judicialStore = createStore();
    await handleTelegramUpdate(
      { callback_query: { id: "quick-judicial", data: "jq:مدني", message: { chat: { id: 12, type: "private" } } } },
      judicialStore,
      judicial.sender
    );
    expect(judicial.messages[0]?.text).toContain("نتائج «مدني» داخل قواعد قضائية");
    expect(JSON.stringify(judicial.messages[0]?.replyMarkup)).toContain("jresultfile:7:25:1");
    expect(JSON.stringify(judicial.messages[0]?.replyMarkup)).toContain("🟨مدني🟨");

    const legislation = createSender();
    const legislationStore = createStore();
    await handleTelegramUpdate(
      { message: { from: { id: 12 }, chat: { id: 12, type: "private" }, text: "/ql تحكيم" } },
      legislationStore,
      legislation.sender
    );
    expect(legislation.messages[0]?.text).toContain("نتائج «تحكيم» داخل التشريعات اليمنية");
    expect(JSON.stringify(legislation.messages[0]?.replyMarkup)).toContain("lresultfile:8:26:1");
    expect(JSON.stringify(legislation.messages[0]?.replyMarkup)).toContain("🟨تحكيم🟨");
    expect(legislation.documents).toEqual([]);
  });

  it("يحفظ نتيجة البحث في المفضلة ويمنع التكرار ويعرضها داخل المحادثة الخاصة", async () => {
    const { sender, messages, documents } = createSender();
    const store = createStore();

    await handleTelegramUpdate(
      { callback_query: { id: "favorite-search", data: "jq:مدني", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("favadd:7");

    await handleTelegramUpdate(
      { callback_query: { id: "favorite-add", data: "favadd:7", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(messages[1]?.text).toContain("تمت إضافة");
    expect(documents).toEqual([]);

    await handleTelegramUpdate(
      { callback_query: { id: "favorite-repeat", data: "favadd:7", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(messages[2]?.text).toContain("محفوظ بالفعل");

    await handleTelegramUpdate(
      { callback_query: { id: "favorite-list", data: "favorites", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(messages[3]?.text).toContain("1 مستند");
    expect(JSON.stringify(messages[3]?.replyMarkup)).toContain("source:7");
    expect(JSON.stringify(messages[3]?.replyMarkup)).toContain("favremove:7");

    await handleTelegramUpdate(
      { callback_query: { id: "favorite-remove", data: "favremove:7", message: { chat: { id: 12, type: "private" } } } },
      store,
      sender
    );
    expect(messages[4]?.text).toContain("إزالة المستند");
  });

  it("لا يسمح بحفظ المستند في المفضلة من داخل مجموعة", async () => {
    const { sender, messages } = createSender();
    await handleTelegramUpdate(
      { callback_query: { id: "favorite-group", data: "favadd:7", message: { chat: { id: -100, type: "group" } } } },
      createStore(),
      sender
    );
    expect(messages[0]?.text).toContain("المحادثة الخاصة");
  });

  it("يميّز عبارة البحث بصريًا مع مراعاة أشكال الحروف العربية الشائعة", () => {
    expect(highlightSearchTerm("مبادئ القانون المدني", "مدني")).toContain("🟨مدني🟨");
    expect(highlightSearchTerm("قانون المرافعات والتنفيذ المدني", "مرافعآت")).toContain("🟨مرافعات🟨");
    expect(highlightSearchTerm("قانون التحكيم", "غير موجود")).toBe("قانون التحكيم");
  });

  it("يبقي أسماء الأزرار القصيرة كاملة ويختصر الطويلة جدًا عند حدود كلمات مقروءة", () => {
    const shortName = "قانون التحكيم اليمني";
    const veryLongName = "شرح قانون المرافعات والتنفيذ المدني اليمني مع آخر التعديلات والقرارات القضائية التطبيقية";
    expect(buttonLabel(shortName)).toBe(shortName);
    expect(buttonLabel(veryLongName)).toMatch(/…$/);
    expect(buttonLabel(veryLongName).length).toBeLessThanOrEqual(54);
    expect(buttonLabel(veryLongName)).toContain("قانون المرافعات");
  });

  it("يطبع الحروف العربية الشائعة ويقبل خطأً إملائيًا بسيطًا", () => {
    expect(normalizeArabicSearch("أحكام المَدَنيّة")).toBe("احكام المدنيه");
    expect(approximateArabicMatchScore("مدنى", { title: "القانون المدني", description: "مرجع قانوني" })).toBeGreaterThan(0);
  });

  it("يعيد بديلًا تقريبيًا عندما تفشل المطابقة المباشرة", () => {
    const fallback = fallbackJudicialSearchResults("مدنى", [sampleSource]);
    expect(fallback.total).toBe(1);
    expect(fallback.sources[0]?.title).toBe("مبادئ القانون المدني");
  });

  it("يعرض تنبيهًا عندما تكون نتائج البحث تقريبية", async () => {
    const approximateStore: TelegramLibraryStore = {
      ...createStore(),
      searchJudicialSources: async () => ({ query: "مدنى", sources: [sampleSource], total: 1, matchType: "approximate" }),
    };
    const { sender, messages } = createSender();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-approximate", data: "jresult:25:1", message: { chat: { id: 12 } } } },
      approximateStore,
      sender
    );

    expect(messages[0]?.text).toContain("نتائج قريبة اقترحها البحث");
  });

  it("لا يعرض بدائل عندما لا توجد مطابقة تقريبية", () => {
    const fallback = fallbackJudicialSearchResults("استثمار", [sampleSource]);
    expect(fallback.total).toBe(0);
    expect(fallback.sources).toEqual([]);
  });

  it("يعرض رسالة عدم وجود نتائج في تدفق البحث القضائي الكامل", async () => {
    const noResultStore: TelegramLibraryStore = {
      ...createStore(),
      consumeJudicialSearchQuery: async () => ({ id: 88 }),
      searchJudicialSources: async () => ({ query: "استثمار", sources: [], total: 0, matchType: "approximate" }),
    };
    const { sender, messages } = createSender();
    await handleTelegramUpdate({ message: { chat: { id: 12 }, text: "استثمار" } }, noResultStore, sender);

    expect(messages[0]?.text).toContain("لا توجد نتائج داخل قواعد قضائية");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("jsearch");
  });

  it("لا يحوّل رسالة لاحقة إلى نتيجة بحث عند غياب جلسة انتظار", async () => {
    const { sender, messages } = createSender();
    await handleTelegramUpdate({ message: { chat: { id: 12 }, text: "رسالة عادية" } }, createStore(), sender);

    expect(messages[0]?.text).toContain("لم أفهم طلبك");
  });

  it("يعرض رسالة واضحة عندما تنتهي مهلة نتائج البحث القضائي", async () => {
    const expiredStore: TelegramLibraryStore = {
      ...createStore(),
      searchJudicialSources: async () => undefined,
    };
    const { sender, messages } = createSender();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-expired", data: "jresult:25:1", message: { chat: { id: 12 } } } },
      expiredStore,
      sender
    );

    expect(messages[0]?.text).toContain("انتهت مهلة البحث");
  });

  it("يسلم ملف نتيجة البحث في المحادثة الخاصة", async () => {
    const { sender, messages, documents } = createSender();
    const { provider } = createDocumentProvider();
    await handleTelegramUpdate(
      { callback_query: { id: "callback-result-file", data: "jresultfile:7:25:1", message: { chat: { id: 12, type: "private" } } } },
      createStore(),
      sender,
      provider
    );

    expect(messages[0]?.text).toContain("انتظر قليلًا");
    expect(documents[0]?.chatId).toBe(12);
  });

  it("يسجل المستخدم الذي يتفاعل في محادثة خاصة كمستلم محتمل للبث", async () => {
    const registrations: Array<{ chatId: string; telegramUserId: string }> = [];
    const store: TelegramLibraryStore = {
      ...createStore(),
      registerSubscriber: async (chatId, telegramUserId) => {
        registrations.push({ chatId, telegramUserId });
        return true;
      },
    };
    const { sender } = createSender();

    await handleTelegramUpdate({ message: { from: { id: 42 }, chat: { id: 12, type: "private" }, text: "/start" } }, store, sender);

    expect(registrations).toEqual([{ chatId: "12", telegramUserId: "42" }]);
  });

  it("يرفض إنشاء بث من غير المالك ولا ينشئ مسودة", async () => {
    let draftCreationCount = 0;
    const store: TelegramLibraryStore = {
      ...createStore(),
      createBroadcastDraft: async () => {
        draftCreationCount += 1;
        return undefined;
      },
    };
    const { sender, messages } = createSender();

    await handleTelegramUpdate({ message: { from: { id: 777 }, chat: { id: 777, type: "private" }, text: "/broadcast رسالة اختبار" } }, store, sender);

    expect(draftCreationCount).toBe(0);
    expect(messages[0]?.text).toContain("مالك البوت داخل محادثته الخاصة فقط");
  });

  it("ينشئ مسودة ومعاينة لبث الرسالة من دون إرسالها قبل التأكيد", async () => {
    const created: Array<{ ownerTelegramUserId: string; kind: "message" | "document"; message?: string }> = [];
    const store: TelegramLibraryStore = {
      ...createStore(),
      createBroadcastDraft: async input => {
        created.push(input);
        return { id: 41, ownerTelegramUserId: input.ownerTelegramUserId, kind: "message", message: input.message ?? null, fileId: null, fileName: null, caption: null, status: "draft", recipientCount: 2 };
      },
      listSubscriberChatIds: async () => ["101", "102"],
    };
    const { sender, messages } = createSender();
    const ownerId = Number(process.env.TELEGRAM_OWNER_ID);

    await handleTelegramUpdate({ message: { from: { id: ownerId }, chat: { id: ownerId, type: "private" }, text: "/broadcast رسالة قانونية مهمة" } }, store, sender);

    expect(created).toEqual([{ ownerTelegramUserId: String(ownerId), kind: "message", message: "رسالة قانونية مهمة" }]);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("معاينة البث الجماعي");
    expect(messages[0]?.text).toContain("لن يُرسل شيء قبل");
    expect(JSON.stringify(messages[0]?.replyMarkup)).toContain("broadcast:confirm:41");
    expect(messages.every(message => message.chatId === ownerId)).toBe(true);
  });

  it("ينتظر ملف البث ثم يعرض معاينته من دون إعادة إرساله قبل التأكيد", async () => {
    const store: TelegramLibraryStore = {
      ...createStore(),
      createBroadcastDraft: async input => ({ id: 42, ownerTelegramUserId: input.ownerTelegramUserId, kind: "document", message: null, fileId: input.fileId ?? null, fileName: input.fileName ?? null, caption: input.caption ?? null, status: "draft", recipientCount: 2 }),
    };
    const { sender, messages, fileIdDocuments } = createSender();
    const ownerId = Number(process.env.TELEGRAM_OWNER_ID);

    await handleTelegramUpdate({ message: { from: { id: ownerId }, chat: { id: ownerId, type: "private" }, text: "/broadcastfile" } }, store, sender);
    await handleTelegramUpdate({ message: { from: { id: ownerId }, chat: { id: ownerId, type: "private" }, caption: "تعميم جديد", document: { file_id: "telegram-file-1", file_name: "تعميم.pdf" } } }, store, sender);

    expect(messages[0]?.text).toContain("أرسل الملف الآن");
    expect(messages[1]?.text).toContain("تعميم.pdf");
    expect(JSON.stringify(messages[1]?.replyMarkup)).toContain("broadcast:confirm:42");
    expect(fileIdDocuments).toEqual([]);
  });

  it("يلغي مسودة البث من المالك ولا يرسل أي رسالة للمشتركين", async () => {
    const cancelled: number[] = [];
    const store: TelegramLibraryStore = {
      ...createStore(),
      cancelBroadcastDraft: async id => {
        cancelled.push(id);
        return true;
      },
    };
    const { sender, messages } = createSender();
    const ownerId = Number(process.env.TELEGRAM_OWNER_ID);

    await handleTelegramUpdate({ callback_query: { id: "cancel-broadcast", data: "broadcast:cancel:43", from: { id: ownerId }, message: { chat: { id: ownerId, type: "private" } } } }, store, sender);

    expect(cancelled).toEqual([43]);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toContain("لم يُرسل أي محتوى");
  });

  it("لا يرسل البث إلا بعد تأكيد المالك ويسجل نتائج النجاح والفشل", async () => {
    const completed: Array<{ id: number; successCount: number; failureCount: number }> = [];
    const store: TelegramLibraryStore = {
      ...createStore(),
      getBroadcastDraft: async () => ({ id: 44, ownerTelegramUserId: String(process.env.TELEGRAM_OWNER_ID), kind: "message", message: "إعلان موثّق", fileId: null, fileName: null, caption: null, status: "draft", recipientCount: 2 }),
      beginBroadcast: async () => true,
      listSubscriberChatIds: async () => ["201", "202"],
      completeBroadcast: async (id, _ownerTelegramUserId, successCount, failureCount) => {
        completed.push({ id, successCount, failureCount });
        return true;
      },
    };
    const baseSender = createSender();
    const sender: TelegramSender = {
      ...baseSender.sender,
      sendMessage: async (chatId, text, replyMarkup) => {
        if (chatId === 202) throw new Error("المستخدم حظر البوت");
        await baseSender.sender.sendMessage(chatId, text, replyMarkup);
      },
    };
    const { messages } = baseSender;
    const ownerId = Number(process.env.TELEGRAM_OWNER_ID);

    await handleTelegramUpdate({ callback_query: { id: "confirm-broadcast", data: "broadcast:confirm:44", from: { id: ownerId }, message: { chat: { id: ownerId, type: "private" } } } }, store, sender);

    expect(messages.filter(message => message.chatId === 201 || message.chatId === 202).map(message => message.text)).toEqual(["إعلان موثّق"]);
    expect(completed).toEqual([{ id: 44, successCount: 1, failureCount: 1 }]);
    expect(messages.at(-1)?.text).toContain("اكتمل البث رقم #44");
  });

  it("يسجل أوامر المالك في نطاق محادثته الخاصة فقط ويبقي القائمة العامة نظيفة", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ method: string; payload: Record<string, unknown> }> = [];
    globalThis.fetch = (async (input, init) => {
      const method = String(input).split("/").at(-1) ?? "";
      calls.push({ method, payload: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    try {
      await synchronizeTelegramConfiguration({ token: "اختبار" });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const commandCalls = calls.filter(call => call.method === "setMyCommands");
    expect(commandCalls).toHaveLength(2);
    expect(commandCalls[0]?.payload.commands).toEqual(BOT_COMMANDS);
    expect(JSON.stringify(commandCalls[0]?.payload.commands)).not.toContain("broadcast");
    expect(commandCalls[1]?.payload.commands).toEqual([...BOT_COMMANDS, ...OWNER_COMMANDS]);
    expect(commandCalls[1]?.payload.scope).toEqual({ type: "chat", chat_id: Number(process.env.TELEGRAM_OWNER_ID) });
  });
});

describe("Telegram reply topics", () => {
  it("يمرر topic identifiers إلى sendMessage عند الرد داخل قناة أو موضوع خاص", async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (_input, init) => {
      requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
      return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
    }) as typeof fetch;

    try {
      await createTelegramSender("اختبار", { directMessagesTopicId: 123456789 }).sendMessage(99, "رسالة", {
        inline_keyboard: [[{ text: "فتح", web_app: { url: "https://alnaseer.org/" } }]],
      });
      await createTelegramSender("اختبار", { messageThreadId: 42 }).sendMessage(99, "موضوع");
      await createTelegramSender("اختبار").sendMessage(99, "عادي", {
        inline_keyboard: [[{ text: "فتح", web_app: { url: "https://alnaseer.org/" } }]],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requests[0]).toMatchObject({
      chat_id: 99,
      direct_messages_topic_id: 123456789,
      reply_markup: { inline_keyboard: [[{ text: "فتح المحادثة الخاصة لإكمال التحقق", url: "https://t.me/Moieen2025Bot?start=verify" }]] },
    });
    expect(requests[0]).not.toHaveProperty("message_thread_id");
    expect(requests[1]).toMatchObject({ chat_id: 99, message_thread_id: 42 });
    expect(requests[1]).not.toHaveProperty("direct_messages_topic_id");
    expect(requests[2]).toMatchObject({
      chat_id: 99,
      text: "عادي",
      reply_markup: { inline_keyboard: [[{ text: "فتح", web_app: { url: "https://alnaseer.org/" } }]] },
    });
  });
});
