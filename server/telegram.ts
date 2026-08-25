import type { LegalFolder, LegalSource, TelegramContractTemplate, TelegramContractTemplateType } from "../drizzle/schema";
import { ALL_YEMENI_LAWS_ROOT_FOLDER_ID, FEATURED_REFERENCES_ROOT_FOLDER_ID, ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID, IMPORTANT_YEMENI_LAWS_ROOT_FOLDER_ID, JUDICIAL_ROOT_FOLDER_ID, LEGAL_FORMS_ROOT_FOLDER_ID, LEGISLATION_ROOT_FOLDER_ID, normalizeArabicSearch } from "./db";
import { CIVIL_LAW_EXAM_SUBJECT_KEY, CIVIL_LAW_GENERAL_2025_SECTION_KEY, CIVIL_LAW_GENERAL_2025_TITLE, USUL_FIQH_EXAM_SUBJECT_KEY, civilLawExamMenu, civilLawExamReadyMenu, civilLawExamSectionMenu, civilLawExamTimeMenu, examFormsMenu, examSubjectHeading, examSubjectsMenu, secondaryLevelsMenu, examTimeMenu, examTrainingFormsMenu, formatExamTime, getImportedExamCatalogLocation, getImportedExamSubjectKey, getTelegramExamCatalogLevel, getTelegramExamCatalogSubject, isSecondaryExamSubjectKey, optionLabel, optionText, sendExamQuestion } from "./telegramExam";
import { createTelegramContractDocument } from "./telegramContractDocument";
import { TELEGRAM_CONTRACT_TYPE_LABELS } from "./telegramContractTypes";
import { storageGetSignedUrl } from "./storage";

export const legalCategories = ["fiqh", "civil", "commercial", "procedure", "general"] as const;
export type LegalCategory = (typeof legalCategories)[number];

const TELEGRAM_PLATFORM_VERIFY_WEB_APP_URL = "https://alnasser-legal-telegram-bot-supabase-git-sup-f04e08-hasadalyoum.vercel.app/telegram-platform-visit.html";
const TELEGRAM_HASAD_VERIFY_WEB_APP_URL = "https://alnasser-legal-telegram-bot-supabase-git-sup-f04e08-hasadalyoum.vercel.app/telegram-hasad-visit.html";

const importantYemeniLawsPaymentMethods = {
  karimi: { label: "كريمي", details: "رقم حساب كريمي: 3007145477" },
  jeeb: { label: "محفظة جيب", details: "رقم حساب جيب: 488281" },
} as const;
type ImportantYemeniLawsPaymentMethod = keyof typeof importantYemeniLawsPaymentMethods;
type TelegramPaidAccessScope = "sharia_exams" | "secondary_exams";
type TelegramSubscriptionAccessScope = "important_laws" | TelegramPaidAccessScope;

export const categoryLabels: Record<LegalCategory, string> = {
  fiqh: "📕 الفقه وأصوله والشريعة الإسلامية",
  civil: "📙 القانون المدني",
  commercial: "📘 القانون التجاري والشركات",
  procedure: "📗 القانون الجنائي",
  general: "📑 قوانين العمل والأحوال الشخصية",
};

export type TelegramInlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string; web_app?: { url: string } }>>;
};

export type TelegramDocument = {
  filename: string;
  contentType: string;
  data: Uint8Array;
  caption: string;
};

export type TelegramQuizPoll = {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  openPeriodSeconds: 15 | 30 | 60 | 300;
};

export type TelegramSender = {
  sendMessage: (chatId: number, text: string, replyMarkup?: TelegramInlineKeyboard) => Promise<void>;
  sendDocument: (chatId: number, document: TelegramDocument) => Promise<void>;
  sendDocumentByFileId: (chatId: number, fileId: string, caption?: string) => Promise<void>;
  sendPhotoByFileId: (chatId: number, fileId: string, caption?: string) => Promise<void>;
  sendQuizPoll: (chatId: number, poll: TelegramQuizPoll) => Promise<{ pollId: string }>;
  answerCallbackQuery: (callbackQueryId: string, text?: string) => Promise<void>;
  isChatAdministrator: (chatId: number, telegramUserId: string) => Promise<boolean>;
};

export type TelegramDocumentProvider = {
  download: (source: LegalSource) => Promise<TelegramDocument>;
};

export type TelegramChannelSubscriptionStatus = "subscribed" | "not_subscribed" | "unavailable";

type TelegramRequiredChannel = { title: string; handle: string; url: string };

export type TelegramChannelMembershipChecker = {
  check: (telegramUserId: string, channelHandle: string) => Promise<TelegramChannelSubscriptionStatus>;
};

export type TelegramManagedMenuItemRecord = {
  id: number;
  label: string;
  actionType: "url" | "message" | "file";
  actionValue: string;
  rowIndex: number;
  sortOrder: number;
  accessMode: "free" | "premium" | "hasad";
};

export type TelegramManagedSectionRecord = {
  sectionKey: string;
  displayLabel: string;
  enabled: boolean;
  /** غياب القيمة يبقي منطق الاشتراك القديم عند استخدام مخازن متوافقة سابقة. */
  accessMode?: "subscription" | "free" | "premium" | "hasad";
  sortOrder: number;
};

export type TelegramManagedMessageRecord = {
  messageKey: "welcome" | "about" | "help";
  content: string;
};

export type TelegramExamSessionRecord = {
  id: number;
  telegramUserId: string;
  chatId: string;
  subjectKey: string;
  sectionKey: string;
  status: "active" | "completed" | "cancelled";
  questionIndex: number;
  score: number;
  incorrectCount: number;
  missedCount: number;
  timeLimitSeconds: number;
  activePollId: string | null;
  startedAt: Date;
};

export type TelegramExamPollResolution = {
  question: { id: number; questionText: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: "A" | "B" | "C" | "D"; explanation: string; hint: string | null; sortOrder: number };
  isCorrect: boolean;
  missed: boolean;
  score: number;
  incorrectCount: number;
  missedCount: number;
  nextQuestionIndex: number;
  total: number;
  completed: boolean;
  elapsedSeconds: number;
};

export type TelegramWrittenExamResolution = {
  score: number;
  incorrectCount: number;
  missedCount: number;
  nextQuestionIndex: number;
  total: number;
  completed: boolean;
  elapsedSeconds: number;
};

export type TelegramExamResultSummary = {
  previousBest?: { score: number; incorrectCount: number; missedCount: number; elapsedSeconds: number };
  leaderboardResult: { score: number; incorrectCount: number; missedCount: number; elapsedSeconds: number };
  rank: number;
  totalParticipants: number;
  percentile: number;
};

export type TelegramGroupExamRoundRecord = {
  id: number;
  chatId: string;
  creatorTelegramUserId: string | null;
  subjectKey: string;
  sectionKey: string;
  status: "waiting" | "active" | "completed" | "cancelled";
  questionIndex: number;
  timeLimitSeconds: number;
  activePollId: string | null;
  startedAt: Date | null;
};

export type TelegramGroupExamPollResolution = {
  question: TelegramExamPollResolution["question"];
  correctCount: number;
  incorrectCount: number;
  missedCount: number;
  participantCount: number;
  nextQuestionIndex: number;
  total: number;
  completed: boolean;
};

export type TelegramGroupExamParticipantRecord = {
  telegramUserId: string;
  displayName: string;
  score: number;
  incorrectCount: number;
  missedCount: number;
};

type TelegramReferralRegistrationResult = "created" | "self_referral" | "referrer_not_found" | "already_referred" | "unavailable";

export type TelegramLibraryStore = {
  hasConfirmedPlatformAccess: (telegramUserId: string) => Promise<boolean>;
  hasConfirmedHasadAccess: (telegramUserId: string) => Promise<boolean>;
  listManagedMenuItems?: () => Promise<TelegramManagedMenuItemRecord[]>;
  listManagedSections?: () => Promise<TelegramManagedSectionRecord[]>;
  listManagedMessages?: () => Promise<TelegramManagedMessageRecord[]>;
  listSourcesByCategory: (category: LegalCategory, page: number) => Promise<{ sources: LegalSource[]; total: number }>;
  searchSources: (query: string) => Promise<LegalSource[]>;
  getSource: (id: number) => Promise<LegalSource | undefined>;
  saveFavorite: (telegramUserId: string, sourceId: number) => Promise<"added" | "exists" | "unavailable">;
  listFavorites: (telegramUserId: string) => Promise<Array<{ source: LegalSource }>>;
  removeFavorite: (telegramUserId: string, sourceId: number) => Promise<boolean>;
  listRecentSources: () => Promise<LegalSource[]>;
  listFeaturedSources: () => Promise<LegalSource[]>;
  listPopularSources: () => Promise<LegalSource[]>;
  listContractTemplates: (page: number) => Promise<{ templates: TelegramContractTemplate[]; total: number }>;
  listContractTemplateTypes: () => Promise<Array<{ contractType: TelegramContractTemplateType; count: number }>>;
  listContractTemplatesByType: (contractType: TelegramContractTemplateType, page: number) => Promise<{ templates: TelegramContractTemplate[]; total: number }>;
  getContractTemplate: (id: number) => Promise<TelegramContractTemplate | undefined>;
  beginContractTemplateSearch: (chatId: string) => Promise<void>;
  consumeContractTemplateSearchQuery: (chatId: string, query: string) => Promise<{ id: number } | undefined>;
  searchContractTemplates: (sessionId: number, page: number) => Promise<{ query: string; templates: TelegramContractTemplate[]; total: number; matchType: "exact" | "approximate" } | undefined>;
  listLegislationSourcesByType: (documentType: "law" | "regulation" | "decision" | "agreement" | "treaty" | "decree" | "other", page: number) => Promise<{ sources: LegalSource[]; total: number }>;
  listLegislationYears: () => Promise<number[]>;
  listLegislationSourcesByYear: (year: number, page: number) => Promise<{ sources: LegalSource[]; total: number }>;
  recordUsage: (telegramUserId: string, eventType: "browse" | "search" | "document_request" | "support_request", options?: { query?: string; sourceId?: number; sectionKey?: string }) => Promise<void>;
  createSupportRequest: (telegramUserId: string, chatId: string, message: string) => Promise<void>;
  getOwnerStatistics: () => Promise<{ totalEvents: number; totalSupportRequests: number; topQueries: Array<{ query: string; count: number }> }>;
  listNewSupportRequests: () => Promise<Array<{ id: number; message: string; createdAt: Date }>>;
  registerSubscriber: (
    chatId: string,
    telegramUserId: string,
    profile?: { telegramUsername?: string | null; telegramFirstName?: string | null; telegramLastName?: string | null }
  ) => Promise<boolean>;
  listSubscriberChatIds: () => Promise<string[]>;
  createBroadcastDraft: (input: { ownerTelegramUserId: string; kind: "message" | "document"; message?: string; fileId?: string; fileName?: string; caption?: string }) => Promise<TelegramBroadcastDraft | undefined>;
  getBroadcastDraft: (id: number, ownerTelegramUserId: string) => Promise<TelegramBroadcastDraft | undefined>;
  cancelBroadcastDraft: (id: number, ownerTelegramUserId: string) => Promise<boolean>;
  beginBroadcast: (id: number, ownerTelegramUserId: string) => Promise<boolean>;
  completeBroadcast: (id: number, ownerTelegramUserId: string, successCount: number, failureCount: number) => Promise<boolean>;
  getJudicialFolderContents: (folderId: string, page: number) => Promise<{
    folder: LegalFolder | undefined;
    folders: LegalFolder[];
    sources: LegalSource[];
    totalSources: number;
  }>;
  beginJudicialSearch: (chatId: string) => Promise<void>;
  consumeJudicialSearchQuery: (chatId: string, query: string) => Promise<{ id: number } | undefined>;
  searchJudicialSources: (sessionId: number, page: number) => Promise<{ query: string; sources: LegalSource[]; total: number; matchType: "exact" | "approximate" } | undefined>;
  getLegislationFolderContents: (folderId: string, page: number) => Promise<{
    folder: LegalFolder | undefined;
    folders: LegalFolder[];
    sources: LegalSource[];
    totalSources: number;
  }>;
  getYemeniLawsFolderContents: (folderId: string, page: number) => Promise<{
    folder: LegalFolder | undefined;
    folders: LegalFolder[];
    sources: LegalSource[];
    totalSources: number;
  }>;
  getLegalFormsFolderContents: (folderId: string, page: number) => Promise<{
    folder: LegalFolder | undefined;
    folders: LegalFolder[];
    sources: LegalSource[];
    totalSources: number;
  }>;
  getIllustratedLegalFormsFolderContents: (folderId: string, page: number) => Promise<{
    folder: LegalFolder | undefined;
    folders: LegalFolder[];
    sources: LegalSource[];
    totalSources: number;
  }>;
  getAllYemeniLawsFolderContents: (folderId: string, page: number) => Promise<{
    folder: LegalFolder | undefined;
    folders: LegalFolder[];
    sources: LegalSource[];
    totalSources: number;
  }>;
  getFeaturedReferencesFolderContents: (folderId: string, page: number) => Promise<{
    folder: LegalFolder | undefined;
    folders: LegalFolder[];
    sources: LegalSource[];
    totalSources: number;
  }>;
  getImportantYemeniLawsFolderContents: (folderId: string, page: number) => Promise<{
    folder: LegalFolder | undefined;
    folders: LegalFolder[];
    sources: LegalSource[];
    totalSources: number;
  }>;
  hasImportantYemeniLawsAccess: (telegramUserId: string) => Promise<boolean>;
  hasReferralPremiumAccess: (telegramUserId: string, scope: TelegramPaidAccessScope) => Promise<boolean>;
  hasManagedMenuItemPremiumAccess: (telegramUserId: string, menuItemId: number) => Promise<boolean>;
  createReferral: (referrerTelegramUserId: string, refereeTelegramUserId: string, refereeChatId: string) => Promise<TelegramReferralRegistrationResult>;
  qualifyReferral: (refereeTelegramUserId: string) => Promise<{ qualified: boolean; event?: { referrerChatId: string; qualifiedCount: number; remainingCount: number; rewardExpiresAt?: Date } }>;
  getReferralProgress: (telegramUserId: string) => Promise<{ qualifiedCount: number; pendingCount: number; remainingCount: number; activeAccessExpiresAt: Date | null }>;
  listReferralHistory: (telegramUserId: string) => Promise<Array<{ id: number; status: "pending" | "qualified" | "rejected"; createdAt: Date; qualifiedAt: Date | null; rejectedAt: Date | null; rejectionReason: string | null }>>;
  createImportantYemeniLawsSubscriptionRequest: (telegramUserId: string, chatId: string, profile?: { username?: string; firstName?: string; lastName?: string; paymentMethod?: ImportantYemeniLawsPaymentMethod; accessScope?: TelegramSubscriptionAccessScope; managedMenuItemId?: number }) => Promise<{ id: number; created: boolean } | undefined>;
  approveImportantYemeniLawsSubscriptionRequest: (requestId: number, ownerTelegramUserId: string) => Promise<{ telegramUserId: string; chatId: string; accessScope: TelegramSubscriptionAccessScope; managedMenuItemId: number | null } | undefined>;
  rejectImportantYemeniLawsSubscriptionRequest: (requestId: number, ownerTelegramUserId: string) => Promise<{ telegramUserId: string; chatId: string; accessScope: TelegramSubscriptionAccessScope; managedMenuItemId: number | null } | undefined>;
  listPendingImportantYemeniLawsSubscriptionRequests: () => Promise<Array<{ id: number; telegramUserId: string; chatId: string; accessScope: TelegramSubscriptionAccessScope; managedMenuItemId: number | null; telegramUsername: string | null; telegramFirstName: string | null; telegramLastName: string | null; paymentMethod: string | null; createdAt: Date }>>;
  beginLegislationSearch: (chatId: string) => Promise<void>;
  consumeLegislationSearchQuery: (chatId: string, query: string) => Promise<{ id: number } | undefined>;
  searchLegislationSources: (sessionId: number, page: number) => Promise<{ query: string; sources: LegalSource[]; total: number; matchType: "exact" | "approximate" } | undefined>;
  beginAllYemeniLawsSearch: (chatId: string) => Promise<void>;
  consumeAllYemeniLawsSearchQuery: (chatId: string, query: string) => Promise<{ id: number } | undefined>;
  searchAllYemeniLawsSources: (sessionId: number, page: number) => Promise<{ query: string; sources: LegalSource[]; total: number; matchType: "exact" | "approximate" } | undefined>;
  beginLibrarySearch: (chatId: string) => Promise<void>;
  consumeLibrarySearchQuery: (chatId: string, query: string) => Promise<{ id: number } | undefined>;
  searchLibrarySources: (sessionId: number, page: number) => Promise<{ query: string; sources: LegalSource[]; total: number; matchType: "exact" | "approximate" } | undefined>;
  listExamForms: (subjectKey: string) => Promise<Array<{ formKey: string; formName: string; sortOrder: number; questionCount?: number }>>;
  listExamQuestions: (subjectKey: string, sectionKey: string) => Promise<Array<{ id: number; questionText: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: "A" | "B" | "C" | "D"; explanation: string; hint: string | null; sortOrder: number }>>;
  startExamSession: (telegramUserId: string, chatId: string, subjectKey: string, sectionKey: string, timeLimitSeconds: 15 | 30 | 60 | 300) => Promise<{ id: number } | undefined>;
  getExamSession: (sessionId: number, telegramUserId: string) => Promise<TelegramExamSessionRecord | undefined>;
  setExamActivePoll: (input: { sessionId: number; telegramUserId: string; questionIndex: number; pollId: string }) => Promise<boolean>;
  getExamSessionByPoll: (pollId: string) => Promise<TelegramExamSessionRecord | undefined>;
  cancelExamSession: (telegramUserId: string, chatId: string) => Promise<{ subjectKey: string; sectionKey: string } | undefined>;
  resolveExamPoll: (input: { sessionId: number; telegramUserId: string; questionIndex: number; pollId: string; answer?: "A" | "B" | "C" | "D" }) => Promise<TelegramExamPollResolution | undefined>;
  advanceExamWrittenQuestion: (input: { sessionId: number; telegramUserId: string; questionIndex: number }) => Promise<TelegramWrittenExamResolution | undefined>;
  getExamResultSummary: (sessionId: number, telegramUserId: string) => Promise<TelegramExamResultSummary | undefined>;
  getGroupExamWaitingRound: (chatId: string, subjectKey: string, sectionKey: string) => Promise<TelegramGroupExamRoundRecord | undefined>;
  createGroupExamRound: (input: { chatId: string; creatorTelegramUserId: string; subjectKey: string; sectionKey: string; timeLimitSeconds: 15 | 30 | 60 | 300 }) => Promise<{ round: TelegramGroupExamRoundRecord; created: boolean } | undefined>;
  joinGroupExamRound: (input: { roundId: number; telegramUserId: string; displayName: string; username?: string }) => Promise<{ round: TelegramGroupExamRoundRecord; participantCount: number; joined: boolean } | undefined>;
  activateGroupExamRound: (roundId: number) => Promise<TelegramGroupExamRoundRecord | undefined>;
  getGroupExamRound: (roundId: number) => Promise<TelegramGroupExamRoundRecord | undefined>;
  cancelGroupExamRound: (roundId: number) => Promise<boolean>;
  setGroupExamActivePoll: (input: { roundId: number; questionIndex: number; pollId: string }) => Promise<boolean>;
  getGroupExamRoundByPoll: (pollId: string) => Promise<TelegramGroupExamRoundRecord | undefined>;
  recordGroupExamAnswer: (input: { pollId: string; telegramUserId: string; answer: "A" | "B" | "C" | "D" }) => Promise<boolean>;
  resolveGroupExamPoll: (pollId: string) => Promise<TelegramGroupExamPollResolution | undefined>;
  getGroupExamLeaderboard: (roundId: number) => Promise<TelegramGroupExamParticipantRecord[]>;
};

export type TelegramReplyContext = {
  messageThreadId?: number;
  directMessagesTopicId?: number;
};

function adaptReplyMarkupForTelegramContext(replyMarkup: TelegramInlineKeyboard | undefined, replyContext: TelegramReplyContext): TelegramInlineKeyboard | undefined {
  if (!replyMarkup || !Number.isInteger(replyContext.directMessagesTopicId)) return replyMarkup;
  return {
    inline_keyboard: replyMarkup.inline_keyboard.map(row => row.map(button => {
      if (!button.web_app) return button;
      return {
        text: "فتح المحادثة الخاصة لإكمال التحقق",
        url: "https://t.me/Moieen2025Bot?start=verify",
      };
    })),
  };
}

export type TelegramUpdate = {
  message?: {
    from?: { id?: number; username?: string; first_name?: string; last_name?: string };
    chat?: { id?: number; type?: string };
    message_thread_id?: number;
    direct_messages_topic?: { topic_id?: number };
    text?: string;
    caption?: string;
    document?: { file_id: string; file_name?: string; mime_type?: string };
    photo?: Array<{ file_id: string; width?: number; height?: number }>;
    web_app_data?: { data?: string; button_text?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: { id?: number; username?: string; first_name?: string; last_name?: string };
    message?: {
      chat?: { id?: number; type?: string };
      message_thread_id?: number;
      direct_messages_topic?: { topic_id?: number };
    };
  };
  poll_answer?: {
    poll_id?: string;
    user?: { id?: number };
    option_ids?: number[];
  };
  poll?: {
    id?: string;
    is_closed?: boolean;
  };
};

export const BOT_COMMANDS = [
  { command: "start", description: "بدء استخدام بوت الناصر القانوني" },
  { command: "search", description: "البحث الموحد في المصادر القانونية" },
  { command: "browse", description: "استعراض أقسام المكتبة" },
  { command: "support", description: "إرسال طلب للدعم أو اقتراح مرجع" },
  { command: "newquiz", description: "إنشاء اختبار جديد" },
  { command: "quizzes", description: "عرض اختباراتك" },
  { command: "stop", description: "إيقاف الاختبار الحالي" },
  { command: "startquiz", description: "الانضمام إلى اختبار جماعي داخل المجموعة" },
] as const;

export const OWNER_COMMANDS = [
  { command: "stats", description: "إحصاءات البوت الخاصة" },
  { command: "supportrequests", description: "عرض طلبات الدعم الجديدة" },
  { command: "broadcast", description: "معاينة بث رسالة للمشتركين" },
  { command: "broadcastfile", description: "بث ملف عبر وصفه" },
  { command: "importantlawsrequests", description: "طلبات اشتراك أهم القوانين" },
] as const;

type TelegramBroadcastDraft = {
  id: number;
  ownerTelegramUserId: string;
  kind: "message" | "document";
  message: string | null;
  fileId: string | null;
  fileName: string | null;
  caption: string | null;
  status: "draft" | "sending" | "sent" | "cancelled";
  recipientCount: number;
};

const pendingBroadcastFileUploads = new Set<string>();
const pendingImportantLawsPaymentProofs = new Map<string, {
  expiresAt: number;
  identity: ImportantYemeniLawsSubscriberIdentity & { paymentMethod: ImportantYemeniLawsPaymentMethod; accessScope: TelegramSubscriptionAccessScope; managedMenuItemId?: number };
}>();
const IMPORTANT_LAWS_PAYMENT_PROOF_TIMEOUT_MS = 15 * 60 * 1000;

const mainMenuSections = [
  { sectionKey: "browse", text: "📚 تصفح المكتبة", callbackData: "browse", sortOrder: 10 },
  { sectionKey: "search", text: "🔎 بحث موحّد", callbackData: "search", sortOrder: 20 },
  { sectionKey: "judicial", text: "⚖️ قواعد قضائية", callbackData: "judicial", sortOrder: 30 },
  { sectionKey: "legislation", text: "📜 التشريعات اليمنية", callbackData: "legislation", sortOrder: 40 },
  { sectionKey: "important-laws", text: "🔐 أهم القوانين اليمنية التفاعلي", callbackData: "important-laws", sortOrder: 50 },
  { sectionKey: "legal-forms", text: "📝 نماذج وصيغ قانونية", callbackData: "legal-forms", sortOrder: 60 },
  { sectionKey: "illustrated-legal-forms", text: "🖼 نماذج مصورة وفق القوانين اليمنية", callbackData: "illustrated-legal-forms", sortOrder: 70 },
  { sectionKey: "contract-templates", text: "📄 صيغ وعقود قانونية", callbackData: "contract-templates", sortOrder: 80 },
  { sectionKey: "exams", text: "📝 اختبارات الشريعة والقانون", callbackData: "exams", sortOrder: 90 },
  { sectionKey: "secondary-exams", text: "🧮 اختبارات الثانوية العامة", callbackData: "secondary-exams", sortOrder: 100 },
  { sectionKey: "latest", text: "🆕 أحدث الإضافات", callbackData: "latest", sortOrder: 110 },
  { sectionKey: "popular", text: "⭐ الأكثر طلبًا", callbackData: "popular", sortOrder: 120 },
  { sectionKey: "favorites", text: "⭐ مفضلتي", callbackData: "favorites", sortOrder: 130 },
  { sectionKey: "featured", text: "📌 مراجع مميزة", callbackData: "featured", sortOrder: 140 },
  { sectionKey: "support", text: "💬 تواصل ودعم", callbackData: "support", sortOrder: 150 },
] as const;

function mainMenu(managedItems: TelegramManagedMenuItemRecord[] = [], managedSections: TelegramManagedSectionRecord[] = []): TelegramInlineKeyboard {
  const sectionOverrides = new Map(managedSections.map(section => [section.sectionKey, section]));
  const sectionRows = mainMenuSections
    .map(section => ({ ...section, override: sectionOverrides.get(section.sectionKey) }))
    .filter(section => section.override?.enabled !== false)
    .sort((left, right) => (left.override?.sortOrder ?? left.sortOrder) - (right.override?.sortOrder ?? right.sortOrder))
    .map(section => [{ text: section.override?.displayLabel?.trim() || section.text, callback_data: section.callbackData }]);
  const managedRows = [...managedItems]
    .sort((left, right) => left.rowIndex - right.rowIndex || left.sortOrder - right.sortOrder || left.id - right.id)
    .map(item => [{ text: item.label, ...(item.actionType === "url" && item.accessMode === "free" ? { url: item.actionValue } : { callback_data: `managed:${item.id}` }) }]);
  return {
    inline_keyboard: [
      ...sectionRows,
      ...managedRows,
      [{ text: "❓ مساعدة", callback_data: "help" }],
      [{ text: "منصة الناصر القانونية", url: "https://alnaseer.org/" }],
      [{ text: "قناة منصة الناصر القانونية", url: "https://t.me/muen2025" }],
      [{ text: "ℹ️ عن المكتبة", callback_data: "about" }],
    ],
  };
}

function groupExamLaunchMenu(): TelegramInlineKeyboard {
  return { inline_keyboard: [[{ text: "بدء الاختبار في المجموعة ➕", callback_data: "gexam:open" }]] };
}

function groupExamTimeMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "15 ثانية لكل سؤال", callback_data: "gexam:time:15" }, { text: "30 ثانية لكل سؤال", callback_data: "gexam:time:30" }],
      [{ text: "دقيقة لكل سؤال", callback_data: "gexam:time:60" }, { text: "5 دقائق لكل سؤال", callback_data: "gexam:time:300" }],
    ],
  };
}

