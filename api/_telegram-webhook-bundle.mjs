// server/vercelTelegramEntrypoint.ts
import express from "express";

// server/telegramWebhook.ts
import { timingSafeEqual as timingSafeEqual2 } from "node:crypto";

// server/db.ts
import { and, asc, count, desc, eq, gte, gt, inArray, isNotNull, isNull, like, lt, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { boolean, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var legalCategoryValues = ["fiqh", "civil", "commercial", "procedure", "general"];
var legalCollectionValues = ["judicial", "legislation", "yemeni_laws", "legal_forms", "featured_references", "important_yemeni_laws", "illustrated_legal_forms", "all_yemeni_laws"];
var legislationDocumentTypeValues = ["law", "regulation", "decision", "agreement", "treaty", "decree", "other"];
var telegramUsageEventValues = ["browse", "search", "document_request", "support_request"];
var telegramContractTemplateTypeValues = ["civil", "commercial", "labor", "personal", "judicial", "general"];
var legalSources = mysqlTable("legal_sources", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", legalCategoryValues).notNull(),
  collection: mysqlEnum("collection", legalCollectionValues).notNull().default("judicial"),
  sortOrder: int("sortOrder").notNull().default(0),
  driveFileId: varchar("driveFileId", { length: 128 }),
  driveFolderId: varchar("driveFolderId", { length: 128 }),
  folderSortOrder: int("folderSortOrder").notNull().default(0),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  documentType: mysqlEnum("documentType", legislationDocumentTypeValues).notNull().default("other"),
  legislationYear: int("legislationYear"),
  issuingAuthority: varchar("issuingAuthority", { length: 255 }),
  isFeatured: boolean("isFeatured").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var legalFolders = mysqlTable("legal_folders", {
  id: int("id").autoincrement().primaryKey(),
  driveFolderId: varchar("driveFolderId", { length: 128 }).notNull().unique(),
  parentDriveFolderId: varchar("parentDriveFolderId", { length: 128 }),
  collection: mysqlEnum("collection", legalCollectionValues).notNull().default("judicial"),
  name: varchar("name", { length: 255 }).notNull(),
  path: text("path").notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramManagedMenuItems = mysqlTable("telegram_managed_menu_items", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  actionType: mysqlEnum("actionType", ["url", "message", "file"]).notNull(),
  actionValue: text("actionValue").notNull(),
  rowIndex: int("rowIndex").notNull().default(100),
  sortOrder: int("sortOrder").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  accessMode: mysqlEnum("accessMode", ["free", "premium", "hasad"]).notNull().default("free"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramManagedSections = mysqlTable("telegram_managed_sections", {
  id: int("id").autoincrement().primaryKey(),
  sectionKey: varchar("sectionKey", { length: 64 }).notNull().unique(),
  displayLabel: varchar("displayLabel", { length: 128 }),
  enabled: boolean("enabled").notNull().default(true),
  /** تبقى subscription قيمة توافقية قديمة؛ أما الإعدادات الجديدة فتستخدم free أو premium أو hasad. */
  accessMode: mysqlEnum("accessMode", ["subscription", "free", "premium", "hasad"]).notNull().default("subscription"),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramManagedMessageTemplates = mysqlTable("telegram_managed_message_templates", {
  id: int("id").autoincrement().primaryKey(),
  messageKey: varchar("messageKey", { length: 64 }).notNull().unique(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramAdminAuditLogs = mysqlTable("telegram_admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: varchar("adminUserId", { length: 64 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 64 }),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var telegramDocumentFavorites = mysqlTable("telegram_document_favorites", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  sourceId: int("sourceId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({
  uniqueUserSource: uniqueIndex("telegram_document_favorite_unique").on(table.telegramUserId, table.sourceId)
}));
var judicialSearchSessions = mysqlTable("judicial_search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  query: varchar("query", { length: 255 }),
  status: mysqlEnum("status", ["awaiting", "ready"]).notNull().default("awaiting"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var librarySearchSessions = mysqlTable("library_search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  query: varchar("query", { length: 255 }),
  status: mysqlEnum("status", ["awaiting", "ready"]).notNull().default("awaiting"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var legislationSearchSessions = mysqlTable("legislation_search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  query: varchar("query", { length: 255 }),
  status: mysqlEnum("status", ["awaiting", "ready"]).notNull().default("awaiting"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var allYemeniLawsSearchSessions = mysqlTable("all_yemeni_laws_search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  query: varchar("query", { length: 255 }),
  status: mysqlEnum("status", ["awaiting", "ready"]).notNull().default("awaiting"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramContractTemplateSearchSessions = mysqlTable("telegram_contract_template_search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  query: varchar("query", { length: 255 }),
  status: mysqlEnum("status", ["awaiting", "ready"]).notNull().default("awaiting"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramPlatformAccess = mysqlTable("telegram_platform_access", {
  telegramUserId: varchar("telegramUserId", { length: 32 }).primaryKey(),
  confirmedAt: timestamp("confirmedAt").defaultNow().notNull(),
  webAppVerifiedAt: timestamp("webAppVerifiedAt"),
  region: varchar("region", { length: 64 })
});
var telegramHasadAccess = mysqlTable("telegram_hasad_access", {
  telegramUserId: varchar("telegramUserId", { length: 32 }).primaryKey(),
  visitedAt: timestamp("visitedAt").defaultNow().notNull(),
  region: varchar("region", { length: 64 })
});
var telegramVisitEvents = mysqlTable("telegram_visit_events", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  site: mysqlEnum("site", ["platform", "hasad"]).notNull(),
  visitedAt: timestamp("visitedAt").defaultNow().notNull(),
  region: varchar("region", { length: 64 })
}, (table) => ({
  siteVisitedAtIndex: index("telegram_visit_events_site_visited_at").on(table.site, table.visitedAt),
  userVisitedAtIndex: index("telegram_visit_events_user_visited_at").on(table.telegramUserId, table.visitedAt)
}));
var telegramUsageEvents = mysqlTable("telegram_usage_events", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  eventType: mysqlEnum("eventType", telegramUsageEventValues).notNull(),
  sectionKey: varchar("sectionKey", { length: 64 }),
  query: varchar("query", { length: 255 }),
  sourceId: int("sourceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var telegramSupportRequests = mysqlTable("telegram_support_requests", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  chatId: varchar("chatId", { length: 32 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "reviewed"]).notNull().default("new"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var telegramSubscribers = mysqlTable("telegram_subscribers", {
  chatId: varchar("chatId", { length: 32 }).primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  telegramUsername: varchar("telegramUsername", { length: 64 }),
  telegramFirstName: varchar("telegramFirstName", { length: 128 }),
  telegramLastName: varchar("telegramLastName", { length: 128 }),
  subscribedAt: timestamp("subscribedAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().onUpdateNow().notNull()
});
var telegramBroadcasts = mysqlTable("telegram_broadcasts", {
  id: int("id").autoincrement().primaryKey(),
  ownerTelegramUserId: varchar("ownerTelegramUserId", { length: 64 }).notNull(),
  kind: mysqlEnum("kind", ["message", "document"]).notNull(),
  message: text("message"),
  fileId: varchar("fileId", { length: 255 }),
  fileName: varchar("fileName", { length: 255 }),
  caption: text("caption"),
  status: mysqlEnum("status", ["draft", "sending", "sent", "cancelled"]).notNull().default("draft"),
  recipientCount: int("recipientCount").notNull().default(0),
  successCount: int("successCount").notNull().default(0),
  failureCount: int("failureCount").notNull().default(0),
  scheduledFor: timestamp("scheduledFor"),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt")
});
var telegramImportantYemeniLawsAccess = mysqlTable("telegram_important_yemeni_laws_access", {
  telegramUserId: varchar("telegramUserId", { length: 32 }).primaryKey(),
  approvedByTelegramUserId: varchar("approvedByTelegramUserId", { length: 64 }).notNull(),
  approvedAt: timestamp("approvedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramImportantYemeniLawsSubscriptionRequests = mysqlTable("telegram_important_yemeni_laws_subscription_requests", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  chatId: varchar("chatId", { length: 32 }).notNull(),
  accessScope: mysqlEnum("accessScope", ["important_laws", "sharia_exams", "secondary_exams"]).notNull().default("important_laws"),
  managedMenuItemId: int("managedMenuItemId"),
  telegramUsername: varchar("telegramUsername", { length: 64 }),
  telegramFirstName: varchar("telegramFirstName", { length: 128 }),
  telegramLastName: varchar("telegramLastName", { length: 128 }),
  paymentMethod: varchar("paymentMethod", { length: 32 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  reviewedByTelegramUserId: varchar("reviewedByTelegramUserId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastReminderAt: timestamp("lastReminderAt"),
  reviewedAt: timestamp("reviewedAt")
});
var telegramManualPremiumAccess = mysqlTable("telegram_manual_premium_access", {
  telegramUserId: varchar("telegramUserId", { length: 32 }).primaryKey(),
  shariaExamsAccess: boolean("shariaExamsAccess").notNull().default(false),
  secondaryExamsAccess: boolean("secondaryExamsAccess").notNull().default(false),
  approvedByTelegramUserId: varchar("approvedByTelegramUserId", { length: 64 }).notNull(),
  approvedAt: timestamp("approvedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramManagedMenuItemPremiumAccess = mysqlTable("telegram_managed_menu_item_premium_access", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  menuItemId: int("menuItemId").notNull(),
  approvedByTelegramUserId: varchar("approvedByTelegramUserId", { length: 64 }).notNull(),
  approvedAt: timestamp("approvedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  uniqueUserMenuItem: uniqueIndex("telegram_managed_menu_item_premium_access_unique").on(table.telegramUserId, table.menuItemId)
}));
var telegramReferrals = mysqlTable("telegram_referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerTelegramUserId: varchar("referrerTelegramUserId", { length: 32 }).notNull(),
  refereeTelegramUserId: varchar("refereeTelegramUserId", { length: 32 }).notNull(),
  refereeChatId: varchar("refereeChatId", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["pending", "qualified", "rejected"]).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  qualifiedAt: timestamp("qualifiedAt"),
  rejectedAt: timestamp("rejectedAt"),
  rejectionReason: varchar("rejectionReason", { length: 128 })
}, (table) => ({
  uniqueReferee: uniqueIndex("telegram_referrals_unique_referee").on(table.refereeTelegramUserId)
}));
var telegramReferralRewards = mysqlTable("telegram_referral_rewards", {
  id: int("id").autoincrement().primaryKey(),
  referrerTelegramUserId: varchar("referrerTelegramUserId", { length: 32 }).notNull(),
  qualifiedReferralCount: int("qualifiedReferralCount").notNull(),
  status: mysqlEnum("status", ["active", "revoked"]).notNull().default("active"),
  accessStartsAt: timestamp("accessStartsAt").notNull(),
  accessExpiresAt: timestamp("accessExpiresAt").notNull(),
  revokedByAdminUserId: varchar("revokedByAdminUserId", { length: 64 }),
  revokedAt: timestamp("revokedAt"),
  revokeReason: varchar("revokeReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({
  uniqueReferrerMilestone: uniqueIndex("telegram_referral_rewards_unique_milestone").on(table.referrerTelegramUserId, table.qualifiedReferralCount)
}));
var telegramScheduledTasks = mysqlTable("telegram_scheduled_tasks", {
  taskKey: varchar("taskKey", { length: 64 }).primaryKey(),
  taskUid: varchar("taskUid", { length: 65 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramContractTemplates = mysqlTable("telegram_contract_templates", {
  id: int("id").autoincrement().primaryKey(),
  sourceDocumentId: int("sourceDocumentId").notNull().unique(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  content: json("content").$type().notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  contractType: mysqlEnum("contractType", telegramContractTemplateTypeValues).notNull().default("general"),
  isPremium: boolean("isPremium").notNull().default(false),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramExamForms = mysqlTable("telegram_exam_forms", {
  id: int("id").autoincrement().primaryKey(),
  subjectKey: varchar("subjectKey", { length: 64 }).notNull(),
  formKey: varchar("formKey", { length: 64 }).notNull(),
  formName: varchar("formName", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  uniqueSubjectForm: uniqueIndex("telegram_exam_form_unique").on(table.subjectKey, table.formKey)
}));
var telegramExamQuestions = mysqlTable("telegram_exam_questions", {
  id: int("id").autoincrement().primaryKey(),
  sourceQuestionId: varchar("sourceQuestionId", { length: 64 }).notNull().unique(),
  subjectKey: varchar("subjectKey", { length: 64 }).notNull(),
  sectionKey: varchar("sectionKey", { length: 64 }).notNull(),
  questionText: text("questionText").notNull(),
  optionA: text("optionA").notNull(),
  optionB: text("optionB").notNull(),
  optionC: text("optionC").notNull(),
  optionD: text("optionD").notNull(),
  correctOption: mysqlEnum("correctOption", ["A", "B", "C", "D"]).notNull(),
  explanation: text("explanation").notNull(),
  hint: text("hint"),
  sortOrder: int("sortOrder").notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramExamSessions = mysqlTable("telegram_exam_sessions", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  chatId: varchar("chatId", { length: 32 }).notNull(),
  subjectKey: varchar("subjectKey", { length: 64 }).notNull(),
  sectionKey: varchar("sectionKey", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).notNull().default("active"),
  questionIndex: int("questionIndex").notNull().default(0),
  score: int("score").notNull().default(0),
  incorrectCount: int("incorrectCount").notNull().default(0),
  missedCount: int("missedCount").notNull().default(0),
  timeLimitSeconds: int("timeLimitSeconds").notNull().default(30),
  activePollId: varchar("activePollId", { length: 128 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramGroupExamRounds = mysqlTable("telegram_group_exam_rounds", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull(),
  creatorTelegramUserId: varchar("creatorTelegramUserId", { length: 32 }),
  subjectKey: varchar("subjectKey", { length: 64 }).notNull(),
  sectionKey: varchar("sectionKey", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["waiting", "active", "completed", "cancelled"]).notNull().default("waiting"),
  questionIndex: int("questionIndex").notNull().default(0),
  timeLimitSeconds: int("timeLimitSeconds").notNull().default(30),
  activePollId: varchar("activePollId", { length: 128 }),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var telegramGroupExamParticipants = mysqlTable("telegram_group_exam_participants", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("roundId").notNull(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  username: varchar("username", { length: 64 }),
  score: int("score").notNull().default(0),
  incorrectCount: int("incorrectCount").notNull().default(0),
  missedCount: int("missedCount").notNull().default(0),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  uniqueRoundParticipant: uniqueIndex("telegram_group_exam_participant_unique").on(table.roundId, table.telegramUserId)
}));
var telegramGroupExamAnswers = mysqlTable("telegram_group_exam_answers", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("roundId").notNull(),
  questionIndex: int("questionIndex").notNull(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  answer: mysqlEnum("answer", ["A", "B", "C", "D"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  uniqueRoundQuestionParticipant: uniqueIndex("telegram_group_exam_answer_unique").on(table.roundId, table.questionIndex, table.telegramUserId)
}));

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
function normalizeManagedMenuItem(input) {
  const label = input.label?.trim().slice(0, 128);
  const actionValue = input.actionValue?.trim().slice(0, 4e3);
  const actionType = input.actionType;
  if (!label || !actionValue || actionType !== "url" && actionType !== "message" && actionType !== "file") return void 0;
  if (actionType === "url") {
    try {
      const parsed = new URL(actionValue);
      if (!["https:", "tg:"].includes(parsed.protocol)) return void 0;
    } catch {
      return void 0;
    }
  }
  if (actionType === "file" && !actionValue.startsWith("/manus-storage/")) return void 0;
  return {
    label,
    actionType,
    actionValue,
    rowIndex: Math.min(999, Math.max(0, Math.trunc(Number(input.rowIndex) || 100))),
    sortOrder: Math.min(9999, Math.max(0, Math.trunc(Number(input.sortOrder) || 0))),
    enabled: input.enabled !== false,
    accessMode: input.accessMode === "premium" ? "premium" : input.accessMode === "hasad" ? "hasad" : "free"
  };
}
async function listManagedTelegramMenuItems(includeDisabled = false) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(telegramManagedMenuItems);
  return (includeDisabled ? query : query.where(eq(telegramManagedMenuItems.enabled, true))).orderBy(asc(telegramManagedMenuItems.rowIndex), asc(telegramManagedMenuItems.sortOrder), asc(telegramManagedMenuItems.id));
}
async function createManagedTelegramMenuItem(input, adminUserId) {
  const db = await getDb();
  const normalized = normalizeManagedMenuItem(input);
  if (!db || !normalized || !adminUserId) return void 0;
  const result = await db.insert(telegramManagedMenuItems).values(normalized);
  const id = Number(result[0]?.insertId ?? 0);
  const item = (await db.select().from(telegramManagedMenuItems).where(eq(telegramManagedMenuItems.id, id)).limit(1))[0];
  if (item) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "create", entityType: "menu_item", entityId: String(item.id), details: normalized });
  return item;
}
async function updateManagedTelegramMenuItem(id, input, adminUserId) {
  const db = await getDb();
  const normalized = normalizeManagedMenuItem(input);
  if (!db || !normalized || !adminUserId || !Number.isInteger(id) || id < 1) return void 0;
  await db.update(telegramManagedMenuItems).set(normalized).where(eq(telegramManagedMenuItems.id, id));
  const item = (await db.select().from(telegramManagedMenuItems).where(eq(telegramManagedMenuItems.id, id)).limit(1))[0];
  if (item) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "update", entityType: "menu_item", entityId: String(item.id), details: normalized });
  return item;
}
async function deleteManagedTelegramMenuItem(id, adminUserId) {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(id) || id < 1) return false;
  const item = (await db.select().from(telegramManagedMenuItems).where(eq(telegramManagedMenuItems.id, id)).limit(1))[0];
  if (!item) return false;
  await db.delete(telegramManagedMenuItems).where(eq(telegramManagedMenuItems.id, id));
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "delete", entityType: "menu_item", entityId: String(id), details: { label: item.label } });
  return true;
}
var managedTelegramSectionDefaults = [
  { sectionKey: "browse", displayLabel: "\u{1F4DA} \u062A\u0635\u0641\u062D \u0627\u0644\u0645\u0643\u062A\u0628\u0629", sortOrder: 10 },
  { sectionKey: "search", displayLabel: "\u{1F50E} \u0628\u062D\u062B \u0645\u0648\u062D\u0651\u062F", sortOrder: 20 },
  { sectionKey: "judicial", displayLabel: "\u2696\uFE0F \u0642\u0648\u0627\u0639\u062F \u0642\u0636\u0627\u0626\u064A\u0629", sortOrder: 30 },
  { sectionKey: "legislation", displayLabel: "\u{1F4DC} \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", sortOrder: 40 },
  { sectionKey: "important-laws", displayLabel: "\u{1F510} \u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A", sortOrder: 50 },
  { sectionKey: "legal-forms", displayLabel: "\u{1F4DD} \u0646\u0645\u0627\u0630\u062C \u0648\u0635\u064A\u063A \u0642\u0627\u0646\u0648\u0646\u064A\u0629", sortOrder: 60 },
  { sectionKey: "illustrated-legal-forms", displayLabel: "\u{1F5BC} \u0646\u0645\u0627\u0630\u062C \u0645\u0635\u0648\u0631\u0629 \u0648\u0641\u0642 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629", sortOrder: 70 },
  { sectionKey: "contract-templates", displayLabel: "\u{1F4C4} \u0635\u064A\u063A \u0648\u0639\u0642\u0648\u062F \u0642\u0627\u0646\u0648\u0646\u064A\u0629", sortOrder: 80 },
  { sectionKey: "exams", displayLabel: "\u{1F4DD} \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646", sortOrder: 90 },
  { sectionKey: "secondary-exams", displayLabel: "\u{1F9EE} \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629", sortOrder: 100 },
  { sectionKey: "latest", displayLabel: "\u{1F195} \u0623\u062D\u062F\u062B \u0627\u0644\u0625\u0636\u0627\u0641\u0627\u062A", sortOrder: 110 },
  { sectionKey: "popular", displayLabel: "\u2B50 \u0627\u0644\u0623\u0643\u062B\u0631 \u0637\u0644\u0628\u064B\u0627", sortOrder: 120 },
  { sectionKey: "favorites", displayLabel: "\u2B50 \u0645\u0641\u0636\u0644\u062A\u064A", sortOrder: 130 },
  { sectionKey: "featured", displayLabel: "\u{1F4CC} \u0645\u0631\u0627\u062C\u0639 \u0645\u0645\u064A\u0632\u0629", sortOrder: 140 },
  { sectionKey: "support", displayLabel: "\u{1F4AC} \u062A\u0648\u0627\u0635\u0644 \u0648\u062F\u0639\u0645", sortOrder: 150 }
];
var subscriptionManagedTelegramSectionKeys = ["important-laws", "exams", "secondary-exams", "judicial", "contract-templates"];
async function listManagedTelegramSections() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(telegramManagedSections).orderBy(asc(telegramManagedSections.sortOrder), asc(telegramManagedSections.id));
}
async function listManagedTelegramSectionConfigs() {
  const saved = await listManagedTelegramSections();
  const byKey = new Map(saved.map((section) => [section.sectionKey, section]));
  return managedTelegramSectionDefaults.map((defaults) => {
    const override = byKey.get(defaults.sectionKey);
    return {
      sectionKey: defaults.sectionKey,
      displayLabel: override?.displayLabel?.trim() || defaults.displayLabel,
      enabled: override?.enabled ?? true,
      accessMode: override?.accessMode === "free" || override?.accessMode === "premium" || override?.accessMode === "hasad" ? override.accessMode : defaults.sectionKey === "judicial" || defaults.sectionKey === "contract-templates" ? "hasad" : "premium",
      sortOrder: override?.sortOrder ?? defaults.sortOrder
    };
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.sectionKey.localeCompare(right.sectionKey));
}
async function updateManagedTelegramSection(sectionKey, input, adminUserId) {
  const defaults = managedTelegramSectionDefaults.find((section) => section.sectionKey === sectionKey);
  const db = await getDb();
  if (!db || !defaults || !adminUserId) return void 0;
  const displayLabel = input.displayLabel?.trim().slice(0, 128) || defaults.displayLabel;
  const enabled = input.enabled !== false;
  const canManageAccess = subscriptionManagedTelegramSectionKeys.includes(sectionKey);
  const accessMode = canManageAccess && (input.accessMode === "free" || input.accessMode === "premium" || input.accessMode === "hasad") ? input.accessMode : sectionKey === "judicial" || sectionKey === "contract-templates" ? "hasad" : "premium";
  const sortOrder = Math.min(9999, Math.max(0, Math.trunc(Number(input.sortOrder) || defaults.sortOrder)));
  await db.insert(telegramManagedSections).values({ sectionKey, displayLabel, enabled, accessMode, sortOrder }).onDuplicateKeyUpdate({ set: { displayLabel, enabled, accessMode, sortOrder } });
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "update", entityType: "section", entityId: sectionKey, details: { displayLabel, enabled, accessMode, sortOrder } });
  return { sectionKey: defaults.sectionKey, displayLabel, enabled, accessMode, sortOrder };
}
async function listTelegramAdminAuditLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit) || 50));
  return db.select({
    id: telegramAdminAuditLogs.id,
    action: telegramAdminAuditLogs.action,
    entityType: telegramAdminAuditLogs.entityType,
    entityId: telegramAdminAuditLogs.entityId,
    createdAt: telegramAdminAuditLogs.createdAt
  }).from(telegramAdminAuditLogs).orderBy(desc(telegramAdminAuditLogs.createdAt), desc(telegramAdminAuditLogs.id)).limit(safeLimit);
}
var managedTelegramMessageDefaults = [
  { messageKey: "welcome", title: "\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062A\u0631\u062D\u064A\u0628", content: "\u{1F3DB} \u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643 \u0641\u064A \u0628\u0648\u062A \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\n\n\u0645\u0646\u0635\u0629 \u0631\u0642\u0645\u064A\u0629 \u0645\u062A\u062E\u0635\u0635\u0629 \u062A\u0647\u062F\u0641 \u0625\u0644\u0649 \u062A\u064A\u0633\u064A\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0648\u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0648\u0627\u0644\u0641\u0642\u0647\u064A\u0629 \u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0648\u0627\u0644\u0628\u0627\u062D\u062B\u064A\u0646.\n\n\u0627\u062E\u062A\u0631 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0623\u062F\u0646\u0627\u0647 \u0644\u0644\u0628\u062F\u0621:" },
  { messageKey: "about", title: "\u0631\u0633\u0627\u0644\u0629 \u0639\u0646 \u0627\u0644\u0645\u0643\u062A\u0628\u0629", content: "\u2139\uFE0F \u0639\u0646 \u0628\u0648\u062A \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\n\n\u0645\u0646\u0635\u0629 \u0645\u0639\u0631\u0641\u064A\u0629 \u0648\u062A\u0639\u0644\u064A\u0645\u064A\u0629 \u0628\u0625\u0634\u0631\u0627\u0641 \u0623. \u0645\u0639\u064A\u0646 \u0627\u0644\u0646\u0627\u0635\u0631\u060C \u062A\u062A\u064A\u062D \u0644\u0644\u0637\u0644\u0627\u0628 \u0648\u0627\u0644\u0628\u0627\u062D\u062B\u064A\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0645\u0646\u0638\u0645 \u0625\u0644\u0649 \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0648\u0627\u0644\u0641\u0642\u0647\u064A\u0629\u060C \u0648\u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0648\u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629\u060C \u0648\u0627\u0644\u0627\u0633\u062A\u0641\u0627\u062F\u0629 \u0645\u0646 \u0646\u0645\u0627\u0630\u062C \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0644\u0645\u062E\u062A\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0648\u064A\u0627\u062A \u0648\u0627\u0644\u0645\u0648\u0627\u062F.\n\n\u0635\u064F\u0645\u0645\u062A \u0627\u0644\u0645\u0646\u0635\u0629 \u0644\u062A\u0633\u0647\u064A\u0644 \u0627\u0644\u062A\u0639\u0644\u0645 \u0648\u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 \u0625\u0644\u0649 \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0641\u064A \u0645\u0643\u0627\u0646 \u0648\u0627\u062D\u062F.\n\n\u2696\uFE0F \u0647\u0630\u0627 \u0627\u0644\u0628\u0648\u062A \u0645\u0628\u0627\u062F\u0631\u0629 \u062A\u0639\u0644\u064A\u0645\u064A\u0629 \u0645\u0633\u062A\u0642\u0644\u0629\u060C \u0648\u0644\u0627 \u064A\u0645\u062B\u0644 \u062C\u0647\u0629 \u062D\u0643\u0648\u0645\u064A\u0629 \u0623\u0648 \u062C\u0627\u0645\u0639\u0629 \u0631\u0633\u0645\u064A\u0629." },
  { messageKey: "help", title: "\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629", content: "\u2753 \u062F\u0644\u064A\u0644 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0648\u0627\u0644\u062F\u0639\u0645:\n\u2022 /start - \u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629.\n\u2022 /browse - \u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0648\u0627\u0644\u062A\u0635\u0646\u064A\u0641\u0627\u062A.\n\u2022 /search - \u0641\u062A\u062D \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0645\u0648\u062D\u062F \u0623\u0648 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0641\u064A \u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629.\n\u2022 /support \u0631\u0633\u0627\u0644\u062A\u0643 - \u0625\u0631\u0633\u0627\u0644 \u0627\u0642\u062A\u0631\u0627\u062D \u0623\u0648 \u0637\u0644\u0628 \u062F\u0639\u0645 \u0625\u0644\u0649 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A.\n\u{1F4E9} \u0644\u0627 \u062A\u064F\u0646\u0634\u0631 \u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u062F\u0639\u0645 \u0641\u064A \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A\u061B \u062A\u062D\u0641\u0638 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0646 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A." }
];
async function listManagedTelegramMessageTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(telegramManagedMessageTemplates).orderBy(asc(telegramManagedMessageTemplates.messageKey));
}
async function listManagedTelegramMessageConfigs() {
  const saved = await listManagedTelegramMessageTemplates();
  const byKey = new Map(saved.map((template) => [template.messageKey, template]));
  return managedTelegramMessageDefaults.map((defaults) => ({ ...defaults, content: byKey.get(defaults.messageKey)?.content || defaults.content }));
}
async function updateManagedTelegramMessageTemplate(messageKey, content, adminUserId) {
  const defaults = managedTelegramMessageDefaults.find((template) => template.messageKey === messageKey);
  const db = await getDb();
  const normalizedContent = typeof content === "string" ? content.trim().slice(0, 4e3) : "";
  if (!db || !defaults || !adminUserId || !normalizedContent) return void 0;
  await db.insert(telegramManagedMessageTemplates).values({ messageKey, content: normalizedContent }).onDuplicateKeyUpdate({ set: { content: normalizedContent } });
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "update", entityType: "message_template", entityId: messageKey, details: { length: normalizedContent.length } });
  return { messageKey: defaults.messageKey, title: defaults.title, content: normalizedContent };
}
async function listTelegramContractTemplates(page = 1, pageSize = 8) {
  const db = await getDb();
  if (!db) return { templates: [], total: 0 };
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(12, Math.max(1, pageSize));
  const [templates, totalResult] = await Promise.all([
    db.select().from(telegramContractTemplates).where(eq(telegramContractTemplates.isActive, true)).orderBy(asc(telegramContractTemplates.sortOrder), asc(telegramContractTemplates.id)).limit(safePageSize).offset((safePage - 1) * safePageSize),
    db.select({ count: count() }).from(telegramContractTemplates).where(eq(telegramContractTemplates.isActive, true))
  ]);
  return { templates, total: Number(totalResult[0]?.count ?? 0) };
}
async function listTelegramContractTemplateTypes() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ contractType: telegramContractTemplates.contractType, count: count() }).from(telegramContractTemplates).where(eq(telegramContractTemplates.isActive, true)).groupBy(telegramContractTemplates.contractType).orderBy(asc(telegramContractTemplates.contractType));
  return rows.map((row) => ({ contractType: row.contractType, count: Number(row.count) }));
}
async function listTelegramContractTemplatesByType(contractType, page = 1, pageSize = 8) {
  const db = await getDb();
  if (!db) return { templates: [], total: 0 };
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(12, Math.max(1, pageSize));
  const filter = and(eq(telegramContractTemplates.isActive, true), eq(telegramContractTemplates.contractType, contractType));
  const [templates, totalResult] = await Promise.all([
    db.select().from(telegramContractTemplates).where(filter).orderBy(asc(telegramContractTemplates.sortOrder), asc(telegramContractTemplates.id)).limit(safePageSize).offset((safePage - 1) * safePageSize),
    db.select({ count: count() }).from(telegramContractTemplates).where(filter)
  ]);
  return { templates, total: Number(totalResult[0]?.count ?? 0) };
}
async function getTelegramContractTemplate(id) {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1) return void 0;
  const rows = await db.select().from(telegramContractTemplates).where(and(eq(telegramContractTemplates.id, id), eq(telegramContractTemplates.isActive, true))).limit(1);
  return rows[0];
}
var CONTRACT_TEMPLATE_SEARCH_PAGE_SIZE = 8;
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function hasConfirmedTelegramPlatformAccess(telegramUserId) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ webAppVerifiedAt: telegramPlatformAccess.webAppVerifiedAt }).from(telegramPlatformAccess).where(eq(telegramPlatformAccess.telegramUserId, telegramUserId)).limit(1);
  return Boolean(result[0]?.webAppVerifiedAt);
}
async function confirmTelegramPlatformAccess(telegramUserId, region) {
  const db = await getDb();
  if (!db) {
    throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627");
  }
  const confirmedAt = /* @__PURE__ */ new Date();
  await Promise.all([
    db.insert(telegramPlatformAccess).values({ telegramUserId, confirmedAt, webAppVerifiedAt: confirmedAt, region: region ?? null }).onDuplicateKeyUpdate({
      set: { confirmedAt, webAppVerifiedAt: confirmedAt, region: region ?? null }
    }),
    db.insert(telegramVisitEvents).values({ telegramUserId, site: "platform", visitedAt: confirmedAt, region: region ?? null })
  ]);
  const result = await db.select().from(telegramPlatformAccess).where(eq(telegramPlatformAccess.telegramUserId, telegramUserId)).limit(1);
  const access = result[0];
  if (!access) {
    throw new Error("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u062A\u0623\u0643\u064A\u062F \u0641\u062A\u062D \u0627\u0644\u0645\u0646\u0635\u0629");
  }
  return access;
}
async function hasConfirmedTelegramHasadAccess(telegramUserId) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ telegramUserId: telegramHasadAccess.telegramUserId }).from(telegramHasadAccess).where(eq(telegramHasadAccess.telegramUserId, telegramUserId)).limit(1);
  return result.length > 0;
}
async function confirmTelegramHasadAccess(telegramUserId, region) {
  const db = await getDb();
  if (!db) throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627");
  const visitedAt = /* @__PURE__ */ new Date();
  await Promise.all([
    db.insert(telegramHasadAccess).values({ telegramUserId, visitedAt, region: region ?? null }).onDuplicateKeyUpdate({
      set: { visitedAt, region: region ?? null }
    }),
    db.insert(telegramVisitEvents).values({ telegramUserId, site: "hasad", visitedAt, region: region ?? null })
  ]);
}
async function hasImportantYemeniLawsAccess(telegramUserId) {
  const db = await getDb();
  if (!db) return false;
  const [permanentAccess, referralAccess] = await Promise.all([
    db.select({ telegramUserId: telegramImportantYemeniLawsAccess.telegramUserId }).from(telegramImportantYemeniLawsAccess).where(eq(telegramImportantYemeniLawsAccess.telegramUserId, telegramUserId)).limit(1),
    db.select({ id: telegramReferralRewards.id }).from(telegramReferralRewards).where(and(eq(telegramReferralRewards.referrerTelegramUserId, telegramUserId), eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, /* @__PURE__ */ new Date()))).limit(1)
  ]);
  return permanentAccess.length > 0 || referralAccess.length > 0;
}
async function hasTelegramPremiumAccess(telegramUserId, scope) {
  const db = await getDb();
  if (!db) return false;
  const [referralAccess, manualAccess] = await Promise.all([
    db.select({ id: telegramReferralRewards.id }).from(telegramReferralRewards).where(and(eq(telegramReferralRewards.referrerTelegramUserId, telegramUserId), eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, /* @__PURE__ */ new Date()))).limit(1),
    db.select({ shariaExamsAccess: telegramManualPremiumAccess.shariaExamsAccess, secondaryExamsAccess: telegramManualPremiumAccess.secondaryExamsAccess }).from(telegramManualPremiumAccess).where(eq(telegramManualPremiumAccess.telegramUserId, telegramUserId)).limit(1)
  ]);
  if (referralAccess.length > 0) return true;
  return scope === "sharia_exams" ? Boolean(manualAccess[0]?.shariaExamsAccess) : Boolean(manualAccess[0]?.secondaryExamsAccess);
}
async function hasManagedTelegramMenuItemPremiumAccess(telegramUserId, menuItemId) {
  const db = await getDb();
  if (!db || !Number.isInteger(menuItemId) || menuItemId < 1) return false;
  const [referralAccess, manualAccess] = await Promise.all([
    db.select({ id: telegramReferralRewards.id }).from(telegramReferralRewards).where(and(eq(telegramReferralRewards.referrerTelegramUserId, telegramUserId), eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, /* @__PURE__ */ new Date()))).limit(1),
    db.select({ id: telegramManagedMenuItemPremiumAccess.id }).from(telegramManagedMenuItemPremiumAccess).where(and(eq(telegramManagedMenuItemPremiumAccess.telegramUserId, telegramUserId), eq(telegramManagedMenuItemPremiumAccess.menuItemId, menuItemId))).limit(1)
  ]);
  return referralAccess.length > 0 || manualAccess.length > 0;
}
var TELEGRAM_REFERRAL_REQUIRED_COUNT = 5;
var TELEGRAM_REFERRAL_QUALIFICATION_DELAY_MS = 24 * 60 * 60 * 1e3;
function addOneCalendarMonth(date) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}
async function createTelegramReferral(referrerTelegramUserId, refereeTelegramUserId, refereeChatId) {
  const db = await getDb();
  if (!db || !referrerTelegramUserId || !refereeTelegramUserId) return "unavailable";
  if (referrerTelegramUserId === refereeTelegramUserId) return "self_referral";
  const referrer = await db.select({ telegramUserId: telegramSubscribers.telegramUserId }).from(telegramSubscribers).where(eq(telegramSubscribers.telegramUserId, referrerTelegramUserId)).limit(1);
  if (!referrer[0]) return "referrer_not_found";
  try {
    await db.insert(telegramReferrals).values({ referrerTelegramUserId, refereeTelegramUserId, refereeChatId });
    return "created";
  } catch (error) {
    const code = error?.code;
    return code === "ER_DUP_ENTRY" ? "already_referred" : "unavailable";
  }
}
async function qualifyTelegramReferral(refereeTelegramUserId) {
  const db = await getDb();
  if (!db || !refereeTelegramUserId) return { qualified: false };
  const referral = (await db.select().from(telegramReferrals).where(and(eq(telegramReferrals.refereeTelegramUserId, refereeTelegramUserId), eq(telegramReferrals.status, "pending"))).limit(1))[0];
  if (!referral || referral.createdAt.getTime() + TELEGRAM_REFERRAL_QUALIFICATION_DELAY_MS > Date.now()) return { qualified: false };
  const verifiedPlatform = await db.select({ telegramUserId: telegramPlatformAccess.telegramUserId }).from(telegramPlatformAccess).where(and(eq(telegramPlatformAccess.telegramUserId, refereeTelegramUserId), isNotNull(telegramPlatformAccess.webAppVerifiedAt))).limit(1);
  if (!verifiedPlatform[0]) return { qualified: false };
  const update = await db.update(telegramReferrals).set({ status: "qualified", qualifiedAt: /* @__PURE__ */ new Date() }).where(and(eq(telegramReferrals.id, referral.id), eq(telegramReferrals.status, "pending")));
  if (Number(update[0]?.affectedRows ?? 0) < 1) return { qualified: false };
  const qualifiedRows = await db.select({ id: telegramReferrals.id }).from(telegramReferrals).where(and(eq(telegramReferrals.referrerTelegramUserId, referral.referrerTelegramUserId), eq(telegramReferrals.status, "qualified")));
  const qualifiedCount = qualifiedRows.length;
  const remainder = qualifiedCount % TELEGRAM_REFERRAL_REQUIRED_COUNT;
  const remainingCount = remainder === 0 ? TELEGRAM_REFERRAL_REQUIRED_COUNT : TELEGRAM_REFERRAL_REQUIRED_COUNT - remainder;
  const referrer = await db.select({ chatId: telegramSubscribers.chatId }).from(telegramSubscribers).where(eq(telegramSubscribers.telegramUserId, referral.referrerTelegramUserId)).limit(1);
  const event = referrer[0] ? { referrerChatId: referrer[0].chatId, qualifiedCount, remainingCount } : void 0;
  const milestone = Math.floor(qualifiedCount / TELEGRAM_REFERRAL_REQUIRED_COUNT) * TELEGRAM_REFERRAL_REQUIRED_COUNT;
  if (milestone < TELEGRAM_REFERRAL_REQUIRED_COUNT) return { qualified: true, event };
  const existingReward = await db.select({ id: telegramReferralRewards.id }).from(telegramReferralRewards).where(and(eq(telegramReferralRewards.referrerTelegramUserId, referral.referrerTelegramUserId), eq(telegramReferralRewards.qualifiedReferralCount, milestone))).limit(1);
  if (existingReward[0]) return { qualified: true, event };
  const activeReward = await db.select({ accessExpiresAt: telegramReferralRewards.accessExpiresAt }).from(telegramReferralRewards).where(and(eq(telegramReferralRewards.referrerTelegramUserId, referral.referrerTelegramUserId), eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, /* @__PURE__ */ new Date()))).orderBy(desc(telegramReferralRewards.accessExpiresAt)).limit(1);
  const accessStartsAt = activeReward[0]?.accessExpiresAt ?? /* @__PURE__ */ new Date();
  const accessExpiresAt = addOneCalendarMonth(accessStartsAt);
  try {
    await db.insert(telegramReferralRewards).values({ referrerTelegramUserId: referral.referrerTelegramUserId, qualifiedReferralCount: milestone, accessStartsAt, accessExpiresAt });
  } catch {
    return { qualified: true, event };
  }
  return { qualified: true, event: event ? { ...event, rewardExpiresAt: accessExpiresAt } : void 0 };
}
async function getTelegramReferralProgress(telegramUserId) {
  const db = await getDb();
  if (!db || !telegramUserId) return { qualifiedCount: 0, pendingCount: 0, remainingCount: TELEGRAM_REFERRAL_REQUIRED_COUNT, activeAccessExpiresAt: null };
  const [qualifiedRows, pendingRows, activeRewards] = await Promise.all([
    db.select({ id: telegramReferrals.id }).from(telegramReferrals).where(and(eq(telegramReferrals.referrerTelegramUserId, telegramUserId), eq(telegramReferrals.status, "qualified"))),
    db.select({ id: telegramReferrals.id }).from(telegramReferrals).where(and(eq(telegramReferrals.referrerTelegramUserId, telegramUserId), eq(telegramReferrals.status, "pending"))),
    db.select({ accessExpiresAt: telegramReferralRewards.accessExpiresAt }).from(telegramReferralRewards).where(and(eq(telegramReferralRewards.referrerTelegramUserId, telegramUserId), eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, /* @__PURE__ */ new Date()))).orderBy(desc(telegramReferralRewards.accessExpiresAt)).limit(1)
  ]);
  const remainder = qualifiedRows.length % TELEGRAM_REFERRAL_REQUIRED_COUNT;
  return { qualifiedCount: qualifiedRows.length, pendingCount: pendingRows.length, remainingCount: remainder === 0 ? TELEGRAM_REFERRAL_REQUIRED_COUNT : TELEGRAM_REFERRAL_REQUIRED_COUNT - remainder, activeAccessExpiresAt: activeRewards[0]?.accessExpiresAt ?? null };
}
async function listTelegramReferralHistory(telegramUserId, limit = 20) {
  const db = await getDb();
  if (!db || !telegramUserId) return [];
  return db.select({
    id: telegramReferrals.id,
    status: telegramReferrals.status,
    createdAt: telegramReferrals.createdAt,
    qualifiedAt: telegramReferrals.qualifiedAt,
    rejectedAt: telegramReferrals.rejectedAt,
    rejectionReason: telegramReferrals.rejectionReason
  }).from(telegramReferrals).where(eq(telegramReferrals.referrerTelegramUserId, telegramUserId)).orderBy(desc(telegramReferrals.createdAt), desc(telegramReferrals.id)).limit(Math.max(1, Math.min(50, limit)));
}
async function listManagedTelegramReferralRewards(limit = 100) {
  const db = await getDb();
  if (!db) return { summary: { qualifiedReferrals: 0, pendingReferrals: 0, activeRewards: 0 }, rewards: [] };
  const [qualifiedRows, pendingRows, activeRows, rewards] = await Promise.all([
    db.select({ id: telegramReferrals.id }).from(telegramReferrals).where(eq(telegramReferrals.status, "qualified")),
    db.select({ id: telegramReferrals.id }).from(telegramReferrals).where(eq(telegramReferrals.status, "pending")),
    db.select({ id: telegramReferralRewards.id }).from(telegramReferralRewards).where(and(eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, /* @__PURE__ */ new Date()))),
    db.select().from(telegramReferralRewards).orderBy(desc(telegramReferralRewards.createdAt)).limit(Math.max(1, Math.min(limit, 100)))
  ]);
  return { summary: { qualifiedReferrals: qualifiedRows.length, pendingReferrals: pendingRows.length, activeRewards: activeRows.length }, rewards };
}
async function revokeManagedTelegramReferralReward(rewardId, adminUserId, reason) {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(rewardId) || rewardId < 1) return false;
  const revokeReason = typeof reason === "string" ? reason.trim().slice(0, 255) || null : null;
  const result = await db.update(telegramReferralRewards).set({ status: "revoked", revokedByAdminUserId: adminUserId, revokedAt: /* @__PURE__ */ new Date(), revokeReason }).where(and(eq(telegramReferralRewards.id, rewardId), eq(telegramReferralRewards.status, "active")));
  const changed = Number(result[0]?.affectedRows ?? 0) > 0;
  if (changed) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "revoke", entityType: "referral_reward", entityId: String(rewardId), details: { reason: revokeReason } });
  return changed;
}
async function createImportantYemeniLawsSubscriptionRequest(telegramUserId, chatId, profile = {}) {
  const db = await getDb();
  if (!db) return void 0;
  const accessScope = profile.accessScope ?? "important_laws";
  const managedMenuItemId = Number.isInteger(profile.managedMenuItemId) && Number(profile.managedMenuItemId) > 0 ? Number(profile.managedMenuItemId) : null;
  const managedMenuCondition = managedMenuItemId === null ? isNull(telegramImportantYemeniLawsSubscriptionRequests.managedMenuItemId) : eq(telegramImportantYemeniLawsSubscriptionRequests.managedMenuItemId, managedMenuItemId);
  const existing = await db.select({ id: telegramImportantYemeniLawsSubscriptionRequests.id }).from(telegramImportantYemeniLawsSubscriptionRequests).where(and(eq(telegramImportantYemeniLawsSubscriptionRequests.telegramUserId, telegramUserId), eq(telegramImportantYemeniLawsSubscriptionRequests.accessScope, accessScope), managedMenuCondition, eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending"))).limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };
  const result = await db.insert(telegramImportantYemeniLawsSubscriptionRequests).values({
    telegramUserId,
    chatId,
    accessScope,
    managedMenuItemId,
    telegramUsername: profile.username?.trim().replace(/^@/, "").slice(0, 64) || null,
    telegramFirstName: profile.firstName?.trim().slice(0, 128) || null,
    telegramLastName: profile.lastName?.trim().slice(0, 128) || null,
    paymentMethod: profile.paymentMethod?.trim().slice(0, 32) || null
  }).$returningId();
  const id = Number(result[0]?.id ?? 0);
  return id > 0 ? { id, created: true } : void 0;
}
async function approveImportantYemeniLawsSubscriptionRequest(requestId, ownerTelegramUserId) {
  const db = await getDb();
  if (!db || !Number.isInteger(requestId) || requestId < 1) return void 0;
  const request = await db.select().from(telegramImportantYemeniLawsSubscriptionRequests).where(and(eq(telegramImportantYemeniLawsSubscriptionRequests.id, requestId), eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending"))).limit(1);
  const pendingRequest = request[0];
  if (!pendingRequest) return void 0;
  const result = await db.update(telegramImportantYemeniLawsSubscriptionRequests).set({ status: "approved", reviewedByTelegramUserId: ownerTelegramUserId, reviewedAt: /* @__PURE__ */ new Date() }).where(and(eq(telegramImportantYemeniLawsSubscriptionRequests.id, requestId), eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending")));
  if (Number(result[0]?.affectedRows ?? 0) < 1) return void 0;
  if (pendingRequest.managedMenuItemId) {
    await db.insert(telegramManagedMenuItemPremiumAccess).values({ telegramUserId: pendingRequest.telegramUserId, menuItemId: pendingRequest.managedMenuItemId, approvedByTelegramUserId: ownerTelegramUserId }).onDuplicateKeyUpdate({ set: { approvedByTelegramUserId: ownerTelegramUserId, approvedAt: /* @__PURE__ */ new Date() } });
  } else if (pendingRequest.accessScope === "important_laws") {
    await db.insert(telegramImportantYemeniLawsAccess).values({ telegramUserId: pendingRequest.telegramUserId, approvedByTelegramUserId: ownerTelegramUserId }).onDuplicateKeyUpdate({ set: { approvedByTelegramUserId: ownerTelegramUserId, approvedAt: /* @__PURE__ */ new Date() } });
  } else {
    const accessPatch = pendingRequest.accessScope === "sharia_exams" ? { shariaExamsAccess: true } : { secondaryExamsAccess: true };
    await db.insert(telegramManualPremiumAccess).values({ telegramUserId: pendingRequest.telegramUserId, approvedByTelegramUserId: ownerTelegramUserId, ...accessPatch }).onDuplicateKeyUpdate({ set: { ...accessPatch, approvedByTelegramUserId: ownerTelegramUserId, approvedAt: /* @__PURE__ */ new Date() } });
  }
  return { telegramUserId: pendingRequest.telegramUserId, chatId: pendingRequest.chatId, accessScope: pendingRequest.accessScope, managedMenuItemId: pendingRequest.managedMenuItemId };
}
async function rejectImportantYemeniLawsSubscriptionRequest(requestId, ownerTelegramUserId) {
  const db = await getDb();
  if (!db || !Number.isInteger(requestId) || requestId < 1) return void 0;
  const request = await db.select().from(telegramImportantYemeniLawsSubscriptionRequests).where(and(eq(telegramImportantYemeniLawsSubscriptionRequests.id, requestId), eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending"))).limit(1);
  const pendingRequest = request[0];
  if (!pendingRequest) return void 0;
  const result = await db.update(telegramImportantYemeniLawsSubscriptionRequests).set({ status: "rejected", reviewedByTelegramUserId: ownerTelegramUserId, reviewedAt: /* @__PURE__ */ new Date() }).where(and(eq(telegramImportantYemeniLawsSubscriptionRequests.id, requestId), eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending")));
  if (Number(result[0]?.affectedRows ?? 0) < 1) return void 0;
  return { telegramUserId: pendingRequest.telegramUserId, chatId: pendingRequest.chatId, accessScope: pendingRequest.accessScope, managedMenuItemId: pendingRequest.managedMenuItemId };
}
async function listPendingImportantYemeniLawsSubscriptionRequests(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: telegramImportantYemeniLawsSubscriptionRequests.id,
    telegramUserId: telegramImportantYemeniLawsSubscriptionRequests.telegramUserId,
    chatId: telegramImportantYemeniLawsSubscriptionRequests.chatId,
    accessScope: telegramImportantYemeniLawsSubscriptionRequests.accessScope,
    managedMenuItemId: telegramImportantYemeniLawsSubscriptionRequests.managedMenuItemId,
    telegramUsername: telegramImportantYemeniLawsSubscriptionRequests.telegramUsername,
    telegramFirstName: telegramImportantYemeniLawsSubscriptionRequests.telegramFirstName,
    telegramLastName: telegramImportantYemeniLawsSubscriptionRequests.telegramLastName,
    paymentMethod: telegramImportantYemeniLawsSubscriptionRequests.paymentMethod,
    createdAt: telegramImportantYemeniLawsSubscriptionRequests.createdAt
  }).from(telegramImportantYemeniLawsSubscriptionRequests).where(eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending")).orderBy(desc(telegramImportantYemeniLawsSubscriptionRequests.createdAt)).limit(Math.max(1, Math.min(limit, 20)));
}
var LEGAL_SOURCE_PAGE_SIZE = 8;
var JUDICIAL_ROOT_FOLDER_ID = "13jDFI3IkNoK1kAyifU1KODZ0_j6DGpoq";
var LEGISLATION_ROOT_FOLDER_ID = "1bEkLg2uaeQOULqZi6yIEfU0aKtMMB3J4";
var YEMENI_LAWS_ROOT_FOLDER_ID = "15ZWnJtqszUggVJcQVsyyfZZRXGtUgK0J";
var LEGAL_FORMS_ROOT_FOLDER_ID = "1ABgTWPMDWPgj1HmFkRaV9rnTDU4kZ4h9";
var ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID = "17Yx06hL5bJXp2i80qW39n7yys3MqqztT";
var ALL_YEMENI_LAWS_ROOT_FOLDER_ID = "all-yemeni-laws-root";
var FEATURED_REFERENCES_ROOT_FOLDER_ID = "17QASX45F7JlN4EIYICMUHN2NtfsEvuIu";
var IMPORTANT_YEMENI_LAWS_ROOT_FOLDER_ID = "important-yemeni-laws-interactive";
var JUDICIAL_SOURCE_PAGE_SIZE = 7;
var JUDICIAL_SEARCH_PAGE_SIZE = 7;
var JUDICIAL_SEARCH_SESSION_MINUTES = 10;
async function listLegalSourcesByCategory(category, page = 1) {
  const db = await getDb();
  if (!db) return { sources: [], total: 0 };
  const safePage = Math.max(1, page);
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.category, category), eq(legalSources.collection, "judicial"))),
    db.select().from(legalSources).where(and(eq(legalSources.category, category), eq(legalSources.collection, "judicial"))).orderBy(asc(legalSources.sortOrder)).limit(LEGAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * LEGAL_SOURCE_PAGE_SIZE)
  ]);
  return { sources, total: Number(totalResult[0]?.value ?? 0) };
}
async function createLegalSource(source) {
  const db = await getDb();
  if (!db) {
    throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627");
  }
  const result = await db.insert(legalSources).values(source).$returningId();
  const id = result[0]?.id;
  if (!id) {
    throw new Error("\u062A\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0635\u062F\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A");
  }
  const created = await getLegalSourceById(id);
  if (!created) {
    throw new Error("\u062A\u0639\u0630\u0631 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0645\u0635\u062F\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A \u0627\u0644\u062C\u062F\u064A\u062F");
  }
  return created;
}
function selectManagedUploadFolderId(collection, folders) {
  return folders.filter((folder) => folder.collection === collection && folder.parentDriveFolderId === null).sort((first, second) => first.sortOrder - second.sortOrder || first.driveFolderId.localeCompare(second.driveFolderId))[0]?.driveFolderId ?? null;
}
async function createManagedTelegramSource(input, adminUserId) {
  if (!adminUserId || typeof input.title !== "string" || typeof input.description !== "string" || typeof input.url !== "string") return void 0;
  const title = input.title.trim().slice(0, 255);
  const description = input.description.trim().slice(0, 4e3);
  const category = input.category;
  const collection = input.collection;
  const url = input.url.trim();
  if (!title || !description || !url || !legalCategoryValues.includes(category) || !legalCollectionValues.includes(collection)) return void 0;
  const db = await getDb();
  if (!db) throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0628\u0648\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627");
  const rootFolders = await db.select({
    collection: legalFolders.collection,
    driveFolderId: legalFolders.driveFolderId,
    parentDriveFolderId: legalFolders.parentDriveFolderId,
    sortOrder: legalFolders.sortOrder
  }).from(legalFolders).where(and(eq(legalFolders.collection, collection), isNull(legalFolders.parentDriveFolderId))).orderBy(asc(legalFolders.sortOrder), asc(legalFolders.driveFolderId));
  const driveFolderId = selectManagedUploadFolderId(collection, rootFolders);
  if (!driveFolderId) throw new Error("\u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0645\u062E\u062A\u0627\u0631 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623 \u0644\u0644\u0639\u0631\u0636 \u062F\u0627\u062E\u0644 \u0627\u0644\u0628\u0648\u062A");
  const sortOrder = Math.min(999999, Math.max(0, Math.trunc(Number(input.sortOrder) || 0)));
  const source = await createLegalSource({
    title,
    description,
    category,
    collection,
    sortOrder,
    isFeatured: input.isFeatured === true,
    url,
    driveFileId: null,
    driveFolderId,
    folderSortOrder: sortOrder,
    documentType: "other",
    legislationYear: null,
    issuingAuthority: null
  });
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "create", entityType: "legal_source", entityId: String(source.id), details: { title, collection, driveFolderId, storage: url.startsWith("/manus-storage/") } });
  return source;
}
async function listManagedTelegramSources(query = "", page = 1, pageSize = 20) {
  const db = await getDb();
  if (!db) return { sources: [], total: 0 };
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Math.trunc(pageSize) || 20));
  const normalizedQuery = query.trim().slice(0, 128);
  const filter = normalizedQuery ? or(like(legalSources.title, `%${normalizedQuery}%`), like(legalSources.description, `%${normalizedQuery}%`)) : void 0;
  const [sources, countRows] = await Promise.all([
    db.select().from(legalSources).where(filter).orderBy(desc(legalSources.updatedAt), asc(legalSources.id)).limit(safePageSize).offset((safePage - 1) * safePageSize),
    db.select({ value: count() }).from(legalSources).where(filter)
  ]);
  return { sources, total: Number(countRows[0]?.value ?? 0) };
}
async function updateManagedTelegramSource(id, input, adminUserId) {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(id) || id < 1) return void 0;
  const current = (await db.select().from(legalSources).where(eq(legalSources.id, id)).limit(1))[0];
  if (!current) return void 0;
  const title = input.title?.trim().slice(0, 255);
  const description = input.description?.trim().slice(0, 4e3);
  if (!title || !description) return void 0;
  const sortOrder = Math.min(999999, Math.max(0, Math.trunc(Number(input.sortOrder) || 0)));
  const isFeatured = input.isFeatured === true;
  await db.update(legalSources).set({ title, description, sortOrder, isFeatured }).where(eq(legalSources.id, id));
  const source = (await db.select().from(legalSources).where(eq(legalSources.id, id)).limit(1))[0];
  if (source) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "update", entityType: "legal_source", entityId: String(id), details: { title, sortOrder, isFeatured } });
  return source;
}
async function deleteManagedTelegramSource(id, adminUserId) {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(id) || id < 1) return false;
  const source = (await db.select().from(legalSources).where(eq(legalSources.id, id)).limit(1))[0];
  if (!source) return false;
  await db.delete(legalSources).where(eq(legalSources.id, id));
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "delete", entityType: "legal_source", entityId: String(id), details: { title: source.title, collection: source.collection } });
  return true;
}
async function listManagedTelegramFolders(query = "", limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const normalizedQuery = query.trim().slice(0, 128);
  const filter = normalizedQuery ? like(legalFolders.name, `%${normalizedQuery}%`) : void 0;
  return db.select().from(legalFolders).where(filter).orderBy(asc(legalFolders.collection), asc(legalFolders.sortOrder), asc(legalFolders.name)).limit(Math.min(200, Math.max(1, limit)));
}
async function updateManagedTelegramFolder(id, input, adminUserId) {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(id) || id < 1 || typeof input.name !== "string") return void 0;
  const name = input.name.trim().slice(0, 255);
  if (!name) return void 0;
  const sortOrder = Math.min(999999, Math.max(0, Math.trunc(Number(input.sortOrder) || 0)));
  await db.update(legalFolders).set({ name, sortOrder }).where(eq(legalFolders.id, id));
  const folder = (await db.select().from(legalFolders).where(eq(legalFolders.id, id)).limit(1))[0];
  if (folder) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "update", entityType: "legal_folder", entityId: String(id), details: { name, sortOrder } });
  return folder;
}
async function deleteManagedTelegramFolder(id, adminUserId) {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(id) || id < 1) return "unavailable";
  const folder = (await db.select().from(legalFolders).where(eq(legalFolders.id, id)).limit(1))[0];
  if (!folder) return "unavailable";
  const [source, child] = await Promise.all([
    db.select({ id: legalSources.id }).from(legalSources).where(eq(legalSources.driveFolderId, folder.driveFolderId)).limit(1),
    db.select({ id: legalFolders.id }).from(legalFolders).where(eq(legalFolders.parentDriveFolderId, folder.driveFolderId)).limit(1)
  ]);
  if (source[0] || child[0]) return "not_empty";
  await db.delete(legalFolders).where(eq(legalFolders.id, id));
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "delete", entityType: "legal_folder", entityId: String(id), details: { name: folder.name } });
  return "deleted";
}
async function searchLegalSources(query) {
  const db = await getDb();
  if (!db) return [];
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const pattern = `%${normalizedQuery}%`;
  return db.select().from(legalSources).where(and(eq(legalSources.collection, "judicial"), or(like(legalSources.title, pattern), like(legalSources.description, pattern)))).orderBy(asc(legalSources.sortOrder)).limit(20);
}
async function getLegalSourceById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(legalSources).where(eq(legalSources.id, id)).limit(1);
  return result[0];
}
async function saveTelegramDocumentFavorite(telegramUserId, sourceId) {
  const db = await getDb();
  if (!db || !telegramUserId || !Number.isInteger(sourceId) || sourceId < 1) return "unavailable";
  const source = await db.select({ id: legalSources.id }).from(legalSources).where(eq(legalSources.id, sourceId)).limit(1);
  if (!source[0]) return "unavailable";
  const existing = await db.select({ id: telegramDocumentFavorites.id }).from(telegramDocumentFavorites).where(and(eq(telegramDocumentFavorites.telegramUserId, telegramUserId), eq(telegramDocumentFavorites.sourceId, sourceId))).limit(1);
  if (existing[0]) return "exists";
  await db.insert(telegramDocumentFavorites).values({ telegramUserId, sourceId });
  return "added";
}
async function listTelegramDocumentFavorites(telegramUserId, limit = 50) {
  const db = await getDb();
  if (!db || !telegramUserId) return [];
  const rows = await db.select({ favorite: telegramDocumentFavorites, source: legalSources }).from(telegramDocumentFavorites).innerJoin(legalSources, eq(telegramDocumentFavorites.sourceId, legalSources.id)).where(eq(telegramDocumentFavorites.telegramUserId, telegramUserId)).orderBy(desc(telegramDocumentFavorites.createdAt), desc(telegramDocumentFavorites.id)).limit(Math.max(1, Math.min(limit, 50)));
  return rows;
}
async function removeTelegramDocumentFavorite(telegramUserId, sourceId) {
  const db = await getDb();
  if (!db || !telegramUserId || !Number.isInteger(sourceId) || sourceId < 1) return false;
  const result = await db.delete(telegramDocumentFavorites).where(and(eq(telegramDocumentFavorites.telegramUserId, telegramUserId), eq(telegramDocumentFavorites.sourceId, sourceId)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
async function listRecentLegalSources(limit = 6) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(legalSources).where(ne(legalSources.collection, "important_yemeni_laws")).orderBy(desc(legalSources.createdAt), desc(legalSources.id)).limit(Math.max(1, Math.min(limit, 12)));
}
async function listFeaturedLegalSources(limit = 6) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(legalSources).where(and(eq(legalSources.isFeatured, true), ne(legalSources.collection, "important_yemeni_laws"))).orderBy(desc(legalSources.updatedAt), asc(legalSources.sortOrder)).limit(Math.max(1, Math.min(limit, 12)));
}
async function listPopularLegalSources(limit = 6) {
  const db = await getDb();
  if (!db) return [];
  const events = await db.select({ sourceId: telegramUsageEvents.sourceId }).from(telegramUsageEvents).where(and(eq(telegramUsageEvents.eventType, "document_request"), isNotNull(telegramUsageEvents.sourceId))).orderBy(desc(telegramUsageEvents.createdAt)).limit(1e3);
  const rankedIds = Array.from(events.reduce((counts, event) => {
    if (event.sourceId) counts.set(event.sourceId, (counts.get(event.sourceId) ?? 0) + 1);
    return counts;
  }, /* @__PURE__ */ new Map()).entries()).sort((left, right) => right[1] - left[1] || left[0] - right[0]).slice(0, Math.max(1, Math.min(limit, 12))).map(([sourceId]) => sourceId);
  if (rankedIds.length === 0) return [];
  const sources = await Promise.all(rankedIds.map((sourceId) => getLegalSourceById(sourceId)));
  return sources.filter((source) => source !== void 0 && source.collection !== "important_yemeni_laws").slice(0, Math.max(1, Math.min(limit, 12)));
}
async function listLegislationSourcesByType(documentType, page = 1) {
  const db = await getDb();
  if (!db) return { sources: [], total: 0 };
  const safePage = Math.max(1, page);
  const filter = and(eq(legalSources.collection, "legislation"), eq(legalSources.documentType, documentType));
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  return { sources, total: Number(totalResult[0]?.value ?? 0) };
}
async function listLegislationYears() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ year: legalSources.legislationYear }).from(legalSources).where(and(eq(legalSources.collection, "legislation"), isNotNull(legalSources.legislationYear))).orderBy(desc(legalSources.legislationYear));
  return Array.from(new Set(rows.map((row) => row.year).filter((year) => typeof year === "number")));
}
async function listLegislationSourcesByYear(year, page = 1) {
  const db = await getDb();
  if (!db || !Number.isInteger(year)) return { sources: [], total: 0 };
  const safePage = Math.max(1, page);
  const filter = and(eq(legalSources.collection, "legislation"), eq(legalSources.legislationYear, year));
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  return { sources, total: Number(totalResult[0]?.value ?? 0) };
}
async function recordTelegramUsageEvent(telegramUserId, eventType, options = {}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(telegramUsageEvents).values({
    telegramUserId,
    eventType,
    sectionKey: options.sectionKey?.trim().slice(0, 64) || null,
    query: options.query?.slice(0, 255) ?? null,
    sourceId: options.sourceId ?? null
  });
}
function getTelegramVisitPeriodStart(period, now = /* @__PURE__ */ new Date()) {
  const days = period === "day" ? 1 : period === "week" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1e3);
}
async function getTelegramVisitAnalytics(period = "month") {
  const since = getTelegramVisitPeriodStart(period);
  const empty = {
    period,
    since,
    platformVisits: { total: 0, uniqueUsers: 0 },
    hasadVisits: { total: 0, uniqueUsers: 0 },
    users: []
  };
  const db = await getDb();
  if (!db) return empty;
  const events = await db.select({
    telegramUserId: telegramVisitEvents.telegramUserId,
    site: telegramVisitEvents.site,
    visitedAt: telegramVisitEvents.visitedAt
  }).from(telegramVisitEvents).where(gte(telegramVisitEvents.visitedAt, since)).orderBy(desc(telegramVisitEvents.visitedAt)).limit(2e3);
  const platformEvents = events.filter((event) => event.site === "platform");
  const hasadEvents = events.filter((event) => event.site === "hasad");
  const latestByUser = /* @__PURE__ */ new Map();
  for (const event of events) {
    const current = latestByUser.get(event.telegramUserId) ?? { platformVisitedAt: null, hasadVisitedAt: null, latestAt: event.visitedAt };
    if (event.site === "platform" && !current.platformVisitedAt) current.platformVisitedAt = event.visitedAt;
    if (event.site === "hasad" && !current.hasadVisitedAt) current.hasadVisitedAt = event.visitedAt;
    if (event.visitedAt > current.latestAt) current.latestAt = event.visitedAt;
    latestByUser.set(event.telegramUserId, current);
  }
  const userIds = Array.from(latestByUser.entries()).sort(([, left], [, right]) => right.latestAt.getTime() - left.latestAt.getTime()).slice(0, 100).map(([telegramUserId]) => telegramUserId);
  if (userIds.length === 0) return {
    ...empty,
    platformVisits: { total: platformEvents.length, uniqueUsers: new Set(platformEvents.map((event) => event.telegramUserId)).size },
    hasadVisits: { total: hasadEvents.length, uniqueUsers: new Set(hasadEvents.map((event) => event.telegramUserId)).size }
  };
  const subscribers = await db.select({
    telegramUserId: telegramSubscribers.telegramUserId,
    telegramUsername: telegramSubscribers.telegramUsername,
    telegramFirstName: telegramSubscribers.telegramFirstName,
    telegramLastName: telegramSubscribers.telegramLastName
  }).from(telegramSubscribers).where(inArray(telegramSubscribers.telegramUserId, userIds));
  const subscriberByUserId = new Map(subscribers.map((subscriber) => [subscriber.telegramUserId, subscriber]));
  return {
    period,
    since,
    platformVisits: { total: platformEvents.length, uniqueUsers: new Set(platformEvents.map((event) => event.telegramUserId)).size },
    hasadVisits: { total: hasadEvents.length, uniqueUsers: new Set(hasadEvents.map((event) => event.telegramUserId)).size },
    users: userIds.map((telegramUserId) => {
      const subscriber = subscriberByUserId.get(telegramUserId);
      const latest = latestByUser.get(telegramUserId);
      return {
        telegramUserId,
        telegramUsername: subscriber?.telegramUsername ?? null,
        telegramFirstName: subscriber?.telegramFirstName ?? null,
        telegramLastName: subscriber?.telegramLastName ?? null,
        platformVisitedAt: latest.platformVisitedAt,
        hasadVisitedAt: latest.hasadVisitedAt
      };
    })
  };
}
async function getTelegramUsageAnalytics(periodDays = 30) {
  const db = await getDb();
  const safeDays = Math.min(90, Math.max(1, Math.trunc(periodDays) || 30));
  if (!db) return { periodDays: safeDays, totalEvents: 0, uniqueUsers: 0, eventTypes: [], topSections: [], topSources: [] };
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1e3);
  const events = await db.select({ telegramUserId: telegramUsageEvents.telegramUserId, eventType: telegramUsageEvents.eventType, sectionKey: telegramUsageEvents.sectionKey, sourceId: telegramUsageEvents.sourceId }).from(telegramUsageEvents).where(gt(telegramUsageEvents.createdAt, since)).limit(5e3);
  const eventTypes = Array.from(events.reduce((counts, event) => {
    counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
    return counts;
  }, /* @__PURE__ */ new Map()).entries()).map(([eventType, count3]) => ({ eventType, count: count3 })).sort((a, b) => b.count - a.count || a.eventType.localeCompare(b.eventType));
  const topSections = Array.from(events.reduce((counts, event) => {
    if (event.sectionKey) counts.set(event.sectionKey, (counts.get(event.sectionKey) ?? 0) + 1);
    return counts;
  }, /* @__PURE__ */ new Map()).entries()).map(([sectionKey, count3]) => ({ sectionKey, count: count3 })).sort((a, b) => b.count - a.count || a.sectionKey.localeCompare(b.sectionKey)).slice(0, 10);
  const rankedSources = Array.from(events.reduce((counts, event) => {
    if (event.sourceId) counts.set(event.sourceId, (counts.get(event.sourceId) ?? 0) + 1);
    return counts;
  }, /* @__PURE__ */ new Map()).entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 10);
  const topSources = (await Promise.all(rankedSources.map(async ([sourceId, count3]) => {
    const source = await getLegalSourceById(sourceId);
    return source ? { sourceId, title: source.title, count: count3 } : void 0;
  }))).filter((source) => Boolean(source));
  return { periodDays: safeDays, totalEvents: events.length, uniqueUsers: new Set(events.map((event) => event.telegramUserId)).size, eventTypes, topSections, topSources };
}
async function createTelegramSupportRequest(telegramUserId, chatId, message) {
  const db = await getDb();
  if (!db) throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627");
  await db.insert(telegramSupportRequests).values({
    telegramUserId,
    chatId,
    message: message.trim().slice(0, 2e3),
    status: "new"
  });
}
async function getTelegramOwnerStatistics() {
  const db = await getDb();
  if (!db) return { totalEvents: 0, totalSupportRequests: 0, totalSubscribers: 0, firstSubscribedAt: null, lastActiveAt: null, regions: [], platformVisits: { total: 0, latestAt: null }, hasadVisits: { total: 0, latestAt: null }, topQueries: [] };
  const [eventResult, supportResult, searchEvents, subscriberResult, firstSubscriber, lastActiveSubscriber, regionResult, platformVisitResult, latestPlatformVisit, hasadVisitResult, latestHasadVisit] = await Promise.all([
    db.select({ value: count() }).from(telegramUsageEvents),
    db.select({ value: count() }).from(telegramSupportRequests).where(eq(telegramSupportRequests.status, "new")),
    db.select({ query: telegramUsageEvents.query }).from(telegramUsageEvents).where(and(eq(telegramUsageEvents.eventType, "search"), isNotNull(telegramUsageEvents.query))).orderBy(desc(telegramUsageEvents.createdAt)).limit(1e3),
    db.select({ value: count() }).from(telegramSubscribers),
    db.select({ subscribedAt: telegramSubscribers.subscribedAt }).from(telegramSubscribers).orderBy(asc(telegramSubscribers.subscribedAt)).limit(1),
    db.select({ lastSeenAt: telegramSubscribers.lastSeenAt }).from(telegramSubscribers).orderBy(desc(telegramSubscribers.lastSeenAt)).limit(1),
    db.select({ region: telegramPlatformAccess.region, value: count() }).from(telegramPlatformAccess).where(isNotNull(telegramPlatformAccess.region)).groupBy(telegramPlatformAccess.region).orderBy(desc(count())).limit(8),
    db.select({ value: count() }).from(telegramPlatformAccess).where(isNotNull(telegramPlatformAccess.webAppVerifiedAt)),
    db.select({ webAppVerifiedAt: telegramPlatformAccess.webAppVerifiedAt }).from(telegramPlatformAccess).where(isNotNull(telegramPlatformAccess.webAppVerifiedAt)).orderBy(desc(telegramPlatformAccess.webAppVerifiedAt)).limit(1),
    db.select({ value: count() }).from(telegramHasadAccess),
    db.select({ visitedAt: telegramHasadAccess.visitedAt }).from(telegramHasadAccess).orderBy(desc(telegramHasadAccess.visitedAt)).limit(1)
  ]);
  const topQueries = Array.from(searchEvents.reduce((counts, event) => {
    if (event.query) counts.set(event.query, (counts.get(event.query) ?? 0) + 1);
    return counts;
  }, /* @__PURE__ */ new Map()).entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ar")).slice(0, 5).map(([query, value]) => ({ query, count: value }));
  return {
    totalEvents: Number(eventResult[0]?.value ?? 0),
    totalSupportRequests: Number(supportResult[0]?.value ?? 0),
    totalSubscribers: Number(subscriberResult[0]?.value ?? 0),
    firstSubscribedAt: firstSubscriber[0]?.subscribedAt ?? null,
    lastActiveAt: lastActiveSubscriber[0]?.lastSeenAt ?? null,
    regions: regionResult.flatMap((entry) => entry.region ? [{ region: entry.region, count: Number(entry.value) }] : []),
    platformVisits: { total: Number(platformVisitResult[0]?.value ?? 0), latestAt: latestPlatformVisit[0]?.webAppVerifiedAt ?? null },
    hasadVisits: { total: Number(hasadVisitResult[0]?.value ?? 0), latestAt: latestHasadVisit[0]?.visitedAt ?? null },
    topQueries
  };
}
async function listNewTelegramSupportRequests(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: telegramSupportRequests.id, message: telegramSupportRequests.message, createdAt: telegramSupportRequests.createdAt }).from(telegramSupportRequests).where(eq(telegramSupportRequests.status, "new")).orderBy(desc(telegramSupportRequests.createdAt)).limit(Math.max(1, Math.min(limit, 20)));
}
async function registerTelegramSubscriber(chatId, telegramUserId, profile) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select({ chatId: telegramSubscribers.chatId }).from(telegramSubscribers).where(eq(telegramSubscribers.chatId, chatId)).limit(1);
  await db.insert(telegramSubscribers).values({
    chatId,
    telegramUserId,
    telegramUsername: profile?.telegramUsername ?? null,
    telegramFirstName: profile?.telegramFirstName ?? null,
    telegramLastName: profile?.telegramLastName ?? null
  }).onDuplicateKeyUpdate({
    set: {
      telegramUserId,
      telegramUsername: profile?.telegramUsername ?? null,
      telegramFirstName: profile?.telegramFirstName ?? null,
      telegramLastName: profile?.telegramLastName ?? null,
      lastSeenAt: /* @__PURE__ */ new Date()
    }
  });
  return existing.length === 0;
}
async function listTelegramSubscriberChatIds() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ chatId: telegramSubscribers.chatId }).from(telegramSubscribers);
  return rows.map((row) => row.chatId);
}
async function createTelegramBroadcastDraft(input) {
  const db = await getDb();
  if (!db) return void 0;
  const recipientCount = (await listTelegramSubscriberChatIds()).length;
  const result = await db.insert(telegramBroadcasts).values({
    ownerTelegramUserId: input.ownerTelegramUserId,
    kind: input.kind,
    message: input.message?.trim().slice(0, 4e3) ?? null,
    fileId: input.fileId ?? null,
    fileName: input.fileName?.slice(0, 255) ?? null,
    caption: input.caption?.trim().slice(0, 1e3) ?? null,
    recipientCount
  }).$returningId();
  const insertId = Number(result[0]?.id ?? 0);
  if (!insertId) return void 0;
  return getTelegramBroadcastDraft(insertId, input.ownerTelegramUserId);
}
async function createManagedTelegramBroadcastDraft(adminUserId, message) {
  const normalizedMessage = typeof message === "string" ? message.trim().slice(0, 4e3) : "";
  if (!adminUserId || !normalizedMessage) return void 0;
  const draft = await createTelegramBroadcastDraft({ ownerTelegramUserId: adminUserId, kind: "message", message: normalizedMessage });
  const db = await getDb();
  if (draft && db) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "create", entityType: "broadcast", entityId: String(draft.id), details: { recipientCount: draft.recipientCount, length: normalizedMessage.length } });
  return draft;
}
async function listManagedTelegramBroadcasts(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: telegramBroadcasts.id,
    kind: telegramBroadcasts.kind,
    message: telegramBroadcasts.message,
    status: telegramBroadcasts.status,
    recipientCount: telegramBroadcasts.recipientCount,
    successCount: telegramBroadcasts.successCount,
    failureCount: telegramBroadcasts.failureCount,
    scheduledFor: telegramBroadcasts.scheduledFor,
    createdAt: telegramBroadcasts.createdAt,
    completedAt: telegramBroadcasts.completedAt
  }).from(telegramBroadcasts).orderBy(desc(telegramBroadcasts.createdAt), desc(telegramBroadcasts.id)).limit(Math.min(50, Math.max(1, limit)));
}
async function recordManagedTelegramBroadcastAudit(adminUserId, broadcastId, action, details = {}) {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(broadcastId) || broadcastId < 1) return;
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action, entityType: "broadcast", entityId: String(broadcastId), details });
}
async function recordManagedTelegramAdminAudit(adminUserId, action, entityType, entityId, details = {}) {
  const db = await getDb();
  if (!db || !adminUserId || !action || !entityType || !entityId) return;
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: action.slice(0, 64), entityType: entityType.slice(0, 64), entityId: entityId.slice(0, 128), details });
}
async function getTelegramBroadcastDraft(id, ownerTelegramUserId) {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1) return void 0;
  const rows = await db.select().from(telegramBroadcasts).where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.ownerTelegramUserId, ownerTelegramUserId))).limit(1);
  return rows[0];
}
async function cancelTelegramBroadcastDraft(id, ownerTelegramUserId) {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1) return false;
  const result = await db.update(telegramBroadcasts).set({ status: "cancelled", completedAt: /* @__PURE__ */ new Date() }).where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.ownerTelegramUserId, ownerTelegramUserId), eq(telegramBroadcasts.status, "draft")));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
async function beginTelegramBroadcast(id, ownerTelegramUserId) {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1) return false;
  const result = await db.update(telegramBroadcasts).set({ status: "sending" }).where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.ownerTelegramUserId, ownerTelegramUserId), eq(telegramBroadcasts.status, "draft"), isNull(telegramBroadcasts.scheduleCronTaskUid)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
async function scheduleTelegramBroadcast(id, ownerTelegramUserId, scheduledFor, taskUid) {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1 || !taskUid.trim() || scheduledFor.getTime() <= Date.now()) return false;
  const result = await db.update(telegramBroadcasts).set({ scheduledFor, scheduleCronTaskUid: taskUid.trim().slice(0, 65) }).where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.ownerTelegramUserId, ownerTelegramUserId), eq(telegramBroadcasts.status, "draft"), isNull(telegramBroadcasts.scheduleCronTaskUid)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
async function getScheduledTelegramBroadcast(taskUid) {
  const db = await getDb();
  if (!db || !taskUid.trim()) return void 0;
  const rows = await db.select().from(telegramBroadcasts).where(eq(telegramBroadcasts.scheduleCronTaskUid, taskUid.trim())).limit(1);
  return rows[0];
}
async function beginScheduledTelegramBroadcast(id, taskUid) {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1 || !taskUid.trim()) return false;
  const result = await db.update(telegramBroadcasts).set({ status: "sending" }).where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.scheduleCronTaskUid, taskUid.trim()), eq(telegramBroadcasts.status, "draft")));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
async function completeTelegramBroadcast(id, ownerTelegramUserId, successCount, failureCount) {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1) return false;
  const result = await db.update(telegramBroadcasts).set({ status: "sent", successCount, failureCount, completedAt: /* @__PURE__ */ new Date() }).where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.ownerTelegramUserId, ownerTelegramUserId), eq(telegramBroadcasts.status, "sending")));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
async function getJudicialFolderContents(folderId, page = 1) {
  const db = await getDb();
  if (!db) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, page);
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, "judicial"))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, "judicial"))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, "judicial"))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, "judicial"))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0)
  };
}
async function getLegislationFolderContents(folderId, page = 1) {
  const db = await getDb();
  if (!db) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, page);
  const legislation = "legislation";
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, legislation))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, legislation))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, legislation))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, legislation))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0)
  };
}
async function getYemeniLawsFolderContents(folderId, page = 1) {
  const db = await getDb();
  if (!db) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, page);
  const yemeniLaws = "yemeni_laws";
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, yemeniLaws))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, yemeniLaws))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, yemeniLaws))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, yemeniLaws))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0)
  };
}
async function getLegalFormsFolderContents(folderId, page = 1) {
  const db = await getDb();
  if (!db) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, page);
  const legalForms = "legal_forms";
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, legalForms))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, legalForms))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, legalForms))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, legalForms))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0)
  };
}
async function getIllustratedLegalFormsFolderContents(folderId, page = 1) {
  const db = await getDb();
  if (!db) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, page);
  const illustratedLegalForms = "illustrated_legal_forms";
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, illustratedLegalForms))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, illustratedLegalForms))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, illustratedLegalForms))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, illustratedLegalForms))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0)
  };
}
async function getAllYemeniLawsFolderContents(folderId, page = 1) {
  const db = await getDb();
  if (!db) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, page);
  const allYemeniLaws = "all_yemeni_laws";
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, allYemeniLaws))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, allYemeniLaws))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, allYemeniLaws))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, allYemeniLaws))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0)
  };
}
async function getFeaturedReferencesFolderContents(folderId, page = 1) {
  const db = await getDb();
  if (!db) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, page);
  const featuredReferences = "featured_references";
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, featuredReferences))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, featuredReferences))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, featuredReferences))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, featuredReferences))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0)
  };
}
async function getImportantYemeniLawsFolderContents(folderId, page = 1) {
  const db = await getDb();
  if (!db) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, page);
  const importantYemeniLaws = "important_yemeni_laws";
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, importantYemeniLaws))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, importantYemeniLaws))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, importantYemeniLaws))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, importantYemeniLaws))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0)
  };
}
function searchExpiry() {
  return new Date(Date.now() + JUDICIAL_SEARCH_SESSION_MINUTES * 60 * 1e3);
}
async function beginJudicialSearch(chatId) {
  const db = await getDb();
  if (!db) throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627");
  await db.delete(legislationSearchSessions).where(eq(legislationSearchSessions.chatId, chatId));
  await db.delete(allYemeniLawsSearchSessions).where(eq(allYemeniLawsSearchSessions.chatId, chatId));
  await db.delete(librarySearchSessions).where(eq(librarySearchSessions.chatId, chatId));
  await db.delete(telegramContractTemplateSearchSessions).where(eq(telegramContractTemplateSearchSessions.chatId, chatId));
  await db.insert(judicialSearchSessions).values({
    chatId,
    query: null,
    status: "awaiting",
    expiresAt: searchExpiry()
  }).onDuplicateKeyUpdate({
    set: { query: null, status: "awaiting", expiresAt: searchExpiry() }
  });
}
async function beginLegislationSearch(chatId) {
  const db = await getDb();
  if (!db) throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627");
  await db.delete(judicialSearchSessions).where(eq(judicialSearchSessions.chatId, chatId));
  await db.delete(allYemeniLawsSearchSessions).where(eq(allYemeniLawsSearchSessions.chatId, chatId));
  await db.delete(librarySearchSessions).where(eq(librarySearchSessions.chatId, chatId));
  await db.delete(telegramContractTemplateSearchSessions).where(eq(telegramContractTemplateSearchSessions.chatId, chatId));
  await db.insert(legislationSearchSessions).values({
    chatId,
    query: null,
    status: "awaiting",
    expiresAt: searchExpiry()
  }).onDuplicateKeyUpdate({
    set: { query: null, status: "awaiting", expiresAt: searchExpiry() }
  });
}
async function beginLibrarySearch(chatId) {
  const db = await getDb();
  if (!db) throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627");
  await db.delete(judicialSearchSessions).where(eq(judicialSearchSessions.chatId, chatId));
  await db.delete(legislationSearchSessions).where(eq(legislationSearchSessions.chatId, chatId));
  await db.delete(allYemeniLawsSearchSessions).where(eq(allYemeniLawsSearchSessions.chatId, chatId));
  await db.delete(telegramContractTemplateSearchSessions).where(eq(telegramContractTemplateSearchSessions.chatId, chatId));
  await db.insert(librarySearchSessions).values({
    chatId,
    query: null,
    status: "awaiting",
    expiresAt: searchExpiry()
  }).onDuplicateKeyUpdate({
    set: { query: null, status: "awaiting", expiresAt: searchExpiry() }
  });
}
async function consumeJudicialSearchQuery(chatId, query) {
  const db = await getDb();
  if (!db) return void 0;
  const normalizedQuery = query.trim().slice(0, 255);
  if (!normalizedQuery) return void 0;
  const now = /* @__PURE__ */ new Date();
  const awaitingResult = await db.select().from(judicialSearchSessions).where(and(eq(judicialSearchSessions.chatId, chatId), eq(judicialSearchSessions.status, "awaiting"), gt(judicialSearchSessions.expiresAt, now))).limit(1);
  const awaitingSession = awaitingResult[0];
  if (!awaitingSession) return void 0;
  const expiresAt = searchExpiry();
  await db.update(judicialSearchSessions).set({ query: normalizedQuery, status: "ready", expiresAt }).where(eq(judicialSearchSessions.id, awaitingSession.id));
  return { ...awaitingSession, query: normalizedQuery, status: "ready", expiresAt };
}
async function consumeLegislationSearchQuery(chatId, query) {
  const db = await getDb();
  if (!db) return void 0;
  const normalizedQuery = query.trim().slice(0, 255);
  if (!normalizedQuery) return void 0;
  const now = /* @__PURE__ */ new Date();
  const awaitingResult = await db.select().from(legislationSearchSessions).where(and(eq(legislationSearchSessions.chatId, chatId), eq(legislationSearchSessions.status, "awaiting"), gt(legislationSearchSessions.expiresAt, now))).limit(1);
  const awaitingSession = awaitingResult[0];
  if (!awaitingSession) return void 0;
  const expiresAt = searchExpiry();
  await db.update(legislationSearchSessions).set({ query: normalizedQuery, status: "ready", expiresAt }).where(eq(legislationSearchSessions.id, awaitingSession.id));
  return { ...awaitingSession, query: normalizedQuery, status: "ready", expiresAt };
}
async function consumeLibrarySearchQuery(chatId, query) {
  const db = await getDb();
  if (!db) return void 0;
  const normalizedQuery = query.trim().slice(0, 255);
  if (!normalizedQuery) return void 0;
  const now = /* @__PURE__ */ new Date();
  const awaitingResult = await db.select().from(librarySearchSessions).where(and(eq(librarySearchSessions.chatId, chatId), eq(librarySearchSessions.status, "awaiting"), gt(librarySearchSessions.expiresAt, now))).limit(1);
  const awaitingSession = awaitingResult[0];
  if (!awaitingSession) return void 0;
  const expiresAt = searchExpiry();
  await db.update(librarySearchSessions).set({ query: normalizedQuery, status: "ready", expiresAt }).where(eq(librarySearchSessions.id, awaitingSession.id));
  return { ...awaitingSession, query: normalizedQuery, status: "ready", expiresAt };
}
async function beginAllYemeniLawsSearch(chatId) {
  const db = await getDb();
  if (!db) throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627");
  await db.delete(judicialSearchSessions).where(eq(judicialSearchSessions.chatId, chatId));
  await db.delete(legislationSearchSessions).where(eq(legislationSearchSessions.chatId, chatId));
  await db.delete(librarySearchSessions).where(eq(librarySearchSessions.chatId, chatId));
  await db.delete(telegramContractTemplateSearchSessions).where(eq(telegramContractTemplateSearchSessions.chatId, chatId));
  await db.insert(allYemeniLawsSearchSessions).values({
    chatId,
    query: null,
    status: "awaiting",
    expiresAt: searchExpiry()
  }).onDuplicateKeyUpdate({
    set: { query: null, status: "awaiting", expiresAt: searchExpiry() }
  });
}
async function consumeAllYemeniLawsSearchQuery(chatId, query) {
  const db = await getDb();
  if (!db) return void 0;
  const normalizedQuery = query.trim().slice(0, 255);
  if (!normalizedQuery) return void 0;
  const now = /* @__PURE__ */ new Date();
  const awaitingResult = await db.select().from(allYemeniLawsSearchSessions).where(and(eq(allYemeniLawsSearchSessions.chatId, chatId), eq(allYemeniLawsSearchSessions.status, "awaiting"), gt(allYemeniLawsSearchSessions.expiresAt, now))).limit(1);
  const awaitingSession = awaitingResult[0];
  if (!awaitingSession) return void 0;
  const expiresAt = searchExpiry();
  await db.update(allYemeniLawsSearchSessions).set({ query: normalizedQuery, status: "ready", expiresAt }).where(eq(allYemeniLawsSearchSessions.id, awaitingSession.id));
  return { ...awaitingSession, query: normalizedQuery, status: "ready", expiresAt };
}
async function beginTelegramContractTemplateSearch(chatId) {
  const db = await getDb();
  if (!db) throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u064B\u0627");
  await db.delete(judicialSearchSessions).where(eq(judicialSearchSessions.chatId, chatId));
  await db.delete(legislationSearchSessions).where(eq(legislationSearchSessions.chatId, chatId));
  await db.delete(librarySearchSessions).where(eq(librarySearchSessions.chatId, chatId));
  await db.delete(allYemeniLawsSearchSessions).where(eq(allYemeniLawsSearchSessions.chatId, chatId));
  await db.insert(telegramContractTemplateSearchSessions).values({
    chatId,
    query: null,
    status: "awaiting",
    expiresAt: searchExpiry()
  }).onDuplicateKeyUpdate({
    set: { query: null, status: "awaiting", expiresAt: searchExpiry() }
  });
}
async function consumeTelegramContractTemplateSearchQuery(chatId, query) {
  const db = await getDb();
  if (!db) return void 0;
  const normalizedQuery = query.trim().slice(0, 255);
  if (!normalizedQuery) return void 0;
  const now = /* @__PURE__ */ new Date();
  const awaitingResult = await db.select().from(telegramContractTemplateSearchSessions).where(and(eq(telegramContractTemplateSearchSessions.chatId, chatId), eq(telegramContractTemplateSearchSessions.status, "awaiting"), gt(telegramContractTemplateSearchSessions.expiresAt, now))).limit(1);
  const awaitingSession = awaitingResult[0];
  if (!awaitingSession) return void 0;
  const expiresAt = searchExpiry();
  await db.update(telegramContractTemplateSearchSessions).set({ query: normalizedQuery, status: "ready", expiresAt }).where(eq(telegramContractTemplateSearchSessions.id, awaitingSession.id));
  return { ...awaitingSession, query: normalizedQuery, status: "ready", expiresAt };
}
function normalizeArabicSearch(value) {
  return value.toLowerCase().replace(/[\u064B-\u065F\u0670]/g, "").replace(/ـ/g, "").replace(/[أإآٱ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").replace(/[^\u0621-\u063A\u0641-\u064A0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function normalizedSearchWords(value) {
  return normalizeArabicSearch(value).split(" ").filter((word) => word.length > 1).map((word) => word.startsWith("\u0627\u0644") && word.length > 4 ? word.slice(2) : word);
}
function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index2) => index2);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1] ? previous[rightIndex - 1] : Math.min(previous[rightIndex] + 1, current[rightIndex - 1] + 1, previous[rightIndex - 1] + 1);
    }
    for (let index2 = 0; index2 < current.length; index2 += 1) previous[index2] = current[index2];
  }
  return previous[right.length];
}
function approximateArabicMatchScore(query, source) {
  const normalizedQuery = normalizeArabicSearch(query);
  if (normalizedQuery.length < 2) return 0;
  const haystack = normalizeArabicSearch(`${source.title} ${source.description}`);
  if (haystack.includes(normalizedQuery)) return 100;
  const words = normalizedSearchWords(haystack);
  const queryWords = normalizedSearchWords(normalizedQuery);
  if (queryWords.length === 0) return 0;
  let score = 0;
  for (const queryWord of queryWords) {
    const maximumDistance = queryWord.length <= 4 ? 1 : Math.ceil(queryWord.length * 0.25);
    const bestDistance = words.reduce((best, word) => Math.min(best, editDistance(queryWord, word)), Number.POSITIVE_INFINITY);
    if (bestDistance > maximumDistance) return 0;
    score += maximumDistance - bestDistance + 1;
  }
  return score;
}
function fallbackJudicialSearchResults(query, candidates, page = 1) {
  const approximate = candidates.map((source) => ({ source, score: approximateArabicMatchScore(query, source) })).filter((result) => result.score > 0).sort((left, right) => right.score - left.score || left.source.sortOrder - right.source.sortOrder);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * JUDICIAL_SEARCH_PAGE_SIZE;
  return {
    sources: approximate.slice(start, start + JUDICIAL_SEARCH_PAGE_SIZE).map((result) => result.source),
    total: approximate.length
  };
}
function fallbackContractTemplateSearchResults(query, candidates, page = 1) {
  const approximate = candidates.map((template) => ({ template, score: approximateArabicMatchScore(query, { title: template.fileName, description: "" }) })).filter((result) => result.score > 0).sort((left, right) => right.score - left.score || left.template.sortOrder - right.template.sortOrder || left.template.id - right.template.id);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * CONTRACT_TEMPLATE_SEARCH_PAGE_SIZE;
  return {
    templates: approximate.slice(start, start + CONTRACT_TEMPLATE_SEARCH_PAGE_SIZE).map((result) => result.template),
    total: approximate.length
  };
}
async function searchTelegramContractTemplates(sessionId, page = 1) {
  const db = await getDb();
  if (!db) return void 0;
  const now = /* @__PURE__ */ new Date();
  const sessionResult = await db.select().from(telegramContractTemplateSearchSessions).where(and(eq(telegramContractTemplateSearchSessions.id, sessionId), eq(telegramContractTemplateSearchSessions.status, "ready"), gt(telegramContractTemplateSearchSessions.expiresAt, now))).limit(1);
  const session = sessionResult[0];
  if (!session?.query) return void 0;
  const safePage = Math.max(1, page);
  const filter = and(eq(telegramContractTemplates.isActive, true), like(telegramContractTemplates.fileName, `%${session.query}%`));
  const [totalResult, templates] = await Promise.all([
    db.select({ value: count() }).from(telegramContractTemplates).where(filter),
    db.select().from(telegramContractTemplates).where(filter).orderBy(asc(telegramContractTemplates.sortOrder), asc(telegramContractTemplates.id)).limit(CONTRACT_TEMPLATE_SEARCH_PAGE_SIZE).offset((safePage - 1) * CONTRACT_TEMPLATE_SEARCH_PAGE_SIZE)
  ]);
  const total = Number(totalResult[0]?.value ?? 0);
  if (total > 0) return { query: session.query, templates, total, matchType: "exact" };
  const candidates = await db.select().from(telegramContractTemplates).where(eq(telegramContractTemplates.isActive, true)).orderBy(asc(telegramContractTemplates.sortOrder), asc(telegramContractTemplates.id));
  const approximate = fallbackContractTemplateSearchResults(session.query, candidates, safePage);
  return { query: session.query, templates: approximate.templates, total: approximate.total, matchType: "approximate" };
}
async function searchJudicialSources(sessionId, page = 1) {
  const db = await getDb();
  if (!db) return void 0;
  const now = /* @__PURE__ */ new Date();
  const sessionResult = await db.select().from(judicialSearchSessions).where(and(eq(judicialSearchSessions.id, sessionId), eq(judicialSearchSessions.status, "ready"), gt(judicialSearchSessions.expiresAt, now))).limit(1);
  const session = sessionResult[0];
  if (!session?.query) return void 0;
  const pattern = `%${session.query}%`;
  const filter = and(
    eq(legalSources.collection, "judicial"),
    isNotNull(legalSources.driveFolderId),
    or(like(legalSources.title, pattern), like(legalSources.description, pattern))
  );
  const safePage = Math.max(1, page);
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SEARCH_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SEARCH_PAGE_SIZE)
  ]);
  const total = Number(totalResult[0]?.value ?? 0);
  if (total > 0) return { query: session.query, sources, total, matchType: "exact" };
  const candidates = await db.select().from(legalSources).where(and(eq(legalSources.collection, "judicial"), isNotNull(legalSources.driveFolderId))).orderBy(asc(legalSources.sortOrder)).limit(2e3);
  const approximate = fallbackJudicialSearchResults(session.query, candidates, safePage);
  return {
    query: session.query,
    sources: approximate.sources,
    total: approximate.total,
    matchType: "approximate"
  };
}
async function searchLegislationSources(sessionId, page = 1) {
  const db = await getDb();
  if (!db) return void 0;
  const now = /* @__PURE__ */ new Date();
  const sessionResult = await db.select().from(legislationSearchSessions).where(and(eq(legislationSearchSessions.id, sessionId), eq(legislationSearchSessions.status, "ready"), gt(legislationSearchSessions.expiresAt, now))).limit(1);
  const session = sessionResult[0];
  if (!session?.query) return void 0;
  const pattern = `%${session.query}%`;
  const legislation = "legislation";
  const filter = and(
    eq(legalSources.collection, legislation),
    or(like(legalSources.title, pattern), like(legalSources.description, pattern))
  );
  const safePage = Math.max(1, page);
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SEARCH_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SEARCH_PAGE_SIZE)
  ]);
  const total = Number(totalResult[0]?.value ?? 0);
  if (total > 0) return { query: session.query, sources, total, matchType: "exact" };
  const candidates = await db.select().from(legalSources).where(eq(legalSources.collection, legislation)).orderBy(asc(legalSources.sortOrder)).limit(2e3);
  const approximate = fallbackJudicialSearchResults(session.query, candidates, safePage);
  return {
    query: session.query,
    sources: approximate.sources,
    total: approximate.total,
    matchType: "approximate"
  };
}
async function searchAllYemeniLawsSources(sessionId, page = 1) {
  const db = await getDb();
  if (!db) return void 0;
  const now = /* @__PURE__ */ new Date();
  const sessionResult = await db.select().from(allYemeniLawsSearchSessions).where(and(eq(allYemeniLawsSearchSessions.id, sessionId), eq(allYemeniLawsSearchSessions.status, "ready"), gt(allYemeniLawsSearchSessions.expiresAt, now))).limit(1);
  const session = sessionResult[0];
  if (!session?.query) return void 0;
  const pattern = `%${session.query}%`;
  const allYemeniLaws = "all_yemeni_laws";
  const filter = and(
    eq(legalSources.collection, allYemeniLaws),
    or(like(legalSources.title, pattern), like(legalSources.description, pattern))
  );
  const safePage = Math.max(1, page);
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE)
  ]);
  const total = Number(totalResult[0]?.value ?? 0);
  if (total > 0) return { query: session.query, sources, total, matchType: "exact" };
  const candidates = await db.select().from(legalSources).where(eq(legalSources.collection, allYemeniLaws)).orderBy(asc(legalSources.sortOrder)).limit(2e3);
  const approximate = fallbackJudicialSearchResults(session.query, candidates, safePage);
  return {
    query: session.query,
    sources: approximate.sources,
    total: approximate.total,
    matchType: "approximate"
  };
}
async function searchLibrarySources(sessionId, page = 1) {
  const db = await getDb();
  if (!db) return void 0;
  const now = /* @__PURE__ */ new Date();
  const sessionResult = await db.select().from(librarySearchSessions).where(and(eq(librarySearchSessions.id, sessionId), eq(librarySearchSessions.status, "ready"), gt(librarySearchSessions.expiresAt, now))).limit(1);
  const session = sessionResult[0];
  if (!session?.query) return void 0;
  const pattern = `%${session.query}%`;
  const filter = and(
    eq(legalSources.collection, "judicial"),
    or(like(legalSources.title, pattern), like(legalSources.description, pattern))
  );
  const safePage = Math.max(1, page);
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SEARCH_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SEARCH_PAGE_SIZE)
  ]);
  const total = Number(totalResult[0]?.value ?? 0);
  if (total > 0) return { query: session.query, sources, total, matchType: "exact" };
  const candidates = await db.select().from(legalSources).where(eq(legalSources.collection, "judicial")).orderBy(asc(legalSources.sortOrder)).limit(2e3);
  const approximate = fallbackJudicialSearchResults(session.query, candidates, safePage);
  return {
    query: session.query,
    sources: approximate.sources,
    total: approximate.total,
    matchType: "approximate"
  };
}

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}
async function storageGetSignedUrl(relKey) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json();
  return url;
}

// server/_core/heartbeat.ts
import { TRPCError } from "@trpc/server";
var SERVICE = "webdevtoken.v1.WebDevService";
var buildEndpoint = (rpc) => {
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service URL is not configured (BUILT_IN_FORGE_API_URL)."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Heartbeat service API key is not configured (BUILT_IN_FORGE_API_KEY)."
    });
  }
  const baseUrl = ENV.forgeApiUrl;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${SERVICE}/${rpc}`, normalizedBase).toString();
};
var callForge = async (rpc, body, userSession) => {
  const endpoint = buildEndpoint(rpc);
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${ENV.forgeApiKey}`,
    "content-type": "application/json",
    "connect-protocol-version": "1"
  };
  if (userSession) {
    headers["x-manus-user-session"] = userSession;
  }
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Heartbeat ${rpc} network error: ${String(error)}`
    });
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw mapForgeError(response, detail, rpc);
  }
  return await response.json();
};
var mapForgeError = (response, detail, rpc) => {
  const status = response.status;
  let code = "INTERNAL_SERVER_ERROR";
  if (status === 401) code = "UNAUTHORIZED";
  else if (status === 403) code = "FORBIDDEN";
  else if (status === 404) code = "NOT_FOUND";
  else if (status === 400 || status === 422) code = "BAD_REQUEST";
  else if (status === 409) code = "CONFLICT";
  else if (status === 429) code = "TOO_MANY_REQUESTS";
  return new TRPCError({
    code,
    message: `Heartbeat ${rpc} failed (${status})${detail ? `: ${detail}` : ""}`
  });
};
var stringifyPayload = (payload) => {
  if (payload === void 0 || payload === null) return "{}";
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload);
};
var validateCallbackPath = (path) => {
  if (!path || !path.startsWith("/api/scheduled/")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "callback path must start with /api/scheduled/"
    });
  }
};
async function createHeartbeatJob(job, userSession) {
  validateCallbackPath(job.path);
  return callForge(
    "CreateHeartbeatJob",
    {
      name: job.name,
      cronExpression: job.cron,
      callbackPath: job.path,
      callbackMethod: job.method ?? "POST",
      callbackPayload: stringifyPayload(job.payload),
      description: job.description ?? ""
    },
    userSession
  );
}
async function deleteHeartbeatJob(taskUid, userSession) {
  await callForge("DeleteHeartbeatJob", { taskUid }, userSession);
}

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/telegramExamDb.ts
import { and as and2, asc as asc2, count as count2, eq as eq2, isNull as isNull2 } from "drizzle-orm";
async function listTelegramExamForms(subjectKey) {
  const db = await getDb();
  if (!db || !subjectKey) return [];
  return db.select({
    formKey: telegramExamForms.formKey,
    formName: telegramExamForms.formName,
    sortOrder: telegramExamForms.sortOrder,
    questionCount: count2(telegramExamQuestions.id)
  }).from(telegramExamForms).leftJoin(telegramExamQuestions, and2(
    eq2(telegramExamQuestions.subjectKey, telegramExamForms.subjectKey),
    eq2(telegramExamQuestions.sectionKey, telegramExamForms.formKey),
    eq2(telegramExamQuestions.isActive, true)
  )).where(and2(eq2(telegramExamForms.subjectKey, subjectKey), eq2(telegramExamForms.isActive, true))).groupBy(telegramExamForms.id, telegramExamForms.formKey, telegramExamForms.formName, telegramExamForms.sortOrder).orderBy(asc2(telegramExamForms.sortOrder), asc2(telegramExamForms.id));
}
async function listTelegramExamQuestions(subjectKey, sectionKey) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: telegramExamQuestions.id,
    questionText: telegramExamQuestions.questionText,
    optionA: telegramExamQuestions.optionA,
    optionB: telegramExamQuestions.optionB,
    optionC: telegramExamQuestions.optionC,
    optionD: telegramExamQuestions.optionD,
    correctOption: telegramExamQuestions.correctOption,
    explanation: telegramExamQuestions.explanation,
    hint: telegramExamQuestions.hint,
    sortOrder: telegramExamQuestions.sortOrder
  }).from(telegramExamQuestions).where(and2(
    eq2(telegramExamQuestions.subjectKey, subjectKey),
    eq2(telegramExamQuestions.sectionKey, sectionKey),
    eq2(telegramExamQuestions.isActive, true)
  )).orderBy(asc2(telegramExamQuestions.sortOrder), asc2(telegramExamQuestions.id));
}
async function startTelegramExamSession(telegramUserId, chatId, subjectKey, sectionKey, timeLimitSeconds) {
  const db = await getDb();
  if (!db || ![15, 30, 60, 300].includes(timeLimitSeconds) || (await listTelegramExamQuestions(subjectKey, sectionKey)).length === 0) return void 0;
  await db.update(telegramExamSessions).set({ status: "cancelled", completedAt: /* @__PURE__ */ new Date(), activePollId: null }).where(and2(
    eq2(telegramExamSessions.telegramUserId, telegramUserId),
    eq2(telegramExamSessions.chatId, chatId),
    eq2(telegramExamSessions.status, "active")
  ));
  const result = await db.insert(telegramExamSessions).values({ telegramUserId, chatId, subjectKey, sectionKey, timeLimitSeconds }).$returningId();
  const id = Number(result[0]?.id ?? 0);
  return id > 0 ? { id } : void 0;
}
async function getTelegramExamSession(sessionId, telegramUserId) {
  const db = await getDb();
  if (!db || !Number.isInteger(sessionId) || sessionId < 1) return void 0;
  const rows = await db.select().from(telegramExamSessions).where(and2(eq2(telegramExamSessions.id, sessionId), eq2(telegramExamSessions.telegramUserId, telegramUserId))).limit(1);
  return rows[0];
}
async function setTelegramExamActivePoll(input) {
  const db = await getDb();
  if (!db || !input.pollId || !Number.isInteger(input.sessionId) || input.sessionId < 1) return false;
  const result = await db.update(telegramExamSessions).set({ activePollId: input.pollId }).where(and2(
    eq2(telegramExamSessions.id, input.sessionId),
    eq2(telegramExamSessions.telegramUserId, input.telegramUserId),
    eq2(telegramExamSessions.status, "active"),
    eq2(telegramExamSessions.questionIndex, input.questionIndex),
    isNull2(telegramExamSessions.activePollId)
  ));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
async function getTelegramExamSessionByPoll(pollId) {
  const db = await getDb();
  if (!db || !pollId) return void 0;
  const rows = await db.select().from(telegramExamSessions).where(and2(eq2(telegramExamSessions.activePollId, pollId), eq2(telegramExamSessions.status, "active"))).limit(1);
  return rows[0];
}
async function cancelTelegramExamSession(telegramUserId, chatId) {
  const db = await getDb();
  if (!db) return void 0;
  const sessions = await db.select({
    id: telegramExamSessions.id,
    subjectKey: telegramExamSessions.subjectKey,
    sectionKey: telegramExamSessions.sectionKey
  }).from(telegramExamSessions).where(and2(
    eq2(telegramExamSessions.telegramUserId, telegramUserId),
    eq2(telegramExamSessions.chatId, chatId),
    eq2(telegramExamSessions.status, "active")
  )).limit(1);
  const session = sessions[0];
  if (!session) return void 0;
  const result = await db.update(telegramExamSessions).set({ status: "cancelled", completedAt: /* @__PURE__ */ new Date(), activePollId: null }).where(and2(
    eq2(telegramExamSessions.id, session.id),
    eq2(telegramExamSessions.telegramUserId, telegramUserId),
    eq2(telegramExamSessions.chatId, chatId),
    eq2(telegramExamSessions.status, "active")
  ));
  return Number(result[0]?.affectedRows ?? 0) > 0 ? { subjectKey: session.subjectKey, sectionKey: session.sectionKey } : void 0;
}
async function resolveTelegramExamPoll(input) {
  const db = await getDb();
  if (!db || !Number.isInteger(input.sessionId) || input.sessionId < 1 || input.questionIndex < 0 || !input.pollId) return void 0;
  const session = await getTelegramExamSession(input.sessionId, input.telegramUserId);
  if (!session || session.status !== "active" || session.questionIndex !== input.questionIndex || session.activePollId !== input.pollId) return void 0;
  const questions = await listTelegramExamQuestions(session.subjectKey, session.sectionKey);
  const question = questions[input.questionIndex];
  if (!question) return void 0;
  const missed = !input.answer;
  const isCorrect = !missed && question.correctOption === input.answer;
  const nextQuestionIndex = input.questionIndex + 1;
  const completed = nextQuestionIndex >= questions.length;
  const score = session.score + (isCorrect ? 1 : 0);
  const incorrectCount = session.incorrectCount + (!missed && !isCorrect ? 1 : 0);
  const missedCount = session.missedCount + (missed ? 1 : 0);
  const result = await db.update(telegramExamSessions).set({
    questionIndex: nextQuestionIndex,
    score,
    incorrectCount,
    missedCount,
    status: completed ? "completed" : "active",
    completedAt: completed ? /* @__PURE__ */ new Date() : null,
    activePollId: null
  }).where(and2(
    eq2(telegramExamSessions.id, input.sessionId),
    eq2(telegramExamSessions.telegramUserId, input.telegramUserId),
    eq2(telegramExamSessions.status, "active"),
    eq2(telegramExamSessions.questionIndex, input.questionIndex),
    eq2(telegramExamSessions.activePollId, input.pollId)
  ));
  if (Number(result[0]?.affectedRows ?? 0) < 1) return void 0;
  return {
    question,
    isCorrect,
    missed,
    score,
    incorrectCount,
    missedCount,
    nextQuestionIndex,
    total: questions.length,
    completed,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1e3))
  };
}
async function advanceTelegramExamWrittenQuestion(input) {
  const db = await getDb();
  if (!db || !Number.isInteger(input.sessionId) || input.sessionId < 1 || input.questionIndex < 0) return void 0;
  const session = await getTelegramExamSession(input.sessionId, input.telegramUserId);
  if (!session || session.status !== "active" || session.questionIndex !== input.questionIndex || session.activePollId) return void 0;
  const questions = await listTelegramExamQuestions(session.subjectKey, session.sectionKey);
  const question = questions[input.questionIndex];
  if (!question || [question.optionA, question.optionB, question.optionC, question.optionD].some((option) => option.trim())) return void 0;
  const nextQuestionIndex = input.questionIndex + 1;
  const completed = nextQuestionIndex >= questions.length;
  const result = await db.update(telegramExamSessions).set({
    questionIndex: nextQuestionIndex,
    missedCount: session.missedCount + 1,
    status: completed ? "completed" : "active",
    completedAt: completed ? /* @__PURE__ */ new Date() : null,
    activePollId: null
  }).where(and2(
    eq2(telegramExamSessions.id, input.sessionId),
    eq2(telegramExamSessions.telegramUserId, input.telegramUserId),
    eq2(telegramExamSessions.status, "active"),
    eq2(telegramExamSessions.questionIndex, input.questionIndex),
    isNull2(telegramExamSessions.activePollId)
  ));
  if (Number(result[0]?.affectedRows ?? 0) < 1) return void 0;
  return {
    score: session.score,
    incorrectCount: session.incorrectCount,
    missedCount: session.missedCount + 1,
    nextQuestionIndex,
    total: questions.length,
    completed,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1e3))
  };
}

// server/telegramGroupExamDb.ts
import { and as and3, asc as asc3, eq as eq3, isNull as isNull3 } from "drizzle-orm";
function affectedRows(result) {
  return Number(result[0]?.affectedRows ?? 0);
}
function asRoundRecord(round) {
  return {
    id: round.id,
    chatId: round.chatId,
    creatorTelegramUserId: round.creatorTelegramUserId,
    subjectKey: round.subjectKey,
    sectionKey: round.sectionKey,
    status: round.status,
    questionIndex: round.questionIndex,
    timeLimitSeconds: round.timeLimitSeconds,
    activePollId: round.activePollId,
    startedAt: round.startedAt
  };
}
async function getTelegramGroupExamRoundByPoll(pollId) {
  const db = await getDb();
  if (!db || !pollId) return void 0;
  const rows = await db.select().from(telegramGroupExamRounds).where(and3(eq3(telegramGroupExamRounds.activePollId, pollId), eq3(telegramGroupExamRounds.status, "active"))).limit(1);
  return rows[0] ? asRoundRecord(rows[0]) : void 0;
}
async function getTelegramGroupExamWaitingRound(chatId, subjectKey, sectionKey) {
  const db = await getDb();
  if (!db || !chatId) return void 0;
  const rows = await db.select().from(telegramGroupExamRounds).where(and3(
    eq3(telegramGroupExamRounds.chatId, chatId),
    eq3(telegramGroupExamRounds.subjectKey, subjectKey),
    eq3(telegramGroupExamRounds.sectionKey, sectionKey),
    eq3(telegramGroupExamRounds.status, "waiting")
  )).orderBy(asc3(telegramGroupExamRounds.id)).limit(1);
  return rows[0] ? asRoundRecord(rows[0]) : void 0;
}
async function createTelegramGroupExamRound(input) {
  const db = await getDb();
  if (!db || !input.chatId || !input.creatorTelegramUserId || ![15, 30, 60, 300].includes(input.timeLimitSeconds)) return void 0;
  const questions = await listTelegramExamQuestions(input.subjectKey, input.sectionKey);
  if (questions.length === 0) return void 0;
  const activeRows = await db.select().from(telegramGroupExamRounds).where(and3(
    eq3(telegramGroupExamRounds.chatId, input.chatId),
    eq3(telegramGroupExamRounds.subjectKey, input.subjectKey),
    eq3(telegramGroupExamRounds.sectionKey, input.sectionKey),
    eq3(telegramGroupExamRounds.status, "active")
  )).orderBy(asc3(telegramGroupExamRounds.id)).limit(1);
  if (activeRows[0]) {
    return { round: asRoundRecord(activeRows[0]), created: false };
  }
  const waitingRound = await getTelegramGroupExamWaitingRound(input.chatId, input.subjectKey, input.sectionKey);
  if (waitingRound) return { round: waitingRound, created: false };
  const created = await db.insert(telegramGroupExamRounds).values({
    chatId: input.chatId,
    creatorTelegramUserId: input.creatorTelegramUserId,
    subjectKey: input.subjectKey,
    sectionKey: input.sectionKey,
    timeLimitSeconds: input.timeLimitSeconds
  }).$returningId();
  const id = Number(created[0]?.id ?? 0);
  if (id < 1) return void 0;
  const rows = await db.select().from(telegramGroupExamRounds).where(eq3(telegramGroupExamRounds.id, id)).limit(1);
  return rows[0] ? { round: asRoundRecord(rows[0]), created: true } : void 0;
}
async function joinTelegramGroupExamRound(input) {
  const db = await getDb();
  if (!db || !Number.isInteger(input.roundId) || input.roundId < 1 || !input.telegramUserId) return void 0;
  const round = await getTelegramGroupExamRound(input.roundId);
  if (!round || round.status !== "waiting") return void 0;
  const existingParticipant = await db.select({ id: telegramGroupExamParticipants.id }).from(telegramGroupExamParticipants).where(and3(eq3(telegramGroupExamParticipants.roundId, round.id), eq3(telegramGroupExamParticipants.telegramUserId, input.telegramUserId))).limit(1);
  let joined = false;
  if (existingParticipant.length === 0) {
    try {
      await db.insert(telegramGroupExamParticipants).values({
        roundId: round.id,
        telegramUserId: input.telegramUserId,
        displayName: input.displayName.slice(0, 255),
        username: input.username?.slice(0, 64) || null
      });
      joined = true;
    } catch {
      joined = false;
    }
  }
  const participants = await db.select({ id: telegramGroupExamParticipants.id }).from(telegramGroupExamParticipants).where(eq3(telegramGroupExamParticipants.roundId, round.id));
  return { round, participantCount: participants.length, joined };
}
async function activateTelegramGroupExamRound(roundId) {
  const db = await getDb();
  if (!db || !Number.isInteger(roundId) || roundId < 1) return void 0;
  const participants = await db.select({ id: telegramGroupExamParticipants.id }).from(telegramGroupExamParticipants).where(eq3(telegramGroupExamParticipants.roundId, roundId));
  if (participants.length < 3) return void 0;
  const updated = await db.update(telegramGroupExamRounds).set({ status: "active", startedAt: /* @__PURE__ */ new Date() }).where(and3(eq3(telegramGroupExamRounds.id, roundId), eq3(telegramGroupExamRounds.status, "waiting")));
  if (affectedRows(updated) < 1) return void 0;
  const rows = await db.select().from(telegramGroupExamRounds).where(eq3(telegramGroupExamRounds.id, roundId)).limit(1);
  return rows[0] ? asRoundRecord(rows[0]) : void 0;
}
async function getTelegramGroupExamRound(roundId) {
  const db = await getDb();
  if (!db || !Number.isInteger(roundId) || roundId < 1) return void 0;
  const rows = await db.select().from(telegramGroupExamRounds).where(eq3(telegramGroupExamRounds.id, roundId)).limit(1);
  return rows[0] ? asRoundRecord(rows[0]) : void 0;
}
async function cancelTelegramGroupExamRound(roundId) {
  const db = await getDb();
  if (!db || !Number.isInteger(roundId) || roundId < 1) return false;
  const result = await db.update(telegramGroupExamRounds).set({ status: "cancelled", activePollId: null, completedAt: /* @__PURE__ */ new Date() }).where(and3(
    eq3(telegramGroupExamRounds.id, roundId),
    eq3(telegramGroupExamRounds.status, "waiting")
  ));
  if (affectedRows(result) > 0) return true;
  const activeResult = await db.update(telegramGroupExamRounds).set({ status: "cancelled", activePollId: null, completedAt: /* @__PURE__ */ new Date() }).where(and3(
    eq3(telegramGroupExamRounds.id, roundId),
    eq3(telegramGroupExamRounds.status, "active")
  ));
  return affectedRows(activeResult) > 0;
}
async function setTelegramGroupExamActivePoll(input) {
  const db = await getDb();
  if (!db || !input.pollId || input.roundId < 1 || input.questionIndex < 0) return false;
  const result = await db.update(telegramGroupExamRounds).set({ activePollId: input.pollId }).where(and3(
    eq3(telegramGroupExamRounds.id, input.roundId),
    eq3(telegramGroupExamRounds.status, "active"),
    eq3(telegramGroupExamRounds.questionIndex, input.questionIndex),
    isNull3(telegramGroupExamRounds.activePollId)
  ));
  return affectedRows(result) > 0;
}
async function recordTelegramGroupExamAnswer(input) {
  const db = await getDb();
  if (!db || !input.pollId || !input.telegramUserId) return false;
  const round = await getTelegramGroupExamRoundByPoll(input.pollId);
  if (!round) return false;
  const participant = await db.select({ id: telegramGroupExamParticipants.id }).from(telegramGroupExamParticipants).where(and3(eq3(telegramGroupExamParticipants.roundId, round.id), eq3(telegramGroupExamParticipants.telegramUserId, input.telegramUserId))).limit(1);
  if (participant.length === 0) return false;
  await db.insert(telegramGroupExamAnswers).values({
    roundId: round.id,
    questionIndex: round.questionIndex,
    telegramUserId: input.telegramUserId,
    answer: input.answer
  }).onDuplicateKeyUpdate({ set: { answer: input.answer } });
  return true;
}
async function resolveTelegramGroupExamPoll(pollId) {
  const db = await getDb();
  if (!db || !pollId) return void 0;
  const round = await getTelegramGroupExamRoundByPoll(pollId);
  if (!round) return void 0;
  const questions = await listTelegramExamQuestions(round.subjectKey, round.sectionKey);
  const question = questions[round.questionIndex];
  if (!question) return void 0;
  const nextQuestionIndex = round.questionIndex + 1;
  const completed = nextQuestionIndex >= questions.length;
  const locked = await db.update(telegramGroupExamRounds).set({
    questionIndex: nextQuestionIndex,
    status: completed ? "completed" : "active",
    activePollId: null,
    completedAt: completed ? /* @__PURE__ */ new Date() : null
  }).where(and3(
    eq3(telegramGroupExamRounds.id, round.id),
    eq3(telegramGroupExamRounds.status, "active"),
    eq3(telegramGroupExamRounds.questionIndex, round.questionIndex),
    eq3(telegramGroupExamRounds.activePollId, pollId)
  ));
  if (affectedRows(locked) < 1) return void 0;
  const [participants, answers] = await Promise.all([
    db.select().from(telegramGroupExamParticipants).where(eq3(telegramGroupExamParticipants.roundId, round.id)),
    db.select().from(telegramGroupExamAnswers).where(and3(
      eq3(telegramGroupExamAnswers.roundId, round.id),
      eq3(telegramGroupExamAnswers.questionIndex, round.questionIndex)
    ))
  ]);
  const answersByUser = new Map(answers.map((answer) => [answer.telegramUserId, answer.answer]));
  let correctCount = 0;
  let incorrectCount = 0;
  let missedCount = 0;
  for (const participant of participants) {
    const answer = answersByUser.get(participant.telegramUserId);
    const correct = answer === question.correctOption;
    if (!answer) missedCount += 1;
    else if (correct) correctCount += 1;
    else incorrectCount += 1;
    await db.update(telegramGroupExamParticipants).set({
      score: participant.score + (correct ? 1 : 0),
      incorrectCount: participant.incorrectCount + (answer && !correct ? 1 : 0),
      missedCount: participant.missedCount + (!answer ? 1 : 0)
    }).where(eq3(telegramGroupExamParticipants.id, participant.id));
  }
  return {
    question,
    correctCount,
    incorrectCount,
    missedCount,
    participantCount: participants.length,
    nextQuestionIndex,
    total: questions.length,
    completed
  };
}
async function getTelegramGroupExamLeaderboard(roundId) {
  const db = await getDb();
  if (!db || roundId < 1) return [];
  const participants = await db.select({
    telegramUserId: telegramGroupExamParticipants.telegramUserId,
    displayName: telegramGroupExamParticipants.displayName,
    score: telegramGroupExamParticipants.score,
    incorrectCount: telegramGroupExamParticipants.incorrectCount,
    missedCount: telegramGroupExamParticipants.missedCount
  }).from(telegramGroupExamParticipants).where(eq3(telegramGroupExamParticipants.roundId, roundId));
  return participants.sort(
    (a, b) => b.score - a.score || a.incorrectCount - b.incorrectCount || a.missedCount - b.missedCount || a.displayName.localeCompare(b.displayName, "ar")
  );
}

// server/telegramExamResults.ts
import { and as and4, eq as eq4 } from "drizzle-orm";
function toSnapshot(row) {
  return {
    score: row.score,
    incorrectCount: row.incorrectCount,
    missedCount: row.missedCount,
    elapsedSeconds: Math.max(0, Math.floor(((row.completedAt ?? /* @__PURE__ */ new Date()).getTime() - row.startedAt.getTime()) / 1e3))
  };
}
function compareResults(left, right) {
  return right.score - left.score || left.incorrectCount - right.incorrectCount || left.missedCount - right.missedCount || left.elapsedSeconds - right.elapsedSeconds;
}
async function getTelegramExamResultSummary(sessionId, telegramUserId) {
  const db = await getDb();
  if (!db || !Number.isInteger(sessionId) || sessionId < 1) return void 0;
  const currentRows = await db.select().from(telegramExamSessions).where(and4(eq4(telegramExamSessions.id, sessionId), eq4(telegramExamSessions.telegramUserId, telegramUserId), eq4(telegramExamSessions.status, "completed"))).limit(1);
  const current = currentRows[0];
  if (!current) return void 0;
  const completed = await db.select().from(telegramExamSessions).where(and4(
    eq4(telegramExamSessions.subjectKey, current.subjectKey),
    eq4(telegramExamSessions.sectionKey, current.sectionKey),
    eq4(telegramExamSessions.status, "completed")
  ));
  const previousBest = completed.filter((row) => row.telegramUserId === telegramUserId && row.id !== sessionId).map(toSnapshot).sort(compareResults)[0];
  const bestByUser = /* @__PURE__ */ new Map();
  for (const row of completed) {
    const candidate = toSnapshot(row);
    const known = bestByUser.get(row.telegramUserId);
    if (!known || compareResults(candidate, known) < 0) bestByUser.set(row.telegramUserId, candidate);
  }
  const leaderboard = Array.from(bestByUser.entries()).sort(([, left], [, right]) => compareResults(left, right));
  const leaderboardResult = bestByUser.get(telegramUserId) ?? toSnapshot(current);
  const rank = Math.max(1, leaderboard.findIndex(([userId]) => userId === telegramUserId) + 1);
  const totalParticipants = Math.max(1, leaderboard.length);
  return {
    previousBest,
    leaderboardResult,
    rank,
    totalParticipants,
    percentile: Math.floor((totalParticipants - rank + 1) / totalParticipants * 100)
  };
}

// server/telegramExam.ts
var CIVIL_LAW_EXAM_SUBJECT_KEY = "civil_law";
var CIVIL_LAW_GENERAL_2025_SECTION_KEY = "general_2025";
var CIVIL_LAW_GENERAL_2025_TITLE = "\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u062F\u0646\u064A (\u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0639\u0627\u0645 2025)";
var USUL_FIQH_EXAM_SUBJECT_KEY = "l1_usul_fiqh";
var SECONDARY_EXAM_SUBJECT_KEY_PREFIX = "exam_secondary_";
function isSecondaryExamSubjectKey(subjectKey) {
  return subjectKey.startsWith(SECONDARY_EXAM_SUBJECT_KEY_PREFIX);
}
var importedSubjectKeys = {
  "l1:l1-usul": USUL_FIQH_EXAM_SUBJECT_KEY,
  "l1:l1-criminology": "l1_criminology",
  "l4:l4-civil-law": CIVIL_LAW_EXAM_SUBJECT_KEY,
  // مفاتيح التوافق مع النسخة القديمة من كتالوج الثانوية.
  "secondary:math": "exam_secondary_math",
  "secondary:history": "exam_secondary_history",
  "secondary:arabic": "exam_secondary_arabic",
  "secondary:geography": "exam_secondary_geography",
  "secondary:quran": "exam_secondary_quran",
  "secondary:philosophy": "exam_secondary_philosophy",
  "secondary:islamic": "exam_secondary_islamic",
  "secondary:english": "exam_secondary_english",
  "secondary:chemistry": "exam_secondary_chemistry",
  // النسخة الجديدة: كل قسم ثانوي له مفاتيح مستقلة حتى لا تختلط النماذج.
  "secondary-literary:history": "exam_secondary_literary_history",
  "secondary-literary:geography": "exam_secondary_literary_geography",
  "secondary-literary:philosophy": "exam_secondary_literary_philosophy",
  "secondary-literary:islamic": "exam_secondary_literary_islamic",
  "secondary-literary:arabic": "exam_secondary_literary_arabic",
  "secondary-literary:quran": "exam_secondary_literary_quran",
  "secondary-literary:english": "exam_secondary_literary_english",
  "secondary-literary:math": "exam_secondary_literary_math",
  "secondary-scientific:quran": "exam_secondary_scientific_quran",
  "secondary-scientific:islamic": "exam_secondary_scientific_islamic",
  "secondary-scientific:arabic": "exam_secondary_scientific_arabic",
  "secondary-scientific:english": "exam_secondary_scientific_english",
  "secondary-scientific:biology": "exam_secondary_scientific_biology",
  "secondary-scientific:physics": "exam_secondary_scientific_physics",
  "secondary-scientific:chemistry": "exam_secondary_scientific_chemistry"
};
function getImportedExamSubjectKey(levelKey, catalogSubjectKey) {
  const configuredKey = importedSubjectKeys[`${levelKey}:${catalogSubjectKey}`];
  if (configuredKey) return configuredKey;
  const level = getTelegramExamCatalogLevel(levelKey);
  const subject = getTelegramExamCatalogSubject(levelKey, catalogSubjectKey);
  if (!level || level.comingSoon || !subject) return void 0;
  return `exam_${levelKey}_${catalogSubjectKey.replace(/[^a-z0-9]+/gi, "_")}`;
}
function getImportedExamCatalogLocation(subjectKey) {
  for (const level of TELEGRAM_EXAM_CATALOG) {
    for (const subject of level.subjects) {
      if (getImportedExamSubjectKey(level.key, subject.key) === subjectKey) return { levelKey: level.key, catalogSubjectKey: subject.key };
    }
  }
  return void 0;
}
var TELEGRAM_EXAM_CATALOG = [
  {
    key: "l1",
    name: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0623\u0648\u0644",
    subjects: [
      { key: "l1-usul", name: "\u0627\u0635\u0648\u0644 \u0627\u0644\u0641\u0642\u0647", hasQuestions: true },
      { key: "l1-criminology", name: "\u0639\u0644\u0645 \u0627\u0644\u0627\u062C\u0631\u0627\u0645 \u0648\u0627\u0644\u0639\u0642\u0627\u0628", hasQuestions: true },
      { key: "l1-political-systems", name: "\u0627\u0644\u0646\u0638\u0645 \u0627\u0644\u0633\u064A\u0627\u0633\u064A\u0629", hasQuestions: false },
      { key: "l1-history-law", name: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0648\u0641\u0644\u0633\u0641\u062A\u0647", hasQuestions: false },
      { key: "l1-economics", name: "\u0645\u0628\u0627\u062F\u0626 \u0627\u0644\u0627\u0642\u062A\u0635\u0627\u062F \u0648\u0627\u0644\u0627\u0642\u062A\u0635\u0627\u062F \u0627\u0644\u0627\u0633\u0644\u0627\u0645\u064A", hasQuestions: false },
      { key: "l1-national-culture", name: "\u0627\u0644\u062B\u0642\u0627\u0641\u0629 \u0627\u0644\u0648\u0637\u0646\u064A\u0629", hasQuestions: false },
      { key: "l1-worship", name: "\u0641\u0642\u0647 \u0627\u0644\u0639\u0628\u0627\u062F\u0627\u062A", hasQuestions: false },
      { key: "l1-computer", name: "\u062D\u0627\u0633\u0648\u0628", hasQuestions: false },
      { key: "l1-fiqh-intro", name: "\u0645\u062F\u062E\u0644 \u0627\u0644\u0641\u0642\u0647", hasQuestions: false },
      { key: "l1-arab-conflict", name: "\u0627\u0644\u0635\u0631\u0627\u0639 \u0627\u0644\u0639\u0631\u0628\u064A", hasQuestions: false },
      { key: "l1-arabic", name: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629", hasQuestions: false },
      { key: "l1-law-intro", name: "\u0645\u062F\u062E\u0644 \u0627\u0644\u0642\u0627\u0646\u0648\u0646", hasQuestions: false },
      { key: "l1-hadith", name: "\u0645\u0635\u0637\u0644\u062D \u0627\u0644\u062D\u062F\u064A\u062B", hasQuestions: false },
      { key: "l1-legal-terms", name: "\u0645\u0635\u0637\u0644\u062D\u0627\u062A \u0642\u0627\u0646\u0648\u0646\u064A\u0629", hasQuestions: false }
    ]
  },
  {
    key: "l2",
    name: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062B\u0627\u0646\u064A",
    subjects: [
      { key: "l2-admin-law", name: "\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0627\u062F\u0627\u0631\u064A", hasQuestions: false },
      { key: "l2-civil-law", name: "\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u062F\u0646\u064A", hasQuestions: false },
      { key: "l2-arabic", name: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629", hasQuestions: false },
      { key: "l2-local-admin", name: "\u0627\u0644\u0627\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062D\u0644\u064A\u0629", hasQuestions: false },
      { key: "l2-money-banks", name: "\u0646\u0642\u0648\u062F \u0648\u0628\u0646\u0648\u0643", hasQuestions: false },
      { key: "l2-family", name: "\u0627\u062D\u0643\u0627\u0645 \u0627\u0633\u0631\u0629", hasQuestions: false },
      { key: "l2-organizations-rights", name: "\u0645\u0646\u0638\u0645\u0627\u062A \u0648\u062D\u0642\u0648\u0642", hasQuestions: false },
      { key: "l2-penalties", name: "\u0639\u0642\u0648\u0628\u0627\u062A", hasQuestions: false },
      { key: "l2-islamic-culture", name: "\u062B\u0642\u0627\u0641\u0629 \u0627\u0633\u0644\u0627\u0645\u064A\u0629", hasQuestions: false },
      { key: "l2-usul", name: "\u0627\u0635\u0648\u0644 \u0627\u0644\u0641\u0642\u0629", hasQuestions: false },
      { key: "l2-international-law", name: "\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062F\u0648\u0644\u064A", hasQuestions: false },
      { key: "l2-transactions", name: "\u0641\u0642\u0647 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A", hasQuestions: false }
    ]
  },
  {
    key: "l3",
    name: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062B\u0627\u0644\u062B",
    subjects: [
      { key: "l3-admin-judiciary", name: "\u0627\u0644\u0642\u0636\u0627\u0621 \u0627\u0644\u0627\u062F\u0627\u0631\u064A", hasQuestions: false },
      { key: "l3-civil-law", name: "\u0642\u0627\u0646\u0648\u0646 \u0645\u062F\u0646\u064A", hasQuestions: false },
      { key: "l3-labor-law", name: "\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0639\u0645\u0644", hasQuestions: false },
      { key: "l3-commercial-law", name: "\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062A\u062C\u0627\u0631\u064A", hasQuestions: false },
      { key: "l3-pleadings", name: "\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0627\u062A", hasQuestions: false },
      { key: "l3-inheritance", name: "\u0645\u0648\u0627\u0631\u064A\u062B", hasQuestions: false },
      { key: "l3-criminal-legislation", name: "\u0627\u0644\u062A\u0634\u0631\u064A\u0639 \u0627\u0644\u062C\u0646\u0627\u0626\u064A \u0627\u0644\u0623\u0633\u0644\u0627\u0645\u064A", hasQuestions: false },
      { key: "l3-sirah", name: "\u0641\u0642\u0647 \u0627\u0644\u0633\u064A\u0631\u0629", hasQuestions: false },
      { key: "l3-arabic", name: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629", hasQuestions: false },
      { key: "l3-maritime-air", name: "\u0627\u0644\u0628\u062D\u0631\u064A \u0648\u0627\u0644\u062C\u0648\u064A", hasQuestions: false },
      { key: "l3-transactions", name: "\u0641\u0642\u0629 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A", hasQuestions: false },
      { key: "l3-special-penalties", name: "\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0639\u0642\u0648\u0628\u0627\u062A \u0627\u0644\u062E\u0627\u0635", hasQuestions: false },
      { key: "l3-usul", name: "\u0627\u0635\u0648\u0644 \u0627\u0644\u0641\u0642\u0629", hasQuestions: false }
    ]
  },
  {
    key: "l4",
    name: "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0631\u0627\u0628\u0639",
    subjects: [
      { key: "l4-commercial-law", name: "\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062A\u062C\u0627\u0631\u064A", hasQuestions: false },
      { key: "l4-compulsory-execution", name: "\u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u062C\u0628\u0631\u064A", hasQuestions: false },
      { key: "l4-usul", name: "\u0623\u0635\u0648\u0644 \u0627\u0644\u0641\u0642\u0647", hasQuestions: false },
      { key: "l4-judiciary-proof", name: "\u0627\u0644\u0642\u0636\u0627\u0621 \u0648\u0627\u0644\u0625\u062B\u0628\u0627\u062A \u0627\u0644\u0634\u0631\u0639\u064A", hasQuestions: false },
      { key: "l4-private-international", name: "\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062F\u0648\u0644\u064A \u0627\u0644\u062E\u0627\u0635 - \u0627\u0644\u062C\u0646\u0633\u064A\u0629", hasQuestions: false },
      { key: "l4-interpretation", name: "\u062A\u0641\u0633\u064A\u0631 \u0627\u0644\u0622\u064A\u0627\u062A \u0648\u0623\u062D\u0627\u062F\u064A\u062B \u0627\u0644\u0623\u062D\u0643\u0627\u0645", hasQuestions: false },
      { key: "l4-will-waqf", name: "\u0627\u0644\u0648\u0635\u064A\u0629 \u0648\u0627\u0644\u0648\u0642\u0641 \u0627\u0644\u0634\u0631\u0639\u064A", hasQuestions: false },
      { key: "l4-conflict-laws", name: "\u062A\u0646\u0627\u0632\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0648\u0627\u0644\u0627\u062E\u062A\u0635\u0627\u0635 \u0627\u0644\u0642\u0636\u0627\u0626\u064A \u0627\u0644\u062F\u0648\u0644\u064A", hasQuestions: false },
      { key: "l4-finance-tax", name: "\u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u062A\u0634\u0631\u064A\u0639 \u0627\u0644\u0636\u0631\u064A\u0628\u064A", hasQuestions: false },
      { key: "l4-criminal-procedure", name: "\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062C\u0632\u0627\u0626\u064A\u0629", hasQuestions: false },
      { key: "l4-civil-law", name: "\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u062F\u0646\u064A", hasQuestions: true },
      { key: "l4-arabic", name: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629", hasQuestions: false },
      { key: "l4-research-methods", name: "\u0645\u0646\u0627\u0647\u062C \u0627\u0644\u0628\u062D\u062B", hasQuestions: false }
    ]
  },
  {
    // كتالوج قديم محفوظ للتوافق مع الرسائل السابقة، ولا يظهر في القائمة الجديدة.
    key: "secondary",
    name: "\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629",
    hidden: true,
    subjects: [
      { key: "math", name: "\u0627\u0644\u0631\u064A\u0627\u0636\u064A\u0627\u062A", hasQuestions: true },
      { key: "history", name: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", hasQuestions: true },
      { key: "arabic", name: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629", hasQuestions: true },
      { key: "geography", name: "\u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A\u0627", hasQuestions: true },
      { key: "quran", name: "\u0627\u0644\u0642\u0631\u0622\u0646 \u0627\u0644\u0643\u0631\u064A\u0645", hasQuestions: true },
      { key: "philosophy", name: "\u0627\u0644\u0641\u0644\u0633\u0641\u0629 \u0648\u0627\u0644\u0645\u0646\u0637\u0642 \u0648\u0639\u0644\u0645 \u0627\u0644\u0646\u0641\u0633", hasQuestions: true },
      { key: "islamic", name: "\u0627\u0644\u062A\u0631\u0628\u064A\u0629 \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A\u0629", hasQuestions: true },
      { key: "english", name: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629", hasQuestions: true },
      { key: "chemistry", name: "\u0627\u0644\u0643\u064A\u0645\u064A\u0627\u0621", hasQuestions: true }
    ]
  },
  {
    key: "secondary-literary",
    name: "\u062B\u0627\u0644\u062B \u062B\u0627\u0646\u0648\u064A \u2013 \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0623\u062F\u0628\u064A",
    subjects: [
      { key: "history", name: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", hasQuestions: true },
      { key: "geography", name: "\u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A\u0627", hasQuestions: true },
      { key: "philosophy", name: "\u0627\u0644\u0641\u0644\u0633\u0641\u0629 \u0648\u0627\u0644\u0645\u0646\u0637\u0642 \u0648\u0639\u0644\u0645 \u0627\u0644\u0646\u0641\u0633", hasQuestions: true },
      { key: "islamic", name: "\u0627\u0644\u062A\u0631\u0628\u064A\u0629 \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A\u0629", hasQuestions: true },
      { key: "arabic", name: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629", hasQuestions: true },
      { key: "quran", name: "\u0627\u0644\u0642\u0631\u0622\u0646 \u0627\u0644\u0643\u0631\u064A\u0645", hasQuestions: true },
      { key: "english", name: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629", hasQuestions: true },
      { key: "math", name: "\u0627\u0644\u0631\u064A\u0627\u0636\u064A\u0627\u062A", hasQuestions: true }
    ]
  },
  {
    key: "secondary-scientific",
    name: "\u062B\u0627\u0644\u062B \u062B\u0627\u0646\u0648\u064A \u2013 \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0639\u0644\u0645\u064A",
    subjects: [
      { key: "quran", name: "\u0627\u0644\u0642\u0631\u0622\u0646 \u0627\u0644\u0643\u0631\u064A\u0645", hasQuestions: true },
      { key: "islamic", name: "\u0627\u0644\u062A\u0631\u0628\u064A\u0629 \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A\u0629", hasQuestions: true },
      { key: "arabic", name: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629", hasQuestions: true },
      { key: "english", name: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629", hasQuestions: true },
      { key: "biology", name: "\u0627\u0644\u0623\u062D\u064A\u0627\u0621", hasQuestions: true },
      { key: "physics", name: "\u0627\u0644\u0641\u064A\u0632\u064A\u0627\u0621", hasQuestions: true },
      { key: "chemistry", name: "\u0627\u0644\u0643\u064A\u0645\u064A\u0627\u0621", hasQuestions: true }
    ]
  },
  {
    key: "judicial-academic",
    name: "\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u062A\u0623\u0647\u064A\u0644 \u0627\u0644\u0642\u0636\u0627\u0626\u064A \u0648\u0627\u0644\u0623\u0643\u0627\u062F\u064A\u0645\u064A",
    subjects: [],
    comingSoon: true
  }
];
function getTelegramExamCatalogLevel(levelKey) {
  return TELEGRAM_EXAM_CATALOG.find((level) => level.key === levelKey);
}
function getTelegramExamCatalogSubject(levelKey, subjectKey) {
  return getTelegramExamCatalogLevel(levelKey)?.subjects.find((subject) => subject.key === subjectKey);
}
function examSubjectHeading(levelKey, subject) {
  if (!levelKey.startsWith("secondary-")) return subject.name;
  const academicYear = subject.key === "math" || subject.key === "history" ? "2023\u0645" : "2025\u20142026\u0645";
  return `\u0646\u0645\u0627\u0630\u062C \u0623\u0648\u0627\u0626\u0644 \u0627\u0644\u062C\u0645\u0647\u0648\u0631\u064A\u0629 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0645\u0627\u062F\u0629 ${subject.name} \u0644\u0644\u0639\u0627\u0645 \u0627\u0644\u062F\u0631\u0627\u0633\u064A ${academicYear}`;
}
function civilLawExamMenu() {
  return examLevelsMenu();
}
function secondaryLevelsMenu() {
  return {
    inline_keyboard: [
      ...TELEGRAM_EXAM_CATALOG.filter((level) => level.key.startsWith("secondary-") && !level.hidden).map((level) => [{ text: level.name, callback_data: `exam:level:${level.key}` }]),
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function examLevelsMenu() {
  return {
    inline_keyboard: [
      ...TELEGRAM_EXAM_CATALOG.filter((level) => !level.hidden && !level.key.startsWith("secondary-")).map((level) => [{ text: level.name, callback_data: `exam:level:${level.key}` }]),
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function examSubjectsMenu(levelKey, requestedPage = 1) {
  const level = getTelegramExamCatalogLevel(levelKey);
  if (!level) return examLevelsMenu();
  if (level.comingSoon) {
    return {
      inline_keyboard: [
        [{ text: "\u0642\u0631\u064A\u0628\u064B\u0627", callback_data: `exam:coming-soon:${level.key}` }],
        [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0645\u0633\u062A\u0648\u064A\u0627\u062A", callback_data: "exam:levels" }]
      ]
    };
  }
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(level.subjects.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const pageSubjects = level.subjects.slice((page - 1) * pageSize, page * pageSize);
  const rows = pageSubjects.map((subject) => [
    { text: subject.name, callback_data: `exam:subject:${levelKey}:${subject.key}:${page}` }
  ]);
  if (totalPages > 1) {
    rows.push([
      ...page > 1 ? [{ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `exam:level:${levelKey}:${page - 1}` }] : [],
      { text: `${page}/${totalPages}`, callback_data: "exam:noop" },
      ...page < totalPages ? [{ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `exam:level:${levelKey}:${page + 1}` }] : []
    ]);
  }
  rows.push([{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0645\u0633\u062A\u0648\u064A\u0627\u062A", callback_data: "exam:levels" }]);
  return { inline_keyboard: rows };
}
function isSecondaryExamForm(form) {
  return /^(?:exam_)?secondary_/i.test(form.formKey) || /^20\d{2}\s+النموذج\s+\d+/i.test(form.formName);
}
function examFormIdentity(form) {
  if (isSecondaryExamForm(form)) {
    const year2 = Number(form.formName.match(/20\d{2}/)?.[0] ?? 2026);
    return { year: year2, kind: "secondary" };
  }
  const year = Number(form.formName.match(/20\d{2}/)?.[0] ?? form.formKey.match(/(?:general|parallel|mixed)_(20\d{2})/i)?.[1] ?? 0);
  if (!year) return void 0;
  const value = `${form.formKey} ${form.formName}`;
  if (/general|العام/i.test(value)) return { year, kind: "general" };
  if (/parallel|الموازي/i.test(value)) return { year, kind: "parallel" };
  if (/mixed|المختلط/i.test(value)) return { year, kind: "mixed" };
  return void 0;
}
function isOfficialAnnualExamForm(form) {
  const identity = examFormIdentity(form);
  if (!identity) return false;
  if (identity.kind === "secondary") return true;
  if (identity.kind === "mixed") return false;
  if (identity.year < 2022 || identity.year > 2025) return false;
  if (identity.year <= 2023 && identity.kind !== "general") return false;
  return true;
}
function isExperimentalExamForm(form) {
  const identity = examFormIdentity(form);
  if (!identity) return true;
  return false;
}
function hasExamQuestions(form) {
  return form.questionCount === void 0 || form.questionCount > 0;
}
function officialAnnualForms(forms) {
  const selected = /* @__PURE__ */ new Map();
  for (const form of forms) {
    if (!hasExamQuestions(form) || !isOfficialAnnualExamForm(form)) continue;
    const identity = examFormIdentity(form);
    if (!identity) continue;
    const identityKey = identity.kind === "secondary" ? `${identity.year}:${identity.kind}:${form.formKey}` : `${identity.year}:${identity.kind}`;
    const current = selected.get(identityKey);
    const isCanonicalKey = /^(?:general|parallel)_20\d{2}$/i.test(form.formKey);
    const currentIsCanonicalKey = current ? /^(?:general|parallel)_20\d{2}$/i.test(current.formKey) : false;
    if (!current || isCanonicalKey && !currentIsCanonicalKey) selected.set(identityKey, form);
  }
  return Array.from(selected.values()).sort(annualFormSort);
}
function experimentalForms(forms) {
  return forms.filter((form) => hasExamQuestions(form) && isExperimentalExamForm(form));
}
function annualFormSort(left, right) {
  if (isSecondaryExamForm(left) || isSecondaryExamForm(right)) {
    return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
  }
  const leftYear = Number(left.formName.match(/20\d{2}/)?.[0] ?? 9999);
  const rightYear = Number(right.formName.match(/20\d{2}/)?.[0] ?? 9999);
  if (leftYear !== rightYear) return leftYear - rightYear;
  const priority = (name) => name.includes("\u0627\u0644\u0639\u0627\u0645") ? 1 : name.includes("\u0627\u0644\u0645\u0648\u0627\u0632\u064A") ? 2 : name.includes("\u0627\u0644\u0645\u062E\u062A\u0644\u0637") ? 3 : 4;
  return priority(left.formName) - priority(right.formName) || left.formName.localeCompare(right.formName, "ar");
}
function annualFormDisplayName(form) {
  const year = form.formName.match(/20\d{2}/)?.[0];
  if (!year) return form.formName;
  const type = form.formName.includes("\u0627\u0644\u0639\u0627\u0645") ? "\u0627\u0644\u0639\u0627\u0645" : form.formName.includes("\u0627\u0644\u0645\u0648\u0627\u0632\u064A") ? "\u0627\u0644\u0645\u0648\u0627\u0632\u064A" : form.formName.includes("\u0627\u0644\u0645\u062E\u062A\u0644\u0637") ? "\u0627\u0644\u0645\u062E\u062A\u0644\u0637" : form.formName.replace(year, "").trim();
  return `${year} ${type}`.trim();
}
function pagedFormsMenu(levelKey, subjectKey, forms, requestedPage, navigationPrefix, includeTrainingButton) {
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(forms.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const pageForms = forms.slice((page - 1) * pageSize, page * pageSize);
  const rows = pageForms.map((form) => [
    {
      text: `${isOfficialAnnualExamForm(form) ? annualFormDisplayName(form) : form.formName}${form.questionCount === 0 ? " \u23F3" : ""}`,
      callback_data: `exam:form:${levelKey}:${subjectKey}:${form.sortOrder ?? form.formKey}:${page}`
    }
  ]);
  if (totalPages > 1) {
    rows.push([
      ...page > 1 ? [{ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `${navigationPrefix}:${levelKey}:${subjectKey}:${page - 1}` }] : [],
      { text: `${page}/${totalPages}`, callback_data: "exam:noop" },
      ...page < totalPages ? [{ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `${navigationPrefix}:${levelKey}:${subjectKey}:${page + 1}` }] : []
    ]);
  }
  if (includeTrainingButton) rows.push([{ text: "\u{1F9EA} \u0623\u0633\u0626\u0644\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629", callback_data: `exam:training:${levelKey}:${subjectKey}:1` }]);
  rows.push([{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0645\u0648\u0627\u062F", callback_data: `exam:level:${levelKey}` }]);
  return { inline_keyboard: rows };
}
function examFormsMenu(levelKey, subjectKey, forms, requestedPage = 1) {
  const availableForms = officialAnnualForms(forms);
  return pagedFormsMenu(levelKey, subjectKey, availableForms, requestedPage, "exam:forms", experimentalForms(forms).length > 0);
}
function civilLawExamSectionMenu() {
  return {
    inline_keyboard: [
      [{ text: "\u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0639\u0627\u0645 2025", callback_data: "exam:civil:general2025" }],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0645\u0648\u0627\u062F \u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0631\u0627\u0628\u0639", callback_data: "exam:level:l4" }]
    ]
  };
}
function civilLawExamTimeMenu() {
  return {
    inline_keyboard: [
      [
        { text: "15 \u062B\u0627\u0646\u064A\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: "exam:time:15" },
        { text: "30 \u062B\u0627\u0646\u064A\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: "exam:time:30" }
      ],
      [
        { text: "\u062F\u0642\u064A\u0642\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: "exam:time:60" },
        { text: "5 \u062F\u0642\u0627\u0626\u0642 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: "exam:time:300" }
      ],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u062F\u0646\u064A", callback_data: "exam:civil" }]
    ]
  };
}
function examTimeMenu(subjectKey, formKeyOrSortOrder, backCallback) {
  return {
    inline_keyboard: [
      [
        { text: "15 \u062B\u0627\u0646\u064A\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: `exam:time:${subjectKey}:${formKeyOrSortOrder}:15` },
        { text: "30 \u062B\u0627\u0646\u064A\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: `exam:time:${subjectKey}:${formKeyOrSortOrder}:30` }
      ],
      [
        { text: "\u062F\u0642\u064A\u0642\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: `exam:time:${subjectKey}:${formKeyOrSortOrder}:60` },
        { text: "5 \u062F\u0642\u0627\u0626\u0642 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: `exam:time:${subjectKey}:${formKeyOrSortOrder}:300` }
      ],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0646\u0645\u0627\u0630\u062C", callback_data: backCallback }]
    ]
  };
}
function civilLawExamReadyMenu(sessionId) {
  return {
    inline_keyboard: [
      [{ text: "\u0623\u0646\u0627 \u0645\u0633\u062A\u0639\u062F!", callback_data: `exam:ready:${sessionId}` }],
      [{ text: "\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631", callback_data: `exam:stop:${sessionId}` }]
    ]
  };
}
function formatExamTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return minutes > 0 ? `${minutes} \u062F ${remainder} \u062B` : `${remainder} \u062B`;
}
function optionText(question, option) {
  return option === "A" ? question.optionA : option === "B" ? question.optionB : option === "C" ? question.optionC : question.optionD;
}
function examPollOptionText(subjectKey, option, text2) {
  if (!isSecondaryExamSubjectKey(subjectKey)) return text2;
  if (option === "A" && text2.trim() === "\u0635") return "\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0635\u062D\u064A\u062D\u0629";
  if (option === "B" && text2.trim() === "\u062E") return "\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u062E\u0627\u0637\u0626\u0629";
  return text2;
}
function optionLabel(option) {
  return option === "A" ? "\u0623" : option === "B" ? "\u0628" : option === "C" ? "\u062C" : "\u062F";
}
function isWrittenExamQuestion(question) {
  return [question.optionA, question.optionB, question.optionC, question.optionD].every((option) => !option.trim());
}
function writtenQuestionMenu(sessionId) {
  return {
    inline_keyboard: [
      [{ text: "\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631", callback_data: `exam:written-next:${sessionId}` }],
      [{ text: "\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631", callback_data: `exam:stop:${sessionId}` }]
    ]
  };
}
async function sendExamQuestion(chatId, sessionId, telegramUserId, store, sender) {
  const session = await store.getExamSession(sessionId, telegramUserId);
  if (!session || session.status !== "active") {
    await sender.sendMessage(chatId, "\u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0644\u0633\u0629 \u0627\u062E\u062A\u0628\u0627\u0631 \u0646\u0634\u0637\u0629. \u064A\u0645\u0643\u0646\u0643 \u0628\u062F\u0621 \u0627\u062E\u062A\u0628\u0627\u0631 \u062C\u062F\u064A\u062F \u0645\u0646 \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0639\u0627\u0645 2025.", civilLawExamTimeMenu());
    return;
  }
  const questions = await store.listExamQuestions(session.subjectKey, session.sectionKey);
  const question = questions[session.questionIndex];
  if (!question) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0633\u0624\u0627\u0644 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u062D\u0627\u0644\u064A. \u062D\u0627\u0648\u0644 \u0628\u062F\u0621 \u0627\u062E\u062A\u0628\u0627\u0631 \u062C\u062F\u064A\u062F.", civilLawExamTimeMenu());
    return;
  }
  if (isWrittenExamQuestion(question)) {
    await sender.sendMessage(
      chatId,
      `[${session.questionIndex + 1}/${questions.length}] ${question.questionText}`,
      writtenQuestionMenu(sessionId)
    );
    return;
  }
  const openPeriodSeconds = [15, 30, 60, 300].includes(session.timeLimitSeconds) ? session.timeLimitSeconds : 30;
  const pollOptions = [
    { key: "A", text: examPollOptionText(session.subjectKey, "A", question.optionA) },
    { key: "B", text: examPollOptionText(session.subjectKey, "B", question.optionB) },
    { key: "C", text: examPollOptionText(session.subjectKey, "C", question.optionC) },
    { key: "D", text: examPollOptionText(session.subjectKey, "D", question.optionD) }
  ].filter((option) => option.text.trim().length > 0);
  const correctOptionIndex = pollOptions.findIndex((option) => option.key === question.correctOption);
  if (pollOptions.length < 2 || correctOptionIndex < 0) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0625\u0639\u062F\u0627\u062F \u062E\u064A\u0627\u0631\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0633\u0624\u0627\u0644 \u0644\u0644\u0627\u062E\u062A\u0628\u0627\u0631. \u064A\u0645\u0643\u0646\u0643 \u0628\u062F\u0621 \u062C\u0648\u0644\u0629 \u062C\u062F\u064A\u062F\u0629.", civilLawExamMenu());
    return;
  }
  const poll = await sender.sendQuizPoll(chatId, {
    question: `[${session.questionIndex + 1}/${questions.length}] ${question.questionText}`,
    options: pollOptions.map((option) => option.text),
    correctOptionIndex,
    explanation: isSecondaryExamSubjectKey(session.subjectKey) ? "" : "\u{1F4D6} \u0633\u064A\u0638\u0647\u0631 \u0627\u0644\u0634\u0631\u062D \u0627\u0644\u0645\u0641\u0635\u0644 \u0628\u0639\u062F \u0627\u0644\u0625\u062C\u0627\u0628\u0629\u060C \u0648\u064A\u0638\u0647\u0631 \u0627\u0644\u062A\u0644\u0645\u064A\u062D \u0639\u0646\u062F \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u062E\u0627\u0637\u0626\u0629.",
    openPeriodSeconds
  });
  const linked = await store.setExamActivePoll({ sessionId, telegramUserId, questionIndex: session.questionIndex, pollId: poll.pollId });
  if (!linked) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0631\u0628\u0637 \u0633\u0624\u0627\u0644 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u062D\u0627\u0644\u064A. \u064A\u0645\u0643\u0646\u0643 \u0625\u0639\u0627\u062F\u0629 \u0628\u062F\u0621 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631.", civilLawExamTimeMenu());
  }
}

// server/telegramContractDocument.ts
import { AlignmentType, Document, ExternalHyperlink, Packer, Paragraph, TextRun } from "docx";
var LIBRARY_URL = "https://alnaseer.org/library";
var DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
function templateFileName(name) {
  const cleaned = name.replace(/\.(?:docx?|pdf)$/i, "").replace(/[\\/:*?"<>|]/g, " ").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return `${cleaned || "\u0646\u0645\u0648\u0630\u062C \u0642\u0627\u0646\u0648\u0646\u064A"}.docx`;
}
function contentParagraph(block) {
  const text2 = block.text?.trim() ?? "";
  const number = block.num?.trim();
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { after: 180, line: 330 },
    children: [
      ...number ? [new TextRun({ text: `${number} `, bold: true, font: "Arial" })] : [],
      new TextRun({ text: text2, font: "Arial", size: 24 })
    ]
  });
}
async function createTelegramContractDocument(template) {
  const content = Array.isArray(template.content) ? template.content : [];
  const document = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { after: 360 },
          children: [new TextRun({ text: template.fileName, bold: true, size: 32, font: "Arial" })]
        }),
        ...content.map(contentParagraph),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          bidirectional: true,
          spacing: { before: 420 },
          children: [
            new TextRun({ text: "\u0625\u0639\u062F\u0627\u062F \u0648\u062A\u0646\u0633\u064A\u0642 / ", italics: true, font: "Arial", size: 20 }),
            new ExternalHyperlink({
              link: LIBRARY_URL,
              children: [new TextRun({ text: "\u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", color: "0563C1", underline: {}, font: "Arial", size: 20 })]
            })
          ]
        })
      ]
    }]
  });
  const data = await Packer.toBuffer(document);
  return {
    filename: templateFileName(template.fileName),
    contentType: DOCX_CONTENT_TYPE,
    data: new Uint8Array(data),
    caption: `\u0645\u0633\u062A\u0648\u0631\u062F \u0645\u0646 \u0645\u0643\u062A\u0628\u0629 \u0623. \u0645\u0639\u064A\u0646 \u0627\u0644\u0646\u0627\u0635\u0631
${template.fileName}`
  };
}

// server/telegramContractTypes.ts
var TELEGRAM_CONTRACT_TYPE_LABELS = {
  civil: "\u0639\u0642\u0648\u062F \u0645\u062F\u0646\u064A\u0629",
  commercial: "\u0639\u0642\u0648\u062F \u062A\u062C\u0627\u0631\u064A\u0629",
  labor: "\u0639\u0642\u0648\u062F \u0639\u0645\u0627\u0644\u064A\u0629",
  personal: "\u0623\u062D\u0648\u0627\u0644 \u0634\u062E\u0635\u064A\u0629 \u0648\u0645\u0648\u0627\u0631\u064A\u062B",
  judicial: "\u0635\u064A\u063A \u0642\u0636\u0627\u0626\u064A\u0629",
  general: "\u0635\u064A\u063A \u0639\u0627\u0645\u0629 \u0648\u0645\u062A\u0646\u0648\u0639\u0629"
};
function normalizedContractName(fileName) {
  return fileName.toLowerCase().replace(/[أإآٱ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").replace(/[ـ]/g, "").replace(/[^\u0621-\u063A\u0641-\u064A0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function classifyTelegramContractTemplate(fileName) {
  const name = normalizedContractName(fileName);
  if (/(تجاري|محل|صرافه|بالعمول|شركه|اسهم|حصص|السجل التجاري|وكاله اجنبيه|مؤسسه|علامه تجاريه|ضمانه تجاريه|ضمان تجاري|مضارب)/.test(name)) return "commercial";
  if (/(عمل|اجير|وظيفه|راتب|عامل|عهدة|عهد)/.test(name)) return "labor";
  if (/(قضيه|شكوي|ديات|اروش|قصاص|مروري|دعوي|خصومه|تحكيم)/.test(name)) return "judicial";
  if (/(سفر|جواز|هبه|وصيه|وقف|وريث|ورثه|قسمه)/.test(name)) return "personal";
  if (/(بناء|شقه|ارض|بيع|ايجار|وكاله|رهن|كفال|دين|قرض|حواله|تنازل|صلح|مقاوله|مقايضه|اقاله|اطلاق)/.test(name)) return "civil";
  return "general";
}

// server/telegram.ts
var legalCategories = ["fiqh", "civil", "commercial", "procedure", "general"];
var TELEGRAM_PLATFORM_VERIFY_WEB_APP_URL = "https://alnasser-legal-telegram-bot-supabase-git-sup-f04e08-hasadalyoum.vercel.app/telegram-platform-visit.html";
var TELEGRAM_HASAD_VERIFY_WEB_APP_URL = "https://alnasser-legal-telegram-bot-supabase-git-sup-f04e08-hasadalyoum.vercel.app/telegram-hasad-visit.html";
var importantYemeniLawsPaymentMethods = {
  karimi: { label: "\u0643\u0631\u064A\u0645\u064A", details: "\u0631\u0642\u0645 \u062D\u0633\u0627\u0628 \u0643\u0631\u064A\u0645\u064A: 3007145477" },
  jeeb: { label: "\u0645\u062D\u0641\u0638\u0629 \u062C\u064A\u0628", details: "\u0631\u0642\u0645 \u062D\u0633\u0627\u0628 \u062C\u064A\u0628: 488281" }
};
var categoryLabels = {
  fiqh: "\u{1F4D5} \u0627\u0644\u0641\u0642\u0647 \u0648\u0623\u0635\u0648\u0644\u0647 \u0648\u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0627\u0644\u0625\u0633\u0644\u0627\u0645\u064A\u0629",
  civil: "\u{1F4D9} \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u062F\u0646\u064A",
  commercial: "\u{1F4D8} \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0648\u0627\u0644\u0634\u0631\u0643\u0627\u062A",
  procedure: "\u{1F4D7} \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062C\u0646\u0627\u0626\u064A",
  general: "\u{1F4D1} \u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u0639\u0645\u0644 \u0648\u0627\u0644\u0623\u062D\u0648\u0627\u0644 \u0627\u0644\u0634\u062E\u0635\u064A\u0629"
};
function adaptReplyMarkupForTelegramContext(replyMarkup, replyContext) {
  if (!replyMarkup || !Number.isInteger(replyContext.directMessagesTopicId)) return replyMarkup;
  return {
    inline_keyboard: replyMarkup.inline_keyboard.map((row) => row.map((button) => {
      if (!button.web_app) return button;
      return {
        text: "\u0641\u062A\u062D \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0644\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062A\u062D\u0642\u0642",
        url: "https://t.me/Moieen2025Bot?start=verify"
      };
    }))
  };
}
var BOT_COMMANDS = [
  { command: "start", description: "\u0628\u062F\u0621 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0628\u0648\u062A \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A" },
  { command: "search", description: "\u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0645\u0648\u062D\u062F \u0641\u064A \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629" },
  { command: "browse", description: "\u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0645\u0643\u062A\u0628\u0629" },
  { command: "support", description: "\u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0644\u0644\u062F\u0639\u0645 \u0623\u0648 \u0627\u0642\u062A\u0631\u0627\u062D \u0645\u0631\u062C\u0639" },
  { command: "newquiz", description: "\u0625\u0646\u0634\u0627\u0621 \u0627\u062E\u062A\u0628\u0627\u0631 \u062C\u062F\u064A\u062F" },
  { command: "quizzes", description: "\u0639\u0631\u0636 \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A\u0643" },
  { command: "stop", description: "\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u062D\u0627\u0644\u064A" },
  { command: "startquiz", description: "\u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0625\u0644\u0649 \u0627\u062E\u062A\u0628\u0627\u0631 \u062C\u0645\u0627\u0639\u064A \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629" }
];
var OWNER_COMMANDS = [
  { command: "stats", description: "\u0625\u062D\u0635\u0627\u0621\u0627\u062A \u0627\u0644\u0628\u0648\u062A \u0627\u0644\u062E\u0627\u0635\u0629" },
  { command: "supportrequests", description: "\u0639\u0631\u0636 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u062C\u062F\u064A\u062F\u0629" },
  { command: "broadcast", description: "\u0645\u0639\u0627\u064A\u0646\u0629 \u0628\u062B \u0631\u0633\u0627\u0644\u0629 \u0644\u0644\u0645\u0634\u062A\u0631\u0643\u064A\u0646" },
  { command: "broadcastfile", description: "\u0628\u062B \u0645\u0644\u0641 \u0639\u0628\u0631 \u0648\u0635\u0641\u0647" },
  { command: "importantlawsrequests", description: "\u0637\u0644\u0628\u0627\u062A \u0627\u0634\u062A\u0631\u0627\u0643 \u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646" }
];
var pendingBroadcastFileUploads = /* @__PURE__ */ new Set();
var pendingImportantLawsPaymentProofs = /* @__PURE__ */ new Map();
var IMPORTANT_LAWS_PAYMENT_PROOF_TIMEOUT_MS = 15 * 60 * 1e3;
function sectionOverridesMap(managedSections) {
  return new Map(managedSections.map((section) => [section.sectionKey, section]));
}
function configuredSectionButton(sectionKey, fallbackText, callbackData, overrides) {
  const override = overrides.get(sectionKey);
  if (override?.enabled === false) return void 0;
  return { text: override?.displayLabel?.trim() || fallbackText, callback_data: callbackData };
}
function managedItemsRows(managedItems) {
  return [...managedItems].sort((left, right) => left.rowIndex - right.rowIndex || left.sortOrder - right.sortOrder || left.id - right.id).map((item) => [{ text: item.label, ...item.actionType === "url" && item.accessMode === "free" ? { url: item.actionValue } : { callback_data: `managed:${item.id}` } }]);
}
function mainMenu(managedItems = [], managedSections = []) {
  return {
    inline_keyboard: [
      [{ text: "\u{1F50E} \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A", callback_data: "menu:search" }, { text: "\u{1F4DA} \u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", callback_data: "menu:library" }],
      [{ text: "\u{1F4DD} \u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0648\u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A", callback_data: "menu:exams" }, { text: "\u{1F4C4} \u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0648\u0627\u0644\u0635\u064A\u063A \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", callback_data: "menu:documents" }],
      [{ text: "\u{1F4CC} \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0645\u064A\u0632\u0629", callback_data: "menu:featured" }, { text: "\u{1F6E0} \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0648\u0627\u0644\u0623\u062F\u0648\u0627\u062A", callback_data: "menu:services" }],
      [{ text: "\u2139\uFE0F \u0639\u0646 \u0627\u0644\u0628\u0648\u062A \u0648\u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629", callback_data: "menu:help" }],
      ...managedItemsRows(managedItems),
      [{ text: "\u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", url: "https://alnaseer.org/" }],
      [{ text: "\u0642\u0646\u0627\u0629 \u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", url: "https://t.me/muen2025" }]
    ]
  };
}
function mainCategoryMenu(category, managedSections = []) {
  const overrides = sectionOverridesMap(managedSections);
  const section = (key, fallback, callback = key) => configuredSectionButton(key, fallback, callback, overrides);
  const rows = [];
  if (category === "search") {
    rows.push([{ text: "\u{1F50E} \u0628\u062D\u062B \u0645\u0648\u062D\u0651\u062F \u0641\u064A \u0627\u0644\u0645\u0643\u062A\u0628\u0629", callback_data: "search" }]);
    rows.push([{ text: "\u{1F4DA} \u062A\u0635\u0641\u062D \u0627\u0644\u0645\u0643\u062A\u0628\u0629", callback_data: "browse" }]);
  } else if (category === "library") {
    for (const value of [section("browse", "\u{1F4DA} \u062A\u0635\u0641\u062D \u0627\u0644\u0645\u0643\u062A\u0628\u0629"), section("judicial", "\u2696\uFE0F \u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0648\u0627\u0644\u0645\u0628\u0627\u062F\u0626 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629"), section("legislation", "\u{1F4DC} \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629"), section("important-laws", "\u{1F510} \u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A"), section("contract-templates", "\u{1F4C4} \u0635\u064A\u063A \u0648\u0639\u0642\u0648\u062F \u0642\u0627\u0646\u0648\u0646\u064A\u0629")]) {
      if (value) rows.push([value]);
    }
  } else if (category === "exams") {
    for (const value of [section("exams", "\u{1F4DD} \u0628\u0646\u0643 \u0623\u0633\u0626\u0644\u0629 \u0643\u0644\u064A\u0629 \u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646"), section("secondary-exams", "\u{1F9EE} \u0628\u0646\u0643 \u0623\u0633\u0626\u0644\u0629 \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629")]) {
      if (value) rows.push([value]);
    }
  } else if (category === "documents") {
    for (const value of [section("legal-forms", "\u{1F4DD} \u0646\u0645\u0627\u0630\u062C \u0648\u0635\u064A\u063A \u0642\u0627\u0646\u0648\u0646\u064A\u0629"), section("illustrated-legal-forms", "\u{1F5BC} \u0646\u0645\u0627\u0630\u062C \u0645\u0635\u0648\u0631\u0629 \u0648\u0641\u0642 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629")]) {
      if (value) rows.push([value]);
    }
  } else if (category === "featured") {
    for (const value of [section("featured", "\u{1F4CC} \u0645\u0631\u0627\u062C\u0639 \u0645\u0645\u064A\u0632\u0629"), section("latest", "\u{1F195} \u0623\u062D\u062F\u062B \u0627\u0644\u0625\u0636\u0627\u0641\u0627\u062A"), section("popular", "\u2B50 \u0627\u0644\u0623\u0643\u062B\u0631 \u0637\u0644\u0628\u064B\u0627"), section("favorites", "\u2B50 \u0645\u0641\u0636\u0644\u062A\u064A")]) {
      if (value) rows.push([value]);
    }
  } else if (category === "services") {
    const supportButton = section("support", "\u{1F4AC} \u062A\u0648\u0627\u0635\u0644 \u0648\u062F\u0639\u0645");
    if (supportButton) rows.push([supportButton]);
    rows.push([{ text: "\u{1F381} \u0646\u0638\u0627\u0645 \u0627\u0644\u0625\u062D\u0627\u0644\u0629", callback_data: "premium:referral" }]);
  } else {
    rows.push([{ text: "\u2753 \u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629", callback_data: "help" }], [{ text: "\u2139\uFE0F \u0639\u0646 \u0627\u0644\u0645\u0643\u062A\u0628\u0629", callback_data: "about" }]);
    rows.push([{ text: "\u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", url: "https://alnaseer.org/" }], [{ text: "\u0642\u0646\u0627\u0629 \u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", url: "https://t.me/muen2025" }]);
  }
  rows.push([{ text: "\u21A9\uFE0F \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", callback_data: "menu" }]);
  return { inline_keyboard: rows };
}
function mainCategoryText(category) {
  const texts = {
    search: "\u{1F50E} \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\n\n\u0627\u0628\u062D\u062B \u0641\u064A \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0623\u0648 \u062A\u0635\u0641\u062D \u0627\u0644\u0645\u0643\u062A\u0628\u0629.",
    library: "\u{1F4DA} \u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629\n\n\u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0627\u0644\u0645\u0635\u062F\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A \u0627\u0644\u0645\u0637\u0644\u0648\u0628.",
    exams: "\u{1F4DD} \u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0648\u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u062A\u0639\u0644\u064A\u0645\u064A \u0627\u0644\u0645\u0637\u0644\u0648\u0628.",
    documents: "\u{1F4C4} \u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0648\u0627\u0644\u0635\u064A\u063A \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629\n\n\u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0623\u0648 \u0627\u0644\u0635\u064A\u063A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.",
    featured: "\u{1F4CC} \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0648\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u0645\u0645\u064A\u0632\u0629\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0630\u064A \u062A\u0631\u064A\u062F \u0627\u0633\u062A\u0639\u0631\u0627\u0636\u0647.",
    services: "\u{1F6E0} \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0648\u0627\u0644\u0623\u062F\u0648\u0627\u062A\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.",
    help: "\u2139\uFE0F \u0639\u0646 \u0627\u0644\u0628\u0648\u062A \u0648\u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0623\u0648 \u0648\u0633\u064A\u0644\u0629 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629."
  };
  return texts[category];
}
function groupExamLaunchMenu() {
  return { inline_keyboard: [[{ text: "\u0628\u062F\u0621 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0641\u064A \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u2795", callback_data: "gexam:open" }]] };
}
function groupExamTimeMenu() {
  return {
    inline_keyboard: [
      [{ text: "15 \u062B\u0627\u0646\u064A\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: "gexam:time:15" }, { text: "30 \u062B\u0627\u0646\u064A\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: "gexam:time:30" }],
      [{ text: "\u062F\u0642\u064A\u0642\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: "gexam:time:60" }, { text: "5 \u062F\u0642\u0627\u0626\u0642 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644", callback_data: "gexam:time:300" }]
    ]
  };
}
function groupExamReadyMenu(roundId, participantCount) {
  return {
    inline_keyboard: [
      [{ text: `\u0623\u0646\u0627 \u0645\u0633\u062A\u0639\u062F (${participantCount}/3)`, callback_data: `gexam:ready:${roundId}` }],
      [{ text: "\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0648\u0644\u0629", callback_data: `gexam:cancel:${roundId}` }]
    ]
  };
}
function individualExamResultMenu() {
  const sharedText = `\u062C\u0631\u0651\u0628 ${CIVIL_LAW_GENERAL_2025_TITLE} \u0639\u0628\u0631 \u0628\u0648\u062A \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A.`;
  return {
    inline_keyboard: [
      [{ text: "\u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627", callback_data: "exam:retry" }],
      [{ text: "\u0628\u062F\u0621 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0641\u064A \u0645\u062C\u0645\u0648\u0639\u0629 \u2795", url: "https://t.me/Moieen2025Bot?startgroup=groupquiz" }],
      [{ text: "\u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u21AA\uFE0F", url: `https://t.me/share/url?url=${encodeURIComponent("https://t.me/Moieen2025Bot")}&text=${encodeURIComponent(sharedText)}` }]
    ]
  };
}
function shariaExamsIntroText() {
  return [
    "\u{1F4DD} \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646",
    "",
    '\u0628\u0646\u0643 \u0623\u0633\u0626\u0644\u0629 \u0645\u0624\u062A\u0645\u062A \u0648\u0646\u0645\u0627\u0630\u062C \u0623\u0633\u0626\u0644\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0645\u0639 \u0627\u0644\u0634\u0631\u062D \u0627\u0644\u0645\u0641\u0635\u0644 \u0645\u0628\u0646\u064A\u0629 \u0648\u0641\u0642\u0627\u064B \u0644\u0646\u0645\u0627\u0630\u062C \u0627\u0644\u0623\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0644\u0644\u0623\u0639\u0648\u0627\u0645 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0644\u0643\u0644\u064A\u0629 \u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646 "\u062C\u0627\u0645\u0639\u0629 \u0635\u0646\u0639\u0627\u0621" \u0645\u0646 \u0639\u0627\u0645 2020 \u0648\u062D\u062A\u0649 \u0639\u0627\u0645 2026\u060C \u0645\u0639 \u0627\u0644\u062A\u062D\u062F\u064A\u062B \u0648\u0627\u0644\u062A\u0631\u0642\u064A\u0629 \u0627\u0644\u0645\u0633\u062A\u0645\u0631\u0629 \u0644\u0644\u0623\u0639\u0648\u0627\u0645 \u0627\u0644\u0645\u0642\u0628\u0644\u0629.',
    "",
    "\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u0627\u062F\u0629 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0623\u062F\u0646\u0627\u0647 \u0623\u0648 \u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u0645\u0646\u0627\u0633\u0628."
  ].join("\n");
}
function quizQuickCommandsText() {
  return [
    "\u{1F4DD} \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646",
    "",
    "\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0633\u0631\u064A\u0639\u0629:",
    "\u2022 \u0625\u0646\u0634\u0627\u0621 \u0627\u062E\u062A\u0628\u0627\u0631 \u062C\u062F\u064A\u062F          \u2190 /newquiz",
    "\u2022 \u0639\u0631\u0636 \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A\u0643              \u2190 /quizzes",
    "\u2022 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u062D\u0627\u0644\u064A       \u2190 /stop",
    "",
    "\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u0627\u062F\u0629 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0623\u062F\u0646\u0627\u0647 \u0623\u0648 \u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u0645\u0646\u0627\u0633\u0628."
  ].join("\n");
}
function hasadAccessMenu() {
  return {
    inline_keyboard: [
      [{ text: "\u0641\u062A\u062D \u062D\u0635\u0627\u062F \u0627\u0644\u064A\u0648\u0645 \u0648\u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0632\u064A\u0627\u0631\u0629", web_app: { url: TELEGRAM_HASAD_VERIFY_WEB_APP_URL } }]
    ]
  };
}
function hasadProtectedSectionName(data) {
  if (data === "judicial" || data.startsWith("index:") || data.startsWith("jsearch") || data.startsWith("jq:") || data.startsWith("jresult:") || data.startsWith("jfile:") || data.startsWith("jresultfile:")) {
    return "\u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629";
  }
  return "\u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629";
}
function hasadProtectedSectionKey(data) {
  return hasadProtectedSectionName(data) === "\u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629" ? "judicial" : "contract-templates";
}
function hasadAccessGateText(data) {
  return `\u{1F510} \u0644\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0645\u062C\u0627\u0646\u064A \u0625\u0644\u0649 ${hasadProtectedSectionName(data)}\u060C \u064A\u0644\u0632\u0645 \u062A\u0648\u062B\u064A\u0642 \u0632\u064A\u0627\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0644\u0645\u0648\u0642\u0639 \u062D\u0635\u0627\u062F \u0627\u0644\u064A\u0648\u0645 \u0639\u0628\u0631 \u0627\u0644\u0632\u0631 \u0627\u0644\u062A\u0627\u0644\u064A. \u0628\u0639\u062F \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0644\u0646 \u062A\u0638\u0647\u0631 \u0644\u0643 \u0647\u0630\u0647 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.`;
}
var REQUIRED_CHANNELS = [
  { title: "\u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", handle: "@muen2025", url: "https://t.me/muen2025" },
  { title: "\u062D\u0635\u0627\u062F \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0625\u062E\u0628\u0627\u0631\u064A", handle: "@hasadalyoum", url: "https://t.me/hasadalyoum" }
];
function accessRequirementLine(title, status) {
  if (status === "subscribed") return `\u2705 ${title}: \u0645\u0643\u062A\u0645\u0644`;
  if (status === "unavailable") return `\u26A0\uFE0F ${title}: \u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u062D\u0627\u0644\u064A\u064B\u0627`;
  return `\u274C ${title}: \u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643`;
}
function accessRequirementsText(requirements) {
  const channelLines = requirements.channels.map(({ channel, status }) => accessRequirementLine(`\u0642\u0646\u0627\u0629 ${channel.title} (${channel.handle})`, status));
  const platformLine = requirements.platformVerified ? "\u2705 \u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629: \u062A\u0645\u062A \u0627\u0644\u0632\u064A\u0627\u0631\u0629 \u0648\u0627\u0644\u062A\u062D\u0642\u0642" : "\u274C \u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629: \u0644\u0645 \u062A\u062A\u0645 \u0627\u0644\u0632\u064A\u0627\u0631\u0629 \u0623\u0648 \u0644\u0645 \u064A\u064F\u062A\u062D\u0642\u0642 \u0645\u0646\u0647\u0627 \u0628\u0639\u062F";
  const hasUnavailableCheck = requirements.channels.some(({ status }) => status === "unavailable");
  return [
    "\u{1F510} \u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u062A\u0637\u0644\u0628\u0627\u062A \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0628\u0648\u062A",
    "\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u062A\u0637\u0644\u0628\u0627\u062A:",
    ...channelLines,
    platformLine,
    hasUnavailableCheck ? "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0625\u062D\u062F\u0649 \u0627\u0644\u0642\u0646\u0648\u0627\u062A \u062D\u0627\u0644\u064A\u064B\u0627. \u062A\u0623\u0643\u062F \u0645\u0646 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u062B\u0645 \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0627\u062D\u0642\u064B\u0627." : "\u0623\u0643\u0645\u0644 \u0627\u0644\u0628\u0646\u0648\u062F \u0627\u0644\u0645\u0639\u0644\u0651\u0645\u0629 \u0628\u0639\u0644\u0627\u0645\u0629 \u274C\u060C \u062B\u0645 \u0627\u0636\u063A\u0637 \xAB\u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643\xBB. "
  ].join("\n");
}
function channelSubscriptionMenu() {
  return {
    inline_keyboard: [
      ...REQUIRED_CHANNELS.map((channel) => [{ text: `\u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0641\u064A ${channel.title}`, url: channel.url }]),
      [{ text: "\u0641\u062A\u062D \u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0648\u0627\u0644\u062A\u062D\u0642\u0642", web_app: { url: TELEGRAM_PLATFORM_VERIFY_WEB_APP_URL } }],
      [{ text: "\u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643", callback_data: "channel:check" }]
    ]
  };
}
function categoryMenu() {
  return {
    inline_keyboard: [
      legalCategories.map((category) => ({
        text: categoryLabels[category],
        callback_data: `category:${category}`
      })),
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
var legislationDocumentTypeLabels = {
  law: "\u0642\u0648\u0627\u0646\u064A\u0646",
  regulation: "\u0644\u0648\u0627\u0626\u062D",
  decision: "\u0642\u0631\u0627\u0631\u0627\u062A",
  agreement: "\u0627\u062A\u0641\u0627\u0642\u064A\u0627\u062A",
  treaty: "\u0645\u0639\u0627\u0647\u062F\u0627\u062A",
  decree: "\u0645\u0631\u0627\u0633\u064A\u0645",
  other: "\u0648\u062B\u0627\u0626\u0642 \u0623\u062E\u0631\u0649"
};
function unifiedSearchMenu() {
  return {
    inline_keyboard: [
      [{ text: "\u{1F4DA} \u0627\u0644\u0628\u062D\u062B \u0641\u064A \u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629", callback_data: "search:library" }],
      [{ text: "\u26A1 \u0628\u062D\u062B \u0633\u0631\u064A\u0639 \u0641\u064A \u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629", callback_data: "jsearch" }],
      [{ text: "\u26A1 \u0628\u062D\u062B \u0633\u0631\u064A\u0639 \u0641\u064A \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "lsearch" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function legislationTypeMenu() {
  return {
    inline_keyboard: [
      ["law", "regulation", "decision"].map((documentType) => ({ text: legislationDocumentTypeLabels[documentType], callback_data: `ltype:${documentType}:1` })),
      ["agreement", "treaty", "decree"].map((documentType) => ({ text: legislationDocumentTypeLabels[documentType], callback_data: `ltype:${documentType}:1` })),
      [{ text: legislationDocumentTypeLabels.other, callback_data: "ltype:other:1" }],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "legislation" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function legislationFilterMenu() {
  return {
    inline_keyboard: [
      [{ text: "\u0627\u0644\u062A\u0635\u0641\u064A\u0629 \u062D\u0633\u0628 \u0627\u0644\u0646\u0648\u0639", callback_data: "ltypes" }],
      [{ text: "\u0627\u0644\u062A\u0635\u0641\u064A\u0629 \u062D\u0633\u0628 \u0633\u0646\u0629 \u0627\u0644\u0625\u0635\u062F\u0627\u0631", callback_data: "lyears" }],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "legislation" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function legislationYearMenu(years) {
  return {
    inline_keyboard: [
      ...Array.from({ length: Math.ceil(years.length / 3) }, (_, index2) => years.slice(index2 * 3, index2 * 3 + 3).map((year) => ({ text: String(year), callback_data: `lyear:${year}:1` }))),
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0641\u0644\u0627\u062A\u0631", callback_data: "lfilters" }],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "legislation" }]
    ]
  };
}
function supportMenu() {
  return {
    inline_keyboard: [
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function sourceMenu(sources, category, page = 1, totalPages = 1) {
  const navigation = [];
  if (category && page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `category:${category}:${page - 1}` });
  if (category && page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `category:${category}:${page + 1}` });
  return {
    inline_keyboard: [
      ...searchSourceRows(sources, (source) => `source:${source.id}`),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u0627\u0644\u062A\u0635\u0646\u064A\u0641\u0627\u062A", callback_data: "browse" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function librarySearchMenu(sources, sessionId, page, totalPages) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `bresult:${sessionId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `bresult:${sessionId}:${page + 1}` });
  return {
    inline_keyboard: [
      ...searchSourceRows(sources, (source) => `source:${source.id}`),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u0628\u062D\u062B \u062C\u062F\u064A\u062F", callback_data: "search:library" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function curatedSourceMenu(sources, backCallback) {
  return {
    inline_keyboard: [
      ...sources.map((source) => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `source:${source.id}` }]),
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: backCallback }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function legislationTypeSourceMenu(sources, documentType, page, totalPages) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `ltype:${documentType}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `ltype:${documentType}:${page + 1}` });
  return {
    inline_keyboard: [
      ...sources.map((source) => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `source:${source.id}` }]),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u062A\u0635\u0641\u064A\u0629 \u062D\u0633\u0628 \u0627\u0644\u0646\u0648\u0639", callback_data: "ltypes" }],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "legislation" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function legislationYearSourceMenu(sources, year, page, totalPages) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `lyear:${year}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `lyear:${year}:${page + 1}` });
  return {
    inline_keyboard: [
      ...sources.map((source) => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `source:${source.id}` }]),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u0627\u062E\u062A\u064A\u0627\u0631 \u0633\u0646\u0629 \u0623\u062E\u0631\u0649", callback_data: "lyears" }],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0641\u0644\u0627\u062A\u0631", callback_data: "lfilters" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function buttonLabel(label, prefix = "") {
  const maxLength = 54 - prefix.length;
  const veryLongThreshold = 58 - prefix.length;
  if (label.length <= veryLongThreshold) return `${prefix}${label}`;
  const visible = label.slice(0, Math.max(1, maxLength - 1));
  const wordBoundary = visible.lastIndexOf(" ");
  const shortened = wordBoundary >= Math.floor(maxLength * 0.55) ? visible.slice(0, wordBoundary) : visible;
  return `${prefix}${shortened.trimEnd()}\u2026`;
}
function searchSourceRows(sources, openCallback, displayLabel = displaySourceTitle) {
  return sources.flatMap((source) => [
    [{ text: buttonLabel(displayLabel(source)), callback_data: openCallback(source) }],
    [{ text: "\u2B50 \u0625\u0636\u0627\u0641\u0629 \u0644\u0644\u0645\u0641\u0636\u0644\u0629", callback_data: `favadd:${source.id}` }]
  ]);
}
function favoritesMenu(favorites) {
  return {
    inline_keyboard: [
      ...favorites.flatMap(({ source }) => [
        [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `source:${source.id}` }],
        [{ text: "\u{1F5D1} \u0625\u0632\u0627\u0644\u0629 \u0645\u0646 \u0627\u0644\u0645\u0641\u0636\u0644\u0629", callback_data: `favremove:${source.id}` }]
      ]),
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function highlightedArabicPattern(word) {
  const characterPatterns = {
    \u0627: "[\u0627\u0623\u0625\u0622]",
    \u0647: "[\u0647\u0629]",
    \u064A: "[\u064A\u0649]"
  };
  return Array.from(word).map((character) => `${characterPatterns[character] ?? character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\u064B-\u065F]*`).join("");
}
function highlightSearchTerm(label, query) {
  const words = normalizeArabicSearch(query).split(" ").filter((word) => word.length > 1).sort((first, second) => second.length - first.length);
  if (words.length === 0) return label;
  return words.reduce((highlighted, word) => highlighted.replace(new RegExp(highlightedArabicPattern(word), "giu"), (match) => `\u{1F7E8}${match}\u{1F7E8}`), label);
}
function judicialFolderMenu(folders, sources, folder, page, totalPages) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `index:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `index:${folder.driveFolderId}:${page + 1}` });
  const backData = folder.parentDriveFolderId ? `index:${folder.parentDriveFolderId}:1` : "menu";
  return {
    inline_keyboard: [
      ...folders.map((child) => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `index:${child.driveFolderId}:1` }]),
      ...sources.map((source) => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `jfile:${source.id}:${folder.driveFolderId}:${page}` }]),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u26A1 \u0628\u062D\u062B \u0633\u0631\u064A\u0639", callback_data: "jsearch" }],
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: backData }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function judicialSearchMenu(sources, sessionId, page, totalPages, query) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `jresult:${sessionId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `jresult:${sessionId}:${page + 1}` });
  return {
    inline_keyboard: [
      ...searchSourceRows(sources, (source) => `jresultfile:${source.id}:${sessionId}:${page}`, (source) => highlightSearchTerm(displaySourceTitle(source), query)),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0642\u0648\u0627\u0639\u062F \u0642\u0636\u0627\u0626\u064A\u0629", callback_data: "judicial" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function legislationFolderMenu(folders, sources, folder, page, totalPages) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `lindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `lindex:${folder.driveFolderId}:${page + 1}` });
  const backData = folder.parentDriveFolderId ? `lindex:${folder.parentDriveFolderId}:1` : "menu";
  return {
    inline_keyboard: [
      ...folders.map((child) => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `lindex:${child.driveFolderId}:1` }]),
      ...sources.map((source) => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `lfile:${source.id}:${folder.driveFolderId}:${page}` }]),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u26A1 \u0628\u062D\u062B \u0633\u0631\u064A\u0639", callback_data: "lsearch" }],
      [{ text: "\u062A\u0635\u0641\u064A\u0629 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A", callback_data: "lfilters" }],
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: backData }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function cleanLegalFormsDisplayName(name) {
  const cleaned = name.replace(/\.(?:docx?|pdf)$/i, "").replace(/[_-]+/g, " ").replace(/[ـ]+/g, "").replace(/\s*\(\s*\d+\s*\)\s*/g, " ").replace(/^\d+\s*(?=[\u0621-\u064A])/, "").replace(/\s+/g, " ").trim();
  return cleaned || name;
}
function cleanContractTemplateDisplayName(name) {
  const cleaned = name.replace(/\.(?:docx?|pdf)$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || name;
}
function cleanFeaturedReferencesDisplayName(name) {
  const cleaned = name.replace(/\.(?:docx?|pdf|zip)$/i, "").replace(/[_\s-]*تطبيق الباحث القانوني[_\s-]*أ\.?\s*معين الناصر.*$/, "").replace(/[_-]+/g, " ").replace(/[ـ]+/g, "").replace(/\s*\(\s*\d+\s*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || name;
}
function cleanGenericFileDisplayName(name) {
  const cleaned = name.replace(/\.(?:docx?|pdf|zip)$/i, "").replace(/[_]+/g, " ").replace(/[ـ]+/g, "").replace(/\s+/g, " ").trim();
  return cleaned || name;
}
function displaySourceTitle(source) {
  if (source.collection === "legal_forms") return cleanLegalFormsDisplayName(source.title);
  if (source.collection === "featured_references") return cleanFeaturedReferencesDisplayName(source.title);
  return cleanGenericFileDisplayName(source.title);
}
function legalFormsFolderMenu(folders, sources, folder, page, totalPages) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `findex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `findex:${folder.driveFolderId}:${page + 1}` });
  const backData = folder.parentDriveFolderId ? `findex:${folder.parentDriveFolderId}:1` : "menu";
  return {
    inline_keyboard: [
      ...folders.map((child) => [{ text: buttonLabel(cleanLegalFormsDisplayName(child.name)), callback_data: `findex:${child.driveFolderId}:1` }]),
      ...sources.map((source) => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `fform:${source.id}:${folder.driveFolderId}:${page}` }]),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: backData }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function illustratedLegalFormsFolderMenu(folders, sources, folder, page, totalPages) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `vindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `vindex:${folder.driveFolderId}:${page + 1}` });
  const backData = folder.parentDriveFolderId ? `vindex:${folder.parentDriveFolderId}:1` : "menu";
  return {
    inline_keyboard: [
      ...folders.map((child) => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `vindex:${child.driveFolderId}:1` }]),
      ...sources.map((source) => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `vfile:${source.id}:${folder.driveFolderId}:${page}` }]),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: backData }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function allYemeniLawsFolderMenu(folders, sources, folder, page, totalPages) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `ayindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `ayindex:${folder.driveFolderId}:${page + 1}` });
  const backData = folder.parentDriveFolderId ? `ayindex:${folder.parentDriveFolderId}:1` : "menu";
  return {
    inline_keyboard: [
      ...folders.map((child) => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `ayindex:${child.driveFolderId}:1` }]),
      ...sources.map((source) => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `ayfile:${source.id}:${folder.driveFolderId}:${page}` }]),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u26A1 \u0628\u062D\u062B \u0633\u0631\u064A\u0639", callback_data: "aysearch" }],
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: backData }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function contractTemplatesMenu(templates, page, total) {
  const totalPages = Math.max(1, Math.ceil(total / 8));
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `ctemplates:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `ctemplates:${page + 1}` });
  return {
    inline_keyboard: [
      [{ text: "\u{1F50D} \u0628\u062D\u062B \u062F\u0627\u062E\u0644 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F", callback_data: "ctsearch" }],
      [{ text: "\u{1F5C2} \u062A\u0635\u0641\u064A\u0629 \u062D\u0633\u0628 \u0646\u0648\u0639 \u0627\u0644\u0639\u0642\u062F", callback_data: "ctypes" }],
      ...templates.map((template) => [{ text: buttonLabel(cleanContractTemplateDisplayName(template.fileName)), callback_data: `ctemplate:${template.id}:${page}` }]),
      ...navigation.length ? [navigation] : [],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
async function sendContractTemplatesMenu(chatId, requestedPage, store, sender) {
  const page = Math.max(1, requestedPage);
  const result = await store.listContractTemplates(page);
  const totalPages = Math.max(1, Math.ceil(result.total / 8));
  const safePage = Math.min(page, totalPages);
  const content = safePage === page ? result : await store.listContractTemplates(safePage);
  if (content.total === 0) {
    await sender.sendMessage(chatId, "\u0644\u0627 \u062A\u062A\u0648\u0627\u0641\u0631 \u0635\u064A\u063A \u0623\u0648 \u0639\u0642\u0648\u062F \u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0643\u0645\u0644\u0641\u0627\u062A \u062D\u0627\u0644\u064A\u064B\u0627.", mainMenu());
    return;
  }
  await sender.sendMessage(
    chatId,
    "\u{1F4C4} \u0635\u064A\u063A \u0648\u0639\u0642\u0648\u062F \u0642\u0627\u0646\u0648\u0646\u064A\u0629\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0623\u0648 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628:",
    contractTemplatesMenu(content.templates, safePage, content.total)
  );
}
function isTelegramContractTemplateType(value) {
  return Object.prototype.hasOwnProperty.call(TELEGRAM_CONTRACT_TYPE_LABELS, value);
}
function contractTemplateTypesMenu(types) {
  return {
    inline_keyboard: [
      ...types.map((type) => [{ text: `${TELEGRAM_CONTRACT_TYPE_LABELS[type.contractType]} (${type.count})`, callback_data: `ctype:${type.contractType}:1` }]),
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F", callback_data: "contract-templates" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
async function sendContractTemplateTypesMenu(chatId, store, sender) {
  const types = await store.listContractTemplateTypes();
  if (types.length === 0) {
    await sender.sendMessage(chatId, "\u0644\u0627 \u062A\u062A\u0648\u0627\u0641\u0631 \u0623\u0646\u0648\u0627\u0639 \u0639\u0642\u0648\u062F \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062A\u0635\u0641\u064A\u0629 \u062D\u0627\u0644\u064A\u064B\u0627.", { inline_keyboard: [[{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F", callback_data: "contract-templates" }]] });
    return;
  }
  await sender.sendMessage(chatId, "\u{1F5C2} \u062A\u0635\u0641\u064A\u0629 \u062D\u0633\u0628 \u0646\u0648\u0639 \u0627\u0644\u0639\u0642\u062F\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u0646\u0648\u0639 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0644\u0639\u0631\u0636 \u0646\u0645\u0627\u0630\u062C\u0647 \u0641\u0642\u0637:", contractTemplateTypesMenu(types));
}
function contractTemplatesByTypeMenu(templates, contractType, page, total) {
  const totalPages = Math.max(1, Math.ceil(total / 8));
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `ctype:${contractType}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `ctype:${contractType}:${page + 1}` });
  return {
    inline_keyboard: [
      ...templates.map((template) => [{ text: buttonLabel(cleanContractTemplateDisplayName(template.fileName)), callback_data: `ctemplate:${template.id}:type:${contractType}:${page}` }]),
      ...navigation.length ? [navigation] : [],
      [{ text: "\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0639\u0642\u0648\u062F", callback_data: "ctypes" }],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F", callback_data: "contract-templates" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
async function sendContractTemplatesByType(chatId, contractType, requestedPage, store, sender) {
  const page = Math.max(1, requestedPage);
  const result = await store.listContractTemplatesByType(contractType, page);
  const totalPages = Math.max(1, Math.ceil(result.total / 8));
  const safePage = Math.min(page, totalPages);
  const content = safePage === page ? result : await store.listContractTemplatesByType(contractType, safePage);
  const label = TELEGRAM_CONTRACT_TYPE_LABELS[contractType];
  if (content.total === 0) {
    await sender.sendMessage(chatId, `\u0644\u0627 \u062A\u062A\u0648\u0627\u0641\u0631 \u0646\u0645\u0627\u0630\u062C \u0636\u0645\u0646 \xAB${label}\xBB \u062D\u0627\u0644\u064A\u064B\u0627.`, { inline_keyboard: [[{ text: "\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0639\u0642\u0648\u062F", callback_data: "ctypes" }], [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F", callback_data: "contract-templates" }]] });
    return;
  }
  await sender.sendMessage(
    chatId,
    `\u{1F4C4} ${label}

\u0627\u062E\u062A\u0631 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u0637\u0644\u0648\u0628:`,
    contractTemplatesByTypeMenu(content.templates, contractType, safePage, content.total)
  );
}
function contractTemplateSearchMenu(templates, sessionId, page, total) {
  const totalPages = Math.max(1, Math.ceil(total / 8));
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `ctresult:${sessionId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `ctresult:${sessionId}:${page + 1}` });
  return {
    inline_keyboard: [
      ...templates.map((template) => [{ text: buttonLabel(cleanContractTemplateDisplayName(template.fileName)), callback_data: `ctemplate:${template.id}:search:${sessionId}:${page}` }]),
      ...navigation.length ? [navigation] : [],
      [{ text: "\u0628\u062D\u062B \u062C\u062F\u064A\u062F", callback_data: "ctsearch" }],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F", callback_data: "contract-templates" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
async function promptContractTemplateSearch(chatId, store, sender) {
  await store.beginContractTemplateSearch(String(chatId));
  await sender.sendMessage(
    chatId,
    "\u0627\u0643\u062A\u0628 \u0627\u0633\u0645 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0623\u0648 \u0643\u0644\u0645\u0629 \u0645\u0646\u0647 \u0644\u0644\u0628\u062D\u062B \u062F\u0627\u062E\u0644 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629. \u0645\u062B\u0627\u0644: \u0645\u0648\u0627\u0641\u0642\u0629 \u0623\u0648 \u0625\u064A\u062C\u0627\u0631 \u0623\u0648 \u0648\u0643\u0627\u0644\u0629.",
    { inline_keyboard: [[{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F", callback_data: "contract-templates" }], [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]] }
  );
}
async function sendContractTemplateSearchResults(chatId, sessionId, requestedPage, store, sender) {
  const initial = await store.searchContractTemplates(sessionId, Math.max(1, requestedPage));
  if (!initial) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchExpired("\u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629"), { inline_keyboard: [[{ text: "\u0628\u062D\u062B \u062C\u062F\u064A\u062F", callback_data: "ctsearch" }], [{ text: "\u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", callback_data: "contract-templates" }]] });
    return;
  }
  if (initial.total === 0) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchNoResults("\u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629", initial.query), { inline_keyboard: [[{ text: "\u0628\u062D\u062B \u062C\u062F\u064A\u062F", callback_data: "ctsearch" }], [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F", callback_data: "contract-templates" }]] });
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.total / 8));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.searchContractTemplates(sessionId, page);
  if (!content) return;
  const matchNote = content.matchType === "approximate" ? TELEGRAM_USER_MESSAGES.approximateSearchNote : "";
  await sender.sendMessage(
    chatId,
    `\u0646\u062A\u0627\u0626\u062C \xAB${content.query}\xBB \u062F\u0627\u062E\u0644 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u2014 \u0627\u0644\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages} (${content.total} \u0646\u062A\u064A\u062C\u0629):${matchNote}`,
    contractTemplateSearchMenu(content.templates, sessionId, page, content.total)
  );
}
function featuredReferencesFolderMenu(folders, sources, folder, page, totalPages) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `rindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `rindex:${folder.driveFolderId}:${page + 1}` });
  const backData = folder.parentDriveFolderId ? `rindex:${folder.parentDriveFolderId}:1` : "menu";
  return {
    inline_keyboard: [
      ...folders.map((child) => [{ text: buttonLabel(cleanFeaturedReferencesDisplayName(child.name)), callback_data: `rindex:${child.driveFolderId}:1` }]),
      ...sources.map((source) => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `rfile:${source.id}:${folder.driveFolderId}:${page}` }]),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: backData }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function importantYemeniLawsFolderMenu(folders, sources, folder, page, totalPages) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `iindex:${folder.driveFolderId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `iindex:${folder.driveFolderId}:${page + 1}` });
  const backData = folder.parentDriveFolderId ? `iindex:${folder.parentDriveFolderId}:1` : "menu";
  return {
    inline_keyboard: [
      ...folders.map((child) => [{ text: buttonLabel(cleanGenericFileDisplayName(child.name)), callback_data: `iindex:${child.driveFolderId}:1` }]),
      ...sources.map((source) => [{ text: buttonLabel(displaySourceTitle(source)), callback_data: `ifile:${source.id}:${folder.driveFolderId}:${page}` }]),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: backData }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function importantYemeniLawsSubscriptionMenu() {
  return {
    inline_keyboard: [
      [{ text: "\u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0628\u0639\u062F \u0627\u0644\u062A\u062D\u0648\u064A\u0644", callback_data: "important-laws:request" }],
      [{ text: "\u{1F381} \u0648\u0635\u0648\u0644 \u0645\u062C\u0627\u0646\u064A \u0628\u0627\u0644\u0625\u062D\u0627\u0644\u0629", callback_data: "premium:referral" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function referralMenu() {
  return {
    inline_keyboard: [
      [{ text: "\u{1F517} \u0639\u0631\u0636 \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u0648\u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629", callback_data: "premium:referral" }],
      [{ text: "\u{1F4CB} \u0633\u062C\u0644 \u0627\u0644\u0625\u062D\u0627\u0644\u0627\u062A \u0648\u0627\u0644\u062D\u0627\u0644\u0627\u062A", callback_data: "premium:referrals" }],
      [{ text: "\u{1F4B3} \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0627\u0644\u0645\u062F\u0641\u0648\u0639", callback_data: "important-laws:request" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function referralHelpText(progress, telegramUserId) {
  const link = `https://t.me/Moieen2025Bot?start=ref_${telegramUserId}`;
  const expiry = progress.activeAccessExpiresAt ? `

\u2705 \u0644\u062F\u064A\u0643 \u0648\u0635\u0648\u0644 \u0625\u062D\u0627\u0644\u0629 \u0641\u0639\u0651\u0627\u0644 \u062D\u062A\u0649: ${progress.activeAccessExpiresAt.toLocaleDateString("ar-YE", { year: "numeric", month: "long", day: "numeric" })}.` : "";
  return [
    "\u{1F381} \u0646\u0638\u0627\u0645 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u2014 \u0648\u0635\u0648\u0644 \u0645\u062C\u0627\u0646\u064A \u0644\u0645\u062F\u0629 \u0634\u0647\u0631",
    "\u0634\u0627\u0631\u0643 \u0631\u0627\u0628\u0637\u0643 \u0627\u0644\u0634\u062E\u0635\u064A \u0645\u0639 \u0623\u0635\u062F\u0642\u0627\u0626\u0643. \u0639\u0646\u062F \u0627\u0643\u062A\u0645\u0627\u0644 5 \u0625\u062D\u0627\u0644\u0627\u062A \u0645\u0624\u0647\u0644\u0629 \u062A\u062D\u0635\u0644 \u0639\u0644\u0649 \u0634\u0647\u0631 \u0648\u0627\u062D\u062F \u0645\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649: \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646\u060C \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629\u060C \u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629\u060C \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629\u060C \u0648\u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A.",
    "",
    `\u{1F4CA} \u0625\u062D\u0627\u0644\u0627\u062A\u0643 \u0627\u0644\u0645\u062D\u062A\u0633\u0628\u0629: ${progress.qualifiedCount} | \u0642\u064A\u062F \u0627\u0644\u062A\u0623\u0647\u064A\u0644: ${progress.pendingCount} | \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0644\u0644\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629: ${progress.remainingCount}.`,
    "",
    "\u2705 \u062A\u064F\u062D\u062A\u0633\u0628 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u0641\u0642\u0637 \u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u062C\u062F\u064A\u062F \u064A\u0628\u062F\u0623 \u0627\u0644\u0628\u0648\u062A \u0645\u0646 \u0631\u0627\u0628\u0637\u0643\u060C \u0648\u064A\u0643\u0645\u0644 \u0627\u0634\u062A\u0631\u0627\u0643 \u0627\u0644\u0642\u0646\u0648\u0627\u062A \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0648\u0632\u064A\u0627\u0631\u0629 \u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631\u060C \u062B\u0645 \u064A\u0628\u0642\u0649 \u0645\u0624\u0647\u0644\u064B\u0627 \u0644\u0645\u062F\u0629 24 \u0633\u0627\u0639\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.",
    "\u26D4 \u0644\u0627 \u062A\u064F\u062D\u062A\u0633\u0628 \u0625\u062D\u0627\u0644\u062A\u0643 \u0644\u0646\u0641\u0633\u0643\u060C \u0648\u0644\u0627 \u064A\u064F\u062D\u062A\u0633\u0628 \u0627\u0644\u062D\u0633\u0627\u0628 \u0623\u0643\u062B\u0631 \u0645\u0646 \u0645\u0631\u0629\u060C \u0648\u062A\u062E\u0636\u0639 \u0627\u0644\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0645\u0634\u0628\u0648\u0647\u0629 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0627\u0644\u0625\u0644\u063A\u0627\u0621 \u0645\u0646 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.",
    "",
    "\u{1F517} \u0631\u0627\u0628\u0637 \u0625\u062D\u0627\u0644\u062A\u0643 \u0627\u0644\u0634\u062E\u0635\u064A:",
    link,
    expiry
  ].join("\n");
}
function examAccessScope(data) {
  return data === "secondary-exams" ? "secondary_exams" : "sharia_exams";
}
function subscriptionScopeLabel(scope) {
  if (scope === "sharia_exams") return "\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646";
  if (scope === "secondary_exams") return "\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629";
  return "\u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A";
}
function optionalExamSupportText(scope) {
  return [
    `\u{1F4DA} ${subscriptionScopeLabel(scope)}`,
    "\u0646\u0638\u0627\u0645 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0645\u0628\u0627\u062F\u0631\u0629 \u062A\u0639\u0644\u064A\u0645\u064A\u0629. \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0645\u0633\u0627\u0647\u0645\u0629 \u0628\u062F\u0639\u0645 \u0627\u062E\u062A\u064A\u0627\u0631\u064A \u0644\u0627\u0633\u062A\u0645\u0631\u0627\u0631 \u0627\u0644\u0628\u0648\u062A \u0648\u062A\u0637\u0648\u064A\u0631 \u0645\u062D\u062A\u0648\u0627\u0647\u060C \u0645\u0646 \u062F\u0648\u0646 \u062A\u062D\u062F\u064A\u062F \u0645\u0628\u0644\u063A \u0623\u0648 \u0627\u0644\u062A\u0632\u0627\u0645 \u0645\u0627\u0644\u064A.",
    "\u0643\u0645\u0627 \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0648\u0635\u0648\u0644 \u0645\u062C\u0627\u0646\u064A \u0644\u0645\u062F\u0629 \u0634\u0647\u0631 \u0639\u0646\u062F \u0627\u0643\u062A\u0645\u0627\u0644 5 \u0625\u062D\u0627\u0644\u0627\u062A \u0645\u0624\u0647\u0644\u0629."
  ].join("\n\n");
}
function optionalExamSupportMenu(scope) {
  return {
    inline_keyboard: [
      [{ text: "\u{1F381} \u0648\u0635\u0648\u0644 \u0645\u062C\u0627\u0646\u064A \u0628\u0627\u0644\u0625\u062D\u0627\u0644\u0629", callback_data: "premium:referral" }],
      [{ text: "\u{1F4B3} \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0627\u0644\u0645\u062F\u0641\u0648\u0639", callback_data: `premium:request:${scope}` }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function isReferralProtectedCallback(data) {
  return data === "exams" || data === "secondary-exams" || data.startsWith("exam:");
}
function managedSectionAccessMode(managedSections, sectionKey) {
  if (sectionKey === "exams" || sectionKey === "secondary-exams") return "hasad";
  const configured = managedSections.find((section) => section.sectionKey === sectionKey)?.accessMode;
  if (configured === "free" || configured === "premium" || configured === "hasad") return configured;
  return sectionKey === "judicial" || sectionKey === "contract-templates" ? "hasad" : "premium";
}
function hasFreeManagedSectionAccess(managedSections, sectionKey) {
  return managedSectionAccessMode(managedSections, sectionKey) === "free";
}
function managedSectionForCallback(data) {
  if (isHasadProtectedCallback(data)) return hasadProtectedSectionKey(data);
  if (isReferralProtectedCallback(data)) return data === "secondary-exams" ? "secondary-exams" : "exams";
  if (data === "important-laws" || data.startsWith("ylindex:") || data.startsWith("iindex:") || data.startsWith("ylfile:") || data.startsWith("ifile:")) return "important-laws";
  return void 0;
}
function isHasadProtectedCallback(data) {
  return data === "judicial" || data === "contract-templates" || data.startsWith("index:") || data.startsWith("jsearch") || data.startsWith("jq:") || data.startsWith("jresult:") || data.startsWith("jfile:") || data.startsWith("jresultfile:") || data.startsWith("ctemplates:") || data.startsWith("ctemplate:") || data.startsWith("ctypes") || data.startsWith("ctype:") || data.startsWith("ctsearch");
}
function referralStartReferrerId(text2) {
  const match = text2.match(/^\/start\s+ref_(\d{1,32})$/);
  return match?.[1];
}
function referralRegistrationText(result) {
  if (result === "created") return "\u2705 \u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u0628\u0646\u062C\u0627\u062D. \u0633\u062A\u0635\u0628\u062D \u0645\u0624\u0647\u0644\u0629 \u0644\u0635\u0627\u062D\u0628 \u0627\u0644\u0631\u0627\u0628\u0637 \u0628\u0639\u062F \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u0642\u0646\u0648\u0627\u062A \u0648\u0632\u064A\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0635\u0629 \u0648\u0628\u0642\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0624\u0647\u0644\u064B\u0627 \u0644\u0645\u062F\u0629 24 \u0633\u0627\u0639\u0629.";
  if (result === "existing_user") return "\u2139\uFE0F \u0644\u0645 \u062A\u064F\u0633\u062C\u0644 \u0647\u0630\u0647 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u0644\u0623\u0646 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0628\u0648\u062A \u0633\u0627\u0628\u0642\u064B\u0627. \u0644\u0645\u0646\u0639 \u0627\u0644\u062A\u0644\u0627\u0639\u0628\u060C \u062A\u064F\u062D\u062A\u0633\u0628 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u0641\u0642\u0637 \u0639\u0646\u062F \u0623\u0648\u0644 \u0628\u062F\u0621 \u0644\u0644\u0628\u0648\u062A \u0645\u0646 \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u062D\u0627\u0644\u0629.";
  if (result === "self_referral") return "\u2139\uFE0F \u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u062D\u062A\u0633\u0627\u0628 \u0625\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0646\u0641\u0633\u0647.";
  if (result === "referrer_not_found") return "\u2139\uFE0F \u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u0644\u0623\u0646 \u0635\u0627\u062D\u0628 \u0627\u0644\u0631\u0627\u0628\u0637 \u0644\u0645 \u064A\u0628\u062F\u0623 \u0627\u0644\u0628\u0648\u062A \u0628\u0639\u062F. \u0627\u0637\u0644\u0628 \u0645\u0646\u0647 \u0641\u062A\u062D \u0627\u0644\u0628\u0648\u062A \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u062B\u0645 \u0627\u0633\u062A\u062E\u062F\u0645 \u0631\u0627\u0628\u0637\u064B\u0627 \u062C\u062F\u064A\u062F\u064B\u0627.";
  if (result === "already_referred") return "\u2139\uFE0F \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0631\u062A\u0628\u0637 \u0645\u0633\u0628\u0642\u064B\u0627 \u0628\u0631\u0627\u0628\u0637 \u0625\u062D\u0627\u0644\u0629 \u0622\u062E\u0631\u060C \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0646\u0642\u0644\u0647 \u0623\u0648 \u0627\u062D\u062A\u0633\u0627\u0628\u0647 \u0645\u0631\u062A\u064A\u0646.";
  if (result === "invalid_link") return "\u2139\uFE0F \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D. \u0627\u0641\u062A\u062D \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u0630\u064A \u0623\u0646\u0634\u0623\u0647 \u0627\u0644\u0628\u0648\u062A \u0645\u0646 \u0632\u0631 \xAB\u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u062D\u0627\u0644\u0629\xBB \u0645\u0628\u0627\u0634\u0631\u0629.";
  return "\u26A0\uFE0F \u062A\u0639\u0630\u0631 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u0623\u0639\u062F \u0641\u062A\u062D \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.";
}
function referralHistoryText(items) {
  if (!items.length) return "\u{1F4CB} \u0633\u062C\u0644 \u0627\u0644\u0625\u062D\u0627\u0644\u0627\u062A\n\n\u0644\u0627 \u062A\u0648\u062C\u062F \u0625\u062D\u0627\u0644\u0627\u062A \u0645\u0633\u062C\u0644\u0629 \u0628\u0639\u062F. \u0634\u0627\u0631\u0643 \u0631\u0627\u0628\u0637\u0643 \u0627\u0644\u0634\u062E\u0635\u064A \u0645\u0646 \u0632\u0631 \xAB\u0639\u0631\u0636 \u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u062D\u0627\u0644\u0629 \u0648\u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629\xBB.";
  const rows = items.map((item, index2) => {
    const created = item.createdAt.toLocaleDateString("ar-YE", { year: "numeric", month: "numeric", day: "numeric" });
    if (item.status === "qualified") return `${index2 + 1}. \u2705 \u0645\u062D\u062A\u0633\u0628\u0629 \u0628\u0646\u062C\u0627\u062D${item.qualifiedAt ? ` \u2014 ${item.qualifiedAt.toLocaleDateString("ar-YE")}` : ""}`;
    if (item.status === "rejected") return `${index2 + 1}. \u274C \u063A\u064A\u0631 \u0645\u0624\u0647\u0644\u0629${item.rejectionReason ? ` \u2014 ${item.rejectionReason}` : ""}`;
    return `${index2 + 1}. \u23F3 \u0642\u064A\u062F \u0627\u0644\u062A\u0623\u0647\u064A\u0644 \u0645\u0646\u0630 ${created} \u2014 \u062A\u064F\u062D\u062A\u0633\u0628 \u0628\u0639\u062F 24 \u0633\u0627\u0639\u0629 \u0645\u0646 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u0634\u0631\u0648\u0637.`;
  });
  return ["\u{1F4CB} \u0633\u062C\u0644 \u0627\u0644\u0625\u062D\u0627\u0644\u0627\u062A", "", "\u0644\u0627 \u062A\u0638\u0647\u0631 \u0647\u0648\u064A\u0627\u062A \u0627\u0644\u0623\u0634\u062E\u0627\u0635 \u0627\u0644\u0645\u064F\u062D\u0627\u0644\u064A\u0646 \u062D\u0645\u0627\u064A\u0629\u064B \u0644\u0644\u062E\u0635\u0648\u0635\u064A\u0629.", "", ...rows].join("\n");
}
async function qualifyReferralIfEligible(telegramUserId, store, sender) {
  const result = await store.qualifyReferral(telegramUserId);
  if (!result.event) return;
  const referrerChatId = Number(result.event.referrerChatId);
  if (!Number.isSafeInteger(referrerChatId)) return;
  const reward = result.event.rewardExpiresAt ? `

\u{1F389} \u0627\u0643\u062A\u0645\u0644\u062A \u062E\u0645\u0633 \u0625\u062D\u0627\u0644\u0627\u062A \u0645\u0624\u0647\u0644\u0629. \u0641\u064F\u0639\u0651\u0644 \u0644\u0643 \u0648\u0635\u0648\u0644 \u0645\u062C\u0627\u0646\u064A \u0644\u0645\u062F\u0629 \u0634\u0647\u0631 \u0625\u0644\u0649 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0645\u0645\u064A\u0632\u0629 \u062D\u062A\u0649 ${result.event.rewardExpiresAt.toLocaleDateString("ar-YE", { year: "numeric", month: "long", day: "numeric" })}.` : "";
  await sender.sendMessage(referrerChatId, `\u2705 \u062A\u0645 \u0627\u062D\u062A\u0633\u0627\u0628 \u0625\u062D\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0628\u0646\u062C\u0627\u062D.
\u{1F4CA} \u0625\u062D\u0627\u0644\u0627\u062A\u0643 \u0627\u0644\u0645\u062D\u062A\u0633\u0628\u0629: ${result.event.qualifiedCount} | \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0644\u0644\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629: ${result.event.remainingCount}.${reward}`, referralMenu()).catch(() => void 0);
}
function importantYemeniLawsPaymentMethodMenu() {
  return {
    inline_keyboard: [
      [{ text: "\u062A\u062D\u0648\u064A\u0644 \u0639\u0628\u0631 \u0643\u0631\u064A\u0645\u064A \u2014 3007145477", callback_data: "important-laws:payment:karimi" }],
      [{ text: "\u062A\u062D\u0648\u064A\u0644 \u0639\u0628\u0631 \u0645\u062D\u0641\u0638\u0629 \u062C\u064A\u0628 \u2014 488281", callback_data: "important-laws:payment:jeeb" }],
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: "important-laws" }]
    ]
  };
}
function paidExamPaymentMethodMenu(scope) {
  return {
    inline_keyboard: [
      [{ text: "\u062A\u062D\u0648\u064A\u0644 \u0639\u0628\u0631 \u0643\u0631\u064A\u0645\u064A \u2014 3007145477", callback_data: `premium:payment:${scope}:karimi` }],
      [{ text: "\u062A\u062D\u0648\u064A\u0644 \u0639\u0628\u0631 \u0645\u062D\u0641\u0638\u0629 \u062C\u064A\u0628 \u2014 488281", callback_data: `premium:payment:${scope}:jeeb` }],
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: scope === "sharia_exams" ? "exams" : "secondary-exams" }]
    ]
  };
}
function managedMenuItemPaymentMethodMenu(itemId) {
  return {
    inline_keyboard: [
      [{ text: "\u062A\u062D\u0648\u064A\u0644 \u0639\u0628\u0631 \u0643\u0631\u064A\u0645\u064A \u2014 3007145477", callback_data: `managed-premium:payment:${itemId}:karimi` }],
      [{ text: "\u062A\u062D\u0648\u064A\u0644 \u0639\u0628\u0631 \u0645\u062D\u0641\u0638\u0629 \u062C\u064A\u0628 \u2014 488281", callback_data: `managed-premium:payment:${itemId}:jeeb` }],
      [{ text: "\u0631\u062C\u0648\u0639", callback_data: `managed:${itemId}` }]
    ]
  };
}
function importantYemeniLawsSubscriberText(identity) {
  const displayName = [identity.telegramFirstName, identity.telegramLastName].filter(Boolean).join(" ").trim();
  return [
    `\u0645\u0639\u0631\u0651\u0641 \u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645: ${identity.telegramUserId}`,
    displayName ? `\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0638\u0627\u0647\u0631: ${displayName}` : "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0638\u0627\u0647\u0631: \u063A\u064A\u0631 \u0645\u062A\u0627\u062D",
    identity.telegramUsername ? `\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: @${identity.telegramUsername}` : "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: \u063A\u064A\u0631 \u0645\u062A\u0627\u062D"
  ].join("\n");
}
function importantYemeniLawsPaymentMethodText(paymentMethod) {
  const payment = paymentMethod ? importantYemeniLawsPaymentMethods[paymentMethod] : void 0;
  return payment ? `\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u062E\u062A\u0627\u0631\u0629: ${payment.label}
\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062D\u0648\u064A\u0644: ${payment.details}` : "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644: \u0644\u0645 \u062A\u064F\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u0637\u0644\u0628.";
}
function importantYemeniLawsApprovalMenu(requestId, identity) {
  const profileLink = identity.telegramUsername ? { text: `\u0641\u062A\u062D @${identity.telegramUsername}`, url: `https://t.me/${identity.telegramUsername}` } : { text: "\u0641\u062A\u062D \u0645\u0644\u0641 \u0627\u0644\u0645\u0634\u062A\u0631\u0643", url: `tg://user?id=${identity.telegramUserId}` };
  return {
    inline_keyboard: [
      [{ text: "\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643", callback_data: `important-laws:approve:${requestId}` }],
      [{ text: "\u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628", callback_data: `important-laws:reject:${requestId}` }],
      [profileLink]
    ]
  };
}
function legislationSearchMenu(sources, sessionId, page, totalPages, query) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `lresult:${sessionId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `lresult:${sessionId}:${page + 1}` });
  return {
    inline_keyboard: [
      ...searchSourceRows(sources, (source) => `lresultfile:${source.id}:${sessionId}:${page}`, (source) => highlightSearchTerm(displaySourceTitle(source), query)),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "legislation" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function allYemeniLawsSearchMenu(sources, sessionId, page, totalPages, query) {
  const navigation = [];
  if (page > 1) navigation.push({ text: "\u0627\u0644\u0633\u0627\u0628\u0642", callback_data: `ayresult:${sessionId}:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "\u0627\u0644\u062A\u0627\u0644\u064A", callback_data: `ayresult:${sessionId}:${page + 1}` });
  return {
    inline_keyboard: [
      ...searchSourceRows(sources, (source) => `ayresultfile:${source.id}:${sessionId}:${page}`, (source) => highlightSearchTerm(displaySourceTitle(source), query)),
      ...navigation.length > 0 ? [navigation] : [],
      [{ text: "\u0628\u062D\u062B \u062C\u062F\u064A\u062F", callback_data: "aysearch" }],
      [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "all-yemeni-laws" }],
      [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]
    ]
  };
}
function welcomeText(override) {
  return override?.trim() || [
    "\u{1F3DB} \u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643 \u0641\u064A \u0628\u0648\u062A \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A",
    "\u0645\u0646\u0635\u0629 \u0631\u0642\u0645\u064A\u0629 \u0645\u062A\u062E\u0635\u0635\u0629 \u062A\u0647\u062F\u0641 \u0625\u0644\u0649 \u062A\u064A\u0633\u064A\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0648\u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0648\u0627\u0644\u0641\u0642\u0647\u064A\u0629 \u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0648\u0627\u0644\u0628\u0627\u062D\u062B\u064A\u0646.",
    "\u0627\u062E\u062A\u0631 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0623\u062F\u0646\u0627\u0647 \u0644\u0644\u0628\u062F\u0621:"
  ].join("\n\n");
}
function browseText() {
  return [
    "\u{1F4DA} \u062A\u0635\u0646\u064A\u0641\u0627\u062A \u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629:",
    "\u0627\u062E\u062A\u0631 \u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0644\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0648\u0627\u0644\u0643\u062A\u0628 \u0627\u0644\u0645\u062A\u0627\u062D\u0629."
  ].join("\n\n");
}
function importantYemeniLawsIntroText() {
  return [
    "\u{1F510} \u062E\u062F\u0645\u0629 \u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A",
    "\u0647\u0630\u0627 \u0642\u0633\u0645 \u062E\u0627\u0635 \u064A\u064F\u0641\u062A\u062D \u0644\u0644\u0645\u0634\u062A\u0631\u0643\u064A\u0646 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u064A\u0646 \u0628\u0639\u062F \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u062D\u0644\u064A \u0645\u0646 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A.",
    "\u0642\u064A\u0645\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643: 3000 \u0631\u064A\u0627\u0644.",
    "\u062A\u0634\u0645\u0644 \u0627\u0644\u062E\u062F\u0645\u0629 \u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u0623\u0643\u062B\u0631 \u0627\u0633\u062A\u062E\u062F\u0627\u0645\u064B\u0627 \u0641\u064A \u0627\u0644\u0648\u0627\u0642\u0639 \u0627\u0644\u0639\u0645\u0644\u064A:",
    "\u2022 \u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0627\u062A \u0648\u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0645\u062F\u0646\u064A.\n\u2022 \u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0623\u062D\u0648\u0627\u0644 \u0627\u0644\u0634\u062E\u0635\u064A\u0629.\n\u2022 \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u062F\u0646\u064A.\n\u2022 \u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062C\u0632\u0627\u0626\u064A\u0629.\n\u2022 \u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0625\u062B\u0628\u0627\u062A.\n\u2022 \u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0639\u0644\u0627\u0642\u0629 \u0628\u064A\u0646 \u0627\u0644\u0645\u0624\u062C\u0631 \u0648\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631.\n\u2022 \u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062C\u0631\u0627\u0626\u0645 \u0648\u0627\u0644\u0639\u0642\u0648\u0628\u0627\u062A.\n\u2022 \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062A\u062C\u0627\u0631\u064A.\n\u2022 \u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629.\n\u2022 \u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u062A\u062D\u0643\u064A\u0645.",
    "\u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0645\u062F\u0645\u062C\u0629 \u0641\u064A \u0645\u0644\u0641 Word \u0648\u0627\u062D\u062F \u0628\u0622\u062E\u0631 \u0627\u0644\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062D\u0629\u060C \u0645\u0639 \u0641\u0647\u0631\u0633 \u062A\u0641\u0627\u0639\u0644\u064A \u0644\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0625\u0644\u0649 \u0627\u0644\u0645\u0648\u0636\u0648\u0639\u0627\u062A\u060C \u0648\u0627\u0644\u0628\u062D\u062B \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u0644\u0641\u060C \u0648\u0646\u0633\u062E \u0627\u0644\u0646\u0635\u0648\u0635 \u0628\u0633\u0647\u0648\u0644\u0629.",
    "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u062D\u0644\u064A:\n\u2022 \u0625\u064A\u062F\u0627\u0639 \u0625\u0644\u0649 \u062D\u0633\u0627\u0628 \u0643\u0631\u064A\u0645\u064A: 3007145477\n\u2022 \u0623\u0648 \u062A\u062D\u0648\u064A\u0644 \u0639\u0628\u0631 \u0645\u062D\u0641\u0638\u0629 \u062C\u064A\u0628: 488281",
    "\u0628\u0639\u062F \u0627\u0644\u062A\u062D\u0648\u064A\u0644\u060C \u0627\u0636\u063A\u0637 \xAB\u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0628\u0639\u062F \u0627\u0644\u062A\u062D\u0648\u064A\u0644\xBB \u0644\u064A\u0635\u0644 \u0637\u0644\u0628\u0643 \u0625\u0644\u0649 \u0627\u0644\u0645\u0634\u0631\u0641 \u0644\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u064A\u062F\u0648\u064A."
  ].join("\n\n");
}
function searchText() {
  return [
    "\u{1F50E} \u0645\u062D\u0631\u0643 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A \u0627\u0644\u0645\u0648\u062D\u062F:",
    "\u0627\u062E\u062A\u0631 \u0646\u0637\u0627\u0642 \u0627\u0644\u0628\u062D\u062B: \u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629\u060C \u0623\u0648 \u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629\u060C \u0623\u0648 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629.",
    "\u064A\u0645\u0643\u0646\u0643 \u0623\u064A\u0636\u064B\u0627 \u0625\u0631\u0633\u0627\u0644 /search \u0645\u062A\u0628\u0648\u0639\u064B\u0627 \u0628\u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0627\u062F \u0627\u0644\u0628\u062D\u062B \u0639\u0646\u0647\u0627 \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629.",
    "\u0645\u062B\u0627\u0644: /search \u0627\u0644\u062A\u0639\u0648\u064A\u0636 \u0623\u0648 /search \u0639\u0642\u062F \u0627\u0644\u0628\u064A\u0639"
  ].join("\n\n");
}
function helpText(override) {
  return override?.trim() || [
    "\u2753 \u062F\u0644\u064A\u0644 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0648\u0627\u0644\u062F\u0639\u0645:",
    "\u2022 /start - \u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629.",
    "\u2022 /browse - \u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0648\u0627\u0644\u062A\u0635\u0646\u064A\u0641\u0627\u062A.",
    "\u2022 /search - \u0641\u062A\u062D \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0645\u0648\u062D\u062F \u0623\u0648 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0641\u064A \u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629.",
    "\u2022 /support \u0631\u0633\u0627\u0644\u062A\u0643 - \u0625\u0631\u0633\u0627\u0644 \u0627\u0642\u062A\u0631\u0627\u062D \u0623\u0648 \u0637\u0644\u0628 \u062F\u0639\u0645 \u0625\u0644\u0649 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A.",
    "\u{1F4E9} \u0644\u0627 \u062A\u064F\u0646\u0634\u0631 \u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u062F\u0639\u0645 \u0641\u064A \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A\u061B \u062A\u062D\u0641\u0638 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0646 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A."
  ].join("\n");
}
function aboutText(override) {
  return override?.trim() || [
    "\u2139\uFE0F \u0639\u0646 \u0628\u0648\u062A \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A",
    "\u0645\u0646\u0635\u0629 \u0645\u0639\u0631\u0641\u064A\u0629 \u0648\u062A\u0639\u0644\u064A\u0645\u064A\u0629 \u0628\u0625\u0634\u0631\u0627\u0641 \u0623. \u0645\u0639\u064A\u0646 \u0627\u0644\u0646\u0627\u0635\u0631\u060C \u062A\u062A\u064A\u062D \u0644\u0644\u0637\u0644\u0627\u0628 \u0648\u0627\u0644\u0628\u0627\u062D\u062B\u064A\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0645\u0646\u0638\u0645 \u0625\u0644\u0649 \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0648\u0627\u0644\u0641\u0642\u0647\u064A\u0629\u060C \u0648\u0627\u0633\u062A\u0639\u0631\u0627\u0636 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0648\u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629\u060C \u0648\u0627\u0644\u0627\u0633\u062A\u0641\u0627\u062F\u0629 \u0645\u0646 \u0646\u0645\u0627\u0630\u062C \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0644\u0645\u062E\u062A\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0648\u064A\u0627\u062A \u0648\u0627\u0644\u0645\u0648\u0627\u062F.",
    "\u0635\u064F\u0645\u0645\u062A \u0627\u0644\u0645\u0646\u0635\u0629 \u0644\u062A\u0633\u0647\u064A\u0644 \u0627\u0644\u062A\u0639\u0644\u0645 \u0648\u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 \u0625\u0644\u0649 \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0641\u064A \u0645\u0643\u0627\u0646 \u0648\u0627\u062D\u062F.",
    "\u2696\uFE0F \u0647\u0630\u0627 \u0627\u0644\u0628\u0648\u062A \u0645\u0628\u0627\u062F\u0631\u0629 \u062A\u0639\u0644\u064A\u0645\u064A\u0629 \u0645\u0633\u062A\u0642\u0644\u0629\u060C \u0648\u0644\u0627 \u064A\u0645\u062B\u0644 \u062C\u0647\u0629 \u062D\u0643\u0648\u0645\u064A\u0629 \u0623\u0648 \u062C\u0627\u0645\u0639\u0629 \u0631\u0633\u0645\u064A\u0629."
  ].join("\n\n");
}
function sourceText(source) {
  const metadata = source.collection === "legislation" || source.collection === "yemeni_laws" ? [
    `\u0627\u0644\u0646\u0648\u0639: ${legislationDocumentTypeLabels[source.documentType]}`,
    ...source.legislationYear ? [`\u0627\u0644\u0633\u0646\u0629: ${source.legislationYear}`] : [],
    ...source.issuingAuthority ? [`\u0627\u0644\u062C\u0647\u0629: ${source.issuingAuthority}`] : []
  ] : [`\u0627\u0644\u062A\u0635\u0646\u064A\u0641: ${categoryLabels[source.category]}`];
  return [
    displaySourceTitle(source),
    "",
    source.description,
    "",
    ...metadata
  ].join("\n");
}
var MAX_DOCUMENT_BYTES = 45 * 1024 * 1024;
var TELEGRAM_USER_MESSAGES = {
  privateFilesOnly: "\u064A\u062A\u0627\u062D \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.",
  fileUnavailable: "\u062A\u0639\u0630\u0631 \u062A\u062C\u0647\u064A\u0632 \u0647\u0630\u0627 \u0627\u0644\u0645\u0635\u062F\u0631 \u0643\u0645\u0644\u0641 \u0644\u0644\u0625\u0631\u0633\u0627\u0644. \u062C\u0631\u0651\u0628 \u0645\u0644\u0641\u064B\u0627 \u0622\u062E\u0631 \u0645\u0646 \u0627\u0644\u0641\u0647\u0631\u0633.",
  filePreparing: "\u0627\u0646\u062A\u0638\u0631 \u0642\u0644\u064A\u0644\u064B\u0627\u060C \u064A\u062C\u0631\u064A \u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0644\u0625\u0631\u0633\u0627\u0644\u0647 \u0625\u0644\u064A\u0643 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629.",
  fileTooLarge: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0644\u0641 \u0644\u0623\u0646 \u062D\u062C\u0645\u0647 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0622\u0645\u0646 \u0644\u0644\u0625\u0631\u0633\u0627\u0644 \u0639\u0628\u0631 \u0627\u0644\u0628\u0648\u062A.",
  fileDownloadFailed: "\u062A\u0639\u0630\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0645\u0644\u0641 \u0645\u0646 \u0627\u0644\u0645\u0635\u062F\u0631 \u062D\u0627\u0644\u064A\u064B\u0627. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0627\u062D\u0642\u064B\u0627.",
  unknownRequest: "\u0644\u0645 \u0623\u0641\u0647\u0645 \u0637\u0644\u0628\u0643. \u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0623\u0632\u0631\u0627\u0631 \u0623\u0648 \u0627\u0643\u062A\u0628 /help \u0644\u0644\u0645\u0633\u0627\u0639\u062F\u0629.",
  searchExpired: (scope) => `\u0627\u0646\u062A\u0647\u062A \u0645\u0647\u0644\u0629 \u0627\u0644\u0628\u062D\u062B. \u0627\u0628\u062F\u0623 \u0628\u062D\u062B\u064B\u0627 \u062C\u062F\u064A\u062F\u064B\u0627 \u062F\u0627\u062E\u0644 ${scope}.`,
  searchNoResults: (scope, query) => `\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u062A\u0627\u0626\u062C \u062F\u0627\u062E\u0644 ${scope} \u0644\u0639\u0628\u0627\u0631\u0629 \xAB${query}\xBB. \u062C\u0631\u0651\u0628 \u0643\u0644\u0645\u0629 \u0623\u062E\u0631\u0649 \u0623\u0648 \u0646\u0637\u0627\u0642 \u0628\u062D\u062B \u0645\u062E\u062A\u0644\u0641\u064B\u0627.`,
  approximateSearchNote: "\n\u0645\u0644\u0627\u062D\u0638\u0629: \u0647\u0630\u0647 \u0646\u062A\u0627\u0626\u062C \u0642\u0631\u064A\u0628\u0629 \u0627\u0642\u062A\u0631\u062D\u0647\u0627 \u0627\u0644\u0628\u062D\u062B \u0644\u062A\u062C\u0627\u0648\u0632 \u0627\u062E\u062A\u0644\u0627\u0641 \u0623\u0648 \u062E\u0637\u0623 \u0625\u0645\u0644\u0627\u0626\u064A \u0645\u062D\u062A\u0645\u0644."
};
var FileDeliveryError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
};
function driveDownloadUrl(fileId) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}
async function sourceDownloadUrl(source) {
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
function canDeliverDocumentSource(source) {
  return Boolean(source && (source.driveFileId || source.url.startsWith("/manus-storage/")));
}
function documentFilename(source, contentType) {
  const title = source.title.trim().slice(0, 180) || "document";
  if (/\.[a-z0-9]{1,10}$/i.test(title)) return title;
  const storageExtension = source.url.match(/\.([a-z0-9]{1,10})(?:$|\?)/i)?.[1];
  const contentTypeExtension = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "text/plain": "txt"
  };
  const extension = storageExtension ?? contentTypeExtension[contentType.toLowerCase()];
  return extension ? `${title}.${extension}` : title;
}
async function downloadDriveDocument(source) {
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
    caption: sourceText(source).slice(0, 950)
  };
}
async function downloadManagedMenuItemDocument(item) {
  if (!item.actionValue.startsWith("/manus-storage/")) throw new FileDeliveryError("UNAVAILABLE");
  const key = item.actionValue.slice("/manus-storage/".length);
  if (!key) throw new FileDeliveryError("UNAVAILABLE");
  let signedUrl;
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
  return { filename: documentFilename({ title: item.label, url: item.actionValue }, contentType), contentType, data, caption: `\u0645\u0633\u062A\u0648\u0631\u062F \u0645\u0646 \u0645\u0643\u062A\u0628\u0629 \u0623. \u0645\u0639\u064A\u0646 \u0627\u0644\u0646\u0627\u0635\u0631
${item.label}` };
}
function isPrivateChat(chatType) {
  return chatType === void 0 || chatType === "private";
}
async function deliverPrivateDocument(chatId, source, sender, provider) {
  if (!canDeliverDocumentSource(source)) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.fileUnavailable);
    return;
  }
  await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.filePreparing);
  try {
    const downloaded = await provider.download(source);
    await sender.sendDocument(chatId, {
      ...downloaded,
      caption: source.collection === "illustrated_legal_forms" ? "\u0645\u0633\u062A\u0648\u0631\u062F \u0645\u0646 \u0645\u0643\u062A\u0628\u0629 \u0623. \u0645\u0639\u064A\u0646 \u0627\u0644\u0646\u0627\u0635\u0631" : `\u0645\u0633\u062A\u0648\u0631\u062F \u0645\u0646 \u0645\u0643\u062A\u0628\u0629 \u0623. \u0645\u0639\u064A\u0646 \u0627\u0644\u0646\u0627\u0635\u0631
${source.title}`
    });
  } catch (error) {
    const code = error instanceof FileDeliveryError ? error.code : "UNAVAILABLE";
    const message = code === "TOO_LARGE" ? TELEGRAM_USER_MESSAGES.fileTooLarge : TELEGRAM_USER_MESSAGES.fileDownloadFailed;
    await sender.sendMessage(chatId, message);
  }
}
function searchResultText(query, sources) {
  if (sources.length === 0) {
    return `\u0644\u0645 \u0646\u0639\u062B\u0631 \u0639\u0644\u0649 \u0645\u0635\u0627\u062F\u0631 \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0639\u0628\u0627\u0631\u0629 \xAB${query}\xBB. \u062C\u0631\u0651\u0628 \u0643\u0644\u0645\u0629 \u0623\u062E\u0631\u0649 \u0623\u0648 \u062A\u0635\u0641\u062D \u0627\u0644\u062A\u0635\u0646\u064A\u0641\u0627\u062A.`;
  }
  return `\u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0628\u062D\u062B \u0639\u0646 \xAB${query}\xBB: \u0627\u062E\u062A\u0631 \u0645\u0635\u062F\u0631\u064B\u0627 \u0644\u0639\u0631\u0636 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644.`;
}
function normalizeCommand(text2) {
  const [rawCommand, ...rest] = text2.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().replace(/@[^\s]+$/, "");
  return { command, query: rest.join(" ").trim() };
}
function getTelegramUserId(update, chatId) {
  return String(update.callback_query?.from?.id ?? update.message?.from?.id ?? chatId);
}
async function getAccessRequirementStatus(telegramUserId, store, membershipChecker) {
  const channels = await Promise.all(REQUIRED_CHANNELS.map(async (channel) => ({
    channel,
    status: await membershipChecker.check(telegramUserId, channel.handle).catch(() => "unavailable")
  })));
  const platformVerified = await store.hasConfirmedPlatformAccess(telegramUserId);
  return { channels, platformVerified };
}
function areChannelsSubscribed(requirements) {
  return requirements.channels.every(({ status }) => status === "subscribed");
}
async function promptAccessRequirements(chatId, sender, requirements) {
  await sender.sendMessage(chatId, accessRequirementsText(requirements), channelSubscriptionMenu());
}
async function sendSourcesForCategory(chatId, category, requestedPage, store, sender) {
  const initial = await store.listSourcesByCategory(category, Math.max(1, requestedPage));
  const totalPages = Math.max(1, Math.ceil(initial.total / 8));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const { sources, total } = page === requestedPage ? initial : await store.listSourcesByCategory(category, page);
  if (sources.length === 0) {
    await sender.sendMessage(
      chatId,
      `\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0635\u0627\u062F\u0631 \u0645\u0636\u0627\u0641\u0629 \u062D\u0627\u0644\u064A\u064B\u0627 \u0636\u0645\u0646 \u062A\u0635\u0646\u064A\u0641 ${categoryLabels[category]}.`,
      categoryMenu()
    );
    return;
  }
  await sender.sendMessage(
    chatId,
    `\u0645\u0635\u0627\u062F\u0631 \u062A\u0635\u0646\u064A\u0641 ${categoryLabels[category]} \u2014 \u0627\u0644\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages} (${total} \u0645\u0635\u062F\u0631\u064B\u0627): \u0627\u062E\u062A\u0631 \u0645\u0635\u062F\u0631\u064B\u0627 \u0644\u0625\u0631\u0633\u0627\u0644\u0647 \u062F\u0627\u062E\u0644 \u0645\u062D\u0627\u062F\u062B\u062A\u0643 \u0627\u0644\u062E\u0627\u0635\u0629.`,
    sourceMenu(sources, category, page, totalPages)
  );
}
async function promptLibrarySearch(chatId, store, sender) {
  await store.beginLibrarySearch(String(chatId));
  await sender.sendMessage(
    chatId,
    "\u{1F50E} \u0627\u0644\u0628\u062D\u062B \u0641\u064A \u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629\n\n\u0627\u0643\u062A\u0628 \u0643\u0644\u0645\u0629 \u0623\u0648 \u0639\u0628\u0627\u0631\u0629 \u0644\u0644\u0628\u062D\u062B. \u0633\u064A\u0642\u062A\u0631\u062D \u0627\u0644\u0628\u0648\u062A \u0646\u062A\u0627\u0626\u062C \u0642\u0631\u064A\u0628\u0629 \u0639\u0646\u062F \u0648\u062C\u0648\u062F \u0627\u062E\u062A\u0644\u0627\u0641 \u0625\u0645\u0644\u0627\u0626\u064A \u0645\u062D\u062A\u0645\u0644.",
    { inline_keyboard: [[{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0645\u0648\u062D\u062F", callback_data: "search" }], [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]] }
  );
}
async function sendLibrarySearchResults(chatId, sessionId, requestedPage, store, sender) {
  const initial = await store.searchLibrarySources(sessionId, Math.max(1, requestedPage));
  if (!initial) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchExpired("\u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629"), unifiedSearchMenu());
    return;
  }
  if (initial.total === 0) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchNoResults("\u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629", initial.query), unifiedSearchMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.searchLibrarySources(sessionId, page);
  if (!content) return;
  const matchNote = content.matchType === "approximate" ? TELEGRAM_USER_MESSAGES.approximateSearchNote : "";
  await sender.sendMessage(
    chatId,
    `\u0646\u062A\u0627\u0626\u062C \xAB${content.query}\xBB \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u2014 \u0627\u0644\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages} (${content.total} \u0646\u062A\u064A\u062C\u0629):${matchNote}`,
    librarySearchMenu(content.sources, sessionId, page, totalPages)
  );
}
async function sendCuratedSources(chatId, title, sources, backCallback, sender) {
  const publicSources = sources.filter((source) => source.collection !== "important_yemeni_laws");
  if (publicSources.length === 0) {
    await sender.sendMessage(chatId, `${title}
\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0643\u0627\u0641\u064A\u0629 \u0628\u0639\u062F \u0644\u0639\u0631\u0636 \u0639\u0646\u0627\u0635\u0631 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645.`, mainMenu());
    return;
  }
  await sender.sendMessage(chatId, `${title}
\u0627\u062E\u062A\u0631 \u0645\u0644\u0641\u064B\u0627 \u0644\u0625\u0631\u0633\u0627\u0644\u0647 \u062F\u0627\u062E\u0644 \u0645\u062D\u0627\u062F\u062B\u062A\u0643 \u0627\u0644\u062E\u0627\u0635\u0629.`, curatedSourceMenu(publicSources, backCallback));
}
async function sendLegislationType(chatId, documentType, requestedPage, store, sender) {
  const initial = await store.listLegislationSourcesByType(documentType, Math.max(1, requestedPage));
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.listLegislationSourcesByType(documentType, page);
  if (content.sources.length === 0) {
    await sender.sendMessage(chatId, `\u0644\u0627 \u062A\u0648\u062C\u062F ${legislationDocumentTypeLabels[documentType]} \u0645\u0635\u0646\u0641\u0629 \u062D\u0627\u0644\u064A\u064B\u0627 \u062F\u0627\u062E\u0644 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629.`, legislationTypeMenu());
    return;
  }
  await sender.sendMessage(
    chatId,
    `${legislationDocumentTypeLabels[documentType]} \u062F\u0627\u062E\u0644 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u2014 \u0627\u0644\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages} (${content.total} \u0645\u0644\u0641\u064B\u0627):`,
    legislationTypeSourceMenu(content.sources, documentType, page, totalPages)
  );
}
async function sendLegislationYear(chatId, year, requestedPage, store, sender) {
  const initial = await store.listLegislationSourcesByYear(year, Math.max(1, requestedPage));
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.listLegislationSourcesByYear(year, page);
  if (content.sources.length === 0) {
    await sender.sendMessage(chatId, `\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u0634\u0631\u064A\u0639\u0627\u062A \u062A\u062D\u0645\u0644 \u0633\u0646\u0629 \u0627\u0644\u0625\u0635\u062F\u0627\u0631 ${year} \u0636\u0645\u0646 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0648\u0635\u0641\u064A\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629.`, legislationFilterMenu());
    return;
  }
  await sender.sendMessage(
    chatId,
    `\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0633\u0646\u0629 ${year} \u2014 \u0627\u0644\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages} (${content.total} \u0645\u0644\u0641\u064B\u0627):`,
    legislationYearSourceMenu(content.sources, year, page, totalPages)
  );
}
async function promptSupport(chatId, sender) {
  await sender.sendMessage(
    chatId,
    "\u{1F4AC} \u0627\u0644\u062F\u0639\u0645 \u0648\u0627\u0644\u0645\u0642\u062A\u0631\u062D\u0627\u062A\n\n\u0644\u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628\u060C \u0627\u0643\u062A\u0628: /support \u062B\u0645 \u0631\u0633\u0627\u0644\u062A\u0643.\n\u0645\u062B\u0627\u0644: /support \u0623\u0631\u062C\u0648 \u0625\u0636\u0627\u0641\u0629 \u0642\u0627\u0646\u0648\u0646 \u062C\u062F\u064A\u062F \u0625\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629.\n\n\u0633\u064A\u064F\u062D\u0641\u0638 \u0627\u0644\u0637\u0644\u0628 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0646 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A\u060C \u0648\u0644\u0627 \u064A\u064F\u0646\u0634\u0631 \u0641\u064A \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A.",
    supportMenu()
  );
}
function ownerStatisticsText(stats) {
  const queries = stats.topQueries.length > 0 ? stats.topQueries.map((item, index2) => `${index2 + 1}. ${item.query} (${item.count})`).join("\n") : "\u0644\u0627 \u062A\u0648\u062C\u062F \u0639\u0645\u0644\u064A\u0627\u062A \u0628\u062D\u062B \u0645\u0633\u062C\u0644\u0629 \u0628\u0639\u062F.";
  return [
    "\u{1F4CA} \u0625\u062D\u0635\u0627\u0621\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u0643",
    `\u0625\u062C\u0645\u0627\u0644\u064A \u0623\u062D\u062F\u0627\u062B \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645: ${stats.totalEvents}`,
    `\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u062C\u062F\u064A\u062F\u0629: ${stats.totalSupportRequests}`,
    "\u0623\u0643\u062B\u0631 \u0639\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0628\u062D\u062B:",
    queries
  ].join("\n");
}
function isTelegramOwner(telegramUserId, ownerTelegramId = process.env.TELEGRAM_OWNER_ID) {
  return Boolean(ownerTelegramId) && telegramUserId === ownerTelegramId;
}
function supportRequestsText(requests) {
  if (requests.length === 0) return "\u{1F4E5} \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u062C\u062F\u064A\u062F\u0629\n\n\u0644\u0627 \u062A\u0648\u062C\u062F \u0637\u0644\u0628\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u062D\u0627\u0644\u064A\u064B\u0627.";
  return [
    "\u{1F4E5} \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u062C\u062F\u064A\u062F\u0629",
    ...requests.map((request) => `#${request.id} \u2014 ${request.message}`)
  ].join("\n\n");
}
function isPrivateOwnerConversation(telegramUserId, chatType) {
  return isPrivateChat(chatType) && isTelegramOwner(telegramUserId);
}
function broadcastPreviewText(draft) {
  const content = draft.kind === "message" ? `\u0627\u0644\u0631\u0633\u0627\u0644\u0629:
${draft.message ?? ""}` : `\u0627\u0644\u0645\u0644\u0641: ${draft.fileName ?? "\u0645\u0644\u0641 \u062F\u0648\u0646 \u0627\u0633\u0645"}${draft.caption ? `
\u0627\u0644\u0648\u0635\u0641: ${draft.caption}` : ""}`;
  return [
    "\u{1F4E3} \u0645\u0639\u0627\u064A\u0646\u0629 \u0627\u0644\u0628\u062B \u0627\u0644\u062C\u0645\u0627\u0639\u064A",
    content,
    `\u0627\u0644\u0645\u0633\u062A\u0644\u0645\u0648\u0646 \u0627\u0644\u0645\u0633\u062C\u0644\u0648\u0646 \u062D\u0627\u0644\u064A\u064B\u0627: ${draft.recipientCount}`,
    "\u0644\u0646 \u064A\u064F\u0631\u0633\u0644 \u0634\u064A\u0621 \u0642\u0628\u0644 \u0627\u0644\u0636\u063A\u0637 \u0639\u0644\u0649 \xAB\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0625\u0631\u0633\u0627\u0644\xBB."
  ].join("\n\n");
}
function broadcastConfirmationMenu(broadcastId) {
  return {
    inline_keyboard: [
      [{ text: "\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0625\u0631\u0633\u0627\u0644", callback_data: `broadcast:confirm:${broadcastId}` }],
      [{ text: "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0645\u0633\u0648\u062F\u0629", callback_data: `broadcast:cancel:${broadcastId}` }]
    ]
  };
}
async function sendBroadcastPreview(chatId, draft, sender) {
  await sender.sendMessage(chatId, broadcastPreviewText(draft), broadcastConfirmationMenu(draft.id));
}
async function sendJudicialFolder(chatId, folderId, requestedPage, store, sender) {
  const initial = await store.getJudicialFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F \u0641\u064A \u0627\u0644\u0641\u0647\u0631\u0633 \u0627\u0644\u0642\u0636\u0627\u0626\u064A.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getJudicialFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  await sender.sendMessage(
    chatId,
    ["\u2696\uFE0F \u0627\u0644\u0645\u0628\u0627\u062F\u0626 \u0648\u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629", "\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062C\u0627\u0644 \u0623\u0648 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0637\u0644\u0648\u0628:"].join("\n\n"),
    judicialFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}
async function promptJudicialSearch(chatId, store, sender) {
  await store.beginJudicialSearch(String(chatId));
  await sender.sendMessage(
    chatId,
    "\u26A1 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0633\u0631\u064A\u0639 \u0641\u064A \u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629\n\n\u0627\u0643\u062A\u0628 \u0643\u0644\u0645\u0629 \u0623\u0648 \u0639\u0628\u0627\u0631\u0629 \u0644\u0644\u0628\u062D\u062B \u0641\u0648\u0631\u064B\u0627. \u0645\u062B\u0627\u0644: \u0623\u062D\u0643\u0627\u0645 \u0645\u062F\u0646\u064A\u0629 \u0623\u0648 \u062A\u062C\u0627\u0631\u064A 2008. \u0648\u064A\u0645\u0643\u0646\u0643 \u0623\u064A\u0636\u064B\u0627 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 /qj \u0645\u062A\u0628\u0648\u0639\u064B\u0627 \u0628\u0639\u0628\u0627\u0631\u0629 \u0627\u0644\u0628\u062D\u062B.",
    { inline_keyboard: [[{ text: "\u0645\u062F\u0646\u064A", callback_data: "jq:\u0645\u062F\u0646\u064A" }, { text: "\u062A\u062C\u0627\u0631\u064A", callback_data: "jq:\u062A\u062C\u0627\u0631\u064A" }], [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0642\u0648\u0627\u0639\u062F \u0642\u0636\u0627\u0626\u064A\u0629", callback_data: "judicial" }], [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]] }
  );
}
async function runQuickJudicialSearch(chatId, telegramUserId, query, store, sender) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    await promptJudicialSearch(chatId, store, sender);
    return;
  }
  await store.beginJudicialSearch(String(chatId));
  const session = await store.consumeJudicialSearchQuery(String(chatId), normalizedQuery);
  if (!session) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0628\u062F\u0621 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0633\u0631\u064A\u0639 \u0627\u0644\u0622\u0646. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.");
    return;
  }
  await store.recordUsage(telegramUserId, "search", { query: normalizedQuery });
  await sendJudicialSearchResults(chatId, session.id, 1, store, sender);
}
async function sendJudicialSearchResults(chatId, sessionId, requestedPage, store, sender) {
  const initial = await store.searchJudicialSources(sessionId, Math.max(1, requestedPage));
  if (!initial) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchExpired("\u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629"), { inline_keyboard: [[{ text: "\u0642\u0648\u0627\u0639\u062F \u0642\u0636\u0627\u0626\u064A\u0629", callback_data: "judicial" }]] });
    return;
  }
  if (initial.total === 0) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchNoResults("\u0642\u0648\u0627\u0639\u062F \u0642\u0636\u0627\u0626\u064A\u0629", initial.query), { inline_keyboard: [[{ text: "\u0628\u062D\u062B \u062C\u062F\u064A\u062F", callback_data: "jsearch" }], [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0642\u0648\u0627\u0639\u062F \u0642\u0636\u0627\u0626\u064A\u0629", callback_data: "judicial" }]] });
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.searchJudicialSources(sessionId, page);
  if (!content) return;
  const matchNote = content.matchType === "approximate" ? TELEGRAM_USER_MESSAGES.approximateSearchNote : "";
  await sender.sendMessage(
    chatId,
    `\u0646\u062A\u0627\u0626\u062C \xAB${content.query}\xBB \u062F\u0627\u062E\u0644 \u0642\u0648\u0627\u0639\u062F \u0642\u0636\u0627\u0626\u064A\u0629 \u2014 \u0627\u0644\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages} (${content.total} \u0646\u062A\u064A\u062C\u0629):${matchNote}`,
    judicialSearchMenu(content.sources, sessionId, page, totalPages, content.query)
  );
}
async function sendLegislationFolder(chatId, folderId, requestedPage, store, sender) {
  const initial = await store.getLegislationFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F \u0641\u064A \u0641\u0647\u0631\u0633 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getLegislationFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  await sender.sendMessage(
    chatId,
    ["\u{1F4DC} \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", "\u0627\u062E\u062A\u0631 \u0627\u0644\u062A\u0634\u0631\u064A\u0639 \u0623\u0648 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0637\u0644\u0648\u0628:"].join("\n\n"),
    legislationFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}
async function sendLegalFormsFolder(chatId, folderId, requestedPage, store, sender) {
  const initial = await store.getLegalFormsFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F \u0641\u064A \u0641\u0647\u0631\u0633 \u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0648\u0627\u0644\u0635\u064A\u063A \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getLegalFormsFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  await sender.sendMessage(
    chatId,
    ["\u{1F4DD} \u0646\u0645\u0627\u0630\u062C \u0648\u0635\u064A\u063A \u0642\u0627\u0646\u0648\u0646\u064A\u0629", "\u0627\u062E\u062A\u0631 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0623\u0648 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628:"].join("\n\n"),
    legalFormsFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}
async function sendIllustratedLegalFormsFolder(chatId, folderId, requestedPage, store, sender) {
  const initial = await store.getIllustratedLegalFormsFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u0641\u064A \u0641\u0647\u0631\u0633 \u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0627\u0644\u0645\u0635\u0648\u0631\u0629 \u0648\u0641\u0642 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getIllustratedLegalFormsFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  const folderTitle = folder.parentDriveFolderId ? `\u{1F5BC} ${cleanGenericFileDisplayName(folder.name)}` : "\u{1F5BC} \u0646\u0645\u0627\u0630\u062C \u0645\u0635\u0648\u0631\u0629 \u0648\u0641\u0642 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629";
  await sender.sendMessage(
    chatId,
    [folderTitle, "\u0627\u062E\u062A\u0631 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u0637\u0644\u0648\u0628:"].join("\n\n"),
    illustratedLegalFormsFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}
async function sendAllYemeniLawsFolder(chatId, folderId, requestedPage, store, sender) {
  const initial = await store.getAllYemeniLawsFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u0641\u064A \u0641\u0647\u0631\u0633 \u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getAllYemeniLawsFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  await sender.sendMessage(
    chatId,
    ["\u2696\uFE0F \u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629", "\u0627\u062E\u062A\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0623\u0648 \u0627\u0644\u0644\u0627\u0626\u062D\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629:"].join("\n\n"),
    allYemeniLawsFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}
async function sendFeaturedReferencesFolder(chatId, folderId, requestedPage, store, sender) {
  const initial = await store.getFeaturedReferencesFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F \u0641\u064A \u0641\u0647\u0631\u0633 \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0645\u064A\u0632\u0629.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getFeaturedReferencesFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  await sender.sendMessage(
    chatId,
    ["\u{1F4CC} \u0645\u0631\u0627\u062C\u0639 \u0645\u0645\u064A\u0632\u0629", "\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u0631\u062C\u0639 \u0623\u0648 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0637\u0644\u0648\u0628:"].join("\n\n"),
    featuredReferencesFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}
async function sendImportantYemeniLawsFolder(chatId, folderId, requestedPage, store, sender) {
  const initial = await store.getImportantYemeniLawsFolderContents(folderId, Math.max(1, requestedPage));
  if (!initial.folder) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0642\u0633\u0645 \u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A.", mainMenu());
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.totalSources / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.getImportantYemeniLawsFolderContents(folderId, page);
  const folder = content.folder ?? initial.folder;
  const fileText = content.totalSources > 0 ? `\u0627\u0644\u0645\u0644\u0641\u0627\u062A: \u0627\u0644\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages} (${content.totalSources} \u0645\u0644\u0641\u064B\u0627).` : "\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0644\u0641\u0627\u062A \u0645\u0628\u0627\u0634\u0631\u0629 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645.";
  await sender.sendMessage(
    chatId,
    [`\u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A \u2014 ${folder.name}`, `\u0627\u0644\u0645\u062C\u0644\u062F\u0627\u062A \u0627\u0644\u0641\u0631\u0639\u064A\u0629: ${content.folders.length}.`, fileText, "\u0627\u062E\u062A\u0631 \u0645\u0644\u0641\u064B\u0627 \u0644\u0625\u0631\u0633\u0627\u0644\u0647 \u062F\u0627\u062E\u0644 \u0645\u062D\u0627\u062F\u062B\u062A\u0643 \u0627\u0644\u062E\u0627\u0635\u0629."].join("\n"),
    importantYemeniLawsFolderMenu(content.folders, content.sources, folder, page, totalPages)
  );
}
async function promptLegislationSearch(chatId, store, sender) {
  await store.beginLegislationSearch(String(chatId));
  await sender.sendMessage(
    chatId,
    "\u26A1 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0633\u0631\u064A\u0639 \u0641\u064A \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629\n\n\u0627\u0643\u062A\u0628 \u0643\u0644\u0645\u0629 \u0623\u0648 \u0639\u0628\u0627\u0631\u0629 \u0644\u0644\u0628\u062D\u062B \u0641\u0648\u0631\u064B\u0627. \u0645\u062B\u0627\u0644: \u062A\u062D\u0643\u064A\u0645 \u0623\u0648 \u062A\u0623\u0645\u064A\u0646\u0627\u062A \u0627\u062C\u062A\u0645\u0627\u0639\u064A\u0629. \u0648\u064A\u0645\u0643\u0646\u0643 \u0623\u064A\u0636\u064B\u0627 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 /ql \u0645\u062A\u0628\u0648\u0639\u064B\u0627 \u0628\u0639\u0628\u0627\u0631\u0629 \u0627\u0644\u0628\u062D\u062B.",
    { inline_keyboard: [[{ text: "\u062A\u062D\u0643\u064A\u0645", callback_data: "lq:\u062A\u062D\u0643\u064A\u0645" }, { text: "\u0645\u0631\u0627\u0641\u0639\u0627\u062A", callback_data: "lq:\u0645\u0631\u0627\u0641\u0639\u0627\u062A" }], [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "legislation" }], [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]] }
  );
}
async function runQuickLegislationSearch(chatId, telegramUserId, query, store, sender) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    await promptLegislationSearch(chatId, store, sender);
    return;
  }
  await store.beginLegislationSearch(String(chatId));
  const session = await store.consumeLegislationSearchQuery(String(chatId), normalizedQuery);
  if (!session) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0628\u062F\u0621 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0633\u0631\u064A\u0639 \u0627\u0644\u0622\u0646. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.");
    return;
  }
  await store.recordUsage(telegramUserId, "search", { query: normalizedQuery });
  await sendLegislationSearchResults(chatId, session.id, 1, store, sender);
}
async function sendLegislationSearchResults(chatId, sessionId, requestedPage, store, sender) {
  const initial = await store.searchLegislationSources(sessionId, Math.max(1, requestedPage));
  if (!initial) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchExpired("\u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629"), { inline_keyboard: [[{ text: "\u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "legislation" }]] });
    return;
  }
  if (initial.total === 0) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchNoResults("\u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", initial.query), { inline_keyboard: [[{ text: "\u0628\u062D\u062B \u062C\u062F\u064A\u062F", callback_data: "lsearch" }], [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "legislation" }]] });
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.searchLegislationSources(sessionId, page);
  if (!content) return;
  const matchNote = content.matchType === "approximate" ? TELEGRAM_USER_MESSAGES.approximateSearchNote : "";
  await sender.sendMessage(
    chatId,
    `\u0646\u062A\u0627\u0626\u062C \xAB${content.query}\xBB \u062F\u0627\u062E\u0644 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u2014 \u0627\u0644\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages} (${content.total} \u0646\u062A\u064A\u062C\u0629):${matchNote}`,
    legislationSearchMenu(content.sources, sessionId, page, totalPages, content.query)
  );
}
async function promptAllYemeniLawsSearch(chatId, store, sender) {
  await store.beginAllYemeniLawsSearch(String(chatId));
  await sender.sendMessage(
    chatId,
    "\u26A1 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0633\u0631\u064A\u0639 \u0641\u064A \u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629\n\n\u0627\u0643\u062A\u0628 \u0643\u0644\u0645\u0629 \u0623\u0648 \u0639\u0628\u0627\u0631\u0629 \u0644\u0644\u0628\u062D\u062B \u0641\u0648\u0631\u064B\u0627. \u0645\u062B\u0627\u0644: \u0645\u0631\u0627\u0641\u0639\u0627\u062A \u0623\u0648 \u0623\u062D\u0648\u0627\u0644 \u0634\u062E\u0635\u064A\u0629 \u0623\u0648 \u062A\u062C\u0627\u0631\u064A. \u0648\u064A\u0645\u0643\u0646\u0643 \u0623\u064A\u0636\u064B\u0627 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 /qyl \u0645\u062A\u0628\u0648\u0639\u064B\u0627 \u0628\u0639\u0628\u0627\u0631\u0629 \u0627\u0644\u0628\u062D\u062B.",
    { inline_keyboard: [[{ text: "\u0645\u0631\u0627\u0641\u0639\u0627\u062A", callback_data: "ayq:\u0645\u0631\u0627\u0641\u0639\u0627\u062A" }, { text: "\u0623\u062D\u0648\u0627\u0644 \u0634\u062E\u0635\u064A\u0629", callback_data: "ayq:\u0623\u062D\u0648\u0627\u0644 \u0634\u062E\u0635\u064A\u0629" }], [{ text: "\u062A\u062C\u0627\u0631\u064A", callback_data: "ayq:\u062A\u062C\u0627\u0631\u064A" }, { text: "\u062C\u0632\u0627\u0626\u064A\u0629", callback_data: "ayq:\u062C\u0632\u0627\u0626\u064A\u0629" }], [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "all-yemeni-laws" }], [{ text: "\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629", callback_data: "menu" }]] }
  );
}
async function runQuickAllYemeniLawsSearch(chatId, telegramUserId, query, store, sender) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    await promptAllYemeniLawsSearch(chatId, store, sender);
    return;
  }
  await store.beginAllYemeniLawsSearch(String(chatId));
  const session = await store.consumeAllYemeniLawsSearchQuery(String(chatId), normalizedQuery);
  if (!session) {
    await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u0628\u062F\u0621 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0633\u0631\u064A\u0639 \u0627\u0644\u0622\u0646. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.");
    return;
  }
  await store.recordUsage(telegramUserId, "search", { query: normalizedQuery });
  await sendAllYemeniLawsSearchResults(chatId, session.id, 1, store, sender);
}
async function sendAllYemeniLawsSearchResults(chatId, sessionId, requestedPage, store, sender) {
  const initial = await store.searchAllYemeniLawsSources(sessionId, Math.max(1, requestedPage));
  if (!initial) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchExpired("\u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629"), { inline_keyboard: [[{ text: "\u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "all-yemeni-laws" }]] });
    return;
  }
  if (initial.total === 0) {
    await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.searchNoResults("\u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629", initial.query), { inline_keyboard: [[{ text: "\u0628\u062D\u062B \u062C\u062F\u064A\u062F", callback_data: "aysearch" }], [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629", callback_data: "all-yemeni-laws" }]] });
    return;
  }
  const totalPages = Math.max(1, Math.ceil(initial.total / 7));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const content = page === requestedPage ? initial : await store.searchAllYemeniLawsSources(sessionId, page);
  if (!content) return;
  const matchNote = content.matchType === "approximate" ? TELEGRAM_USER_MESSAGES.approximateSearchNote : "";
  await sender.sendMessage(
    chatId,
    `\u0646\u062A\u0627\u0626\u062C \xAB${content.query}\xBB \u062F\u0627\u062E\u0644 \u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u2014 \u0627\u0644\u0635\u0641\u062D\u0629 ${page} \u0645\u0646 ${totalPages} (${content.total} \u0646\u062A\u064A\u062C\u0629):${matchNote}`,
    allYemeniLawsSearchMenu(content.sources, sessionId, page, totalPages, content.query)
  );
}
var nativeExamTimeouts = /* @__PURE__ */ new Map();
var groupExamTimeouts = /* @__PURE__ */ new Map();
function clearNativeExamTimeout(pollId) {
  const timeout = nativeExamTimeouts.get(pollId);
  if (timeout) clearTimeout(timeout);
  nativeExamTimeouts.delete(pollId);
}
function clearGroupExamTimeout(pollId) {
  const timeout = groupExamTimeouts.get(pollId);
  if (timeout) clearTimeout(timeout);
  groupExamTimeouts.delete(pollId);
}
async function launchGroupExamQuestion(chatId, roundId, store, sender) {
  const round = await store.getGroupExamRound(roundId);
  if (!round || round.status !== "active") return;
  const questions = await store.listExamQuestions(round.subjectKey, round.sectionKey);
  const question = questions[round.questionIndex];
  if (!question) return;
  const openPeriodSeconds = [15, 30, 60, 300].includes(round.timeLimitSeconds) ? round.timeLimitSeconds : 30;
  const poll = await sender.sendQuizPoll(chatId, {
    question: `[${round.questionIndex + 1}/${questions.length}] ${question.questionText}`,
    options: [question.optionA, question.optionB, question.optionC, question.optionD],
    correctOptionIndex: question.correctOption === "A" ? 0 : question.correctOption === "B" ? 1 : question.correctOption === "C" ? 2 : 3,
    explanation: isSecondaryExamSubjectKey(round.subjectKey) ? "" : "\u062A\u0638\u0647\u0631 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0635\u062D\u064A\u062D\u0629 \u0648\u0627\u0644\u0634\u0631\u062D \u0648\u0645\u0644\u062E\u0635 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0628\u0639\u062F \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0648\u0642\u062A.",
    openPeriodSeconds
  });
  if (!await store.setGroupExamActivePoll({ roundId, questionIndex: round.questionIndex, pollId: poll.pollId })) return;
  clearGroupExamTimeout(poll.pollId);
  const timeout = setTimeout(() => {
    void resolveGroupExamTimeout(poll.pollId, store, sender);
  }, (openPeriodSeconds + 1) * 1e3);
  timeout.unref?.();
  groupExamTimeouts.set(poll.pollId, timeout);
}
async function resolveGroupExamTimeout(pollId, store, sender) {
  clearGroupExamTimeout(pollId);
  const round = await store.getGroupExamRoundByPoll(pollId);
  if (!round) return;
  const outcome = await store.resolveGroupExamPoll(pollId);
  if (outcome) await continueGroupExamRound(round, outcome, store, sender);
}
async function continueGroupExamRound(round, outcome, store, sender) {
  const chatId = Number(round.chatId);
  if (!Number.isSafeInteger(chatId)) return;
  if (!isSecondaryExamSubjectKey(round.subjectKey)) {
    const resultLines = [
      `\u{1F4CA} \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0633\u0624\u0627\u0644 ${outcome.nextQuestionIndex} \u0645\u0646 ${outcome.total}:`,
      `\u2705 \u0635\u062D\u064A\u062D\u0629: ${outcome.correctCount}`,
      `\u274C \u062E\u0627\u0637\u0626\u0629: ${outcome.incorrectCount}`,
      `\u231B\uFE0F \u0641\u0627\u0626\u062A\u0629: ${outcome.missedCount}`
    ];
    if (outcome.incorrectCount > 0 && outcome.question.hint?.trim()) {
      resultLines.push("", "\u{1F4A1} \u0627\u0644\u062A\u0644\u0645\u064A\u062D:", outcome.question.hint);
    }
    resultLines.push("", `\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0635\u062D\u064A\u062D\u0629: ${optionLabel(outcome.question.correctOption)}. ${optionText(outcome.question, outcome.question.correctOption)}`);
    resultLines.push("", "\u{1F4D6} \u0627\u0644\u0634\u0631\u062D \u0627\u0644\u0645\u0641\u0635\u0644:", outcome.question.explanation);
    await sender.sendMessage(chatId, resultLines.join("\n"));
  }
  if (!outcome.completed) {
    await launchGroupExamQuestion(chatId, round.id, store, sender);
    return;
  }
  const leaderboard = await store.getGroupExamLeaderboard(round.id);
  const lines = [
    `\u{1F3C1} \u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0648\u0644\u0629 \u0627\u0644\u062C\u0645\u0627\u0639\u064A\u0629 \u2014 ${CIVIL_LAW_GENERAL_2025_TITLE}`,
    "",
    `\u0634\u0627\u0631\u0643 \u0641\u064A \u0627\u0644\u062C\u0648\u0644\u0629 ${outcome.participantCount} \u0623\u0639\u0636\u0627\u0621.`,
    "",
    "\u{1F3C6} \u0644\u0648\u062D\u0629 \u0627\u0644\u0645\u062A\u0635\u062F\u0631\u064A\u0646:"
  ];
  leaderboard.slice(0, 10).forEach((participant, index2) => {
    lines.push(`${index2 + 1}. ${participant.displayName} \u2014 \u2705 ${participant.score} | \u274C ${participant.incorrectCount} | \u231B\uFE0F ${participant.missedCount}`);
  });
  lines.push("", "\u064A\u0645\u0643\u0646 \u0628\u062F\u0621 \u062C\u0648\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0639\u0646\u062F\u0645\u0627 \u064A\u0643\u062A\u0628 \u062B\u0644\u0627\u062B\u0629 \u0623\u0639\u0636\u0627\u0621 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 /startquiz.");
  await sender.sendMessage(chatId, lines.join("\n"));
}
async function launchNativeExamQuestion(chatId, sessionId, telegramUserId, store, sender) {
  await sendExamQuestion(chatId, sessionId, telegramUserId, store, sender);
  const session = await store.getExamSession(sessionId, telegramUserId);
  if (!session?.activePollId || session.status !== "active") return;
  clearNativeExamTimeout(session.activePollId);
  const timeout = setTimeout(() => {
    void resolveNativeExamTimeout(session.activePollId, store, sender);
  }, (session.timeLimitSeconds + 1) * 1e3);
  timeout.unref?.();
  nativeExamTimeouts.set(session.activePollId, timeout);
}
async function sendStoppedExamMessage(chatId, stopped, store, sender) {
  if (!stopped) {
    await sender.sendMessage(chatId, "\u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0648\u0644\u0629 \u0627\u062E\u062A\u0628\u0627\u0631 \u0646\u0634\u0637\u0629 \u0644\u0625\u064A\u0642\u0627\u0641\u0647\u0627.", civilLawExamMenu());
    return;
  }
  const location = getImportedExamCatalogLocation(stopped.subjectKey);
  const subject = location ? getTelegramExamCatalogSubject(location.levelKey, location.catalogSubjectKey) : void 0;
  if (!location || !subject) {
    await sender.sendMessage(chatId, "\u23F8 \u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0645\u0624\u0642\u062A\u064B\u0627. \u064A\u0645\u0643\u0646\u0643 \u0628\u062F\u0621 \u062C\u0648\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u062A\u0649 \u0634\u0626\u062A.", civilLawExamMenu());
    return;
  }
  const forms = await store.listExamForms(stopped.subjectKey);
  const formName = forms.find((form) => form.formKey === stopped.sectionKey)?.formName ?? "\u0627\u0644\u0646\u0645\u0648\u0630\u062C";
  await sender.sendMessage(
    chatId,
    `\u23F8 \u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u062E\u062A\u0628\u0627\u0631 ${subject.name} \u2014 ${formName} \u0645\u0624\u0642\u062A\u064B\u0627. \u064A\u0645\u0643\u0646\u0643 \u0627\u062E\u062A\u064A\u0627\u0631 \u0646\u0645\u0648\u0630\u062C \u0622\u062E\u0631 \u0623\u0648 \u0628\u062F\u0621 \u062C\u0648\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u062A\u0649 \u0634\u0626\u062A.`,
    examFormsMenu(location.levelKey, location.catalogSubjectKey, forms)
  );
}
async function resolveNativeExamTimeout(pollId, store, sender) {
  clearNativeExamTimeout(pollId);
  const session = await store.getExamSessionByPoll(pollId);
  if (!session) return;
  const outcome = await store.resolveExamPoll({
    sessionId: session.id,
    telegramUserId: session.telegramUserId,
    questionIndex: session.questionIndex,
    pollId
  });
  if (outcome) await continueNativeExamRound(session, outcome, store, sender);
}
async function sendNativeExamCompletionResult(chatId, session, result, store, sender) {
  const summary = await store.getExamResultSummary(session.id, session.telegramUserId);
  const location = getImportedExamCatalogLocation(session.subjectKey);
  const subject = location ? getTelegramExamCatalogSubject(location.levelKey, location.catalogSubjectKey) : void 0;
  const formName = subject ? (await store.listExamForms(session.subjectKey)).find((form) => form.formKey === session.sectionKey)?.formName : void 0;
  const examTitle = subject ? `\u0627\u062E\u062A\u0628\u0627\u0631 ${subject.name} (${formName ?? "\u0627\u0644\u0646\u0645\u0648\u0630\u062C"})` : CIVIL_LAW_GENERAL_2025_TITLE;
  const resultLines = [
    `\u{1F3B2} \u0627\u0633\u0645 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631: ${examTitle}`,
    "",
    "\u{1F4DD} \u0646\u062A\u064A\u062C\u0629 \u0647\u0630\u0647 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629:",
    `\u2705 \u0627\u0644\u0635\u062D\u064A\u062D\u0629: ${result.score} | \u274C \u0627\u0644\u062E\u0627\u0637\u0626\u0629: ${result.incorrectCount} | \u23F3 \u0627\u0644\u0641\u0627\u0626\u062A\u0629: ${result.missedCount} | \u23F1 \u0627\u0644\u0648\u0642\u062A: ${formatExamTime(result.elapsedSeconds)}`
  ];
  const best = summary?.previousBest ?? result;
  resultLines.push(
    "",
    "\u{1F3C5} \u0623\u0641\u0636\u0644 \u0646\u062A\u064A\u062C\u0629:",
    `\u2705 \u0627\u0644\u0635\u062D\u064A\u062D\u0629: ${best.score} | \u274C \u0627\u0644\u062E\u0627\u0637\u0626\u0629: ${best.incorrectCount} | \u23F3 \u0627\u0644\u0641\u0627\u0626\u062A\u0629: ${best.missedCount} | \u23F1 \u0627\u0644\u0648\u0642\u062A: ${formatExamTime(best.elapsedSeconds)}`
  );
  const leaderboard = summary?.leaderboardResult ?? result;
  resultLines.push(
    "",
    "\u{1F3C6} \u0646\u062A\u064A\u062C\u0629 \u0644\u0627\u0626\u062D\u0629 \u0627\u0644\u0645\u062A\u0635\u062F\u0631\u064A\u0646:",
    `\u2705 \u0627\u0644\u0635\u062D\u064A\u062D\u0629: ${leaderboard.score} | \u274C \u0627\u0644\u062E\u0627\u0637\u0626\u0629: ${leaderboard.incorrectCount} | \u23F3 \u0627\u0644\u0641\u0627\u0626\u062A\u0629: ${leaderboard.missedCount} | \u23F1 \u0627\u0644\u0648\u0642\u062A: ${formatExamTime(leaderboard.elapsedSeconds)}`
  );
  if (summary) {
    resultLines.push(
      "",
      `\u{1F4CA} \u0627\u0644\u062A\u0631\u062A\u064A\u0628: \u0627\u0644\u0645\u0631\u0643\u0632 ${summary.rank} \u0645\u0646 \u0623\u0635\u0644 ${summary.totalParticipants} (\u0623\u0639\u0644\u0649 \u0645\u0646 ${summary.percentile}% \u0645\u0646 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u064A\u0646).`
    );
  }
  resultLines.push("", "\u064A\u0645\u0643\u0646\u0643 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u060C \u0644\u0643\u0646 \u0644\u0646 \u064A\u062A\u063A\u064A\u0631 \u062A\u0631\u062A\u064A\u0628\u0643 \u0641\u064A \u0644\u0627\u0626\u062D\u0629 \u0627\u0644\u0645\u062A\u0635\u062F\u0631\u064A\u0646 \u0625\u0644\u0627 \u0625\u0630\u0627 \u062D\u0633\u0651\u0646\u062A \u0623\u0641\u0636\u0644 \u0646\u062A\u064A\u062C\u0629 \u0644\u0643.");
  await sender.sendMessage(chatId, resultLines.join("\n"), individualExamResultMenu());
}
async function continueNativeExamRound(session, outcome, store, sender) {
  const chatId = Number(session.chatId);
  if (!Number.isSafeInteger(chatId)) return;
  const answerStatus = outcome.missed ? "\u231B\uFE0F \u0627\u0646\u062A\u0647\u0649 \u0627\u0644\u0648\u0642\u062A \u062F\u0648\u0646 \u0625\u062C\u0627\u0628\u0629." : outcome.isCorrect ? "\u2705 \u0625\u062C\u0627\u0628\u062A\u0643 \u0635\u062D\u064A\u062D\u0629." : "\u274C \u0625\u062C\u0627\u0628\u062A\u0643 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.";
  if (isSecondaryExamSubjectKey(session.subjectKey)) {
    if (!outcome.completed) {
      await launchNativeExamQuestion(chatId, session.id, session.telegramUserId, store, sender);
      return;
    }
    await sendNativeExamCompletionResult(chatId, session, outcome, store, sender);
    return;
  }
  const feedbackLines = [];
  if (!isSecondaryExamSubjectKey(session.subjectKey) && !outcome.missed && !outcome.isCorrect && outcome.question.hint?.trim()) {
    feedbackLines.push("\u{1F4A1} \u0627\u0644\u062A\u0644\u0645\u064A\u062D:", outcome.question.hint, "");
  }
  feedbackLines.push(answerStatus, `\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0635\u062D\u064A\u062D\u0629: ${optionLabel(outcome.question.correctOption)}. ${optionText(outcome.question, outcome.question.correctOption)}`);
  if (!isSecondaryExamSubjectKey(session.subjectKey)) {
    feedbackLines.push("", "\u{1F4D6} \u0627\u0644\u0634\u0631\u062D \u0627\u0644\u0645\u0641\u0635\u0644:", outcome.question.explanation);
  }
  await sender.sendMessage(chatId, feedbackLines.join("\n"));
  if (!outcome.completed) {
    await launchNativeExamQuestion(chatId, session.id, session.telegramUserId, store, sender);
    return;
  }
  await sendNativeExamCompletionResult(chatId, session, outcome, store, sender);
}
async function handleTelegramUpdate(update, store, sender, documentProvider = { download: downloadDriveDocument }, membershipChecker = { check: async () => "subscribed" }) {
  const pollAnswer = update.poll_answer;
  if (pollAnswer?.poll_id && pollAnswer.user?.id) {
    const choice = pollAnswer.option_ids?.[0];
    const answer = choice === 0 ? "A" : choice === 1 ? "B" : choice === 2 ? "C" : choice === 3 ? "D" : void 0;
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
      answer
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
      const outcome2 = await store.resolveGroupExamPoll(closedPoll.id);
      if (outcome2) await continueGroupExamRound(groupRound, outcome2, store, sender);
      return;
    }
    const session = await store.getExamSessionByPoll(closedPoll.id);
    if (!session) return;
    const outcome = await store.resolveExamPoll({
      sessionId: session.id,
      telegramUserId: session.telegramUserId,
      questionIndex: session.questionIndex,
      pollId: closedPoll.id
    });
    if (outcome) await continueNativeExamRound(session, outcome, store, sender);
    return;
  }
  const [managedMenuItems, managedSections, managedMessages] = await Promise.all([
    store.listManagedMenuItems?.() ?? [],
    store.listManagedSections?.() ?? [],
    store.listManagedMessages?.() ?? []
  ]);
  const messageContent = (messageKey) => managedMessages.find((message) => message.messageKey === messageKey)?.content;
  const subscriptionRequestLabel = (accessScope, managedMenuItemId) => managedMenuItemId ? managedMenuItems.find((item) => item.id === managedMenuItemId)?.label || "\u0627\u0644\u0632\u0631 \u0627\u0644\u0645\u062E\u0635\u0635" : subscriptionScopeLabel(accessScope);
  const sendManagedMenuItemContent = async (chatId2, item) => {
    if (item.actionType === "url") {
      await sender.sendMessage(chatId2, `\u{1F517} ${item.label}

\u0627\u0636\u063A\u0637 \u0627\u0644\u0632\u0631 \u0627\u0644\u062A\u0627\u0644\u064A \u0644\u0641\u062A\u062D \u0627\u0644\u0645\u062D\u062A\u0648\u0649.`, {
        inline_keyboard: [[{ text: `\u0641\u062A\u062D ${item.label}`, url: item.actionValue }], ...mainMenu(managedMenuItems, managedSections).inline_keyboard]
      });
      return;
    }
    if (item.actionType === "file") {
      await sender.sendMessage(chatId2, TELEGRAM_USER_MESSAGES.filePreparing);
      try {
        await sender.sendDocument(chatId2, await downloadManagedMenuItemDocument(item));
      } catch (error) {
        const code = error instanceof FileDeliveryError ? error.code : "UNAVAILABLE";
        await sender.sendMessage(chatId2, code === "TOO_LARGE" ? TELEGRAM_USER_MESSAGES.fileTooLarge : TELEGRAM_USER_MESSAGES.fileDownloadFailed);
      }
      return;
    }
    await sender.sendMessage(chatId2, item.actionValue, mainMenu(managedMenuItems, managedSections));
  };
  const callback = update.callback_query;
  if (callback) {
    const chat = callback.message?.chat;
    const chatId2 = chat?.id;
    if (!chatId2) return;
    const data = callback.data ?? "";
    const telegramUserId2 = getTelegramUserId(update, chatId2);
    let callbackAcknowledged = false;
    const acknowledgeCallback = async (text3) => {
      if (callbackAcknowledged) return;
      callbackAcknowledged = true;
      await sender.answerCallbackQuery(callback.id, text3).catch(() => void 0);
    };
    const presentCallbackPage = async (text3, replyMarkup) => {
      const messageId = callback.message?.message_id;
      if (messageId && sender.editMessageText) {
        try {
          await sender.editMessageText(chatId2, messageId, text3, replyMarkup);
          return;
        } catch (error) {
          if (error instanceof Error && /message is not modified/i.test(error.message)) return;
        }
      }
      await sender.sendMessage(chatId2, text3, replyMarkup);
    };
    await acknowledgeCallback();
    if (isPrivateChat(chat?.type)) {
      await store.registerSubscriber(String(chatId2), telegramUserId2, {
        telegramUsername: callback.from?.username ?? null,
        telegramFirstName: callback.from?.first_name ?? null,
        telegramLastName: callback.from?.last_name ?? null
      });
    }
    const isExamAccessCallback = isReferralProtectedCallback(data);
    const requirements2 = isExamAccessCallback ? { channels: [], platformVerified: true } : await getAccessRequirementStatus(telegramUserId2, store, membershipChecker);
    if (data === "channel:check") {
      if (areChannelsSubscribed(requirements2) && requirements2.platformVerified) {
        await sender.sendMessage(chatId2, welcomeText(), mainMenu());
      } else {
        await promptAccessRequirements(chatId2, sender, requirements2);
      }
      return;
    }
    if (!areChannelsSubscribed(requirements2)) {
      await promptAccessRequirements(chatId2, sender, requirements2);
      return;
    }
    if (data === "platform:confirmed") {
      await promptAccessRequirements(chatId2, sender, requirements2);
      return;
    }
    if (data === "platform:verify") {
      if (requirements2.platformVerified) {
        await sender.sendMessage(chatId2, "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0632\u064A\u0627\u0631\u0629 \u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629. \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0628\u0648\u062A.", mainMenu());
      } else {
        await promptAccessRequirements(chatId2, sender, requirements2);
      }
      return;
    }
    if (!requirements2.platformVerified) {
      await promptAccessRequirements(chatId2, sender, requirements2);
      return;
    }
    if (isPrivateChat(chat?.type)) await qualifyReferralIfEligible(telegramUserId2, store, sender);
    if (data === "premium:referral") {
      const progress = await store.getReferralProgress(telegramUserId2);
      await sender.sendMessage(chatId2, referralHelpText(progress, telegramUserId2), referralMenu());
      return;
    }
    if (data === "premium:referrals") {
      const [progress, history] = await Promise.all([store.getReferralProgress(telegramUserId2), store.listReferralHistory(telegramUserId2)]);
      await sender.sendMessage(chatId2, `\u{1F4CA} \u0625\u062D\u0627\u0644\u0627\u062A\u0643 \u0627\u0644\u0645\u062D\u062A\u0633\u0628\u0629: ${progress.qualifiedCount} | \u0642\u064A\u062F \u0627\u0644\u062A\u0623\u0647\u064A\u0644: ${progress.pendingCount} | \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0644\u0644\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629: ${progress.remainingCount}.

${referralHistoryText(history)}`, referralMenu());
      return;
    }
    if (data === "hasad:verify") {
      if (await store.hasConfirmedHasadAccess(telegramUserId2)) {
        await sender.sendMessage(chatId2, "\u2705 \u062A\u0645 \u062A\u0648\u062B\u064A\u0642 \u0632\u064A\u0627\u0631\u0629 \u062D\u0635\u0627\u062F \u0627\u0644\u064A\u0648\u0645 \u0628\u0646\u062C\u0627\u062D. \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0630\u064A \u0641\u062A\u062D\u062A\u0647 \u0645\u062C\u0627\u0646\u064B\u0627.", mainMenu());
      } else {
        await sender.sendMessage(chatId2, "\u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0632\u064A\u0627\u0631\u0629 \u0628\u0639\u062F. \u0627\u0641\u062A\u062D \u062D\u0635\u0627\u062F \u0627\u0644\u064A\u0648\u0645 \u0645\u0646 \u0632\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u062F\u0627\u062E\u0644 \u0627\u0644\u0628\u0648\u062A\u060C \u062B\u0645 \u0627\u0631\u062C\u0639 \u0648\u0627\u0636\u063A\u0637 \xAB\u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0632\u064A\u0627\u0631\u0629 \u062D\u0635\u0627\u062F \u0627\u0644\u064A\u0648\u0645\xBB.", hasadAccessMenu());
      }
      return;
    }
    const callbackSectionKey = managedSectionForCallback(data);
    const callbackSectionMode = callbackSectionKey ? managedSectionAccessMode(managedSections, callbackSectionKey) : void 0;
    if (callbackSectionMode === "hasad" && !await store.hasConfirmedHasadAccess(telegramUserId2)) {
      const gateText = isHasadProtectedCallback(data) ? hasadAccessGateText(data) : `\u{1F510} \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u060C \u064A\u0644\u0632\u0645 \u062A\u0648\u062B\u064A\u0642 \u0632\u064A\u0627\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0644\u0645\u0648\u0642\u0639 \u062D\u0635\u0627\u062F \u0627\u0644\u064A\u0648\u0645 \u0639\u0628\u0631 \u0627\u0644\u0632\u0631 \u0627\u0644\u062A\u0627\u0644\u064A. \u0628\u0639\u062F \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0644\u0646 \u062A\u0638\u0647\u0631 \u0644\u0643 \u0647\u0630\u0647 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.`;
      await sender.sendMessage(chatId2, gateText, hasadAccessMenu());
      return;
    }
    if ((callbackSectionKey === "judicial" || callbackSectionKey === "contract-templates") && callbackSectionMode === "premium" && !await store.hasReferralPremiumAccess(telegramUserId2, "sharia_exams")) {
      await sender.sendMessage(chatId2, `\u{1F510} \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 ${callbackSectionKey === "judicial" ? "\u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629" : "\u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629"} \u064A\u062A\u0627\u062D \u0628\u0639\u062F \u0627\u0643\u062A\u0645\u0627\u0644 5 \u0625\u062D\u0627\u0644\u0627\u062A \u0645\u0624\u0647\u0644\u0629.`, referralMenu());
      return;
    }
    const examSectionKey = data === "secondary-exams" ? "secondary-exams" : "exams";
    const isFreeExamSection = callbackSectionMode === "free";
    const hasImportantLawsSectionAccess = async () => {
      const mode = managedSectionAccessMode(managedSections, "important-laws");
      if (mode === "free") return true;
      if (mode === "hasad") return store.hasConfirmedHasadAccess(telegramUserId2);
      return store.hasImportantYemeniLawsAccess(telegramUserId2);
    };
    if (isReferralProtectedCallback(data) && callbackSectionMode === "premium" && !isFreeExamSection && !await store.hasReferralPremiumAccess(telegramUserId2, examAccessScope(data))) {
      const scope = examAccessScope(data);
      await sender.sendMessage(chatId2, optionalExamSupportText(scope), optionalExamSupportMenu(scope));
      return;
    }
    if (data === "gexam:open") {
      if (isPrivateChat(chat?.type) || chat?.type === "channel") {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u0628\u062F\u0621 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u062C\u0645\u0627\u0639\u064A \u0645\u0646 \u062F\u0627\u062E\u0644 \u0645\u062C\u0645\u0648\u0639\u0629 \u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645 \u0641\u0642\u0637.", mainMenu());
        return;
      }
      await sender.sendMessage(chatId2, `\u{1F3B2} ${CIVIL_LAW_GENERAL_2025_TITLE}

\u0627\u062E\u062A\u0631 \u0645\u062F\u0629 \u0627\u0644\u0633\u0624\u0627\u0644. \u064A\u0635\u0628\u062D \u0645\u0646 \u064A\u062E\u062A\u0627\u0631 \u0627\u0644\u0645\u062F\u0629 \u0645\u0646\u0634\u0626 \u0627\u0644\u062C\u0648\u0644\u0629\u060C \u0648\u064A\u0645\u0643\u0646\u0647 \u0623\u0648 \u0644\u0623\u064A \u0645\u0634\u0631\u0641 \u0625\u0646\u0647\u0627\u0624\u0647\u0627 \u0639\u0646\u062F \u0627\u0644\u062D\u0627\u062C\u0629.`, groupExamTimeMenu());
      return;
    }
    if (data.startsWith("gexam:time:")) {
      if (isPrivateChat(chat?.type) || chat?.type === "channel") return;
      const timeLimitSeconds = Number(data.slice("gexam:time:".length));
      if (![15, 30, 60, 300].includes(timeLimitSeconds)) return;
      const createdRound = await store.createGroupExamRound({
        chatId: String(chatId2),
        creatorTelegramUserId: telegramUserId2,
        subjectKey: CIVIL_LAW_EXAM_SUBJECT_KEY,
        sectionKey: CIVIL_LAW_GENERAL_2025_SECTION_KEY,
        timeLimitSeconds
      });
      if (!createdRound) {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u062A\u062C\u0647\u064A\u0632 \u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.");
        return;
      }
      if (!createdRound.created) {
        await sender.sendMessage(chatId2, createdRound.round.status === "active" ? "\u062A\u0648\u062C\u062F \u062C\u0648\u0644\u0629 \u062C\u0645\u0627\u0639\u064A\u0629 \u0646\u0634\u0637\u0629 \u0628\u0627\u0644\u0641\u0639\u0644. \u0627\u0646\u062A\u0638\u0631\u0648\u0627 \u0627\u0646\u062A\u0647\u0627\u0626\u0647\u0627 \u062B\u0645 \u0627\u0628\u062F\u0623\u0648\u0627 \u062C\u0648\u0644\u0629 \u062C\u062F\u064A\u062F\u0629." : "\u062A\u0648\u062C\u062F \u0628\u0637\u0627\u0642\u0629 \u0627\u0633\u062A\u0639\u062F\u0627\u062F \u0645\u0641\u062A\u0648\u062D\u0629 \u0628\u0627\u0644\u0641\u0639\u0644. \u0627\u0636\u063A\u0637 \xAB\u0623\u0646\u0627 \u0645\u0633\u062A\u0639\u062F\xBB \u0645\u0646 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629.");
        return;
      }
      await sender.sendMessage(
        chatId2,
        `\u{1F3B2} \u0628\u0637\u0627\u0642\u0629 \u0627\u0633\u062A\u0639\u062F\u0627\u062F \u2014 ${CIVIL_LAW_GENERAL_2025_TITLE}

\u23F1 \u0645\u062F\u0629 \u0627\u0644\u0633\u0624\u0627\u0644: ${formatExamTime(timeLimitSeconds)}
\u{1F465} \u0644\u0627 \u064A\u0628\u062F\u0623 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u062D\u062A\u0649 \u064A\u0636\u063A\u0637 \u062B\u0644\u0627\u062B\u0629 \u0623\u0639\u0636\u0627\u0621 \u0645\u062E\u062A\u0644\u0641\u064A\u0646 \u0639\u0644\u0649 \xAB\u0623\u0646\u0627 \u0645\u0633\u062A\u0639\u062F\xBB.

\u0645\u0646\u0634\u0626 \u0627\u0644\u062C\u0648\u0644\u0629 \u0623\u0648 \u0645\u0634\u0631\u0641 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u064A\u0645\u0643\u0646\u0647 \u0625\u0646\u0647\u0627\u0624\u0647\u0627 \u0645\u0646 \u0627\u0644\u0632\u0631 \u0623\u062F\u0646\u0627\u0647.`,
        groupExamReadyMenu(createdRound.round.id, 0)
      );
      return;
    }
    if (data.startsWith("gexam:ready:")) {
      if (isPrivateChat(chat?.type) || chat?.type === "channel") return;
      const roundId = Number(data.slice("gexam:ready:".length));
      if (!Number.isInteger(roundId) || roundId < 1) return;
      const round = await store.getGroupExamRound(roundId);
      if (!round || round.chatId !== String(chatId2) || round.status !== "waiting") {
        await sender.sendMessage(chatId2, "\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u062F\u0627\u062F \u0644\u0645 \u062A\u0639\u062F \u0645\u062A\u0627\u062D\u0629. \u064A\u0645\u0643\u0646\u0643 \u0628\u062F\u0621 \u062C\u0648\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0639\u0646\u062F \u0627\u0644\u062D\u0627\u062C\u0629.");
        return;
      }
      const displayName = [callback.from?.first_name, callback.from?.last_name].filter(Boolean).join(" ").trim() || (callback.from?.username ? `@${callback.from.username}` : `\u0627\u0644\u0645\u0634\u0627\u0631\u0643 ${telegramUserId2}`);
      const joinedRound = await store.joinGroupExamRound({ roundId, telegramUserId: telegramUserId2, displayName, username: callback.from?.username });
      if (!joinedRound) return;
      if (joinedRound.participantCount < 3) {
        await sender.sendMessage(
          chatId2,
          `${joinedRound.joined ? "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0633\u062A\u0639\u062F\u0627\u062F\u0643" : "\u0623\u0646\u062A \u0645\u0633\u062A\u0639\u062F \u0628\u0627\u0644\u0641\u0639\u0644"}.

\u0627\u0644\u0645\u0633\u062A\u0639\u062F\u0648\u0646 \u062D\u0627\u0644\u064A\u064B\u0627: ${joinedRound.participantCount} \u0645\u0646 3 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.
\u064A\u0646\u0637\u0644\u0642 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627 \u0639\u0646\u062F \u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u0639\u062F\u062F.`,
          groupExamReadyMenu(roundId, joinedRound.participantCount)
        );
        return;
      }
      const activeRound = await store.activateGroupExamRound(roundId);
      if (!activeRound) return;
      const questions = await store.listExamQuestions(activeRound.subjectKey, activeRound.sectionKey);
      await sender.sendMessage(
        chatId2,
        `\u{1F3B2} \u0628\u062F\u0623\u062A \u0627\u0644\u062C\u0648\u0644\u0629 \u0627\u0644\u062C\u0645\u0627\u0639\u064A\u0629 \u2014 ${CIVIL_LAW_GENERAL_2025_TITLE}

\u{1F465} \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0648\u0646: ${joinedRound.participantCount}
\u{1F58A} \u0627\u0644\u0623\u0633\u0626\u0644\u0629: ${questions.length}
\u23F1 ${formatExamTime(activeRound.timeLimitSeconds)} \u0644\u0643\u0644 \u0633\u0624\u0627\u0644
\u{1F4D6} \u0633\u062A\u0638\u0647\u0631 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0635\u062D\u064A\u062D\u0629 \u0648\u0627\u0644\u0634\u0631\u062D \u0648\u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0628\u0639\u062F \u0643\u0644 \u0633\u0624\u0627\u0644.`
      );
      await launchGroupExamQuestion(chatId2, activeRound.id, store, sender);
      return;
    }
    if (data.startsWith("gexam:cancel:")) {
      if (isPrivateChat(chat?.type) || chat?.type === "channel") return;
      const roundId = Number(data.slice("gexam:cancel:".length));
      if (!Number.isInteger(roundId) || roundId < 1) return;
      const round = await store.getGroupExamRound(roundId);
      if (!round || round.chatId !== String(chatId2)) return;
      const isCreator = round.creatorTelegramUserId === telegramUserId2;
      const isAdministrator = isCreator ? false : await sender.isChatAdministrator(chatId2, telegramUserId2);
      if (!isCreator && !isAdministrator) {
        await sender.sendMessage(chatId2, "\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0648\u0644\u0629 \u0645\u062A\u0627\u062D \u0644\u0645\u0646\u0634\u0626\u0647\u0627 \u0623\u0648 \u0644\u0645\u0634\u0631\u0641\u064A \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0641\u0642\u0637.");
        return;
      }
      const cancelled = await store.cancelGroupExamRound(roundId);
      if (cancelled && round.activePollId) clearGroupExamTimeout(round.activePollId);
      await sender.sendMessage(chatId2, cancelled ? "\u23F9 \u062A\u0645 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0648\u0644\u0629 \u0627\u0644\u062C\u0645\u0627\u0639\u064A\u0629. \u0644\u0627 \u062A\u064F\u062D\u062A\u0633\u0628 \u0623\u064A \u0625\u062C\u0627\u0628\u0627\u062A \u0644\u0627\u062D\u0642\u0629." : "\u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0648\u0644\u0629 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0625\u0646\u0647\u0627\u0621 \u062D\u0627\u0644\u064A\u064B\u0627.");
      return;
    }
    if (data === "exam:retry") {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      await sender.sendMessage(chatId2, `${CIVIL_LAW_GENERAL_2025_TITLE}

\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062F\u0629 \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644 \u0642\u0628\u0644 \u0628\u062F\u0621 \u0645\u062D\u0627\u0648\u0644\u0629 \u062C\u062F\u064A\u062F\u0629.`, civilLawExamTimeMenu());
      return;
    }
    if (data.startsWith("broadcast:confirm:")) {
      if (!isPrivateOwnerConversation(telegramUserId2, chat?.type)) {
        await sender.sendMessage(chatId2, "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0628\u0648\u062A \u062F\u0627\u062E\u0644 \u0645\u062D\u0627\u062F\u062B\u062A\u0647 \u0627\u0644\u062E\u0627\u0635\u0629 \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const broadcastId = Number(data.slice("broadcast:confirm:".length));
      if (!Number.isInteger(broadcastId) || broadcastId < 1) return;
      const draft = await store.getBroadcastDraft(broadcastId, telegramUserId2);
      if (!draft || draft.status !== "draft") {
        await sender.sendMessage(chatId2, "\u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0648\u062F\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0644\u0644\u0625\u0631\u0633\u0627\u0644 \u0623\u0648 \u0633\u0628\u0642 \u062A\u0646\u0641\u064A\u0630\u0647\u0627.", mainMenu());
        return;
      }
      if (draft.kind === "message" && !draft.message || draft.kind === "document" && !draft.fileId) {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0645\u0633\u0648\u062F\u0629 \u0644\u0623\u0646 \u0645\u062D\u062A\u0648\u0627\u0647\u0627 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644.", mainMenu());
        return;
      }
      if (!await store.beginBroadcast(broadcastId, telegramUserId2)) {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u0628\u062F\u0621 \u0627\u0644\u0628\u062B \u0644\u0623\u0646 \u0627\u0644\u0645\u0633\u0648\u062F\u0629 \u0627\u0633\u062A\u064F\u062E\u062F\u0645\u062A \u0623\u0648 \u0623\u064F\u0644\u063A\u064A\u062A \u0628\u0627\u0644\u0641\u0639\u0644.", mainMenu());
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
            await sender.sendMessage(recipientId, draft.message);
          } else {
            await sender.sendDocumentByFileId(recipientId, draft.fileId, draft.caption ?? void 0);
          }
          successCount += 1;
        } catch {
          failureCount += 1;
        }
      }
      await store.completeBroadcast(broadcastId, telegramUserId2, successCount, failureCount);
      await sender.sendMessage(chatId2, `\u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u0628\u062B \u0631\u0642\u0645 #${broadcastId}.
\u0646\u062C\u062D \u0627\u0644\u0625\u0631\u0633\u0627\u0644: ${successCount}
\u062A\u0639\u0630\u0631 \u0627\u0644\u0625\u0631\u0633\u0627\u0644: ${failureCount}`, mainMenu());
      return;
    }
    if (data.startsWith("broadcast:cancel:")) {
      if (!isPrivateOwnerConversation(telegramUserId2, chat?.type)) {
        await sender.sendMessage(chatId2, "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0628\u0648\u062A \u062F\u0627\u062E\u0644 \u0645\u062D\u0627\u062F\u062B\u062A\u0647 \u0627\u0644\u062E\u0627\u0635\u0629 \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const broadcastId = Number(data.slice("broadcast:cancel:".length));
      if (!Number.isInteger(broadcastId) || broadcastId < 1) return;
      const wasCancelled = await store.cancelBroadcastDraft(broadcastId, telegramUserId2);
      await sender.sendMessage(chatId2, wasCancelled ? "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0645\u0633\u0648\u062F\u0629 \u0627\u0644\u0628\u062B. \u0644\u0645 \u064A\u064F\u0631\u0633\u0644 \u0623\u064A \u0645\u062D\u062A\u0648\u0649." : "\u062A\u0639\u0630\u0631 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0645\u0633\u0648\u062F\u0629 \u0644\u0623\u0646\u0647\u0627 \u0644\u0645 \u062A\u0639\u062F \u0645\u062A\u0627\u062D\u0629.", mainMenu());
      return;
    }
    if (data.startsWith("important-laws:approve:") || data.startsWith("important-laws:reject:")) {
      if (!isPrivateOwnerConversation(telegramUserId2, chat?.type)) {
        await sender.sendMessage(chatId2, "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const isApproval = data.startsWith("important-laws:approve:");
      const requestId = Number(data.slice(isApproval ? "important-laws:approve:".length : "important-laws:reject:".length));
      if (!Number.isInteger(requestId) || requestId < 1) return;
      const request = isApproval ? await store.approveImportantYemeniLawsSubscriptionRequest(requestId, telegramUserId2) : await store.rejectImportantYemeniLawsSubscriptionRequest(requestId, telegramUserId2);
      if (!request) return;
      const requesterChatId = Number(request.chatId);
      let requesterWasNotified = false;
      if (Number.isSafeInteger(requesterChatId)) {
        try {
          await sender.sendMessage(
            requesterChatId,
            isApproval ? `\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0634\u062A\u0631\u0627\u0643\u0643 \u0641\u064A \u0642\u0633\u0645 ${subscriptionRequestLabel(request.accessScope, request.managedMenuItemId)}. \u064A\u0645\u0643\u0646\u0643 \u0641\u062A\u062D \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0622\u0646 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629.` : `\u0644\u0645 \u064A\u064F\u0639\u062A\u0645\u062F \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0641\u064A \u0642\u0633\u0645 ${subscriptionRequestLabel(request.accessScope, request.managedMenuItemId)}. \u0631\u0627\u062C\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u062B\u0645 \u0623\u0631\u0633\u0644 \u0637\u0644\u0628\u064B\u0627 \u062C\u062F\u064A\u062F\u064B\u0627 \u0639\u0646\u062F \u0627\u0644\u062D\u0627\u062C\u0629.`,
            mainMenu()
          );
          requesterWasNotified = true;
        } catch {
          requesterWasNotified = false;
        }
      }
      const ownerConfirmation = isApproval ? [
        "\u2705 \u0625\u0634\u0639\u0627\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643",
        `\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628: #${requestId}`,
        `\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0634\u062A\u0631\u0643: ${request.telegramUserId}`,
        `\u062D\u0627\u0644\u0629 \u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0645\u0634\u062A\u0631\u0643: ${requesterWasNotified ? "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644\u0647 \u0628\u0646\u062C\u0627\u062D." : "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644\u0647\u061B \u064A\u0645\u0643\u0646 \u0644\u0644\u0645\u0634\u062A\u0631\u0643 \u0641\u062A\u062D \u0627\u0644\u0628\u0648\u062A \u0644\u0627\u062D\u0642\u064B\u0627."}`
      ].join("\n") : `\u062A\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628 #${requestId}.`;
      await sender.sendMessage(chatId2, ownerConfirmation, mainMenu());
      return;
    }
    const isFileRequest = data.startsWith("source:") || data.startsWith("jfile:") || data.startsWith("jresultfile:") || data.startsWith("lfile:") || data.startsWith("lresultfile:") || data.startsWith("ayfile:") || data.startsWith("ayresultfile:") || data.startsWith("ylfile:") || data.startsWith("fform:") || data.startsWith("vfile:") || data.startsWith("rfile:") || data.startsWith("ifile:") || data.startsWith("ctemplate:");
    if (isFileRequest && !isPrivateChat(chat?.type)) {
      return;
    }
    const categoryMatch = data.match(/^menu:(search|library|exams|documents|featured|services|help)$/);
    if (categoryMatch) {
      const category = categoryMatch[1];
      await presentCallbackPage(mainCategoryText(category), mainCategoryMenu(category, managedSections));
      return;
    }
    if (data === "menu") {
      await presentCallbackPage(welcomeText(messageContent("welcome")), mainMenu(managedMenuItems, managedSections));
      return;
    }
    if (data.startsWith("managed-premium:request:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const itemId = Number(data.slice("managed-premium:request:".length));
      const item = managedMenuItems.find((candidate) => candidate.id === itemId && candidate.accessMode === "premium");
      if (!item) return;
      if (await store.hasManagedMenuItemPremiumAccess(telegramUserId2, itemId)) {
        await sender.sendMessage(chatId2, `\u0644\u062F\u064A\u0643 \u0648\u0635\u0648\u0644 \u0645\u0641\u0639\u0644 \u0625\u0644\u0649 ${item.label}.`, { inline_keyboard: [[{ text: `\u0641\u062A\u062D ${item.label}`, callback_data: `managed:${itemId}` }]] });
        return;
      }
      await sender.sendMessage(chatId2, `\u0627\u062E\u062A\u0631 \u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u062A\u064A \u0627\u0633\u062A\u062E\u062F\u0645\u062A\u0647\u0627 \u0644\u064A\u064F\u0631\u0641\u0642 \u0646\u0648\u0639 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0648\u0628\u064A\u0627\u0646\u0627\u062A\u0647 \u0645\u0639 \u0637\u0644\u0628\u0643 \u0627\u0644\u0645\u0631\u0633\u0644 \u0625\u0644\u0649 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 ${item.label}.

\u064A\u0645\u0643\u0646\u0643 \u0643\u0630\u0644\u0643 \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0648\u0635\u0648\u0644 \u0645\u062C\u0627\u0646\u064A \u0644\u0645\u062F\u0629 \u0634\u0647\u0631 \u0639\u0646\u062F \u0627\u0643\u062A\u0645\u0627\u0644 5 \u0625\u062D\u0627\u0644\u0627\u062A \u0645\u0624\u0647\u0644\u0629.`, managedMenuItemPaymentMethodMenu(itemId));
      return;
    }
    if (data.startsWith("managed-premium:payment:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const [, , rawItemId, rawPaymentMethod] = data.split(":");
      const itemId = Number(rawItemId);
      const paymentMethod = rawPaymentMethod;
      const item = managedMenuItems.find((candidate) => candidate.id === itemId && candidate.accessMode === "premium");
      if (!item || !Number.isInteger(itemId) || !(paymentMethod in importantYemeniLawsPaymentMethods)) return;
      pendingImportantLawsPaymentProofs.set(telegramUserId2, {
        expiresAt: Date.now() + IMPORTANT_LAWS_PAYMENT_PROOF_TIMEOUT_MS,
        identity: {
          telegramUserId: telegramUserId2,
          telegramUsername: callback.from?.username,
          telegramFirstName: callback.from?.first_name,
          telegramLastName: callback.from?.last_name,
          paymentMethod,
          accessScope: "important_laws",
          managedMenuItemId: itemId
        }
      });
      await sender.sendMessage(chatId2, `\u0623\u0631\u0633\u0644 \u0627\u0644\u0622\u0646 \u0635\u0648\u0631\u0629 \u0648\u0627\u0636\u062D\u0629 \u0644\u0625\u062B\u0628\u0627\u062A \u0627\u0644\u0625\u064A\u062F\u0627\u0639. \u0633\u062A\u064F\u0631\u0633\u0644 \u0627\u0644\u0635\u0648\u0631\u0629 \u0625\u0644\u0649 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637 \u0645\u0639 \u0637\u0644\u0628 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 ${item.label}\u060C \u0648\u062A\u0646\u062A\u0647\u064A \u0645\u0647\u0644\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0628\u0639\u062F 15 \u062F\u0642\u064A\u0642\u0629.`);
      return;
    }
    if (data.startsWith("managed:")) {
      const itemId = Number(data.slice("managed:".length));
      const item = managedMenuItems.find((candidate) => candidate.id === itemId);
      if (!item) return;
      if (item.accessMode === "hasad" && !await store.hasConfirmedHasadAccess(telegramUserId2)) {
        await sender.sendMessage(chatId2, `\u{1F510} \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 ${item.label}\u060C \u064A\u0644\u0632\u0645 \u062A\u0648\u062B\u064A\u0642 \u0632\u064A\u0627\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0644\u0645\u0648\u0642\u0639 \u062D\u0635\u0627\u062F \u0627\u0644\u064A\u0648\u0645 \u0639\u0628\u0631 \u0627\u0644\u0632\u0631 \u0627\u0644\u062A\u0627\u0644\u064A. \u0628\u0639\u062F \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0644\u0646 \u062A\u0638\u0647\u0631 \u0644\u0643 \u0647\u0630\u0647 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.`, hasadAccessMenu());
        return;
      }
      if (item.accessMode === "premium" && !await store.hasManagedMenuItemPremiumAccess(telegramUserId2, itemId)) {
        await sender.sendMessage(chatId2, `\u{1F510} \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 ${item.label} \u064A\u062A\u0627\u062D \u0639\u0628\u0631 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631\u064A \u0623\u0648 \u0627\u0644\u0625\u062D\u0627\u0644\u0629. \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0648\u0635\u0648\u0644 \u0645\u062C\u0627\u0646\u064A \u0644\u0645\u062F\u0629 \u0634\u0647\u0631 \u0639\u0646\u062F \u0627\u0643\u062A\u0645\u0627\u0644 5 \u0625\u062D\u0627\u0644\u0627\u062A \u0645\u0624\u0647\u0644\u0629.`, {
          inline_keyboard: [
            [{ text: "\u0648\u0635\u0648\u0644 \u0645\u062C\u0627\u0646\u064A \u0628\u0627\u0644\u0625\u062D\u0627\u0644\u0629", callback_data: "premium:referral" }],
            [{ text: "\u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0627\u0644\u0645\u062F\u0641\u0648\u0639", callback_data: `managed-premium:request:${itemId}` }],
            [{ text: "\u0631\u062C\u0648\u0639", callback_data: "start" }]
          ]
        });
        return;
      }
      await sendManagedMenuItemContent(chatId2, item);
      return;
    }
    if (data === "favorites") {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u062A\u064F\u0639\u0631\u0636 \u0645\u0641\u0636\u0644\u062A\u0643 \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const favorites = await store.listFavorites(telegramUserId2);
      if (favorites.length === 0) {
        await sender.sendMessage(chatId2, "\u2B50 \u0645\u0641\u0636\u0644\u062A\u064A\n\n\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0645\u062D\u0641\u0648\u0638\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u0627\u0641\u062A\u062D \u0623\u064A \u0646\u062A\u064A\u062C\u0629 \u0628\u062D\u062B \u0648\u0627\u0636\u063A\u0637 \xAB\u0625\u0636\u0627\u0641\u0629 \u0644\u0644\u0645\u0641\u0636\u0644\u0629\xBB \u0644\u062D\u0641\u0638\u0647\u0627.", mainMenu());
        return;
      }
      await sender.sendMessage(chatId2, `\u2B50 \u0645\u0641\u0636\u0644\u062A\u064A

\u0644\u062F\u064A\u0643 ${favorites.length} \u0645\u0633\u062A\u0646\u062F\u064B\u0627 \u0645\u062D\u0641\u0648\u0638\u064B\u0627. \u0627\u0636\u063A\u0637 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0644\u0637\u0644\u0628\u0647\u060C \u0623\u0648 \u0623\u0632\u0644\u0647 \u0645\u0646 \u0627\u0644\u0645\u0641\u0636\u0644\u0629.`, favoritesMenu(favorites));
      return;
    }
    if (data.startsWith("favadd:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u062D\u0641\u0638 \u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0641\u064A \u0627\u0644\u0645\u0641\u0636\u0644\u0629 \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const sourceId = Number(data.slice("favadd:".length));
      if (!Number.isInteger(sourceId) || sourceId < 1) return;
      const result = await store.saveFavorite(telegramUserId2, sourceId);
      if (result === "unavailable") {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0641\u064A \u0627\u0644\u0645\u0641\u0636\u0644\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.");
        return;
      }
      const source = await store.getSource(sourceId);
      await sender.sendMessage(
        chatId2,
        result === "added" ? `\u2B50 \u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \xAB${source ? displaySourceTitle(source) : "\u0627\u0644\u0645\u0633\u062A\u0646\u062F"}\xBB \u0625\u0644\u0649 \u0645\u0641\u0636\u0644\u062A\u0643.` : "\u2B50 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0645\u062D\u0641\u0648\u0638 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0645\u0641\u0636\u0644\u062A\u0643.",
        result === "added" ? { inline_keyboard: [[{ text: "\u2B50 \u0641\u062A\u062D \u0645\u0641\u0636\u0644\u062A\u064A", callback_data: "favorites" }]] } : void 0
      );
      return;
    }
    if (data.startsWith("favremove:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0641\u0636\u0644\u0629 \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const sourceId = Number(data.slice("favremove:".length));
      if (!Number.isInteger(sourceId) || sourceId < 1) return;
      const removed = await store.removeFavorite(telegramUserId2, sourceId);
      await sender.sendMessage(chatId2, removed ? "\u062A\u0645\u062A \u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0645\u0646 \u0645\u0641\u0636\u0644\u062A\u0643." : "\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0645\u0641\u0636\u0644\u062A\u0643 \u062D\u0627\u0644\u064A\u064B\u0627.", { inline_keyboard: [[{ text: "\u2B50 \u062A\u062D\u062F\u064A\u062B \u0645\u0641\u0636\u0644\u062A\u064A", callback_data: "favorites" }]] });
      return;
    }
    if (data === "exams") {
      await sender.sendMessage(chatId2, shariaExamsIntroText(), civilLawExamMenu());
      return;
    }
    if (data === "secondary-exams") {
      await sender.sendMessage(chatId2, "\u{1F9EE} \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629\n\n\u0646\u0645\u0627\u0630\u062C \u0623\u0648\u0627\u0626\u0644 \u0627\u0644\u062C\u0645\u0647\u0648\u0631\u064A\u0629 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0644\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0644\u062B \u062B\u0627\u0646\u0648\u064A \u0644\u0644\u0639\u0627\u0645 \u0627\u0644\u062F\u0631\u0627\u0633\u064A 2025\u0645\u20142026\u0645\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0645\u0637\u0644\u0648\u0628.", secondaryLevelsMenu());
      return;
    }
    if (data === "exam:levels") {
      await sender.sendMessage(chatId2, "\u{1F4DD} \u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0634\u0631\u064A\u0639\u0629 \u0648\u0627\u0644\u0642\u0627\u0646\u0648\u0646\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0645\u0637\u0644\u0648\u0628.", civilLawExamMenu());
      return;
    }
    if (data === "exam:noop") return;
    if (data.startsWith("exam:level:")) {
      const [, , levelKey, requestedPage] = data.split(":");
      const level = getTelegramExamCatalogLevel(levelKey);
      if (!level) {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u0648\u0649. \u0627\u062E\u062A\u0631 \u0645\u0633\u062A\u0648\u0649 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629.", civilLawExamMenu());
        return;
      }
      if (level.comingSoon) {
        await sender.sendMessage(chatId2, `\u{1F4DD} ${level.name}

\u0647\u0630\u0647 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0641\u0627\u0631\u063A\u0629 \u062D\u0627\u0644\u064A\u064B\u0627\u060C \u0648\u0633\u064A\u064F\u0636\u0627\u0641 \u0645\u062D\u062A\u0648\u0627\u0647\u0627 \u0642\u0631\u064A\u0628\u064B\u0627.`, examSubjectsMenu(level.key));
        return;
      }
      const page = Number(requestedPage);
      await sender.sendMessage(
        chatId2,
        `\u{1F4DD} ${level.name}

\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629. \u062A\u0638\u0647\u0631 \u0627\u0644\u0645\u0648\u0627\u062F \u0628\u0627\u0644\u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u0645\u0639\u062A\u0645\u062F \u0641\u064A \u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631.`,
        examSubjectsMenu(level.key, Number.isInteger(page) && page > 0 ? page : 1)
      );
      return;
    }
    if (data.startsWith("exam:coming-soon:")) {
      await sender.sendMessage(chatId2, "\u0633\u064A\u064F\u0636\u0627\u0641 \u0645\u062D\u062A\u0648\u0649 \u0647\u0630\u0647 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0642\u0631\u064A\u0628\u064B\u0627. \u0627\u062E\u062A\u0631 \u0645\u0633\u062A\u0648\u0649 \u0622\u062E\u0631 \u0645\u0646 \u0641\u0647\u0631\u0633 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A.", civilLawExamMenu());
      return;
    }
    if (data.startsWith("exam:subject:")) {
      const [, , levelKey, subjectKey, requestedPage] = data.split(":");
      const subject = getTelegramExamCatalogSubject(levelKey, subjectKey);
      if (!subject) {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0647 \u0627\u0644\u0645\u0627\u062F\u0629. \u0627\u062E\u062A\u0631 \u0645\u0627\u062F\u0629 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629.", civilLawExamMenu());
        return;
      }
      const importedSubjectKey = getImportedExamSubjectKey(levelKey, subjectKey);
      if (importedSubjectKey) {
        const forms = await store.listExamForms(importedSubjectKey);
        await sender.sendMessage(
          chatId2,
          forms.length > 0 ? `\u{1F4D5} ${examSubjectHeading(levelKey, subject)}

\u0627\u062E\u062A\u0631 \u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0645\u0637\u0644\u0648\u0628.` : "\u0644\u0627 \u062A\u062A\u0648\u0627\u0641\u0631 \u0646\u0645\u0627\u0630\u062C \u0627\u062E\u062A\u0628\u0627\u0631 \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0627\u062F\u0629 \u062D\u0627\u0644\u064A\u064B\u0627.",
          forms.length > 0 ? examFormsMenu(levelKey, subjectKey, forms) : examSubjectsMenu(levelKey, Number(requestedPage) || 1)
        );
        return;
      }
      const page = Number(requestedPage);
      await sender.sendMessage(
        chatId2,
        `\u{1F4DA} ${getTelegramExamCatalogLevel(levelKey)?.name ?? "\u0627\u0644\u0645\u0633\u062A\u0648\u0649"} \u2190 ${subject.name}

\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0633\u0626\u0644\u0629 \u0645\u0636\u0627\u0641\u0629 \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0627\u062F\u0629 \u0641\u064A \u0627\u0644\u0628\u0648\u062A \u062D\u0627\u0644\u064A\u064B\u0627.`,
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
      await sender.sendMessage(chatId2, `\u{1F4D5} ${examSubjectHeading(levelKey, subject)}

\u0627\u062E\u062A\u0631 \u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0645\u0637\u0644\u0648\u0628.`, examFormsMenu(levelKey, subjectKey, forms, Number(requestedPage) || 1));
      return;
    }
    if (data.startsWith("exam:training:")) {
      const [, , levelKey, subjectKey] = data.split(":");
      const subject = getTelegramExamCatalogSubject(levelKey, subjectKey);
      if (!subject) return;
      await sender.sendMessage(
        chatId2,
        `\u{1F9EA} ${subject.name}

\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0633\u062A\u0643\u0648\u0646 \u0645\u062A\u0627\u062D\u0629 \u0642\u0631\u064A\u0628\u064B\u0627.`,
        {
          inline_keyboard: [
            [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629", callback_data: `exam:subject:${levelKey}:${subjectKey}:1` }],
            [{ text: "\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0645\u0648\u0627\u062F", callback_data: `exam:level:${levelKey}` }]
          ]
        }
      );
      return;
    }
    if (data.startsWith("exam:form:")) {
      const [, , levelKey, subjectKey, formKeyOrSortOrder, requestedPage] = data.split(":");
      const importedSubjectKey = getImportedExamSubjectKey(levelKey, subjectKey);
      const subject = getTelegramExamCatalogSubject(levelKey, subjectKey);
      if (!importedSubjectKey || !subject || !formKeyOrSortOrder) return;
      const forms = await store.listExamForms(importedSubjectKey);
      const form = forms.find((item) => item.formKey === formKeyOrSortOrder || String(item.sortOrder) === formKeyOrSortOrder);
      if (!form) {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0646\u0645\u0648\u0630\u062C. \u0627\u062E\u062A\u0631 \u0646\u0645\u0648\u0630\u062C\u064B\u0627 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629.", examFormsMenu(levelKey, subjectKey, forms, Number(requestedPage) || 1));
        return;
      }
      const questions = await store.listExamQuestions(importedSubjectKey, form.formKey);
      await sender.sendMessage(
        chatId2,
        questions.length > 0 ? `\u{1F4D5} ${examSubjectHeading(levelKey, subject)} \u2014 ${form.formName}

\u064A\u062A\u0636\u0645\u0646 \u0627\u0644\u0646\u0645\u0648\u0630\u062C ${questions.length} \u0633\u0624\u0627\u0644\u064B\u0627. \u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062F\u0629 \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644 \u0642\u0628\u0644 \u0628\u062F\u0621 \u0627\u0644\u062C\u0648\u0644\u0629.` : "\u0644\u0627 \u062A\u062A\u0648\u0627\u0641\u0631 \u0623\u0633\u0626\u0644\u0629 \u0647\u0630\u0627 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u062D\u0627\u0644\u064A\u064B\u0627. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0627\u062D\u0642\u064B\u0627.",
        questions.length > 0 ? examTimeMenu(importedSubjectKey, form.sortOrder, `exam:forms:${levelKey}:${subjectKey}:${requestedPage || 1}`) : examFormsMenu(levelKey, subjectKey, forms, Number(requestedPage) || 1)
      );
      return;
    }
    if (data === "exam:civil") {
      await sender.sendMessage(chatId2, "\u{1F4D9} \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u062F\u0646\u064A\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0645\u0637\u0644\u0648\u0628.", civilLawExamSectionMenu());
      return;
    }
    if (data === "exam:civil:general2025") {
      const questions = await store.listExamQuestions(CIVIL_LAW_EXAM_SUBJECT_KEY, CIVIL_LAW_GENERAL_2025_SECTION_KEY);
      await sender.sendMessage(
        chatId2,
        questions.length > 0 ? `${CIVIL_LAW_GENERAL_2025_TITLE}

\u064A\u062A\u0636\u0645\u0646 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 ${questions.length} \u0623\u0633\u0626\u0644\u0629. \u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062F\u0629 \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0644\u0643\u0644 \u0633\u0624\u0627\u0644 \u0642\u0628\u0644 \u0628\u062F\u0621 \u0627\u0644\u062C\u0648\u0644\u0629.` : "\u0644\u0627 \u062A\u062A\u0648\u0627\u0641\u0631 \u0623\u0633\u0626\u0644\u0629 \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u062D\u0627\u0644\u064A\u064B\u0627. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0627\u062D\u0642\u064B\u0627.",
        questions.length > 0 ? civilLawExamTimeMenu() : civilLawExamSectionMenu()
      );
      return;
    }
    if (data.startsWith("exam:time:") && data.split(":").length === 5) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u062A\u0627\u062D \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const [, , subjectKey, formKeyOrSortOrder, rawTimeLimit] = data.split(":");
      const timeLimitSeconds = Number(rawTimeLimit);
      const location = getImportedExamCatalogLocation(subjectKey);
      const subject = location ? getTelegramExamCatalogSubject(location.levelKey, location.catalogSubjectKey) : void 0;
      if (!location || !subject || !formKeyOrSortOrder || ![15, 30, 60, 300].includes(timeLimitSeconds)) return;
      const forms = await store.listExamForms(subjectKey);
      const form = forms.find((item) => item.formKey === formKeyOrSortOrder || String(item.sortOrder) === formKeyOrSortOrder);
      if (!form) {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0646\u0645\u0648\u0630\u062C. \u0627\u062E\u062A\u0631 \u0646\u0645\u0648\u0630\u062C\u064B\u0627 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629.", examFormsMenu(location.levelKey, location.catalogSubjectKey, forms));
        return;
      }
      const session = await store.startExamSession(telegramUserId2, String(chatId2), subjectKey, form.formKey, timeLimitSeconds);
      if (!session) {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u062D\u0627\u0644\u064A\u064B\u0627. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0627\u062D\u0642\u064B\u0627.", examTimeMenu(subjectKey, form.sortOrder, `exam:forms:${location.levelKey}:${location.catalogSubjectKey}:1`));
        return;
      }
      const questions = await store.listExamQuestions(subjectKey, form.formKey);
      await sender.sendMessage(
        chatId2,
        [
          `\u{1F3B2} \u0627\u0633\u062A\u0639\u062F \u062C\u064A\u062F\u064B\u0627 \u0644\u0640 '\u0627\u062E\u062A\u0628\u0627\u0631 ${subject.name} \u2014 ${form.formName}'`,
          `\u{1F58A} ${questions.length} \u0623\u0633\u0626\u0644\u0629`,
          `\u23F1 ${formatExamTime(timeLimitSeconds)} \u0644\u0643\u0644 \u0633\u0624\u0627\u0644`,
          "\u{1F4D6} \u0633\u062A\u0638\u0647\u0631 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0635\u062D\u064A\u062D\u0629 \u0648\u0627\u0644\u0634\u0631\u062D \u0627\u0644\u0645\u0641\u0635\u0644 \u0628\u0639\u062F \u0643\u0644 \u0633\u0624\u0627\u0644\u060C \u0648\u064A\u0638\u0647\u0631 \u0627\u0644\u062A\u0644\u0645\u064A\u062D \u0639\u0646\u062F \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u062E\u0627\u0637\u0626\u0629.",
          "\u{1F3C1} \u0627\u0636\u063A\u0637 \u0639\u0644\u0649 \u0627\u0644\u0632\u0631 \u0623\u062F\u0646\u0627\u0647 \u0639\u0646\u062F\u0645\u0627 \u062A\u0643\u0648\u0646 \u0645\u0633\u062A\u0639\u062F\u064B\u0627. \u0644\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0623\u0631\u0633\u0644 /stop."
        ].join("\n"),
        civilLawExamReadyMenu(session.id)
      );
      return;
    }
    if (data.startsWith("exam:time:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u062A\u0627\u062D \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const timeLimitSeconds = Number(data.slice("exam:time:".length));
      if (![15, 30, 60, 300].includes(timeLimitSeconds)) return;
      const session = await store.startExamSession(telegramUserId2, String(chatId2), CIVIL_LAW_EXAM_SUBJECT_KEY, CIVIL_LAW_GENERAL_2025_SECTION_KEY, timeLimitSeconds);
      if (!session) {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u062D\u0627\u0644\u064A\u064B\u0627. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0627\u062D\u0642\u064B\u0627.", civilLawExamTimeMenu());
        return;
      }
      const questions = await store.listExamQuestions(CIVIL_LAW_EXAM_SUBJECT_KEY, CIVIL_LAW_GENERAL_2025_SECTION_KEY);
      await sender.sendMessage(
        chatId2,
        [
          `\u{1F3B2} \u0627\u0633\u062A\u0639\u062F \u062C\u064A\u062F\u064B\u0627 \u0644\u0640 '${CIVIL_LAW_GENERAL_2025_TITLE}'`,
          `\u{1F58A} ${questions.length} \u0623\u0633\u0626\u0644\u0629`,
          `\u23F1 ${formatExamTime(timeLimitSeconds)} \u0644\u0643\u0644 \u0633\u0624\u0627\u0644`,
          "\u{1F4D6} \u0633\u062A\u0638\u0647\u0631 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0635\u062D\u064A\u062D\u0629 \u0648\u0627\u0644\u0634\u0631\u062D \u0627\u0644\u0645\u0641\u0635\u0644 \u0628\u0639\u062F \u0643\u0644 \u0633\u0624\u0627\u0644.",
          "\u{1F3C1} \u0627\u0636\u063A\u0637 \u0639\u0644\u0649 \u0627\u0644\u0632\u0631 \u0623\u062F\u0646\u0627\u0647 \u0639\u0646\u062F\u0645\u0627 \u062A\u0643\u0648\u0646 \u0645\u0633\u062A\u0639\u062F\u064B\u0627. \u0644\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0623\u0631\u0633\u0644 /stop."
        ].join("\n"),
        civilLawExamReadyMenu(session.id)
      );
      return;
    }
    if (data.startsWith("exam:ready:")) {
      const sessionId = Number(data.slice("exam:ready:".length));
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await launchNativeExamQuestion(chatId2, sessionId, telegramUserId2, store, sender);
      return;
    }
    if (data.startsWith("exam:written-next:")) {
      const sessionId = Number(data.slice("exam:written-next:".length));
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      const session = await store.getExamSession(sessionId, telegramUserId2);
      if (!session || session.status !== "active") return;
      const outcome = await store.advanceExamWrittenQuestion({
        sessionId,
        telegramUserId: telegramUserId2,
        questionIndex: session.questionIndex
      });
      if (!outcome) return;
      if (outcome.completed) {
        await sendNativeExamCompletionResult(chatId2, session, outcome, store, sender);
      } else {
        await launchNativeExamQuestion(chatId2, sessionId, telegramUserId2, store, sender);
      }
      return;
    }
    if (data.startsWith("exam:stop:")) {
      const sessionId = Number(data.slice("exam:stop:".length));
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      const stopped = await store.cancelExamSession(telegramUserId2, String(chatId2));
      await sendStoppedExamMessage(chatId2, stopped, store, sender);
      return;
    }
    if (data === "browse") {
      await store.recordUsage(telegramUserId2, "browse", { sectionKey: "browse" });
      await sender.sendMessage(chatId2, browseText(), categoryMenu());
      return;
    }
    if (data === "judicial") {
      await store.recordUsage(telegramUserId2, "browse", { sectionKey: "judicial" });
      await sendJudicialFolder(chatId2, JUDICIAL_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "legislation") {
      await store.recordUsage(telegramUserId2, "browse", { sectionKey: "legislation" });
      await sendLegislationFolder(chatId2, LEGISLATION_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "legal-forms") {
      await store.recordUsage(telegramUserId2, "browse", { sectionKey: "legal-forms" });
      await sendLegalFormsFolder(chatId2, LEGAL_FORMS_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "illustrated-legal-forms") {
      await store.recordUsage(telegramUserId2, "browse", { sectionKey: "illustrated-legal-forms" });
      await sendIllustratedLegalFormsFolder(chatId2, ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "all-yemeni-laws") {
      await store.recordUsage(telegramUserId2, "browse", { sectionKey: "all-yemeni-laws" });
      await sendAllYemeniLawsFolder(chatId2, ALL_YEMENI_LAWS_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "contract-templates") {
      await store.recordUsage(telegramUserId2, "browse");
      await sendContractTemplatesMenu(chatId2, 1, store, sender);
      return;
    }
    if (data === "ctypes") {
      await sendContractTemplateTypesMenu(chatId2, store, sender);
      return;
    }
    if (data === "ctsearch") {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u0627\u0644\u0628\u062D\u062B \u062F\u0627\u062E\u0644 \u0627\u0644\u0635\u064A\u063A \u0648\u0627\u0644\u0639\u0642\u0648\u062F \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      await promptContractTemplateSearch(chatId2, store, sender);
      return;
    }
    if (data.startsWith("ctemplates:")) {
      const page = Number(data.slice("ctemplates:".length));
      await sendContractTemplatesMenu(chatId2, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("ctype:")) {
      const [, rawType, rawPage] = data.split(":");
      const page = Number(rawPage ?? "1");
      if (!isTelegramContractTemplateType(rawType)) return;
      await sendContractTemplatesByType(chatId2, rawType, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("ctresult:")) {
      const [, sessionValue, pageValue] = data.split(":");
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await sendContractTemplateSearchResults(chatId2, sessionId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("ctemplate:")) {
      const [, rawTemplateId] = data.split(":");
      const templateId = Number(rawTemplateId);
      if (!Number.isInteger(templateId) || templateId < 1) return;
      const template = await store.getContractTemplate(templateId);
      if (!template) {
        await sender.sendMessage(chatId2, "\u062A\u0639\u0630\u0631 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0646\u0645\u0648\u0630\u062C. \u0627\u062E\u062A\u0631\u0647 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.");
        return;
      }
      await sender.sendMessage(chatId2, TELEGRAM_USER_MESSAGES.filePreparing);
      try {
        await sender.sendDocument(chatId2, await createTelegramContractDocument(template));
        await store.recordUsage(telegramUserId2, "document_request");
      } catch {
        await sender.sendMessage(chatId2, TELEGRAM_USER_MESSAGES.fileDownloadFailed);
      }
      return;
    }
    if (data.startsWith("jq:")) {
      await runQuickJudicialSearch(chatId2, telegramUserId2, data.slice("jq:".length), store, sender);
      return;
    }
    if (data === "jsearch") {
      await promptJudicialSearch(chatId2, store, sender);
      return;
    }
    if (data.startsWith("lq:")) {
      await runQuickLegislationSearch(chatId2, telegramUserId2, data.slice("lq:".length), store, sender);
      return;
    }
    if (data === "lsearch") {
      await promptLegislationSearch(chatId2, store, sender);
      return;
    }
    if (data.startsWith("ayq:")) {
      await runQuickAllYemeniLawsSearch(chatId2, telegramUserId2, data.slice("ayq:".length), store, sender);
      return;
    }
    if (data === "aysearch") {
      await promptAllYemeniLawsSearch(chatId2, store, sender);
      return;
    }
    if (data === "search") {
      await store.recordUsage(telegramUserId2, "search", { sectionKey: "search" });
      await sender.sendMessage(chatId2, searchText(), unifiedSearchMenu());
      return;
    }
    if (data === "search:library") {
      await promptLibrarySearch(chatId2, store, sender);
      return;
    }
    if (data === "ltypes") {
      await sender.sendMessage(chatId2, "\u{1F4DC} \u062A\u0635\u0641\u064A\u0629 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u062D\u0633\u0628 \u0627\u0644\u0646\u0648\u0639:", legislationTypeMenu());
      return;
    }
    if (data === "lfilters") {
      await sender.sendMessage(chatId2, "\u{1F4DC} \u0627\u062E\u062A\u0631 \u0637\u0631\u064A\u0642\u0629 \u062A\u0635\u0641\u064A\u0629 \u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629:", legislationFilterMenu());
      return;
    }
    if (data === "lyears") {
      const years = await store.listLegislationYears();
      if (years.length === 0) {
        await sender.sendMessage(chatId2, "\u0644\u0627 \u062A\u062A\u0648\u0641\u0631 \u0633\u0646\u0648\u0627\u062A \u0625\u0635\u062F\u0627\u0631 \u0645\u0633\u062A\u062E\u0631\u062C\u0629 \u0645\u0646 \u0623\u0633\u0645\u0627\u0621 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u062D\u0627\u0644\u064A\u064B\u0627.", legislationFilterMenu());
      } else {
        await sender.sendMessage(chatId2, "\u{1F4C5} \u0627\u062E\u062A\u0631 \u0633\u0646\u0629 \u0627\u0644\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0645\u062A\u0627\u062D\u0629:", legislationYearMenu(years));
      }
      return;
    }
    if (data === "latest") {
      await store.recordUsage(telegramUserId2, "browse", { sectionKey: "latest" });
      await sendCuratedSources(chatId2, "\u{1F195} \u0623\u062D\u062F\u062B \u0627\u0644\u0625\u0636\u0627\u0641\u0627\u062A", await store.listRecentSources(), "menu", sender);
      return;
    }
    if (data === "popular") {
      await store.recordUsage(telegramUserId2, "browse", { sectionKey: "popular" });
      await sendCuratedSources(chatId2, "\u2B50 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0623\u0643\u062B\u0631 \u0637\u0644\u0628\u064B\u0627", await store.listPopularSources(), "menu", sender);
      return;
    }
    if (data === "featured") {
      await store.recordUsage(telegramUserId2, "browse", { sectionKey: "featured" });
      await sendFeaturedReferencesFolder(chatId2, FEATURED_REFERENCES_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "important-laws" || data === "yemeni-laws") {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u062A\u0627\u062D \u0642\u0633\u0645 \u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      if (!await hasImportantLawsSectionAccess()) {
        await sender.sendMessage(chatId2, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      await store.recordUsage(telegramUserId2, "browse", { sectionKey: "important-laws" });
      await sendImportantYemeniLawsFolder(chatId2, IMPORTANT_YEMENI_LAWS_ROOT_FOLDER_ID, 1, store, sender);
      return;
    }
    if (data === "important-laws:request") {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      if (await hasImportantLawsSectionAccess()) {
        await sender.sendMessage(chatId2, hasFreeManagedSectionAccess(managedSections, "important-laws") ? "\u0627\u0644\u0642\u0633\u0645 \u0645\u062A\u0627\u062D \u0645\u062C\u0627\u0646\u064B\u0627 \u062D\u0627\u0644\u064A\u064B\u0627. \u064A\u0645\u0643\u0646\u0643 \u0641\u062A\u062D\u0647 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629." : "\u0627\u0634\u062A\u0631\u0627\u0643\u0643 \u0645\u0639\u062A\u0645\u062F \u0628\u0627\u0644\u0641\u0639\u0644. \u064A\u0645\u0643\u0646\u0643 \u0641\u062A\u062D \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0622\u0646.", mainMenu());
        return;
      }
      await sender.sendMessage(chatId2, "\u0627\u062E\u062A\u0631 \u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u062A\u064A \u0627\u0633\u062A\u062E\u062F\u0645\u062A\u0647\u0627 \u0644\u064A\u064F\u0631\u0641\u0642 \u0646\u0648\u0639 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0648\u0628\u064A\u0627\u0646\u0627\u062A\u0647 \u0645\u0639 \u0637\u0644\u0628\u0643 \u0627\u0644\u0645\u0631\u0633\u0644 \u0625\u0644\u0649 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.", importantYemeniLawsPaymentMethodMenu());
      return;
    }
    if (data.startsWith("premium:request:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const scope = data.slice("premium:request:".length);
      if (scope !== "sharia_exams" && scope !== "secondary_exams") return;
      const sectionKey = scope === "secondary_exams" ? "secondary-exams" : "exams";
      if (hasFreeManagedSectionAccess(managedSections, sectionKey)) {
        await sender.sendMessage(chatId2, "\u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u0645\u062A\u0627\u062D \u0645\u062C\u0627\u0646\u064B\u0627 \u062D\u0627\u0644\u064A\u064B\u0627. \u0627\u0641\u062A\u062D\u0647 \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629.", mainMenu());
        return;
      }
      if (await store.hasReferralPremiumAccess(telegramUserId2, scope)) {
        await sender.sendMessage(chatId2, "\u0644\u062F\u064A\u0643 \u0648\u0635\u0648\u0644 \u0641\u0639\u0651\u0627\u0644 \u0628\u0627\u0644\u0641\u0639\u0644. \u064A\u0645\u0643\u0646\u0643 \u0641\u062A\u062D \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A \u0627\u0644\u0622\u0646 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629.", mainMenu());
        return;
      }
      await sender.sendMessage(chatId2, "\u0627\u062E\u062A\u0631 \u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u062A\u064A \u0627\u0633\u062A\u062E\u062F\u0645\u062A\u0647\u0627 \u0644\u064A\u064F\u0631\u0641\u0642 \u0646\u0648\u0639 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0648\u0628\u064A\u0627\u0646\u0627\u062A\u0647 \u0645\u0639 \u0637\u0644\u0628\u0643 \u0627\u0644\u0645\u0631\u0633\u0644 \u0625\u0644\u0649 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.", paidExamPaymentMethodMenu(scope));
      return;
    }
    if (data.startsWith("important-laws:payment:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      if (await hasImportantLawsSectionAccess()) {
        await sender.sendMessage(chatId2, hasFreeManagedSectionAccess(managedSections, "important-laws") ? "\u0627\u0644\u0642\u0633\u0645 \u0645\u062A\u0627\u062D \u0645\u062C\u0627\u0646\u064B\u0627 \u062D\u0627\u0644\u064A\u064B\u0627. \u064A\u0645\u0643\u0646\u0643 \u0641\u062A\u062D\u0647 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629." : "\u0627\u0634\u062A\u0631\u0627\u0643\u0643 \u0645\u0639\u062A\u0645\u062F \u0628\u0627\u0644\u0641\u0639\u0644. \u064A\u0645\u0643\u0646\u0643 \u0641\u062A\u062D \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0622\u0646.", mainMenu());
        return;
      }
      const paymentMethod = data.slice("important-laws:payment:".length);
      if (!(paymentMethod in importantYemeniLawsPaymentMethods)) return;
      const requesterIdentity = {
        telegramUserId: telegramUserId2,
        telegramUsername: callback.from?.username,
        telegramFirstName: callback.from?.first_name,
        telegramLastName: callback.from?.last_name,
        paymentMethod,
        accessScope: "important_laws"
      };
      pendingImportantLawsPaymentProofs.set(telegramUserId2, {
        expiresAt: Date.now() + IMPORTANT_LAWS_PAYMENT_PROOF_TIMEOUT_MS,
        identity: requesterIdentity
      });
      await sender.sendMessage(chatId2, "\u0623\u0631\u0633\u0644 \u0627\u0644\u0622\u0646 \u0635\u0648\u0631\u0629 \u0648\u0627\u0636\u062D\u0629 \u0644\u0625\u062B\u0628\u0627\u062A \u0627\u0644\u0625\u064A\u062F\u0627\u0639. \u0633\u062A\u064F\u0631\u0633\u0644 \u0627\u0644\u0635\u0648\u0631\u0629 \u0625\u0644\u0649 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637 \u0645\u0639 \u0637\u0644\u0628 \u0627\u0634\u062A\u0631\u0627\u0643\u0643\u060C \u0648\u062A\u0646\u062A\u0647\u064A \u0645\u0647\u0644\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0628\u0639\u062F 15 \u062F\u0642\u064A\u0642\u0629.");
      return;
    }
    if (data.startsWith("premium:payment:")) {
      if (!isPrivateChat(chat?.type)) {
        await sender.sendMessage(chatId2, "\u064A\u0645\u0643\u0646 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
        return;
      }
      const [, , rawScope, rawPaymentMethod] = data.split(":");
      const accessScope = rawScope;
      const paymentMethod = rawPaymentMethod;
      if (accessScope !== "sharia_exams" && accessScope !== "secondary_exams" || !(paymentMethod in importantYemeniLawsPaymentMethods)) return;
      pendingImportantLawsPaymentProofs.set(telegramUserId2, {
        expiresAt: Date.now() + IMPORTANT_LAWS_PAYMENT_PROOF_TIMEOUT_MS,
        identity: {
          telegramUserId: telegramUserId2,
          telegramUsername: callback.from?.username,
          telegramFirstName: callback.from?.first_name,
          telegramLastName: callback.from?.last_name,
          paymentMethod,
          accessScope
        }
      });
      await sender.sendMessage(chatId2, "\u0623\u0631\u0633\u0644 \u0627\u0644\u0622\u0646 \u0635\u0648\u0631\u0629 \u0648\u0627\u0636\u062D\u0629 \u0644\u0625\u062B\u0628\u0627\u062A \u0627\u0644\u0625\u064A\u062F\u0627\u0639. \u0633\u062A\u064F\u0631\u0633\u0644 \u0627\u0644\u0635\u0648\u0631\u0629 \u0625\u0644\u0649 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637 \u0645\u0639 \u0637\u0644\u0628 \u0627\u0634\u062A\u0631\u0627\u0643\u0643\u060C \u0648\u062A\u0646\u062A\u0647\u064A \u0645\u0647\u0644\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0628\u0639\u062F 15 \u062F\u0642\u064A\u0642\u0629.");
      return;
    }
    if (data === "support") {
      await promptSupport(chatId2, sender);
      return;
    }
    if (data === "help") {
      await sender.sendMessage(chatId2, helpText(messageContent("help")), mainMenu());
      return;
    }
    if (data === "about") {
      await sender.sendMessage(chatId2, aboutText(messageContent("about")), mainMenu());
      return;
    }
    if (data.startsWith("category:")) {
      const [categoryValue, pageValue] = data.slice("category:".length).split(":");
      const category = categoryValue;
      const page = Number(pageValue ?? "1");
      if (legalCategories.includes(category)) {
        await sendSourcesForCategory(chatId2, category, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("index:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendJudicialFolder(chatId2, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("lindex:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendLegislationFolder(chatId2, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("ayindex:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendAllYemeniLawsFolder(chatId2, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("ylindex:")) {
      if (!await hasImportantLawsSectionAccess()) {
        await sender.sendMessage(chatId2, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendImportantYemeniLawsFolder(chatId2, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("findex:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendLegalFormsFolder(chatId2, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("vindex:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendIllustratedLegalFormsFolder(chatId2, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("rindex:")) {
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendFeaturedReferencesFolder(chatId2, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("iindex:")) {
      if (!await hasImportantLawsSectionAccess()) {
        await sender.sendMessage(chatId2, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      const [, folderId, pageValue] = data.split(":");
      const page = Number(pageValue ?? "1");
      if (folderId) {
        await sendImportantYemeniLawsFolder(chatId2, folderId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("ltype:")) {
      const [, documentTypeValue, pageValue] = data.split(":");
      const documentType = documentTypeValue;
      const page = Number(pageValue ?? "1");
      if (documentType in legislationDocumentTypeLabels) {
        await sendLegislationType(chatId2, documentType, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("lyear:")) {
      const [, yearValue, pageValue] = data.split(":");
      const year = Number(yearValue);
      const page = Number(pageValue ?? "1");
      if (Number.isInteger(year) && year >= 1900 && year <= 2200) {
        await sendLegislationYear(chatId2, year, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      }
      return;
    }
    if (data.startsWith("jfile:")) {
      const [, sourceValue, folderId, pageValue] = data.split(":");
      const sourceId = Number(sourceValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      if (source) await store.recordUsage(telegramUserId2, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("lfile:")) {
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      if (source) await store.recordUsage(telegramUserId2, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("ayfile:")) {
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      if (source?.collection !== "all_yemeni_laws") return;
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      await store.recordUsage(telegramUserId2, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("ylfile:")) {
      if (!await hasImportantLawsSectionAccess()) {
        await sender.sendMessage(chatId2, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      if (source?.collection !== "important_yemeni_laws") return;
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      if (source) await store.recordUsage(telegramUserId2, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("rfile:")) {
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      if (source) await store.recordUsage(telegramUserId2, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("fform:")) {
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      if (source) await store.recordUsage(telegramUserId2, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("vfile:")) {
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      if (source?.collection !== "illustrated_legal_forms") return;
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      await store.recordUsage(telegramUserId2, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("ifile:")) {
      if (!await hasImportantLawsSectionAccess()) {
        await sender.sendMessage(chatId2, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      const [, sourceValue, folderId] = data.split(":");
      const sourceId = Number(sourceValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !folderId) return;
      const source = await store.getSource(sourceId);
      if (source?.collection !== "important_yemeni_laws") return;
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      await store.recordUsage(telegramUserId2, "document_request", { sourceId: source.id });
      return;
    }
    if (data.startsWith("jresult:")) {
      const [, sessionValue, pageValue] = data.split(":");
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await sendJudicialSearchResults(chatId2, sessionId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("lresult:")) {
      const [, sessionValue, pageValue] = data.split(":");
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await sendLegislationSearchResults(chatId2, sessionId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("ayresult:")) {
      const [, sessionValue, pageValue] = data.split(":");
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await sendAllYemeniLawsSearchResults(chatId2, sessionId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("bresult:")) {
      const [, sessionValue, pageValue] = data.split(":");
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sessionId) || sessionId < 1) return;
      await sendLibrarySearchResults(chatId2, sessionId, Number.isInteger(page) && page > 0 ? page : 1, store, sender);
      return;
    }
    if (data.startsWith("jresultfile:")) {
      const [, sourceValue, sessionValue, pageValue] = data.split(":");
      const sourceId = Number(sourceValue);
      const sessionId = Number(sessionValue);
      const page = Number(pageValue ?? "1");
      if (!Number.isInteger(sourceId) || sourceId < 1 || !Number.isInteger(sessionId) || sessionId < 1) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      return;
    }
    if (data.startsWith("lresultfile:")) {
      const [, sourceValue, sessionValue] = data.split(":");
      const sourceId = Number(sourceValue);
      const sessionId = Number(sessionValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !Number.isInteger(sessionId) || sessionId < 1) return;
      const source = await store.getSource(sourceId);
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      return;
    }
    if (data.startsWith("ayresultfile:")) {
      const [, sourceValue, sessionValue] = data.split(":");
      const sourceId = Number(sourceValue);
      const sessionId = Number(sessionValue);
      if (!Number.isInteger(sourceId) || sourceId < 1 || !Number.isInteger(sessionId) || sessionId < 1) return;
      const source = await store.getSource(sourceId);
      if (source?.collection !== "all_yemeni_laws") return;
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
      return;
    }
    if (data.startsWith("source:")) {
      const sourceId = Number(data.slice("source:".length));
      if (!Number.isInteger(sourceId) || sourceId < 1) return;
      const source = await store.getSource(sourceId);
      if (source?.collection === "important_yemeni_laws" && !await hasImportantLawsSectionAccess()) {
        await sender.sendMessage(chatId2, importantYemeniLawsIntroText(), importantYemeniLawsSubscriptionMenu());
        return;
      }
      await deliverPrivateDocument(chatId2, source, sender, documentProvider);
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
  let referralRegistration;
  if (isPrivateChat(chatType)) {
    isFirstPrivateUse = await store.registerSubscriber(String(chatId), telegramUserId, {
      telegramUsername: update.message?.from?.username ?? null,
      telegramFirstName: update.message?.from?.first_name ?? null,
      telegramLastName: update.message?.from?.last_name ?? null
    });
    const hasReferralPayload = isStartMessage && incomingText.startsWith("/start ref_");
    const referrerTelegramUserId = hasReferralPayload ? referralStartReferrerId(incomingText) : void 0;
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
      await sender.sendMessage(chatId, "\u064A\u0645\u0643\u0646 \u0625\u0631\u0633\u0627\u0644 \u0635\u0648\u0631\u0629 \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0645\u0646 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
      return;
    }
    if (pendingPaymentProof.expiresAt <= Date.now()) {
      pendingImportantLawsPaymentProofs.delete(telegramUserId);
      await sender.sendMessage(chatId, `\u0627\u0646\u062A\u0647\u062A \u0645\u0647\u0644\u0629 \u0625\u0631\u0641\u0627\u0642 \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u0625\u064A\u062F\u0627\u0639. \u0627\u0641\u062A\u062D \u0642\u0633\u0645 ${subscriptionRequestLabel(pendingPaymentProof.identity.accessScope, pendingPaymentProof.identity.managedMenuItemId)} \u0648\u0627\u0628\u062F\u0623 \u0637\u0644\u0628\u064B\u0627 \u062C\u062F\u064A\u062F\u064B\u0627.`, mainMenu());
      return;
    }
    const photo = update.message?.photo?.at(-1);
    if (!photo?.file_id) {
      await sender.sendMessage(chatId, "\u0623\u0631\u0633\u0644 \u0635\u0648\u0631\u0629 \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0643\u0635\u0648\u0631\u0629 \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629\u060C \u0648\u0644\u064A\u0633 \u0643\u0646\u0635 \u0623\u0648 \u0645\u0644\u0641 \u0622\u062E\u0631.");
      return;
    }
    const requesterIdentity = pendingPaymentProof.identity;
    const request = await store.createImportantYemeniLawsSubscriptionRequest(telegramUserId, String(chatId), {
      username: requesterIdentity.telegramUsername ?? void 0,
      firstName: requesterIdentity.telegramFirstName ?? void 0,
      lastName: requesterIdentity.telegramLastName ?? void 0,
      paymentMethod: requesterIdentity.paymentMethod,
      accessScope: requesterIdentity.accessScope,
      managedMenuItemId: requesterIdentity.managedMenuItemId
    });
    if (!request) {
      await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u062D\u0627\u0644\u064A\u064B\u0627. \u0623\u0639\u062F \u0625\u0631\u0633\u0627\u0644 \u0635\u0648\u0631\u0629 \u0627\u0644\u0625\u062B\u0628\u0627\u062A \u0628\u0639\u062F \u0642\u0644\u064A\u0644.");
      return;
    }
    pendingImportantLawsPaymentProofs.delete(telegramUserId);
    if (!request.created) {
      await sender.sendMessage(chatId, "\u0637\u0644\u0628 \u0627\u0634\u062A\u0631\u0627\u0643\u0643 \u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0628\u0627\u0644\u0641\u0639\u0644. \u0633\u062A\u0635\u0644\u0643 \u0631\u0633\u0627\u0644\u0629 \u0639\u0646\u062F \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0644\u0644\u0637\u0644\u0628.", mainMenu());
      return;
    }
    await sender.sendMessage(chatId, `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0648\u0635\u0648\u0631\u0629 \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0625\u0644\u0649 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A. \u0637\u0644\u0628\u0643 \u062E\u0627\u0635 \u0628\u0642\u0633\u0645 ${subscriptionRequestLabel(requesterIdentity.accessScope, requesterIdentity.managedMenuItemId)}\u060C \u0648\u0628\u0639\u062F \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u062D\u0644\u064A \u0633\u062A\u0635\u0644\u0643 \u0631\u0633\u0627\u0644\u0629 \u0639\u0646\u062F \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0642\u0633\u0645.`, mainMenu());
    const ownerChatId = Number(process.env.TELEGRAM_OWNER_ID ?? "");
    if (Number.isSafeInteger(ownerChatId)) {
      await sender.sendMessage(
        ownerChatId,
        `\u{1F510} \u0637\u0644\u0628 \u0627\u0634\u062A\u0631\u0627\u0643 \u062C\u062F\u064A\u062F \u0641\u064A ${subscriptionRequestLabel(requesterIdentity.accessScope, requesterIdentity.managedMenuItemId)}
\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628: #${request.id}
${importantYemeniLawsSubscriberText(requesterIdentity)}
${importantYemeniLawsPaymentMethodText(requesterIdentity.paymentMethod)}
\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629: ${chatId}

\u0623\u064F\u0631\u0641\u0642\u062A \u0635\u0648\u0631\u0629 \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0627\u0644\u062A\u0627\u0644\u064A\u0629. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u062D\u0644\u064A \u0642\u0628\u0644 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0637\u0644\u0628.`,
        importantYemeniLawsApprovalMenu(request.id, requesterIdentity)
      ).catch(() => void 0);
      await sender.sendPhotoByFileId(ownerChatId, photo.file_id, `\u0625\u062B\u0628\u0627\u062A \u0625\u064A\u062F\u0627\u0639 \u0627\u0644\u0637\u0644\u0628 #${request.id}`).catch(() => void 0);
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
      caption
    });
    if (!draft) {
      await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0645\u0633\u0648\u062F\u0629 \u0627\u0644\u0645\u0644\u0641 \u062D\u0627\u0644\u064A\u064B\u0627. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u064B\u0627.", mainMenu());
      return;
    }
    await sendBroadcastPreview(chatId, draft, sender);
    return;
  }
  const text2 = update.message?.text?.trim();
  if (!text2) return;
  const { command, query } = normalizeCommand(text2);
  if (command === "/start" && query === "groupquiz" && !isPrivateChat(chatType) && chatType !== "channel") {
    await sender.sendMessage(chatId, `\u{1F3B2} ${CIVIL_LAW_GENERAL_2025_TITLE}

\u0627\u0636\u063A\u0637 \u0627\u0644\u0632\u0631 \u0623\u062F\u0646\u0627\u0647 \u0644\u0628\u062F\u0621 \u0625\u0639\u062F\u0627\u062F \u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0648\u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u062F\u0629 \u0627\u0644\u0633\u0624\u0627\u0644.`, groupExamLaunchMenu());
    return;
  }
  if (command === "/start") {
    await sender.sendMessage(chatId, isFirstPrivateUse ? aboutText(messageContent("about")) : welcomeText(messageContent("welcome")), mainMenu(managedMenuItems, managedSections));
    return;
  }
  if (command === "/startquiz") {
    if (isPrivateChat(chatType) || chatType === "channel") {
      await sender.sendMessage(chatId, "\u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0623\u0645\u0631 /startquiz \u062F\u0627\u062E\u0644 \u0645\u062C\u0645\u0648\u0639\u0629 \u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645 \u0644\u0641\u062A\u062D \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u062C\u0645\u0627\u0639\u064A. \u0628\u0639\u062F \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0645\u062F\u0629 \u064A\u0636\u063A\u0637 \u062B\u0644\u0627\u062B\u0629 \u0623\u0639\u0636\u0627\u0621 \u0645\u062E\u062A\u0644\u0641\u064A\u0646 \xAB\u0623\u0646\u0627 \u0645\u0633\u062A\u0639\u062F\xBB \u0644\u062A\u0628\u062F\u0623 \u0627\u0644\u062C\u0648\u0644\u0629.", mainMenu());
      return;
    }
    await sender.sendMessage(chatId, `\u{1F3B2} ${CIVIL_LAW_GENERAL_2025_TITLE}

\u0627\u0636\u063A\u0637 \u0627\u0644\u0632\u0631 \u0623\u062F\u0646\u0627\u0647 \u0644\u0628\u062F\u0621 \u0625\u0639\u062F\u0627\u062F \u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0648\u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u062F\u0629 \u0627\u0644\u0633\u0624\u0627\u0644.`, groupExamLaunchMenu());
    return;
  }
  if (command === "/stop") {
    if (!isPrivateChat(chatType)) {
      await sender.sendMessage(chatId, "\u064A\u062A\u0627\u062D \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u0639 \u0627\u0644\u0628\u0648\u062A \u0641\u0642\u0637.", mainMenu());
      return;
    }
    const stopped = await store.cancelExamSession(telegramUserId, String(chatId));
    await sendStoppedExamMessage(chatId, stopped, store, sender);
    return;
  }
  if (command === "/newquiz") {
    if (!isPrivateChat(chatType) && chatType !== "channel") {
      await sender.sendMessage(chatId, `\u{1F3B2} ${CIVIL_LAW_GENERAL_2025_TITLE}

\u0627\u0636\u063A\u0637 \u0627\u0644\u0632\u0631 \u0623\u062F\u0646\u0627\u0647 \u0644\u0628\u062F\u0621 \u0625\u0639\u062F\u0627\u062F \u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0648\u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u062F\u0629 \u0627\u0644\u0633\u0624\u0627\u0644.`, groupExamLaunchMenu());
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
    await sender.sendMessage(chatId, "\u0634\u0643\u0631\u064B\u0627 \u0644\u0631\u0633\u0627\u0644\u062A\u0643. \u062A\u0645 \u062D\u0641\u0638 \u0637\u0644\u0628\u0643 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0646 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u0648\u062A.", supportMenu());
    return;
  }
  if (command === "/stats") {
    if (!isPrivateOwnerConversation(telegramUserId, chatType)) {
      await sender.sendMessage(chatId, "\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0628\u0648\u062A \u062F\u0627\u062E\u0644 \u0645\u062D\u0627\u062F\u062B\u062A\u0647 \u0627\u0644\u062E\u0627\u0635\u0629 \u0641\u0642\u0637.", mainMenu());
      return;
    }
    await sender.sendMessage(chatId, ownerStatisticsText(await store.getOwnerStatistics()), mainMenu());
    return;
  }
  if (command === "/supportrequests") {
    if (!isPrivateOwnerConversation(telegramUserId, chatType)) {
      await sender.sendMessage(chatId, "\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0628\u0648\u062A \u062F\u0627\u062E\u0644 \u0645\u062D\u0627\u062F\u062B\u062A\u0647 \u0627\u0644\u062E\u0627\u0635\u0629 \u0641\u0642\u0637.", mainMenu());
      return;
    }
    await sender.sendMessage(chatId, supportRequestsText(await store.listNewSupportRequests()), mainMenu());
    return;
  }
  if (command === "/importantlawsrequests") {
    if (!isPrivateOwnerConversation(telegramUserId, chatType)) {
      await sender.sendMessage(chatId, "\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0628\u0648\u062A \u062F\u0627\u062E\u0644 \u0645\u062D\u0627\u062F\u062B\u062A\u0647 \u0627\u0644\u062E\u0627\u0635\u0629 \u0641\u0642\u0637.", mainMenu());
      return;
    }
    const requests = await store.listPendingImportantYemeniLawsSubscriptionRequests();
    if (requests.length === 0) {
      await sender.sendMessage(chatId, "\u{1F510} \u0637\u0644\u0628\u0627\u062A \u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A\n\n\u0644\u0627 \u062A\u0648\u062C\u062F \u0637\u0644\u0628\u0627\u062A \u0627\u0634\u062A\u0631\u0627\u0643 \u0645\u0639\u0644\u0642\u0629 \u062D\u0627\u0644\u064A\u064B\u0627.", mainMenu());
      return;
    }
    for (const request of requests) {
      await sender.sendMessage(
        chatId,
        `\u{1F510} \u0637\u0644\u0628 \u0627\u0634\u062A\u0631\u0627\u0643 \u0645\u0639\u0644\u0642
\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628: #${request.id}
${importantYemeniLawsSubscriberText(request)}
\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629: ${request.chatId}`,
        importantYemeniLawsApprovalMenu(request.id, request)
      );
    }
    return;
  }
  if (command === "/broadcast") {
    if (!isOwnerPrivateChat) {
      await sender.sendMessage(chatId, "\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0628\u0648\u062A \u062F\u0627\u062E\u0644 \u0645\u062D\u0627\u062F\u062B\u062A\u0647 \u0627\u0644\u062E\u0627\u0635\u0629 \u0641\u0642\u0637.", mainMenu());
      return;
    }
    if (!query) {
      await sender.sendMessage(chatId, "\u0627\u0643\u062A\u0628 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0628\u0639\u062F \u0627\u0644\u0623\u0645\u0631 \u0645\u0628\u0627\u0634\u0631\u0629.\n\u0645\u062B\u0627\u0644: /broadcast \u062A\u0645\u0651\u062A \u0625\u0636\u0627\u0641\u0629 \u0645\u0631\u062C\u0639 \u0642\u0627\u0646\u0648\u0646\u064A \u062C\u062F\u064A\u062F \u0625\u0644\u0649 \u0627\u0644\u0645\u0643\u062A\u0628\u0629.", mainMenu());
      return;
    }
    const draft = await store.createBroadcastDraft({ ownerTelegramUserId: telegramUserId, kind: "message", message: query });
    if (!draft) {
      await sender.sendMessage(chatId, "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0645\u0633\u0648\u062F\u0629 \u0627\u0644\u0628\u062B \u062D\u0627\u0644\u064A\u064B\u0627. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u064B\u0627.", mainMenu());
      return;
    }
    await sendBroadcastPreview(chatId, draft, sender);
    return;
  }
  if (command === "/broadcastfile") {
    if (!isOwnerPrivateChat) {
      await sender.sendMessage(chatId, "\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0628\u0648\u062A \u062F\u0627\u062E\u0644 \u0645\u062D\u0627\u062F\u062B\u062A\u0647 \u0627\u0644\u062E\u0627\u0635\u0629 \u0641\u0642\u0637.", mainMenu());
      return;
    }
    pendingBroadcastFileUploads.add(telegramUserId);
    await sender.sendMessage(chatId, "\u0623\u0631\u0633\u0644 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0622\u0646 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u062E\u0627\u0635\u0629. \u064A\u0645\u0643\u0646\u0643 \u0643\u062A\u0627\u0628\u0629 \u0648\u0635\u0641\u0647 \u0641\u064A \u062A\u0639\u0644\u064A\u0642 \u0627\u0644\u0645\u0644\u0641. \u0628\u0639\u062F \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0633\u062A\u0638\u0647\u0631 \u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u0632\u0631\u0627 \u0627\u0644\u062A\u0623\u0643\u064A\u062F \u0623\u0648 \u0627\u0644\u0625\u0644\u063A\u0627\u0621\u060C \u0648\u0644\u0646 \u064A\u064F\u0631\u0633\u0644 \u0627\u0644\u0645\u0644\u0641 \u0642\u0628\u0644 \u062A\u0623\u0643\u064A\u062F\u0643 \u0627\u0644\u0635\u0631\u064A\u062D.", mainMenu());
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
  if (!text2.startsWith("/")) {
    if (isPrivateChat(chatType)) {
      const contractTemplateSession = await store.consumeContractTemplateSearchQuery(String(chatId), text2);
      if (contractTemplateSession) {
        await store.recordUsage(telegramUserId, "search", { query: text2 });
        await sendContractTemplateSearchResults(chatId, contractTemplateSession.id, 1, store, sender);
        return;
      }
    }
    const session = await store.consumeJudicialSearchQuery(String(chatId), text2);
    if (session) {
      await store.recordUsage(telegramUserId, "search", { query: text2 });
      await sendJudicialSearchResults(chatId, session.id, 1, store, sender);
      return;
    }
    const legislationSession = await store.consumeLegislationSearchQuery(String(chatId), text2);
    if (legislationSession) {
      await store.recordUsage(telegramUserId, "search", { query: text2 });
      await sendLegislationSearchResults(chatId, legislationSession.id, 1, store, sender);
      return;
    }
    const allYemeniLawsSession = await store.consumeAllYemeniLawsSearchQuery(String(chatId), text2);
    if (allYemeniLawsSession) {
      await store.recordUsage(telegramUserId, "search", { query: text2 });
      await sendAllYemeniLawsSearchResults(chatId, allYemeniLawsSession.id, 1, store, sender);
      return;
    }
    const librarySession = await store.consumeLibrarySearchQuery(String(chatId), text2);
    if (librarySession) {
      await store.recordUsage(telegramUserId, "search", { query: text2 });
      await sendLibrarySearchResults(chatId, librarySession.id, 1, store, sender);
      return;
    }
  }
  await sender.sendMessage(chatId, TELEGRAM_USER_MESSAGES.unknownRequest, mainMenu());
}
async function telegramRequest(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const responseText = await response.text();
  let body = {};
  try {
    body = JSON.parse(responseText);
  } catch {
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
async function telegramMultipartRequest(token, method, form) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body: form });
  if (!response.ok) throw new Error(`Telegram API request failed with status ${response.status}`);
}
function createTelegramSender(token, replyContext = {}) {
  const topicPayload = {
    ...Number.isInteger(replyContext.messageThreadId) ? { message_thread_id: replyContext.messageThreadId } : {},
    ...Number.isInteger(replyContext.directMessagesTopicId) ? { direct_messages_topic_id: replyContext.directMessagesTopicId } : {}
  };
  return {
    async sendMessage(chatId, text2, replyMarkup) {
      await telegramRequest(token, "sendMessage", {
        chat_id: chatId,
        ...topicPayload,
        text: text2,
        reply_markup: adaptReplyMarkupForTelegramContext(replyMarkup, replyContext)
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
        ...caption ? { caption } : {}
      });
    },
    async sendPhotoByFileId(chatId, fileId, caption) {
      await telegramRequest(token, "sendPhoto", {
        chat_id: chatId,
        ...topicPayload,
        photo: fileId,
        ...caption ? { caption } : {}
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
        open_period: poll.openPeriodSeconds
      });
      const pollId = result?.poll?.id;
      if (!pollId) throw new Error("Telegram did not return a quiz poll identifier");
      return { pollId };
    },
    async answerCallbackQuery(callbackQueryId, text2) {
      await telegramRequest(token, "answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        ...text2 ? { text: text2, show_alert: true } : {}
      });
    },
    async editMessageText(chatId, messageId, text2, replyMarkup) {
      await telegramRequest(token, "editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: text2,
        reply_markup: adaptReplyMarkupForTelegramContext(replyMarkup, replyContext)
      });
    },
    async isChatAdministrator(chatId, telegramUserId) {
      try {
        const result = await telegramRequest(token, "getChatMember", {
          chat_id: chatId,
          user_id: telegramUserId
        });
        return result?.status === "creator" || result?.status === "administrator";
      } catch {
        return false;
      }
    }
  };
}
function createTelegramChannelMembershipChecker(token) {
  return {
    async check(telegramUserId, channelHandle) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7e3);
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: channelHandle, user_id: telegramUserId }),
          signal: controller.signal
        });
        if (!response.ok) return "unavailable";
        const payload = await response.json();
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
    }
  };
}
function isFinalTelegramWebhookUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname === "/api/telegram/webhook";
  } catch {
    return false;
  }
}
async function synchronizeTelegramConfiguration(config) {
  const { token, webhookUrl, webhookSecret } = config;
  if (!token) return;
  await telegramRequest(token, "setMyCommands", { commands: BOT_COMMANDS });
  const ownerTelegramId = Number(process.env.TELEGRAM_OWNER_ID);
  if (Number.isSafeInteger(ownerTelegramId) && ownerTelegramId > 0) {
    await telegramRequest(token, "setMyCommands", {
      commands: [...BOT_COMMANDS, ...OWNER_COMMANDS],
      scope: { type: "chat", chat_id: ownerTelegramId }
    });
  }
  if (isFinalTelegramWebhookUrl(webhookUrl) && webhookSecret) {
    await telegramRequest(token, "setWebhook", {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message", "callback_query", "poll_answer", "poll"],
      drop_pending_updates: false
    });
  }
}

// server/telegramPlatformVisit.ts
import { createHmac, timingSafeEqual } from "node:crypto";
var SUPABASE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co";
var MAX_INIT_DATA_AGE_SECONDS = 5 * 60;
function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && leftBuffer.length > 0 && timingSafeEqual(leftBuffer, rightBuffer);
}
function validateTelegramWebAppInitData(initData, botToken, nowSeconds = Math.floor(Date.now() / 1e3)) {
  if (!initData || !botToken) return void 0;
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userJson = params.get("user");
  if (!receivedHash || !Number.isSafeInteger(authDate) || !userJson) return void 0;
  if (authDate > nowSeconds + 30 || nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS) return void 0;
  const dataCheckString = Array.from(params.entries()).filter(([key]) => key !== "hash").sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(calculatedHash, receivedHash)) return void 0;
  try {
    const user = JSON.parse(userJson);
    const userId = user.id;
    if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId <= 0) return void 0;
    return { telegramUserId: String(userId), authDate };
  } catch {
    return void 0;
  }
}
async function recordTelegramPlatformVisit(visit) {
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!apiKey) throw new Error("\u0645\u0641\u062A\u0627\u062D Supabase \u0627\u0644\u062E\u0627\u062F\u0645\u064A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0644\u062A\u0633\u062C\u064A\u0644 \u0632\u064A\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0635\u0629.");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/telegram_platform_visits`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify({
      telegram_user_id: visit.telegramUserId,
      auth_date: visit.authDate,
      source: "telegram_web_app"
    })
  });
  if (!response.ok) {
    throw new Error(`\u062A\u0639\u0630\u0631 \u062A\u0633\u062C\u064A\u0644 \u0632\u064A\u0627\u0631\u0629 \u0645\u0646\u0635\u0629 \u0627\u0644\u0646\u0627\u0635\u0631 (${response.status}).`);
  }
}
async function verifyAndRecordTelegramPlatformVisit(initData, botToken) {
  const visit = validateTelegramWebAppInitData(initData, botToken);
  if (!visit) throw new Error("\u0628\u064A\u0627\u0646\u0627\u062A Telegram Web App \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629 \u0623\u0648 \u0645\u0646\u062A\u0647\u064A\u0629.");
  await recordTelegramPlatformVisit(visit);
  return visit;
}

// server/supabaseBotStore.ts
import { createClient as createClient2 } from "@supabase/supabase-js";

// server/illustratedLegalFormsCatalog.ts
var ILLUSTRATED_SOURCE_DEFINITIONS = [
  ["1PV9925vCUqQMn3h4mCpwLIKwoUHD6FZr", "\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0648\u0627\u0639\u0644\u0627\u0646\u0627\u062A.pdf"],
  ["1f1kZPOMKX6YHYRgKOlzOebGZOq3W4E5F", "\u0625\u0642\u0631\u0627\u0631\u0627\u062A.pdf"],
  ["1RCXV8qFSDHqIg80w1h1mu5op7gm83tUN", "\u0627\u0633\u062A\u0626\u0646\u0627\u0641.pdf"],
  ["1nkRs51TiYQ6rPEd1MbXX63N_cN6UbLSH", "\u0627\u0633\u062A\u0634\u0643\u0627\u0644\u0627\u062A.pdf"],
  ["1gk4JCrg2umakgx_81HsB0AbWYZFTuUoS", "\u0627\u0644\u062A\u0632\u0627\u0645\u0627\u062A.pdf"],
  ["1oE5czmSuMJuRChwgXutU4T096b7DK_Rs", "\u0627\u0644\u0639\u0644\u064A\u0627.pdf"],
  ["1kJHO_axBjV07Ld1rgvleicrTmJLgXAKE", "\u062A\u0638\u0644\u0645 \u0645\u0646 \u0623\u0648\u0627\u0645\u0631 \u0648\u0642\u0631\u0627\u0631\u0627\u062A \u062A\u0646\u0641\u064A\u0630\u064A\u0629.pdf"],
  ["1g0jkml8HNT-rqkcJG-6kU7FjEREFmde0", "\u062A\u0638\u0644\u0645\u0627\u062A.pdf"],
  ["1GHwmBjXhnMmDmRP6_S6FxDPvnRAqPmr5", "\u062A\u0643\u0644\u064A\u0641 \u0628\u0627\u0644\u0648\u0641\u0627\u0621.pdf"],
  ["1u5Q0GwGPgl-FjX576OEjWpqDHv9v8dqr", "\u062A\u0648\u0643\u064A\u0644\u0627\u062A \u0648\u062A\u0641\u0648\u064A\u0636\u0627\u062A \u0648\u062A\u0646\u0627\u0632\u0644.pdf"],
  ["1oyvzm5Zce6_zC7-YO-7L4lkPppaj_dm9", "\u062F\u0639\u0627\u0648\u0649.pdf"],
  ["162qu-dE3mzEHL5mIyZkDLaSoiXeeUCMs", "\u062F\u0641\u0648\u0639.pdf"],
  ["1I5t3o4-r4krhNOSngPUu10NzybyQiu-z", "\u0634\u0643\u0627\u0648\u0649.pdf"],
  ["118_3JdTr2sv-LVV5D9Bo0AMeCHW6g1ta", "\u0636\u0645\u0627\u0646\u0627\u062A.pdf"],
  ["1g2ewZ5EHCtrxQSrRMKoSDgx_H92kCVpQ", "\u0637\u0644\u0628\u0627\u062A.pdf"],
  ["18C3ly9HqzyxYkWKeONw0cBxBkolwHk6T", "\u0639\u0642\u0648\u062F.pdf"],
  ["1iHZmP3p7Htj-tKvUA4jFwWXlkjWTOeN-", "\u0643\u064A\u0641\u064A\u0629.pdf"]
];
var illustratedLegalFormsRootFolder = {
  id: 0,
  driveFolderId: ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID,
  parentDriveFolderId: null,
  collection: "illustrated_legal_forms",
  name: "\u0646\u0645\u0627\u0630\u062C \u0645\u0635\u0648\u0631\u0629 \u0648\u0641\u0642 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629",
  path: "\u0646\u0645\u0627\u0630\u062C \u0645\u0635\u0648\u0631\u0629 \u0648\u0641\u0642 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629",
  sortOrder: 70,
  createdAt: /* @__PURE__ */ new Date(0),
  updatedAt: /* @__PURE__ */ new Date(0)
};
var illustratedLegalFormSources = ILLUSTRATED_SOURCE_DEFINITIONS.map(([driveFileId, title], index2) => ({
  id: 900001 + index2,
  category: "procedure",
  collection: "illustrated_legal_forms",
  sortOrder: index2 + 1,
  driveFileId,
  driveFolderId: ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID,
  folderSortOrder: index2 + 1,
  title,
  description: `\u0645\u0633\u062A\u0648\u0631\u062F \u0645\u0646 \u0645\u0643\u062A\u0628\u0629 \u0623. \u0645\u0639\u064A\u0646 \u0627\u0644\u0646\u0627\u0635\u0631: \u0646\u0645\u0627\u0630\u062C \u0645\u0635\u0648\u0631\u0629 \u0648\u0641\u0642 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 / ${title}`,
  url: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`,
  documentType: "other",
  legislationYear: null,
  issuingAuthority: null,
  isFeatured: false,
  createdAt: /* @__PURE__ */ new Date(0),
  updatedAt: /* @__PURE__ */ new Date(0)
}));
function getIllustratedLegalFormsFolderContents2(folderId, page) {
  if (folderId !== ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const start = (safePage - 1) * 7;
  return {
    folder: illustratedLegalFormsRootFolder,
    folders: [],
    sources: illustratedLegalFormSources.slice(start, start + 7),
    totalSources: illustratedLegalFormSources.length
  };
}
function getIllustratedLegalFormSource(sourceId) {
  return illustratedLegalFormSources.find((source) => source.id === sourceId);
}

// server/legalFormsCatalog.ts
var LEGAL_FORM_SOURCE_DEFINITIONS = [
  ["1AEoWr4AY2H2IyDlX1DZXJF4QFo2U6V14", "005\u062F\u0639\u0648\u0649 \u0627\u062E\u0644\u0627\u0621 \u0639\u064A\u0646 \u0645\u0624\u062C\u0631\u0629.doc"],
  ["1FC3LjdLenuqVnhlA2EXdvG2L19Gv4HSx", "1 \u062F\u0639\u0648\u0649 \u0628\u0637\u0644\u0627\u0646 \u062D\u0643\u0645 \u062A\u062D\u0643\u064A\u0645.doc"],
  ["1FBO74Crv4SC2s40bkStkIfuZO84KHmfH", "14\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u062D\u0643\u0645 \u0627\u062E\u0644\u0627\u0621 \u0627\u064A\u062C\u0627\u0631\u0627\u062A.doc"],
  ["1F5HoHMRXWavPN_4IWfrPyIMjmT9YyEx-", "15\u0637\u0639\u0646 \u0627\u064A\u062C\u0627\u0631\u0627\u062A  \u0642 4 \u0644\u0633\u0646\u0647 1996.doc"],
  ["1EtfbzLb_oksVQUACPZAq69TX1isaH46K", "18\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0627\u064A\u062C\u0627\u0631\u0627\u062A.doc"],
  ["1Esi8XwcQh9HAqNVEbkFhfkjzoACWI8je", "24\u0645\u0630\u0643\u0631\u0647_\u0628\u0627\u0644\u0631\u062F_\u0639\u0644\u0649_\u0627\u0633\u0628\u0627\u0628_\u0627\u0644\u0637\u0639\u0646_\u0628\u0627\u0644\u0646\u0642\u0636_\u0627\u064A\u062C\u0627\u0631\u0627\u062A.doc"],
  ["1EnQYfQM49A-fL8quWGbFbfvNc0Quj3c9", "27\u0645\u0630\u0643\u0631\u0629 \u062A\u062D\u0643\u064A\u0645 \u0627\u064A\u062C\u0627\u0631\u0627\u062A.doc"],
  ["1EjSCN0_CCyFiuX0keRgO2ttpIkEejr5q", "28\u0645\u0630\u0643\u0631\u0629 \u062A\u062D\u0643\u064A\u0645 \u0627\u064A\u062C\u0627\u0631\u0627\u062A28.doc"],
  ["1EhIMWr_lsDZp0u0RHqVh7X8MZuTOhEYV", "29\u0645\u0630\u0643\u0631\u0647 \u0627\u064A\u062C\u0627\u0631\u0627\u062A.doc"],
  ["1EgnuKwlIqCuwZ7KCP7g82V7xJNCRVdPv", "31\u0645\u0630\u0643\u0631\u0647 \u0627\u064A\u062C\u0627\u0631\u0627\u062A.doc"],
  ["1EgdV03anL9QvQrZpta4TrX3JJs9zmnGY", "35\u0645\u0630\u0643\u0631\u0647_\u0628\u0627\u0644\u0631\u062F_\u0639\u0644\u0649_\u0627\u0633\u0628\u0627\u0628_\u0637\u0639\u0646_\u0628\u0627\u0644\u0646\u0642\u0636_\u0627\u064A\u062C\u0627\u0631\u0627\u062A.doc"],
  ["1EOPSwAFr2kT1-dALD8PkO238imA0J6qv", "7\u0645\u0630\u0643\u0631\u0629 \u0637\u0639\u0646 \u0645\u062F\u0646\u0649 \u0627\u064A\u062C\u0627\u0631\u0627\u062A  \u0627\u0644\u0627\u0642\u0627\u0645\u0647.doc"],
  ["1EMTROfvPPv5VLgQefYSVrzTHDxm0kZLN", "8\u0645\u0630\u0643\u0631\u0647 \u0627\u064A\u062C\u0627\u0631\u0627\u062A.doc"],
  ["1EMErjDgF6H8s9IK0JKRnVOgTDXw4KF6K", "9\u0645\u0630\u0643\u0631\u0647_\u0627\u064A\u062C\u0627\u0631\u0627\u062A_\u062B\u0628\u0648\u062A_\u0627\u0646_\u0627\u0644\u0639\u0644\u0627\u0642\u0647_\u062A\u062E\u0636\u0639_\u0644\u0642\u0648\u0627\u0646\u064A\u0646_\u0627\u064A\u062C\u0627\u0631_\u0627\u0644\u0627\u0645\u0627\u0643\u0646.doc"],
  ["1ELCAoj9kjlgYRIwG93jxmpGnbvj5dfzC", "\u0623\u0634\u0647\u0631_\u0645\u0631\u0627\u0641\u0639\u0627\u062A_\u0627\u0644\u0646\u064A\u0627\u0628\u0629_\u0627\u0644\u0639\u0627\u0645\u0629_\u0641\u064A_\u0627\u0644\u0642\u0627\u0646\u0648\u0646_\u0627\u0644\u064A\u0645\u0646\u064A_\u062A\u0623\u0644\u064A\u0641_\u0627\u0644\u0642\u0627\u0636\u064A_\u062E\u0627\u0644\u062F.pdf"],
  ["1E-JodUIf4Z09yuiS9NMFqQfztePy3-gp", "\u0627\u0630\u0646 \u0628\u062A\u0633\u0644\u064A\u0645.docx"],
  ["1DxsafT8wWjrzIZLJPUo362V6E_3FMU9L", "\u0627\u0633\u062A\u0626\u0646\u0627\u0641_\u0627\u064A\u062C\u0627\u0631\u0627\u062A_\u0627\u0644\u0627\u0645\u062A\u062F\u0627\u062F_\u0627\u0642\u0627\u0646\u0648\u0646\u0649_\u0628\u0639\u062F_\u0648\u0641\u0627\u0629_\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631_\u0627\u0644\u0627\u0635\u0644\u0649.doc"],
  ["1DsHeDqYw-7tQlIwubV0kM3sTdz0A_RrK", "\u0627\u0642\u0631\u0627\u0631\u0648\u062A\u0646\u0627\u0632\u0644_\u0639\u0646_\u0645\u0646\u0632\u0644_\u0628\u0635\u0641\u062A\u0647_\u0627\u062D\u062F_\u0627\u0644\u0648\u0631\u062B\u0629.doc"],
  ["1Dqa40RWIIQd3hIMGVwjgnidGDN-SCnum", "\u0627\u0644\u0625\u0628\u0644\u0627\u063A-\u0628\u0648\u0642\u0648\u0639-\u062C\u0631\u064A\u0645\u0629 (1).pdf"],
  ["1DnxUdScM3CcsEz95_ovNZipTTS-QeIma", "\u0627\u0644\u062A\u0638\u0644\u0645-\u0645\u0646-\u0627\u0644\u0623\u0648\u0627\u0645\u0631-\u0627\u0644\u0648\u0642\u062A\u064A\u0629.pdf"],
  ["1DmcJbR134wEqks16pPi0nGacEv2uLI7j", "\u0627\u0644\u062A\u0646\u0641\u064A\u0630-\u0627\u0644\u062C\u0628\u0631\u064A-\u0648\u0627\u0644\u062A\u0646\u0641\u064A\u0630-\u0627\u0644\u0645\u0639\u062C\u0644.pdf"],
  ["1DhGNt-FqDJF4XDkmZ5paFFE23ue8qUae", "\u0627\u0644\u0635\u0644\u062D-\u0641\u064A-\u0627\u0644\u062E\u0635\u0648\u0645\u0629.pdf"],
  ["1D_ymILjBSPedKxpwW4nPzQJYOlAeU_HV", "\u0627\u0644\u0637\u0644\u0628 \u0628\u0627\u0644\u0627\u0645\u062A\u0646\u0627\u0639.pdf"],
  ["1DVySfynpU2nZ1nbMHF_VyGt6eI5ByzdQ", "\u0627\u0644\u0637\u0644\u0628-\u0628\u0627\u0644\u0627\u0645\u062A\u0646\u0627\u0639.pdf"],
  ["1DPgQKEl-dOmNLyt87giXvPVDGz-peyoH", "\u0627\u064A\u062C\u0627\u0631\u0627\u062A_\u0645\u0646_\u0627\u0644\u0645\u0642\u0631\u0631_\u0627\u0646_\u0627\u0644\u0628\u064A\u0646\u0629_\u0639\u0644\u0649_\u0645\u0646_\u0627\u062F\u0639\u0649_\u062E\u0644\u0627\u0641_\u0627\u0644\u062B\u0627\u0628\u062A_\u0627\u0635\u0644\u0627_\u0627\u0648_\u0639\u0631\u0636\u0627.doc"],
  ["1DMxT3JRbX7jzQTsV78aeh3qJeVsPDp0Z", "\u062A\u0638\u0644\u0645 \u0645\u0646 \u0623\u0645\u0631 \u0627\u0644\u0623\u062F\u0627\u0621.pdf"],
  ["1DC-_FmiOgyAPJdcjEU3fsX0RPotZi11W", "\u062D\u0642 \u0627\u0644\u0637\u0631\u064A\u0642 \u0627\u0644\u062E\u0627\u0635.docx"],
  ["1DAwIaOGOl0iVwYJD7r2o01W9csVySoHH", "\u062F\u0639\u0627\u0648\u0649 \u0627\u0644\u062E\u0637\u0628\u0629 \u0648\u0639\u0642\u0648\u062F \u0627\u0644\u0632\u0648\u0627\u062C.pdf"],
  ["1D9mWnav_l2bfuCmOGdrn8kKfGCNooi6G", "\u062F\u0639\u0627\u0648\u0649_\u0625\u062B\u0628\u0627\u062A_\u0627\u0644\u0631\u0628\u062D_\u0623\u0648_\u0637\u0628\u064A\u0639\u0629_\u0627\u0644\u0645\u0627\u0644_\u0639\u0646\u062F_\u0627\u0644\u0627\u062E\u062A\u0644\u0627\u0641.pdf"],
  ["1D82KdPDL7Her1eaN2qRLlX6KV79FLdvn", "\u062F\u0639\u0648\u0649 \u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0627\u0644\u062D\u064A\u0627\u0632\u0629 (1).pdf"],
  ["1D7uDwiGVOLzDtWbrVHTL2xD4fuRKHhgS", "\u062F\u0639\u0648\u0649 \u0627\u0639\u062A\u0631\u0627\u0636-  \u0627\u0644\u062F\u0641\u0639.pdf"],
  ["1CqzBd9tWJXseJhKxe9LHmSm7asx3QcDZ", "\u062F\u0639\u0648\u0649 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0641\u064A \u0627\u0644\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u064A\u0645\u0646\u064A.doc"],
  ["1CiZxzo9r0FGXrw1uD9-dcFknDnFQtvVj", "\u062F\u0639\u0648\u0649 \u0627\u0644\u0628\u0637\u0644\u0627\u0646 (1) (1).pdf"],
  ["1Ccn7VFX4IKS5u2F32LYZ0q-O5Gg_ZoHI", "\u062F\u0639\u0648\u0649 \u0627\u0644\u062A\u0639\u0648\u064A\u0636.doc"],
  ["1CUQcBzCYkQhB-kXXud3xM6WcOslGd4JR", "\u062F\u0639\u0648\u0649 \u0627\u0644\u0642\u0627\u064A\u0641\u064A.pdf"],
  ["1CLg6zRnVej5cxuDu7HtIrq8Koiq5Hr_8", "\u062F\u0639\u0648\u0649 \u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u0623\u062C\u0631 \u0627\u0644\u062D\u0627\u0631\u0633 (\u0627\u0644\u0639\u062F\u0644).pdf"],
  ["1C7FOPbgnj6Z4SAOoUGa_IwyAhnXcucPa", "\u062F\u0639\u0648\u0649 \u0628\u0627\u0644\u062D\u0642 \u0627\u0644\u0634\u062E\u0635\u064A.pdf"],
  ["1C5ssgxCbHkkWJCCQiNpo1_YqOIPAjI3T", "\u062F\u0639\u0648\u0649 \u0628\u062D\u0642 \u0645\u062F\u0646\u064A.doc"],
  ["1C4im-fTuI1sjJlEyxncnhZwDlPmIqB4i", "\u062F\u0639\u0648\u0649 \u0634\u062E\u0635\u064A\u0629 \u0645\u062F\u0646\u064A\u0629 \u062C\u0646\u0627\u0626\u064A\u0629 \u0645\u0631\u0642\u0645\u0629.pdf"],
  ["1C1c4Fx699HYe3kQQvHgiZeP7ma6L7u0J", "\u062F\u0639\u0648\u0649 \u0641\u0633\u062E \u0627\u062D\u0645\u062F \u0627\u0644\u063A\u0634\u0645-1.docx"],
  ["1ByWq3j1cx3mrH5V3wk4egYXolN2zOI67", "\u062F\u0639\u0648\u0649 \u0645\u0633\u062A\u0639\u062C\u0644\u0647 \u0628\u0637\u0644\u0628 \u0627\u0646\u0647\u0627\u0621 \u062D\u0631\u0627\u0633\u0647.doc"],
  ["1BvdCa2TT9xAzxvhMCkEhfkCnADvbZnbM", "\u062F\u0639\u0648\u0649 \u0645\u0633\u062A\u0639\u062C\u0644\u0647 \u0644\u0633\u0645\u0627\u0639 \u0634\u0627\u0647\u062F.doc"],
  ["1BtaO5eKG1NIH5ZbxExXgyv5h1o4AUFCX", "\u062F\u0639\u0648\u0649 \u0645\u0633\u062A\u0639\u062C\u0644\u0647.doc"],
  ["1Bt3DJEed79R4vSQzMI70SGKaUUmuDR-g", "\u062F\u0639\u0648\u0649 \u0645\u0637\u0627\u0644\u0628\u0629 \u0628\u062F\u064A\u0646 \u062A\u062C\u0627\u0631\u064A.doc"],
  ["1BrniySfdsn25nyFRlKAq6lO-dIviW6jp", "\u062F\u0639\u0648\u0649 \u0646\u0634\u0648\u0632.doc"],
  ["1BgopGcB-9W24VdeobVHKzlhUOtqJuthz", "\u062F\u0639\u0648\u0649 \u0646\u0641\u0642\u0629.doc"],
  ["1JTH4T5KDOA7gWIWH5yzvYEVq5QvsV6pD", "\u062F\u0639\u0648\u0649-\u0628\u0637\u0644\u0627\u0646-\u062D\u0643\u0645-\u0645\u062D\u0643\u0645.pdf"],
  ["1BeCSGV5TXWoYpmYkwQ4DSV7oOEirG3HK", "\u062F\u0639\u0648\u0649_\u0627\u0644\u062A\u0639\u0648\u064A\u0636_\u0639\u0646_\u0627\u0644\u062A\u0645\u064A\u064A\u0632_\u0641\u064A_\u0627\u0644\u062E\u062F\u0645\u0627\u062A_\u0623\u0648_\u0627\u0644\u0623\u062C\u0648\u0631_\u0641\u064A_\u062D\u0627\u0644\u0629_\u0627\u0644\u0627\u062D\u062A\u0643\u0627\u0631 (1).pdf"],
  ["1Bd9dXno0XCegY6f1T6Y682rmjjsubdjy", "\u062F\u0639\u0648\u0649_\u0627\u0644\u062A\u0639\u0648\u064A\u0636_\u0639\u0646_\u0627\u0644\u062A\u0645\u064A\u064A\u0632_\u0641\u064A_\u0627\u0644\u062E\u062F\u0645\u0627\u062A_\u0623\u0648_\u0627\u0644\u0623\u062C\u0648\u0631_\u0641\u064A_\u062D\u0627\u0644\u0629_\u0627\u0644\u0627\u062D\u062A\u0643\u0627\u0631.pdf"],
  ["1BVdI1FF3pZiWrLVUVwrb_Jp6W5jauIsa", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u0627\u0633\u062A\u0644\u0627\u0645_\u0627\u0644\u0639\u0645\u0644_\u0623\u0648_\u0627\u0639\u062A\u0628\u0627\u0631_\u0627\u0644\u0639\u0645\u0644_\u0645\u0633\u0644\u0645\u064B\u0627.pdf"],
  ["1BIK3HmbbpuHG-IrD92mbnl8akEmvH0Ye", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u0627\u0644\u0623\u062C\u0631_\u0648\u0627\u0644\u0646\u0641\u0642\u0627\u062A_\u0648\u0627\u0644\u062A\u0639\u0648\u064A\u0636_\u0639\u0646\u062F_\u062A\u0644\u0641_\u0627\u0644\u0634\u064A\u0621_\u0627\u0644\u0645\u0642\u0627\u0648\u0644_\u0639\u0644\u064A\u0647.pdf"],
  ["1B2xUGy1iyzU8rRt723HnBfgotopPHWSv", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u0627\u0644\u062A\u0639\u0648\u064A\u0636_\u0639\u0646_\u0641\u0633\u062E_\u0631\u0628_\u0627\u0644\u0639\u0645\u0644_\u0644\u0644\u0639\u0642\u062F.pdf"],
  ["1B2vng5gyflh1wTruH0lj4d-d_hz1zsPh", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u062A\u0639\u0648\u064A\u0636_\u0648\u0631\u062B\u0629_\u0627\u0644\u0645\u0642\u0627\u0648\u0644_\u0623\u0648_\u062A\u0633\u0644\u064A\u0645_\u0627\u0644\u0645\u0648\u0627\u062F_\u0648\u0627\u0644\u0631\u0633\u0648\u0645.pdf"],
  ["1B2UOWQ3m-9rZH93OJASot4l3B4V0zK95", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u062A\u0639\u064A\u064A\u0646_\u0627\u0644\u062D\u0627\u0631\u0633_\u0627\u0644\u0639\u062F\u0644_\u0623\u0648_\u0639\u0632\u0644\u0647.pdf"],
  ["1AyjUtA-eMwaltst9UCC9SrN66fVqqB_W", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u062A\u0639\u064A\u064A\u0646_\u0635\u0627\u062D\u0628_\u0627\u0644\u0648\u062F\u064A\u0639\u0629_\u0623\u0648_\u0642\u0633\u0645\u062A\u0647\u0627.pdf"],
  ["1ArsqdGAQ7GO55M-WBaG8WGmLvPWmtomw", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u0631\u062F_\u0627\u0644\u0648\u062F\u064A\u0639\u0629_\u0623\u0648_\u0642\u064A\u0645\u062A\u0647\u0627.pdf"],
  ["1ApgRU_FwgJkcwECeQBvauTrJvmracg_M", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u0636\u0645\u0627\u0646_\u0627\u0644\u062D\u0627\u0631\u0633_\u0627\u0644\u0639\u062F\u0644_\u0623\u0648_\u0627\u0644\u062A\u0639\u0648\u064A\u0636_\u0639\u0646_\u0625\u0647\u0645\u0627\u0644\u0647.pdf"],
  ["1AmctzMOnO5G-UkeNedbMdUugw-pTeefj", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u0636\u0645\u0627\u0646_\u0627\u0644\u0641\u0646\u0627\u062F\u0642_\u0648\u0645\u0627_\u064A\u0645\u0627\u062B\u0644\u0647\u0627_\u0639\u0646_\u0633\u0631\u0642\u0629_\u0623\u0648_\u0636\u064A\u0627\u0639_\u0623\u0648_\u062A\u0644\u0641_\u0627\u0644\u0623\u0634\u064A\u0627\u0621.pdf"],
  ["1AlX5PMGoHBDg3a1NyDVdPYsOXxSd_v9Y", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u0636\u0645\u0627\u0646_\u0627\u0644\u0645\u062A\u0633\u0628\u0628_\u0641\u064A_\u0639\u0632\u0644_\u0627\u0644\u0648\u0643\u064A\u0644_\u0625\u0630\u0627_\u062A\u0639\u0644\u0642_\u0628\u0627\u0644\u0648\u0643\u0627\u0644\u0629_\u062D\u0642_\u0644\u0644\u063A\u064A\u0631.pdf"],
  ["1AhEl9zSQe6VoKB7z6tHjzTk0F6pmcD_j", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u0636\u0645\u0627\u0646_\u0627\u0644\u0648\u062F\u064A\u0639\u0629_\u0623\u0648_\u0627\u0644\u062A\u0639\u0648\u064A\u0636_\u0639\u0646_\u062A\u0644\u0641\u0647\u0627.pdf"],
  ["1AKO2LqTZWZvMVx5c_sCqbOPYJyCUNFKY", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u0636\u0645\u0627\u0646_\u0627\u0644\u0648\u0643\u064A\u0644_\u0644\u0645\u0627_\u062A\u0644\u0641_\u0623\u0648_\u0636\u0627\u0639_\u0623\u0648_\u0645\u0627_\u0642\u0628\u0636\u0647_\u0645\u0646_\u062B\u0645\u0646.pdf"],
  ["1AJnqvdLYPbL8USFWET8Ed0lOLikhiQ-M", "\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u0637\u0627\u0644\u0628\u0629_\u0628\u0645\u0633\u0624\u0648\u0644\u064A\u0629_\u0627\u0644\u0645\u0642\u0627\u0648\u0644_\u0627\u0644\u0623\u0635\u0644\u064A_\u0639\u0646_\u0639\u0645\u0644_\u0627\u0644\u0645\u0642\u0627\u0648\u0644_\u0645\u0646_\u0627\u0644\u0628\u0627\u0637\u0646.pdf"],
  ["1J_7rb8f7kH7DyTul8dfRe4u-czxxBkmt", "\u062F\u0639\u0648\u0649_\u0645\u0633\u062A\u0639\u062C\u0644\u0647_\u0628\u0627\u0634\u0643\u0627\u0644_\u0641\u0649_\u062A\u0646\u0641\u064A\u0630_\u062D\u0643\u0645_\u0628\u0627\u0644\u062A\u0635\u062F\u064A\u0642_\u0639\u0644\u0649_\u0635\u0644\u062D.doc"],
  ["1JMqCJG6wjS1GbjUFnqZJV94P5kD8DpkK", "\u062F\u0639\u0648\u064A_\u0628\u0631\u0641\u0639_\u064A\u062F_\u0627\u0644\u063A\u0627\u0635\u0628_\u0648\u0625\u0632\u0627\u0644\u0629_\u0627\u0644\u0639\u062F\u0648\u0627\u0646_.pdf"],
  ["1JJoorQLVGs-J5UcJPBuwHkLz7Hzx3dI0", "\u062F\u0641\u0639 \u0628\u0627\u0644\u062C\u0647\u0627\u0644\u0629 - \u0627\u0644\u062D\u0631\u0628\u064A.pdf"],
  ["1JHturiQEGUije4gTBDv4zPkuhz9CiVHG", "\u062F\u0641\u0639 \u0628\u0627\u0644\u062C\u0647\u0627\u0644\u0629 - \u0627\u0644\u0639\u064A\u0648\u064A.pdf"],
  ["1J-3gIlkUMFIcWLlj09FXvF6nfkS8GQoz", "\u062F\u0641\u0639 \u0628\u0639\u062F\u0645 \u0627\u0644\u062C\u0631\u064A\u0645\u0629.pdf"],
  ["1Is8IhlJviHfMwtkPRNh9NH2WbWIToeAg", "\u062F\u0641\u0639 \u0628\u0641\u0648\u0627\u062A \u0627\u0644\u0645\u062F\u0629.pdf"],
  ["1Iq1T9AWuvfp0ZNThnY8t9qUYiBSZpkRV", "\u062F\u0641\u0639 \u0642\u0627\u0646\u0648\u0646\u064A 000.doc"],
  ["1ImRTmXWr4OJ1YZTxurXpqJRXtvNSdfcT", "\u062F\u0641\u0639 \u0642\u0627\u0646\u0648\u0646\u064A.doc"],
  ["1IgWFGYoYtUhrtKOlYCxizy4oGjdZGmR8", "\u062F\u0641\u0648\u0639 \u0642\u0627\u0646\u0648\u0646\u064A\u0629.doc"],
  ["1IbfKDNIVTOXUJ0LA-Nx_L_drx3Hatv2g", "\u0631\u062F \u0627\u0644\u0645\u062F\u0639\u064A.doc"],
  ["1IVbN4wxSZXnxwEBGizYB_Vi2OP1e-UfB", "\u0631\u062F \u0639\u0644\u0649 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0637\u0628\u064A.pdf"],
  ["1IT7guCx-YD1YbZW3oA1tXAK2wHXJYtQC", "\u0631\u062F \u0639\u0644\u0649 \u0627\u0644\u062F\u0641\u0639.doc"],
  ["1IKzywLefFwr8T8YNsLlLUnB2UP--9e-h", "\u0631\u062F \u0639\u0644\u0649 \u0627\u0644\u0634\u0647\u0648\u062F - 2.docx"],
  ["1IJWElXeyWpLhhsY5fUKdpS7ayyzf8996", "\u0631\u062F \u0639\u0644\u0649 \u0637\u0644\u0628.doc"],
  ["1IIBugluR9dti5qqLigHmLENOG_Lwfegz", "\u0631\u0641\u0639_\u0627\u0644\u062F\u0639\u0648\u0649_\u0627\u0644\u0645\u062F\u0646\u064A\u0629_\u0627\u0644\u062A\u0628\u0639\u064A\u0629_\u0644\u0644\u062F\u0639\u0648\u0649_\u0627\u0644\u062C\u0646\u0627\u0626\u064A\u0629_\u0645\u0645\u0646_\u0644\u062D\u0642\u0647_\u0636\u0631\u0631_\u0645\u0646_\u0627\u0644\u062C\u0631\u064A\u0645\u0629.pdf"],
  ["1I5DrhPscmhFszU2KWp6jexWGw5YE4nJJ", "\u0633\u0628 \u0648 \u0642\u0630\u0641.doc"],
  ["1I3uIFsJILXOUQmi1co7GV4dQB24HFXkg", "\u0634\u0643\u0648\u0649_\u0627\u0644\u0645\u062C\u0646\u064A_\u0639\u0644\u064A\u0647_\u0643\u0642\u064A\u062F_\u0641\u064A_\u0627\u0644\u0642\u0627\u0646\u0648\u0646_\u0627\u0644\u064A\u0645\u0646\u064A.pdf"],
  ["1I344cdcgcotgY5CupQEYFCzWPu3aZdfb", "\u0635\u062D\u064A\u0641\u0629 \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u062D\u0643\u0645 \u0623\u062D\u0648\u0627\u0644 \u0634\u062E\u0635\u064A\u0629.doc"],
  ["1I2Te6968Z-8HXrikv9GoCIBTyQE2eQ59", "\u0635\u064A\u0627\u063A\u0629 \u0627\u0644\u0639\u0642\u0648\u062F.docx"],
  ["1I-qmq69DmtymWnn5GH1XAmZScSimgU_A", "\u0635\u064A\u063A \u0642\u0627\u0646\u0648\u0646\u064A\u0629 \u0644\u0628\u0639\u0636 \u0627\u0644\u0639\u0642\u0648\u062F.docx"],
  ["1HrUJfqjtwoHYtk61BSLfWc51rM-tCjwr", "\u0635\u064A\u063A\u0629 \u0625\u0639\u0644\u0627\u0646 \u0625\u0646\u0647\u0627\u0621 \u0634\u0631\u0627\u0643\u0629.doc"],
  ["1HmisqU2o1WK2bfSZmlB3EicyySCDM8sg", "\u0635\u064A\u063A\u0629 \u0627\u0644\u062F\u0639\u0627\u0648\u064A \u0627\u0644\u0645\u0633\u062A\u0639\u062C\u0644\u0629 .pdf"],
  ["1HdVgtnfoyEZ3ZxsUL4D3yJyprbut9WBb", "\u0635\u064A\u063A\u0629 \u062A\u0635\u0641\u064A\u0629 \u0648\u0645\u062E\u0627\u0644\u0635\u0629 \u0646\u0647\u0627\u0626\u064A\u0629 \u0644\u0645\u0635\u0646\u0639.doc"],
  ["1HWYPnYWvuSE6ZuN1nsATgniIG2y8EjoL", "\u0635\u064A\u063A\u0629 \u062A\u0648\u0643\u064A\u0644 \u0623\u0648 \u062A\u0641\u0648\u064A\u0636.doc"],
  ["1HLgLSp55CYZbvNdzKzhLbb6PoPbe_KEB", "\u0635\u064A\u063A\u0629 \u062A\u0648\u0643\u064A\u0644 \u0631\u0633\u0645\u064A \u0639\u0627\u0645 (1).doc"],
  ["1HKy5_2wRJkzD1uDPCJaWvafe3mZrqQD0", "\u0635\u064A\u063A\u0629 \u062A\u0648\u0643\u064A\u0644 \u0631\u0633\u0645\u064A \u0639\u0627\u0645.doc"],
  ["1HDKpfL17XFHUoqKggjv8uwAhQWk7ZM0t", "\u0635\u064A\u063A\u0629 \u062A\u0648\u0643\u064A\u0644 \u0634\u0631\u0639\u064A.doc"],
  ["1HAnc6QupoWY63s6_hXnQVKrCKUBCrWQL", "\u0635\u064A\u063A\u0629 \u062A\u0648\u0643\u064A\u0644 \u0644\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0631\u062E\u064A\u0635 \u0648\u0627\u0644\u0633\u062C\u0644.doc"],
  ["1H-gJUyeaSpCXjAEUPr6IgLDjCiWS_6j4", "\u0635\u064A\u063A\u0629 \u062A\u0648\u0643\u064A\u0644.doc"],
  ["1GrQ8ynyiS89z56vAIDC-BXijxCJAXCdo", "\u0635\u064A\u063A\u0629 \u0635\u0644\u062D \u0648\u0645\u062E\u0627\u0644\u0635\u0629 \u0646\u0647\u0627\u0626\u064A\u0629 1.doc"],
  ["1GclYBrTyMY3i5Ey1pwam6LmfSL8bVeEp", "\u0635\u064A\u063A\u0629 \u0635\u0644\u062D \u0648\u0645\u062E\u0627\u0644\u0635\u0629 \u0646\u0647\u0627\u0626\u064A\u0629 2.doc"],
  ["1GMKNVQDrun5otJvtV564CQTLy9teNt8Q", "\u0635\u064A\u063A\u0629 \u0637\u0644\u0628 \u0634\u0637\u0628 \u0642\u0636\u064A\u0629 \u0634\u064A\u0643 \u0628\u062F\u0648\u0646 \u0631\u0635\u064A\u062F (1).doc"],
  ["1GHwe3CREcWhbZNF4TR6RmQAJozTjO5i3", "\u0635\u064A\u063A\u0629 \u0637\u0644\u0628 \u0634\u0637\u0628 \u0642\u0636\u064A\u0629 \u0634\u064A\u0643 \u0628\u062F\u0648\u0646 \u0631\u0635\u064A\u062F.doc"],
  ["1GBQyEND8E1ilmTOzSKLxARcvrFeNqlHD", "\u0635\u064A\u063A\u0629 \u0639\u0631\u0636 \u0628\u0625\u0646\u0634\u0627\u0621 \u0634\u0631\u0643\u0629 1.doc"],
  ["1G33ig-NbXpoG3Mi0Jvuqtgky1REnQDf4", "\u0635\u064A\u063A\u0629 \u0639\u0631\u0636 \u0628\u0625\u0646\u0634\u0627\u0621 \u0634\u0631\u0643\u0629 2.doc"],
  ["1G1R5t47pAeurGKc-1OijyYIvypRi6OrL", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0623\u062F\u0627\u0621 \u0639\u0645\u0644.doc"],
  ["1FsUJ1_Ig99vpmNZWmGTOny9WLzUSjwGP", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0627\u0633\u062A\u062B\u0645\u0627\u0631.doc"],
  ["1FmBHWZSs4yAG60bV0Lb485SoiyUVt7nz", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0628\u064A\u0639 \u0623\u0631\u0636 \u0632\u0631\u0627\u0639\u064A\u0629.doc"],
  ["1FZD8yFbSYt2AUJ3vUG7Fb8WBb2GhsaPM", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0628\u064A\u0639 \u062D\u0635\u0629 \u0634\u0627\u0626\u0639\u0629 \u0641\u064A \u0639\u0642\u0627\u0631.doc"],
  ["1FWkQtmigeZgMhrflo4k1zeVzWKMfO6Ke", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0628\u064A\u0639 \u062D\u0642 \u0627\u0644\u0625\u0646\u062A\u0641\u0627\u0639.doc"],
  ["1FSZxU_EcJ_DLqVDLjti58t7osMMPiJqL", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u062A\u0642\u0628\u064A\u0644 \u0645\u062D\u0644 \u062A\u062C\u0627\u0631\u064A.doc"],
  ["1FLAWsj6tIKgfeXeVXzjDXb4tXG_y-nEx", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u062A\u0645\u062B\u064A\u0644.doc"],
  ["1FJvrDX1uXmNK9tyT6vz4IeCd8ztGQBtV", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0634\u0631\u0627\u0643\u0640\u0629.doc"],
  ["1FEEFrP8GnG1uYr-pOndJocEaHK87Q0-K", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0635\u0644\u062D.doc"],
  ["1N0mrFHdz_3ig0riV6cRlLm2snUpfdZ1W", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0639\u0645\u0644 1.doc"],
  ["1N0HxhWksRdYLwHG_rhEKe0kZpzBTd5k7", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0639\u0645\u0644 2.doc"],
  ["1N-_rd6rHJ32DiWfNAsXeOS6pnNVqeiUx", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0639\u0645\u0644 \u0648\u0627\u0633\u062A\u062E\u062F\u0627\u0645-Arabic-English- (1).doc"],
  ["1Myl2Co49BSQ4jz6zF27W7-cJQNs1oJIl", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0639\u0645\u0644 \u0648\u0627\u0633\u062A\u062E\u062F\u0627\u0645-Arabic-English-.doc"],
  ["1MszBiNX6tYCSX8Xh8hkS1q_8i3CgIhXH", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0639\u0645\u0644-Arabic-English-.doc"],
  ["1MqPNFeBy7NLA4R4kpqCzgUixpMTLNgq4", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0642\u0633\u0645\u0629.doc"],
  ["1MRaM9PWSZ4C3Z-dZPyMTn4l8EamGK3XD", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0645\u062D\u0627\u0645\u0627\u0629 1.doc"],
  ["1MIi4nuxU5dgqLtSfuTwsffqftaZpWHKf", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0645\u062D\u0627\u0645\u0627\u0629 2.doc"],
  ["1MIgRfHen5TL7h9qvH1cPPeBiZVLHV1uC", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0646\u0642\u0644 \u0623\u0634\u062E\u0627\u0635 (1).doc"],
  ["1MFrQBZPyMhkMOzCe7Y0u7GvK_YPw0cLs", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0646\u0642\u0644 \u0623\u0634\u062E\u0627\u0635.doc"],
  ["1M-uOw_zRY-sOOqaGODYtpCV0WEXeDj2i", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0646\u0642\u0644 \u0628\u0636\u0627\u0626\u0639.doc"],
  ["1Ly0QfrmUlKtju-rr2VJop9RDiZpaaY58", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0646\u0642\u0644 \u062A\u0643\u0646\u0648\u0644\u0648\u062C\u064A\u0627.doc"],
  ["1Lw4xrCrpSFl0vilsIYVDVpvier3lpwIO", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0648\u0643\u0627\u0644\u0629 \u062A\u062C\u0627\u0631\u064A\u0629 1.doc"],
  ["1Ls2oVImxHU9ZpEz0SW84ZY07x-ttpivZ", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0648\u0643\u0627\u0644\u0629 \u062A\u062C\u0627\u0631\u064A\u0629 2.doc"],
  ["1LcyS4iTfq4LYDRazAv35lU9BQewYCTmW", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0648\u0643\u0627\u0644\u0629 \u0648\u0645\u062D\u0627\u0645\u0627\u0629 1.doc"],
  ["1LWg5D0q3xmZRrPLCg8vW7E9Lqy8NSKgB", "\u0635\u064A\u063A\u0629 \u0639\u0642\u062F \u0648\u0643\u0627\u0644\u0629 \u0648\u0645\u062D\u0627\u0645\u0627\u0629 2.doc"],
  ["1L04d8fWG0xUr4QvVH4YPCNqovxmckM1g", "\u0635\u064A\u063A\u0629 \u0642\u0636\u064A\u0629 \u0634\u064A\u0643 \u0628\u062F\u0648\u0646 \u0631\u0635\u064A\u062F 1.doc"],
  ["1L-s5G8bpV2kuWXeTMpa4teiybOIQzZGp", "\u0635\u064A\u063A\u0629 \u0642\u0636\u064A\u0629 \u0634\u064A\u0643 \u0628\u062F\u0648\u0646 \u0631\u0635\u064A\u062F 2 (1).doc"],
  ["1Kz_5XGbgcisZpJvhiNiXVYR-4LR97bjo", "\u0635\u064A\u063A\u0629 \u0642\u0636\u064A\u0629 \u0634\u064A\u0643 \u0628\u062F\u0648\u0646 \u0631\u0635\u064A\u062F 2 (2).doc"],
  ["1KyTV_-yVzBgI4wUwocUjfx4wIlbW7xXM", "\u0635\u064A\u063A\u0629 \u0642\u0636\u064A\u0629 \u0634\u064A\u0643 \u0628\u062F\u0648\u0646 \u0631\u0635\u064A\u062F 2.doc"],
  ["1KtJPxVh462yZY3KLm4ez6aTeca69LmcW", "\u0635\u064A\u063A\u0629 \u0643\u0641\u0627\u0644\u0629.doc"],
  ["1Kk9NOzJqjM4kFxvXGP_Auhd-dRTZRG0S", "\u0635\u064A\u063A\u0629 \u0646\u0645\u0648\u0630\u062C \u0644\u0635\u062D\u064A\u0641\u0629 \u0625\u0634\u0643\u0627\u0644 \u0645\u0646 \u0627\u0644\u063A\u064A\u0631.doc"],
  ["1KhQs3zGmUOeKy_TpmnX8hV0v1_iUbaVl", "\u0635\u064A\u063A\u0629 \u0648\u0635\u064A\u0629 \u0628\u0633\u0647\u0645 \u0634\u0627\u0626\u0639 \u0641\u0649 \u0627\u0644\u062A\u0631\u0643\u0629.docx"],
  ["1KeN1-tyUPTfnxJzbq1XnN25vZCmj1fIw", "\u0635\u064A\u063A\u0629 \u0648\u0635\u064A\u0629 \u0639\u0627\u0645\u0629 \u0644\u0634\u062E\u0635 \u0648\u0627\u062D\u062F.docx"],
  ["1Kamw1jUn8cxYLh3DBkbNjQn8vOdHvfS7", "\u0635\u064A\u063A\u0629_\u0625\u0642\u0631\u0627\u0631_\u0645\u062E\u0627\u0644\u0635\u0629_\u0648\u0628\u0631\u0627\u0621\u0629_\u0630\u0645\u0629_english (1).doc"],
  ["1K_endi4XMRJOwSaM_pnlkYfY4WInAR3M", "\u0635\u064A\u063A\u0629_\u0625\u0642\u0631\u0627\u0631_\u0645\u062E\u0627\u0644\u0635\u0629_\u0648\u0628\u0631\u0627\u0621\u0629_\u0630\u0645\u0629_english (2).doc"],
  ["1KXVmMTS44vN2LNLyEf32pFHqoJyQXsIh", "\u0635\u064A\u063A\u0629_\u0625\u0642\u0631\u0627\u0631_\u0645\u062E\u0627\u0644\u0635\u0629_\u0648\u0628\u0631\u0627\u0621\u0629_\u0630\u0645\u0629_english.doc"],
  ["1K8DUbkgpJr4QNCVl5-wJw7VyakvXY-Ep", "\u0635\u064A\u063A\u0629_\u0639\u0642\u062F_\u0628\u064A\u0639_\u062D\u0635\u0629_\u0641\u064A_\u0627\u0644\u062A\u0631\u0643\u0629_\u0644\u0628\u0627\u0642\u064A.doc"],
  ["1K655rhHexyw50JafB3ODhj0FJO-CG04L", "\u0635\u064A\u063A\u0629_\u0648\u0635\u064A\u0629_\u0645\u0628\u062A\u0643\u0631\u0629.doc"],
  ["1K0FuUlsjpMWx_ZDO_l-DAe6qHUghdEjg", "\u0635\u064A\u063A\u0647 \u0637\u0644\u0628 \u0644\u0625\u0633\u062A\u0635\u062F\u0627\u0631 \u0623\u0645\u0631 \u0627\u0644\u0623\u062F\u0627\u0621.doc"],
  ["1JwxAPRYU30VHt3R0GsObpHMAWRw-6srT", "\u0636\u0645\u0627\u0646\u0629 \u0639\u0644\u0649 \u0627\u0644\u0639\u0627\u0645\u0644 \u0641\u064A \u0645\u062D\u0644 \u0627\u0644\u062C\u0645\u0644\u0629.docx"],
  ["1Jw-CNmrltkoGRoZX0WIWr5GkPCXIO31h", "\u0637\u0644\u0628 \u0623\u0645\u0631 \u0627\u0644\u0623\u062F\u0627\u0621.pdf"],
  ["1JvhK4H-TiZIWiR7cgyDXQpV4nwy5KtlW", "\u0637\u0644\u0628 \u0623\u0645\u0631 \u0639\u0644\u0649 \u0639\u0631\u064A\u0636\u0629.pdf"],
  ["1JugjiHbFgZYfC_Sb5D8oSp39cWshgIxR", "\u0637\u0644\u0628 \u0627\u0644\u062A\u0627\u062C\u0631 \u0634\u0647\u0631 \u0625\u0641\u0644\u0627\u0633 \u0646\u0641\u0633\u0647.pdf"],
  ["1Ju7u-7g2PPyoNDML9G4bNMy_iICu4Edp", "\u0637\u0644\u0628 \u0628\u064A\u0639 \u0627\u0644\u0645\u0646\u0642\u0648\u0644 \u0623\u0648 \u0627\u0644\u0639\u0642\u0627\u0631.pdf"],
  ["1Jr7Mg6Nhcdkj9O-Zdonk0F_g5XJwwaqX", "\u0637\u0644\u0628 \u062A\u062D\u0631\u064A\u0643 \u0627\u0644\u062F\u0639\u0648\u0649.pdf"],
  ["1JpwhOIHmFhoZ_IsBSMnVoDxbIfNDFaOc", "\u0637\u0644\u0628 \u062A\u0635\u062D\u064A\u062D \u062D\u0643\u0645.pdf"],
  ["1Joz28plg7ekQfKcwM3-SGyuwteH-Wtdu", "\u0637\u0644\u0628 \u062A\u063A\u064A\u0631 \u0627\u0633\u0645.doc"],
  ["1JmMPgnQ-23tLpXvCtZWNVZwvIrc59RrC", "\u0637\u0644\u0628 \u062A\u063A\u064A\u064A\u0631 \u0627\u0633\u0645.doc"],
  ["1JlfDOijrxsbTuWsht43xak3XsHAFfIUh", "\u0637\u0644\u0628 \u062A\u0642\u0633\u064A\u0645 \u062A\u0631\u0643\u0629 \u0648\u0641\u0631\u0632 \u062D\u0635\u0635.doc"],
  ["1JfTOLzT7kfHQBseNB-V4AndsNG2fhQCa", "\u0637\u0644\u0628 \u062A\u0642\u0633\u064A\u0645 \u062A\u0631\u0643\u0629.doc"],
  ["1JdEN6Q1oMG_iD9rb79NFMZePnDrenXs8", "\u0637\u0644\u0628 \u062A\u0646\u0641\u064A\u0630 \u062D\u0643\u0645 \u0642\u0636\u0627\u0626\u064A.pdf"],
  ["1JcoKd4iKcneiU9DpyxgNZvcau8Y5OhIn", "\u0637\u0644\u0628 \u0631\u062F \u0627\u0644\u0642\u0627\u0636\u064A \u0623\u0648 \u0639\u0636\u0648 \u0627\u0644\u0646\u064A\u0627\u0628\u0629.pdf"],
  ["1Rs5s0Jr0bfDbdt4nC4lKqkQs_-6QBFYf", "\u0637\u0644\u0628 \u0631\u062F \u0645\u062D\u0643\u0645.pdf"],
  ["1RqkqpM4_20OzsLwY_hD5TDWUTdsXePzO", "\u0637\u0644\u0628 \u0639\u0627\u0631\u0636.pdf"],
  ["1RoP4w2A2764STH5nXaOg3PZz1DxsVZ_U", "\u0637\u0644\u0628 \u0641\u062A\u062D \u0628\u0627\u0628 \u0627\u0644\u0645\u0631\u0627\u0641\u0639\u0647.doc"],
  ["1RnFtAeNbFQX9AdrKqTEI7olzrbaL2zRC", "\u0637\u0644\u0628 \u0641\u062A\u062D \u0645\u0633\u062A\u0646\u062F\u0649 \u063A\u064A\u0631 \u0642\u0627\u0628\u0644 \u0644\u0644\u0646\u0641\u0636.doc"],
  ["1RZoLA5k-TeD7P2dBXbRcwBVkPmnZLfbI", "\u0637\u0644\u0628 \u0645\u0646\u0639.docx"],
  ["1QsMFFMARZRk9f11hpmlMNm-51dYbigt9", "\u0637\u0644\u0628-\u0623\u0645\u0631-\u0639\u0644\u0649-\u0639\u0631\u064A\u0636\u0629.pdf"],
  ["1QmmTqwXuMgEpNJ-MeI1JWrDz9n2ZIOtG", "\u0637\u0644\u0628-\u0625\u0634\u0647\u0627\u0631-\u0625\u0641\u0644\u0627\u0633-\u0645\u062F\u064A\u0646.pdf"],
  ["1QipoY6Qyhnaq-BUpLhy9QLqX_Xg5tGvT", "\u0637\u0644\u0628-\u0625\u064A\u062F\u0627\u0639-\u062D\u0643\u0645-\u062A\u062D\u0643\u064A\u0645.pdf"],
  ["1QiBxuoaGhS3Kl5J3m560Qlwnwq7vx717", "\u0637\u0644\u0628-\u0627\u0644\u0625\u062F\u062E\u0627\u0644-\u0641\u064A-\u0627\u0644\u062E\u0635\u0648\u0645\u0629.pdf"],
  ["1QhfF_QkmSkID3ngzqGYctaXp4dvcFStc", "\u0637\u0644\u0628-\u0627\u0644\u062A\u0627\u062C\u0631-\u0634\u0647\u0631-\u0625\u0641\u0644\u0627\u0633-\u0646\u0641\u0633\u0647.pdf"],
  ["1QZ4SN-pNCaCKZL5FER4ImH8m1sntjA-V", "\u0637\u0644\u0628-\u0627\u0644\u062A\u0645\u0627\u0633-\u0625\u0639\u0627\u062F\u0629-\u0627\u0644\u0646\u0638\u0631.pdf"],
  ["1QXWtAjSeGdcA6c4Lf00vmQ1B_MvrHkmK", "\u0637\u0644\u0628-\u0628\u064A\u0639-\u0627\u0644\u0645\u0646\u0642\u0648\u0644-\u0623\u0648-\u0627\u0644\u0639\u0642\u0627\u0631.pdf"],
  ["1QXOTu_5Gf5t-89ng-PjHt9Z3qmwqOhX0", "\u0637\u0644\u0628-\u062A\u062D\u0631\u064A\u0643-\u0627\u0644\u062F\u0639\u0648\u0649.pdf"],
  ["1QT-ZKdFATxFFpy6sM0zeMZ1YkjbCUbGm", "\u0637\u0644\u0628-\u062A\u062F\u062E\u0644.pdf"],
  ["1QJjKWiL-CdldPVn9L3dnGqjqlYJy3OGG", "\u0637\u0644\u0628-\u062A\u0635\u062D\u064A\u062D-\u062D\u0643\u0645.pdf"],
  ["1QJixF0tnQ8kz9KbMOHGcqwowlHA82A4I", "\u0637\u0644\u0628-\u062A\u0639\u064A\u064A\u0646-\u062D\u0627\u0631\u0633-\u0642\u0636\u0627\u0626\u064A.pdf"],
  ["1QGE9rJ9GytMq9OWFtntk8z_6y8CNZIeV", "\u0637\u0644\u0628-\u062A\u0641\u0633\u064A\u0631-\u0627\u0644\u062D\u0643\u0645.pdf"],
  ["1QEMsthBnYGwuvc4YKq-QUGFPq5ulnIs-", "\u0637\u0644\u0628-\u062A\u0646\u0641\u064A\u0630-\u062D\u0643\u0645-\u062A\u062D\u0643\u064A\u0645.pdf"],
  ["1Q5zgy5KyJn4aYCHIpbDpmXsZrIvGUyoO", "\u0637\u0644\u0628-\u062A\u0646\u0641\u064A\u0630-\u062D\u0643\u0645-\u0642\u0636\u0627\u0626\u064A.pdf"],
  ["1Q3J3ok3G30Uu0-DgGwP4M9Ao_lwhlJAq", "\u0637\u0644\u0628-\u0631\u062F-\u0645\u062D\u0643\u0645.pdf"],
  ["1Q-EW5tI3Ov1qyE623-SCVYfBfAGGIs_6", "\u0637\u0644\u0628-\u0631\u0641\u0639-\u0627\u0644\u062F\u0639\u0648\u0649-\u0627\u0644\u062C\u0632\u0627\u0626\u064A\u0629.pdf"],
  ["1RZEO1HYPhU1-O14JIJvM88Frj3hSrjlc", "\u0637\u0644\u0628_\u0631\u0641\u0639_\u0627\u0644\u062F\u0639\u0648\u0649_\u0627\u0644\u062C\u0632\u0627\u0626\u064A\u0629_\u0627\u0644\u062C\u0646\u0627\u0626\u064A\u0629_\u0628\u0646\u0627\u0621\u064B_\u0639\u0644\u0649_\u062A\u0642\u062F\u064A\u0645_\u0634\u0643\u0648\u0649_1.pdf"],
  ["1RFWjBXdj_M9zzW8eZ5_Dgf6lcDTxLoyv", "\u0637\u0644\u0628_\u0639\u0644\u064A_\u0639\u0631\u064A\u0636\u0629_\u0644\u0642\u0627\u0636\u064A_\u0627\u0644\u0623\u0645\u0648\u0631_\u0627\u0644\u0648\u0642\u062A\u064A\u0629_\u0628\u0627\u0644\u0623\u0645\u0631.doc"],
  ["1RPPcHPwOQOXoxUsF8LuX1S9ttqJZWiDP", "\u0637\u0644\u0628_\u0639\u0644\u064A_\u0639\u0631\u064A\u0636\u0629_\u0644\u0642\u0627\u0636\u064A_\u0627\u0644\u0623\u0645\u0648\u0631_\u0627\u0644\u0648\u0642\u062A\u064A\u0629_\u0628\u0627\u0644\u0623\u0645\u0631_\u0628\u062A\u062C\u0647\u064A\u0632_\u0648\u0646\u0642\u0644_\u062C\u062B\u0629_\u0639\u0627.doc"],
  ["1Pww7hWqIOJE3nQRR0dKxqj2d7cSDMejK", "\u0637\u0644\u0628\u0627\u062A \u0627\u0639\u0627\u0644\u0629 \u0628\u0639\u062F \u0645\u062A\u0648\u0641\u064A.doc"],
  ["1PtBf-Df1lsYwZC5-GVWqzZkGAJNK9x3a", "\u0639\u0628\u062F\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0642\u062F \u0628\u064A\u0639.doc"],
  ["1Pj1PL_HfL2_NG9QwDHm9Xs42DzPju-b3", "\u0639\u0628\u062F\u0627\u0644\u0644\u0637\u064A\u0641.doc"],
  ["1PiM2LsgZLvYKE4xfsQ624T4pC8UFB_m2", "\u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0645\u062B\u0646\u0649.doc"],
  ["1Pi7HZNX3L2Un_UeCQbbVXBmlOoeQaeNn", "\u0639\u062C\u0632_\u0627\u0644\u0645\u062F\u0639\u064A_\u0639\u0646_\u062A\u0635\u062D\u064A\u062D_\u062F\u0639\u0648\u0627\u0647\u0627\u0644\u0645\u0635\u062D\u062D_.docx"],
  ["1PYB6FBLhZjZD_SjkvKVLXkUhjvZVE9tz", "\u0639\u0631\u064A\u0636\u0629 \u0627\u0633\u062A\u0635\u062F\u0627\u0631 \u0627\u0645\u0631 \u0627\u062F\u0627\u0621.doc"],
  ["1PT4eOqmmJZll7ymTN5umbM018pVhNrxK", "\u0639\u0631\u064A\u0636\u0629_\u0628\u0627\u0633\u062A\u0635\u062F\u0627\u0631_\u0627\u0645\u0631_\u0628\u0627\u0644\u062A\u0631\u062E\u064A\u0635_\u0644\u0644\u0645\u062D\u0636\u0631_\u0628\u062F\u062E\u0648\u0644_\u0627\u0644\u0639\u0642\u0627\u0631_\u0644\u0644\u062D\u0635\u0648\u0644_\u0639\u0644\u0649_\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.doc"],
  ["1PR9Iz59FRMx36wSEogVZDTvrUfCnXRHz", "\u0639\u0642\u062F  \u0628\u064A\u0639 \u0628\u0642\u0639\u0629 \u0639\u0628\u062F\u0627\u0644\u0633\u0644\u0627\u0645 \u064A\u062D\u064A \u064A\u0627\u0633\u064A\u0646.doc"],
  ["1PFhSMGVFXqG7T6gtGzrXkFPaeEuWW2Ph", "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0645\u062D\u062F\u062F \u0627\u0644\u0645\u062F\u0629.docx"],
  ["1PASS7_rqYulQHJrBCDqK4VHcMoZaChwb", "\u0639\u0642\u062F \u0627\u062A\u0639\u0627\u0628 \u0645\u062D\u0627\u0645\u064A.docx"],
  ["1P6zJN_bOfWPHzSNGPOX8YwaWYMJw8QyY", "\u0639\u0642\u062F \u0627\u0644\u0628\u064A\u0639 \u0648\u0622\u062B\u0627\u0631\u0647.doc"],
  ["1P0sXKm8YuqvFBFqyrgVQuWWt2pE-tEE6", "\u0639\u0642\u062F \u0627\u064A\u062C\u0627\u0631.doc"],
  ["1P0lpumbKaAPVL0tL5ZFnOdPuqIfnamb1", "\u0639\u0642\u062F \u0627\u064A\u062C\u0627\u0631.pdf"],
  ["1OzPtS3_ZBHe_-MhkW4rGW4YN73rcIgWy", "\u0639\u0642\u062F \u0628\u064A\u0639 111.doc"],
  ["1OuLTugRim7amyW0oh7F53TcUDswe4lO4", "\u0639\u0642\u062F \u0628\u064A\u0639 \u062D\u0642\u0648\u0642 \u0646\u0634\u0631 \u0645\u0637\u0628\u0648\u0639\u0627\u062A.doc"],
  ["1Oq7fLXCcIe43cqSbF46K7cxVUpJ7qZkJ", "\u0639\u0642\u062F \u0628\u064A\u0639 \u0639\u0628\u062F\u0627\u0644\u0642\u0627\u0647\u0631.doc"],
  ["1Om_he9Pcr_236gFpkgGuneaFO5SwIe85", "\u0639\u0642\u062F \u062A\u0639\u064A\u0646 \u0648\u0643\u064A\u0644 \u0628\u0627\u0644\u0639\u0645\u0648\u0644\u0629.doc"],
  ["1OlSpUFVDS7GMzIjDHznPhzndIw6Ws5VT", "\u0639\u0642\u062F \u062D\u0644 \u0634\u0631\u0643\u0629.doc"],
  ["1OeQKbHQA_XManKrzXEY0f4oAwCA8eS0S", "\u0639\u0642\u062F \u0634\u0631\u0627\u0643\u0629.doc"],
  ["1OeGtNsQAjiHdKzxqCSxNOfWqRn6OIGbb", "\u0639\u0642\u062F \u0639\u0645\u0644 \u0628\u0635\u064A\u062F\u0644\u064A\u0629.docx"],
  ["1Oe8PhlxJQEdkbo-tLgV8JlwfWAhmxox_", "\u0639\u0642\u062F \u0642\u0633\u0645\u0629 \u0631\u0636\u0627\u0626\u064A\u0629 2.doc"],
  ["1Odqlv6upr0uXYRTJwI-x165kYgx8_TLs", "\u0639\u0642\u062F \u0642\u0633\u0645\u0629 \u0631\u0636\u0627\u0626\u064A\u0629 3.doc"],
  ["1O_dTsNEpPnX8Z7xXX9QsIP-vDx1Sw9hO", "\u0641\u0633\u062E \u0627\u0644\u0646\u0643\u0627\u062D \u0644\u0639\u062F\u0645 \u0627\u0644\u0643\u0641\u0627\u0621\u0647.doc"],
  ["1OXtUjk0AlT3EpV0mvQjwR-ppm0GeZEN2", "\u0644\u0627\u0626\u062D\u0629 \u0627\u0644\u062A\u0641\u062A\u064A\u0634 \u0627\u0644\u0642\u0636\u0627\u0626\u064A.pdf"],
  ["1OULjYR6rECPR0s5oDqpvqLeWUltFOiaJ", "\u0645\u062D\u0645\u062F \u0639\u0644\u064A \u0627\u0644\u062D\u0627\u062C.docx"],
  ["1OS4NM6s92SDKBGI6k-cqry2QaUQUeiGx", "\u0645\u0634\u0627\u0631\u0643\u0629_\u0627\u0644\u0632\u0648\u062C\u0629_\u0644\u0632\u0648\u062C\u0647\u0627_\u0641\u064A_\u0628\u0646\u0627\u0621_\u0627\u0644\u0645\u0646\u0632\u0644.docx"],
  ["1O7CXkZB9TYRWZNmLacprN2HjqcCxZghU", "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0645\u062D\u0636\u0631 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629.pdf"],
  ["1NtUEsGJvKl5DvzJO74nqHl0oJiRyrjO_", "\u0645\u0648\u0627\u062C\u0647\u0629_\u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0644_\u0641\u064A_\u0642\u0627\u0646\u0648\u0646_\u0627\u0644\u0639\u0642\u0648\u0628\u0627\u062A_\u0627\u0644\u064A\u0645\u0646\u064A.pdf"],
  ["1NmWg_dYUmM1BYUDe0u7Zjgi9oPh8q3Ki", "\u0646\u0642\u0636 \u062C\u062F\u064A\u062F.doc"],
  ["1N__bbTR2PyH2aHG0GlFzD5XbL_Hs7tWx", "\u0646\u0642\u0636 \u062C\u0646\u0627\u0626\u064A \u0645\u0645\u062A\u0627\u0632.doc"],
  ["1NQ9zxmLhnFaAR10kk3o7b5oibYp9Ah9u", "\u0646\u0645\u0627\u0630\u062C \u0636\u064A\u063A \u062F\u0639\u0627\u0648\u064A \u0645\u062F\u0646\u064A\u0629 \u0645\u062A\u0646\u0648\u0639\u06292.docx"],
  ["1NHSVG2sBjTMnFtLeYQ8HYbHQPiCdmnNQ", "\u0646\u0645\u0627\u0630\u062C_\u0641\u0627\u0631\u063A\u0629_\u0645\u0646_\u0637\u0644\u0628_\u0627\u0644\u062A\u0646\u0641\u064A\u0630\u0648\u0637\u0644\u0628_\u0648\u0636\u0639_\u0627\u0644\u0635\u064A\u063A\u0629_\u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A\u0629_\u0648\u0625\u0639\u0644\u0627\u0646_\u0628\u0627\u0644\u0633\u0646\u062F.pdf"],
  ["1SQnYvZydQwSRVT7J3kymOlC0rwXU8Hui", "\u0646\u0645\u0648\u0630\u062C \u062F\u0639\u0648\u0649 \u062F\u064A\u0646 \u0628\u0645\u0648\u062C\u0628 \u0643\u0645\u0628\u064A\u0627\u0644\u0629 .pdf"],
  ["1SM6uor8kQIpLbF3CZ0ZXXbtJylO0WSjf", "\u0646\u0645\u0648\u0630\u062C \u062F\u0639\u0648\u0649 \u0634\u0641\u0639\u0629 .doc"],
  ["1SLSpkAjp_gHUCoE8mJ4a7KOY6j-Vw9zz", "\u0646\u0645\u0648\u0630\u062C \u0637\u0644\u0628 \u062A\u0635\u062F\u064A .docx"],
  ["1SHRBdf2XfQDmII-89zDN8TOEg0WMX97C", "\u0646\u0645\u0648\u0630\u062C \u0639\u0642\u062F \u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A .doc"],
  ["1SFIGHdqkg1qKKTETzQTzkDfxw4DJ3x2R", "\u0646\u0645\u0648\u0630\u062C \u0639\u0642\u062F \u062A\u0646\u0641\u064A\u0630 \u0645\u0647\u0645\u0629 \u0627\u0655\u062C\u0631\u0627\u064A\u0654\u064A\u0629.doc"],
  ["1SEUpGB7LZ0IF1fFIxwv1LYuPKGQrQ-zQ", "\u0646\u0645\u0648\u0630\u062C_\u062F\u0639\u0648\u0649_\u0628\u0637\u0644\u0628_\u0625\u062E\u0644\u0627\u0621_\u0639\u064A\u0646_\u0645\u0624\u062C\u0631\u0629_\u0644\u0625\u0636\u0631\u0627\u0631_\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631_\u0628\u0627\u0644\u0639\u064A\u0646.pdf"],
  ["1SDn3pj8vzKTcldgUgQ0lAkEI9U4YF-w-", "\u0646\u0645\u0648\u0630\u062C_\u0637\u0644\u0628_\u0627\u0633\u062A\u0631\u062F\u0627\u062F_\u0627\u0644\u0630\u0647\u0628_\u0648\u0627\u0644\u0645\u0647\u0631\u0648\u0627\u0644\u0634\u0646\u0637\u0647.doc"],
  ["1S4rOjrKqPMApZp3I5Wsyt4tgo9GveYE2", "\u0646\u0645\u0648\u0630\u062C_\u0639\u0642\u062F_\u0645\u062D\u0627\u0645\u0627\u0629_\u0627\u0644\u0639\u0645\u064A\u0644_\u0645\u062F\u0639\u0649_\u0639\u0644\u064A\u0647.doc"],
  ["1S-2Skx74x7q5T1bPg-MmY6UliFhdmh0o", "\u0646\u0645\u0648\u0632\u062C \u062F\u0639\u0648\u0649 \u0631\u062F \u0634\u0628\u0643\u0647.pdf"],
  ["1Rt7Dkwk1khmRH1jG2WxR9LLmFRriXvfv", "\u0648\u062B\u064A\u0642\u0629 \u0639\u0642\u062F \u0637\u0644\u0627\u0642 .doc"],
  ["1NNyQP-MmWGbWtn4esXXNTN-ehIulZDsg", "\u200E\u2068\u0646\u0645\u0627\u0630\u062C \u0639\u0642\u0648\u062F \u0628\u064A\u0648\u0639 \u0639\u0642\u0627\u0631\u064A\u0629\u2069.pdf"],
  ["1N4TedAs198gm4-2IiKakg9rwpC3cGwcH", "\u200E\u2068\u0646\u0645\u0648\u0630\u062C \u062D\u0643\u0645 \u062A\u062D\u0643\u064A\u0645\u2069.pdf"]
];
var legalFormsRootFolder = {
  id: 0,
  driveFolderId: LEGAL_FORMS_ROOT_FOLDER_ID,
  parentDriveFolderId: null,
  collection: "legal_forms",
  name: "\u0646\u0645\u0627\u0630\u062C \u0648\u0635\u064A\u063A \u0642\u0627\u0646\u0648\u0646\u064A\u0629",
  path: "\u0646\u0645\u0627\u0630\u062C \u0648\u0635\u064A\u063A \u0642\u0627\u0646\u0648\u0646\u064A\u0629",
  sortOrder: 60,
  createdAt: /* @__PURE__ */ new Date(0),
  updatedAt: /* @__PURE__ */ new Date(0)
};
var legalFormSources = LEGAL_FORM_SOURCE_DEFINITIONS.map(([driveFileId, title], index2) => ({
  id: 910001 + index2,
  category: "procedure",
  collection: "legal_forms",
  sortOrder: index2 + 1,
  driveFileId,
  driveFolderId: LEGAL_FORMS_ROOT_FOLDER_ID,
  folderSortOrder: index2 + 1,
  title,
  description: `\u0645\u0633\u062A\u0648\u0631\u062F \u0645\u0646 \u0645\u0643\u062A\u0628\u0629 \u0623. \u0645\u0639\u064A\u0646 \u0627\u0644\u0646\u0627\u0635\u0631: \u0646\u0645\u0627\u0630\u062C \u0648\u0635\u064A\u063A \u0642\u0627\u0646\u0648\u0646\u064A\u0629 / ${title}`,
  url: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`,
  documentType: "other",
  legislationYear: null,
  issuingAuthority: null,
  isFeatured: false,
  createdAt: /* @__PURE__ */ new Date(0),
  updatedAt: /* @__PURE__ */ new Date(0)
}));
function getLegalFormsFolderContents2(folderId, page) {
  if (folderId !== LEGAL_FORMS_ROOT_FOLDER_ID) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const start = (safePage - 1) * 7;
  return {
    folder: legalFormsRootFolder,
    folders: [],
    sources: legalFormSources.slice(start, start + 7),
    totalSources: legalFormSources.length
  };
}
function getLegalFormSource(sourceId) {
  return legalFormSources.find((source) => source.id === sourceId);
}

// server/supabaseBotExamDb.ts
import { createClient } from "@supabase/supabase-js";
var DEFAULT_SUPABASE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co";
function getSupabase() {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-client-info": "alnasser-telegram-bot" } }
  });
}
function assertNoSupabaseError(error, operation) {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message ?? "unknown error"}`);
}
function mapQuestion(row) {
  return {
    id: Number(row.id),
    questionText: row.question_text,
    optionA: row.option_a,
    optionB: row.option_b,
    optionC: row.option_c,
    optionD: row.option_d,
    correctOption: row.correct_option,
    explanation: row.explanation ?? "",
    hint: row.hint,
    sortOrder: Number(row.sort_order)
  };
}
function mapSession(row) {
  return {
    id: Number(row.id),
    telegramUserId: row.telegram_user_id,
    chatId: row.chat_id,
    subjectKey: row.subject_key,
    sectionKey: row.section_key,
    status: row.status,
    questionIndex: Number(row.question_index),
    score: Number(row.score),
    incorrectCount: Number(row.incorrect_count),
    missedCount: Number(row.missed_count),
    timeLimitSeconds: Number(row.time_limit_seconds),
    activePollId: row.active_poll_id,
    startedAt: new Date(row.started_at)
  };
}
async function listSupabaseExamQuestions(client, subjectKey, sectionKey) {
  const { data, error } = await client.from("bot_exam_questions").select("id,source_question_id,subject_key,section_key,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,hint,sort_order").eq("subject_key", subjectKey).eq("section_key", sectionKey).eq("is_active", true).order("sort_order", { ascending: true }).order("id", { ascending: true }).limit(1e3);
  assertNoSupabaseError(error, "list questions");
  return (data ?? []).map(mapQuestion);
}
async function insertResultIfCompleted(client, session, result) {
  const { error } = await client.from("bot_exam_results").insert({
    session_id: session.id,
    telegram_user_id: session.telegramUserId,
    subject_key: session.subjectKey,
    section_key: session.sectionKey,
    score: result.score,
    incorrect_count: result.incorrectCount,
    missed_count: result.missedCount,
    elapsed_seconds: result.elapsedSeconds
  });
  assertNoSupabaseError(error, "save result");
}
async function listSupabaseBotExamForms(subjectKey) {
  const client = getSupabase();
  const { data, error } = await client.from("bot_exam_forms").select("form_key,form_name,sort_order").eq("subject_key", subjectKey).eq("is_active", true).order("sort_order", { ascending: true }).order("id", { ascending: true }).limit(100);
  assertNoSupabaseError(error, "list forms");
  const forms = data ?? [];
  return Promise.all(forms.map(async (form) => {
    const { count: count3, error: countError } = await client.from("bot_exam_questions").select("id", { count: "exact", head: true }).eq("subject_key", subjectKey).eq("section_key", form.form_key).eq("is_active", true);
    assertNoSupabaseError(countError, "count form questions");
    return { formKey: form.form_key, formName: form.form_name, sortOrder: Number(form.sort_order), questionCount: count3 ?? 0 };
  }));
}
async function listSupabaseBotExamQuestions(subjectKey, sectionKey) {
  return listSupabaseExamQuestions(getSupabase(), subjectKey, sectionKey);
}
async function startSupabaseBotExamSession(telegramUserId, chatId, subjectKey, sectionKey, timeLimitSeconds) {
  const client = getSupabase();
  const { data, error } = await client.from("bot_exam_sessions").insert({
    telegram_user_id: telegramUserId,
    chat_id: chatId,
    subject_key: subjectKey,
    section_key: sectionKey,
    time_limit_seconds: timeLimitSeconds
  }).select("id").limit(1).maybeSingle();
  assertNoSupabaseError(error, "start session");
  return data ? { id: Number(data.id) } : void 0;
}
async function getSupabaseBotExamSession(sessionId, telegramUserId) {
  const { data, error } = await getSupabase().from("bot_exam_sessions").select("id,telegram_user_id,chat_id,subject_key,section_key,status,question_index,score,incorrect_count,missed_count,time_limit_seconds,active_poll_id,started_at").eq("id", sessionId).eq("telegram_user_id", telegramUserId).limit(1).maybeSingle();
  assertNoSupabaseError(error, "get session");
  return data ? mapSession(data) : void 0;
}
async function setSupabaseBotExamActivePoll(input) {
  const { data, error } = await getSupabase().from("bot_exam_sessions").update({ active_poll_id: input.pollId, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", input.sessionId).eq("telegram_user_id", input.telegramUserId).eq("status", "active").eq("question_index", input.questionIndex).is("active_poll_id", null).select("id");
  assertNoSupabaseError(error, "set active poll");
  return Array.isArray(data) && data.length > 0;
}
async function getSupabaseBotExamSessionByPoll(pollId) {
  const { data, error } = await getSupabase().from("bot_exam_sessions").select("id,telegram_user_id,chat_id,subject_key,section_key,status,question_index,score,incorrect_count,missed_count,time_limit_seconds,active_poll_id,started_at").eq("active_poll_id", pollId).eq("status", "active").limit(1).maybeSingle();
  assertNoSupabaseError(error, "get session by poll");
  return data ? mapSession(data) : void 0;
}
async function cancelSupabaseBotExamSession(telegramUserId, chatId) {
  const client = getSupabase();
  const { data, error } = await client.from("bot_exam_sessions").select("id,subject_key,section_key").eq("telegram_user_id", telegramUserId).eq("chat_id", chatId).eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  assertNoSupabaseError(error, "find active session");
  if (!data) return void 0;
  const session = data;
  const { data: updated, error: updateError } = await client.from("bot_exam_sessions").update({ status: "cancelled", completed_at: (/* @__PURE__ */ new Date()).toISOString(), active_poll_id: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", session.id).eq("telegram_user_id", telegramUserId).eq("chat_id", chatId).eq("status", "active").select("id");
  assertNoSupabaseError(updateError, "cancel session");
  return Array.isArray(updated) && updated.length > 0 ? { subjectKey: session.subject_key, sectionKey: session.section_key } : void 0;
}
async function resolveSupabaseBotExamPoll(input) {
  const client = getSupabase();
  const session = await getSupabaseBotExamSession(input.sessionId, input.telegramUserId);
  if (!session || session.status !== "active" || session.questionIndex !== input.questionIndex || session.activePollId !== input.pollId) return void 0;
  const questions = await listSupabaseExamQuestions(client, session.subjectKey, session.sectionKey);
  const question = questions[input.questionIndex];
  if (!question) return void 0;
  const missed = !input.answer;
  const isCorrect = !missed && question.correctOption === input.answer;
  const nextQuestionIndex = input.questionIndex + 1;
  const completed = nextQuestionIndex >= questions.length;
  const result = {
    score: session.score + (isCorrect ? 1 : 0),
    incorrectCount: session.incorrectCount + (!missed && !isCorrect ? 1 : 0),
    missedCount: session.missedCount + (missed ? 1 : 0),
    nextQuestionIndex,
    total: questions.length,
    completed,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1e3))
  };
  const { data, error } = await client.from("bot_exam_sessions").update({
    question_index: result.nextQuestionIndex,
    score: result.score,
    incorrect_count: result.incorrectCount,
    missed_count: result.missedCount,
    status: result.completed ? "completed" : "active",
    completed_at: result.completed ? (/* @__PURE__ */ new Date()).toISOString() : null,
    active_poll_id: null,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", input.sessionId).eq("telegram_user_id", input.telegramUserId).eq("status", "active").eq("question_index", input.questionIndex).eq("active_poll_id", input.pollId).select("id");
  assertNoSupabaseError(error, "resolve poll");
  if (!Array.isArray(data) || data.length === 0) return void 0;
  if (result.completed) await insertResultIfCompleted(client, session, result);
  return { question: { ...question }, isCorrect, missed, ...result };
}
async function advanceSupabaseBotExamWrittenQuestion(input) {
  const client = getSupabase();
  const session = await getSupabaseBotExamSession(input.sessionId, input.telegramUserId);
  if (!session || session.status !== "active" || session.questionIndex !== input.questionIndex || session.activePollId) return void 0;
  const questions = await listSupabaseExamQuestions(client, session.subjectKey, session.sectionKey);
  const question = questions[input.questionIndex];
  if (!question || [question.optionA, question.optionB, question.optionC, question.optionD].some((option) => option.trim())) return void 0;
  const nextQuestionIndex = input.questionIndex + 1;
  const completed = nextQuestionIndex >= questions.length;
  const result = {
    score: session.score,
    incorrectCount: session.incorrectCount,
    missedCount: session.missedCount + 1,
    nextQuestionIndex,
    total: questions.length,
    completed,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1e3))
  };
  const { data, error } = await client.from("bot_exam_sessions").update({ question_index: result.nextQuestionIndex, missed_count: result.missedCount, status: result.completed ? "completed" : "active", completed_at: result.completed ? (/* @__PURE__ */ new Date()).toISOString() : null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", input.sessionId).eq("telegram_user_id", input.telegramUserId).eq("status", "active").eq("question_index", input.questionIndex).is("active_poll_id", null).select("id");
  assertNoSupabaseError(error, "advance written question");
  if (!Array.isArray(data) || data.length === 0) return void 0;
  if (result.completed) await insertResultIfCompleted(client, session, result);
  return result;
}
async function getSupabaseBotExamResultSummary(sessionId, telegramUserId) {
  const client = getSupabase();
  const session = await getSupabaseBotExamSession(sessionId, telegramUserId);
  if (!session || session.status !== "completed") return void 0;
  const { data, error } = await client.from("bot_exam_results").select("score,incorrect_count,missed_count,elapsed_seconds,created_at").eq("subject_key", session.subjectKey).eq("section_key", session.sectionKey).order("score", { ascending: false }).order("elapsed_seconds", { ascending: true }).order("created_at", { ascending: true }).limit(1e3);
  assertNoSupabaseError(error, "list results");
  const results = data ?? [];
  const current = results.find((result) => result.created_at >= session.startedAt.toISOString());
  const toSummary = (result) => result ? { score: Number(result.score), incorrectCount: Number(result.incorrect_count), missedCount: Number(result.missed_count), elapsedSeconds: Number(result.elapsed_seconds) } : void 0;
  const currentSummary = toSummary(current) ?? { score: session.score, incorrectCount: session.incorrectCount, missedCount: session.missedCount, elapsedSeconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1e3)) };
  const rank = current ? results.findIndex((result) => result === current) + 1 : results.length + 1;
  const previousBest = results.filter((result) => result !== current).sort((a, b) => Number(b.score) - Number(a.score) || Number(a.elapsed_seconds) - Number(b.elapsed_seconds))[0];
  const leaderboardResult = results[0] ?? current;
  return {
    previousBest: toSummary(previousBest),
    leaderboardResult: toSummary(leaderboardResult) ?? currentSummary,
    rank,
    totalParticipants: Math.max(1, results.length),
    percentile: results.length ? Math.max(0, Math.round((1 - (rank - 1) / results.length) * 100)) : 100
  };
}

// server/supabaseBotStore.ts
var DEFAULT_SUPABASE_URL2 = "https://nhrlwemvkvgmtzoiwcym.supabase.co";
var PAGE_SIZE = 1e3;
var LIBRARY_PAGE_SIZE = 7;
var SEARCH_TTL_MS = 10 * 60 * 1e3;
var ROOT_BY_COLLECTION = {
  judicial: { id: JUDICIAL_ROOT_FOLDER_ID, name: "\u0642\u0648\u0627\u0639\u062F \u0642\u0636\u0627\u0626\u064A\u0629" },
  legislation: { id: LEGISLATION_ROOT_FOLDER_ID, name: "\u0627\u0644\u062A\u0634\u0631\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0645\u0646\u064A\u0629" },
  yemeni_laws: { id: YEMENI_LAWS_ROOT_FOLDER_ID, name: "\u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0641\u0647\u0631\u0633 \u062A\u0641\u0627\u0639\u0644\u064A" },
  legal_forms: { id: LEGAL_FORMS_ROOT_FOLDER_ID, name: "\u0646\u0645\u0627\u0630\u062C \u0648\u0635\u064A\u063A \u0642\u0627\u0646\u0648\u0646\u064A\u0629" },
  illustrated_legal_forms: { id: ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID, name: "\u0646\u0645\u0627\u0630\u062C \u0645\u0635\u0648\u0631\u0629 \u0648\u0641\u0642 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629" },
  all_yemeni_laws: { id: ALL_YEMENI_LAWS_ROOT_FOLDER_ID, name: "\u062C\u0645\u064A\u0639 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629" },
  featured_references: { id: FEATURED_REFERENCES_ROOT_FOLDER_ID, name: "\u0645\u0631\u0627\u062C\u0639 \u0645\u0645\u064A\u0632\u0629" },
  important_yemeni_laws: { id: IMPORTANT_YEMENI_LAWS_ROOT_FOLDER_ID, name: "\u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0628\u0627\u0644\u0641\u0647\u0631\u0633 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A" }
};
function getClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient2(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL2, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
function throwIfError(error, operation) {
  if (error) throw new Error(`Supabase ${operation} failed: ${error.message ?? "unknown error"}`);
}
async function readAll(table, select, configure) {
  const client = getClient();
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.from(table).select(select);
    query = configure(query).range(offset, offset + PAGE_SIZE - 1);
    const { data, error } = await query;
    throwIfError(error, `read ${table}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}
function dateValue(value) {
  return value instanceof Date ? value : new Date(String(value ?? Date.now()));
}
function normalizeSearch(value) {
  return value.toLowerCase().replace(/[\u064B-\u065F\u0670]/g, "").replace(/ـ/g, "").replace(/[أإآٱ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").replace(/[^\u0621-\u063A\u0641-\u064A0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function matchScore(query, text2) {
  const needle = normalizeSearch(query);
  const haystack = normalizeSearch(text2);
  if (!needle || needle.length < 2) return 0;
  if (haystack.includes(needle)) return 100;
  const words = haystack.split(" ").filter((word) => word.length > 1);
  return needle.split(" ").filter(Boolean).reduce((score, word) => score + (words.some((candidate) => candidate.startsWith(word) || word.startsWith(candidate)) ? 2 : 0), 0);
}
function sourceCategory(name) {
  const normalized = normalizeSearch(name);
  if (/(فقه|شريع|اسلام)/.test(normalized)) return "fiqh";
  if (/(مدني|عقار|ملكيه)/.test(normalized)) return "civil";
  if (/(تجاري|شركه)/.test(normalized)) return "commercial";
  if (/(جنائي|جزائي|عقوب|مرافع|نياب)/.test(normalized)) return "procedure";
  return "general";
}
function sourceDocumentType(name) {
  const normalized = normalizeSearch(name);
  if (/لائح/.test(normalized)) return "regulation";
  if (/قرار/.test(normalized)) return "decision";
  if (/اتفاق|اتفاقي/.test(normalized)) return "agreement";
  if (/معاهد/.test(normalized)) return "treaty";
  if (/مرسوم/.test(normalized)) return "decree";
  if (/قانون|تشريع/.test(normalized)) return "law";
  return "other";
}
function sourceYear(name) {
  const year = name.match(/(?:19|20)\d{2}/)?.[0];
  return year ? Number(year) : null;
}
function mapFolder(row, collection, path) {
  return {
    id: Number(row.id),
    driveFolderId: row.drive_id,
    parentDriveFolderId: row.parent_id,
    collection,
    name: row.name,
    path,
    sortOrder: Number(row.order_index ?? 0),
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  };
}
function mapFile(row, collection, folderPath) {
  const title = row.extracted_title?.trim() || row.name.trim() || `\u0645\u0644\u0641 ${row.id}`;
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
    description: folderPath ? `${title}
\u0627\u0644\u0645\u062C\u0644\u062F: ${folderPath}` : title,
    url,
    documentType: sourceDocumentType(title),
    legislationYear: sourceYear(title),
    issuingAuthority: null,
    isFeatured: false,
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at)
  };
}
async function loadDriveIndex() {
  const [folders, files] = await Promise.all([
    readAll("drive_folders", "id,drive_id,name,parent_id,depth,order_index,is_premium,free_download", (query) => query.order("depth", { ascending: true }).order("order_index", { ascending: true }).order("id", { ascending: true })),
    readAll("drive_files", "id,drive_id,name,folder_id,mime_type,view_url,embed_url,download_url,order_index,is_premium,view_count,download_count,extracted_title,download_locked,created_at,updated_at", (query) => query.order("folder_id", { ascending: true }).order("order_index", { ascending: true }).order("id", { ascending: true }))
  ]);
  const foldersByDriveId = new Map(folders.map((folder) => [folder.drive_id, folder]));
  const collectionCache = /* @__PURE__ */ new Map();
  const rootCollection = new Map(Object.entries(ROOT_BY_COLLECTION).map(([collection, root]) => [root.id, collection]));
  const collectionForFolder = (driveId) => {
    if (!driveId) return void 0;
    if (collectionCache.has(driveId)) return collectionCache.get(driveId);
    const seen = /* @__PURE__ */ new Set();
    let current = foldersByDriveId.get(driveId);
    while (current && !seen.has(current.drive_id)) {
      const direct = rootCollection.get(current.drive_id);
      if (direct) {
        collectionCache.set(driveId, direct);
        return direct;
      }
      seen.add(current.drive_id);
      current = current.parent_id ? foldersByDriveId.get(current.parent_id) : void 0;
    }
    collectionCache.set(driveId, void 0);
    return void 0;
  };
  const folderPath = (driveId) => {
    const parts = [];
    const seen = /* @__PURE__ */ new Set();
    let current = foldersByDriveId.get(driveId);
    while (current && !seen.has(current.drive_id)) {
      parts.unshift(current.name);
      seen.add(current.drive_id);
      current = current.parent_id ? foldersByDriveId.get(current.parent_id) : void 0;
    }
    const collection = collectionForFolder(driveId);
    const rootName = collection ? ROOT_BY_COLLECTION[collection].name : "";
    return parts.join(" / ") || rootName;
  };
  const sourceRows = files.map((file) => {
    const collection = collectionForFolder(file.folder_id);
    return collection ? { file, collection, source: mapFile(file, collection, file.folder_id ? folderPath(file.folder_id) : "") } : void 0;
  }).filter((value) => Boolean(value));
  return { folders, files, foldersByDriveId, collectionForFolder, folderPath, sourceRows };
}
function virtualFolder(collection) {
  const root = ROOT_BY_COLLECTION[collection];
  return { id: 0, driveFolderId: root.id, parentDriveFolderId: null, collection, name: root.name, path: root.name, sortOrder: 0, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() };
}
async function folderContents(collection, folderId, page) {
  const index2 = await loadDriveIndex();
  const row = index2.foldersByDriveId.get(folderId);
  const actualCollection = index2.collectionForFolder(folderId);
  const folder = row && actualCollection === collection ? mapFolder(row, collection, index2.folderPath(folderId)) : folderId === ROOT_BY_COLLECTION[collection].id ? virtualFolder(collection) : void 0;
  if (!folder) return { folder: void 0, folders: [], sources: [], totalSources: 0 };
  const children = index2.folders.filter((child) => child.parent_id === folderId && index2.collectionForFolder(child.drive_id) === collection).sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0) || a.name.localeCompare(b.name)).slice(0, 60).map((child) => mapFolder(child, collection, index2.folderPath(child.drive_id)));
  const allSources = index2.sourceRows.filter((item) => item.collection === collection && item.file.folder_id === folderId).sort((a, b) => Number(a.file.order_index ?? 0) - Number(b.file.order_index ?? 0) || a.file.id - b.file.id).map((item) => item.source);
  const safePage = Math.max(1, Math.trunc(page) || 1);
  return { folder, folders: children, sources: allSources.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), totalSources: allSources.length };
}
async function listSources(collection, page, predicate = () => true) {
  const index2 = await loadDriveIndex();
  const all = index2.sourceRows.filter((item) => item.collection === collection).map((item) => item.source).filter(predicate).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const safePage = Math.max(1, Math.trunc(page) || 1);
  return { sources: all.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), total: all.length };
}
async function getDriveSource(id) {
  const index2 = await loadDriveIndex();
  return index2.sourceRows.find((item) => item.source.id === id)?.source;
}
async function getBotSource(id) {
  return getIllustratedLegalFormSource(id) ?? getLegalFormSource(id) ?? getDriveSource(id);
}
function normalizeContractContent(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((block) => Boolean(block) && typeof block === "object").map((block) => ({ num: typeof block.num === "string" ? block.num : void 0, text: typeof block.text === "string" ? block.text : void 0, type: typeof block.type === "string" ? block.type : void 0 })).filter((block) => Boolean(block.text?.trim()));
}
function mapContract(row) {
  return { id: Number(row.id), sourceDocumentId: Number(row.id), fileName: row.file_name?.trim() || `\u0646\u0645\u0648\u0630\u062C \u0642\u0627\u0646\u0648\u0646\u064A ${row.id}`, content: normalizeContractContent(row.content), sortOrder: Number(row.display_order ?? 0), contractType: classifyTelegramContractTemplate(row.file_name?.trim() || ""), isPremium: Boolean(row.is_premium), isActive: true, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() };
}
async function loadContracts() {
  const rows = await readAll("legal_documents", "id,file_name,display_order,is_premium,content", (query) => query.eq("category", "contract_template").order("display_order", { ascending: true }).order("id", { ascending: true }));
  return rows.map(mapContract).filter((template) => template.content.length > 0);
}
async function clearSearch(chatId) {
  const { error } = await getClient().from("bot_search_sessions").delete().eq("chat_id", chatId);
  throwIfError(error, "clear search sessions");
}
async function beginSearch(chatId, scope) {
  await clearSearch(chatId);
  const { error } = await getClient().from("bot_search_sessions").upsert({ chat_id: chatId, scope, query: null, status: "awaiting", expires_at: new Date(Date.now() + SEARCH_TTL_MS).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "chat_id,scope" });
  throwIfError(error, "begin search");
}
async function consumeSearch(chatId, scope, query) {
  const normalized = query.trim().slice(0, 255);
  if (!normalized) return void 0;
  const { data, error } = await getClient().from("bot_search_sessions").select("id").eq("chat_id", chatId).eq("scope", scope).eq("status", "awaiting").gt("expires_at", (/* @__PURE__ */ new Date()).toISOString()).limit(1).maybeSingle();
  throwIfError(error, "read search session");
  if (!data) return void 0;
  const { error: updateError } = await getClient().from("bot_search_sessions").update({ query: normalized, status: "ready", expires_at: new Date(Date.now() + SEARCH_TTL_MS).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", Number(data.id));
  throwIfError(updateError, "save search query");
  return { id: Number(data.id) };
}
async function sessionQuery(id, scope) {
  const { data, error } = await getClient().from("bot_search_sessions").select("query").eq("id", id).eq("scope", scope).eq("status", "ready").gt("expires_at", (/* @__PURE__ */ new Date()).toISOString()).limit(1).maybeSingle();
  throwIfError(error, "read ready search");
  const query = data?.query;
  return query?.trim() || void 0;
}
async function searchSourceScope(scope, sessionId, page, collection) {
  const query = await sessionQuery(sessionId, scope);
  if (!query) return void 0;
  const index2 = await loadDriveIndex();
  const candidates = index2.sourceRows.filter((item) => item.collection === collection).map((item) => item.source);
  const exact = candidates.filter((source) => normalizeSearch(`${source.title} ${source.description}`).includes(normalizeSearch(query)));
  const ranked = exact.length > 0 ? exact : candidates.map((source) => ({ source, score: matchScore(query, `${source.title} ${source.description}`) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.source.sortOrder - b.source.sortOrder || a.source.id - b.source.id).map((item) => item.source);
  const safePage = Math.max(1, Math.trunc(page) || 1);
  return { query, sources: ranked.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), total: ranked.length, matchType: exact.length > 0 ? "exact" : "approximate" };
}
async function hasAccess(scope, telegramUserId) {
  const { data, error } = await getClient().from(scope).select("telegram_user_id").eq("telegram_user_id", telegramUserId).limit(1).maybeSingle();
  throwIfError(error, `check ${scope}`);
  return Boolean(data);
}
async function hasScopedAccess(telegramUserId, accessScope, managedMenuItemId) {
  const { data, error } = await getClient().from("bot_user_access").select("managed_menu_item_id,expires_at").eq("telegram_user_id", telegramUserId).eq("access_scope", accessScope).limit(100);
  throwIfError(error, "check scoped access");
  const now = Date.now();
  return (data ?? []).some((row) => (managedMenuItemId === void 0 || Number(row.managed_menu_item_id) === managedMenuItemId) && (!row.expires_at || new Date(row.expires_at).getTime() > now));
}
async function upsertScopedAccess(telegramUserId, accessScope, approvedBy, managedMenuItemId = null) {
  const { error } = await getClient().from("bot_user_access").upsert({ telegram_user_id: telegramUserId, access_scope: accessScope, managed_menu_item_id: managedMenuItemId, approved_by: approvedBy, expires_at: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "telegram_user_id,access_scope,managed_menu_item_id" });
  throwIfError(error, "grant scoped access");
}
function mapRound(row) {
  return { id: Number(row.id), chatId: String(row.chat_id), creatorTelegramUserId: row.creator_telegram_user_id, subjectKey: row.subject_key, sectionKey: row.section_key, status: row.status, questionIndex: Number(row.question_index), timeLimitSeconds: Number(row.time_limit_seconds), activePollId: row.active_poll_id, startedAt: row.started_at ? dateValue(row.started_at) : null };
}
async function getRoundById(roundId) {
  const { data, error } = await getClient().from("bot_group_exam_rounds").select("id,chat_id,creator_telegram_user_id,subject_key,section_key,status,question_index,time_limit_seconds,active_poll_id,started_at").eq("id", roundId).limit(1).maybeSingle();
  throwIfError(error, "read group round");
  return data ? mapRound(data) : void 0;
}
function createSupabaseBotStore() {
  const store = {
    hasConfirmedPlatformAccess: (telegramUserId) => hasAccess("bot_platform_access", telegramUserId),
    hasConfirmedHasadAccess: (telegramUserId) => hasAccess("bot_hasad_access", telegramUserId),
    listManagedMenuItems: async () => [],
    listManagedSections: async () => [],
    listManagedMessages: async () => [],
    listSourcesByCategory: async (category, page) => listSources("judicial", page, (source) => source.category === category),
    searchSources: async (query) => {
      const index2 = await loadDriveIndex();
      return index2.sourceRows.map((item) => item.source).filter((source) => source.collection === "judicial" && matchScore(query, `${source.title} ${source.description}`) > 0).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).slice(0, 20);
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
    listFavorites: async (telegramUserId) => {
      const { data, error } = await getClient().from("bot_favorites").select("source_id,created_at").eq("telegram_user_id", telegramUserId).order("created_at", { ascending: false }).limit(50);
      throwIfError(error, "list favorites");
      const result = [];
      for (const row of data ?? []) {
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
      const index2 = await loadDriveIndex();
      return index2.sourceRows.filter((item) => item.collection !== "important_yemeni_laws").map((item) => item.source).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id).slice(0, 6);
    },
    listFeaturedSources: async () => {
      const index2 = await loadDriveIndex();
      return index2.sourceRows.filter((item) => item.collection !== "important_yemeni_laws" && item.file.is_premium !== true).map((item) => item.source).slice(0, 6);
    },
    listPopularSources: async () => {
      const index2 = await loadDriveIndex();
      const counts = /* @__PURE__ */ new Map();
      const events = await readAll("bot_usage_events", "source_id", (query) => query.eq("event_type", "document_request").not("source_id", "is", null).order("created_at", { ascending: false }).limit(1e3));
      for (const event of events) if (event.source_id) counts.set(Number(event.source_id), (counts.get(Number(event.source_id)) ?? 0) + 1);
      const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([id]) => id);
      const sources = ranked.map((id) => index2.sourceRows.find((item) => item.source.id === id)?.source).filter((source) => Boolean(source));
      return sources.slice(0, 6);
    },
    listContractTemplates: async (page) => {
      const all = await loadContracts();
      const safePage = Math.max(1, Math.trunc(page) || 1);
      return { templates: all.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), total: all.length };
    },
    listContractTemplateTypes: async () => {
      const all = await loadContracts();
      return ["civil", "commercial", "labor", "personal", "judicial", "general"].map((contractType) => ({ contractType, count: all.filter((template) => template.contractType === contractType).length })).filter((item) => item.count > 0);
    },
    listContractTemplatesByType: async (contractType, page) => {
      const all = (await loadContracts()).filter((template) => template.contractType === contractType);
      const safePage = Math.max(1, Math.trunc(page) || 1);
      return { templates: all.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), total: all.length };
    },
    getContractTemplate: async (id) => (await loadContracts()).find((template) => template.id === id),
    beginContractTemplateSearch: (chatId) => beginSearch(chatId, "contract_templates"),
    consumeContractTemplateSearchQuery: async (chatId, query) => consumeSearch(chatId, "contract_templates", query),
    searchContractTemplates: async (sessionId, page) => {
      const query = await sessionQuery(sessionId, "contract_templates");
      if (!query) return void 0;
      const all = await loadContracts();
      const exact = all.filter((template) => normalizeSearch(template.fileName).includes(normalizeSearch(query)));
      const ranked = exact.length ? exact : all.map((template) => ({ template, score: matchScore(query, template.fileName) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.template.sortOrder - b.template.sortOrder).map((item) => item.template);
      const safePage = Math.max(1, Math.trunc(page) || 1);
      return { query, templates: ranked.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE), total: ranked.length, matchType: exact.length ? "exact" : "approximate" };
    },
    listLegislationSourcesByType: async (documentType, page) => listSources("legislation", page, (source) => source.documentType === documentType),
    listLegislationYears: async () => {
      const index2 = await loadDriveIndex();
      return Array.from(new Set(index2.sourceRows.filter((item) => item.collection === "legislation").map((item) => item.source.legislationYear).filter((year) => Boolean(year)))).sort((a, b) => b - a);
    },
    listLegislationSourcesByYear: async (year, page) => listSources("legislation", page, (source) => source.legislationYear === year),
    recordUsage: async (telegramUserId, eventType, options) => {
      const { error } = await getClient().from("bot_usage_events").insert({ telegram_user_id: telegramUserId, event_type: eventType, section_key: options?.sectionKey ?? null, query: options?.query?.slice(0, 255) ?? null, source_id: options?.sourceId ?? null });
      throwIfError(error, "record usage");
    },
    createSupportRequest: async (telegramUserId, chatId, message) => {
      const { error } = await getClient().from("bot_support_requests").insert({ telegram_user_id: telegramUserId, chat_id: chatId, message: message.trim().slice(0, 2e3) });
      throwIfError(error, "create support request");
    },
    getOwnerStatistics: async () => {
      const events = await readAll("bot_usage_events", "telegram_user_id,event_type,query", (query) => query.order("created_at", { ascending: false }).limit(1e4));
      const supports = await readAll("bot_support_requests", "id", (query) => query.limit(1e4));
      const queryCounts = /* @__PURE__ */ new Map();
      for (const event of events) if (event.query) queryCounts.set(event.query, (queryCounts.get(event.query) ?? 0) + 1);
      return { totalEvents: events.length, totalSupportRequests: supports.length, topQueries: Array.from(queryCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([query, count3]) => ({ query, count: count3 })) };
    },
    listNewSupportRequests: async () => {
      const { data, error } = await getClient().from("bot_support_requests").select("id,message,created_at").eq("status", "new").order("created_at", { ascending: true }).limit(20);
      throwIfError(error, "list support requests");
      return (data ?? []).map((row) => ({ id: Number(row.id), message: row.message, createdAt: dateValue(row.created_at) }));
    },
    registerSubscriber: async (chatId, telegramUserId, profile) => {
      const { error } = await getClient().from("bot_subscribers").upsert({ chat_id: chatId, telegram_user_id: telegramUserId, telegram_username: profile?.telegramUsername ?? null, telegram_first_name: profile?.telegramFirstName ?? null, telegram_last_name: profile?.telegramLastName ?? null, last_seen_at: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "chat_id" });
      throwIfError(error, "register subscriber");
      return true;
    },
    listSubscriberChatIds: async () => {
      const rows = await readAll("bot_subscribers", "chat_id", (query) => query.order("chat_id", { ascending: true }).limit(1e4));
      return rows.map((row) => row.chat_id);
    },
    createBroadcastDraft: async (input) => {
      const subscriberIds = await store.listSubscriberChatIds();
      const { data, error } = await getClient().from("bot_broadcasts").insert({ owner_telegram_user_id: input.ownerTelegramUserId, kind: input.kind, message: input.message?.trim().slice(0, 4e3) ?? null, file_id: input.fileId ?? null, file_name: input.fileName?.slice(0, 255) ?? null, caption: input.caption?.trim().slice(0, 1e3) ?? null, recipient_count: subscriberIds.length }).select("id,owner_telegram_user_id,kind,message,file_id,file_name,caption,status,recipient_count").limit(1).maybeSingle();
      throwIfError(error, "create broadcast");
      return data ? { id: Number(data.id), ownerTelegramUserId: data.owner_telegram_user_id, kind: data.kind, message: data.message, fileId: data.file_id, fileName: data.file_name, caption: data.caption, status: data.status, recipientCount: Number(data.recipient_count) } : void 0;
    },
    getBroadcastDraft: async (id, ownerTelegramUserId) => {
      const { data, error } = await getClient().from("bot_broadcasts").select("id,owner_telegram_user_id,kind,message,file_id,file_name,caption,status,recipient_count").eq("id", id).eq("owner_telegram_user_id", ownerTelegramUserId).limit(1).maybeSingle();
      throwIfError(error, "get broadcast");
      return data ? { id: Number(data.id), ownerTelegramUserId: data.owner_telegram_user_id, kind: data.kind, message: data.message, fileId: data.file_id, fileName: data.file_name, caption: data.caption, status: data.status, recipientCount: Number(data.recipient_count) } : void 0;
    },
    cancelBroadcastDraft: async (id, ownerTelegramUserId) => {
      const { data, error } = await getClient().from("bot_broadcasts").update({ status: "cancelled", completed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).eq("owner_telegram_user_id", ownerTelegramUserId).eq("status", "draft").select("id");
      throwIfError(error, "cancel broadcast");
      return Array.isArray(data) && data.length > 0;
    },
    beginBroadcast: async (id, ownerTelegramUserId) => {
      const { data, error } = await getClient().from("bot_broadcasts").update({ status: "sending" }).eq("id", id).eq("owner_telegram_user_id", ownerTelegramUserId).eq("status", "draft").select("id");
      throwIfError(error, "begin broadcast");
      return Array.isArray(data) && data.length > 0;
    },
    completeBroadcast: async (id, ownerTelegramUserId, successCount, failureCount) => {
      const { data, error } = await getClient().from("bot_broadcasts").update({ status: "sent", success_count: successCount, failure_count: failureCount, completed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).eq("owner_telegram_user_id", ownerTelegramUserId).eq("status", "sending").select("id");
      throwIfError(error, "complete broadcast");
      return Array.isArray(data) && data.length > 0;
    },
    getJudicialFolderContents: (folderId, page) => folderContents("judicial", folderId, page),
    beginJudicialSearch: (chatId) => beginSearch(chatId, "judicial"),
    consumeJudicialSearchQuery: (chatId, query) => consumeSearch(chatId, "judicial", query),
    searchJudicialSources: (sessionId, page) => searchSourceScope("judicial", sessionId, page, "judicial"),
    getLegislationFolderContents: (folderId, page) => folderContents("legislation", folderId, page),
    getYemeniLawsFolderContents: (folderId, page) => folderContents("yemeni_laws", folderId, page),
    getLegalFormsFolderContents: (folderId, page) => Promise.resolve(getLegalFormsFolderContents2(folderId, page)),
    getIllustratedLegalFormsFolderContents: (folderId, page) => Promise.resolve(getIllustratedLegalFormsFolderContents2(folderId, page)),
    getAllYemeniLawsFolderContents: (folderId, page) => folderContents("all_yemeni_laws", folderId, page),
    getFeaturedReferencesFolderContents: (folderId, page) => Promise.resolve(getLegalFormsFolderContents2(folderId === FEATURED_REFERENCES_ROOT_FOLDER_ID ? LEGAL_FORMS_ROOT_FOLDER_ID : folderId, page)),
    getImportantYemeniLawsFolderContents: (folderId, page) => folderContents("important_yemeni_laws", folderId, page),
    hasImportantYemeniLawsAccess: (telegramUserId) => hasScopedAccess(telegramUserId, "important_laws"),
    hasManagedMenuItemPremiumAccess: (telegramUserId, menuItemId) => hasScopedAccess(telegramUserId, "managed_menu", menuItemId),
    hasReferralPremiumAccess: (telegramUserId, scope) => hasScopedAccess(telegramUserId, scope),
    createReferral: async (referrerTelegramUserId, refereeTelegramUserId, refereeChatId) => {
      if (referrerTelegramUserId === refereeTelegramUserId) return "self_referral";
      const referrer = await getClient().from("bot_subscribers").select("telegram_user_id").eq("telegram_user_id", referrerTelegramUserId).limit(1).maybeSingle();
      throwIfError(referrer.error, "check referrer");
      if (!referrer.data) return "referrer_not_found";
      const existing = await getClient().from("bot_referrals").select("status").eq("referee_telegram_user_id", refereeTelegramUserId).limit(1).maybeSingle();
      throwIfError(existing.error, "check referral");
      if (existing.data) return "already_referred";
      const { error } = await getClient().from("bot_referrals").insert({ referrer_telegram_user_id: referrerTelegramUserId, referee_telegram_user_id: refereeTelegramUserId, referee_chat_id: refereeChatId });
      throwIfError(error, "create referral");
      return "created";
    },
    qualifyReferral: async (refereeTelegramUserId) => {
      const client = getClient();
      const pending = await client.from("bot_referrals").select("id,referrer_telegram_user_id,referee_chat_id").eq("referee_telegram_user_id", refereeTelegramUserId).eq("status", "pending").limit(1).maybeSingle();
      throwIfError(pending.error, "find referral");
      if (!pending.data) return { qualified: false };
      const referral = pending.data;
      const { data: updated, error: updateError } = await client.from("bot_referrals").update({ status: "qualified", qualified_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", referral.id).eq("status", "pending").select("id");
      throwIfError(updateError, "qualify referral");
      if (!Array.isArray(updated) || updated.length === 0) return { qualified: false };
      const countResult = await client.from("bot_referrals").select("id", { count: "exact", head: true }).eq("referrer_telegram_user_id", referral.referrer_telegram_user_id).eq("status", "qualified");
      throwIfError(countResult.error, "count referrals");
      const qualifiedCount = Number(countResult.count ?? 0);
      if (qualifiedCount > 0 && qualifiedCount % 5 === 0) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
        for (const scope of ["sharia_exams", "secondary_exams"]) {
          const { error } = await client.from("bot_referral_rewards").insert({ referrer_telegram_user_id: referral.referrer_telegram_user_id, qualified_count: qualifiedCount, access_scope: scope, access_expires_at: expiresAt });
          throwIfError(error, "create referral reward");
          const { error: accessError } = await client.from("bot_user_access").upsert({ telegram_user_id: referral.referrer_telegram_user_id, access_scope: scope, managed_menu_item_id: null, expires_at: expiresAt, updated_at: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "telegram_user_id,access_scope,managed_menu_item_id" });
          throwIfError(accessError, "grant referral access");
        }
      }
      const referrerSubscriber = await client.from("bot_subscribers").select("chat_id").eq("telegram_user_id", referral.referrer_telegram_user_id).limit(1).maybeSingle();
      throwIfError(referrerSubscriber.error, "read referrer chat");
      const referrerChatId = String(referrerSubscriber.data?.chat_id ?? referral.referee_chat_id);
      return { qualified: true, event: { referrerChatId, qualifiedCount, remainingCount: Math.max(0, 5 - (qualifiedCount % 5 || 5)), rewardExpiresAt: qualifiedCount % 5 === 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3) : void 0 } };
    },
    getReferralProgress: async (telegramUserId) => {
      const client = getClient();
      const [qualified, pending, rewards] = await Promise.all([client.from("bot_referrals").select("id", { count: "exact", head: true }).eq("referrer_telegram_user_id", telegramUserId).eq("status", "qualified"), client.from("bot_referrals").select("id", { count: "exact", head: true }).eq("referrer_telegram_user_id", telegramUserId).eq("status", "pending"), client.from("bot_user_access").select("expires_at").eq("telegram_user_id", telegramUserId).in("access_scope", ["sharia_exams", "secondary_exams"]).not("expires_at", "is", null).gt("expires_at", (/* @__PURE__ */ new Date()).toISOString()).order("expires_at", { ascending: false }).limit(2)]);
      throwIfError(qualified.error, "count qualified referrals");
      throwIfError(pending.error, "count pending referrals");
      throwIfError(rewards.error, "read referral rewards");
      const rewardDates = (rewards.data ?? []).map((row) => dateValue(row.expires_at));
      return { qualifiedCount: Number(qualified.count ?? 0), pendingCount: Number(pending.count ?? 0), remainingCount: Math.max(0, 5 - (Number(qualified.count ?? 0) % 5 || 5)), activeAccessExpiresAt: rewardDates[0] ?? null };
    },
    listReferralHistory: async (telegramUserId) => {
      const { data, error } = await getClient().from("bot_referrals").select("id,status,created_at,qualified_at,rejected_at,rejection_reason").eq("referrer_telegram_user_id", telegramUserId).order("created_at", { ascending: false }).limit(50);
      throwIfError(error, "list referral history");
      return (data ?? []).map((row) => ({ id: Number(row.id), status: row.status, createdAt: dateValue(row.created_at), qualifiedAt: row.qualified_at ? dateValue(row.qualified_at) : null, rejectedAt: row.rejected_at ? dateValue(row.rejected_at) : null, rejectionReason: row.rejection_reason }));
    },
    createImportantYemeniLawsSubscriptionRequest: async (telegramUserId, chatId, profile) => {
      const accessScope = profile?.accessScope ?? "important_laws";
      const managedMenuItemId = Number.isInteger(profile?.managedMenuItemId) ? Number(profile?.managedMenuItemId) : null;
      const existing = await getClient().from("bot_subscription_requests").select("id").eq("telegram_user_id", telegramUserId).eq("access_scope", accessScope).eq("status", "pending").limit(1).maybeSingle();
      throwIfError(existing.error, "check subscription request");
      if (existing.data) return { id: Number(existing.data.id), created: false };
      const { data, error } = await getClient().from("bot_subscription_requests").insert({ telegram_user_id: telegramUserId, chat_id: chatId, access_scope: accessScope, managed_menu_item_id: managedMenuItemId, telegram_username: profile?.username?.replace(/^@/, "").slice(0, 64) ?? null, telegram_first_name: profile?.firstName?.slice(0, 128) ?? null, telegram_last_name: profile?.lastName?.slice(0, 128) ?? null, payment_method: profile?.paymentMethod?.slice(0, 32) ?? null }).select("id").limit(1).maybeSingle();
      throwIfError(error, "create subscription request");
      return data ? { id: Number(data.id), created: true } : void 0;
    },
    approveImportantYemeniLawsSubscriptionRequest: async (requestId, ownerTelegramUserId) => {
      const client = getClient();
      const pending = await client.from("bot_subscription_requests").select("id,telegram_user_id,chat_id,access_scope,managed_menu_item_id").eq("id", requestId).eq("status", "pending").limit(1).maybeSingle();
      throwIfError(pending.error, "find subscription request");
      if (!pending.data) return void 0;
      const request = pending.data;
      const { data, error } = await client.from("bot_subscription_requests").update({ status: "approved", reviewed_by: ownerTelegramUserId, reviewed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", requestId).eq("status", "pending").select("id");
      throwIfError(error, "approve subscription request");
      if (!Array.isArray(data) || data.length === 0) return void 0;
      if (request.access_scope === "important_laws") await upsertScopedAccess(request.telegram_user_id, request.managed_menu_item_id ? "managed_menu" : "important_laws", ownerTelegramUserId, request.managed_menu_item_id ? Number(request.managed_menu_item_id) : null);
      else await upsertScopedAccess(request.telegram_user_id, request.access_scope, ownerTelegramUserId);
      return { telegramUserId: request.telegram_user_id, chatId: request.chat_id, accessScope: request.access_scope, managedMenuItemId: request.managed_menu_item_id ? Number(request.managed_menu_item_id) : null };
    },
    rejectImportantYemeniLawsSubscriptionRequest: async (requestId, ownerTelegramUserId) => {
      const { data: pending, error: findError } = await getClient().from("bot_subscription_requests").select("id,telegram_user_id,chat_id,access_scope,managed_menu_item_id").eq("id", requestId).eq("status", "pending").limit(1).maybeSingle();
      throwIfError(findError, "find subscription request");
      if (!pending) return void 0;
      const { data, error } = await getClient().from("bot_subscription_requests").update({ status: "rejected", reviewed_by: ownerTelegramUserId, reviewed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", requestId).eq("status", "pending").select("id");
      throwIfError(error, "reject subscription request");
      if (!Array.isArray(data) || data.length === 0) return void 0;
      const request = pending;
      return { telegramUserId: request.telegram_user_id, chatId: request.chat_id, accessScope: request.access_scope, managedMenuItemId: request.managed_menu_item_id ? Number(request.managed_menu_item_id) : null };
    },
    listPendingImportantYemeniLawsSubscriptionRequests: async () => {
      const { data, error } = await getClient().from("bot_subscription_requests").select("id,telegram_user_id,chat_id,access_scope,managed_menu_item_id,telegram_username,telegram_first_name,telegram_last_name,payment_method,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(20);
      throwIfError(error, "list pending subscriptions");
      return (data ?? []).map((row) => ({ id: Number(row.id), telegramUserId: row.telegram_user_id, chatId: row.chat_id, accessScope: row.access_scope, managedMenuItemId: row.managed_menu_item_id ? Number(row.managed_menu_item_id) : null, telegramUsername: row.telegram_username, telegramFirstName: row.telegram_first_name, telegramLastName: row.telegram_last_name, paymentMethod: row.payment_method, createdAt: dateValue(row.created_at) }));
    },
    beginLegislationSearch: (chatId) => beginSearch(chatId, "legislation"),
    consumeLegislationSearchQuery: (chatId, query) => consumeSearch(chatId, "legislation", query),
    searchLegislationSources: (sessionId, page) => searchSourceScope("legislation", sessionId, page, "legislation"),
    beginAllYemeniLawsSearch: (chatId) => beginSearch(chatId, "all_yemeni_laws"),
    consumeAllYemeniLawsSearchQuery: (chatId, query) => consumeSearch(chatId, "all_yemeni_laws", query),
    searchAllYemeniLawsSources: (sessionId, page) => searchSourceScope("all_yemeni_laws", sessionId, page, "all_yemeni_laws"),
    beginLibrarySearch: (chatId) => beginSearch(chatId, "library"),
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
    getGroupExamWaitingRound: async (chatId, subjectKey, sectionKey) => {
      const { data, error } = await getClient().from("bot_group_exam_rounds").select("id,chat_id,creator_telegram_user_id,subject_key,section_key,status,question_index,time_limit_seconds,active_poll_id,started_at").eq("chat_id", chatId).eq("subject_key", subjectKey).eq("section_key", sectionKey).eq("status", "waiting").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      throwIfError(error, "find waiting group round");
      return data ? mapRound(data) : void 0;
    },
    createGroupExamRound: async (input) => {
      const existing = await store.getGroupExamWaitingRound(input.chatId, input.subjectKey, input.sectionKey);
      if (existing) return { round: existing, created: false };
      const { data, error } = await getClient().from("bot_group_exam_rounds").insert({ chat_id: input.chatId, creator_telegram_user_id: input.creatorTelegramUserId, subject_key: input.subjectKey, section_key: input.sectionKey, time_limit_seconds: input.timeLimitSeconds }).select("id,chat_id,creator_telegram_user_id,subject_key,section_key,status,question_index,time_limit_seconds,active_poll_id,started_at").limit(1).maybeSingle();
      throwIfError(error, "create group round");
      return data ? { round: mapRound(data), created: true } : void 0;
    },
    joinGroupExamRound: async (input) => {
      const client = getClient();
      const round = await getRoundById(input.roundId);
      if (!round || round.status !== "waiting") return void 0;
      const { data: existing, error: existingError } = await client.from("bot_group_exam_participants").select("telegram_user_id").eq("round_id", input.roundId).eq("telegram_user_id", input.telegramUserId).limit(1).maybeSingle();
      throwIfError(existingError, "check group participant");
      if (!existing) {
        const { error } = await client.from("bot_group_exam_participants").insert({ round_id: input.roundId, telegram_user_id: input.telegramUserId, display_name: input.displayName.slice(0, 128), username: input.username?.slice(0, 64) ?? null });
        throwIfError(error, "join group round");
      }
      const { count: count3, error: countError } = await client.from("bot_group_exam_participants").select("telegram_user_id", { count: "exact", head: true }).eq("round_id", input.roundId);
      throwIfError(countError, "count group participants");
      return { round, participantCount: Number(count3 ?? 0), joined: !existing };
    },
    activateGroupExamRound: async (roundId) => {
      const { data, error } = await getClient().from("bot_group_exam_rounds").update({ status: "active", started_at: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", roundId).eq("status", "waiting").select("id,chat_id,creator_telegram_user_id,subject_key,section_key,status,question_index,time_limit_seconds,active_poll_id,started_at").limit(1).maybeSingle();
      throwIfError(error, "activate group round");
      return data ? mapRound(data) : void 0;
    },
    getGroupExamRound: getRoundById,
    cancelGroupExamRound: async (roundId) => {
      const { data, error } = await getClient().from("bot_group_exam_rounds").update({ status: "cancelled", active_poll_id: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", roundId).in("status", ["waiting", "active"]).select("id");
      throwIfError(error, "cancel group round");
      return Array.isArray(data) && data.length > 0;
    },
    setGroupExamActivePoll: async (input) => {
      const { data, error } = await getClient().from("bot_group_exam_rounds").update({ active_poll_id: input.pollId, question_index: input.questionIndex, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", input.roundId).eq("status", "active").select("id");
      throwIfError(error, "set group poll");
      return Array.isArray(data) && data.length > 0;
    },
    getGroupExamRoundByPoll: async (pollId) => {
      const { data, error } = await getClient().from("bot_group_exam_rounds").select("id,chat_id,creator_telegram_user_id,subject_key,section_key,status,question_index,time_limit_seconds,active_poll_id,started_at").eq("active_poll_id", pollId).eq("status", "active").limit(1).maybeSingle();
      throwIfError(error, "find group poll");
      return data ? mapRound(data) : void 0;
    },
    recordGroupExamAnswer: async (input) => {
      const round = await store.getGroupExamRoundByPoll(input.pollId);
      if (!round) return false;
      const { error } = await getClient().from("bot_group_exam_answers").upsert({ round_id: round.id, poll_id: input.pollId, telegram_user_id: input.telegramUserId, answer: input.answer }, { onConflict: "round_id,poll_id,telegram_user_id" });
      throwIfError(error, "record group answer");
      return true;
    },
    resolveGroupExamPoll: async (pollId) => {
      const round = await store.getGroupExamRoundByPoll(pollId);
      if (!round) return void 0;
      const questions = await listSupabaseBotExamQuestions(round.subjectKey, round.sectionKey);
      const question = questions[round.questionIndex];
      if (!question) return void 0;
      const answers = await getClient().from("bot_group_exam_answers").select("telegram_user_id,answer").eq("round_id", round.id).eq("poll_id", pollId).limit(1e3);
      throwIfError(answers.error, "read group answers");
      const participants = await getClient().from("bot_group_exam_participants").select("telegram_user_id,score,incorrect_count,missed_count").eq("round_id", round.id).limit(100);
      throwIfError(participants.error, "read group participants");
      const participantRows = participants.data ?? [];
      const answerRows = answers.data ?? [];
      const byUser = new Map(answerRows.map((row) => [row.telegram_user_id, row.answer]));
      let correctCount = 0;
      let incorrectCount = 0;
      let missedCount = 0;
      for (const participant of participantRows) {
        const answer = byUser.get(participant.telegram_user_id);
        const isCorrect = answer === question.correctOption;
        if (!answer) missedCount += 1;
        else if (isCorrect) correctCount += 1;
        else incorrectCount += 1;
        const patch = { score: Number(participant.score) + (isCorrect ? 1 : 0), incorrect_count: Number(participant.incorrect_count) + (!isCorrect && answer ? 1 : 0), missed_count: Number(participant.missed_count) + (!answer ? 1 : 0) };
        const { error } = await getClient().from("bot_group_exam_participants").update(patch).eq("round_id", round.id).eq("telegram_user_id", participant.telegram_user_id);
        throwIfError(error, "update group score");
      }
      const nextQuestionIndex = round.questionIndex + 1;
      const completed = nextQuestionIndex >= questions.length;
      const { error: roundError } = await getClient().from("bot_group_exam_rounds").update({ question_index: nextQuestionIndex, active_poll_id: null, status: completed ? "completed" : "active", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", round.id);
      throwIfError(roundError, "advance group round");
      const result = { question, correctCount, incorrectCount, missedCount, participantCount: participantRows.length, nextQuestionIndex, total: questions.length, completed };
      return result;
    },
    getGroupExamLeaderboard: async (roundId) => {
      const { data, error } = await getClient().from("bot_group_exam_participants").select("telegram_user_id,display_name,score,incorrect_count,missed_count").eq("round_id", roundId).order("score", { ascending: false }).order("incorrect_count", { ascending: true }).order("missed_count", { ascending: true }).limit(100);
      throwIfError(error, "group leaderboard");
      return (data ?? []).map((row) => ({ telegramUserId: row.telegram_user_id, displayName: row.display_name, score: Number(row.score), incorrectCount: Number(row.incorrect_count), missedCount: Number(row.missed_count) }));
    }
  };
  return store;
}
function mapManagedMenuItem(row) {
  return { id: Number(row.id), label: String(row.label ?? ""), actionType: row.action_type, actionValue: String(row.action_value ?? ""), rowIndex: Number(row.row_index ?? 0), sortOrder: Number(row.sort_order ?? 0), accessMode: row.access_mode };
}
function mapManagedSection(row) {
  return { sectionKey: String(row.section_key), displayLabel: String(row.display_label ?? ""), enabled: Boolean(row.enabled), accessMode: row.access_mode, sortOrder: Number(row.sort_order ?? 0) };
}
function mapManagedMessage(row) {
  return { messageKey: row.message_key, content: String(row.content ?? "") };
}
async function listSupabaseBotManagedMenuItems(includeDisabled = false) {
  let query = getClient().from("bot_managed_menu_items").select("id,label,action_type,action_value,row_index,sort_order,access_mode,enabled").order("row_index", { ascending: true }).order("sort_order", { ascending: true }).order("id", { ascending: true }).limit(200);
  if (!includeDisabled) query = query.eq("enabled", true);
  const { data, error } = await query;
  throwIfError(error, "list managed menu items");
  return (data ?? []).map(mapManagedMenuItem);
}
async function createSupabaseBotManagedMenuItem(input, adminUserId) {
  const label = typeof input?.label === "string" ? input.label.trim().slice(0, 255) : "";
  const actionType = input?.actionType;
  const actionValue = typeof input?.actionValue === "string" ? input.actionValue.trim().slice(0, 4e3) : "";
  if (!label || !["url", "message", "file"].includes(actionType) || !actionValue) return void 0;
  const payload = { label, action_type: actionType, action_value: actionValue, row_index: Number.isInteger(input?.rowIndex) ? input.rowIndex : 0, sort_order: Number.isInteger(input?.sortOrder) ? input.sortOrder : 0, access_mode: ["free", "premium", "hasad"].includes(input?.accessMode) ? input.accessMode : "free", enabled: input?.enabled !== false };
  const { data, error } = await getClient().from("bot_managed_menu_items").insert(payload).select("id,label,action_type,action_value,row_index,sort_order,access_mode,enabled").limit(1).maybeSingle();
  throwIfError(error, "create managed menu item");
  if (!data) return void 0;
  await recordSupabaseBotAdminAudit(adminUserId, "create", "managed_menu_item", Number(data.id), payload);
  return mapManagedMenuItem(data);
}
async function updateSupabaseBotManagedMenuItem(id, input, adminUserId) {
  if (!Number.isInteger(id) || id < 1) return void 0;
  const patch = {};
  if (typeof input?.label === "string" && input.label.trim()) patch.label = input.label.trim().slice(0, 255);
  if (["url", "message", "file"].includes(input?.actionType)) patch.action_type = input.actionType;
  if (typeof input?.actionValue === "string" && input.actionValue.trim()) patch.action_value = input.actionValue.trim().slice(0, 4e3);
  if (Number.isInteger(input?.rowIndex)) patch.row_index = input.rowIndex;
  if (Number.isInteger(input?.sortOrder)) patch.sort_order = input.sortOrder;
  if (["free", "premium", "hasad"].includes(input?.accessMode)) patch.access_mode = input.accessMode;
  if (typeof input?.enabled === "boolean") patch.enabled = input.enabled;
  if (Object.keys(patch).length === 0) return void 0;
  patch.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  const { data, error } = await getClient().from("bot_managed_menu_items").update(patch).eq("id", id).select("id,label,action_type,action_value,row_index,sort_order,access_mode,enabled").limit(1).maybeSingle();
  throwIfError(error, "update managed menu item");
  if (!data) return void 0;
  await recordSupabaseBotAdminAudit(adminUserId, "update", "managed_menu_item", id, patch);
  return mapManagedMenuItem(data);
}
async function deleteSupabaseBotManagedMenuItem(id, adminUserId) {
  const { data, error } = await getClient().from("bot_managed_menu_items").delete().eq("id", id).select("id");
  throwIfError(error, "delete managed menu item");
  if (!Array.isArray(data) || data.length === 0) return false;
  await recordSupabaseBotAdminAudit(adminUserId, "delete", "managed_menu_item", id, {});
  return true;
}
async function listSupabaseBotManagedSections() {
  const { data, error } = await getClient().from("bot_managed_sections").select("section_key,display_label,enabled,access_mode,sort_order").order("sort_order", { ascending: true }).limit(100);
  throwIfError(error, "list managed sections");
  return (data ?? []).map(mapManagedSection);
}
async function updateSupabaseBotManagedSection(sectionKey, input, adminUserId) {
  const key = sectionKey.trim().slice(0, 64);
  if (!key) return void 0;
  const payload = { section_key: key, display_label: typeof input?.displayLabel === "string" && input.displayLabel.trim() ? input.displayLabel.trim().slice(0, 255) : key, enabled: input?.enabled !== false, access_mode: ["subscription", "free", "premium", "hasad"].includes(input?.accessMode) ? input.accessMode : "premium", sort_order: Number.isInteger(input?.sortOrder) ? input.sortOrder : 0, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  const { data, error } = await getClient().from("bot_managed_sections").upsert(payload, { onConflict: "section_key" }).select("section_key,display_label,enabled,access_mode,sort_order").limit(1).maybeSingle();
  throwIfError(error, "update managed section");
  if (!data) return void 0;
  await recordSupabaseBotAdminAudit(adminUserId, "update", "managed_section", key, payload);
  return mapManagedSection(data);
}
async function listSupabaseBotManagedMessages() {
  const { data, error } = await getClient().from("bot_managed_messages").select("message_key,content").order("message_key", { ascending: true }).limit(20);
  throwIfError(error, "list managed messages");
  return (data ?? []).map(mapManagedMessage);
}
async function updateSupabaseBotManagedMessage(messageKey, content, adminUserId) {
  if (!["welcome", "about", "help"].includes(messageKey) || typeof content !== "string" || !content.trim()) return void 0;
  const payload = { message_key: messageKey, content: content.trim().slice(0, 4e3), updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  const { data, error } = await getClient().from("bot_managed_messages").upsert(payload, { onConflict: "message_key" }).select("message_key,content").limit(1).maybeSingle();
  throwIfError(error, "update managed message");
  if (!data) return void 0;
  await recordSupabaseBotAdminAudit(adminUserId, "update", "managed_message", messageKey, payload);
  return mapManagedMessage(data);
}
async function listSupabaseBotBroadcasts(limit = 20) {
  const { data, error } = await getClient().from("bot_broadcasts").select("id,kind,message,status,recipient_count,success_count,failure_count,created_at,completed_at").order("created_at", { ascending: false }).limit(Math.max(1, Math.min(100, limit)));
  throwIfError(error, "list broadcasts");
  return (data ?? []).map((row) => ({ id: Number(row.id), kind: row.kind, message: row.message, status: row.status, recipientCount: Number(row.recipient_count ?? 0), successCount: Number(row.success_count ?? 0), failureCount: Number(row.failure_count ?? 0), createdAt: dateValue(row.created_at), completedAt: row.completed_at ? dateValue(row.completed_at) : null }));
}
async function listSupabaseBotAdminAuditLogs(limit = 100) {
  const { data, error } = await getClient().from("bot_admin_audit_logs").select("id,admin_user_id,action,entity_type,entity_id,details,created_at").order("created_at", { ascending: false }).limit(Math.max(1, Math.min(200, limit)));
  throwIfError(error, "list admin audit logs");
  return (data ?? []).map((row) => ({ id: Number(row.id), adminUserId: row.admin_user_id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, details: row.details, createdAt: dateValue(row.created_at) }));
}
async function recordSupabaseBotAdminAudit(adminUserId, action, entityType, entityId, details = {}) {
  const { error } = await getClient().from("bot_admin_audit_logs").insert({ admin_user_id: adminUserId, action, entity_type: entityType, entity_id: entityId === null ? null : String(entityId), details });
  throwIfError(error, "record admin audit");
}
async function confirmSupabaseBotPlatformAccess(telegramUserId, region) {
  const { error } = await getClient().from("bot_platform_access").upsert({ telegram_user_id: telegramUserId, confirmed_at: (/* @__PURE__ */ new Date()).toISOString(), web_app_verified_at: (/* @__PURE__ */ new Date()).toISOString(), region: region ?? null }, { onConflict: "telegram_user_id" });
  throwIfError(error, "confirm platform access");
}
async function confirmSupabaseBotHasadAccess(telegramUserId, region) {
  const { error } = await getClient().from("bot_hasad_access").upsert({ telegram_user_id: telegramUserId, visited_at: (/* @__PURE__ */ new Date()).toISOString(), region: region ?? null }, { onConflict: "telegram_user_id" });
  throwIfError(error, "confirm Hasad access");
}

// server/telegramWebhook.ts
var TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
var PLATFORM_ORIGIN = "https://alnaseer.org";
var PLATFORM_PREVIEW_ORIGIN = "https://alnaser-2hb0san58-hasadalyoum.vercel.app";
var PLATFORM_ADMIN_ORIGINS = /* @__PURE__ */ new Set([PLATFORM_ORIGIN, PLATFORM_PREVIEW_ORIGIN]);
var TELEGRAM_VERCEL_ORIGIN = "https://alnasser-legal-telegram-bot-supabase-git-sup-f04e08-hasadalyoum.vercel.app";
var TELEGRAM_VISIT_ORIGINS = /* @__PURE__ */ new Set([
  PLATFORM_ORIGIN,
  TELEGRAM_VERCEL_ORIGIN,
  "https://www.hasad-alyoum.com",
  "https://hasad-alyoum.com",
  "https://web.telegram.org",
  "https://telegram.org",
  "null"
]);
var PLATFORM_SUPABASE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co";
function normalizeTelegramRegion(value) {
  if (typeof value !== "string") return null;
  const region = value.trim();
  return /^[A-Za-z_+-]+\/[A-Za-z_+\-/]+$/.test(region) && region.length <= 64 ? region : null;
}
function normalizeScheduledBroadcastTime(value, now = /* @__PURE__ */ new Date()) {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return void 0;
  const scheduledFor = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), parsed.getUTCHours(), parsed.getUTCMinutes(), 0));
  if (scheduledFor.getTime() < now.getTime() + 6e4 || scheduledFor.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1e3) return void 0;
  return scheduledFor;
}
function scheduledBroadcastCron(scheduledFor) {
  return `0 ${scheduledFor.getUTCMinutes()} ${scheduledFor.getUTCHours()} ${scheduledFor.getUTCDate()} ${scheduledFor.getUTCMonth() + 1} *`;
}
var TELEGRAM_LIBRARY_UPLOAD_TYPES = /* @__PURE__ */ new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain"
]);
var TELEGRAM_LIBRARY_UPLOAD_TYPES_BY_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain"
};
function resolveTelegramLibraryUploadContentType(fileName, suppliedType) {
  const normalizedType = typeof suppliedType === "string" ? suppliedType.split(";", 1)[0]?.trim().toLowerCase() : "";
  if (normalizedType && TELEGRAM_LIBRARY_UPLOAD_TYPES.has(normalizedType)) return normalizedType;
  const extension = typeof fileName === "string" ? fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] : void 0;
  return extension ? TELEGRAM_LIBRARY_UPLOAD_TYPES_BY_EXTENSION[extension] : void 0;
}
function createTelegramLibraryStorageKey(fileName, now = Date.now(), randomId = crypto.randomUUID()) {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]{1,10})$/)?.[0] ?? "";
  return `telegram-library/${now}-${randomId.replace(/[^a-zA-Z0-9-]/g, "")}${extension}`;
}
async function getPlatformAdministratorId(authorization) {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !serviceRoleKey) return void 0;
  const userResponse = await fetch(`${PLATFORM_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) return void 0;
  const user = await userResponse.json();
  if (!user.id) return void 0;
  const roleResponse = await fetch(`${PLATFORM_SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
  });
  if (!roleResponse.ok) return void 0;
  const roles = await roleResponse.json();
  return roles.some((role) => role.role === "admin") ? user.id : void 0;
}
async function isPlatformAdministrator(authorization) {
  return Boolean(await getPlatformAdministratorId(authorization));
}
function isValidTelegramWebhookSecret(receivedSecret, expectedSecret) {
  if (!receivedSecret || !expectedSecret) return false;
  const received = Buffer.from(receivedSecret);
  const expected = Buffer.from(expectedSecret);
  return received.length === expected.length && timingSafeEqual2(received, expected);
}
function registerTelegramWebhook(app2) {
  app2.get("/api/telegram/health", (_req, res) => {
    res.json({
      ok: true,
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET)
    });
  });
  const setPlatformVisitCors = (req, res) => {
    const origin = req.get("origin");
    if (origin && TELEGRAM_VISIT_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
  };
  const setPlatformAdminCors = (req, res) => {
    const origin = req.get("origin");
    if (origin && PLATFORM_ADMIN_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Vary", "Origin");
  };
  app2.options("/api/telegram/admin/*", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.options("/api/telegram/admin-stats", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin-stats", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    try {
      if (process.env.BOT_STORAGE_MODE === "supabase") {
        const supabaseStore = createSupabaseBotStore();
        const subscribers = await supabaseStore.listSubscriberChatIds();
        const usage = await supabaseStore.getOwnerStatistics();
        res.status(200).json({ ok: true, totalSubscribers: subscribers.length, firstSubscribedAt: null, lastActiveAt: null, regions: [], platformVisits: { total: 0, latestAt: null }, hasadVisits: { total: 0, latestAt: null }, usage });
        return;
      }
      const stats = await getTelegramOwnerStatistics();
      res.status(200).json({
        ok: true,
        totalSubscribers: stats.totalSubscribers,
        firstSubscribedAt: stats.firstSubscribedAt?.toISOString() ?? null,
        lastActiveAt: stats.lastActiveAt?.toISOString() ?? null,
        regions: stats.regions,
        platformVisits: {
          total: stats.platformVisits.total,
          latestAt: stats.platformVisits.latestAt?.toISOString() ?? null
        },
        hasadVisits: {
          total: stats.hasadVisits.total,
          latestAt: stats.hasadVisits.latestAt?.toISOString() ?? null
        }
      });
    } catch (error) {
      console.error("[Telegram] Platform admin statistics failed:", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ ok: false });
    }
  });
  app2.options("/api/telegram/admin/menu-items", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin/menu-items", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, items: process.env.BOT_STORAGE_MODE === "supabase" ? await listSupabaseBotManagedMenuItems(true) : await listManagedTelegramMenuItems(true) });
  });
  app2.post("/api/telegram/admin/menu-items", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const item = process.env.BOT_STORAGE_MODE === "supabase" ? await createSupabaseBotManagedMenuItem(req.body ?? {}, adminUserId) : await createManagedTelegramMenuItem(req.body ?? {}, adminUserId);
    if (!item) {
      res.status(400).json({ ok: false, error: "invalid_menu_item" });
      return;
    }
    res.status(201).json({ ok: true, item });
  });
  app2.post("/api/telegram/admin/menu-items/upload", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.replace(/[\\/\u0000]/g, "_").slice(0, 180) : "";
    const contentBase64 = typeof req.body?.contentBase64 === "string" ? req.body.contentBase64.replace(/^data:[^;]+;base64,/, "") : "";
    const contentType = resolveTelegramLibraryUploadContentType(fileName, req.body?.contentType);
    if (!fileName || !contentBase64 || !contentType) {
      res.status(400).json({ ok: false, error: !fileName ? "file_name_required" : !contentBase64 ? "file_content_required" : "unsupported_file_type" });
      return;
    }
    if (contentBase64.length > 40 * 1024 * 1024) {
      res.status(400).json({ ok: false, error: "file_too_large" });
      return;
    }
    try {
      const data = Buffer.from(contentBase64, "base64");
      if (data.byteLength === 0 || data.byteLength > 30 * 1024 * 1024) {
        res.status(400).json({ ok: false, error: data.byteLength === 0 ? "empty_file" : "file_too_large" });
        return;
      }
      const stored = await storagePut(createTelegramLibraryStorageKey(fileName), data, contentType);
      const item = await createManagedTelegramMenuItem({ ...req.body, actionType: "file", actionValue: stored.url }, adminUserId);
      if (!item) {
        res.status(400).json({ ok: false, error: "invalid_menu_item" });
        return;
      }
      res.status(201).json({ ok: true, item });
    } catch (error) {
      console.error("[Telegram] Admin menu item file upload failed:", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ ok: false, error: "storage_upload_failed" });
    }
  });
  app2.put("/api/telegram/admin/menu-items/:id/upload", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    const itemId = Number(req.params.id);
    if (!adminUserId || !Number.isInteger(itemId) || itemId < 1) {
      res.status(403).json({ ok: false });
      return;
    }
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.replace(/[\\/\u0000]/g, "_").slice(0, 180) : "";
    const contentBase64 = typeof req.body?.contentBase64 === "string" ? req.body.contentBase64.replace(/^data:[^;]+;base64,/, "") : "";
    const contentType = resolveTelegramLibraryUploadContentType(fileName, req.body?.contentType);
    if (!fileName || !contentBase64 || !contentType) {
      res.status(400).json({ ok: false, error: !fileName ? "file_name_required" : !contentBase64 ? "file_content_required" : "unsupported_file_type" });
      return;
    }
    try {
      const data = Buffer.from(contentBase64, "base64");
      if (data.byteLength === 0 || data.byteLength > 30 * 1024 * 1024) {
        res.status(400).json({ ok: false, error: data.byteLength === 0 ? "empty_file" : "file_too_large" });
        return;
      }
      const stored = await storagePut(createTelegramLibraryStorageKey(fileName), data, contentType);
      const item = process.env.BOT_STORAGE_MODE === "supabase" ? await updateSupabaseBotManagedMenuItem(itemId, { ...req.body, actionType: "file", actionValue: stored.url }, adminUserId) : await updateManagedTelegramMenuItem(itemId, { ...req.body, actionType: "file", actionValue: stored.url }, adminUserId);
      if (!item) {
        res.status(400).json({ ok: false, error: "invalid_menu_item" });
        return;
      }
      res.status(200).json({ ok: true, item });
    } catch (error) {
      console.error("[Telegram] Admin menu item file update failed:", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ ok: false, error: "storage_upload_failed" });
    }
  });
  app2.put("/api/telegram/admin/menu-items/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const item = process.env.BOT_STORAGE_MODE === "supabase" ? await updateSupabaseBotManagedMenuItem(Number(req.params.id), req.body ?? {}, adminUserId) : await updateManagedTelegramMenuItem(Number(req.params.id), req.body ?? {}, adminUserId);
    if (!item) {
      res.status(400).json({ ok: false, error: "invalid_menu_item" });
      return;
    }
    res.status(200).json({ ok: true, item });
  });
  app2.delete("/api/telegram/admin/menu-items/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId || !await (process.env.BOT_STORAGE_MODE === "supabase" ? deleteSupabaseBotManagedMenuItem(Number(req.params.id), adminUserId) : deleteManagedTelegramMenuItem(Number(req.params.id), adminUserId))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true });
  });
  app2.options("/api/telegram/admin/sections", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin/sections", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, sections: process.env.BOT_STORAGE_MODE === "supabase" ? await listSupabaseBotManagedSections() : await listManagedTelegramSectionConfigs() });
  });
  app2.put("/api/telegram/admin/sections/:sectionKey", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const section = process.env.BOT_STORAGE_MODE === "supabase" ? await updateSupabaseBotManagedSection(req.params.sectionKey, req.body ?? {}, adminUserId) : await updateManagedTelegramSection(req.params.sectionKey, req.body ?? {}, adminUserId);
    if (!section) {
      res.status(400).json({ ok: false, error: "invalid_section" });
      return;
    }
    res.status(200).json({ ok: true, section });
  });
  app2.get("/api/telegram/admin/audit-logs", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, logs: process.env.BOT_STORAGE_MODE === "supabase" ? await listSupabaseBotAdminAuditLogs() : await listTelegramAdminAuditLogs() });
  });
  app2.options("/api/telegram/admin/audit-logs", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.options("/api/telegram/admin/message-templates", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin/message-templates", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, templates: process.env.BOT_STORAGE_MODE === "supabase" ? await listSupabaseBotManagedMessages() : await listManagedTelegramMessageConfigs() });
  });
  app2.put("/api/telegram/admin/message-templates/:messageKey", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const template = process.env.BOT_STORAGE_MODE === "supabase" ? await updateSupabaseBotManagedMessage(req.params.messageKey, req.body?.content, adminUserId) : await updateManagedTelegramMessageTemplate(req.params.messageKey, req.body?.content, adminUserId);
    if (!template) {
      res.status(400).json({ ok: false, error: "invalid_message_template" });
      return;
    }
    res.status(200).json({ ok: true, template });
  });
  app2.options("/api/telegram/admin/sources", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin/sources", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const page = Number(req.query.page ?? 1);
    res.status(200).json({ ok: true, ...await listManagedTelegramSources(query, page) });
  });
  app2.put("/api/telegram/admin/sources/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const source = await updateManagedTelegramSource(Number(req.params.id), req.body ?? {}, adminUserId);
    if (!source) {
      res.status(400).json({ ok: false, error: "invalid_source" });
      return;
    }
    res.status(200).json({ ok: true, source });
  });
  app2.delete("/api/telegram/admin/sources/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId || !await deleteManagedTelegramSource(Number(req.params.id), adminUserId)) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true });
  });
  app2.options("/api/telegram/admin/sources/upload", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.post("/api/telegram/admin/sources/upload", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.replace(/[\\/\u0000]/g, "_").slice(0, 180) : "";
    const contentBase64 = typeof req.body?.contentBase64 === "string" ? req.body.contentBase64.replace(/^data:[^;]+;base64,/, "") : "";
    const contentType = resolveTelegramLibraryUploadContentType(fileName, req.body?.contentType);
    if (!fileName) {
      res.status(400).json({ ok: false, error: "file_name_required" });
      return;
    }
    if (!contentBase64) {
      res.status(400).json({ ok: false, error: "file_content_required" });
      return;
    }
    if (!contentType) {
      res.status(400).json({ ok: false, error: "unsupported_file_type" });
      return;
    }
    if (contentBase64.length > 40 * 1024 * 1024) {
      res.status(400).json({ ok: false, error: "file_too_large" });
      return;
    }
    try {
      const data = Buffer.from(contentBase64, "base64");
      if (data.byteLength === 0 || data.byteLength > 30 * 1024 * 1024) {
        res.status(400).json({ ok: false, error: data.byteLength === 0 ? "empty_file" : "file_too_large" });
        return;
      }
      const stored = await storagePut(createTelegramLibraryStorageKey(fileName), data, contentType);
      const source = await createManagedTelegramSource({ ...req.body, title: req.body?.title || fileName, url: stored.url }, adminUserId);
      if (!source) {
        res.status(400).json({ ok: false, error: "invalid_source_fields" });
        return;
      }
      res.status(201).json({ ok: true, source });
    } catch (error) {
      console.error("[Telegram] Admin source upload failed:", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ ok: false, error: "storage_upload_failed" });
    }
  });
  app2.options("/api/telegram/admin/folders", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin/folders", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    const query = typeof req.query.q === "string" ? req.query.q : "";
    res.status(200).json({ ok: true, folders: await listManagedTelegramFolders(query) });
  });
  app2.put("/api/telegram/admin/folders/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const folder = await updateManagedTelegramFolder(Number(req.params.id), req.body ?? {}, adminUserId);
    if (!folder) {
      res.status(400).json({ ok: false, error: "invalid_folder" });
      return;
    }
    res.status(200).json({ ok: true, folder });
  });
  app2.delete("/api/telegram/admin/folders/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const outcome = await deleteManagedTelegramFolder(Number(req.params.id), adminUserId);
    if (outcome === "not_empty") {
      res.status(409).json({ ok: false, error: "folder_not_empty" });
      return;
    }
    if (outcome !== "deleted") {
      res.status(400).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true });
  });
  app2.options("/api/telegram/admin/broadcasts", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin/broadcasts", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, broadcasts: process.env.BOT_STORAGE_MODE === "supabase" ? await listSupabaseBotBroadcasts() : await listManagedTelegramBroadcasts() });
  });
  app2.post("/api/telegram/admin/broadcasts", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const broadcast = process.env.BOT_STORAGE_MODE === "supabase" ? await createSupabaseBotStore().createBroadcastDraft({ ownerTelegramUserId: adminUserId, kind: "message", message: typeof req.body?.message === "string" ? req.body.message : "" }) : await createManagedTelegramBroadcastDraft(adminUserId, req.body?.message);
    if (!broadcast) {
      res.status(400).json({ ok: false, error: "invalid_broadcast" });
      return;
    }
    res.status(201).json({ ok: true, broadcast });
  });
  app2.post("/api/telegram/admin/broadcasts/:id/cancel", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    const id = Number(req.params.id);
    const supabaseStore = process.env.BOT_STORAGE_MODE === "supabase" ? createSupabaseBotStore() : void 0;
    const draft = adminUserId ? supabaseStore ? await supabaseStore.getBroadcastDraft(id, adminUserId) : await getTelegramBroadcastDraft(id, adminUserId) : void 0;
    if (!adminUserId || !draft || !await (supabaseStore ? supabaseStore.cancelBroadcastDraft(id, adminUserId) : cancelTelegramBroadcastDraft(id, adminUserId))) {
      res.status(400).json({ ok: false });
      return;
    }
    const scheduleCronTaskUid = draft.scheduleCronTaskUid;
    if (scheduleCronTaskUid) await deleteHeartbeatJob(scheduleCronTaskUid, "").catch(() => void 0);
    if (supabaseStore) await recordSupabaseBotAdminAudit(adminUserId, "cancel", "broadcast", id, {});
    else await recordManagedTelegramBroadcastAudit(adminUserId, id, "cancel");
    res.status(200).json({ ok: true });
  });
  app2.post("/api/telegram/admin/broadcasts/:id/schedule", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    const id = Number(req.params.id);
    const scheduledFor = normalizeScheduledBroadcastTime(req.body?.scheduledFor);
    if (!adminUserId || req.body?.confirmation !== "SCHEDULE" || !Number.isInteger(id) || id < 1 || !scheduledFor) {
      res.status(400).json({ ok: false, error: "invalid_schedule" });
      return;
    }
    const draft = await getTelegramBroadcastDraft(id, adminUserId);
    if (!draft || draft.status !== "draft" || draft.kind !== "message" || !draft.message || draft.scheduleCronTaskUid) {
      res.status(400).json({ ok: false, error: "unavailable_broadcast" });
      return;
    }
    try {
      const cron = scheduledBroadcastCron(scheduledFor);
      const job = await createHeartbeatJob({
        name: `telegram-broadcast-${id}-${scheduledFor.getTime()}`,
        cron,
        path: "/api/scheduled/telegram-broadcast",
        description: `\u0628\u062B \u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645 \u0645\u062C\u062F\u0648\u0644 #${id} \u0641\u064A ${scheduledFor.toISOString()}`
      }, "");
      if (!await scheduleTelegramBroadcast(id, adminUserId, scheduledFor, job.taskUid)) {
        await deleteHeartbeatJob(job.taskUid, "").catch(() => void 0);
        res.status(409).json({ ok: false, error: "schedule_conflict" });
        return;
      }
      await recordManagedTelegramBroadcastAudit(adminUserId, id, "schedule", { scheduledFor: scheduledFor.toISOString(), taskUid: job.taskUid });
      res.status(200).json({ ok: true, id, scheduledFor, nextExecutionAt: job.nextExecutionAt ?? null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "schedule_failed";
      res.status(500).json({ ok: false, error: message });
    }
  });
  app2.post("/api/scheduled/telegram-broadcast", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        res.status(403).json({ error: "cron_only" });
        return;
      }
      const draft = await getScheduledTelegramBroadcast(user.taskUid);
      if (!draft || draft.status !== "draft" || !draft.scheduledFor) {
        res.json({ ok: true, skipped: "orphan_or_inactive" });
        return;
      }
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (draft.kind !== "message" || !draft.message || !token) throw new Error("scheduled_broadcast_unavailable");
      if (!await beginScheduledTelegramBroadcast(draft.id, user.taskUid)) {
        res.json({ ok: true, skipped: "already_claimed" });
        return;
      }
      const sender = createTelegramSender(token);
      const recipients = await listTelegramSubscriberChatIds();
      let successCount = 0;
      let failureCount = 0;
      for (const recipient of recipients) {
        const chatId = Number(recipient);
        if (!Number.isSafeInteger(chatId)) {
          failureCount += 1;
          continue;
        }
        try {
          await sender.sendMessage(chatId, draft.message);
          successCount += 1;
        } catch {
          failureCount += 1;
        }
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      await completeTelegramBroadcast(draft.id, draft.ownerTelegramUserId, successCount, failureCount);
      await recordManagedTelegramBroadcastAudit(draft.ownerTelegramUserId, draft.id, "complete", { successCount, failureCount, scheduled: true });
      res.json({ ok: true, id: draft.id, successCount, failureCount });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      console.error("[Telegram] Scheduled broadcast failed:", message);
      res.status(500).json({ error: message, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    }
  });
  app2.post("/api/telegram/admin/broadcasts/:id/confirm", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    const id = Number(req.params.id);
    if (!adminUserId || req.body?.confirmation !== "SEND") {
      res.status(400).json({ ok: false, error: "confirmation_required" });
      return;
    }
    const supabaseStore = process.env.BOT_STORAGE_MODE === "supabase" ? createSupabaseBotStore() : void 0;
    const draft = supabaseStore ? await supabaseStore.getBroadcastDraft(id, adminUserId) : await getTelegramBroadcastDraft(id, adminUserId);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!draft || draft.status !== "draft" || draft.kind !== "message" || !draft.message || !token || !await (supabaseStore ? supabaseStore.beginBroadcast(id, adminUserId) : beginTelegramBroadcast(id, adminUserId))) {
      res.status(400).json({ ok: false, error: "unavailable_broadcast" });
      return;
    }
    if (supabaseStore) await recordSupabaseBotAdminAudit(adminUserId, "confirm", "broadcast", id, { recipientCount: draft.recipientCount });
    else await recordManagedTelegramBroadcastAudit(adminUserId, id, "confirm", { recipientCount: draft.recipientCount });
    const sender = createTelegramSender(token);
    const recipients = supabaseStore ? await supabaseStore.listSubscriberChatIds() : await listTelegramSubscriberChatIds();
    let successCount = 0;
    let failureCount = 0;
    for (const recipient of recipients) {
      const chatId = Number(recipient);
      if (!Number.isSafeInteger(chatId)) {
        failureCount += 1;
        continue;
      }
      try {
        await sender.sendMessage(chatId, draft.message);
        successCount += 1;
      } catch {
        failureCount += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    if (supabaseStore) await supabaseStore.completeBroadcast(id, adminUserId, successCount, failureCount);
    else await completeTelegramBroadcast(id, adminUserId, successCount, failureCount);
    if (supabaseStore) await recordSupabaseBotAdminAudit(adminUserId, "complete", "broadcast", id, { successCount, failureCount });
    else await recordManagedTelegramBroadcastAudit(adminUserId, id, "complete", { successCount, failureCount });
    res.status(200).json({ ok: true, id, successCount, failureCount });
  });
  app2.options("/api/telegram/admin/subscriptions", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin/subscriptions/pending", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    const supabaseStore = process.env.BOT_STORAGE_MODE === "supabase" ? createSupabaseBotStore() : void 0;
    res.status(200).json({ ok: true, requests: supabaseStore ? await supabaseStore.listPendingImportantYemeniLawsSubscriptionRequests() : await listPendingImportantYemeniLawsSubscriptionRequests(20) });
  });
  app2.options("/api/telegram/admin/referrals", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin/referrals", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, ...await listManagedTelegramReferralRewards() });
  });
  app2.options("/api/telegram/admin/referrals/:id/revoke", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.post("/api/telegram/admin/referrals/:id/revoke", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    const rewardId = Number(req.params.id);
    if (!adminUserId || !Number.isInteger(rewardId) || rewardId < 1) {
      res.status(400).json({ ok: false, error: "invalid_referral_reward" });
      return;
    }
    if (!await revokeManagedTelegramReferralReward(rewardId, adminUserId, req.body?.reason)) {
      res.status(409).json({ ok: false, error: "referral_reward_unavailable" });
      return;
    }
    res.status(200).json({ ok: true, id: rewardId });
  });
  app2.options("/api/telegram/admin/usage-analytics", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin/usage-analytics", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    const rawDays = Number(req.query.days);
    const days = Number.isInteger(rawDays) ? rawDays : 30;
    res.status(200).json({ ok: true, analytics: await getTelegramUsageAnalytics(days) });
  });
  app2.options("/api/telegram/admin/visit-analytics", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });
  app2.get("/api/telegram/admin/visit-analytics", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (!PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") || !await isPlatformAdministrator(req.get("authorization"))) {
      res.status(403).json({ ok: false });
      return;
    }
    const period = req.query.period;
    if (period !== "day" && period !== "week" && period !== "month") {
      res.status(400).json({ ok: false, error: "invalid_visit_period" });
      return;
    }
    res.status(200).json({ ok: true, analytics: await getTelegramVisitAnalytics(period) });
  });
  app2.post("/api/telegram/admin/subscriptions/:id/:decision", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = PLATFORM_ADMIN_ORIGINS.has(req.get("origin") ?? "") ? await getPlatformAdministratorId(req.get("authorization")) : void 0;
    const requestId = Number(req.params.id);
    const decision = req.params.decision;
    if (!adminUserId || !Number.isInteger(requestId) || requestId < 1 || !["approve", "reject"].includes(decision)) {
      res.status(400).json({ ok: false });
      return;
    }
    const supabaseStore = process.env.BOT_STORAGE_MODE === "supabase" ? createSupabaseBotStore() : void 0;
    const result = decision === "approve" ? await (supabaseStore ? supabaseStore.approveImportantYemeniLawsSubscriptionRequest(requestId, adminUserId) : approveImportantYemeniLawsSubscriptionRequest(requestId, adminUserId)) : await (supabaseStore ? supabaseStore.rejectImportantYemeniLawsSubscriptionRequest(requestId, adminUserId) : rejectImportantYemeniLawsSubscriptionRequest(requestId, adminUserId));
    if (!result) {
      res.status(409).json({ ok: false, error: "request_unavailable" });
      return;
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const managedItemLabel = result.managedMenuItemId ? (await (supabaseStore ? listSupabaseBotManagedMenuItems(true) : listManagedTelegramMenuItems(true))).find((item) => item.id === result.managedMenuItemId)?.label || "\u0627\u0644\u0632\u0631 \u0627\u0644\u0645\u062E\u0635\u0635" : "\u0623\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0646\u064A\u0646 \u0627\u0644\u064A\u0645\u0646\u064A\u0629 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A";
    let notified = false;
    const chatId = Number(result.chatId);
    if (token && Number.isSafeInteger(chatId)) {
      try {
        await createTelegramSender(token).sendMessage(chatId, decision === "approve" ? `\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0634\u062A\u0631\u0627\u0643\u0643 \u0641\u064A \u0642\u0633\u0645 ${managedItemLabel}. \u064A\u0645\u0643\u0646\u0643 \u0641\u062A\u062D \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0622\u0646 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629.` : `\u0644\u0645 \u064A\u064F\u0639\u062A\u0645\u062F \u0637\u0644\u0628 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0641\u064A \u0642\u0633\u0645 ${managedItemLabel}. \u0631\u0627\u062C\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u062B\u0645 \u0623\u0631\u0633\u0644 \u0637\u0644\u0628\u064B\u0627 \u062C\u062F\u064A\u062F\u064B\u0627 \u0639\u0646\u062F \u0627\u0644\u062D\u0627\u062C\u0629.`);
        notified = true;
      } catch {
        notified = false;
      }
    }
    if (supabaseStore) await recordSupabaseBotAdminAudit(adminUserId, decision, result.managedMenuItemId ? "managed_menu_subscription" : "important_laws_subscription", String(requestId), { notified, managedMenuItemId: result.managedMenuItemId });
    else await recordManagedTelegramAdminAudit(adminUserId, decision, result.managedMenuItemId ? "managed_menu_subscription" : "important_laws_subscription", String(requestId), { notified, managedMenuItemId: result.managedMenuItemId });
    res.status(200).json({ ok: true, decision, notified, telegramUserId: result.telegramUserId });
  });
  app2.options("/api/telegram/platform-visit", (req, res) => {
    setPlatformVisitCors(req, res);
    res.status(204).end();
  });
  app2.options("/api/telegram/hasad-visit", (req, res) => {
    setPlatformVisitCors(req, res);
    res.status(204).end();
  });
  app2.post("/api/telegram/platform-visit", async (req, res) => {
    setPlatformVisitCors(req, res);
    const origin = req.get("origin");
    if (origin && !TELEGRAM_VISIT_ORIGINS.has(origin)) {
      res.status(403).json({ ok: false });
      return;
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const initData = typeof req.body?.initData === "string" ? req.body.initData : "";
    if (!token || !initData) {
      res.status(400).json({ ok: false });
      return;
    }
    try {
      const visit = await verifyAndRecordTelegramPlatformVisit(initData, token);
      if (process.env.BOT_STORAGE_MODE === "supabase") await confirmSupabaseBotPlatformAccess(visit.telegramUserId, normalizeTelegramRegion(req.body?.region));
      else await confirmTelegramPlatformAccess(visit.telegramUserId, normalizeTelegramRegion(req.body?.region));
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[Telegram] Platform visit verification failed:", error instanceof Error ? error.message : "unknown error");
      res.status(400).json({ ok: false });
    }
  });
  app2.post("/api/telegram/hasad-visit", async (req, res) => {
    setPlatformVisitCors(req, res);
    const origin = req.get("origin");
    if (origin && !TELEGRAM_VISIT_ORIGINS.has(origin)) {
      console.warn("[Telegram] Hasad visit rejected origin:", origin.slice(0, 160));
      res.status(403).json({ ok: false });
      return;
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const initData = typeof req.body?.initData === "string" ? req.body.initData : "";
    if (!token || !initData) {
      res.status(400).json({ ok: false });
      return;
    }
    try {
      const visit = validateTelegramWebAppInitData(initData, token);
      if (!visit) throw new Error("invalid_web_app_data");
      if (process.env.BOT_STORAGE_MODE === "supabase") await confirmSupabaseBotHasadAccess(visit.telegramUserId, normalizeTelegramRegion(req.body?.region));
      else await confirmTelegramHasadAccess(visit.telegramUserId, normalizeTelegramRegion(req.body?.region));
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[Telegram] Hasad visit verification failed:", error instanceof Error ? error.message : "unknown error");
      res.status(400).json({ ok: false });
    }
  });
  app2.post("/api/telegram/webhook", async (req, res) => {
    const receivedSecret = req.get(TELEGRAM_SECRET_HEADER);
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!isValidTelegramWebhookSecret(receivedSecret, expectedSecret)) {
      res.status(401).json({ ok: false });
      return;
    }
    if (!token) {
      res.status(503).json({ ok: false });
      return;
    }
    try {
      const update = req.body;
      const incomingMessage = update.message ?? update.callback_query?.message;
      const sender = createTelegramSender(token, {
        messageThreadId: incomingMessage?.message_thread_id,
        directMessagesTopicId: incomingMessage?.direct_messages_topic?.topic_id
      });
      await handleTelegramUpdate(
        update,
        process.env.BOT_STORAGE_MODE === "supabase" ? createSupabaseBotStore() : {
          hasConfirmedPlatformAccess: hasConfirmedTelegramPlatformAccess,
          hasConfirmedHasadAccess: hasConfirmedTelegramHasadAccess,
          listManagedMenuItems: () => listManagedTelegramMenuItems(false),
          listManagedSections: listManagedTelegramSectionConfigs,
          listManagedMessages: listManagedTelegramMessageConfigs,
          listSourcesByCategory: listLegalSourcesByCategory,
          searchSources: searchLegalSources,
          getSource: getLegalSourceById,
          saveFavorite: saveTelegramDocumentFavorite,
          listFavorites: listTelegramDocumentFavorites,
          removeFavorite: removeTelegramDocumentFavorite,
          listRecentSources: listRecentLegalSources,
          listFeaturedSources: listFeaturedLegalSources,
          listPopularSources: listPopularLegalSources,
          listContractTemplates: listTelegramContractTemplates,
          listContractTemplateTypes: listTelegramContractTemplateTypes,
          listContractTemplatesByType: listTelegramContractTemplatesByType,
          getContractTemplate: getTelegramContractTemplate,
          beginContractTemplateSearch: beginTelegramContractTemplateSearch,
          consumeContractTemplateSearchQuery: consumeTelegramContractTemplateSearchQuery,
          searchContractTemplates: searchTelegramContractTemplates,
          listLegislationSourcesByType,
          listLegislationYears,
          listLegislationSourcesByYear,
          recordUsage: recordTelegramUsageEvent,
          createSupportRequest: createTelegramSupportRequest,
          getOwnerStatistics: getTelegramOwnerStatistics,
          listNewSupportRequests: listNewTelegramSupportRequests,
          registerSubscriber: registerTelegramSubscriber,
          listSubscriberChatIds: listTelegramSubscriberChatIds,
          createBroadcastDraft: createTelegramBroadcastDraft,
          getBroadcastDraft: getTelegramBroadcastDraft,
          cancelBroadcastDraft: cancelTelegramBroadcastDraft,
          beginBroadcast: beginTelegramBroadcast,
          completeBroadcast: completeTelegramBroadcast,
          getJudicialFolderContents,
          beginJudicialSearch,
          consumeJudicialSearchQuery,
          searchJudicialSources,
          getLegislationFolderContents,
          getYemeniLawsFolderContents,
          getLegalFormsFolderContents,
          getIllustratedLegalFormsFolderContents,
          getAllYemeniLawsFolderContents,
          getFeaturedReferencesFolderContents,
          getImportantYemeniLawsFolderContents,
          hasImportantYemeniLawsAccess,
          hasManagedMenuItemPremiumAccess: hasManagedTelegramMenuItemPremiumAccess,
          hasReferralPremiumAccess: hasTelegramPremiumAccess,
          createReferral: createTelegramReferral,
          qualifyReferral: qualifyTelegramReferral,
          getReferralProgress: getTelegramReferralProgress,
          listReferralHistory: listTelegramReferralHistory,
          createImportantYemeniLawsSubscriptionRequest,
          approveImportantYemeniLawsSubscriptionRequest,
          rejectImportantYemeniLawsSubscriptionRequest,
          listPendingImportantYemeniLawsSubscriptionRequests,
          beginLegislationSearch,
          consumeLegislationSearchQuery,
          searchLegislationSources,
          beginAllYemeniLawsSearch,
          consumeAllYemeniLawsSearchQuery,
          searchAllYemeniLawsSources,
          beginLibrarySearch,
          consumeLibrarySearchQuery,
          searchLibrarySources,
          listExamForms: listTelegramExamForms,
          listExamQuestions: listTelegramExamQuestions,
          startExamSession: startTelegramExamSession,
          getExamSession: getTelegramExamSession,
          setExamActivePoll: setTelegramExamActivePoll,
          getExamSessionByPoll: getTelegramExamSessionByPoll,
          cancelExamSession: cancelTelegramExamSession,
          resolveExamPoll: resolveTelegramExamPoll,
          advanceExamWrittenQuestion: advanceTelegramExamWrittenQuestion,
          getExamResultSummary: getTelegramExamResultSummary,
          getGroupExamWaitingRound: getTelegramGroupExamWaitingRound,
          createGroupExamRound: createTelegramGroupExamRound,
          joinGroupExamRound: joinTelegramGroupExamRound,
          activateGroupExamRound: activateTelegramGroupExamRound,
          getGroupExamRound: getTelegramGroupExamRound,
          cancelGroupExamRound: cancelTelegramGroupExamRound,
          setGroupExamActivePoll: setTelegramGroupExamActivePoll,
          getGroupExamRoundByPoll: getTelegramGroupExamRoundByPoll,
          recordGroupExamAnswer: recordTelegramGroupExamAnswer,
          resolveGroupExamPoll: resolveTelegramGroupExamPoll,
          getGroupExamLeaderboard: getTelegramGroupExamLeaderboard
        },
        sender,
        void 0,
        createTelegramChannelMembershipChecker(token)
      );
      res.status(200).json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("[Telegram] Update processing failed:", message);
      res.status(500).json({ ok: false });
    }
  });
}

// server/vercelTelegramEntrypoint.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
var telegramConfigurationPromise;
function ensureTelegramConfiguration() {
  if (!telegramConfigurationPromise) {
    telegramConfigurationPromise = synchronizeTelegramConfiguration({
      token: process.env.TELEGRAM_BOT_TOKEN,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("[Telegram] Vercel configuration synchronization failed:", message);
    });
  }
  return telegramConfigurationPromise;
}
app.use(async (_req, _res, next) => {
  await ensureTelegramConfiguration();
  next();
});
registerTelegramWebhook(app);
var vercelTelegramEntrypoint_default = app;
export {
  vercelTelegramEntrypoint_default as default
};
