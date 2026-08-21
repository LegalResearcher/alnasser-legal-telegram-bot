import { boolean, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const legalCategoryValues = ["fiqh", "civil", "commercial", "procedure", "general"] as const;
export const legalCollectionValues = ["judicial", "legislation", "yemeni_laws", "legal_forms", "featured_references", "important_yemeni_laws", "illustrated_legal_forms", "all_yemeni_laws"] as const;
export type LegalCollection = (typeof legalCollectionValues)[number];
export const legislationDocumentTypeValues = ["law", "regulation", "decision", "agreement", "treaty", "decree", "other"] as const;
export const telegramUsageEventValues = ["browse", "search", "document_request", "support_request"] as const;
export const telegramContractTemplateTypeValues = ["civil", "commercial", "labor", "personal", "judicial", "general"] as const;
export type TelegramContractTemplateType = (typeof telegramContractTemplateTypeValues)[number];

export const legalSources = mysqlTable("legal_sources", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LegalSource = typeof legalSources.$inferSelect;
export type InsertLegalSource = typeof legalSources.$inferInsert;

export const legalFolders = mysqlTable("legal_folders", {
  id: int("id").autoincrement().primaryKey(),
  driveFolderId: varchar("driveFolderId", { length: 128 }).notNull().unique(),
  parentDriveFolderId: varchar("parentDriveFolderId", { length: 128 }),
  collection: mysqlEnum("collection", legalCollectionValues).notNull().default("judicial"),
  name: varchar("name", { length: 255 }).notNull(),
  path: text("path").notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LegalFolder = typeof legalFolders.$inferSelect;

/** عناصر إضافية تتحكم بها لوحة منصة الناصر وتظهر في القائمة الرئيسة للبوت. */
export const telegramManagedMenuItems = mysqlTable("telegram_managed_menu_items", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  actionType: mysqlEnum("actionType", ["url", "message", "file"]).notNull(),
  actionValue: text("actionValue").notNull(),
  rowIndex: int("rowIndex").notNull().default(100),
  sortOrder: int("sortOrder").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  accessMode: mysqlEnum("accessMode", ["free", "premium", "hasad"]).notNull().default("free"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramManagedMenuItem = typeof telegramManagedMenuItems.$inferSelect;

/** إعدادات عرض الأقسام الثابتة. المفتاح مقيد بمنطق البوت ولا ينشأ من الواجهة. */
export const telegramManagedSections = mysqlTable("telegram_managed_sections", {
  id: int("id").autoincrement().primaryKey(),
  sectionKey: varchar("sectionKey", { length: 64 }).notNull().unique(),
  displayLabel: varchar("displayLabel", { length: 128 }),
  enabled: boolean("enabled").notNull().default(true),
  /** تبقى subscription قيمة توافقية قديمة؛ أما الإعدادات الجديدة فتستخدم free أو premium أو hasad. */
  accessMode: mysqlEnum("accessMode", ["subscription", "free", "premium", "hasad"]).notNull().default("subscription"),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramManagedSection = typeof telegramManagedSections.$inferSelect;

/** قوالب تعريفية محددة فقط؛ لا تشمل رسائل الاشتراك أو التحقق أو العمليات الحساسة. */
export const telegramManagedMessageTemplates = mysqlTable("telegram_managed_message_templates", {
  id: int("id").autoincrement().primaryKey(),
  messageKey: varchar("messageKey", { length: 64 }).notNull().unique(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramManagedMessageTemplate = typeof telegramManagedMessageTemplates.$inferSelect;

/** سجل العمليات الإدارية على محتوى البوت، دون حفظ أسرار أو رموز وصول. */
export const telegramAdminAuditLogs = mysqlTable("telegram_admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: varchar("adminUserId", { length: 64 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 64 }),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TelegramAdminAuditLog = typeof telegramAdminAuditLogs.$inferSelect;

export const telegramDocumentFavorites = mysqlTable("telegram_document_favorites", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  sourceId: int("sourceId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  uniqueUserSource: uniqueIndex("telegram_document_favorite_unique").on(table.telegramUserId, table.sourceId),
}));

export type TelegramDocumentFavorite = typeof telegramDocumentFavorites.$inferSelect;

export const judicialSearchSessions = mysqlTable("judicial_search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  query: varchar("query", { length: 255 }),
  status: mysqlEnum("status", ["awaiting", "ready"]).notNull().default("awaiting"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JudicialSearchSession = typeof judicialSearchSessions.$inferSelect;

export const librarySearchSessions = mysqlTable("library_search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  query: varchar("query", { length: 255 }),
  status: mysqlEnum("status", ["awaiting", "ready"]).notNull().default("awaiting"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LibrarySearchSession = typeof librarySearchSessions.$inferSelect;

export const legislationSearchSessions = mysqlTable("legislation_search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  query: varchar("query", { length: 255 }),
  status: mysqlEnum("status", ["awaiting", "ready"]).notNull().default("awaiting"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LegislationSearchSession = typeof legislationSearchSessions.$inferSelect;

export const allYemeniLawsSearchSessions = mysqlTable("all_yemeni_laws_search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  query: varchar("query", { length: 255 }),
  status: mysqlEnum("status", ["awaiting", "ready"]).notNull().default("awaiting"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AllYemeniLawsSearchSession = typeof allYemeniLawsSearchSessions.$inferSelect;

export const telegramContractTemplateSearchSessions = mysqlTable("telegram_contract_template_search_sessions", {
  id: int("id").autoincrement().primaryKey(),
  chatId: varchar("chatId", { length: 32 }).notNull().unique(),
  query: varchar("query", { length: 255 }),
  status: mysqlEnum("status", ["awaiting", "ready"]).notNull().default("awaiting"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramContractTemplateSearchSession = typeof telegramContractTemplateSearchSessions.$inferSelect;

export const telegramPlatformAccess = mysqlTable("telegram_platform_access", {
  telegramUserId: varchar("telegramUserId", { length: 32 }).primaryKey(),
  confirmedAt: timestamp("confirmedAt").defaultNow().notNull(),
  webAppVerifiedAt: timestamp("webAppVerifiedAt"),
  region: varchar("region", { length: 64 }),
});

export type TelegramPlatformAccess = typeof telegramPlatformAccess.$inferSelect;

/** زيارة حصاد اليوم تُحفظ مستقلة لحماية قسم الصيغ والعقود فقط. */
export const telegramHasadAccess = mysqlTable("telegram_hasad_access", {
  telegramUserId: varchar("telegramUserId", { length: 32 }).primaryKey(),
  visitedAt: timestamp("visitedAt").defaultNow().notNull(),
  region: varchar("region", { length: 64 }),
});

export type TelegramHasadAccess = typeof telegramHasadAccess.$inferSelect;

/** سجل زمني للزيارات الموثقة؛ يُستخدم في التحليلات ولا يمنح صلاحيات بذاته. */
export const telegramVisitEvents = mysqlTable("telegram_visit_events", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  site: mysqlEnum("site", ["platform", "hasad"]).notNull(),
  visitedAt: timestamp("visitedAt").defaultNow().notNull(),
  region: varchar("region", { length: 64 }),
}, table => ({
  siteVisitedAtIndex: index("telegram_visit_events_site_visited_at").on(table.site, table.visitedAt),
  userVisitedAtIndex: index("telegram_visit_events_user_visited_at").on(table.telegramUserId, table.visitedAt),
}));

export type TelegramVisitEvent = typeof telegramVisitEvents.$inferSelect;

export const telegramUsageEvents = mysqlTable("telegram_usage_events", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  eventType: mysqlEnum("eventType", telegramUsageEventValues).notNull(),
  sectionKey: varchar("sectionKey", { length: 64 }),
  query: varchar("query", { length: 255 }),
  sourceId: int("sourceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TelegramUsageEvent = typeof telegramUsageEvents.$inferSelect;

export const telegramSupportRequests = mysqlTable("telegram_support_requests", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  chatId: varchar("chatId", { length: 32 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "reviewed"]).notNull().default("new"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TelegramSupportRequest = typeof telegramSupportRequests.$inferSelect;

export const telegramSubscribers = mysqlTable("telegram_subscribers", {
  chatId: varchar("chatId", { length: 32 }).primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  telegramUsername: varchar("telegramUsername", { length: 64 }),
  telegramFirstName: varchar("telegramFirstName", { length: 128 }),
  telegramLastName: varchar("telegramLastName", { length: 128 }),
  subscribedAt: timestamp("subscribedAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramSubscriber = typeof telegramSubscribers.$inferSelect;

export const telegramBroadcasts = mysqlTable("telegram_broadcasts", {
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
  completedAt: timestamp("completedAt"),
});

export type TelegramBroadcast = typeof telegramBroadcasts.$inferSelect;

export const telegramImportantYemeniLawsAccess = mysqlTable("telegram_important_yemeni_laws_access", {
  telegramUserId: varchar("telegramUserId", { length: 32 }).primaryKey(),
  approvedByTelegramUserId: varchar("approvedByTelegramUserId", { length: 64 }).notNull(),
  approvedAt: timestamp("approvedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramImportantYemeniLawsAccess = typeof telegramImportantYemeniLawsAccess.$inferSelect;

export const telegramImportantYemeniLawsSubscriptionRequests = mysqlTable("telegram_important_yemeni_laws_subscription_requests", {
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
  reviewedAt: timestamp("reviewedAt"),
});

export type TelegramImportantYemeniLawsSubscriptionRequest = typeof telegramImportantYemeniLawsSubscriptionRequests.$inferSelect;

/** وصول يدوي دائم للأقسام التعليمية، مستقل عن مكافأة الإحالة المؤقتة. */
export const telegramManualPremiumAccess = mysqlTable("telegram_manual_premium_access", {
  telegramUserId: varchar("telegramUserId", { length: 32 }).primaryKey(),
  shariaExamsAccess: boolean("shariaExamsAccess").notNull().default(false),
  secondaryExamsAccess: boolean("secondaryExamsAccess").notNull().default(false),
  approvedByTelegramUserId: varchar("approvedByTelegramUserId", { length: 64 }).notNull(),
  approvedAt: timestamp("approvedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramManualPremiumAccess = typeof telegramManualPremiumAccess.$inferSelect;

/** وصول يدوي لزر مخصص مدفوع، منفصل لكل زر حتى لا يمنح اعتماد زر حقًا في زر آخر. */
export const telegramManagedMenuItemPremiumAccess = mysqlTable("telegram_managed_menu_item_premium_access", {
  id: int("id").autoincrement().primaryKey(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  menuItemId: int("menuItemId").notNull(),
  approvedByTelegramUserId: varchar("approvedByTelegramUserId", { length: 64 }).notNull(),
  approvedAt: timestamp("approvedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  uniqueUserMenuItem: uniqueIndex("telegram_managed_menu_item_premium_access_unique").on(table.telegramUserId, table.menuItemId),
}));

export type TelegramManagedMenuItemPremiumAccess = typeof telegramManagedMenuItemPremiumAccess.$inferSelect;

/** إحالة واحدة فقط لكل مستخدم جديد، ولا تصبح مؤهلة إلا بعد استكمال متطلبات الدخول ومرور مدة الحماية. */
export const telegramReferrals = mysqlTable("telegram_referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerTelegramUserId: varchar("referrerTelegramUserId", { length: 32 }).notNull(),
  refereeTelegramUserId: varchar("refereeTelegramUserId", { length: 32 }).notNull(),
  refereeChatId: varchar("refereeChatId", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["pending", "qualified", "rejected"]).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  qualifiedAt: timestamp("qualifiedAt"),
  rejectedAt: timestamp("rejectedAt"),
  rejectionReason: varchar("rejectionReason", { length: 128 }),
}, table => ({
  uniqueReferee: uniqueIndex("telegram_referrals_unique_referee").on(table.refereeTelegramUserId),
}));

export type TelegramReferral = typeof telegramReferrals.$inferSelect;

/** مكافأة الإحالة لا تمنح حقًا دائمًا؛ ينتهي الوصول تلقائيًا عند قراءة الصلاحية بعد شهر. */
export const telegramReferralRewards = mysqlTable("telegram_referral_rewards", {
  id: int("id").autoincrement().primaryKey(),
  referrerTelegramUserId: varchar("referrerTelegramUserId", { length: 32 }).notNull(),
  qualifiedReferralCount: int("qualifiedReferralCount").notNull(),
  status: mysqlEnum("status", ["active", "revoked"]).notNull().default("active"),
  accessStartsAt: timestamp("accessStartsAt").notNull(),
  accessExpiresAt: timestamp("accessExpiresAt").notNull(),
  revokedByAdminUserId: varchar("revokedByAdminUserId", { length: 64 }),
  revokedAt: timestamp("revokedAt"),
  revokeReason: varchar("revokeReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  uniqueReferrerMilestone: uniqueIndex("telegram_referral_rewards_unique_milestone").on(table.referrerTelegramUserId, table.qualifiedReferralCount),
}));

export type TelegramReferralReward = typeof telegramReferralRewards.$inferSelect;

export const telegramScheduledTasks = mysqlTable("telegram_scheduled_tasks", {
  taskKey: varchar("taskKey", { length: 64 }).primaryKey(),
  taskUid: varchar("taskUid", { length: 65 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramScheduledTask = typeof telegramScheduledTasks.$inferSelect;

export type TelegramContractTemplateContentBlock = {
  num?: string;
  text?: string;
  type?: string;
};

export const telegramContractTemplates = mysqlTable("telegram_contract_templates", {
  id: int("id").autoincrement().primaryKey(),
  sourceDocumentId: int("sourceDocumentId").notNull().unique(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  content: json("content").$type<TelegramContractTemplateContentBlock[]>().notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  contractType: mysqlEnum("contractType", telegramContractTemplateTypeValues).notNull().default("general"),
  isPremium: boolean("isPremium").notNull().default(false),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramContractTemplate = typeof telegramContractTemplates.$inferSelect;

export const telegramExamForms = mysqlTable("telegram_exam_forms", {
  id: int("id").autoincrement().primaryKey(),
  subjectKey: varchar("subjectKey", { length: 64 }).notNull(),
  formKey: varchar("formKey", { length: 64 }).notNull(),
  formName: varchar("formName", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueSubjectForm: uniqueIndex("telegram_exam_form_unique").on(table.subjectKey, table.formKey),
}));

export type TelegramExamForm = typeof telegramExamForms.$inferSelect;

export const telegramExamQuestions = mysqlTable("telegram_exam_questions", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramExamQuestion = typeof telegramExamQuestions.$inferSelect;

export const telegramExamSessions = mysqlTable("telegram_exam_sessions", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramExamSession = typeof telegramExamSessions.$inferSelect;

export const telegramGroupExamRounds = mysqlTable("telegram_group_exam_rounds", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramGroupExamRound = typeof telegramGroupExamRounds.$inferSelect;

export const telegramGroupExamParticipants = mysqlTable("telegram_group_exam_participants", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("roundId").notNull(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  username: varchar("username", { length: 64 }),
  score: int("score").notNull().default(0),
  incorrectCount: int("incorrectCount").notNull().default(0),
  missedCount: int("missedCount").notNull().default(0),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  uniqueRoundParticipant: uniqueIndex("telegram_group_exam_participant_unique").on(table.roundId, table.telegramUserId),
}));

export type TelegramGroupExamParticipant = typeof telegramGroupExamParticipants.$inferSelect;

export const telegramGroupExamAnswers = mysqlTable("telegram_group_exam_answers", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("roundId").notNull(),
  questionIndex: int("questionIndex").notNull(),
  telegramUserId: varchar("telegramUserId", { length: 32 }).notNull(),
  answer: mysqlEnum("answer", ["A", "B", "C", "D"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  uniqueRoundQuestionParticipant: uniqueIndex("telegram_group_exam_answer_unique").on(table.roundId, table.questionIndex, table.telegramUserId),
}));

export type TelegramGroupExamAnswer = typeof telegramGroupExamAnswers.$inferSelect;