function groupExamReadyMenu(roundId: number, participantCount: number): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: `أنا مستعد (${participantCount}/3)`, callback_data: `gexam:ready:${roundId}` }],
      [{ text: "إنهاء الجولة", callback_data: `gexam:cancel:${roundId}` }],
    ],
  };
}

function individualExamResultMenu(): TelegramInlineKeyboard {
  const sharedText = `جرّب ${CIVIL_LAW_GENERAL_2025_TITLE} عبر بوت الناصر القانوني.`;
  return {
    inline_keyboard: [
      [{ text: "حاول مجددًا", callback_data: "exam:retry" }],
      [{ text: "بدء الاختبار في مجموعة ➕", url: "https://t.me/Moieen2025Bot?startgroup=groupquiz" }],
      [{ text: "مشاركة الاختبار ↪️", url: `https://t.me/share/url?url=${encodeURIComponent("https://t.me/Moieen2025Bot")}&text=${encodeURIComponent(sharedText)}` }],
    ],
  };
}

function quizQuickCommandsText(): string {
  return [
    "📝 اختبارات الشريعة والقانون",
    "",
    "أوامر الاختبارات السريعة:",
    "• إنشاء اختبار جديد          ← /newquiz",
    "• عرض اختباراتك              ← /quizzes",
    "• إيقاف الاختبار الحالي       ← /stop",
    "",
    "اختر المادة من القائمة أدناه أو استخدم الأمر المناسب.",
  ].join("\n");
}

function platformAccessMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "فتح منصة الناصر والتحقق", web_app: { url: TELEGRAM_PLATFORM_VERIFY_WEB_APP_URL } }],
      [{ text: "فتح المنصة في المتصفح", url: "https://alnaseer.org/" }],
      [{ text: "تحقّق من زيارة المنصة", callback_data: "platform:verify" }],
    ],
  };
}

function hasadAccessMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "فتح حصاد اليوم وتوثيق الزيارة", web_app: { url: TELEGRAM_HASAD_VERIFY_WEB_APP_URL } }],
    ],
  };
}

function hasadProtectedSectionName(data: string): "القواعد القضائية" | "الصيغ والعقود القانونية" {
  if (
    data === "judicial" || data.startsWith("index:") || data.startsWith("jsearch")
    || data.startsWith("jq:") || data.startsWith("jresult:") || data.startsWith("jfile:") || data.startsWith("jresultfile:")
  ) {
    return "القواعد القضائية";
  }
  return "الصيغ والعقود القانونية";
}

function hasadProtectedSectionKey(data: string): "judicial" | "contract-templates" {
  return hasadProtectedSectionName(data) === "القواعد القضائية" ? "judicial" : "contract-templates";
}

function hasadAccessGateText(data: string): string {
  return `🔐 للوصول المجاني إلى ${hasadProtectedSectionName(data)}، يلزم توثيق زيارة واحدة لموقع حصاد اليوم عبر الزر التالي. بعد التوثيق لن تظهر لك هذه البوابة مرة أخرى.`;
}

const REQUIRED_CHANNELS: TelegramRequiredChannel[] = [
  { title: "منصة الناصر القانونية", handle: "@muen2025", url: "https://t.me/muen2025" },
  { title: "حصاد اليوم الإخباري", handle: "@hasadalyoum", url: "https://t.me/hasadalyoum" },
];

type TelegramAccessRequirementStatus = {
  channels: Array<{ channel: TelegramRequiredChannel; status: TelegramChannelSubscriptionStatus }>;
  platformVerified: boolean;
};

function accessRequirementLine(title: string, status: TelegramChannelSubscriptionStatus) {
  if (status === "subscribed") return `✅ ${title}: مكتمل`;
  if (status === "unavailable") return `⚠️ ${title}: تعذر التحقق حاليًا`;
  return `❌ ${title}: لم يكتمل الاشتراك`;
}

function accessRequirementsText(requirements: TelegramAccessRequirementStatus) {
  const channelLines = requirements.channels.map(({ channel, status }) => accessRequirementLine(`قناة ${channel.title} (${channel.handle})`, status));
  const platformLine = requirements.platformVerified
    ? "✅ منصة الناصر القانونية: تمت الزيارة والتحقق"
    : "❌ منصة الناصر القانونية: لم تتم الزيارة أو لم يُتحقق منها بعد";
  const hasUnavailableCheck = requirements.channels.some(({ status }) => status === "unavailable");
  return [
    "🔐 لم يكتمل التحقق من متطلبات استخدام البوت",
    "حالة المتطلبات:",
    ...channelLines,
    platformLine,
    hasUnavailableCheck
      ? "تعذر التحقق من إحدى القنوات حاليًا. تأكد من الاشتراك ثم حاول مرة أخرى لاحقًا."
      : "أكمل البنود المعلّمة بعلامة ❌، ثم اضغط «تحقّق من الاشتراك». ",
  ].join("\n");
}

function channelSubscriptionMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      ...REQUIRED_CHANNELS.map(channel => [{ text: `الاشتراك في ${channel.title}`, url: channel.url }]),
      [{ text: "فتح منصة الناصر القانونية والتحقق", web_app: { url: TELEGRAM_PLATFORM_VERIFY_WEB_APP_URL } }],
      [{ text: "تحقّق من الاشتراك", callback_data: "channel:check" }],
    ],
  };
}

function categoryMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      legalCategories.map(category => ({
        text: categoryLabels[category],
        callback_data: `category:${category}`,
      })),
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

const legislationDocumentTypeLabels = {
  law: "قوانين",
  regulation: "لوائح",
  decision: "قرارات",
  agreement: "اتفاقيات",
  treaty: "معاهدات",
  decree: "مراسيم",
  other: "وثائق أخرى",
} as const;

function unifiedSearchMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "📚 البحث في المكتبة الرقمية", callback_data: "search:library" }],
      [{ text: "⚡ بحث سريع في القواعد القضائية", callback_data: "jsearch" }],
      [{ text: "⚡ بحث سريع في التشريعات اليمنية", callback_data: "lsearch" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function legislationTypeMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      (["law", "regulation", "decision"] as Array<keyof typeof legislationDocumentTypeLabels>).map(documentType => ({ text: legislationDocumentTypeLabels[documentType], callback_data: `ltype:${documentType}:1` })),
      (["agreement", "treaty", "decree"] as Array<keyof typeof legislationDocumentTypeLabels>).map(documentType => ({ text: legislationDocumentTypeLabels[documentType], callback_data: `ltype:${documentType}:1` })),
      [{ text: legislationDocumentTypeLabels.other, callback_data: "ltype:other:1" }],
      [{ text: "رجوع إلى التشريعات اليمنية", callback_data: "legislation" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function legislationFilterMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "التصفية حسب النوع", callback_data: "ltypes" }],
      [{ text: "التصفية حسب سنة الإصدار", callback_data: "lyears" }],
      [{ text: "رجوع إلى التشريعات اليمنية", callback_data: "legislation" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function legislationYearMenu(years: number[]): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      ...Array.from({ length: Math.ceil(years.length / 3) }, (_, index) => years.slice(index * 3, index * 3 + 3).map(year => ({ text: String(year), callback_data: `lyear:${year}:1` }))),
      [{ text: "رجوع إلى الفلاتر", callback_data: "lfilters" }],
      [{ text: "رجوع إلى التشريعات اليمنية", callback_data: "legislation" }],
    ],
  };
}

function supportMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function sourceMenu(sources: LegalSource[], category?: LegalCategory, page = 1, totalPages = 1): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (category && page > 1) navigation.push({ text: "السابق", callback_data: `category:${category}:${page - 1}` });
if (category && page < totalPages) navigation.push({ text: "التالي", callback_data: `category:${category}:${page + 1}` });

return {
inline_keyboard: [
      ...searchSourceRows(sources, source => `source:${source.id}`),
...(navigation.length > 0 ? [navigation] : []),
[{ text: "التصنيفات", callback_data: "browse" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function librarySearchMenu(sources: LegalSource[], sessionId: number, page: number, totalPages: number): TelegramInlineKeyboard {
const navigation = [] as Array<{ text: string; callback_data: string }>;
if (page > 1) navigation.push({ text: "السابق", callback_data: `bresult:${sessionId}:${page - 1}` });
if (page < totalPages) navigation.push({ text: "التالي", callback_data: `bresult:${sessionId}:${page + 1}` });
return {
inline_keyboard: [
      ...searchSourceRows(sources, source => `source:${source.id}`),
...(navigation.length > 0 ? [navigation] : []),
[{ text: "بحث جديد", callback_data: "search:library" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function curatedSourceMenu(sources: LegalSource[], backCallback: string): TelegramInlineKeyboard {
return {
inline_keyboard: [
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `source:${source.id}` }]),
[{ text: "رجوع", callback_data: backCallback }],
[{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function legislationTypeSourceMenu(sources: LegalSource[], documentType: keyof typeof legislationDocumentTypeLabels, page: number, totalPages: number): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `ltype:${documentType}:${page - 1}` });
if (page < totalPages) navigation.push({ text: "التالي", callback_data: `ltype:${documentType}:${page + 1}` });
return {
inline_keyboard: [
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `source:${source.id}` }]),
...(navigation.length > 0 ? [navigation] : []),
[{ text: "تصفية حسب النوع", callback_data: "ltypes" }],
      [{ text: "رجوع إلى التشريعات اليمنية", callback_data: "legislation" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function legislationYearSourceMenu(sources: LegalSource[], year: number, page: number, totalPages: number): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `lyear:${year}:${page - 1}` });
if (page < totalPages) navigation.push({ text: "التالي", callback_data: `lyear:${year}:${page + 1}` });
return {
inline_keyboard: [
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `source:${source.id}` }]),
...(navigation.length > 0 ? [navigation] : []),
[{ text: "اختيار سنة أخرى", callback_data: "lyears" }],
      [{ text: "رجوع إلى الفلاتر", callback_data: "lfilters" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

export function buttonLabel(label: string, prefix = "") {
  const maxLength = 54 - prefix.length;
  const veryLongThreshold = 58 - prefix.length;
  if (label.length <= veryLongThreshold) return `${prefix}${label}`;
  const visible = label.slice(0, Math.max(1, maxLength - 1));
  const wordBoundary = visible.lastIndexOf(" ");
  const shortened = wordBoundary >= Math.floor(maxLength * 0.55) ? visible.slice(0, wordBoundary) : visible;
  return `${prefix}${shortened.trimEnd()}…`;
}

function searchSourceRows(sources: LegalSource[], openCallback: (source: LegalSource) => string, displayLabel: (source: LegalSource) => string = displaySourceTitle) {
  return sources.flatMap(source => [
    [{ text: buttonLabel(displayLabel(source)), callback_data: openCallback(source) }],
    [{ text: "⭐ إضافة للمفضلة", callback_data: `favadd:${source.id}` }],
  ]);
}

function favoritesMenu(favorites: Array<{ source: LegalSource }>): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      ...favorites.flatMap(({ source }) => [
        [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `source:${source.id}` }],
        [{ text: "🗑 إزالة من المفضلة", callback_data: `favremove:${source.id}` }],
      ]),
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function highlightedArabicPattern(word: string) {
  const characterPatterns: Record<string, string> = {
    ا: "[اأإآ]",
    ه: "[هة]",
    ي: "[يى]",
  };
  return Array.from(word)
    .map(character => `${characterPatterns[character] ?? character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\u064B-\u065F]*`)
    .join("");
}

export function highlightSearchTerm(label: string, query: string) {
  const words = normalizeArabicSearch(query).split(" ").filter(word => word.length > 1).sort((first, second) => second.length - first.length);
  if (words.length === 0) return label;
  return words.reduce((highlighted, word) => highlighted.replace(new RegExp(highlightedArabicPattern(word), "giu"), match => `🟨${match}🟨`), label);
}

function judicialFolderMenu(
  folders: LegalFolder[],
  sources: LegalSource[],
  folder: LegalFolder,
  page: number,
  totalPages: number
): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `index:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `index:${folder.driveFolderId}:${page + 1}` });
const backData = folder.parentDriveFolderId ? `index:${folder.parentDriveFolderId}:1` : "menu";

return {
inline_keyboard: [
      ...folders.map(child => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `index:${child.driveFolderId}:1` }]),
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `jfile:${source.id}:${folder.driveFolderId}:${page}` }]),
...(navigation.length > 0 ? [navigation] : []),
      [{ text: "⚡ بحث سريع", callback_data: "jsearch" }],
      [{ text: "رجوع", callback_data: backData }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function judicialSourceMenu(folderId: string, page: number): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "رجوع إلى المجلد", callback_data: `index:${folderId}:${page}` }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function judicialSearchMenu(sources: LegalSource[], sessionId: number, page: number, totalPages: number, query: string): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `jresult:${sessionId}:${page - 1}` });
if (page < totalPages) navigation.push({ text: "التالي", callback_data: `jresult:${sessionId}:${page + 1}` });
return {
inline_keyboard: [
      ...searchSourceRows(sources, source => `jresultfile:${source.id}:${sessionId}:${page}`, source => highlightSearchTerm(displaySourceTitle(source), query)),
...(navigation.length > 0 ? [navigation] : []),
[{ text: "رجوع إلى قواعد قضائية", callback_data: "judicial" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function judicialSearchSourceMenu(sessionId: number, page: number): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "رجوع إلى النتائج", callback_data: `jresult:${sessionId}:${page}` }],
      [{ text: "رجوع إلى قواعد قضائية", callback_data: "judicial" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function legislationFolderMenu(
  folders: LegalFolder[],
  sources: LegalSource[],
  folder: LegalFolder,
  page: number,
  totalPages: number
): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `lindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `lindex:${folder.driveFolderId}:${page + 1}` });
const backData = folder.parentDriveFolderId ? `lindex:${folder.parentDriveFolderId}:1` : "menu";

return {
inline_keyboard: [
      ...folders.map(child => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `lindex:${child.driveFolderId}:1` }]),
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `lfile:${source.id}:${folder.driveFolderId}:${page}` }]),
...(navigation.length > 0 ? [navigation] : []),
      [{ text: "⚡ بحث سريع", callback_data: "lsearch" }],
      [{ text: "تصفية التشريعات", callback_data: "lfilters" }],
      [{ text: "رجوع", callback_data: backData }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function yemeniLawsFolderMenu(
  folders: LegalFolder[],
  sources: LegalSource[],
  folder: LegalFolder,
  page: number,
  totalPages: number
): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `ylindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `ylindex:${folder.driveFolderId}:${page + 1}` });
const backData = folder.parentDriveFolderId ? `ylindex:${folder.parentDriveFolderId}:1` : "menu";
return {
inline_keyboard: [
      ...folders.map(child => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `ylindex:${child.driveFolderId}:1` }]),
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `ylfile:${source.id}:${folder.driveFolderId}:${page}` }]),
...(navigation.length > 0 ? [navigation] : []),
[{ text: "رجوع", callback_data: backData }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function cleanLegalFormsDisplayName(name: string) {
  const cleaned = name
    .replace(/\.(?:docx?|pdf)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/[ـ]+/g, "")
    .replace(/\s*\(\s*\d+\s*\)\s*/g, " ")
    .replace(/^\d+\s*(?=[\u0621-\u064A])/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name;
}

function cleanContractTemplateDisplayName(name: string) {
  const cleaned = name
    .replace(/\.(?:docx?|pdf)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name;
}

function cleanFeaturedReferencesDisplayName(name: string) {
  const cleaned = name
    .replace(/\.(?:docx?|pdf|zip)$/i, "")
    .replace(/[_\s-]*تطبيق الباحث القانوني[_\s-]*أ\.?\s*معين الناصر.*$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/[ـ]+/g, "")
    .replace(/\s*\(\s*\d+\s*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name;
}

function cleanGenericFileDisplayName(name: string) {
  const cleaned = name
    .replace(/\.(?:docx?|pdf|zip)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/[ـ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name;
}

function displaySourceTitle(source: LegalSource) {
  if (source.collection === "legal_forms") return cleanLegalFormsDisplayName(source.title);
  if (source.collection === "featured_references") return cleanFeaturedReferencesDisplayName(source.title);
  return cleanGenericFileDisplayName(source.title);
}

function legalFormsFolderMenu(
  folders: LegalFolder[],
  sources: LegalSource[],
  folder: LegalFolder,
  page: number,
  totalPages: number
): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `findex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `findex:${folder.driveFolderId}:${page + 1}` });
const backData = folder.parentDriveFolderId ? `findex:${folder.parentDriveFolderId}:1` : "menu";
return {
inline_keyboard: [
      ...folders.map(child => [{ text: buttonLabel(cleanLegalFormsDisplayName(child.name)), callback_data: `findex:${child.driveFolderId}:1` }]),
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `fform:${source.id}:${folder.driveFolderId}:${page}` }]),
...(navigation.length > 0 ? [navigation] : []),
[{ text: "رجوع", callback_data: backData }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function illustratedLegalFormsFolderMenu(
  folders: LegalFolder[],
  sources: LegalSource[],
  folder: LegalFolder,
  page: number,
  totalPages: number
): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `vindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `vindex:${folder.driveFolderId}:${page + 1}` });
  const backData = folder.parentDriveFolderId ? `vindex:${folder.parentDriveFolderId}:1` : "menu";
  return {
    inline_keyboard: [
      ...folders.map(child => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `vindex:${child.driveFolderId}:1` }]),
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `vfile:${source.id}:${folder.driveFolderId}:${page}` }]),
      ...(navigation.length > 0 ? [navigation] : []),
      [{ text: "رجوع", callback_data: backData }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function allYemeniLawsFolderMenu(
  folders: LegalFolder[],
  sources: LegalSource[],
  folder: LegalFolder,
  page: number,
  totalPages: number
): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `ayindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `ayindex:${folder.driveFolderId}:${page + 1}` });
  const backData = folder.parentDriveFolderId ? `ayindex:${folder.parentDriveFolderId}:1` : "menu";
  return {
    inline_keyboard: [
      ...folders.map(child => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `ayindex:${child.driveFolderId}:1` }]),
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `ayfile:${source.id}:${folder.driveFolderId}:${page}` }]),
      ...(navigation.length > 0 ? [navigation] : []),
      [{ text: "⚡ بحث سريع", callback_data: "aysearch" }],
      [{ text: "رجوع", callback_data: backData }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function contractTemplatesMenu(templates: TelegramContractTemplate[], page: number, total: number): TelegramInlineKeyboard {
  const totalPages = Math.max(1, Math.ceil(total / 8));
  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (page > 1) navigation.push({ text: "السابق", callback_data: `ctemplates:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `ctemplates:${page + 1}` });
  return {
    inline_keyboard: [
      [{ text: "🔍 بحث داخل الصيغ والعقود", callback_data: "ctsearch" }],
      [{ text: "🗂 تصفية حسب نوع العقد", callback_data: "ctypes" }],
      ...templates.map(template => [{ text: buttonLabel(cleanContractTemplateDisplayName(template.fileName)), callback_data: `ctemplate:${template.id}:${page}` }]),
      ...(navigation.length ? [navigation] : []),
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

async function sendContractTemplatesMenu(chatId: number, requestedPage: number, store: TelegramLibraryStore, sender: TelegramSender): Promise<void> {
  const page = Math.max(1, requestedPage);
  const result = await store.listContractTemplates(page);
  const totalPages = Math.max(1, Math.ceil(result.total / 8));
  const safePage = Math.min(page, totalPages);
  const content = safePage === page ? result : await store.listContractTemplates(safePage);
  if (content.total === 0) {
    await sender.sendMessage(chatId, "لا تتوافر صيغ أو عقود قانونية كملفات حاليًا.", mainMenu());
    return;
  }
  await sender.sendMessage(
    chatId,
    `📄 صيغ وعقود قانونية\n\nاختر النموذج أو العقد المطلوب. كل اختيار يجهز ملف Word مستقلًا عند طلبك.\nالصفحة ${safePage} من ${totalPages} (${content.total} ملفًا).`,
    contractTemplatesMenu(content.templates, safePage, content.total)
  );
}

function isTelegramContractTemplateType(value: string): value is TelegramContractTemplateType {
  return Object.prototype.hasOwnProperty.call(TELEGRAM_CONTRACT_TYPE_LABELS, value);
}

function contractTemplateTypesMenu(types: Array<{ contractType: TelegramContractTemplateType; count: number }>): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      ...types.map(type => [{ text: `${TELEGRAM_CONTRACT_TYPE_LABELS[type.contractType]} (${type.count})`, callback_data: `ctype:${type.contractType}:1` }]),
      [{ text: "رجوع إلى الصيغ والعقود", callback_data: "contract-templates" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

async function sendContractTemplateTypesMenu(chatId: number, store: TelegramLibraryStore, sender: TelegramSender): Promise<void> {
  const types = await store.listContractTemplateTypes();
  if (types.length === 0) {
    await sender.sendMessage(chatId, "لا تتوافر أنواع عقود قابلة للتصفية حاليًا.", { inline_keyboard: [[{ text: "رجوع إلى الصيغ والعقود", callback_data: "contract-templates" }]] });
    return;
  }
  await sender.sendMessage(chatId, "🗂 تصفية حسب نوع العقد\n\nاختر النوع المطلوب لعرض نماذجه فقط:", contractTemplateTypesMenu(types));
}

function contractTemplatesByTypeMenu(templates: TelegramContractTemplate[], contractType: TelegramContractTemplateType, page: number, total: number): TelegramInlineKeyboard {
  const totalPages = Math.max(1, Math.ceil(total / 8));
  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (page > 1) navigation.push({ text: "السابق", callback_data: `ctype:${contractType}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `ctype:${contractType}:${page + 1}` });
  return {
    inline_keyboard: [
      ...templates.map(template => [{ text: buttonLabel(cleanContractTemplateDisplayName(template.fileName)), callback_data: `ctemplate:${template.id}:type:${contractType}:${page}` }]),
      ...(navigation.length ? [navigation] : []),
      [{ text: "أنواع العقود", callback_data: "ctypes" }],
      [{ text: "رجوع إلى الصيغ والعقود", callback_data: "contract-templates" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

async function sendContractTemplatesByType(chatId: number, contractType: TelegramContractTemplateType, requestedPage: number, store: TelegramLibraryStore, sender: TelegramSender): Promise<void> {
  const page = Math.max(1, requestedPage);
  const result = await store.listContractTemplatesByType(contractType, page);
  const totalPages = Math.max(1, Math.ceil(result.total / 8));
  const safePage = Math.min(page, totalPages);
  const content = safePage === page ? result : await store.listContractTemplatesByType(contractType, safePage);
  const label = TELEGRAM_CONTRACT_TYPE_LABELS[contractType];
  if (content.total === 0) {
    await sender.sendMessage(chatId, `لا تتوافر نماذج ضمن «${label}» حاليًا.`, { inline_keyboard: [[{ text: "أنواع العقود", callback_data: "ctypes" }], [{ text: "رجوع إلى الصيغ والعقود", callback_data: "contract-templates" }]] });
    return;
  }
  await sender.sendMessage(
    chatId,
    `📄 ${label}\n\nاختر النموذج المطلوب.\nالصفحة ${safePage} من ${totalPages} (${content.total} نموذجًا).`,
    contractTemplatesByTypeMenu(content.templates, contractType, safePage, content.total)
  );
}

function contractTemplateSearchMenu(templates: TelegramContractTemplate[], sessionId: number, page: number, total: number): TelegramInlineKeyboard {
  const totalPages = Math.max(1, Math.ceil(total / 8));
  const navigation: Array<{ text: string; callback_data: string }> = [];
  if (page > 1) navigation.push({ text: "السابق", callback_data: `ctresult:${sessionId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `ctresult:${sessionId}:${page + 1}` });
  return {
    inline_keyboard: [
      ...templates.map(template => [{ text: buttonLabel(cleanContractTemplateDisplayName(template.fileName)), callback_data: `ctemplate:${template.id}:search:${sessionId}:${page}` }]),
      ...(navigation.length ? [navigation] : []),
      [{ text: "بحث جديد", callback_data: "ctsearch" }],
      [{ text: "رجوع إلى الصيغ والعقود", callback_data: "contract-templates" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

async function promptContractTemplateSearch(chatId: number, store: TelegramLibraryStore, sender: TelegramSender): Promise<void> {
  await store.beginContractTemplateSearch(String(chatId));
  await sender.sendMessage(
    chatId,
    "اكتب اسم النموذج أو كلمة منه للبحث داخل الصيغ والعقود القانونية. مثال: موافقة أو إيجار أو وكالة.",
    { inline_keyboard: [[{ text: "رجوع إلى الصيغ والعقود", callback_data: "contract-templates" }], [{ text: "القائمة الرئيسة", callback_data: "menu" }]] }
  );
}

async function sendContractTemplateSearchResults(chatId: number, sessionId: number, requestedPage: number, store: TelegramLibraryStore, sender: TelegramSender): Promise<void> {
  const initial = await store.searchContractTemplates(sessionId, Math.max(1, requestedPage));
  if (!initial) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchExpired("الصيغ والعقود القانونية"), { inline_keyboard: [[{ text: "بحث جديد", callback_data: "ctsearch" }], [{ text: "الصيغ والعقود القانونية", callback_data: "contract-templates" }]] });
    return;
  }
  if (initial.total === 0) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchNoResults("الصيغ والعقود القانونية", initial.query), { inline_keyboard: [[{ text: "بحث جديد", callback_data: "ctsearch" }], [{ text: "رجوع إلى الصيغ والعقود", callback_data: "contract-templates" }]] });
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.total / 8));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.searchContractTemplates(sessionId, page);
  if (!content) return;
  const matchNote = content.matchType === "approximate" ? TELEGRAM_USER_MESSAGES.approximateSearchNote : "";
  await sender.sendMessage(
    chatId,
    `نتائج «${content.query}» داخل الصيغ والعقود القانونية — الصفحة ${page} من ${totalPages} (${content.total} نتيجة):${matchNote}`,
    contractTemplateSearchMenu(content.templates, sessionId, page, content.total)
  );
}

function featuredReferencesFolderMenu(
  folders: LegalFolder[],
  sources: LegalSource[],
  folder: LegalFolder,
  page: number,
  totalPages: number
): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `rindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `rindex:${folder.driveFolderId}:${page + 1}` });
const backData = folder.parentDriveFolderId ? `rindex:${folder.parentDriveFolderId}:1` : "menu";
return {
inline_keyboard: [
      ...folders.map(child => [{ text: buttonLabel(cleanFeaturedReferencesDisplayName(child.name)), callback_data: `rindex:${child.driveFolderId}:1` }]),
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `rfile:${source.id}:${folder.driveFolderId}:${page}` }]),
...(navigation.length > 0 ? [navigation] : []),
[{ text: "رجوع", callback_data: backData }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function importantYemeniLawsFolderMenu(
  folders: LegalFolder[],
  sources: LegalSource[],
  folder: LegalFolder,
  page: number,
  totalPages: number
): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `iindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `iindex:${folder.driveFolderId}:${page + 1}` });
const backData = folder.parentDriveFolderId ? `iindex:${folder.parentDriveFolderId}:1` : "menu";
return {
inline_keyboard: [
      ...folders.map(child => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `iindex:${child.driveFolderId}:1` }]),
      ...sources.map(source => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `ifile:${source.id}:${folder.driveFolderId}:${page}` }]),
...(navigation.length > 0 ? [navigation] : []),
[{ text: "رجوع", callback_data: backData }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function importantYemeniLawsSubscriptionMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "إرسال طلب الاشتراك بعد التحويل", callback_data: "important-laws:request" }],
      [{ text: "🎁 وصول مجاني بالإحالة", callback_data: "premium:referral" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function referralMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "🔗 عرض رابط الإحالة والمتابعة", callback_data: "premium:referral" }],
      [{ text: "📋 سجل الإحالات والحالات", callback_data: "premium:referrals" }],
      [{ text: "💳 الاشتراك المدفوع", callback_data: "important-laws:request" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function referralHelpText(progress: { qualifiedCount: number; pendingCount: number; remainingCount: number; activeAccessExpiresAt: Date | null }, telegramUserId: string) {
  const link = `https://t.me/Moieen2025Bot?start=ref_${telegramUserId}`;
  const expiry = progress.activeAccessExpiresAt
    ? `\n\n✅ لديك وصول إحالة فعّال حتى: ${progress.activeAccessExpiresAt.toLocaleDateString("ar-YE", { year: "numeric", month: "long", day: "numeric" })}.`
    : "";
  return [
    "🎁 نظام الإحالة — وصول مجاني لمدة شهر",
    "شارك رابطك الشخصي مع أصدقائك. عند اكتمال 5 إحالات مؤهلة تحصل على شهر واحد من الوصول إلى: اختبارات الشريعة والقانون، اختبارات الثانوية العامة، القواعد القضائية، الصيغ والعقود القانونية، وأهم القوانين اليمنية التفاعلي.",
    "",
    `📊 إحالاتك المحتسبة: ${progress.qualifiedCount} | قيد التأهيل: ${progress.pendingCount} | المتبقي للمكافأة التالية: ${progress.remainingCount}.`,
    "",
    "✅ تُحتسب الإحالة فقط لمستخدم جديد يبدأ البوت من رابطك، ويكمل اشتراك القنوات المطلوبة وزيارة منصة الناصر، ثم يبقى مؤهلًا لمدة 24 ساعة على الأقل.",
    "⛔ لا تُحتسب إحالتك لنفسك، ولا يُحتسب الحساب أكثر من مرة، وتخضع الحالات المشبوهة للمراجعة والإلغاء من الإدارة.",
    "",
    "🔗 رابط إحالتك الشخصي:",
    link,
    expiry,
  ].join("\n");
}

function examAccessScope(data: string): TelegramPaidAccessScope {
  return data === "secondary-exams" ? "secondary_exams" : "sharia_exams";
}

function subscriptionScopeLabel(scope: TelegramSubscriptionAccessScope) {
  if (scope === "sharia_exams") return "اختبارات الشريعة والقانون";
  if (scope === "secondary_exams") return "اختبارات الثانوية العامة";
  return "أهم القوانين اليمنية التفاعلي";
}

function optionalExamSupportText(scope: TelegramPaidAccessScope) {
  return [
    `📚 ${subscriptionScopeLabel(scope)}`,
    "نظام الاختبارات مبادرة تعليمية. يمكنك المساهمة بدعم اختياري لاستمرار البوت وتطوير محتواه، من دون تحديد مبلغ أو التزام مالي.",
    "كما يمكنك الحصول على وصول مجاني لمدة شهر عند اكتمال 5 إحالات مؤهلة.",
  ].join("\n\n");
}

function optionalExamSupportMenu(scope: TelegramPaidAccessScope): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "🎁 وصول مجاني بالإحالة", callback_data: "premium:referral" }],
      [{ text: "💳 الاشتراك المدفوع", callback_data: `premium:request:${scope}` }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function isReferralProtectedCallback(data: string) {
  return data === "exams" || data === "secondary-exams" || data.startsWith("exam:");
}

function managedSectionAccessMode(managedSections: TelegramManagedSectionRecord[], sectionKey: string): "free" | "premium" | "hasad" {
  // الاختبارات مجانية دائمًا، ويكون توثيق زيارة حصاد اليوم شرط الوصول الوحيد لها.
  if (sectionKey === "exams" || sectionKey === "secondary-exams") return "hasad";
  const configured = managedSections.find(section => section.sectionKey === sectionKey)?.accessMode;
  if (configured === "free" || configured === "premium" || configured === "hasad") return configured;
  return sectionKey === "judicial" || sectionKey === "contract-templates" ? "hasad" : "premium";
}

function hasFreeManagedSectionAccess(managedSections: TelegramManagedSectionRecord[], sectionKey: string) {
  return managedSectionAccessMode(managedSections, sectionKey) === "free";
}

function managedSectionForCallback(data: string): "important-laws" | "exams" | "secondary-exams" | "judicial" | "contract-templates" | undefined {
  if (isHasadProtectedCallback(data)) return hasadProtectedSectionKey(data);
  if (isReferralProtectedCallback(data)) return data === "secondary-exams" ? "secondary-exams" : "exams";
  if (data === "important-laws" || data.startsWith("ylindex:") || data.startsWith("iindex:") || data.startsWith("ylfile:") || data.startsWith("ifile:")) return "important-laws";
  return undefined;
}

function isHasadProtectedCallback(data: string) {
  return data === "judicial" || data === "contract-templates"
    || data.startsWith("index:") || data.startsWith("jsearch") || data.startsWith("jq:") || data.startsWith("jresult:") || data.startsWith("jfile:") || data.startsWith("jresultfile:")
    || data.startsWith("ctemplates:") || data.startsWith("ctemplate:") || data.startsWith("ctypes") || data.startsWith("ctype:") || data.startsWith("ctsearch");
}

function referralStartReferrerId(text: string) {
  const match = text.match(/^\/start\s+ref_(\d{1,32})$/);
  return match?.[1];
}

function referralRegistrationText(result: TelegramReferralRegistrationResult | "existing_user" | "invalid_link") {
  if (result === "created") return "✅ تم تسجيل الإحالة بنجاح. ستصبح مؤهلة لصاحب الرابط بعد استكمال القنوات وزيارة المنصة وبقاء الحساب مؤهلًا لمدة 24 ساعة.";
  if (result === "existing_user") return "ℹ️ لم تُسجل هذه الإحالة لأن هذا الحساب استخدم البوت سابقًا. لمنع التلاعب، تُحتسب الإحالة فقط عند أول بدء للبوت من رابط الإحالة.";
  if (result === "self_referral") return "ℹ️ لا يمكن احتساب إحالة الحساب لنفسه.";
  if (result === "referrer_not_found") return "ℹ️ لا يمكن تسجيل الإحالة لأن صاحب الرابط لم يبدأ البوت بعد. اطلب منه فتح البوت مرة واحدة ثم استخدم رابطًا جديدًا.";
  if (result === "already_referred") return "ℹ️ هذا الحساب مرتبط مسبقًا برابط إحالة آخر، ولا يمكن نقله أو احتسابه مرتين.";
  if (result === "invalid_link") return "ℹ️ رابط الإحالة غير صالح. افتح الرابط الذي أنشأه البوت من زر «رابط الإحالة» مباشرة.";
  return "⚠️ تعذر تسجيل الإحالة حاليًا. أعد فتح رابط الإحالة بعد قليل.";
}

function referralHistoryText(items: Array<{ id: number; status: "pending" | "qualified" | "rejected"; createdAt: Date; qualifiedAt: Date | null; rejectedAt: Date | null; rejectionReason: string | null }>) {
  if (!items.length) return "📋 سجل الإحالات\n\nلا توجد إحالات مسجلة بعد. شارك رابطك الشخصي من زر «عرض رابط الإحالة والمتابعة».";
  const rows = items.map((item, index) => {
    const created = item.createdAt.toLocaleDateString("ar-YE", { year: "numeric", month: "numeric", day: "numeric" });
    if (item.status === "qualified") return `${index + 1}. ✅ محتسبة بنجاح${item.qualifiedAt ? ` — ${item.qualifiedAt.toLocaleDateString("ar-YE")}` : ""}`;
    if (item.status === "rejected") return `${index + 1}. ❌ غير مؤهلة${item.rejectionReason ? ` — ${item.rejectionReason}` : ""}`;
    return `${index + 1}. ⏳ قيد التأهيل منذ ${created} — تُحتسب بعد 24 ساعة من استكمال الشروط.`;
  });
  return ["📋 سجل الإحالات", "", "لا تظهر هويات الأشخاص المُحالين حمايةً للخصوصية.", "", ...rows].join("\n");
}

async function qualifyReferralIfEligible(telegramUserId: string, store: TelegramLibraryStore, sender: TelegramSender) {
  const result = await store.qualifyReferral(telegramUserId);
  if (!result.event) return;
  const referrerChatId = Number(result.event.referrerChatId);
  if (!Number.isSafeInteger(referrerChatId)) return;
  const reward = result.event.rewardExpiresAt
    ? `\n\n🎉 اكتملت خمس إحالات مؤهلة. فُعّل لك وصول مجاني لمدة شهر إلى الأقسام المميزة حتى ${result.event.rewardExpiresAt.toLocaleDateString("ar-YE", { year: "numeric", month: "long", day: "numeric" })}.`
    : "";
  await sender.sendMessage(referrerChatId, `✅ تم احتساب إحالة جديدة بنجاح.\n📊 إحالاتك المحتسبة: ${result.event.qualifiedCount} | المتبقي للمكافأة التالية: ${result.event.remainingCount}.${reward}`, referralMenu()).catch(() => undefined);
}

function importantYemeniLawsPaymentMethodMenu(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "تحويل عبر كريمي — 3007145477", callback_data: "important-laws:payment:karimi" }],
      [{ text: "تحويل عبر محفظة جيب — 488281", callback_data: "important-laws:payment:jeeb" }],
      [{ text: "رجوع", callback_data: "important-laws" }],
    ],
  };
}

function paidExamPaymentMethodMenu(scope: TelegramPaidAccessScope): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "تحويل عبر كريمي — 3007145477", callback_data: `premium:payment:${scope}:karimi` }],
      [{ text: "تحويل عبر محفظة جيب — 488281", callback_data: `premium:payment:${scope}:jeeb` }],
      [{ text: "رجوع", callback_data: scope === "sharia_exams" ? "exams" : "secondary-exams" }],
    ],
  };
}

function managedMenuItemPaymentMethodMenu(itemId: number): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "تحويل عبر كريمي — 3007145477", callback_data: `managed-premium:payment:${itemId}:karimi` }],
      [{ text: "تحويل عبر محفظة جيب — 488281", callback_data: `managed-premium:payment:${itemId}:jeeb` }],
      [{ text: "رجوع", callback_data: `managed:${itemId}` }],
    ],
  };
}

type ImportantYemeniLawsSubscriberIdentity = {
  telegramUserId: string;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  telegramLastName?: string | null;
  paymentMethod?: string | null;
};

function importantYemeniLawsSubscriberText(identity: ImportantYemeniLawsSubscriberIdentity) {
  const displayName = [identity.telegramFirstName, identity.telegramLastName].filter(Boolean).join(" ").trim();
  return [
    `معرّف تيليغرام: ${identity.telegramUserId}`,
    displayName ? `الاسم الظاهر: ${displayName}` : "الاسم الظاهر: غير متاح",
    identity.telegramUsername ? `اسم المستخدم: @${identity.telegramUsername}` : "اسم المستخدم: غير متاح",
  ].join("\n");
}

function importantYemeniLawsPaymentMethodText(paymentMethod?: string | null) {
  const payment = paymentMethod ? importantYemeniLawsPaymentMethods[paymentMethod as ImportantYemeniLawsPaymentMethod] : undefined;
  return payment
    ? `طريقة التحويل المختارة: ${payment.label}\nبيانات التحويل: ${payment.details}`
    : "طريقة التحويل: لم تُحدد في الطلب.";
}

function importantYemeniLawsApprovalMenu(requestId: number, identity: ImportantYemeniLawsSubscriberIdentity): TelegramInlineKeyboard {
  const profileLink = identity.telegramUsername
    ? { text: `فتح @${identity.telegramUsername}`, url: `https://t.me/${identity.telegramUsername}` }
    : { text: "فتح ملف المشترك", url: `tg://user?id=${identity.telegramUserId}` };
  return {
    inline_keyboard: [
      [{ text: "اعتماد الاشتراك", callback_data: `important-laws:approve:${requestId}` }],
      [{ text: "رفض الطلب", callback_data: `important-laws:reject:${requestId}` }],
      [profileLink],
    ],
  };
}

function legislationSearchMenu(sources: LegalSource[], sessionId: number, page: number, totalPages: number, query: string): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `lresult:${sessionId}:${page - 1}` });
if (page < totalPages) navigation.push({ text: "التالي", callback_data: `lresult:${sessionId}:${page + 1}` });
return {
inline_keyboard: [
      ...searchSourceRows(sources, source => `lresultfile:${source.id}:${sessionId}:${page}`, source => highlightSearchTerm(displaySourceTitle(source), query)),
...(navigation.length > 0 ? [navigation] : []),
[{ text: "رجوع إلى التشريعات اليمنية", callback_data: "legislation" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function allYemeniLawsSearchMenu(sources: LegalSource[], sessionId: number, page: number, totalPages: number, query: string): TelegramInlineKeyboard {
  const navigation = [] as Array<{ text: string; callback_data: string }>;
  if (page > 1) navigation.push({ text: "السابق", callback_data: `ayresult:${sessionId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "التالي", callback_data: `ayresult:${sessionId}:${page + 1}` });
  return {
    inline_keyboard: [
      ...searchSourceRows(sources, source => `ayresultfile:${source.id}:${sessionId}:${page}`, source => highlightSearchTerm(displaySourceTitle(source), query)),
      ...(navigation.length > 0 ? [navigation] : []),
      [{ text: "بحث جديد", callback_data: "aysearch" }],
      [{ text: "رجوع إلى جميع القوانين اليمنية", callback_data: "all-yemeni-laws" }],
      [{ text: "القائمة الرئيسة", callback_data: "menu" }],
    ],
  };
}

function welcomeText(override?: string) {
  return override?.trim() || [
    "🏛 مرحباً بك في بوت الناصر القانوني",
    "منصة رقمية متخصصة تهدف إلى تيسير الوصول إلى المصادر والمراجع القانونية والفقهية لطلاب الشريعة والقانون والباحثين.",
    "اختر من القائمة أدناه للبدء:",
  ].join("\n\n");
}

function platformAccessText() {
  return [
    "🏛 أهلاً بك في بوت الناصر القانوني",
    "لاستخدام المكتبة والخدمات القانونية، افتح أولاً منصة الناصر القانونية عبر الزر التالي.",
    "بعد فتح المنصة، اضغط «لقد فتحت المنصة — متابعة» للانتقال إلى خدمات البوت.",
  ].join("\n\n");
}

function browseText() {
  return [
    "📚 تصنيفات المكتبة الرقمية:",
    "اختر التصنيف المطلوب للاطلاع على المراجع والكتب المتاحة.",
  ].join("\n\n");
}

function judicialIntroText() {
  return [
    "⚖️ المبادئ والقواعد القضائية:",
    "قسم يتضمن أهم الأحكام والمبادئ الصادرة عن المحاكم العليا والدوائر القضائية.",
    "اختر المجال المطلوب من الفهرس أدناه: مبادئ مدنية، ومبادئ جزائية، ومبادئ تجارية وإدارية.",
  ].join("\n\n");
}

function legislationIntroText() {
  return [
    "📜 التشريعات اليمنية:",
    "فهرس تفاعلي للتشريعات والاتفاقيات واللوائح اليمنية المتاحة في المكتبة.",
    "اختر ملفاً من الفهرس، أو استخدم البحث للوصول السريع إلى التشريع المطلوب.",
  ].join("\n\n");
}

function yemeniLawsIntroText() {
  return [
    "📚 القوانين اليمنية فهرس تفاعلي:",
    "فهرس داخلي منظم لملفات القوانين اليمنية المتاحة.",
    "اختر ملفًا من القائمة ليُرسل لك داخل محادثتك الخاصة مع البوت.",
  ].join("\n\n");
}

function legalFormsIntroText() {
  return [
    "📝 نماذج وصيغ قانونية:",
    "فهرس تفاعلي منظم للنماذج والصيغ والمذكرات القانونية.",
    "عُرضت أسماء الملفات بصورة واضحة ومنظمة؛ اختر الملف المطلوب ليُرسل داخل محادثتك الخاصة.",
  ].join("\n\n");
}

function illustratedLegalFormsIntroText() {
  return [
    "🖼 نماذج مصورة وفق القوانين اليمنية:",
    "فهرس تفاعلي منظم لنماذج قانونية مصورة وفق القوانين اليمنية.",
    "اختر الاسم المطلوب ليُرسل داخل محادثتك الخاصة مع البوت.",
  ].join("\n\n");
}

function allYemeniLawsIntroText() {
  return [
    "⚖️ جميع القوانين اليمنية:",
    "فهرس تفاعلي يضم القوانين واللوائح اليمنية المتاحة في المكتبة بأسماء قانونية مقروءة.",
    "استخدم البحث السريع أو اختر الاسم المطلوب ليُرسل داخل محادثتك الخاصة مع البوت.",
  ].join("\n\n");
}

function featuredReferencesIntroText() {
  return [
    "📌 مراجع مميزة:",
    "فهرس تفاعلي لمراجع قانونية منتقاة وكتب ووثائق مفيدة للباحث القانوني.",
    "عُرضت أسماء الملفات بصورة مختصرة وواضحة؛ اختر الملف المطلوب ليُرسل داخل محادثتك الخاصة.",
  ].join("\n\n");
}

function importantYemeniLawsIntroText() {
  return [
    "🔐 خدمة أهم القوانين اليمنية التفاعلي",
    "هذا قسم خاص يُفتح للمشتركين المعتمدين بعد مراجعة التحويل المحلي من إدارة البوت.",
    "قيمة الاشتراك: 3000 ريال.",
    "تشمل الخدمة أهم القوانين اليمنية الأكثر استخدامًا في الواقع العملي:",
    "• قانون المرافعات والتنفيذ المدني.\n• قانون الأحوال الشخصية.\n• القانون المدني.\n• قانون الإجراءات الجزائية.\n• قانون الإثبات.\n• قانون العلاقة بين المؤجر والمستأجر.\n• قانون الجرائم والعقوبات.\n• القانون التجاري.\n• قانون الشركات التجارية.\n• قانون التحكيم.",
    "جميع القوانين مدمجة في ملف Word واحد بآخر التعديلات المتاحة، مع فهرس تفاعلي للانتقال إلى الموضوعات، والبحث داخل الملف، ونسخ النصوص بسهولة.",
    "بيانات التحويل المحلي:\n• إيداع إلى حساب كريمي: 3007145477\n• أو تحويل عبر محفظة جيب: 488281",
    "بعد التحويل، اضغط «إرسال طلب الاشتراك بعد التحويل» ليصل طلبك إلى المشرف للاعتماد اليدوي.",
  ].join("\n\n");
}

function searchText() {
  return [
    "🔎 محرك البحث القانوني الموحد:",
    "اختر نطاق البحث: المكتبة الرقمية، أو القواعد القضائية، أو التشريعات اليمنية.",
    "يمكنك أيضًا إرسال /search متبوعًا بالكلمة المراد البحث عنها داخل المكتبة الرقمية.",
    "مثال: /search التعويض أو /search عقد البيع",
  ].join("\n\n");
}

function helpText(override?: string) {
  return override?.trim() || [
    "❓ دليل الاستخدام والدعم:",
    "• /start - العودة للقائمة الرئيسية.",
    "• /browse - استعراض جميع الأقسام والتصنيفات.",
    "• /search - فتح البحث الموحد أو البحث المباشر في المكتبة الرقمية.",
    "• /support رسالتك - إرسال اقتراح أو طلب دعم إلى إدارة البوت.",
    "📩 لا تُنشر رسائل الدعم في المجموعات؛ تحفظ للمراجعة من إدارة البوت.",
  ].join("\n");
}

function aboutText(override?: string) {
  return override?.trim() || [
    "ℹ️ عن بوت الناصر القانوني",
    "منصة معرفية وتعليمية بإشراف أ. معين الناصر، تتيح للطلاب والباحثين الوصول المنظم إلى المراجع القانونية والفقهية، واستعراض التشريعات والقواعد القضائية، والاستفادة من نماذج الاختبارات الإلكترونية لمختلف المستويات والمواد.",
    "صُممت المنصة لتسهيل التعلم والمراجعة والوصول السريع إلى المصادر القانونية في مكان واحد.",
    "⚖️ هذا البوت مبادرة تعليمية مستقلة، ولا يمثل جهة حكومية أو جامعة رسمية.",
  ].join("\n\n");
}

function sourceText(source: LegalSource) {
  const metadata = source.collection === "legislation" || source.collection === "yemeni_laws"
    ? [
      `النوع: ${legislationDocumentTypeLabels[source.documentType]}`,
      ...(source.legislationYear ? [`السنة: ${source.legislationYear}`] : []),
      ...(source.issuingAuthority ? [`الجهة: ${source.issuingAuthority}`] : []),
    ]
    : [`التصنيف: ${categoryLabels[source.category]}`];
  return [
    displaySourceTitle(source),
    "",
    source.description,
    "",
    ...metadata,
  ].join("\n");
}

const MAX_DOCUMENT_BYTES = 45 * 1024 * 1024;
const TELEGRAM_USER_MESSAGES = {
  privateFilesOnly: "يتاح إرسال الملفات داخل المحادثة الخاصة مع البوت فقط.",
  fileUnavailable: "تعذر تجهيز هذا المصدر كملف للإرسال. جرّب ملفًا آخر من الفهرس.",
  filePreparing: "انتظر قليلًا، يجري تجهيز الملف المطلوب لإرساله إليك في هذه المحادثة الخاصة.",
  fileTooLarge: "تعذر إرسال الملف لأن حجمه أكبر من الحد الآمن للإرسال عبر البوت.",
  fileDownloadFailed: "تعذر تنزيل الملف من المصدر حاليًا. حاول مرة أخرى لاحقًا.",
  unknownRequest: "لم أفهم طلبك. استخدم الأزرار أو اكتب /help للمساعدة.",
  searchExpired: (scope: string) => `انتهت مهلة البحث. ابدأ بحثًا جديدًا داخل ${scope}.`,
  searchNoResults: (scope: string, query: string) => `لا توجد نتائج داخل ${scope} لعبارة «${query}». جرّب كلمة أخرى أو نطاق بحث مختلفًا.`,
  approximateSearchNote: "\nملاحظة: هذه نتائج قريبة اقترحها البحث لتجاوز اختلاف أو خطأ إملائي محتمل.",
} as const;

export class FileDeliveryError extends Error {
  constructor(public readonly code: "UNAVAILABLE" | "TOO_LARGE") {
    super(code);
  }
}

export function driveDownloadUrl(fileId: string) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

async function sourceDownloadUrl(source: LegalSource) {
  if (source.url.startsWith("/manus-storage/")) {
    const key = source.url.slice("/manus-storage/".length);
    if (!key) throw new FileDeliveryError("UNAVAILABLE");
    try {
      return await storageGetSignedUrl(key);
    } catch {
      throw new FileDeliveryError("UNAVAILABLE");
    }
  }
  if (!source.driveFileId) throw new FileDeliveryError("UNAVAILABLE");
  return driveDownloadUrl(source.driveFileId);
}

/** يمكن إرسال المصدر إن كان له معرّف Drive أو رابط تخزين البوت الداخلي. */
export function canDeliverDocumentSource(source: LegalSource | undefined): source is LegalSource;
export function canDeliverDocumentSource(source: Pick<LegalSource, "driveFileId" | "url"> | undefined): boolean;
export function canDeliverDocumentSource(source: Pick<LegalSource, "driveFileId" | "url"> | undefined): boolean {
  return Boolean(source && (source.driveFileId || source.url.startsWith("/manus-storage/")));
}

export function documentFilename(source: Pick<LegalSource, "title" | "url">, contentType: string): string {
  const title = source.title.trim().slice(0, 180) || "document";
  if (/\.[a-z0-9]{1,10}$/i.test(title)) return title;
  const storageExtension = source.url.match(/\.([a-z0-9]{1,10})(?:$|\?)/i)?.[1];
  const contentTypeExtension: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "text/plain": "txt",
  };
  const extension = storageExtension ?? contentTypeExtension[contentType.toLowerCase()];
  return extension ? `${title}.${extension}` : title;
}

export async function downloadDriveDocument(source: LegalSource): Promise<TelegramDocument> {
  const response = await fetch(await sourceDownloadUrl(source), { redirect: "follow" });
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
  if (!response.ok || contentType.includes("text/html")) throw new FileDeliveryError("UNAVAILABLE");
  if (contentLength > MAX_DOCUMENT_BYTES) throw new FileDeliveryError("TOO_LARGE");

  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength === 0) throw new FileDeliveryError("UNAVAILABLE");
  if (data.byteLength > MAX_DOCUMENT_BYTES) throw new FileDeliveryError("TOO_LARGE");
  return {
    filename: documentFilename(source, contentType),
    contentType,
    data,
    caption: sourceText(source).slice(0, 950),
  };
}

async function downloadManagedMenuItemDocument(item: TelegramManagedMenuItemRecord): Promise<TelegramDocument> {
  if (!item.actionValue.startsWith("/manus-storage/")) throw new FileDeliveryError("UNAVAILABLE");
  const key = item.actionValue.slice("/manus-storage/".length);
  if (!key) throw new FileDeliveryError("UNAVAILABLE");
  let signedUrl: string;
  try {
    signedUrl = await storageGetSignedUrl(key);
  } catch {
    throw new FileDeliveryError("UNAVAILABLE");
  }
  const response = await fetch(signedUrl, { redirect: "follow" });
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
  if (!response.ok || contentType.includes("text/html")) throw new FileDeliveryError("UNAVAILABLE");
  if (contentLength > MAX_DOCUMENT_BYTES) throw new FileDeliveryError("TOO_LARGE");
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength === 0) throw new FileDeliveryError("UNAVAILABLE");
  if (data.byteLength > MAX_DOCUMENT_BYTES) throw new FileDeliveryError("TOO_LARGE");
  return { filename: documentFilename({ title: item.label, url: item.actionValue }, contentType), contentType, data, caption: `مستورد من مكتبة أ. معين الناصر\n${item.label}` };
}

function isPrivateChat(chatType: string | undefined) {
  return chatType === undefined || chatType === "private";
}

async function deliverPrivateDocument(chatId: number, source: LegalSource | undefined, sender: TelegramSender, provider: TelegramDocumentProvider) {
  if (!canDeliverDocumentSource(source)) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.fileUnavailable);
    return;
  }
  await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.filePreparing);
  try {
    const downloaded = await provider.download(source);
    await sender.sendDocument(chatId, {
      ...downloaded,
      caption: `مستورد من مكتبة أ. معين الناصر\n${source.title}`,
    });
  } catch (error) {
    const code = error instanceof FileDeliveryError ? error.code : "UNAVAILABLE";
    const message = code === "TOO_LARGE"
      ? TELEGRAM_USER_MESSAGES.fileTooLarge
      : TELEGRAM_USER_MESSAGES.fileDownloadFailed;
    await sender.sendMessage(chatId, message);
  }
}

function searchResultText(query: string, sources: LegalSource[]) {
  if (sources.length === 0) {
    return `لم نعثر على مصادر مطابقة لعبارة «${query}». جرّب كلمة أخرى أو تصفح التصنيفات.`;
  }

  return `نتائج البحث عن «${query}»: اختر مصدرًا لعرض التفاصيل.`;
}

function normalizeCommand(text: string) {
  const [rawCommand, ...rest] = text.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().replace(/@[^\s]+$/, "");
  return { command, query: rest.join(" ").trim() };
}

function getTelegramUserId(update: TelegramUpdate, chatId: number) {
  return String(update.callback_query?.from?.id ?? update.message?.from?.id ?? chatId);
}

async function getAccessRequirementStatus(
  telegramUserId: string,
  store: Pick<TelegramLibraryStore, "hasConfirmedPlatformAccess">,
  membershipChecker: TelegramChannelMembershipChecker
): Promise<TelegramAccessRequirementStatus> {
  const channels = await Promise.all(REQUIRED_CHANNELS.map(async channel => ({
    channel,
    status: await membershipChecker.check(telegramUserId, channel.handle).catch(() => "unavailable" as const),
  })));
  const platformVerified = await store.hasConfirmedPlatformAccess(telegramUserId);
  return { channels, platformVerified };
}

function areChannelsSubscribed(requirements: TelegramAccessRequirementStatus) {
  return requirements.channels.every(({ status }) => status === "subscribed");
}

async function promptAccessRequirements(chatId: number, sender: TelegramSender, requirements: TelegramAccessRequirementStatus) {
  await sender.sendMessage(chatId, accessRequirementsText(requirements), channelSubscriptionMenu());
}

async function sendSourcesForCategory(
  chatId: number,
  category: LegalCategory,
  requestedPage: number,
  store: TelegramLibraryStore,
  sender: TelegramSender
) {
  const initial = await store.listSourcesByCategory(category, Math.max(1, requestedPage));
  const totalPages = Math.max(1, Math.ceil(initial.total / 8));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const { sources, total } = page === requestedPage ? initial : await store.listSourcesByCategory(category, page);
  if (sources.length === 0) {
    await sender.sendMessage(
      chatId,
      `لا توجد مصادر مضافة حاليًا ضمن تصنيف ${categoryLabels[category]}.`,
      categoryMenu()
    );
    return;
  }

  await sender.sendMessage(
    chatId,
    `مصادر تصنيف ${categoryLabels[category]} — الصفحة ${page} من ${totalPages} (${total} مصدرًا): اختر مصدرًا لإرساله داخل محادثتك الخاصة.`,
    sourceMenu(sources, category, page, totalPages)
  );
}

async function promptLibrarySearch(chatId: number, store: TelegramLibraryStore, sender: TelegramSender) {
  await store.beginLibrarySearch(String(chatId));
  await sender.sendMessage(
    chatId,
    "🔎 البحث في المكتبة الرقمية\n\nاكتب كلمة أو عبارة للبحث. سيقترح البوت نتائج قريبة عند وجود اختلاف إملائي محتمل.",
    { inline_keyboard: [[{ text: "رجوع إلى البحث الموحد", callback_data: "search" }], [{ text: "القائمة الرئيسة", callback_data: "menu" }]] }
  );
}

async function sendLibrarySearchResults(chatId: number, sessionId: number, requestedPage: number, store: TelegramLibraryStore, sender: TelegramSender) {
  const initial = await store.searchLibrarySources(sessionId, Math.max(1, requestedPage));
  if (!initial) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchExpired("المكتبة الرقمية"), unifiedSearchMenu());
    return;
  }
  if (initial.total === 0) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchNoResults("المكتبة الرقمية", initial.query), unifiedSearchMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.searchLibrarySources(sessionId, page);
  if (!content) return;
  const matchNote = content.matchType === "approximate" ? TELEGRAM_USER_MESSAGES.approximateSearchNote : "";
  await sender.sendMessage(
    chatId,
    `نتائج «${content.query}» داخل المكتبة الرقمية — الصفحة ${page} من ${totalPages} (${content.total} نتيجة):${matchNote}`,
    librarySearchMenu(content.sources, sessionId, page, totalPages)
  );
}

async function sendCuratedSources(chatId: number, title: string, sources: LegalSource[], backCallback: string, sender: TelegramSender) {
  const publicSources = sources.filter(source => source.collection !== "important_yemeni_laws");
  if (publicSources.length === 0) {
    await sender.sendMessage(chatId, `${title}\nلا توجد بيانات كافية بعد لعرض عناصر في هذا القسم.`, mainMenu());
    return;
  }
  await sender.sendMessage(chatId, `${title}\nاختر ملفًا لإرساله داخل محادثتك الخاصة.`, curatedSourceMenu(publicSources, backCallback));
}

async function sendLegislationType(chatId: number, documentType: keyof typeof legislationDocumentTypeLabels, requestedPage: number, store: TelegramLibraryStore, sender: TelegramSender) {
  const initial = await store.listLegislationSourcesByType(documentType, Math.max(1, requestedPage));
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.listLegislationSourcesByType(documentType, page);
  if (content.sources.length === 0) {
    await sender.sendMessage(chatId, `لا توجد ${legislationDocumentTypeLabels[documentType]} مصنفة حاليًا داخل التشريعات اليمنية.`, legislationTypeMenu());
    return;
  }
  await sender.sendMessage(
    chatId,
    `${legislationDocumentTypeLabels[documentType]} داخل التشريعات اليمنية — الصفحة ${page} من ${totalPages} (${content.total} ملفًا):`,
    legislationTypeSourceMenu(content.sources, documentType, page, totalPages)
  );
}

async function sendLegislationYear(chatId: number, year: number, requestedPage: number, store: TelegramLibraryStore, sender: TelegramSender) {
  const initial = await store.listLegislationSourcesByYear(year, Math.max(1, requestedPage));
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.listLegislationSourcesByYear(year, page);
  if (content.sources.length === 0) {
    await sender.sendMessage(chatId, `لا توجد تشريعات تحمل سنة الإصدار ${year} ضمن البيانات الوصفية المتاحة.`, legislationFilterMenu());
    return;
  }
  await sender.sendMessage(
    chatId,
    `تشريعات سنة ${year} — الصفحة ${page} من ${totalPages} (${content.total} ملفًا):`,
    legislationYearSourceMenu(content.sources, year, page, totalPages)
  );
}

async function promptSupport(chatId: number, sender: TelegramSender) {
  await sender.sendMessage(
    chatId,
    "💬 الدعم والمقترحات\n\nلإرسال طلب، اكتب: /support ثم رسالتك.\nمثال: /support أرجو إضافة قانون جديد إلى المكتبة.\n\nسيُحفظ الطلب للمراجعة من إدارة البوت، ولا يُنشر في المجموعات.",
    supportMenu()
  );
}

function ownerStatisticsText(stats: { totalEvents: number; totalSupportRequests: number; topQueries: Array<{ query: string; count: number }> }) {
  const queries = stats.topQueries.length > 0
    ? stats.topQueries.map((item, index) => `${index + 1}. ${item.query} (${item.count})`).join("\n")
    : "لا توجد عمليات بحث مسجلة بعد.";
  return [
    "📊 إحصاءات المالك",
    `إجمالي أحداث الاستخدام: ${stats.totalEvents}`,
    `طلبات الدعم الجديدة: ${stats.totalSupportRequests}`,
    "أكثر عبارات البحث:",
    queries,
  ].join("\n");
}

export function isTelegramOwner(telegramUserId: string, ownerTelegramId = process.env.TELEGRAM_OWNER_ID) {
  return Boolean(ownerTelegramId) && telegramUserId === ownerTelegramId;
}

function supportRequestsText(requests: Array<{ id: number; message: string; createdAt: Date }>) {
  if (requests.length === 0) return "📥 طلبات الدعم الجديدة\n\nلا توجد طلبات جديدة حاليًا.";
  return [
    "📥 طلبات الدعم الجديدة",
    ...requests.map(request => `#${request.id} — ${request.message}`),
  ].join("\n\n");
}

function isPrivateOwnerConversation(telegramUserId: string, chatType: string | undefined) {
  return isPrivateChat(chatType) && isTelegramOwner(telegramUserId);
}

function broadcastPreviewText(draft: TelegramBroadcastDraft) {
  const content = draft.kind === "message"
    ? `الرسالة:\n${draft.message ?? ""}`
    : `الملف: ${draft.fileName ?? "ملف دون اسم"}${draft.caption ? `\nالوصف: ${draft.caption}` : ""}`;
  return [
    "📣 معاينة البث الجماعي",
    content,
    `المستلمون المسجلون حاليًا: ${draft.recipientCount}`,
    "لن يُرسل شيء قبل الضغط على «تأكيد الإرسال».",
  ].join("\n\n");
}

function broadcastConfirmationMenu(broadcastId: number): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "تأكيد الإرسال", callback_data: `broadcast:confirm:${broadcastId}` }],
      [{ text: "إلغاء المسودة", callback_data: `broadcast:cancel:${broadcastId}` }],
    ],
  };
}

async function sendBroadcastPreview(chatId: number, draft: TelegramBroadcastDraft, sender: TelegramSender) {
  await sender.sendMessage(chatId, broadcastPreviewText(draft), broadcastConfirmationMenu(draft.id));
}

async function sendJudicialFolder(
  chatId: number,
  folderId: string,
  requestedPage: number,
  store: TelegramLibraryStore,
  sender: TelegramSender
) {
  const initial = await store.getJudicialFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "تعذر العثور على هذا المجلد في الفهرس القضائي.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getJudicialFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  const path = folder.path.replace(/^قواعد قضائية\s*\/\s*/, "");
  const pathText = path ? `المسار: قواعد قضائية / ${path}` : "المسار: قواعد قضائية";
  const fileText = content.totalSources > 0 ? `الملفات: الصفحة ${page} من ${totalPages} (${content.totalSources} ملفًا).` : "لا توجد ملفات مباشرة في هذا المجلد.";

  await sender.sendMessage(
    chatId,
    [`قواعد قضائية — ${folder.name}`, pathText, `المجلدات الفرعية: ${content.folders.length}.`, fileText, "اختر مجلدًا أو ملفًا:"].join("\n"),
    judicialFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}

async function promptJudicialSearch(chatId: number, store: TelegramLibraryStore, sender: TelegramSender) {
  await store.beginJudicialSearch(String(chatId));
  await sender.sendMessage(
    chatId,
    "⚡ البحث السريع في القواعد القضائية\n\nاكتب كلمة أو عبارة للبحث فورًا. مثال: أحكام مدنية أو تجاري 2008. ويمكنك أيضًا استخدام /qj متبوعًا بعبارة البحث.",
    { inline_keyboard: [[{ text: "مدني", callback_data: "jq:مدني" }, { text: "تجاري", callback_data: "jq:تجاري" }], [{ text: "رجوع إلى قواعد قضائية", callback_data: "judicial" }], [{ text: "القائمة الرئيسة", callback_data: "menu" }]] }
  );
}

async function runQuickJudicialSearch(chatId: number, telegramUserId: string, query: string, store: TelegramLibraryStore, sender: TelegramSender) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    await promptJudicialSearch(chatId, store, sender);
    return;
  }
  await store.beginJudicialSearch(String(chatId));
  const session = await store.consumeJudicialSearchQuery(String(chatId), normalizedQuery);
  if (!session) {
    await sender.sendMessage(chatId, "تعذر بدء البحث السريع الآن. حاول مرة أخرى بعد قليل.");
    return;
  }
  await store.recordUsage(telegramUserId, "search", { query: normalizedQuery });
  await sendJudicialSearchResults(chatId, session.id, 1, store, sender);
}

async function sendJudicialSearchResults(chatId: number, sessionId: number, requestedPage: number, store: TelegramLibraryStore, sender: TelegramSender) {
  const initial = await store.searchJudicialSources(sessionId, Math.max(1, requestedPage));
  if (!initial) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchExpired("القواعد القضائية"), { inline_keyboard: [[{ text: "قواعد قضائية", callback_data: "judicial" }]] });
    return;
  }
  if (initial.total === 0) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchNoResults("قواعد قضائية", initial.query), { inline_keyboard: [[{ text: "بحث جديد", callback_data: "jsearch" }], [{ text: "رجوع إلى قواعد قضائية", callback_data: "judicial" }]] });
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.searchJudicialSources(sessionId, page);
  if (!content) return;
  const matchNote = content.matchType === "approximate" ? TELEGRAM_USER_MESSAGES.approximateSearchNote : "";
  await sender.sendMessage(
    chatId,
    `نتائج «${content.query}» داخل قواعد قضائية — الصفحة ${page} من ${totalPages} (${content.total} نتيجة):${matchNote}`,
    judicialSearchMenu(content.sources, sessionId, page, totalPages, content.query)
  );
}

async function sendLegislationFolder(
  chatId: number,
  folderId: string,
  requestedPage: number,
  store: TelegramLibraryStore,
  sender: TelegramSender
) {
  const initial = await store.getLegislationFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "تعذر العثور على هذا المجلد في فهرس التشريعات اليمنية.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getLegislationFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  const path = folder.path.replace(/^التشريعات اليمنية\s*\/\s*/, "");
  const pathText = path ? `المسار: التشريعات اليمنية / ${path}` : "المسار: التشريعات اليمنية";
  const fileText = content.totalSources > 0 ? `الملفات: الصفحة ${page} من ${totalPages} (${content.totalSources} ملفًا).` : "لا توجد ملفات مباشرة في هذا المجلد.";

  await sender.sendMessage(
    chatId,
    [`التشريعات اليمنية — ${folder.name}`, pathText, `المجلدات الفرعية: ${content.folders.length}.`, fileText, "اختر مجلدًا أو ملفًا:"].join("\n"),
    legislationFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}

async function sendYemeniLawsFolder(
  chatId: number,
  folderId: string,
  requestedPage: number,
  store: TelegramLibraryStore,
  sender: TelegramSender
) {
  const initial = await store.getYemeniLawsFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "تعذر العثور على هذا المجلد في فهرس القوانين اليمنية.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getYemeniLawsFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  const path = folder.path.replace(/^القوانين اليمنية فهرس تفاعلي\s*\/\s*/, "");
  const pathText = path ? `المسار: القوانين اليمنية / ${path}` : "المسار: القوانين اليمنية";
  const fileText = content.totalSources > 0 ? `الملفات: الصفحة ${page} من ${totalPages} (${content.totalSources} ملفًا).` : "لا توجد ملفات مباشرة في هذا المجلد.";

  await sender.sendMessage(
    chatId,
    [`القوانين اليمنية فهرس تفاعلي — ${folder.name}`, pathText, `المجلدات الفرعية: ${content.folders.length}.`, fileText, "اختر مجلدًا أو ملفًا:"].join("\n"),
    yemeniLawsFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}

async function sendLegalFormsFolder(
  chatId: number,
  folderId: string,
  requestedPage: number,
  store: TelegramLibraryStore,
  sender: TelegramSender
) {
  const initial = await store.getLegalFormsFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "تعذر العثور على هذا المجلد في فهرس النماذج والصيغ القانونية.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getLegalFormsFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  const path = folder.path.replace(/^نماذج وصيغ قانونية\s*\/\s*/, "");
  const pathText = path ? `المسار: نماذج وصيغ قانونية / ${cleanLegalFormsDisplayName(path)}` : "المسار: نماذج وصيغ قانونية";
  const fileText = content.totalSources > 0 ? `الملفات: الصفحة ${page} من ${totalPages} (${content.totalSources} ملفًا).` : "لا توجد ملفات مباشرة في هذا المجلد.";

  await sender.sendMessage(
    chatId,
    [`نماذج وصيغ قانونية — ${cleanLegalFormsDisplayName(folder.name)}`, pathText, `المجلدات الفرعية: ${content.folders.length}.`, fileText, "اختر مجلدًا أو ملفًا:"].join("\n"),
    legalFormsFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}

async function sendIllustratedLegalFormsFolder(
  chatId: number,
  folderId: string,
  requestedPage: number,
  store: TelegramLibraryStore,
  sender: TelegramSender
) {
  const initial = await store.getIllustratedLegalFormsFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "تعذر العثور على هذا القسم في فهرس النماذج المصورة وفق القوانين اليمنية.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getIllustratedLegalFormsFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  const path = folder.path.replace(/^نماذج مصورة وفق القوانين اليمنية\s*\/\s*/, "");
  const pathText = path ? `المسار: نماذج مصورة / ${cleanGenericFileDisplayName(path)}` : "المسار: نماذج مصورة";
  const fileText = content.totalSources > 0 ? `الصفحة ${page} من ${totalPages} (${content.totalSources} عنصرًا).` : "لا توجد عناصر مباشرة هنا.";
  await sender.sendMessage(
    chatId,
    [`نماذج مصورة وفق القوانين اليمنية — ${cleanGenericFileDisplayName(folder.name)}`, pathText, fileText, "اختر الاسم المطلوب:"].join("\n"),
    illustratedLegalFormsFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}

async function sendAllYemeniLawsFolder(
  chatId: number,
  folderId: string,
  requestedPage: number,
  store: TelegramLibraryStore,
  sender: TelegramSender
) {
  const initial = await store.getAllYemeniLawsFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "تعذر العثور على هذا القسم في فهرس جميع القوانين اليمنية.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getAllYemeniLawsFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  const fileText = content.totalSources > 0 ? `الصفحة ${page} من ${totalPages} (${content.totalSources} قانونًا أو لائحة).` : "لا توجد عناصر مباشرة هنا.";
  await sender.sendMessage(
    chatId,
    [`جميع القوانين اليمنية — ${cleanGenericFileDisplayName(folder.name)}`, fileText, "اختر الاسم المطلوب:"].join("\n"),
    allYemeniLawsFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}

async function sendFeaturedReferencesFolder(
  chatId: number,
  folderId: string,
  requestedPage: number,
  store: TelegramLibraryStore,
  sender: TelegramSender
) {
  const initial = await store.getFeaturedReferencesFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "تعذر العثور على هذا المجلد في فهرس المراجع المميزة.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getFeaturedReferencesFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  const path = folder.path.replace(/^مراجع مميزة\s*\/\s*/, "");
  const pathText = path ? `المسار: مراجع مميزة / ${cleanFeaturedReferencesDisplayName(path)}` : "المسار: مراجع مميزة";
  const fileText = content.totalSources > 0 ? `الملفات: الصفحة ${page} من ${totalPages} (${content.totalSources} ملفًا).` : "لا توجد ملفات مباشرة في هذا المجلد.";

  await sender.sendMessage(
    chatId,
    [`مراجع مميزة — ${cleanFeaturedReferencesDisplayName(folder.name)}`, pathText, `المجلدات الفرعية: ${content.folders.length}.`, fileText, "اختر مجلدًا أو ملفًا:"].join("\n"),
    featuredReferencesFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}

async function sendImportantYemeniLawsFolder(
  chatId: number,
  folderId: string,
  requestedPage: number,
  store: TelegramLibraryStore,
  sender: TelegramSender
) {
  const initial = await store.getImportantYemeniLawsFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "تعذر العثور على قسم أهم القوانين اليمنية التفاعلي.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getImportantYemeniLawsFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  const fileText = content.totalSources > 0 ? `الملفات: الصفحة ${page} من ${totalPages} (${content.totalSources} ملفًا).` : "لا توجد ملفات مباشرة في هذا القسم.";

  await sender.sendMessage(
    chatId,
    [`أهم القوانين اليمنية التفاعلي — ${folder.name}`, `المجلدات الفرعية: ${content.folders.length}.`, fileText, "اختر ملفًا لإرساله داخل محادثتك الخاصة."].join("\n"),
    importantYemeniLawsFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}

async function promptLegislationSearch(chatId: number, store: TelegramLibraryStore, sender: TelegramSender) {
  await store.beginLegislationSearch(String(chatId));
  await sender.sendMessage(
    chatId,
    "⚡ البحث السريع في التشريعات اليمنية\n\nاكتب كلمة أو عبارة للبحث فورًا. مثال: تحكيم أو تأمينات اجتماعية. ويمكنك أيضًا استخدام /ql متبوعًا بعبارة البحث.",
    { inline_keyboard: [[{ text: "تحكيم", callback_data: "lq:تحكيم" }, { text: "مرافعات", callback_data: "lq:مرافعات" }], [{ text: "رجوع إلى التشريعات اليمنية", callback_data: "legislation" }], [{ text: "القائمة الرئيسة", callback_data: "menu" }]] }
  );
}

async function runQuickLegislationSearch(chatId: number, telegramUserId: string, query: string, store: TelegramLibraryStore, sender: TelegramSender) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    await promptLegislationSearch(chatId, store, sender);
    return;
  }
  await store.beginLegislationSearch(String(chatId));
  const session = await store.consumeLegislationSearchQuery(String(chatId), normalizedQuery);
  if (!session) {
    await sender.sendMessage(chatId, "تعذر بدء البحث السريع الآن. حاول مرة أخرى بعد قليل.");
    return;
  }
  await store.recordUsage(telegramUserId, "search", { query: normalizedQuery });
  await sendLegislationSearchResults(chatId, session.id, 1, store, sender);
}

async function sendLegislationSearchResults(chatId: number, sessionId: number, requestedPage: number, store: TelegramLibraryStore, sender: TelegramSender) {
  const initial = await store.searchLegislationSources(sessionId, Math.max(1, requestedPage));
  if (!initial) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchExpired("التشريعات اليمنية"), { inline_keyboard: [[{ text: "التشريعات اليمنية", callback_data: "legislation" }]] });
    return;
  }
  if (initial.total === 0) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchNoResults("التشريعات اليمنية", initial.query), { inline_keyboard: [[{ text: "بحث جديد", callback_data: "lsearch" }], [{ text: "رجوع إلى التشريعات اليمنية", callback_data: "legislation" }]] });
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.searchLegislationSources(sessionId, page);
  if (!content) return;
  const matchNote = content.matchType === "approximate" ? TELEGRAM_USER_MESSAGES.approximateSearchNote : "";
  await sender.sendMessage(
    chatId,
    `نتائج «${content.query}» داخل التشريعات اليمنية — الصفحة ${page} من ${totalPages} (${content.total} نتيجة):${matchNote}`,
    legislationSearchMenu(content.sources, sessionId, page, totalPages, content.query)
  );
}

async function promptAllYemeniLawsSearch(chatId: number, store: TelegramLibraryStore, sender: TelegramSender) {
  await store.beginAllYemeniLawsSearch(String(chatId));
  await sender.sendMessage(
    chatId,
    "⚡ البحث السريع في جميع القوانين اليمنية\n\nاكتب كلمة أو عبارة للبحث فورًا. مثال: مرافعات أو أحوال شخصية أو تجاري. ويمكنك أيضًا استخدام /qyl متبوعًا بعبارة البحث.",
    { inline_keyboard: [[{ text: "مرافعات", callback_data: "ayq:مرافعات" }, { text: "أحوال شخصية", callback_data: "ayq:أحوال شخصية" }], [{ text: "تجاري", callback_data: "ayq:تجاري" }, { text: "جزائية", callback_data: "ayq:جزائية" }], [{ text: "رجوع إلى جميع القوانين اليمنية", callback_data: "all-yemeni-laws" }], [{ text: "القائمة الرئيسة", callback_data: "menu" }]] }
  );
}

async function runQuickAllYemeniLawsSearch(chatId: number, telegramUserId: string, query: string, store: TelegramLibraryStore, sender: TelegramSender) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    await promptAllYemeniLawsSearch(chatId, store, sender);
    return;
  }
  await store.beginAllYemeniLawsSearch(String(chatId));
  const session = await store.consumeAllYemeniLawsSearchQuery(String(chatId), normalizedQuery);
  if (!session) {
    await sender.sendMessage(chatId, "تعذر بدء البحث السريع الآن. حاول مرة أخرى بعد قليل.");
    return;
  }
  await store.recordUsage(telegramUserId, "search", { query: normalizedQuery });
  await sendAllYemeniLawsSearchResults(chatId, session.id, 1, store, sender);
}

async function sendAllYemeniLawsSearchResults(chatId: number, sessionId: number, requestedPage: number, store: TelegramLibraryStore, sender: TelegramSender) {
  const initial = await store.searchAllYemeniLawsSources(sessionId, Math.max(1, requestedPage));
  if (!initial) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchExpired("جميع القوانين اليمنية"), { inline_keyboard: [[{ text: "جميع القوانين اليمنية", callback_data: "all-yemeni-laws" }]] });
    return;
  }
  if (initial.total === 0) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchNoResults("جميع القوانين اليمنية", initial.query), { inline_keyboard: [[{ text: "بحث جديد", callback_data: "aysearch" }], [{ text: "رجوع إلى جميع القوانين اليمنية", callback_data: "all-yemeni-laws" }]] });
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.searchAllYemeniLawsSources(sessionId, page);
  if (!content) return;
  const matchNote = content.matchType === "approximate" ? TELEGRAM_USER_MESSAGES.approximateSearchNote : "";
  await sender.sendMessage(
    chatId,
    `نتائج «${content.query}» داخل جميع القوانين اليمنية — الصفحة ${page} من ${totalPages} (${content.total} نتيجة):${matchNote}`,
    allYemeniLawsSearchMenu(content.sources, sessionId, page, totalPages, content.query)
  );
}

const nativeExamTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const groupExamTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function clearNativeExamTimeout(pollId: string) {
  const timeout = nativeExamTimeouts.get(pollId);
  if (timeout) clearTimeout(timeout);
  nativeExamTimeouts.delete(pollId);
}

function clearGroupExamTimeout(pollId: string) {
  const timeout = groupExamTimeouts.get(pollId);
  if (timeout) clearTimeout(timeout);
  groupExamTimeouts.delete(pollId);
}

async function launchGroupExamQuestion(chatId: number, roundId: number, store: TelegramLibraryStore, sender: TelegramSender): Promise<void> {
  const round = await store.getGroupExamRound(roundId);
  if (!round || round.status !== "active") return;
  const questions = await store.listExamQuestions(round.subjectKey, round.sectionKey);
  const question = questions[round.questionIndex];
  if (!question) return;
  const openPeriodSeconds = [15, 30, 60, 300].includes(round.timeLimitSeconds)
    ? round.timeLimitSeconds as 15 | 30 | 60 | 300
    : 30;
  const poll = await sender.sendQuizPoll(chatId, {
    question: `[${round.questionIndex + 1}/${questions.length}] ${question.questionText}`,
    options: [question.optionA, question.optionB, question.optionC, question.optionD],
    correctOptionIndex: question.correctOption === "A" ? 0 : question.correctOption === "B" ? 1 : question.correctOption === "C" ? 2 : 3,
    explanation: isSecondaryExamSubjectKey(round.subjectKey) ? "" : "تظهر الإجابة الصحيحة والشرح وملخص المجموعة بعد انتهاء الوقت.",
    openPeriodSeconds,
  });
  if (!(await store.setGroupExamActivePoll({ roundId, questionIndex: round.questionIndex, pollId: poll.pollId }))) return;
  clearGroupExamTimeout(poll.pollId);
  const timeout = setTimeout(() => {
    void resolveGroupExamTimeout(poll.pollId, store, sender);
  }, (openPeriodSeconds + 1) * 1000);
  timeout.unref?.();
  groupExamTimeouts.set(poll.pollId, timeout);
}

async function resolveGroupExamTimeout(pollId: string, store: TelegramLibraryStore, sender: TelegramSender): Promise<void> {
  clearGroupExamTimeout(pollId);
  const round = await store.getGroupExamRoundByPoll(pollId);
  if (!round) return;
  const outcome = await store.resolveGroupExamPoll(pollId);
  if (outcome) await continueGroupExamRound(round, outcome, store, sender);
}

async function continueGroupExamRound(round: TelegramGroupExamRoundRecord, outcome: TelegramGroupExamPollResolution, store: TelegramLibraryStore, sender: TelegramSender): Promise<void> {
  const chatId = Number(round.chatId);
  if (!Number.isSafeInteger(chatId)) return;
  if (!isSecondaryExamSubjectKey(round.subjectKey)) {
    const resultLines = [
      `📊 نتائج السؤال ${outcome.nextQuestionIndex} من ${outcome.total}:`,
      `✅ صحيحة: ${outcome.correctCount}`,
      `❌ خاطئة: ${outcome.incorrectCount}`,
      `⌛️ فائتة: ${outcome.missedCount}`,
    ];
    if (outcome.incorrectCount > 0 && outcome.question.hint?.trim()) {
      resultLines.push("", "💡 التلميح:", outcome.question.hint);
    }
    resultLines.push("", `الإجابة الصحيحة: ${optionLabel(outcome.question.correctOption)}. ${optionText(outcome.question, outcome.question.correctOption)}`);
    resultLines.push("", "📖 الشرح المفصل:", outcome.question.explanation);
    await sender.sendMessage(chatId, resultLines.join("\n"));
  }
  if (!outcome.completed) {
    await launchGroupExamQuestion(chatId, round.id, store, sender);
    return;
  }
  const leaderboard = await store.getGroupExamLeaderboard(round.id);
  const lines = [
    `🏁 انتهت الجولة الجماعية — ${CIVIL_LAW_GENERAL_2025_TITLE}`,
    "",
    `شارك في الجولة ${outcome.participantCount} أعضاء.`,
    "",
    "🏆 لوحة المتصدرين:",
  ];
  leaderboard.slice(0, 10).forEach((participant, index) => {
    lines.push(`${index + 1}. ${participant.displayName} — ✅ ${participant.score} | ❌ ${participant.incorrectCount} | ⌛️ ${participant.missedCount}`);
  });
  lines.push("", "يمكن بدء جولة جديدة عندما يكتب ثلاثة أعضاء على الأقل /startquiz.");
  await sender.sendMessage(chatId, lines.join("\n"));
}

async function launchNativeExamQuestion(
  chatId: number,
  sessionId: number,
  telegramUserId: string,
  store: TelegramLibraryStore,
  sender: TelegramSender
): Promise<void> {
  await sendExamQuestion(chatId, sessionId, telegramUserId, store, sender);
  const session = await store.getExamSession(sessionId, telegramUserId);
  if (!session?.activePollId || session.status !== "active") return;
  clearNativeExamTimeout(session.activePollId);
  const timeout = setTimeout(() => {
    void resolveNativeExamTimeout(session.activePollId!, store, sender);
  }, (session.timeLimitSeconds + 1) * 1000);
  timeout.unref?.();
  nativeExamTimeouts.set(session.activePollId, timeout);
}

async function sendStoppedExamMessage(
  chatId: number,
  stopped: { subjectKey: string; sectionKey: string } | undefined,
  store: TelegramLibraryStore,
  sender: TelegramSender
): Promise<void> {
  if (!stopped) {
    await sender.sendMessage(chatId, "لا توجد جولة اختبار نشطة لإيقافها.", civilLawExamMenu());
    return;
  }
  const location = getImportedExamCatalogLocation(stopped.subjectKey);
  const subject = location ? getTelegramExamCatalogSubject(location.levelKey, location.catalogSubjectKey) : undefined;
  if (!location || !subject) {
    await sender.sendMessage(chatId, "⏸ تم إيقاف الاختبار مؤقتًا. يمكنك بدء جولة جديدة متى شئت.", civilLawExamMenu());
    return;
  }
  const forms = await store.listExamForms(stopped.subjectKey);
  const formName = forms.find(form => form.formKey === stopped.sectionKey)?.formName ?? "النموذج";
  await sender.sendMessage(
    chatId,
    `⏸ تم إيقاف اختبار ${subject.name} — ${formName} مؤقتًا. يمكنك اختيار نموذج آخر أو بدء جولة جديدة متى شئت.`,
    examFormsMenu(location.levelKey, location.catalogSubjectKey, forms)
  );
}

async function resolveNativeExamTimeout(pollId: string, store: TelegramLibraryStore, sender: TelegramSender): Promise<void> {
  clearNativeExamTimeout(pollId);
  const session = await store.getExamSessionByPoll(pollId);
  if (!session) return;
  const outcome = await store.resolveExamPoll({
    sessionId: session.id,
    telegramUserId: session.telegramUserId,
    questionIndex: session.questionIndex,
    pollId,
  });
  if (outcome) await continueNativeExamRound(session, outcome, store, sender);
}

async function sendNativeExamCompletionResult(
  chatId: number,
  session: TelegramExamSessionRecord,
  result: { score: number; incorrectCount: number; missedCount: number; elapsedSeconds: number },
  store: TelegramLibraryStore,
  sender: TelegramSender
): Promise<void> {
  const summary = await store.getExamResultSummary(session.id, session.telegramUserId);
  const location = getImportedExamCatalogLocation(session.subjectKey);
  const subject = location ? getTelegramExamCatalogSubject(location.levelKey, location.catalogSubjectKey) : undefined;
  const formName = subject
    ? (await store.listExamForms(session.subjectKey)).find(form => form.formKey === session.sectionKey)?.formName
    : undefined;
  const examTitle = subject
    ? `اختبار ${subject.name} (${formName ?? "النموذج"})`
    : CIVIL_LAW_GENERAL_2025_TITLE;
  const resultLines = [
    `🎲 اسم الاختبار: ${examTitle}`,
    "",
    "📝 نتيجة هذه المحاولة:",
    `✅ الصحيحة: ${result.score} | ❌ الخاطئة: ${result.incorrectCount} | ⏳ الفائتة: ${result.missedCount} | ⏱ الوقت: ${formatExamTime(result.elapsedSeconds)}`,
  ];
  const best = summary?.previousBest ?? result;
  resultLines.push(
    "",
    "🏅 أفضل نتيجة:",
    `✅ الصحيحة: ${best.score} | ❌ الخاطئة: ${best.incorrectCount} | ⏳ الفائتة: ${best.missedCount} | ⏱ الوقت: ${formatExamTime(best.elapsedSeconds)}`
  );
  const leaderboard = summary?.leaderboardResult ?? result;
  resultLines.push(
    "",
    "🏆 نتيجة لائحة المتصدرين:",
    `✅ الصحيحة: ${leaderboard.score} | ❌ الخاطئة: ${leaderboard.incorrectCount} | ⏳ الفائتة: ${leaderboard.missedCount} | ⏱ الوقت: ${formatExamTime(leaderboard.elapsedSeconds)}`
  );
  if (summary) {
    resultLines.push(
      "",
      `📊 الترتيب: المركز ${summary.rank} من أصل ${summary.totalParticipants} (أعلى من ${summary.percentile}% من المشاركين).`
    );
  }
  resultLines.push("", "يمكنك إعادة الاختبار، لكن لن يتغير ترتيبك في لائحة المتصدرين إلا إذا حسّنت أفضل نتيجة لك.");
  await sender.sendMessage(chatId, resultLines.join("\n"), individualExamResultMenu());
}

async function continueNativeExamRound(
  session: TelegramExamSessionRecord,
  outcome: TelegramExamPollResolution,
  store: TelegramLibraryStore,
  sender: TelegramSender
): Promise<void> {
  const chatId = Number(session.chatId);
  if (!Number.isSafeInteger(chatId)) return;
  const answerStatus = outcome.missed ? "⌛️ انتهى الوقت دون إجابة." : outcome.isCorrect ? "✅ إجابتك صحيحة." : "❌ إجابتك غير صحيحة.";
  if (isSecondaryExamSubjectKey(session.subjectKey)) {
    if (!outcome.completed) {
      await launchNativeExamQuestion(chatId, session.id, session.telegramUserId, store, sender);
      return;
    }
    await sendNativeExamCompletionResult(chatId, session, outcome, store, sender);
    return;
  }
  const feedbackLines = [] as string[];
  if (!isSecondaryExamSubjectKey(session.subjectKey) && !outcome.missed && !outcome.isCorrect && outcome.question.hint?.trim()) {
    feedbackLines.push("💡 التلميح:", outcome.question.hint, "");
  }
  feedbackLines.push(answerStatus, `الإجابة الصحيحة: ${optionLabel(outcome.question.correctOption)}. ${optionText(outcome.question, outcome.question.correctOption)}`);
  if (!isSecondaryExamSubjectKey(session.subjectKey)) {
    feedbackLines.push("", "📖 الشرح المفصل:", outcome.question.explanation);
  }
  await sender.sendMessage(chatId, feedbackLines.join("\n"));
  if (!outcome.completed) {
    await launchNativeExamQuestion(chatId, session.id, session.telegramUserId, store, sender);
    return;
  }
  await sendNativeExamCompletionResult(chatId, session, outcome, store, sender);
}

export async function handleTelegramUpdate(
  update: TelegramUpdate,
  store: TelegramLibraryStore,
  sender: TelegramSender,
  documentProvider: TelegramDocumentProvider = { download: downloadDriveDocument },
  membershipChecker: TelegramChannelMembershipChecker = { check: async () => "subscribed" }
) {
  const pollAnswer = update.poll_answer;
  if (pollAnswer?.poll_id && pollAnswer.user?.id) {
    const choice = pollAnswer.option_ids?.[0];
    const answer = choice === 0 ? "A" : choice === 1 ? "B" : choice === 2 ? "C" : choice === 3 ? "D" : undefined;
    if (!answer) return;
    const groupRound = await store.getGroupExamRoundByPoll(pollAnswer.poll_id);
    if (groupRound) {
      await store.recordGroupExamAnswer({ pollId: pollAnswer.poll_id, telegramUserId: String(pollAnswer.user.id), answer });
      return;
    }
    clearNativeExamTimeout(pollAnswer.poll_id);
    const session = await store.getExamSessionByPoll(pollAnswer.poll_id);
    if (!session || session.telegramUserId !== String(pollAnswer.user.id)) return;
    const outcome = await store.resolveExamPoll({
      sessionId: session.id,
      telegramUserId: session.telegramUserId,
      questionIndex: session.questionIndex,
      pollId: pollAnswer.poll_id,
      answer,
    });
    if (outcome) await continueNativeExamRound(session, outcome, store, sender);
    return;
  }

  const closedPoll = update.poll;
  if (closedPoll?.id && closedPoll.is_closed) {
    clearNativeExamTimeout(closedPoll.id);
    clearGroupExamTimeout(closedPoll.id);
    const groupRound = await store.getGroupExamRoundByPoll(closedPoll.id);
    if (groupRound) {
      const outcome = await store.resolveGroupExamPoll(closedPoll.id);
      if (outcome) await continueGroupExamRound(groupRound, outcome, store, sender);
      return;
    }
    const session = await store.getExamSessionByPoll(closedPoll.id);
    if (!session) return;
    const outcome = await store.resolveExamPoll({
      sessionId: session.id,
      telegramUserId: session.telegramUserId,
      questionIndex: session.questionIndex,
      pollId: closedPoll.id,
    });
    if (outcome) await continueNativeExamRound(session, outcome, store, sender);
    return;
  }

  const [managedMenuItems, managedSections, managedMessages] = await Promise.all([
    store.listManagedMenuItems?.() ?? [],
    store.listManagedSections?.() ?? [],
    store.listManagedMessages?.() ?? [],
  ]);
  const messageContent = (messageKey: TelegramManagedMessageRecord["messageKey"]) => managedMessages.find(message => message.messageKey === messageKey)?.content;
  const subscriptionRequestLabel = (accessScope: TelegramSubscriptionAccessScope, managedMenuItemId?: number | null) => managedMenuItemId
    ? managedMenuItems.find(item => item.id === managedMenuItemId)?.label || "الزر المخصص"
    : subscriptionScopeLabel(accessScope);
  const sendManagedMenuItemContent = async (chatId: number, item: TelegramManagedMenuItemRecord) => {
    if (item.actionType === "url") {
      await sender.sendMessage(chatId, `🔗 ${item.label}\n\nاضغط الزر التالي لفتح المحتوى.`, {
        inline_keyboard: [[{ text: `فتح ${item.label}`, url: item.actionValue }], ...mainMenu(managedMenuItems, managedSections).inline_keyboard],
      });
      return;
    }
    if (item.actionType === "file") {
      await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.filePreparing);
      try {
        await sender.sendDocument(chatId, await downloadManagedMenuItemDocument(item));
      } catch (error) {
        const code = error instanceof FileDeliveryError ? error.code : "UNAVAILABLE";
        await sender.sendMessage(chatId, code === "TOO_LARGE" ? TELEGRAM_USER_MESSAGES.fileTooLarge : TELEGRAM_USER_MESSAGES.fileDownloadFailed);
      }
      return;
    }
    await sender.sendMessage(chatId, item.actionValue, mainMenu(managedMenuItems, managedSections));
  };

  const callback = update.callback_query;
  if (callback) {
    const chat = callback.message?.chat;
    const chatId = chat?.id;
    if (!chatId) return;

    const data = callback.data ?? "";
    const telegramUserId = getTelegramUserId(update, chatId);
    let callbackAcknowledged = false;
    const acknowledgeCallback = async (text?: string) => {
      if (callbackAcknowledged) return;
      callbackAcknowledged = true;
      await sender.answerCallbackQuery(callback.id, text).catch(() => undefined);
    };
    await acknowledgeCallback();
    if (isPrivateChat(chat?.type)) {
      await store.registerSubscriber(String(chatId), telegramUserId, {
        telegramUsername: callback.from?.username ?? null,
        telegramFirstName: callback.from?.first_name ?? null,
        telegramLastName: callback.from?.last_name ?? null,
      });
    }
    const isExamAccessCallback = isReferralProtectedCallback(data);
    const requirements = isExamAccessCallback
      ? { channels: [], platformVerified: true }
      : await getAccessRequirementStatus(telegramUserId, store, membershipChecker);
    if (data === "channel:check") {
      if (areChannelsSubscribed(requirements) && requirements.platformVerified) {
        await sender.sendMessage(chatId, welcomeText(), mainMenu());
      } else {
        await promptAccessRequirements(chatId, sender, requirements);
      }
      return;
    }
    if (!areChannelsSubscribed(requirements)) {
      await promptAccessRequirements(chatId, sender, requirements);
      return;
    }
    if (data === "platform:confirmed") {
      await promptAccessRequirements(chatId, sender, requirements);
      return;
    }
    if (data === "platform:verify") {
      if (requirements.platformVerified) {
        await sender.sendMessage(chatId, "تم التحقق من زيارة منصة الناصر القانونية. يمكنك الآن استخدام خدمات البوت.", mainMenu());
      } else {
        await promptAccessRequirements(chatId, sender, requirements);
      }
      return;
    }
    if (!requirements.platformVerified) {
      await promptAccessRequirements(chatId, sender, requirements);
      return;
    }
    if (isPrivateChat(chat?.type)) await qualifyReferralIfEligible(telegramUserId, store, sender);
    if (data === "premium:referral") {
      const progress = await store.getReferralProgress(telegramUserId);
      await sender.sendMessage(chatId, referralHelpText(progress, telegramUserId), referralMenu());
      return;
    }
    if (data === "premium:referrals") {
      const [progress, history] = await Promise.all([store.getReferralProgress(telegramUserId), store.listReferralHistory(telegramUserId)]);
      await sender.sendMessage(chatId, `📊 إحالاتك المحتسبة: ${progress.qualifiedCount} | قيد التأهيل: ${progress.pendingCount} | المتبقي للمكافأة التالية: ${progress.remainingCount}.\n\n${referralHistoryText(history)}`, referralMenu());
      return;
    }
    if (data === "hasad:verify") {
      if (await store.hasConfirmedHasadAccess(telegramUserId)) {
        await sender.sendMessage(chatId, "✅ تم توثيق زيارة حصاد اليوم بنجاح. يمكنك الآن استخدام القسم الذي فتحته مجانًا.", mainMenu());
      } else {
        await sender.sendMessage(chatId, "لم يكتمل توثيق الزيارة بعد. افتح حصاد اليوم من زر التحقق داخل البوت، ثم ارجع واضغط «تحقّق من زيارة حصاد اليوم».", hasadAccessMenu());
      }
      return;
    }
    const callbackSectionKey = managedSectionForCallback(data);
    const callbackSectionMode = callbackSectionKey ? managedSectionAccessMode(managedSections, callbackSectionKey) : undefined;
    if (callbackSectionMode === "hasad" && !(await store.hasConfirmedHasadAccess(telegramUserId))) {
      const gateText = isHasadProtectedCallback(data)
        ? hasadAccessGateText(data)
        : `🔐 للوصول إلى القسم المطلوب، يلزم توثيق زيارة واحدة لموقع حصاد اليوم عبر الزر التالي. بعد التوثيق لن تظهر لك هذه البوابة مرة أخرى.`;
      await sender.sendMessage(chatId, gateText, hasadAccessMenu());
      return;
    }
    if ((callbackSectionKey === "judicial" || callbackSectionKey === "contract-templates") && callbackSectionMode === "premium" && !(await store.hasReferralPremiumAccess(telegramUserId, "sharia_exams"))) {
      await sender.sendMessage(chatId, `🔐 الوصول إلى ${callbackSectionKey === "judicial" ? "القواعد القضائية" : "الصيغ والعقود القانونية"} يتاح بعد اكتمال 5 إحالات مؤهلة.`, referralMenu());
      return;
    }
    const examSectionKey = data === "secondary-exams" ? "secondary-exams" : "exams";
    const isFreeExamSection = callbackSectionMode === "free";
    const hasImportantLawsSectionAccess = async () => {
      const mode = managedSectionAccessMode(managedSections, "important-laws");
      if (mode === "free") return true;
      if (mode === "hasad") return store.hasConfirmedHasadAccess(telegramUserId);
      return store.hasImportantYemeniLawsAccess(telegramUserId);
    };
    if (isReferralProtectedCallback(data) && callbackSectionMode === "premium" && !isFreeExamSection && !(await store.hasReferralPremiumAccess(telegramUserId, examAccessScope(data)))) {
      const scope = examAccessScope(data);
      await sender.sendMessage(chatId, optionalExamSupportText(scope), optionalExamSupportMenu(scope));
      return;
    }
    if (data === "gexam:open") {
      if (isPrivateChat(chat?.type) || chat?.type === "channel") {
        await sender.sendMessage(chatId, "يمكن بدء الاختبار الجماعي من داخل مجموعة تيليغرام فقط.", mainMenu());
        return;
      }
      await sender.sendMessage(chatId, `🎲 ${CIVIL_LAW_GENERAL_2025_TITLE}\n\nاختر مدة السؤال. يصبح من يختار المدة منشئ الجولة، ويمكنه أو لأي مشرف إنهاؤها عند الحاجة.`, groupExamTimeMenu());
      return;
    }
    if (data.startsWith("gexam:time:")) {
      if (isPrivateChat(chat?.type) || chat?.type === "channel") return;
      const timeLimitSeconds = Number(data.slice("gexam:time:".length));
      if (![15, 30, 60, 300].includes(timeLimitSeconds)) return;
      const createdRound = await store.createGroupExamRound({
        chatId: String(chatId),
        creatorTelegramUserId: telegramUserId,
        subjectKey: CIVIL_LAW_EXAM_SUBJECT_KEY,
        sectionKey: CIVIL_LAW_GENERAL_2025_SECTION_KEY,
        timeLimitSeconds: timeLimitSeconds as 15 | 30 | 60 | 300,
      });
      if (!createdRound) {
        await sender.sendMessage(chatId, "تعذر تجهيز اختبار المجموعة حاليًا. حاول مرة أخرى بعد قليل.");
        return;
      }
      if (!createdRound.created) {
        await sender.sendMessage(chatId, createdRound.round.status === "active" ? "توجد جولة جماعية نشطة بالفعل. انتظروا انتهائها ثم ابدأوا جولة جديدة." : "توجد بطاقة استعداد مفتوحة بالفعل. اضغط «أنا مستعد» من البطاقة الحالية.");
        return;
      }
      await sender.sendMessage(
        chatId,
        `🎲 بطاقة استعداد — ${CIVIL_LAW_GENERAL_2025_TITLE}\n\n⏱ مدة السؤال: ${formatExamTime(timeLimitSeconds)}\n👥 لا يبدأ الاختبار حتى يضغط ثلاثة أعضاء مختلفين على «أنا مستعد».\n\nمنشئ الجولة أو مشرف المجموعة يمكنه إنهاؤها من الزر أدناه.`,
        groupExamReadyMenu(createdRound.round.id, 0)
      );
      return;
    }
    if (data.startsWith("gexam:ready:")) {
      if (isPrivateChat(chat?.type) || chat?.type === "channel") return;
      const roundId = Number(data.slice("gexam:ready:".length));
      if (!Number.isInteger(roundId) || roundId < 1) return;
      const round = await store.getGroupExamRound(roundId);
      if (!round || round.chatId !== String(chatId) || round.status !== "waiting") {
        await sender.sendMessage(chatId, "بطاقة الاستعداد لم تعد متاحة. يمكنك بدء جولة جديدة عند الحاجة.");
        return;
      }
      const displayName = [callback.from?.first_name, callback.from?.last_name].filter(Boolean).join(" ").trim() || (callback.from?.username ? `@${callback.from.username}` : `المشارك ${telegramUserId}`);
      const joinedRound = await store.joinGroupExamRound({ roundId, telegramUserId, displayName, username: callback.from?.username });
      if (!joinedRound) return;
      if (joinedRound.participantCount < 3) {
        await sender.sendMessage(
          chatId,
          `${joinedRound.joined ? "تم تسجيل استعدادك" : "أنت مستعد بالفعل"}.\n\nالمستعدون حاليًا: ${joinedRound.participantCount} من 3 على الأقل.\nينطلق الاختبار تلقائيًا عند اكتمال العدد.`,
          groupExamReadyMenu(roundId, joinedRound.participantCount)
        );
        return;
      }
      const activeRound = await store.activateGroupExamRound(roundId);
      if (!activeRound) return;
      const questions = await store.listExamQuestions(activeRound.subjectKey, activeRound.sectionKey);
      await sender.sendMessage(
        chatId,
        `🎲 بدأت الجولة الجماعية — ${CIVIL_LAW_GENERAL_2025_TITLE}\n\n👥 المشاركون: ${joinedRound.participantCount}\n🖊 الأسئلة: ${questions.length}\n⏱ ${formatExamTime(activeRound.timeLimitSeconds)} لكل سؤال\n📖 ستظهر الإجابة الصحيحة والشرح ونتائج المجموعة بعد كل سؤال.`
      );
      await launchGroupExamQuestion(chatId, activeRound.id, store, sender);
      return;
    }
    if (data.startsWith("gexam:cancel:")) {
      if (isPrivateChat(chat?.type) || chat?.type === "channel") return;
      const roundId = Number(data.slice("gexam:cancel:".length));
      if (!Number.isInteger(roundId) || roundId < 1) return;
      const round = await store.getGroupExamRound(roundId);
      if (!round || round.chatId !== String(chatId)) return;
      const isCreator = round.creatorTelegramUserId === telegramUserId;
      const isAdministrator = isCreator ? false : await sender.isChatAdministrator(chatId, telegramUserId);
      if (!isCreator && !isAdministrator) {
        await sender.sendMessage(chatId, "إنهاء الجولة متاح لمنشئها أو لمشرفي المجموعة فقط.");
        return;
      }
      const cancelled = await store.cancelGroupExamRound(roundId);
      if (cancelled && round.activePollId) clearGroupExamTimeout(round.activePollId);
      await sender.sendMessage(chatId, cancelled ? "⏹ تم إنهاء الجولة الجماعية. لا تُحتسب أي إجابات لاحقة." : "لا توجد جولة قابلة للإنهاء حاليًا.");
      return;
    }
    if (data === "exam:retry") {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يمكن إعادة الاختبار من المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      await sender.sendMessage(chatId, `${CIVIL_LAW_GENERAL_2025_TITLE}\n\nاختر المدة المخصصة لكل سؤال قبل بدء محاولة جديدة.`, civilLawExamTimeMenu());
      return;
    }
    if (data.startsWith("broadcast:confirm:")) {
      if (!isPrivateOwnerConversation(telegramUserId, chat?.type)) {
        await sender.sendMessage(chatId, "هذا الإجراء متاح لمالك البوت داخل محادثته الخاصة فقط.", mainMenu());
        return;
      }
      const broadcastId = Number(data.slice("broadcast:confirm:".length));
      if (!Number.isInteger(broadcastId) || broadcastId < 1) return;
      const draft = await store.getBroadcastDraft(broadcastId, telegramUserId);
      if (!draft || draft.status !== "draft") {
        await sender.sendMessage(chatId, "هذه المسودة غير متاحة للإرسال أو سبق تنفيذها.", mainMenu());
        return;
      }
      if ((draft.kind === "message" && !draft.message) || (draft.kind === "document" && !draft.fileId)) {
        await sender.sendMessage(chatId, "تعذر تنفيذ المسودة لأن محتواها غير مكتمل.", mainMenu());
        return;
      }
      if (!(await store.beginBroadcast(broadcastId, telegramUserId))) {
        await sender.sendMessage(chatId, "تعذر بدء البث لأن المسودة استُخدمت أو أُلغيت بالفعل.", mainMenu());
        return;
      }
      const recipientChatIds = await store.listSubscriberChatIds();
      let successCount = 0;
      let failureCount = 0;
      for (const recipientChatId of recipientChatIds) {
        const recipientId = Number(recipientChatId);
        if (!Number.isSafeInteger(recipientId)) {
          failureCount += 1;
          continue;
        }
        try {
          if (draft.kind === "message") {
            await sender.sendMessage(recipientId, draft.message!);
          } else {
            await sender.sendDocumentByFileId(recipientId, draft.fileId!, draft.caption ?? undefined);
          }
          successCount += 1;
        } catch {
          failureCount += 1;
        }
      }
      await store.completeBroadcast(broadcastId, telegramUserId, successCount, failureCount);
      await sender.sendMessage(chatId, `اكتمل البث رقم #${broadcastId}.\nنجح الإرسال: ${successCount}\nتعذر الإرسال: ${failureCount}`, mainMenu());
      return;
    }
    if (data.startsWith("broadcast:cancel:")) {
      if (!isPrivateOwnerConversation(telegramUserId, chat?.type)) {
        await sender.sendMessage(chatId, "هذا الإجراء متاح لمالك البوت داخل محادثته الخاصة فقط.", mainMenu());
        return;
      }
      const broadcastId = Number(data.slice("broadcast:cancel:".length));
      if (!Number.isInteger(broadcastId) || broadcastId < 1) return;
      const wasCancelled = await store.cancelBroadcastDraft(broadcastId, telegramUserId);
      await sender.sendMessage(chatId, wasCancelled ? "تم إلغاء مسودة البث. لم يُرسل أي محتوى." : "تعذر إلغاء المسودة لأنها لم تعد متاحة.", mainMenu());
      return;
    }
    if (data.startsWith("important-laws:approve:") || data.startsWith("important-laws:reject:")) {
      if (!isPrivateOwnerConversation(telegramUserId, chat?.type)) {
        await sender.sendMessage(chatId, "هذا الإجراء متاح لمالك البوت فقط.", mainMenu());
        return;
      }
      const isApproval = data.startsWith("important-laws:approve:");
      const requestId = Number(data.slice(isApproval ? "important-laws:approve:".length : "important-laws:reject:".length));
      if (!Number.isInteger(requestId) || requestId < 1) return;
      const request = isApproval
        ? await store.approveImportantYemeniLawsSubscriptionRequest(requestId, telegramUserId)
        : await store.rejectImportantYemeniLawsSubscriptionRequest(requestId, telegramUserId);
      if (!request) return;
      const requesterChatId = Number(request.chatId);
      let requesterWasNotified = false;
      if (Number.isSafeInteger(requesterChatId)) {
        try {
          await sender.sendMessage(
            requesterChatId,
            isApproval
              ? `تم اعتماد اشتراكك في قسم ${subscriptionRequestLabel(request.accessScope, request.managedMenuItemId)}. يمكنك فتح القسم الآن من القائمة الرئيسة.`
              : `لم يُعتمد طلب الاشتراك في قسم ${subscriptionRequestLabel(request.accessScope, request.managedMenuItemId)}. راجع بيانات التحويل ثم أرسل طلبًا جديدًا عند الحاجة.`,
            mainMenu()
          );
          requesterWasNotified = true;
        } catch {
          requesterWasNotified = false;
        }
      }
      const ownerConfirmation = isApproval
        ? [
          "✅ إشعار تأكيد اعتماد الاشتراك",
          `رقم الطلب: #${requestId}`,
          `معرّف المشترك: ${request.telegramUserId}`,
          `حالة إشعار المشترك: ${requesterWasNotified ? "تم إرساله بنجاح." : "تعذر إرساله؛ يمكن للمشترك فتح البوت لاحقًا."}`,
        ].join("\n")
        : `تم رفض الطلب #${requestId}.`;
      await sender.sendMessage(chatId, ownerConfirmation, mainMenu());
      return;
    }
    const isFileRequest = data.startsWith("source:") || data.startsWith("jfile:") || data.startsWith("jresultfile:") || data.startsWith("lfile:") || data.startsWith("lresultfile:") || data.startsWith("ayfile:") || data.startsWith("ayresultfile:") || data.startsWith("ylfile:") || data.startsWith("fform:") || data.startsWith("vfile:") || data.startsWith("rfile:") || data.startsWith("ifile:") || data.startsWith("ctemplate:");
    if (isFileRequest && !isPrivateChat(chat?.type)) {
      return;
    }

    if (data === "menu") {
      await sender.sendMessage(chatId, welcomeText(messageContent("welcome")), mainMenu(managedMenuItems, managedSections));
      return;
    }
    if (data.startsWith("managed-premium:request:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يمكن إرسال طلب الاشتراك من المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      const itemId = Number(data.slice("managed-premium:request:".length));
      const item = managedMenuItems.find(candidate => candidate.id === itemId && candidate.accessMode === "premium");
      if (!item) return;
      if (await store.hasManagedMenuItemPremiumAccess(telegramUserId, itemId)) {
        await sender.sendMessage(chatId, `لديك وصول مفعل إلى ${item.label}.`, { inline_keyboard: [[{ text: `فتح ${item.label}`, callback_data: `managed:${itemId}` }]] });
        return;
      }
      await sender.sendMessage(chatId, `اختر طريقة التحويل التي استخدمتها ليُرفق نوع التحويل وبياناته مع طلبك المرسل إلى الإدارة للوصول إلى ${item.label}.\n\nيمكنك كذلك الحصول على وصول مجاني لمدة شهر عند اكتمال 5 إحالات مؤهلة.`, managedMenuItemPaymentMethodMenu(itemId));
      return;
    }
    if (data.startsWith("managed-premium:payment:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يمكن إرسال طلب الاشتراك من المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      const [, , rawItemId, rawPaymentMethod] = data.split(":");
      const itemId = Number(rawItemId);
      const paymentMethod = rawPaymentMethod as ImportantYemeniLawsPaymentMethod;
      const item = managedMenuItems.find(candidate => candidate.id === itemId && candidate.accessMode === "premium");
      if (!item || !Number.isInteger(itemId) || !(paymentMethod in importantYemeniLawsPaymentMethods)) return;
      pendingImportantLawsPaymentProofs.set(telegramUserId, {
        expiresAt: Date.now() + IMPORTANT_LAWS_PAYMENT_PROOF_TIMEOUT_MS,
        identity: {
          telegramUserId,
          telegramUsername: callback.from?.username,
          telegramFirstName: callback.from?.first_name,
          telegramLastName: callback.from?.last_name,
          paymentMethod,
          accessScope: "important_laws",
          managedMenuItemId: itemId,
        },
      });
      await sender.sendMessage(chatId, `أرسل الآن صورة واضحة لإثبات الإيداع. ستُرسل الصورة إلى إدارة البوت فقط مع طلب الوصول إلى ${item.label}، وتنتهي مهلة الإرسال بعد 15 دقيقة.`);
      return;
    }
    if (data.startsWith("managed:")) {
      const itemId = Number(data.slice("managed:".length));
      const item = managedMenuItems.find(candidate => candidate.id === itemId);
      if (!item) return;
      if (item.accessMode === "hasad" && !(await store.hasConfirmedHasadAccess(telegramUserId))) {
        await sender.sendMessage(chatId, `🔐 للوصول إلى ${item.label}، يلزم توثيق زيارة واحدة لموقع حصاد اليوم عبر الزر التالي. بعد التوثيق لن تظهر لك هذه البوابة مرة أخرى.`, hasadAccessMenu());
        return;
      }
      if (item.accessMode === "premium" && !(await store.hasManagedMenuItemPremiumAccess(telegramUserId, itemId))) {
        await sender.sendMessage(chatId, `🔐 الوصول إلى ${item.label} يتاح عبر الدعم الاختياري أو الإحالة. يمكنك الحصول على وصول مجاني لمدة شهر عند اكتمال 5 إحالات مؤهلة.`, {
          inline_keyboard: [
            [{ text: "وصول مجاني بالإحالة", callback_data: "premium:referral" }],
            [{ text: "الاشتراك المدفوع", callback_data: `managed-premium:request:${itemId}` }],
            [{ text: "رجوع", callback_data: "start" }],
          ],
        });
        return;
      }
      await sendManagedMenuItemContent(chatId, item);
      return;
    }
    if (data === "favorites") {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "تُعرض مفضلتك داخل المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      const favorites = await store.listFavorites(telegramUserId);
      if (favorites.length === 0) {
        await sender.sendMessage(chatId, "⭐ مفضلتي\n\nلا توجد مستندات محفوظة حاليًا. افتح أي نتيجة بحث واضغط «إضافة للمفضلة» لحفظها.", mainMenu());
        return;
      }
      await sender.sendMessage(chatId, `⭐ مفضلتي\n\nلديك ${favorites.length} مستندًا محفوظًا. اضغط اسم المستند لطلبه، أو أزله من المفضلة.`, favoritesMenu(favorites));
      return;
    }
    if (data.startsWith("favadd:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يمكن حفظ المستندات في المفضلة من المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      const sourceId = Number(data.slice("favadd:".length));
      if (!Number.isInteger(sourceId) || sourceId < 1) return;
      const result = await store.saveFavorite(telegramUserId, sourceId);
      if (result === "unavailable") {
        await sender.sendMessage(chatId, "تعذر حفظ هذا المستند في المفضلة حاليًا. حاول مرة أخرى بعد قليل.");
        return;
      }
      const source = await store.getSource(sourceId);
      await sender.sendMessage(
        chatId,
        result === "added"
          ? `⭐ تمت إضافة «${source ? displaySourceTitle(source) : "المستند"}» إلى مفضلتك.`
          : "⭐ هذا المستند محفوظ بالفعل في مفضلتك.",
        result === "added" ? { inline_keyboard: [[{ text: "⭐ فتح مفضلتي", callback_data: "favorites" }]] } : undefined
      );
      return;
    }
    if (data.startsWith("favremove:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يمكن إدارة المفضلة من المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      const sourceId = Number(data.slice("favremove:".length));
      if (!Number.isInteger(sourceId) || sourceId < 1) return;
      const removed = await store.removeFavorite(telegramUserId, sourceId);
      await sender.sendMessage(chatId, removed ? "تمت إزالة المستند من مفضلتك." : "هذا المستند غير موجود في مفضلتك حاليًا.", { inline_keyboard: [[{ text: "⭐ تحديث مفضلتي", callback_data: "favorites" }]] });
      return;
    }
    if (data === "exams") {
      await sender.sendMessage(chatId, quizQuickCommandsText(), civilLawExamMenu());
      return;
    }
    if (data === "secondary-exams") {
      await sender.sendMessage(chatId, "🧮 اختبارات الثانوية العامة\n\nاختر القسم المطلوب.", secondaryLevelsMenu());
      return;
    }
    if (data === "exam:levels") {
      await sender.sendMessage(chatId, "📝 اختبارات الشريعة والقانون\n\nاختر المستوى المطلوب.", civilLawExamMenu());
      return;
    }
    if (data === "exam:noop") return;
    if (data.startsWith("exam:level:")) {
      const [, , levelKey, requestedPage] = data.split(":");
      const level = getTelegramExamCatalogLevel(levelKey);
      if (!level) {
        await sender.sendMessage(chatId, "تعذر العثور على هذا المستوى. اختر مستوى من القائمة.", civilLawExamMenu());
        return;
      }
      if (level.comingSoon) {
        await sender.sendMessage(chatId, `📝 ${level.name}\n\nهذه البوابة فارغة حاليًا، وسيُضاف محتواها قريبًا.`, examSubjectsMenu(level.key));
        return;
      }
      const page = Number(requestedPage);
      await sender.sendMessage(
        chatId,
        `📝 ${level.name}\n\nاختر المادة المطلوبة. تظهر المواد بالترتيب المعتمد في منصة الناصر.`,
        examSubjectsMenu(level.key, Number.isInteger(page) && page > 0 ? page : 1)
      );
      return;
    }
    if (data.startsWith("exam:coming-soon:")) {
      await sender.sendMessage(chatId, "سيُضاف محتوى هذه البوابة قريبًا. اختر مستوى آخر من فهرس الاختبارات.", civilLawExamMenu());
      return;
    }
    if (data.startsWith("exam:subject:")) {
      const [, , levelKey, subjectKey, requestedPage] = data.split(":");
      const subject = getTelegramExamCatalogSubject(levelKey, subjectKey);
      if (!subject) {
        await sender.sendMessage(chatId, "تعذر العثور على هذه المادة. اختر مادة من القائمة.", civilLawExamMenu());
        return;
      }
      const importedSubjectKey = getImportedExamSubjectKey(levelKey, subjectKey);
      if (importedSubjectKey) {
        const forms = await store.listExamForms(importedSubjectKey);
        await sender.sendMessage(
          chatId,
          forms.length > 0
            ? `📕 ${examSubjectHeading(levelKey, subject)}\n\nاختر نموذج الاختبار المطلوب.`
            : "لا تتوافر نماذج اختبار لهذه المادة حاليًا.",
          forms.length > 0 ? examFormsMenu(levelKey, subjectKey, forms) : examSubjectsMenu(levelKey, Number(requestedPage) || 1)
        );
        return;
      }
      const page = Number(requestedPage);
      await sender.sendMessage(
        chatId,
        `📚 ${getTelegramExamCatalogLevel(levelKey)?.name ?? "المستوى"} ← ${subject.name}\n\nلا توجد أسئلة مضافة لهذه المادة في البوت حاليًا.`,
        examSubjectsMenu(levelKey, Number.isInteger(page) && page > 0 ? page : 1)
      );
      return;
    }
    if (data.startsWith("exam:forms:")) {
      const [, , levelKey, subjectKey, requestedPage] = data.split(":");
      const importedSubjectKey = getImportedExamSubjectKey(levelKey, subjectKey);
      const subject = getTelegramExamCatalogSubject(levelKey, subjectKey);
      if (!importedSubjectKey || !subject) return;
      const forms = await store.listExamForms(importedSubjectKey);
      await sender.sendMessage(chatId, `📕 ${examSubjectHeading(levelKey, subject)}\n\nاختر نموذج الاختبار المطلوب.`, examFormsMenu(levelKey, subjectKey, forms, Number(requestedPage) || 1));
      return;
    }
    if (data.startsWith("exam:training:")) {
      const [, , levelKey, subjectKey, requestedPage] = data.split(":");
      const importedSubjectKey = getImportedExamSubjectKey(levelKey, subjectKey);
      const subject = getTelegramExamCatalogSubject(levelKey, subjectKey);
      if (!importedSubjectKey || !subject) return;
      const forms = await store.listExamForms(importedSubjectKey);
      await sender.sendMessage(chatId, `🧪 ${subject.name}\n\nاختر أسئلة التدريب أو القسم المطلوب.`, examTrainingFormsMenu(levelKey, subjectKey, forms, Number(requestedPage) || 1));
      return;
    }
    if (data.startsWith("exam:form:")) {
      const [, , levelKey, subjectKey, formKeyOrSortOrder, requestedPage] = data.split(":");
      const importedSubjectKey = getImportedExamSubjectKey(levelKey, subjectKey);
      const subject = getTelegramExamCatalogSubject(levelKey, subjectKey);
      if (!importedSubjectKey || !subject || !formKeyOrSortOrder) return;
      const forms = await store.listExamForms(importedSubjectKey);
      const form = forms.find(item => item.formKey === formKeyOrSortOrder || String(item.sortOrder) === formKeyOrSortOrder);
      if (!form) {
        await sender.sendMessage(chatId, "تعذر العثور على هذا النموذج. اختر نموذجًا من القائمة.", examFormsMenu(levelKey, subjectKey, forms, Number(requestedPage) || 1));
        return;
      }
      const questions = await store.listExamQuestions(importedSubjectKey, form.formKey);
      await sender.sendMessage(
        chatId,
        questions.length > 0
          ? `📕 ${examSubjectHeading(levelKey, subject)} — ${form.formName}\n\nيتضمن النموذج ${questions.length} سؤالًا. اختر المدة المخصصة لكل سؤال قبل بدء الجولة.`
          : "لا تتوافر أسئلة هذا النموذج حاليًا. حاول مرة أخرى لاحقًا.",
        questions.length > 0
          ? examTimeMenu(importedSubjectKey, form.sortOrder, `exam:forms:${levelKey}:${subjectKey}:${requestedPage || 1}`)
          : examFormsMenu(levelKey, subjectKey, forms, Number(requestedPage) || 1)
      );
      return;
    }
    if (data === "exam:civil") {
      await sender.sendMessage(chatId, "📙 القانون المدني\n\nاختر القسم المطلوب.", civilLawExamSectionMenu());
      return;
    }
    if (data === "exam:civil:general2025") {
      const questions = await store.listExamQuestions(CIVIL_LAW_EXAM_SUBJECT_KEY, CIVIL_LAW_GENERAL_2025_SECTION_KEY);
      await sender.sendMessage(
        chatId,
        questions.length > 0
          ? `${CIVIL_LAW_GENERAL_2025_TITLE}\n\nيتضمن الاختبار ${questions.length} أسئلة. اختر المدة المخصصة لكل سؤال قبل بدء الجولة.`
          : "لا تتوافر أسئلة هذا القسم حاليًا. حاول مرة أخرى لاحقًا.",
        questions.length > 0 ? civilLawExamTimeMenu() : civilLawExamSectionMenu()
      );
      return;
    }
    if (data.startsWith("exam:time:") && data.split(":").length === 5) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يتاح الاختبار داخل المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      const [, , subjectKey, formKeyOrSortOrder, rawTimeLimit] = data.split(":");
      const timeLimitSeconds = Number(rawTimeLimit);
      const location = getImportedExamCatalogLocation(subjectKey);
      const subject = location ? getTelegramExamCatalogSubject(location.levelKey, location.catalogSubjectKey) : undefined;
      if (!location || !subject || !formKeyOrSortOrder || ![15, 30, 60, 300].includes(timeLimitSeconds)) return;
      const forms = await store.listExamForms(subjectKey);
      const form = forms.find(item => item.formKey === formKeyOrSortOrder || String(item.sortOrder) === formKeyOrSortOrder);
      if (!form) {
        await sender.sendMessage(chatId, "تعذر العثور على هذا النموذج. اختر نموذجًا من القائمة.", examFormsMenu(location.levelKey, location.catalogSubjectKey, forms));
        return;
      }
      const session = await store.startExamSession(telegramUserId, String(chatId), subjectKey, form.formKey, timeLimitSeconds as 15 | 30 | 60 | 300);
      if (!session) {
        await sender.sendMessage(chatId, "تعذر تجهيز الاختبار حاليًا. حاول مرة أخرى لاحقًا.", examTimeMenu(subjectKey, form.sortOrder, `exam:forms:${location.levelKey}:${location.catalogSubjectKey}:1`));
        return;
      }
      const questions = await store.listExamQuestions(subjectKey, form.formKey);
      await sender.sendMessage(
        chatId,
        [
          `🎲 استعد جيدًا لـ 'اختبار ${subject.name} — ${form.formName}'`,
          `🖊 ${questions.length} أسئلة`,
          `⏱ ${formatExamTime(timeLimitSeconds)} لكل سؤال`,
          "📖 ستظهر الإجابة الصحيحة والشرح المفصل بعد كل سؤال، ويظهر التلميح عند الإجابة الخاطئة.",
          "🏁 اضغط على الزر أدناه عندما تكون مستعدًا. لإيقاف الاختبار أرسل /stop.",
        ].join("\n"),
        civilLawExamReadyMenu(session.id)
      );
      return;
    }
    if (data.startsWith("exam:time:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يتاح الاختبار داخل المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      const timeLimitSeconds = Number(data.slice("exam:time:".length));
      if (![15, 30, 60, 300].includes(timeLimitSeconds)) return;
      const session = await store.startExamSession(telegramUserId, String(chatId), CIVIL_LAW_EXAM_SUBJECT_KEY, CIVIL_LAW_GENERAL_2025_SECTION_KEY, timeLimitSeconds as 15 | 30 | 60 | 300);
      if (!session) {
        await sender.sendMessage(chatId, "تعذر تجهيز الاختبار حاليًا. حاول مرة أخرى لاحقًا.", civilLawExamTimeMenu());
        return;
      }
      const questions = await store.listExamQuestions(CIVIL_LAW_EXAM_SUBJECT_KEY, CIVIL_LAW_GENERAL_2025_SECTION_KEY);
      await sender.sendMessage(
        chatId,
        [
          `🎲 استعد جيدًا لـ '${CIVIL_LAW_GENERAL_2025_TITLE}'`,
          `🖊 ${questions.length} أسئلة`,
          `⏱ ${formatExamTime(timeLimitSeconds)} لكل سؤال`,
          "📖 ستظهر الإجابة الصحيحة والشرح المفصل بعد كل سؤال.",
          "🏁 اضغط على الزر أدناه عندما تكون مستعدًا. لإيقاف الاختبار أرسل /stop.",
        ].join("\n"),
        civilLawExamReadyMenu(session.id)
      );
      return;
    }
    if (data.startsWith("exam:ready:")) {
      const sessionId = Number(data.slice("exam:ready:".length));
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await launchNativeExamQuestion(chatId, sessionId, telegramUserId, store, sender);
      return;
    }
    if (data.startsWith("exam:written-next:")) {
      const sessionId = Number(data.slice("exam:written-next:".length));
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      const session = await store.getExamSession(sessionId, telegramUserId);
      if (!session || session.status !== "active") return;
      const outcome = await store.advanceExamWrittenQuestion({
        sessionId,
        telegramUserId,
        questionIndex: session.questionIndex,
      });
      if (!outcome) return;
      if (outcome.completed) {
        await sendNativeExamCompletionResult(chatId, session, outcome, store, sender);
      } else {
        await launchNativeExamQuestion(chatId, sessionId, telegramUserId, store, sender);
      }
      return;
    }
    if (data.startsWith("exam:stop:")) {
      const sessionId = Number(data.slice("exam:stop:".length));
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      const stopped = await store.cancelExamSession(telegramUserId, String(chatId));
      await sendStoppedExamMessage(chatId, stopped, store, sender);
      return;
    }
    if (data === "browse") {
      await store.recordUsage(telegramUserId, "browse", { sectionKey: "browse" });
      await sender.sendMessage(chatId, browseText(), categoryMenu());
      return;
    }
    if (data === "judicial") {
      await store.recordUsage(telegramUserId, "browse", { sectionKey: "judicial" });
      await sender.sendMessage(chatId, judicialIntroText());
      await sendJudicialFolder(chatId, JUDICIAL_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "legislation") {
      await store.recordUsage(telegramUserId, "browse", { sectionKey: "legislation" });
      await sender.sendMessage(chatId, legislationIntroText());
      await sendLegislationFolder(chatId, LEGISLATION_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "legal-forms") {
      await store.recordUsage(telegramUserId, "browse", { sectionKey: "legal-forms" });
      await sender.sendMessage(chatId, legalFormsIntroText());
      await sendLegalFormsFolder(chatId, LEGAL_FORMS_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "illustrated-legal-forms") {
      await store.recordUsage(telegramUserId, "browse", { sectionKey: "illustrated-legal-forms" });
      await sender.sendMessage(chatId, illustratedLegalFormsIntroText());
      await sendIllustratedLegalFormsFolder(chatId, ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "all-yemeni-laws") {
      await store.recordUsage(telegramUserId, "browse", { sectionKey: "all-yemeni-laws" });
      await sender.sendMessage(chatId, allYemeniLawsIntroText());
      await sendAllYemeniLawsFolder(chatId, ALL_YEMENI_LAWS_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "contract-templates") {
      await store.recordUsage(telegramUserId, "browse");
      await sendContractTemplatesMenu(chatId, 1, store, sender);
      return;
    }
    if (data === "ctypes") {
      await sendContractTemplateTypesMenu(chatId, store, sender);
      return;
    }
    if (data === "ctsearch") {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يمكن البحث داخل الصيغ والعقود من المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      await promptContractTemplateSearch(chatId, store, sender);
      return;
    }
    if (data.startsWith("ctemplates:")) {
      const page = Number(data.slice("ctemplates:".length));
      await sendContractTemplatesMenu(chatId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("ctype:")) {
      const [, rawType, rawPage] = data.split(":");
      const page = Number(rawPage ?? "1");
      if (!isTelegramContractTemplateType(rawType)) return;
      await sendContractTemplatesByType(chatId, rawType, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("ctresult:")) {
      const [, sessionValue, pageValue] = data.split(":");
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await sendContractTemplateSearchResults(chatId, sessionId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("ctemplate:")) {
      const [, rawTemplateId] = data.split(":");
      const templateId = Number(rawTemplateId);
      if (!Number.isInteger(templateId) || templateId < 1) return;
      const template = await store.getContractTemplate(templateId);
      if (!template) {
        await sender.sendMessage(chatId, "تعذر العثور على هذا النموذج. اختره من القائمة مرة أخرى.");
        return;
      }
      await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.filePreparing);
      try {
        await sender.sendDocument(chatId, await createTelegramContractDocument(template));
        await store.recordUsage(telegramUserId, "document_request");
      } catch {
        await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.fileDownloadFailed);
      }
      return;
    }
    if (data.startsWith("jq:")) {
      await runQuickJudicialSearch(chatId, telegramUserId, data.slice("jq:".length), store, sender);
      return;
    }
    if (data === "jsearch") {
      await promptJudicialSearch(chatId, store, sender);
      return;
    }
    if (data.startsWith("lq:")) {
      await runQuickLegislationSearch(chatId, telegramUserId, data.slice("lq:".length), store, sender);
      return;
    }
    if (data === "lsearch") {
      await promptLegislationSearch(chatId, store, sender);
      return;
    }
    if (data.startsWith("ayq:")) {
      await runQuickAllYemeniLawsSearch(chatId, telegramUserId, data.slice("ayq:".length), store, sender);
      return;
    }
    if (data === "aysearch") {
      await promptAllYemeniLawsSearch(chatId, store, sender);
      return;
    }
    if (data === "search") {
      await store.recordUsage(telegramUserId, "search", { sectionKey: "search" });
      await sender.sendMessage(chatId, searchText(), unifiedSearchMenu());
      return;
    }
    if (data === "search:library") {
      await promptLibrarySearch(chatId, store, sender);
      return;
    }
    if (data === "ltypes") {
      await sender.sendMessage(chatId, "📜 تصفية التشريعات اليمنية حسب النوع:", legislationTypeMenu());
      return;
    }
    if (data === "lfilters") {
      await sender.sendMessage(chatId, "📜 اختر طريقة تصفية التشريعات اليمنية:", legislationFilterMenu());
      return;
    }
    if (data === "lyears") {
      const years = await store.listLegislationYears();
      if (years.length === 0) {
        await sender.sendMessage(chatId, "لا تتوفر سنوات إصدار مستخرجة من أسماء الملفات حاليًا.", legislationFilterMenu());
      } else {
        await sender.sendMessage(chatId, "📅 اختر سنة الإصدار المتاحة:", legislationYearMenu(years));
      }
      return;
    }
    if (data === "latest") {
      await store.recordUsage(telegramUserId, "browse", { sectionKey: "latest" });
      await sendCuratedSources(chatId, "🆕 أحدث الإضافات", await store.listRecentSources(), "menu", sender);
      return;
    }
    if (data === "popular") {
      await store.recordUsage(telegramUserId, "browse", { sectionKey: "popular" });
      await sendCuratedSources(chatId, "⭐ الملفات الأكثر طلبًا", await store.listPopularSources(), "menu", sender);
      return;
    }
    if (data === "featured") {
      await store.recordUsage(telegramUserId, "browse", { sectionKey: "featured" });
      await sender.sendMessage(chatId, featuredReferencesIntroText());
      await sendFeaturedReferencesFolder(chatId, FEATURED_REFERENCES_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "important-laws" || data === "yemeni-laws") {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يتاح قسم أهم القوانين اليمنية التفاعلي داخل المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      if (!(await hasImportantLawsSectionAccess())) {
        await sender.sendMessage(chatId, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      await store.recordUsage(telegramUserId, "browse", { sectionKey: "important-laws" });
      await sendImportantYemeniLawsFolder(chatId, IMPORTANT_YEMENI_LAWS_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "important-laws:request") {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يمكن إرسال طلب الاشتراك من المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      if (await hasImportantLawsSectionAccess()) {
        await sender.sendMessage(chatId, hasFreeManagedSectionAccess(managedSections, "important-laws") ? "القسم متاح مجانًا حاليًا. يمكنك فتحه من القائمة الرئيسة." : "اشتراكك معتمد بالفعل. يمكنك فتح القسم الآن.", mainMenu());
        return;
      }
      await sender.sendMessage(chatId, "اختر طريقة التحويل التي استخدمتها ليُرفق نوع التحويل وبياناته مع طلبك المرسل إلى الإدارة.", importantYemeniLawsPaymentMethodMenu());
      return;
    }
    if (data.startsWith("premium:request:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يمكن إرسال طلب الاشتراك من المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      const scope = data.slice("premium:request:".length) as TelegramPaidAccessScope;
      if (scope !== "sharia_exams" && scope !== "secondary_exams") return;
      const sectionKey = scope === "secondary_exams" ? "secondary-exams" : "exams";
      if (hasFreeManagedSectionAccess(managedSections, sectionKey)) {
        await sender.sendMessage(chatId, "هذا القسم متاح مجانًا حاليًا. افتحه مباشرة من القائمة الرئيسة.", mainMenu());
        return;
      }
      if (await store.hasReferralPremiumAccess(telegramUserId, scope)) {
        await sender.sendMessage(chatId, "لديك وصول فعّال بالفعل. يمكنك فتح الاختبارات الآن من القائمة الرئيسة.", mainMenu());
        return;
      }
      await sender.sendMessage(chatId, "اختر طريقة التحويل التي استخدمتها ليُرفق نوع التحويل وبياناته مع طلبك المرسل إلى الإدارة.", paidExamPaymentMethodMenu(scope));
      return;
    }
    if (data.startsWith("important-laws:payment:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يمكن إرسال طلب الاشتراك من المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      if (await hasImportantLawsSectionAccess()) {
        await sender.sendMessage(chatId, hasFreeManagedSectionAccess(managedSections, "important-laws") ? "القسم متاح مجانًا حاليًا. يمكنك فتحه من القائمة الرئيسة." : "اشتراكك معتمد بالفعل. يمكنك فتح القسم الآن.", mainMenu());
        return;
      }
      const paymentMethod = data.slice("important-laws:payment:".length) as ImportantYemeniLawsPaymentMethod;
      if (!(paymentMethod in importantYemeniLawsPaymentMethods)) return;
      const requesterIdentity = {
        telegramUserId,
        telegramUsername: callback.from?.username,
        telegramFirstName: callback.from?.first_name,
        telegramLastName: callback.from?.last_name,
        paymentMethod,
        accessScope: "important_laws" as const,
      };
      pendingImportantLawsPaymentProofs.set(telegramUserId, {
        expiresAt: Date.now() + IMPORTANT_LAWS_PAYMENT_PROOF_TIMEOUT_MS,
        identity: requesterIdentity,
      });
      await sender.sendMessage(chatId, "أرسل الآن صورة واضحة لإثبات الإيداع. ستُرسل الصورة إلى إدارة البوت فقط مع طلب اشتراكك، وتنتهي مهلة الإرسال بعد 15 دقيقة.");
      return;
    }
    if (data.startsWith("premium:payment:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId, "يمكن إرسال طلب الاشتراك من المحادثة الخاصة مع البوت فقط.", mainMenu());
        return;
      }
      const [, , rawScope, rawPaymentMethod] = data.split(":");
      const accessScope = rawScope as TelegramPaidAccessScope;
      const paymentMethod = rawPaymentMethod as ImportantYemeniLawsPaymentMethod;
      if ((accessScope !== "sharia_exams" && accessScope !== "secondary_exams") || !(paymentMethod in importantYemeniLawsPaymentMethods)) return;
      pendingImportantLawsPaymentProofs.set(telegramUserId, {
        expiresAt: Date.now() + IMPORTANT_LAWS_PAYMENT_PROOF_TIMEOUT_MS,
        identity: {
          telegramUserId,
          telegramUsername: callback.from?.username,
          telegramFirstName: callback.from?.first_name,
          telegramLastName: callback.from?.last_name,
          paymentMethod,
          accessScope,
        },
      });
      await sender.sendMessage(chatId, "أرسل الآن صورة واضحة لإثبات الإيداع. ستُرسل الصورة إلى إدارة البوت فقط مع طلب اشتراكك، وتنتهي مهلة الإرسال بعد 15 دقيقة.");
      return;
    }
    if (data === "support") {
      await promptSupport(chatId, sender);
      return;
    }
    if (data === "help") {
      await sender.sendMessage(chatId, helpText(messageContent("help")), mainMenu());
      return;
    }
    if (data === "about") {
      await sender.sendMessage(chatId, aboutText(messageContent("about")), mainMenu());
      return;
    }
    if (data.startsWith("category:")) {
      const [categoryValue, pageValue] = data.slice("category:".length).split(":");
      const category = categoryValue as LegalCategory;
      const page = Number(pageValue ?? "1");
      if (legalCategories.includes(category)) {
        await sendSourcesForCategory(chatId, category, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("index:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendJudicialFolder(chatId, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("lindex:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendLegislationFolder(chatId, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("ayindex:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendAllYemeniLawsFolder(chatId, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("ylindex:")) {
      if (!(await hasImportantLawsSectionAccess())) {
        await sender.sendMessage(chatId, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendImportantYemeniLawsFolder(chatId, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("findex:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendLegalFormsFolder(chatId, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("vindex:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendIllustratedLegalFormsFolder(chatId, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("rindex:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendFeaturedReferencesFolder(chatId, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("iindex:")) {
      if (!(await hasImportantLawsSectionAccess())) {
        await sender.sendMessage(chatId, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendImportantYemeniLawsFolder(chatId, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("ltype:")) {
      const [, documentTypeValue, pageValue] = data.split(":");
      const documentType = documentTypeValue as keyof typeof legislationDocumentTypeLabels;
      const page = Number(pageValue ?? "1");
      if (documentType in legislationDocumentTypeLabels) {
        await sendLegislationType(chatId, documentType, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("lyear:")) {
      const [, yearValue, pageValue] = data.split(":");
      const year = Number(yearValue);
      const page = Number(pageValue ?? "1");
      if (Number.isInteger(year) && year >= 1900 && year <= 2200) {
        await sendLegislationYear(chatId, year, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("jfile:")) {
      const [, sourceValue, folderId, pageValue] = data.split(":");
      const sourceId = Number(sourceValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      if (source) await store.recordUsage(telegramUserId, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("lfile:")) {
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      if (source) await store.recordUsage(telegramUserId, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("ayfile:")) {
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      if (source?.collection !== "all_yemeni_laws") return;
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      await store.recordUsage(telegramUserId, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("ylfile:")) {
      if (!(await hasImportantLawsSectionAccess())) {
        await sender.sendMessage(chatId, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      if (source?.collection !== "important_yemeni_laws") return;
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      if (source) await store.recordUsage(telegramUserId, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("rfile:")) {
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      if (source) await store.recordUsage(telegramUserId, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("fform:")) {
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      if (source) await store.recordUsage(telegramUserId, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("vfile:")) {
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      if (source?.collection !== "illustrated_legal_forms") return;
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      await store.recordUsage(telegramUserId, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("ifile:")) {
      if (!(await hasImportantLawsSectionAccess())) {
        await sender.sendMessage(chatId, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      if (source?.collection !== "important_yemeni_laws") return;
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      await store.recordUsage(telegramUserId, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("jresult:")) {
      const [, sessionValue, pageValue] = data.split(":");
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await sendJudicialSearchResults(chatId, sessionId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("lresult:")) {
      const [, sessionValue, pageValue] = data.split(":");
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await sendLegislationSearchResults(chatId, sessionId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("ayresult:")) {
      const [, sessionValue, pageValue] = data.split(":");
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await sendAllYemeniLawsSearchResults(chatId, sessionId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("bresult:")) {
      const [, sessionValue, pageValue] = data.split(":");
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await sendLibrarySearchResults(chatId, sessionId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("jresultfile:")) {
      const [, sourceValue, sessionValue, pageValue] = data.split(":");
      const sourceId = Number(sourceValue);
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sourceId) || sourceId < 1 || !Number.isInteger(sessionId) || sessionId < 1) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      return;
    }
    if (data.startsWith("lresultfile:")) {
      const [, sourceValue, sessionValue] = data.split(":");
      const sourceId = Number(sourceValue);
      const sessionId = Number(sessionValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !Number.isInteger(sessionId) || sessionId < 1) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      return;
    }
    if (data.startsWith("ayresultfile:")) {
      const [, sourceValue, sessionValue] = data.split(":");
      const sourceId = Number(sourceValue);
      const sessionId = Number(sessionValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !Number.isInteger(sessionId) || sessionId < 1) return;
      const source = await store.getSource(sourceId);
      if (source?.collection !== "all_yemeni_laws") return;
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
      return;
    }
    if (data.startsWith("source:")) {
      const sourceId = Number(data.slice("source:".length));
      if (!Number.isInteger(sourceId) || sourceId < 1) return;
      const source = await store.getSource(sourceId);
      if (source?.collection === "important_yemeni_laws" && !(await hasImportantLawsSectionAccess())) {
        await sender.sendMessage(chatId, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      await deliverPrivateDocument(chatId, source, sender, documentProvider);
    }
    return;
  }

  const chatId = update.message?.chat?.id;
  if (!chatId) return;

  const telegramUserId = getTelegramUserId(update, chatId);
  const chatType = update.message?.chat?.type;
  const incomingText = update.message?.text?.trim() ?? "";
  const isStartMessage = incomingText === "/start" || incomingText.startsWith("/start ");
  let isFirstPrivateUse = false;
  let referralRegistration: TelegramReferralRegistrationResult | "existing_user" | "invalid_link" | undefined;
  if (isPrivateChat(chatType)) {
    isFirstPrivateUse = await store.registerSubscriber(String(chatId), telegramUserId, {
      telegramUsername: update.message?.from?.username ?? null,
      telegramFirstName: update.message?.from?.first_name ?? null,
      telegramLastName: update.message?.from?.last_name ?? null,
    });
    const hasReferralPayload = isStartMessage && incomingText.startsWith("/start ref_");
    const referrerTelegramUserId = hasReferralPayload ? referralStartReferrerId(incomingText) : undefined;
    if (hasReferralPayload && !referrerTelegramUserId) referralRegistration = "invalid_link";
    else if (referrerTelegramUserId && !isFirstPrivateUse) referralRegistration = "existing_user";
    else if (referrerTelegramUserId) referralRegistration = await store.createReferral(referrerTelegramUserId, telegramUserId, String(chatId));
    if (referralRegistration) await sender.sendMessage(chatId, referralRegistrationText(referralRegistration));
  }
  const requirements = await getAccessRequirementStatus(telegramUserId, store, membershipChecker);
  if (!areChannelsSubscribed(requirements)) {
    if (isStartMessage && isFirstPrivateUse) {
      await sender.sendMessage(chatId, aboutText());
    }
    await promptAccessRequirements(chatId, sender, requirements);
    return;
  }
  if (!requirements.platformVerified) {
    if (isStartMessage && isFirstPrivateUse) {
      await sender.sendMessage(chatId, aboutText());
    }
    await promptAccessRequirements(chatId, sender, requirements);
    return;
  }
  if (isPrivateChat(chatType)) {
    await qualifyReferralIfEligible(telegramUserId, store, sender);
  }

  const pendingPaymentProof = pendingImportantLawsPaymentProofs.get(telegramUserId);
  if (pendingPaymentProof) {
    if (!isPrivateChat(chatType)) {
      await sender.sendMessage(chatId, "يمكن إرسال صورة إثبات الإيداع من المحادثة الخاصة مع البوت فقط.", mainMenu());
      return;
    }
    if (pendingPaymentProof.expiresAt <= Date.now()) {
      pendingImportantLawsPaymentProofs.delete(telegramUserId);
      await sender.sendMessage(chatId, `انتهت مهلة إرفاق إثبات الإيداع. افتح قسم ${subscriptionRequestLabel(pendingPaymentProof.identity.accessScope, pendingPaymentProof.identity.managedMenuItemId)} وابدأ طلبًا جديدًا.`, mainMenu());
      return;
    }
    const photo = update.message?.photo?.at(-1);
    if (!photo?.file_id) {
      await sender.sendMessage(chatId, "أرسل صورة إثبات الإيداع كصورة داخل المحادثة، وليس كنص أو ملف آخر.");
      return;
    }
    const requesterIdentity = pendingPaymentProof.identity;
    const request = await store.createImportantYemeniLawsSubscriptionRequest(telegramUserId, String(chatId), {
      username: requesterIdentity.telegramUsername ?? undefined,
      firstName: requesterIdentity.telegramFirstName ?? undefined,
      lastName: requesterIdentity.telegramLastName ?? undefined,
      paymentMethod: requesterIdentity.paymentMethod,
      accessScope: requesterIdentity.accessScope,
      managedMenuItemId: requesterIdentity.managedMenuItemId,
    });
    if (!request) {
      await sender.sendMessage(chatId, "تعذر حفظ طلب الاشتراك حاليًا. أعد إرسال صورة الإثبات بعد قليل.");
      return;
    }
    pendingImportantLawsPaymentProofs.delete(telegramUserId);
    if (!request.created) {
      await sender.sendMessage(chatId, "طلب اشتراكك قيد المراجعة بالفعل. ستصلك رسالة عند اعتماد الإدارة للطلب.", mainMenu());
      return;
    }
    await sender.sendMessage(chatId, `تم إرسال طلب الاشتراك وصورة إثبات الإيداع إلى إدارة البوت. طلبك خاص بقسم ${subscriptionRequestLabel(requesterIdentity.accessScope, requesterIdentity.managedMenuItemId)}، وبعد التحقق من التحويل المحلي ستصلك رسالة عند اعتماد الوصول إلى القسم.`, mainMenu());
    const ownerChatId = Number(process.env.TELEGRAM_OWNER_ID ?? "");
    if (Number.isSafeInteger(ownerChatId)) {
      await sender.sendMessage(
        ownerChatId,
          `🔐 طلب اشتراك جديد في ${subscriptionRequestLabel(requesterIdentity.accessScope, requesterIdentity.managedMenuItemId)}\nرقم الطلب: #${request.id}\n${importantYemeniLawsSubscriberText(requesterIdentity)}\n${importantYemeniLawsPaymentMethodText(requesterIdentity.paymentMethod)}\nمعرّف المحادثة: ${chatId}\n\nأُرفقت صورة إثبات الإيداع التالية. تحقق من التحويل المحلي قبل اعتماد الطلب.`,
        importantYemeniLawsApprovalMenu(request.id, requesterIdentity)
      ).catch(() => undefined);
      await sender.sendPhotoByFileId(ownerChatId, photo.file_id, `إثبات إيداع الطلب #${request.id}`).catch(() => undefined);
    }
    return;
  }

  const document = update.message?.document;
  const documentCaption = update.message?.caption?.trim();
  const documentCommand = normalizeCommand(documentCaption ?? "");
  const isOwnerPrivateChat = isPrivateOwnerConversation(telegramUserId, chatType);
  const waitingForBroadcastFile = pendingBroadcastFileUploads.has(telegramUserId);
  if (document && isOwnerPrivateChat && (waitingForBroadcastFile || documentCommand.command === "/broadcastfile")) {
    pendingBroadcastFileUploads.delete(telegramUserId);
    const caption = documentCommand.command === "/broadcastfile" ? documentCommand.query : documentCaption;
    const draft = await store.createBroadcastDraft({
      ownerTelegramUserId: telegramUserId,
      kind: "document",
      fileId: document.file_id,
      fileName: document.file_name,
      caption,
    });
    if (!draft) {
      await sender.sendMessage(chatId, "تعذر حفظ مسودة الملف حاليًا. أعد المحاولة لاحقًا.", mainMenu());
      return;
    }
    await sendBroadcastPreview(chatId, draft, sender);
    return;
  }

  const text = update.message?.text?.trim();
  if (!text) return;

  const { command, query } = normalizeCommand(text);
  if (command === "/start" && query === "groupquiz" && !isPrivateChat(chatType) && chatType !== "channel") {
    await sender.sendMessage(chatId, `🎲 ${CIVIL_LAW_GENERAL_2025_TITLE}\n\nاضغط الزر أدناه لبدء إعداد اختبار المجموعة واختيار مدة السؤال.`, groupExamLaunchMenu());
    return;
  }
  if (command === "/start") {
    await sender.sendMessage(chatId, isFirstPrivateUse ? aboutText(messageContent("about")) : welcomeText(messageContent("welcome")), mainMenu(managedMenuItems, managedSections));
    return;
  }
  if (command === "/startquiz") {
    if (isPrivateChat(chatType) || chatType === "channel") {
      await sender.sendMessage(chatId, "استخدم الأمر /startquiz داخل مجموعة تيليغرام لفتح بطاقة الاختبار الجماعي. بعد اختيار المدة يضغط ثلاثة أعضاء مختلفين «أنا مستعد» لتبدأ الجولة.", mainMenu());
      return;
    }
    await sender.sendMessage(chatId, `🎲 ${CIVIL_LAW_GENERAL_2025_TITLE}\n\nاضغط الزر أدناه لبدء إعداد اختبار المجموعة واختيار مدة السؤال.`, groupExamLaunchMenu());
    return;
  }
  if (command === "/stop") {
    if (!isPrivateChat(chatType)) {
      await sender.sendMessage(chatId, "يتاح إيقاف الاختبار داخل المحادثة الخاصة مع البوت فقط.", mainMenu());
      return;
    }
    const stopped = await store.cancelExamSession(telegramUserId, String(chatId));
    await sendStoppedExamMessage(chatId, stopped, store, sender);
    return;
  }
  if (command === "/newquiz") {
    if (!isPrivateChat(chatType) && chatType !== "channel") {
      await sender.sendMessage(chatId, `🎲 ${CIVIL_LAW_GENERAL_2025_TITLE}\n\nاضغط الزر أدناه لبدء إعداد اختبار المجموعة واختيار مدة السؤال.`, groupExamLaunchMenu());
      return;
    }
    await sender.sendMessage(chatId, quizQuickCommandsText(), civilLawExamMenu());
    return;
  }
  if (command === "/quizzes") {
    await sender.sendMessage(chatId, quizQuickCommandsText(), civilLawExamMenu());
    return;
  }
  if (command === "/help") {
    await sender.sendMessage(chatId, helpText(messageContent("help")), mainMenu());
    return;
  }
  if (command === "/browse") {
    await store.recordUsage(telegramUserId, "browse");
    await sender.sendMessage(chatId, browseText(), categoryMenu());
    return;
  }
  if (command === "/support") {
    if (!query) {
      await promptSupport(chatId, sender);
      return;
    }
    await store.createSupportRequest(telegramUserId, String(chatId), query);
    await store.recordUsage(telegramUserId, "support_request");
    await sender.sendMessage(chatId, "شكرًا لرسالتك. تم حفظ طلبك للمراجعة من إدارة البوت.", supportMenu());
    return;
  }
  if (command === "/stats") {
    if (!isPrivateOwnerConversation(telegramUserId, chatType)) {
      await sender.sendMessage(chatId, "هذا الأمر متاح لمالك البوت داخل محادثته الخاصة فقط.", mainMenu());
      return;
    }
    await sender.sendMessage(chatId, ownerStatisticsText(await store.getOwnerStatistics()), mainMenu());
    return;
  }
  if (command === "/supportrequests") {
    if (!isPrivateOwnerConversation(telegramUserId, chatType)) {
      await sender.sendMessage(chatId, "هذا الأمر متاح لمالك البوت داخل محادثته الخاصة فقط.", mainMenu());
      return;
    }
    await sender.sendMessage(chatId, supportRequestsText(await store.listNewSupportRequests()), mainMenu());
    return;
  }
  if (command === "/importantlawsrequests") {
    if (!isPrivateOwnerConversation(telegramUserId, chatType)) {
      await sender.sendMessage(chatId, "هذا الأمر متاح لمالك البوت داخل محادثته الخاصة فقط.", mainMenu());
      return;
    }
    const requests = await store.listPendingImportantYemeniLawsSubscriptionRequests();
    if (requests.length === 0) {
      await sender.sendMessage(chatId, "🔐 طلبات أهم القوانين اليمنية التفاعلي\n\nلا توجد طلبات اشتراك معلقة حاليًا.", mainMenu());
      return;
    }
    for (const request of requests) {
      await sender.sendMessage(
        chatId,
        `🔐 طلب اشتراك معلق\nرقم الطلب: #${request.id}\n${importantYemeniLawsSubscriberText(request)}\nمعرّف المحادثة: ${request.chatId}`,
        importantYemeniLawsApprovalMenu(request.id, request)
      );
    }
    return;
  }
  if (command === "/broadcast") {
    if (!isOwnerPrivateChat) {
      await sender.sendMessage(chatId, "هذا الأمر متاح لمالك البوت داخل محادثته الخاصة فقط.", mainMenu());
      return;
    }
    if (!query) {
      await sender.sendMessage(chatId, "اكتب الرسالة بعد الأمر مباشرة.\nمثال: /broadcast تمّت إضافة مرجع قانوني جديد إلى المكتبة.", mainMenu());
      return;
    }
    const draft = await store.createBroadcastDraft({ ownerTelegramUserId: telegramUserId, kind: "message", message: query });
    if (!draft) {
      await sender.sendMessage(chatId, "تعذر حفظ مسودة البث حاليًا. أعد المحاولة لاحقًا.", mainMenu());
      return;
    }
    await sendBroadcastPreview(chatId, draft, sender);
    return;
  }
  if (command === "/broadcastfile") {
    if (!isOwnerPrivateChat) {
      await sender.sendMessage(chatId, "هذا الأمر متاح لمالك البوت داخل محادثته الخاصة فقط.", mainMenu());
      return;
    }
    pendingBroadcastFileUploads.add(telegramUserId);
    await sender.sendMessage(chatId, "أرسل الملف الآن في هذه المحادثة الخاصة. يمكنك كتابة وصفه في تعليق الملف. بعد الاستلام ستظهر معاينة وزرا التأكيد أو الإلغاء، ولن يُرسل الملف قبل تأكيدك الصريح.", mainMenu());
    return;
  }
  if (command === "/search") {
    if (!query) {
      await sender.sendMessage(chatId, searchText(), unifiedSearchMenu());
      return;
    }
    const sources = await store.searchSources(query);
    await store.recordUsage(telegramUserId, "search", { query });
    await sender.sendMessage(chatId, searchResultText(query, sources), sourceMenu(sources));
    return;
  }
  if (command === "/qj") {
    await runQuickJudicialSearch(chatId, telegramUserId, query, store, sender);
    return;
  }
  if (command === "/ql") {
    await runQuickLegislationSearch(chatId, telegramUserId, query, store, sender);
    return;
  }
  if (command === "/qyl") {
    await runQuickAllYemeniLawsSearch(chatId, telegramUserId, query, store, sender);
    return;
  }

  if (!text.startsWith("/")) {
    if (isPrivateChat(chatType)) {
      const contractTemplateSession = await store.consumeContractTemplateSearchQuery(String(chatId), text);
      if (contractTemplateSession) {
        await store.recordUsage(telegramUserId, "search", { query: text });
        await sendContractTemplateSearchResults(chatId, contractTemplateSession.id, 1, store, sender);
        return;
      }
    }
    const session = await store.consumeJudicialSearchQuery(String(chatId), text);
    if (session) {
      await store.recordUsage(telegramUserId, "search", { query: text });
      await sendJudicialSearchResults(chatId, session.id, 1, store, sender);
      return;
    }
    const legislationSession = await store.consumeLegislationSearchQuery(String(chatId), text);
    if (legislationSession) {
      await store.recordUsage(telegramUserId, "search", { query: text });
      await sendLegislationSearchResults(chatId, legislationSession.id, 1, store, sender);
      return;
    }
    const allYemeniLawsSession = await store.consumeAllYemeniLawsSearchQuery(String(chatId), text);
    if (allYemeniLawsSession) {
      await store.recordUsage(telegramUserId, "search", { query: text });
      await sendAllYemeniLawsSearchResults(chatId, allYemeniLawsSession.id, 1, store, sender);
      return;
    }
    const librarySession = await store.consumeLibrarySearchQuery(String(chatId), text);
    if (librarySession) {
      await store.recordUsage(telegramUserId, "search", { query: text });
      await sendLibrarySearchResults(chatId, librarySession.id, 1, store, sender);
      return;
    }
  }

  await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.unknownRequest, mainMenu());
}

async function telegramRequest(token: string, method: string, payload: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let body: { ok?: boolean; result?: unknown; description?: string } = {};
  try {
    body = JSON.parse(responseText) as typeof body;
  } catch {
    // Telegram should return JSON, but preserve a safe generic error for malformed responses.
  }
  if (!response.ok) {
    const description = typeof body.description === "string" ? `: ${body.description}` : "";
    throw new Error(`Telegram API request failed with status ${response.status}${description}`);
  }
  if (!body.ok) {
    const description = typeof body.description === "string" ? `: ${body.description}` : "";
    throw new Error(`Telegram API ${method} returned an unsuccessful response${description}`);
  }
  return body.result;
}

async function telegramMultipartRequest(token: string, method: string, form: FormData) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body: form });
  if (!response.ok) throw new Error(`Telegram API request failed with status ${response.status}`);
}

export function createTelegramSender(token: string, replyContext: TelegramReplyContext = {}): TelegramSender {
  const topicPayload = {
    ...(Number.isInteger(replyContext.messageThreadId) ? { message_thread_id: replyContext.messageThreadId } : {}),
    ...(Number.isInteger(replyContext.directMessagesTopicId) ? { direct_messages_topic_id: replyContext.directMessagesTopicId } : {}),
  };
  return {
    async sendMessage(chatId, text, replyMarkup) {
      await telegramRequest(token, "sendMessage", {
        chat_id: chatId,
        ...topicPayload,
        text,
        reply_markup: adaptReplyMarkupForTelegramContext(replyMarkup, replyContext),
      });
    },
    async sendDocument(chatId, document) {
      const form = new FormData();
      const fileBytes = new Uint8Array(document.data.byteLength);
      fileBytes.set(document.data);
      form.set("chat_id", String(chatId));
      if (Number.isInteger(replyContext.messageThreadId)) form.set("message_thread_id", String(replyContext.messageThreadId));
      if (Number.isInteger(replyContext.directMessagesTopicId)) form.set("direct_messages_topic_id", String(replyContext.directMessagesTopicId));
      form.set("caption", document.caption);
      form.set("document", new Blob([fileBytes.buffer], { type: document.contentType }), document.filename);
      await telegramMultipartRequest(token, "sendDocument", form);
    },
    async sendDocumentByFileId(chatId, fileId, caption) {
      await telegramRequest(token, "sendDocument", {
        chat_id: chatId,
        ...topicPayload,
        document: fileId,
        ...(caption ? { caption } : {}),
      });
    },
    async sendPhotoByFileId(chatId, fileId, caption) {
      await telegramRequest(token, "sendPhoto", {
        chat_id: chatId,
        ...topicPayload,
        photo: fileId,
        ...(caption ? { caption } : {}),
      });
    },
    async sendQuizPoll(chatId, poll) {
      const result = await telegramRequest(token, "sendPoll", {
        chat_id: chatId,
        ...topicPayload,
        question: poll.question,
        options: poll.options,
        type: "quiz",
        is_anonymous: false,
        correct_option_id: poll.correctOptionIndex,
        explanation: poll.explanation,
        open_period: poll.openPeriodSeconds,
      }) as { poll?: { id?: string } } | undefined;
      const pollId = result?.poll?.id;
      if (!pollId) throw new Error("Telegram did not return a quiz poll identifier");
      return { pollId };
    },
    async answerCallbackQuery(callbackQueryId, text) {
      await telegramRequest(token, "answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        ...(text ? { text, show_alert: true } : {}),
      });
    },
    async isChatAdministrator(chatId, telegramUserId) {
      try {
        const result = await telegramRequest(token, "getChatMember", {
          chat_id: chatId,
          user_id: telegramUserId,
        }) as { status?: string } | undefined;
        return result?.status === "creator" || result?.status === "administrator";
      } catch {
        return false;
      }
    },
  };
}

export function createTelegramChannelMembershipChecker(token: string): TelegramChannelMembershipChecker {
  return {
    async check(telegramUserId, channelHandle) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7_000);
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: channelHandle, user_id: telegramUserId }),
          signal: controller.signal,
        });
        if (!response.ok) return "unavailable";
        const payload = await response.json() as { ok?: boolean; result?: { status?: string; is_member?: boolean } };
        if (!payload.ok || !payload.result?.status) return "unavailable";
        const status = payload.result.status;
        if (["creator", "administrator", "member"].includes(status)) return "subscribed";
        if (status === "restricted" && payload.result.is_member) return "subscribed";
        return "not_subscribed";
      } catch {
        return "unavailable";
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function isFinalTelegramWebhookUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname === "/api/telegram/webhook";
  } catch {
    return false;
  }
}

export async function synchronizeTelegramConfiguration(config: {
  token?: string;
  webhookUrl?: string;
  webhookSecret?: string;
}) {
  const { token, webhookUrl, webhookSecret } = config;
  if (!token) return;

  await telegramRequest(token, "setMyCommands", { commands: BOT_COMMANDS });
  const ownerTelegramId = Number(process.env.TELEGRAM_OWNER_ID);
  if (Number.isSafeInteger(ownerTelegramId) && ownerTelegramId > 0) {
    await telegramRequest(token, "setMyCommands", {
      commands: [...BOT_COMMANDS, ...OWNER_COMMANDS],
      scope: { type: "chat", chat_id: ownerTelegramId },
    });
  }
  if (isFinalTelegramWebhookUrl(webhookUrl) && webhookSecret) {
    await telegramRequest(token, "setWebhook", {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message", "callback_query", "poll_answer", "poll"],
      drop_pending_updates: false,
    });
  }
}
