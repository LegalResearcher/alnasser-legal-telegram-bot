import { and, asc, count, desc, eq, gte, gt, inArray, isNotNull, isNull, like, lt, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { AllYemeniLawsSearchSession, InsertLegalSource, InsertUser, JudicialSearchSession, LegislationSearchSession, LibrarySearchSession, LegalFolder, LegalSource, TelegramBroadcast, TelegramContractTemplate, TelegramContractTemplateSearchSession, TelegramContractTemplateType, TelegramDocumentFavorite, TelegramManagedMenuItem, TelegramManagedMessageTemplate, TelegramManagedSection, TelegramPlatformAccess, allYemeniLawsSearchSessions, legalCategoryValues, legalCollectionValues, legislationDocumentTypeValues, judicialSearchSessions, legislationSearchSessions, legalFolders, legalSources, librarySearchSessions, telegramAdminAuditLogs, telegramBroadcasts, telegramContractTemplateSearchSessions, telegramContractTemplates, telegramDocumentFavorites, telegramImportantYemeniLawsAccess, telegramImportantYemeniLawsSubscriptionRequests, telegramManagedMenuItems, telegramManagedMessageTemplates, telegramManagedSections, telegramPlatformAccess, telegramScheduledTasks, telegramSubscribers, telegramSupportRequests, telegramUsageEvents, users } from "../drizzle/schema";
import type { LegalCollection } from "../drizzle/schema";
import { telegramReferralRewards, telegramReferrals } from "../drizzle/schema";
import { telegramHasadAccess, telegramManualPremiumAccess } from "../drizzle/schema";
import { telegramVisitEvents } from "../drizzle/schema";
import type { LegalCategory } from "./telegram";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
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

export type ManagedMenuItemInput = {
  label: string;
  actionType: "url" | "message";
  actionValue: string;
  rowIndex: number;
  sortOrder: number;
  enabled: boolean;
};

function normalizeManagedMenuItem(input: Partial<ManagedMenuItemInput>): ManagedMenuItemInput | undefined {
  const label = input.label?.trim().slice(0, 128);
  const actionValue = input.actionValue?.trim().slice(0, 4000);
  const actionType = input.actionType;
  if (!label || !actionValue || (actionType !== "url" && actionType !== "message")) return undefined;
  if (actionType === "url") {
    try {
      const parsed = new URL(actionValue);
      if (!["https:", "tg:"].includes(parsed.protocol)) return undefined;
    } catch {
      return undefined;
    }
  }
  return {
    label,
    actionType,
    actionValue,
    rowIndex: Math.min(999, Math.max(0, Math.trunc(Number(input.rowIndex) || 100))),
    sortOrder: Math.min(9999, Math.max(0, Math.trunc(Number(input.sortOrder) || 0))),
    enabled: input.enabled !== false,
  };
}

export async function listManagedTelegramMenuItems(includeDisabled = false): Promise<TelegramManagedMenuItem[]> {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(telegramManagedMenuItems);
  return (includeDisabled ? query : query.where(eq(telegramManagedMenuItems.enabled, true)))
    .orderBy(asc(telegramManagedMenuItems.rowIndex), asc(telegramManagedMenuItems.sortOrder), asc(telegramManagedMenuItems.id));
}

export async function createManagedTelegramMenuItem(input: Partial<ManagedMenuItemInput>, adminUserId: string): Promise<TelegramManagedMenuItem | undefined> {
  const db = await getDb();
  const normalized = normalizeManagedMenuItem(input);
  if (!db || !normalized || !adminUserId) return undefined;
  const result = await db.insert(telegramManagedMenuItems).values(normalized);
  const id = Number((result as unknown as Array<{ insertId?: number }>)[0]?.insertId ?? 0);
  const item = (await db.select().from(telegramManagedMenuItems).where(eq(telegramManagedMenuItems.id, id)).limit(1))[0];
  if (item) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "create", entityType: "menu_item", entityId: String(item.id), details: normalized });
  return item;
}

export async function updateManagedTelegramMenuItem(id: number, input: Partial<ManagedMenuItemInput>, adminUserId: string): Promise<TelegramManagedMenuItem | undefined> {
  const db = await getDb();
  const normalized = normalizeManagedMenuItem(input);
  if (!db || !normalized || !adminUserId || !Number.isInteger(id) || id < 1) return undefined;
  await db.update(telegramManagedMenuItems).set(normalized).where(eq(telegramManagedMenuItems.id, id));
  const item = (await db.select().from(telegramManagedMenuItems).where(eq(telegramManagedMenuItems.id, id)).limit(1))[0];
  if (item) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "update", entityType: "menu_item", entityId: String(item.id), details: normalized });
  return item;
}

export async function deleteManagedTelegramMenuItem(id: number, adminUserId: string): Promise<boolean> {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(id) || id < 1) return false;
  const item = (await db.select().from(telegramManagedMenuItems).where(eq(telegramManagedMenuItems.id, id)).limit(1))[0];
  if (!item) return false;
  await db.delete(telegramManagedMenuItems).where(eq(telegramManagedMenuItems.id, id));
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "delete", entityType: "menu_item", entityId: String(id), details: { label: item.label } });
  return true;
}

export const managedTelegramSectionDefaults = [
  { sectionKey: "browse", displayLabel: "📚 تصفح المكتبة", sortOrder: 10 },
  { sectionKey: "search", displayLabel: "🔎 بحث موحّد", sortOrder: 20 },
  { sectionKey: "judicial", displayLabel: "⚖️ قواعد قضائية", sortOrder: 30 },
  { sectionKey: "legislation", displayLabel: "📜 التشريعات اليمنية", sortOrder: 40 },
  { sectionKey: "important-laws", displayLabel: "🔐 أهم القوانين اليمنية التفاعلي", sortOrder: 50 },
  { sectionKey: "legal-forms", displayLabel: "📝 نماذج وصيغ قانونية", sortOrder: 60 },
  { sectionKey: "illustrated-legal-forms", displayLabel: "🖼 نماذج مصورة وفق القوانين اليمنية", sortOrder: 70 },
  { sectionKey: "contract-templates", displayLabel: "📄 صيغ وعقود قانونية", sortOrder: 80 },
  { sectionKey: "exams", displayLabel: "📝 اختبارات الشريعة والقانون", sortOrder: 90 },
  { sectionKey: "secondary-exams", displayLabel: "🧮 اختبارات الثانوية العامة", sortOrder: 100 },
  { sectionKey: "latest", displayLabel: "🆕 أحدث الإضافات", sortOrder: 110 },
  { sectionKey: "popular", displayLabel: "⭐ الأكثر طلبًا", sortOrder: 120 },
  { sectionKey: "favorites", displayLabel: "⭐ مفضلتي", sortOrder: 130 },
  { sectionKey: "featured", displayLabel: "📌 مراجع مميزة", sortOrder: 140 },
  { sectionKey: "support", displayLabel: "💬 تواصل ودعم", sortOrder: 150 },
] as const;

/** الأقسام ذات بوابة وصول قائمة التي يجوز للإدارة تبديلها إلى الوصول المجاني. */
export const subscriptionManagedTelegramSectionKeys = ["important-laws", "exams", "secondary-exams", "judicial", "contract-templates"] as const;
export type SubscriptionManagedTelegramSectionKey = typeof subscriptionManagedTelegramSectionKeys[number];
export type TelegramSectionAccessMode = "subscription" | "free";

export type ManagedTelegramSectionConfig = {
  sectionKey: typeof managedTelegramSectionDefaults[number]["sectionKey"];
  displayLabel: string;
  enabled: boolean;
  accessMode: TelegramSectionAccessMode;
  sortOrder: number;
};

export async function listManagedTelegramSections(): Promise<TelegramManagedSection[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(telegramManagedSections).orderBy(asc(telegramManagedSections.sortOrder), asc(telegramManagedSections.id));
}

export async function listManagedTelegramSectionConfigs(): Promise<ManagedTelegramSectionConfig[]> {
  const saved = await listManagedTelegramSections();
  const byKey = new Map(saved.map(section => [section.sectionKey, section]));
  return managedTelegramSectionDefaults.map(defaults => {
    const override = byKey.get(defaults.sectionKey);
    return {
      sectionKey: defaults.sectionKey,
      displayLabel: override?.displayLabel?.trim() || defaults.displayLabel,
      enabled: override?.enabled ?? true,
      accessMode: (override?.accessMode === "free" ? "free" : "subscription") as TelegramSectionAccessMode,
      sortOrder: override?.sortOrder ?? defaults.sortOrder,
    };
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.sectionKey.localeCompare(right.sectionKey));
}

export async function updateManagedTelegramSection(
  sectionKey: string,
  input: Partial<Pick<ManagedTelegramSectionConfig, "displayLabel" | "enabled" | "accessMode" | "sortOrder">>,
  adminUserId: string,
): Promise<ManagedTelegramSectionConfig | undefined> {
  const defaults = managedTelegramSectionDefaults.find(section => section.sectionKey === sectionKey);
  const db = await getDb();
  if (!db || !defaults || !adminUserId) return undefined;
  const displayLabel = input.displayLabel?.trim().slice(0, 128) || defaults.displayLabel;
  const enabled = input.enabled !== false;
  const canManageAccess = (subscriptionManagedTelegramSectionKeys as readonly string[]).includes(sectionKey);
  const accessMode: TelegramSectionAccessMode = canManageAccess && input.accessMode === "free" ? "free" : "subscription";
  const sortOrder = Math.min(9999, Math.max(0, Math.trunc(Number(input.sortOrder) || defaults.sortOrder)));
  await db.insert(telegramManagedSections).values({ sectionKey, displayLabel, enabled, accessMode, sortOrder }).onDuplicateKeyUpdate({ set: { displayLabel, enabled, accessMode, sortOrder } });
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "update", entityType: "section", entityId: sectionKey, details: { displayLabel, enabled, accessMode, sortOrder } });
  return { sectionKey: defaults.sectionKey, displayLabel, enabled, accessMode, sortOrder };
}

export async function listTelegramAdminAuditLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit) || 50));
  return db.select({
    id: telegramAdminAuditLogs.id,
    action: telegramAdminAuditLogs.action,
    entityType: telegramAdminAuditLogs.entityType,
    entityId: telegramAdminAuditLogs.entityId,
    createdAt: telegramAdminAuditLogs.createdAt,
  }).from(telegramAdminAuditLogs).orderBy(desc(telegramAdminAuditLogs.createdAt), desc(telegramAdminAuditLogs.id)).limit(safeLimit);
}

export const managedTelegramMessageDefaults = [
  { messageKey: "welcome", title: "رسالة الترحيب", content: "🏛 مرحباً بك في بوت الناصر القانوني\n\nمنصة رقمية متخصصة تهدف إلى تيسير الوصول إلى المصادر والمراجع القانونية والفقهية لطلاب الشريعة والقانون والباحثين.\n\nاختر من القائمة أدناه للبدء:" },
  { messageKey: "about", title: "رسالة عن المكتبة", content: "ℹ️ عن بوت الناصر القانوني\n\nمنصة معرفية وتعليمية بإشراف أ. معين الناصر، تتيح للطلاب والباحثين الوصول المنظم إلى المراجع القانونية والفقهية، واستعراض التشريعات والقواعد القضائية، والاستفادة من نماذج الاختبارات الإلكترونية لمختلف المستويات والمواد.\n\nصُممت المنصة لتسهيل التعلم والمراجعة والوصول السريع إلى المصادر القانونية في مكان واحد.\n\n⚖️ هذا البوت مبادرة تعليمية مستقلة، ولا يمثل جهة حكومية أو جامعة رسمية." },
  { messageKey: "help", title: "رسالة المساعدة", content: "❓ دليل الاستخدام والدعم:\n• /start - العودة للقائمة الرئيسية.\n• /browse - استعراض جميع الأقسام والتصنيفات.\n• /search - فتح البحث الموحد أو البحث المباشر في المكتبة الرقمية.\n• /support رسالتك - إرسال اقتراح أو طلب دعم إلى إدارة البوت.\n📩 لا تُنشر رسائل الدعم في المجموعات؛ تحفظ للمراجعة من إدارة البوت." },
] as const;

export type ManagedTelegramMessageConfig = { messageKey: typeof managedTelegramMessageDefaults[number]["messageKey"]; title: string; content: string };

export async function listManagedTelegramMessageTemplates(): Promise<TelegramManagedMessageTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(telegramManagedMessageTemplates).orderBy(asc(telegramManagedMessageTemplates.messageKey));
}

export async function listManagedTelegramMessageConfigs(): Promise<ManagedTelegramMessageConfig[]> {
  const saved = await listManagedTelegramMessageTemplates();
  const byKey = new Map(saved.map(template => [template.messageKey, template]));
  return managedTelegramMessageDefaults.map(defaults => ({ ...defaults, content: byKey.get(defaults.messageKey)?.content || defaults.content }));
}

export async function updateManagedTelegramMessageTemplate(messageKey: string, content: unknown, adminUserId: string): Promise<ManagedTelegramMessageConfig | undefined> {
  const defaults = managedTelegramMessageDefaults.find(template => template.messageKey === messageKey);
  const db = await getDb();
  const normalizedContent = typeof content === "string" ? content.trim().slice(0, 4000) : "";
  if (!db || !defaults || !adminUserId || !normalizedContent) return undefined;
  await db.insert(telegramManagedMessageTemplates).values({ messageKey, content: normalizedContent }).onDuplicateKeyUpdate({ set: { content: normalizedContent } });
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "update", entityType: "message_template", entityId: messageKey, details: { length: normalizedContent.length } });
  return { messageKey: defaults.messageKey, title: defaults.title, content: normalizedContent };
}

export async function listTelegramContractTemplates(page = 1, pageSize = 8): Promise<{ templates: TelegramContractTemplate[]; total: number }> {
  const db = await getDb();
  if (!db) return { templates: [], total: 0 };
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(12, Math.max(1, pageSize));
  const [templates, totalResult] = await Promise.all([
    db.select().from(telegramContractTemplates)
      .where(eq(telegramContractTemplates.isActive, true))
      .orderBy(asc(telegramContractTemplates.sortOrder), asc(telegramContractTemplates.id))
      .limit(safePageSize)
      .offset((safePage - 1) * safePageSize),
    db.select({ count: count() }).from(telegramContractTemplates).where(eq(telegramContractTemplates.isActive, true)),
  ]);
  return { templates, total: Number(totalResult[0]?.count ?? 0) };
}

export async function listTelegramContractTemplateTypes(): Promise<Array<{ contractType: TelegramContractTemplateType; count: number }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ contractType: telegramContractTemplates.contractType, count: count() })
    .from(telegramContractTemplates)
    .where(eq(telegramContractTemplates.isActive, true))
    .groupBy(telegramContractTemplates.contractType)
    .orderBy(asc(telegramContractTemplates.contractType));
  return rows.map(row => ({ contractType: row.contractType, count: Number(row.count) }));
}

export async function listTelegramContractTemplatesByType(contractType: TelegramContractTemplateType, page = 1, pageSize = 8): Promise<{ templates: TelegramContractTemplate[]; total: number }> {
  const db = await getDb();
  if (!db) return { templates: [], total: 0 };
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(12, Math.max(1, pageSize));
  const filter = and(eq(telegramContractTemplates.isActive, true), eq(telegramContractTemplates.contractType, contractType));
  const [templates, totalResult] = await Promise.all([
    db.select().from(telegramContractTemplates)
      .where(filter)
      .orderBy(asc(telegramContractTemplates.sortOrder), asc(telegramContractTemplates.id))
      .limit(safePageSize)
      .offset((safePage - 1) * safePageSize),
    db.select({ count: count() }).from(telegramContractTemplates).where(filter),
  ]);
  return { templates, total: Number(totalResult[0]?.count ?? 0) };
}

export async function getTelegramContractTemplate(id: number): Promise<TelegramContractTemplate | undefined> {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1) return undefined;
  const rows = await db.select().from(telegramContractTemplates)
    .where(and(eq(telegramContractTemplates.id, id), eq(telegramContractTemplates.isActive, true)))
    .limit(1);
  return rows[0];
}

const CONTRACT_TEMPLATE_SEARCH_PAGE_SIZE = 8;

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function hasConfirmedTelegramPlatformAccess(telegramUserId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.select({ webAppVerifiedAt: telegramPlatformAccess.webAppVerifiedAt })
    .from(telegramPlatformAccess)
    .where(eq(telegramPlatformAccess.telegramUserId, telegramUserId))
    .limit(1);
  return Boolean(result[0]?.webAppVerifiedAt);
}

export async function confirmTelegramPlatformAccess(telegramUserId: string, region?: string | null): Promise<TelegramPlatformAccess> {
  const db = await getDb();
  if (!db) {
    throw new Error("قاعدة البيانات غير متاحة حاليًا");
  }

  const confirmedAt = new Date();
  await Promise.all([
    db.insert(telegramPlatformAccess).values({ telegramUserId, confirmedAt, webAppVerifiedAt: confirmedAt, region: region ?? null }).onDuplicateKeyUpdate({
      set: { confirmedAt, webAppVerifiedAt: confirmedAt, region: region ?? null },
    }),
    db.insert(telegramVisitEvents).values({ telegramUserId, site: "platform", visitedAt: confirmedAt, region: region ?? null }),
  ]);

  const result = await db.select().from(telegramPlatformAccess)
    .where(eq(telegramPlatformAccess.telegramUserId, telegramUserId))
    .limit(1);
  const access = result[0];
  if (!access) {
    throw new Error("تعذر حفظ تأكيد فتح المنصة");
  }
  return access;
}

export async function hasConfirmedTelegramHasadAccess(telegramUserId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ telegramUserId: telegramHasadAccess.telegramUserId })
    .from(telegramHasadAccess)
    .where(eq(telegramHasadAccess.telegramUserId, telegramUserId))
    .limit(1);
  return result.length > 0;
}

export async function confirmTelegramHasadAccess(telegramUserId: string, region?: string | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const visitedAt = new Date();
  await Promise.all([
    db.insert(telegramHasadAccess).values({ telegramUserId, visitedAt, region: region ?? null }).onDuplicateKeyUpdate({
      set: { visitedAt, region: region ?? null },
    }),
    db.insert(telegramVisitEvents).values({ telegramUserId, site: "hasad", visitedAt, region: region ?? null }),
  ]);
}

export async function hasImportantYemeniLawsAccess(telegramUserId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [permanentAccess, referralAccess] = await Promise.all([
    db.select({ telegramUserId: telegramImportantYemeniLawsAccess.telegramUserId })
      .from(telegramImportantYemeniLawsAccess)
      .where(eq(telegramImportantYemeniLawsAccess.telegramUserId, telegramUserId))
      .limit(1),
    db.select({ id: telegramReferralRewards.id })
      .from(telegramReferralRewards)
      .where(and(eq(telegramReferralRewards.referrerTelegramUserId, telegramUserId), eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, new Date())))
      .limit(1),
  ]);
  return permanentAccess.length > 0 || referralAccess.length > 0;
}

export type TelegramPaidAccessScope = "sharia_exams" | "secondary_exams";
export type TelegramSubscriptionAccessScope = "important_laws" | TelegramPaidAccessScope;

export async function hasTelegramPremiumAccess(telegramUserId: string, scope: TelegramPaidAccessScope): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [referralAccess, manualAccess] = await Promise.all([
    db.select({ id: telegramReferralRewards.id })
      .from(telegramReferralRewards)
      .where(and(eq(telegramReferralRewards.referrerTelegramUserId, telegramUserId), eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, new Date())))
      .limit(1),
    db.select({ shariaExamsAccess: telegramManualPremiumAccess.shariaExamsAccess, secondaryExamsAccess: telegramManualPremiumAccess.secondaryExamsAccess })
      .from(telegramManualPremiumAccess)
      .where(eq(telegramManualPremiumAccess.telegramUserId, telegramUserId))
      .limit(1),
  ]);
  if (referralAccess.length > 0) return true;
  return scope === "sharia_exams" ? Boolean(manualAccess[0]?.shariaExamsAccess) : Boolean(manualAccess[0]?.secondaryExamsAccess);
}

export const TELEGRAM_REFERRAL_REQUIRED_COUNT = 5;
const TELEGRAM_REFERRAL_QUALIFICATION_DELAY_MS = 24 * 60 * 60 * 1000;

function addOneCalendarMonth(date: Date) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

export type TelegramReferralProgress = {
  qualifiedCount: number;
  pendingCount: number;
  remainingCount: number;
  activeAccessExpiresAt: Date | null;
};

export type TelegramReferralHistoryItem = {
  id: number;
  status: "pending" | "qualified" | "rejected";
  createdAt: Date;
  qualifiedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
};

export type TelegramReferralQualificationEvent = {
  referrerChatId: string;
  qualifiedCount: number;
  remainingCount: number;
  rewardExpiresAt?: Date;
};

export type TelegramReferralRegistrationResult = "created" | "self_referral" | "referrer_not_found" | "already_referred" | "unavailable";

/** يسجل دعوة المستخدم الجديد مرة واحدة فقط، ولا يثق بمعرّف قادم من غير رابط /start صالح. */
export async function createTelegramReferral(referrerTelegramUserId: string, refereeTelegramUserId: string, refereeChatId: string): Promise<TelegramReferralRegistrationResult> {
  const db = await getDb();
  if (!db || !referrerTelegramUserId || !refereeTelegramUserId) return "unavailable";
  if (referrerTelegramUserId === refereeTelegramUserId) return "self_referral";
  const referrer = await db.select({ telegramUserId: telegramSubscribers.telegramUserId })
    .from(telegramSubscribers).where(eq(telegramSubscribers.telegramUserId, referrerTelegramUserId)).limit(1);
  if (!referrer[0]) return "referrer_not_found";
  try {
    await db.insert(telegramReferrals).values({ referrerTelegramUserId, refereeTelegramUserId, refereeChatId });
    return "created";
  } catch (error) {
    const code = (error as { code?: string })?.code;
    return code === "ER_DUP_ENTRY" ? "already_referred" : "unavailable";
  }
}

/** يؤهل الإحالة بعد التحقق من شروط الدخول ومرور 24 ساعة، ثم ينشئ مكافأة شهرية عند كل خمس إحالات. */
export async function qualifyTelegramReferral(refereeTelegramUserId: string): Promise<{ qualified: boolean; event?: TelegramReferralQualificationEvent }> {
  const db = await getDb();
  if (!db || !refereeTelegramUserId) return { qualified: false };
  const referral = (await db.select().from(telegramReferrals)
    .where(and(eq(telegramReferrals.refereeTelegramUserId, refereeTelegramUserId), eq(telegramReferrals.status, "pending"))).limit(1))[0];
  if (!referral || referral.createdAt.getTime() + TELEGRAM_REFERRAL_QUALIFICATION_DELAY_MS > Date.now()) return { qualified: false };
  const verifiedPlatform = await db.select({ telegramUserId: telegramPlatformAccess.telegramUserId })
    .from(telegramPlatformAccess)
    .where(and(eq(telegramPlatformAccess.telegramUserId, refereeTelegramUserId), isNotNull(telegramPlatformAccess.webAppVerifiedAt)))
    .limit(1);
  if (!verifiedPlatform[0]) return { qualified: false };
  const update = await db.update(telegramReferrals).set({ status: "qualified", qualifiedAt: new Date() })
    .where(and(eq(telegramReferrals.id, referral.id), eq(telegramReferrals.status, "pending")));
  if (Number((update as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) < 1) return { qualified: false };

  const qualifiedRows = await db.select({ id: telegramReferrals.id }).from(telegramReferrals)
    .where(and(eq(telegramReferrals.referrerTelegramUserId, referral.referrerTelegramUserId), eq(telegramReferrals.status, "qualified")));
  const qualifiedCount = qualifiedRows.length;
  const remainder = qualifiedCount % TELEGRAM_REFERRAL_REQUIRED_COUNT;
  const remainingCount = remainder === 0 ? TELEGRAM_REFERRAL_REQUIRED_COUNT : TELEGRAM_REFERRAL_REQUIRED_COUNT - remainder;
  const referrer = await db.select({ chatId: telegramSubscribers.chatId }).from(telegramSubscribers)
    .where(eq(telegramSubscribers.telegramUserId, referral.referrerTelegramUserId)).limit(1);
  const event = referrer[0] ? { referrerChatId: referrer[0].chatId, qualifiedCount, remainingCount } : undefined;
  const milestone = Math.floor(qualifiedCount / TELEGRAM_REFERRAL_REQUIRED_COUNT) * TELEGRAM_REFERRAL_REQUIRED_COUNT;
  if (milestone < TELEGRAM_REFERRAL_REQUIRED_COUNT) return { qualified: true, event };

  const existingReward = await db.select({ id: telegramReferralRewards.id }).from(telegramReferralRewards)
    .where(and(eq(telegramReferralRewards.referrerTelegramUserId, referral.referrerTelegramUserId), eq(telegramReferralRewards.qualifiedReferralCount, milestone))).limit(1);
  if (existingReward[0]) return { qualified: true, event };
  const activeReward = await db.select({ accessExpiresAt: telegramReferralRewards.accessExpiresAt }).from(telegramReferralRewards)
    .where(and(eq(telegramReferralRewards.referrerTelegramUserId, referral.referrerTelegramUserId), eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, new Date())))
    .orderBy(desc(telegramReferralRewards.accessExpiresAt)).limit(1);
  const accessStartsAt = activeReward[0]?.accessExpiresAt ?? new Date();
  const accessExpiresAt = addOneCalendarMonth(accessStartsAt);
  try {
    await db.insert(telegramReferralRewards).values({ referrerTelegramUserId: referral.referrerTelegramUserId, qualifiedReferralCount: milestone, accessStartsAt, accessExpiresAt });
  } catch {
    return { qualified: true, event };
  }
  return { qualified: true, event: event ? { ...event, rewardExpiresAt: accessExpiresAt } : undefined };
}

/** يؤهل جميع الإحالات التي تجاوزت مدة الحماية؛ تستدعى من مهمة دورية مصادق عليها فقط. */
export async function qualifyDueTelegramReferrals(now = new Date(), limit = 100): Promise<{ qualified: number; events: TelegramReferralQualificationEvent[] }> {
  const db = await getDb();
  if (!db) return { qualified: 0, events: [] };
  const eligibleBefore = new Date(now.getTime() - TELEGRAM_REFERRAL_QUALIFICATION_DELAY_MS);
  const candidates = await db.select({ refereeTelegramUserId: telegramReferrals.refereeTelegramUserId })
    .from(telegramReferrals)
    .where(and(eq(telegramReferrals.status, "pending"), lt(telegramReferrals.createdAt, eligibleBefore)))
    .orderBy(asc(telegramReferrals.createdAt))
    .limit(Math.max(1, Math.min(200, limit)));
  let qualified = 0;
  const events: TelegramReferralQualificationEvent[] = [];
  for (const candidate of candidates) {
    const result = await qualifyTelegramReferral(candidate.refereeTelegramUserId);
    if (!result.qualified) continue;
    qualified += 1;
    if (result.event) events.push(result.event);
  }
  return { qualified, events };
}

export async function getTelegramReferralProgress(telegramUserId: string): Promise<TelegramReferralProgress> {
  const db = await getDb();
  if (!db || !telegramUserId) return { qualifiedCount: 0, pendingCount: 0, remainingCount: TELEGRAM_REFERRAL_REQUIRED_COUNT, activeAccessExpiresAt: null };
  const [qualifiedRows, pendingRows, activeRewards] = await Promise.all([
    db.select({ id: telegramReferrals.id }).from(telegramReferrals).where(and(eq(telegramReferrals.referrerTelegramUserId, telegramUserId), eq(telegramReferrals.status, "qualified"))),
    db.select({ id: telegramReferrals.id }).from(telegramReferrals).where(and(eq(telegramReferrals.referrerTelegramUserId, telegramUserId), eq(telegramReferrals.status, "pending"))),
    db.select({ accessExpiresAt: telegramReferralRewards.accessExpiresAt }).from(telegramReferralRewards)
      .where(and(eq(telegramReferralRewards.referrerTelegramUserId, telegramUserId), eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, new Date())))
      .orderBy(desc(telegramReferralRewards.accessExpiresAt)).limit(1),
  ]);
  const remainder = qualifiedRows.length % TELEGRAM_REFERRAL_REQUIRED_COUNT;
  return { qualifiedCount: qualifiedRows.length, pendingCount: pendingRows.length, remainingCount: remainder === 0 ? TELEGRAM_REFERRAL_REQUIRED_COUNT : TELEGRAM_REFERRAL_REQUIRED_COUNT - remainder, activeAccessExpiresAt: activeRewards[0]?.accessExpiresAt ?? null };
}

export async function listTelegramReferralHistory(telegramUserId: string, limit = 20): Promise<TelegramReferralHistoryItem[]> {
  const db = await getDb();
  if (!db || !telegramUserId) return [];
  return db.select({
    id: telegramReferrals.id,
    status: telegramReferrals.status,
    createdAt: telegramReferrals.createdAt,
    qualifiedAt: telegramReferrals.qualifiedAt,
    rejectedAt: telegramReferrals.rejectedAt,
    rejectionReason: telegramReferrals.rejectionReason,
  }).from(telegramReferrals)
    .where(eq(telegramReferrals.referrerTelegramUserId, telegramUserId))
    .orderBy(desc(telegramReferrals.createdAt), desc(telegramReferrals.id))
    .limit(Math.max(1, Math.min(50, limit)));
}

export async function listManagedTelegramReferralRewards(limit = 100): Promise<{ summary: { qualifiedReferrals: number; pendingReferrals: number; activeRewards: number }; rewards: Array<{ id: number; referrerTelegramUserId: string; qualifiedReferralCount: number; status: "active" | "revoked"; accessStartsAt: Date; accessExpiresAt: Date; revokedAt: Date | null; revokeReason: string | null }> }> {
  const db = await getDb();
  if (!db) return { summary: { qualifiedReferrals: 0, pendingReferrals: 0, activeRewards: 0 }, rewards: [] };
  const [qualifiedRows, pendingRows, activeRows, rewards] = await Promise.all([
    db.select({ id: telegramReferrals.id }).from(telegramReferrals).where(eq(telegramReferrals.status, "qualified")),
    db.select({ id: telegramReferrals.id }).from(telegramReferrals).where(eq(telegramReferrals.status, "pending")),
    db.select({ id: telegramReferralRewards.id }).from(telegramReferralRewards).where(and(eq(telegramReferralRewards.status, "active"), gt(telegramReferralRewards.accessExpiresAt, new Date()))),
    db.select().from(telegramReferralRewards).orderBy(desc(telegramReferralRewards.createdAt)).limit(Math.max(1, Math.min(limit, 100))),
  ]);
  return { summary: { qualifiedReferrals: qualifiedRows.length, pendingReferrals: pendingRows.length, activeRewards: activeRows.length }, rewards };
}

export async function revokeManagedTelegramReferralReward(rewardId: number, adminUserId: string, reason?: unknown): Promise<boolean> {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(rewardId) || rewardId < 1) return false;
  const revokeReason = typeof reason === "string" ? reason.trim().slice(0, 255) || null : null;
  const result = await db.update(telegramReferralRewards).set({ status: "revoked", revokedByAdminUserId: adminUserId, revokedAt: new Date(), revokeReason })
    .where(and(eq(telegramReferralRewards.id, rewardId), eq(telegramReferralRewards.status, "active")));
  const changed = Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
  if (changed) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "revoke", entityType: "referral_reward", entityId: String(rewardId), details: { reason: revokeReason } });
  return changed;
}

export async function createImportantYemeniLawsSubscriptionRequest(
  telegramUserId: string,
  chatId: string,
  profile: { username?: string; firstName?: string; lastName?: string; paymentMethod?: string; accessScope?: TelegramSubscriptionAccessScope } = {}
): Promise<{ id: number; created: boolean } | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const accessScope = profile.accessScope ?? "important_laws";
  const existing = await db.select({ id: telegramImportantYemeniLawsSubscriptionRequests.id })
    .from(telegramImportantYemeniLawsSubscriptionRequests)
    .where(and(eq(telegramImportantYemeniLawsSubscriptionRequests.telegramUserId, telegramUserId), eq(telegramImportantYemeniLawsSubscriptionRequests.accessScope, accessScope), eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending")))
    .limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };

  const result = await db.insert(telegramImportantYemeniLawsSubscriptionRequests).values({
    telegramUserId,
    chatId,
    accessScope,
    telegramUsername: profile.username?.trim().replace(/^@/, "").slice(0, 64) || null,
    telegramFirstName: profile.firstName?.trim().slice(0, 128) || null,
    telegramLastName: profile.lastName?.trim().slice(0, 128) || null,
    paymentMethod: profile.paymentMethod?.trim().slice(0, 32) || null,
  }).$returningId();
  const id = Number(result[0]?.id ?? 0);
  return id > 0 ? { id, created: true } : undefined;
}

export async function approveImportantYemeniLawsSubscriptionRequest(requestId: number, ownerTelegramUserId: string): Promise<{ telegramUserId: string; chatId: string; accessScope: TelegramSubscriptionAccessScope } | undefined> {
  const db = await getDb();
  if (!db || !Number.isInteger(requestId) || requestId < 1) return undefined;
  const request = await db.select()
    .from(telegramImportantYemeniLawsSubscriptionRequests)
    .where(and(eq(telegramImportantYemeniLawsSubscriptionRequests.id, requestId), eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending")))
    .limit(1);
  const pendingRequest = request[0];
  if (!pendingRequest) return undefined;

  const result = await db.update(telegramImportantYemeniLawsSubscriptionRequests)
    .set({ status: "approved", reviewedByTelegramUserId: ownerTelegramUserId, reviewedAt: new Date() })
    .where(and(eq(telegramImportantYemeniLawsSubscriptionRequests.id, requestId), eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending")));
  if (Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) < 1) return undefined;

  if (pendingRequest.accessScope === "important_laws") {
    await db.insert(telegramImportantYemeniLawsAccess).values({ telegramUserId: pendingRequest.telegramUserId, approvedByTelegramUserId: ownerTelegramUserId })
      .onDuplicateKeyUpdate({ set: { approvedByTelegramUserId: ownerTelegramUserId, approvedAt: new Date() } });
  } else {
    const accessPatch = pendingRequest.accessScope === "sharia_exams" ? { shariaExamsAccess: true } : { secondaryExamsAccess: true };
    await db.insert(telegramManualPremiumAccess).values({ telegramUserId: pendingRequest.telegramUserId, approvedByTelegramUserId: ownerTelegramUserId, ...accessPatch })
      .onDuplicateKeyUpdate({ set: { ...accessPatch, approvedByTelegramUserId: ownerTelegramUserId, approvedAt: new Date() } });
  }
  return { telegramUserId: pendingRequest.telegramUserId, chatId: pendingRequest.chatId, accessScope: pendingRequest.accessScope };
}

export async function rejectImportantYemeniLawsSubscriptionRequest(requestId: number, ownerTelegramUserId: string): Promise<{ telegramUserId: string; chatId: string; accessScope: TelegramSubscriptionAccessScope } | undefined> {
  const db = await getDb();
  if (!db || !Number.isInteger(requestId) || requestId < 1) return undefined;
  const request = await db.select()
    .from(telegramImportantYemeniLawsSubscriptionRequests)
    .where(and(eq(telegramImportantYemeniLawsSubscriptionRequests.id, requestId), eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending")))
    .limit(1);
  const pendingRequest = request[0];
  if (!pendingRequest) return undefined;

  const result = await db.update(telegramImportantYemeniLawsSubscriptionRequests)
    .set({ status: "rejected", reviewedByTelegramUserId: ownerTelegramUserId, reviewedAt: new Date() })
    .where(and(eq(telegramImportantYemeniLawsSubscriptionRequests.id, requestId), eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending")));
  if (Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) < 1) return undefined;
  return { telegramUserId: pendingRequest.telegramUserId, chatId: pendingRequest.chatId, accessScope: pendingRequest.accessScope };
}

export async function listPendingImportantYemeniLawsSubscriptionRequests(limit = 10): Promise<Array<{ id: number; telegramUserId: string; chatId: string; accessScope: TelegramSubscriptionAccessScope; telegramUsername: string | null; telegramFirstName: string | null; telegramLastName: string | null; paymentMethod: string | null; createdAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: telegramImportantYemeniLawsSubscriptionRequests.id,
    telegramUserId: telegramImportantYemeniLawsSubscriptionRequests.telegramUserId,
    chatId: telegramImportantYemeniLawsSubscriptionRequests.chatId,
    accessScope: telegramImportantYemeniLawsSubscriptionRequests.accessScope,
    telegramUsername: telegramImportantYemeniLawsSubscriptionRequests.telegramUsername,
    telegramFirstName: telegramImportantYemeniLawsSubscriptionRequests.telegramFirstName,
    telegramLastName: telegramImportantYemeniLawsSubscriptionRequests.telegramLastName,
    paymentMethod: telegramImportantYemeniLawsSubscriptionRequests.paymentMethod,
    createdAt: telegramImportantYemeniLawsSubscriptionRequests.createdAt,
  })
    .from(telegramImportantYemeniLawsSubscriptionRequests)
    .where(eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending"))
    .orderBy(desc(telegramImportantYemeniLawsSubscriptionRequests.createdAt))
    .limit(Math.max(1, Math.min(limit, 20)));
}

export type PendingImportantYemeniLawsReminder = {
  id: number;
  telegramUserId: string;
  chatId: string;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
  paymentMethod: string | null;
  createdAt: Date;
};

export async function listDueImportantYemeniLawsSubscriptionReminders(now = new Date(), limit = 20): Promise<PendingImportantYemeniLawsReminder[]> {
  const db = await getDb();
  if (!db) return [];
  const reminderThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return db.select({
    id: telegramImportantYemeniLawsSubscriptionRequests.id,
    telegramUserId: telegramImportantYemeniLawsSubscriptionRequests.telegramUserId,
    chatId: telegramImportantYemeniLawsSubscriptionRequests.chatId,
    telegramUsername: telegramImportantYemeniLawsSubscriptionRequests.telegramUsername,
    telegramFirstName: telegramImportantYemeniLawsSubscriptionRequests.telegramFirstName,
    telegramLastName: telegramImportantYemeniLawsSubscriptionRequests.telegramLastName,
    paymentMethod: telegramImportantYemeniLawsSubscriptionRequests.paymentMethod,
    createdAt: telegramImportantYemeniLawsSubscriptionRequests.createdAt,
  })
    .from(telegramImportantYemeniLawsSubscriptionRequests)
    .where(and(
      eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending"),
      lt(telegramImportantYemeniLawsSubscriptionRequests.createdAt, reminderThreshold),
      or(isNull(telegramImportantYemeniLawsSubscriptionRequests.lastReminderAt), lt(telegramImportantYemeniLawsSubscriptionRequests.lastReminderAt, reminderThreshold))
    ))
    .orderBy(asc(telegramImportantYemeniLawsSubscriptionRequests.createdAt))
    .limit(Math.max(1, Math.min(limit, 50)));
}

export async function claimImportantYemeniLawsSubscriptionReminder(requestId: number, now = new Date()): Promise<boolean> {
  const db = await getDb();
  if (!db || !Number.isInteger(requestId) || requestId < 1) return false;
  const reminderThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const result = await db.update(telegramImportantYemeniLawsSubscriptionRequests)
    .set({ lastReminderAt: now })
    .where(and(
      eq(telegramImportantYemeniLawsSubscriptionRequests.id, requestId),
      eq(telegramImportantYemeniLawsSubscriptionRequests.status, "pending"),
      or(isNull(telegramImportantYemeniLawsSubscriptionRequests.lastReminderAt), lt(telegramImportantYemeniLawsSubscriptionRequests.lastReminderAt, reminderThreshold))
    ));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
}

export async function getTelegramScheduledTaskByUid(taskUid: string) {
  const db = await getDb();
  if (!db || !taskUid) return undefined;
  const rows = await db.select().from(telegramScheduledTasks).where(eq(telegramScheduledTasks.taskUid, taskUid)).limit(1);
  return rows[0];
}

export async function upsertTelegramScheduledTask(taskKey: string, taskUid: string): Promise<void> {
  const db = await getDb();
  if (!db || !taskKey || !taskUid) return;
  await db.insert(telegramScheduledTasks).values({ taskKey, taskUid })
    .onDuplicateKeyUpdate({ set: { taskUid, updatedAt: new Date() } });
}

export const LEGAL_SOURCE_PAGE_SIZE = 8;
export const JUDICIAL_ROOT_FOLDER_ID = "13jDFI3IkNoK1kAyifU1KODZ0_j6DGpoq";
export const LEGISLATION_ROOT_FOLDER_ID = "1bEkLg2uaeQOULqZi6yIEfU0aKtMMB3J4";
export const YEMENI_LAWS_ROOT_FOLDER_ID = "15ZWnJtqszUggVJcQVsyyfZZRXGtUgK0J";
export const LEGAL_FORMS_ROOT_FOLDER_ID = "1ABgTWPMDWPgj1HmFkRaV9rnTDU4kZ4h9";
export const ILLUSTRATED_LEGAL_FORMS_ROOT_FOLDER_ID = "17Yx06hL5bJXp2i80qW39n7yys3MqqztT";
export const ALL_YEMENI_LAWS_ROOT_FOLDER_ID = "all-yemeni-laws-root";
export const FEATURED_REFERENCES_ROOT_FOLDER_ID = "17QASX45F7JlN4EIYICMUHN2NtfsEvuIu";
export const IMPORTANT_YEMENI_LAWS_ROOT_FOLDER_ID = "important-yemeni-laws-interactive";
export const JUDICIAL_SOURCE_PAGE_SIZE = 7;
export const JUDICIAL_SEARCH_PAGE_SIZE = 7;
const JUDICIAL_SEARCH_SESSION_MINUTES = 10;
export type LegislationDocumentType = (typeof legislationDocumentTypeValues)[number];
export type TelegramUsageEventType = "browse" | "search" | "document_request" | "support_request";

export async function listLegalSourcesByCategory(category: LegalCategory, page = 1): Promise<{ sources: LegalSource[]; total: number }> {
  const db = await getDb();
  if (!db) return { sources: [], total: 0 };

  const safePage = Math.max(1, page);
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.category, category), eq(legalSources.collection, "judicial"))),
    db
      .select()
      .from(legalSources)
      .where(and(eq(legalSources.category, category), eq(legalSources.collection, "judicial")))
      .orderBy(asc(legalSources.sortOrder))
      .limit(LEGAL_SOURCE_PAGE_SIZE)
      .offset((safePage - 1) * LEGAL_SOURCE_PAGE_SIZE),
  ]);

  return { sources, total: Number(totalResult[0]?.value ?? 0) };
}

export async function createLegalSource(source: InsertLegalSource): Promise<LegalSource> {
  const db = await getDb();
  if (!db) {
    throw new Error("قاعدة البيانات غير متاحة حاليًا");
  }

  const result = await db.insert(legalSources).values(source).$returningId();
  const id = result[0]?.id;
  if (!id) {
    throw new Error("تعذر إنشاء المصدر القانوني");
  }

  const created = await getLegalSourceById(id);
  if (!created) {
    throw new Error("تعذر قراءة المصدر القانوني الجديد");
  }
  return created;
}

/** يختار مجلد القسم الأعلى ليظهر الملف المرفوع من الإدارة عند فتح القسم في البوت. */
export function selectManagedUploadFolderId(
  collection: LegalCollection,
  folders: Array<Pick<LegalFolder, "collection" | "driveFolderId" | "parentDriveFolderId" | "sortOrder">>
): string | null {
  return folders
    .filter(folder => folder.collection === collection && folder.parentDriveFolderId === null)
    .sort((first, second) => first.sortOrder - second.sortOrder || first.driveFolderId.localeCompare(second.driveFolderId))[0]
    ?.driveFolderId ?? null;
}

export async function createManagedTelegramSource(input: {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  collection?: unknown;
  sortOrder?: unknown;
  isFeatured?: unknown;
  url?: unknown;
}, adminUserId: string): Promise<LegalSource | undefined> {
  if (!adminUserId || typeof input.title !== "string" || typeof input.description !== "string" || typeof input.url !== "string") return undefined;
  const title = input.title.trim().slice(0, 255);
  const description = input.description.trim().slice(0, 4000);
  const category = input.category;
  const collection = input.collection;
  const url = input.url.trim();
  if (!title || !description || !url || !legalCategoryValues.includes(category as typeof legalCategoryValues[number]) || !legalCollectionValues.includes(collection as typeof legalCollectionValues[number])) return undefined;
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات البوت غير متاحة حاليًا");
  const rootFolders = await db.select({
    collection: legalFolders.collection,
    driveFolderId: legalFolders.driveFolderId,
    parentDriveFolderId: legalFolders.parentDriveFolderId,
    sortOrder: legalFolders.sortOrder,
  }).from(legalFolders).where(and(eq(legalFolders.collection, collection as LegalCollection), isNull(legalFolders.parentDriveFolderId))).orderBy(asc(legalFolders.sortOrder), asc(legalFolders.driveFolderId));
  const driveFolderId = selectManagedUploadFolderId(collection as LegalCollection, rootFolders);
  if (!driveFolderId) throw new Error("القسم المختار غير مهيأ للعرض داخل البوت");
  const sortOrder = Math.min(999999, Math.max(0, Math.trunc(Number(input.sortOrder) || 0)));
  const source = await createLegalSource({
    title,
    description,
    category: category as typeof legalCategoryValues[number],
    collection: collection as typeof legalCollectionValues[number],
    sortOrder,
    isFeatured: input.isFeatured === true,
    url,
    driveFileId: null,
    driveFolderId,
    folderSortOrder: sortOrder,
    documentType: "other",
    legislationYear: null,
    issuingAuthority: null,
  });
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "create", entityType: "legal_source", entityId: String(source.id), details: { title, collection, driveFolderId, storage: url.startsWith("/manus-storage/") } });
  return source;
}

export type ManagedTelegramSourceInput = { title: string; description: string; sortOrder: number; isFeatured: boolean };

export async function listManagedTelegramSources(query = "", page = 1, pageSize = 20): Promise<{ sources: LegalSource[]; total: number }> {
  const db = await getDb();
  if (!db) return { sources: [], total: 0 };
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Math.trunc(pageSize) || 20));
  const normalizedQuery = query.trim().slice(0, 128);
  const filter = normalizedQuery ? or(like(legalSources.title, `%${normalizedQuery}%`), like(legalSources.description, `%${normalizedQuery}%`)) : undefined;
  const [sources, countRows] = await Promise.all([
    db.select().from(legalSources).where(filter).orderBy(desc(legalSources.updatedAt), asc(legalSources.id)).limit(safePageSize).offset((safePage - 1) * safePageSize),
    db.select({ value: count() }).from(legalSources).where(filter),
  ]);
  return { sources, total: Number(countRows[0]?.value ?? 0) };
}

export async function updateManagedTelegramSource(id: number, input: Partial<ManagedTelegramSourceInput>, adminUserId: string): Promise<LegalSource | undefined> {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(id) || id < 1) return undefined;
  const current = (await db.select().from(legalSources).where(eq(legalSources.id, id)).limit(1))[0];
  if (!current) return undefined;
  const title = input.title?.trim().slice(0, 255);
  const description = input.description?.trim().slice(0, 4000);
  if (!title || !description) return undefined;
  const sortOrder = Math.min(999999, Math.max(0, Math.trunc(Number(input.sortOrder) || 0)));
  const isFeatured = input.isFeatured === true;
  await db.update(legalSources).set({ title, description, sortOrder, isFeatured }).where(eq(legalSources.id, id));
  const source = (await db.select().from(legalSources).where(eq(legalSources.id, id)).limit(1))[0];
  if (source) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "update", entityType: "legal_source", entityId: String(id), details: { title, sortOrder, isFeatured } });
  return source;
}

/** يحذف السجل من فهرس البوت فقط؛ لا يحذف الملف الأصلي من Google Drive أو التخزين. */
export async function deleteManagedTelegramSource(id: number, adminUserId: string): Promise<boolean> {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(id) || id < 1) return false;
  const source = (await db.select().from(legalSources).where(eq(legalSources.id, id)).limit(1))[0];
  if (!source) return false;
  await db.delete(legalSources).where(eq(legalSources.id, id));
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "delete", entityType: "legal_source", entityId: String(id), details: { title: source.title, collection: source.collection } });
  return true;
}

export async function listManagedTelegramFolders(query = "", limit = 100): Promise<LegalFolder[]> {
  const db = await getDb();
  if (!db) return [];
  const normalizedQuery = query.trim().slice(0, 128);
  const filter = normalizedQuery ? like(legalFolders.name, `%${normalizedQuery}%`) : undefined;
  return db.select().from(legalFolders).where(filter).orderBy(asc(legalFolders.collection), asc(legalFolders.sortOrder), asc(legalFolders.name)).limit(Math.min(200, Math.max(1, limit)));
}

export async function updateManagedTelegramFolder(id: number, input: { name?: unknown; sortOrder?: unknown }, adminUserId: string): Promise<LegalFolder | undefined> {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(id) || id < 1 || typeof input.name !== "string") return undefined;
  const name = input.name.trim().slice(0, 255);
  if (!name) return undefined;
  const sortOrder = Math.min(999999, Math.max(0, Math.trunc(Number(input.sortOrder) || 0)));
  await db.update(legalFolders).set({ name, sortOrder }).where(eq(legalFolders.id, id));
  const folder = (await db.select().from(legalFolders).where(eq(legalFolders.id, id)).limit(1))[0];
  if (folder) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "update", entityType: "legal_folder", entityId: String(id), details: { name, sortOrder } });
  return folder;
}

/** لا يحذف المجلد إلا إذا كان فارغًا؛ يحمي المستندات والمجلدات الفرعية من الحذف العرضي. */
export async function deleteManagedTelegramFolder(id: number, adminUserId: string): Promise<"deleted" | "not_empty" | "unavailable"> {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(id) || id < 1) return "unavailable";
  const folder = (await db.select().from(legalFolders).where(eq(legalFolders.id, id)).limit(1))[0];
  if (!folder) return "unavailable";
  const [source, child] = await Promise.all([
    db.select({ id: legalSources.id }).from(legalSources).where(eq(legalSources.driveFolderId, folder.driveFolderId)).limit(1),
    db.select({ id: legalFolders.id }).from(legalFolders).where(eq(legalFolders.parentDriveFolderId, folder.driveFolderId)).limit(1),
  ]);
  if (source[0] || child[0]) return "not_empty";
  await db.delete(legalFolders).where(eq(legalFolders.id, id));
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "delete", entityType: "legal_folder", entityId: String(id), details: { name: folder.name } });
  return "deleted";
}

export async function searchLegalSources(query: string): Promise<LegalSource[]> {
  const db = await getDb();
  if (!db) return [];

  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const pattern = `%${normalizedQuery}%`;

  return db
    .select()
    .from(legalSources)
    .where(and(eq(legalSources.collection, "judicial"), or(like(legalSources.title, pattern), like(legalSources.description, pattern))))
    .orderBy(asc(legalSources.sortOrder))
    .limit(20);
}

export async function getLegalSourceById(id: number): Promise<LegalSource | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(legalSources).where(eq(legalSources.id, id)).limit(1);
  return result[0];
}

export type TelegramFavoriteSaveResult = "added" | "exists" | "unavailable";

export async function saveTelegramDocumentFavorite(telegramUserId: string, sourceId: number): Promise<TelegramFavoriteSaveResult> {
  const db = await getDb();
  if (!db || !telegramUserId || !Number.isInteger(sourceId) || sourceId < 1) return "unavailable";
  const source = await db.select({ id: legalSources.id }).from(legalSources).where(eq(legalSources.id, sourceId)).limit(1);
  if (!source[0]) return "unavailable";
  const existing = await db.select({ id: telegramDocumentFavorites.id }).from(telegramDocumentFavorites)
    .where(and(eq(telegramDocumentFavorites.telegramUserId, telegramUserId), eq(telegramDocumentFavorites.sourceId, sourceId)))
    .limit(1);
  if (existing[0]) return "exists";
  await db.insert(telegramDocumentFavorites).values({ telegramUserId, sourceId });
  return "added";
}

export async function listTelegramDocumentFavorites(telegramUserId: string, limit = 50): Promise<Array<{ favorite: TelegramDocumentFavorite; source: LegalSource }>> {
  const db = await getDb();
  if (!db || !telegramUserId) return [];
  const rows = await db.select({ favorite: telegramDocumentFavorites, source: legalSources })
    .from(telegramDocumentFavorites)
    .innerJoin(legalSources, eq(telegramDocumentFavorites.sourceId, legalSources.id))
    .where(eq(telegramDocumentFavorites.telegramUserId, telegramUserId))
    .orderBy(desc(telegramDocumentFavorites.createdAt), desc(telegramDocumentFavorites.id))
    .limit(Math.max(1, Math.min(limit, 50)));
  return rows;
}

export async function removeTelegramDocumentFavorite(telegramUserId: string, sourceId: number): Promise<boolean> {
  const db = await getDb();
  if (!db || !telegramUserId || !Number.isInteger(sourceId) || sourceId < 1) return false;
  const result = await db.delete(telegramDocumentFavorites)
    .where(and(eq(telegramDocumentFavorites.telegramUserId, telegramUserId), eq(telegramDocumentFavorites.sourceId, sourceId)));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
}

export async function listRecentLegalSources(limit = 6): Promise<LegalSource[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(legalSources)
    .where(ne(legalSources.collection, "important_yemeni_laws"))
    .orderBy(desc(legalSources.createdAt), desc(legalSources.id))
    .limit(Math.max(1, Math.min(limit, 12)));
}

export async function listFeaturedLegalSources(limit = 6): Promise<LegalSource[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(legalSources)
    .where(and(eq(legalSources.isFeatured, true), ne(legalSources.collection, "important_yemeni_laws")))
    .orderBy(desc(legalSources.updatedAt), asc(legalSources.sortOrder))
    .limit(Math.max(1, Math.min(limit, 12)));
}

export async function listPopularLegalSources(limit = 6): Promise<LegalSource[]> {
  const db = await getDb();
  if (!db) return [];
  const events = await db.select({ sourceId: telegramUsageEvents.sourceId })
    .from(telegramUsageEvents)
    .where(and(eq(telegramUsageEvents.eventType, "document_request"), isNotNull(telegramUsageEvents.sourceId)))
    .orderBy(desc(telegramUsageEvents.createdAt))
    .limit(1000);
  const rankedIds = Array.from(events.reduce((counts, event) => {
    if (event.sourceId) counts.set(event.sourceId, (counts.get(event.sourceId) ?? 0) + 1);
    return counts;
  }, new Map<number, number>()).entries())
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, Math.max(1, Math.min(limit, 12)))
    .map(([sourceId]) => sourceId);
  if (rankedIds.length === 0) return [];
  const sources = await Promise.all(rankedIds.map(sourceId => getLegalSourceById(sourceId)));
  return sources
    .filter((source): source is LegalSource => source !== undefined && source.collection !== "important_yemeni_laws")
    .slice(0, Math.max(1, Math.min(limit, 12)));
}

export async function listLegislationSourcesByType(documentType: LegislationDocumentType, page = 1): Promise<{ sources: LegalSource[]; total: number }> {
  const db = await getDb();
  if (!db) return { sources: [], total: 0 };
  const safePage = Math.max(1, page);
  const filter = and(eq(legalSources.collection, "legislation"), eq(legalSources.documentType, documentType));
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);
  return { sources, total: Number(totalResult[0]?.value ?? 0) };
}

export async function listLegislationYears(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ year: legalSources.legislationYear })
    .from(legalSources)
    .where(and(eq(legalSources.collection, "legislation"), isNotNull(legalSources.legislationYear)))
    .orderBy(desc(legalSources.legislationYear));
  return Array.from(new Set(rows.map(row => row.year).filter((year): year is number => typeof year === "number")));
}

export async function listLegislationSourcesByYear(year: number, page = 1): Promise<{ sources: LegalSource[]; total: number }> {
  const db = await getDb();
  if (!db || !Number.isInteger(year)) return { sources: [], total: 0 };
  const safePage = Math.max(1, page);
  const filter = and(eq(legalSources.collection, "legislation"), eq(legalSources.legislationYear, year));
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);
  return { sources, total: Number(totalResult[0]?.value ?? 0) };
}

export async function recordTelegramUsageEvent(telegramUserId: string, eventType: TelegramUsageEventType, options: { query?: string; sourceId?: number; sectionKey?: string } = {}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(telegramUsageEvents).values({
    telegramUserId,
    eventType,
    sectionKey: options.sectionKey?.trim().slice(0, 64) || null,
    query: options.query?.slice(0, 255) ?? null,
    sourceId: options.sourceId ?? null,
  });
}

export type TelegramUsageAnalytics = {
  periodDays: number;
  totalEvents: number;
  uniqueUsers: number;
  eventTypes: Array<{ eventType: TelegramUsageEventType; count: number }>;
  topSections: Array<{ sectionKey: string; count: number }>;
  topSources: Array<{ sourceId: number; title: string; count: number }>;
};

export type TelegramVisitPeriod = "day" | "week" | "month";

export type TelegramVisitAnalytics = {
  period: TelegramVisitPeriod;
  since: Date;
  platformVisits: { total: number; uniqueUsers: number };
  hasadVisits: { total: number; uniqueUsers: number };
  users: Array<{
    telegramUserId: string;
    telegramUsername: string | null;
    telegramFirstName: string | null;
    telegramLastName: string | null;
    platformVisitedAt: Date | null;
    hasadVisitedAt: Date | null;
  }>;
};

export function getTelegramVisitPeriodStart(period: TelegramVisitPeriod, now = new Date()) {
  const days = period === "day" ? 1 : period === "week" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** يعيد زيارات الفترة المختارة فقط؛ تظهر الهويات للمدير المصرح له عبر المسار الإداري حصراً. */
export async function getTelegramVisitAnalytics(period: TelegramVisitPeriod = "month"): Promise<TelegramVisitAnalytics> {
  const since = getTelegramVisitPeriodStart(period);
  const empty: TelegramVisitAnalytics = {
    period,
    since,
    platformVisits: { total: 0, uniqueUsers: 0 },
    hasadVisits: { total: 0, uniqueUsers: 0 },
    users: [],
  };
  const db = await getDb();
  if (!db) return empty;

  const events = await db.select({
    telegramUserId: telegramVisitEvents.telegramUserId,
    site: telegramVisitEvents.site,
    visitedAt: telegramVisitEvents.visitedAt,
  }).from(telegramVisitEvents)
    .where(gte(telegramVisitEvents.visitedAt, since))
    .orderBy(desc(telegramVisitEvents.visitedAt))
    .limit(2000);

  const platformEvents = events.filter(event => event.site === "platform");
  const hasadEvents = events.filter(event => event.site === "hasad");
  const latestByUser = new Map<string, { platformVisitedAt: Date | null; hasadVisitedAt: Date | null; latestAt: Date }>();
  for (const event of events) {
    const current = latestByUser.get(event.telegramUserId) ?? { platformVisitedAt: null, hasadVisitedAt: null, latestAt: event.visitedAt };
    if (event.site === "platform" && !current.platformVisitedAt) current.platformVisitedAt = event.visitedAt;
    if (event.site === "hasad" && !current.hasadVisitedAt) current.hasadVisitedAt = event.visitedAt;
    if (event.visitedAt > current.latestAt) current.latestAt = event.visitedAt;
    latestByUser.set(event.telegramUserId, current);
  }
  const userIds = Array.from(latestByUser.entries())
    .sort(([, left], [, right]) => right.latestAt.getTime() - left.latestAt.getTime())
    .slice(0, 100)
    .map(([telegramUserId]) => telegramUserId);
  if (userIds.length === 0) return {
    ...empty,
    platformVisits: { total: platformEvents.length, uniqueUsers: new Set(platformEvents.map(event => event.telegramUserId)).size },
    hasadVisits: { total: hasadEvents.length, uniqueUsers: new Set(hasadEvents.map(event => event.telegramUserId)).size },
  };
  const subscribers = await db.select({
    telegramUserId: telegramSubscribers.telegramUserId,
    telegramUsername: telegramSubscribers.telegramUsername,
    telegramFirstName: telegramSubscribers.telegramFirstName,
    telegramLastName: telegramSubscribers.telegramLastName,
  }).from(telegramSubscribers).where(inArray(telegramSubscribers.telegramUserId, userIds));
  const subscriberByUserId = new Map(subscribers.map(subscriber => [subscriber.telegramUserId, subscriber]));
  return {
    period,
    since,
    platformVisits: { total: platformEvents.length, uniqueUsers: new Set(platformEvents.map(event => event.telegramUserId)).size },
    hasadVisits: { total: hasadEvents.length, uniqueUsers: new Set(hasadEvents.map(event => event.telegramUserId)).size },
    users: userIds.map(telegramUserId => {
      const subscriber = subscriberByUserId.get(telegramUserId);
      const latest = latestByUser.get(telegramUserId)!;
      return {
        telegramUserId,
        telegramUsername: subscriber?.telegramUsername ?? null,
        telegramFirstName: subscriber?.telegramFirstName ?? null,
        telegramLastName: subscriber?.telegramLastName ?? null,
        platformVisitedAt: latest.platformVisitedAt,
        hasadVisitedAt: latest.hasadVisitedAt,
      };
    }),
  };
}

/** يعيد مؤشرات مجمعة فقط؛ لا يعرض معرفات أو ملفات تعريف مستخدمي تيليغرام. */
export async function getTelegramUsageAnalytics(periodDays = 30): Promise<TelegramUsageAnalytics> {
  const db = await getDb();
  const safeDays = Math.min(90, Math.max(1, Math.trunc(periodDays) || 30));
  if (!db) return { periodDays: safeDays, totalEvents: 0, uniqueUsers: 0, eventTypes: [], topSections: [], topSources: [] };
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const events = await db.select({ telegramUserId: telegramUsageEvents.telegramUserId, eventType: telegramUsageEvents.eventType, sectionKey: telegramUsageEvents.sectionKey, sourceId: telegramUsageEvents.sourceId })
    .from(telegramUsageEvents).where(gt(telegramUsageEvents.createdAt, since)).limit(5000);
  const eventTypes = Array.from(events.reduce((counts, event) => {
    counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
    return counts;
  }, new Map<TelegramUsageEventType, number>()).entries()).map(([eventType, count]) => ({ eventType, count })).sort((a, b) => b.count - a.count || a.eventType.localeCompare(b.eventType));
  const topSections = Array.from(events.reduce((counts, event) => {
    if (event.sectionKey) counts.set(event.sectionKey, (counts.get(event.sectionKey) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()).entries()).map(([sectionKey, count]) => ({ sectionKey, count })).sort((a, b) => b.count - a.count || a.sectionKey.localeCompare(b.sectionKey)).slice(0, 10);
  const rankedSources = Array.from(events.reduce((counts, event) => {
    if (event.sourceId) counts.set(event.sourceId, (counts.get(event.sourceId) ?? 0) + 1);
    return counts;
  }, new Map<number, number>()).entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 10);
  const topSources = (await Promise.all(rankedSources.map(async ([sourceId, count]) => {
    const source = await getLegalSourceById(sourceId);
    return source ? { sourceId, title: source.title, count } : undefined;
  }))).filter((source): source is { sourceId: number; title: string; count: number } => Boolean(source));
  return { periodDays: safeDays, totalEvents: events.length, uniqueUsers: new Set(events.map(event => event.telegramUserId)).size, eventTypes, topSections, topSources };
}

export async function createTelegramSupportRequest(telegramUserId: string, chatId: string, message: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await db.insert(telegramSupportRequests).values({
    telegramUserId,
    chatId,
    message: message.trim().slice(0, 2000),
    status: "new",
  });
}

export async function consumeTelegramSupportMessage(telegramUserId: string, chatId: string, message: string): Promise<boolean> {
  const normalized = message.trim();
  if (!normalized.startsWith("/support ")) return false;
  const request = normalized.slice("/support ".length).trim();
  if (!request) return false;
  await createTelegramSupportRequest(telegramUserId, chatId, request);
  await recordTelegramUsageEvent(telegramUserId, "support_request");
  return true;
}

export async function getTelegramOwnerStatistics(): Promise<{ totalEvents: number; totalSupportRequests: number; totalSubscribers: number; firstSubscribedAt: Date | null; lastActiveAt: Date | null; regions: Array<{ region: string; count: number }>; platformVisits: { total: number; latestAt: Date | null }; hasadVisits: { total: number; latestAt: Date | null }; topQueries: Array<{ query: string; count: number }> }> {
  const db = await getDb();
  if (!db) return { totalEvents: 0, totalSupportRequests: 0, totalSubscribers: 0, firstSubscribedAt: null, lastActiveAt: null, regions: [], platformVisits: { total: 0, latestAt: null }, hasadVisits: { total: 0, latestAt: null }, topQueries: [] };
  const [eventResult, supportResult, searchEvents, subscriberResult, firstSubscriber, lastActiveSubscriber, regionResult, platformVisitResult, latestPlatformVisit, hasadVisitResult, latestHasadVisit] = await Promise.all([
    db.select({ value: count() }).from(telegramUsageEvents),
    db.select({ value: count() }).from(telegramSupportRequests).where(eq(telegramSupportRequests.status, "new")),
    db.select({ query: telegramUsageEvents.query }).from(telegramUsageEvents).where(and(eq(telegramUsageEvents.eventType, "search"), isNotNull(telegramUsageEvents.query))).orderBy(desc(telegramUsageEvents.createdAt)).limit(1000),
    db.select({ value: count() }).from(telegramSubscribers),
    db.select({ subscribedAt: telegramSubscribers.subscribedAt }).from(telegramSubscribers).orderBy(asc(telegramSubscribers.subscribedAt)).limit(1),
    db.select({ lastSeenAt: telegramSubscribers.lastSeenAt }).from(telegramSubscribers).orderBy(desc(telegramSubscribers.lastSeenAt)).limit(1),
    db.select({ region: telegramPlatformAccess.region, value: count() }).from(telegramPlatformAccess).where(isNotNull(telegramPlatformAccess.region)).groupBy(telegramPlatformAccess.region).orderBy(desc(count())).limit(8),
    db.select({ value: count() }).from(telegramPlatformAccess).where(isNotNull(telegramPlatformAccess.webAppVerifiedAt)),
    db.select({ webAppVerifiedAt: telegramPlatformAccess.webAppVerifiedAt }).from(telegramPlatformAccess).where(isNotNull(telegramPlatformAccess.webAppVerifiedAt)).orderBy(desc(telegramPlatformAccess.webAppVerifiedAt)).limit(1),
    db.select({ value: count() }).from(telegramHasadAccess),
    db.select({ visitedAt: telegramHasadAccess.visitedAt }).from(telegramHasadAccess).orderBy(desc(telegramHasadAccess.visitedAt)).limit(1),
  ]);
  const topQueries = Array.from(searchEvents.reduce((counts, event) => {
    if (event.query) counts.set(event.query, (counts.get(event.query) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()).entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ar"))
    .slice(0, 5)
    .map(([query, value]) => ({ query, count: value }));
  return {
    totalEvents: Number(eventResult[0]?.value ?? 0),
    totalSupportRequests: Number(supportResult[0]?.value ?? 0),
    totalSubscribers: Number(subscriberResult[0]?.value ?? 0),
    firstSubscribedAt: firstSubscriber[0]?.subscribedAt ?? null,
    lastActiveAt: lastActiveSubscriber[0]?.lastSeenAt ?? null,
    regions: regionResult.flatMap((entry) => entry.region ? [{ region: entry.region, count: Number(entry.value) }] : []),
    platformVisits: { total: Number(platformVisitResult[0]?.value ?? 0), latestAt: latestPlatformVisit[0]?.webAppVerifiedAt ?? null },
    hasadVisits: { total: Number(hasadVisitResult[0]?.value ?? 0), latestAt: latestHasadVisit[0]?.visitedAt ?? null },
    topQueries,
  };
}

export async function listNewTelegramSupportRequests(limit = 10): Promise<Array<{ id: number; message: string; createdAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: telegramSupportRequests.id, message: telegramSupportRequests.message, createdAt: telegramSupportRequests.createdAt })
    .from(telegramSupportRequests)
    .where(eq(telegramSupportRequests.status, "new"))
    .orderBy(desc(telegramSupportRequests.createdAt))
    .limit(Math.max(1, Math.min(limit, 20)));
}

export async function registerTelegramSubscriber(
  chatId: string,
  telegramUserId: string,
  profile?: { telegramUsername?: string | null; telegramFirstName?: string | null; telegramLastName?: string | null }
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select({ chatId: telegramSubscribers.chatId })
    .from(telegramSubscribers)
    .where(eq(telegramSubscribers.chatId, chatId))
    .limit(1);
  await db.insert(telegramSubscribers).values({
    chatId,
    telegramUserId,
    telegramUsername: profile?.telegramUsername ?? null,
    telegramFirstName: profile?.telegramFirstName ?? null,
    telegramLastName: profile?.telegramLastName ?? null,
  }).onDuplicateKeyUpdate({
    set: {
      telegramUserId,
      telegramUsername: profile?.telegramUsername ?? null,
      telegramFirstName: profile?.telegramFirstName ?? null,
      telegramLastName: profile?.telegramLastName ?? null,
      lastSeenAt: new Date(),
    },
  });
  return existing.length === 0;
}

export async function listTelegramSubscriberChatIds(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ chatId: telegramSubscribers.chatId }).from(telegramSubscribers);
  return rows.map(row => row.chatId);
}

export type TelegramBroadcastDraft = Pick<TelegramBroadcast, "id" | "ownerTelegramUserId" | "kind" | "message" | "fileId" | "fileName" | "caption" | "status" | "recipientCount" | "scheduledFor" | "scheduleCronTaskUid">;

export async function createTelegramBroadcastDraft(input: {
  ownerTelegramUserId: string;
  kind: "message" | "document";
  message?: string;
  fileId?: string;
  fileName?: string;
  caption?: string;
}): Promise<TelegramBroadcastDraft | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const recipientCount = (await listTelegramSubscriberChatIds()).length;
  const result = await db.insert(telegramBroadcasts).values({
    ownerTelegramUserId: input.ownerTelegramUserId,
    kind: input.kind,
    message: input.message?.trim().slice(0, 4000) ?? null,
    fileId: input.fileId ?? null,
    fileName: input.fileName?.slice(0, 255) ?? null,
    caption: input.caption?.trim().slice(0, 1000) ?? null,
    recipientCount,
  }).$returningId();
  const insertId = Number(result[0]?.id ?? 0);
  if (!insertId) return undefined;
  return getTelegramBroadcastDraft(insertId, input.ownerTelegramUserId);
}

export async function createManagedTelegramBroadcastDraft(adminUserId: string, message: unknown): Promise<TelegramBroadcastDraft | undefined> {
  const normalizedMessage = typeof message === "string" ? message.trim().slice(0, 4000) : "";
  if (!adminUserId || !normalizedMessage) return undefined;
  const draft = await createTelegramBroadcastDraft({ ownerTelegramUserId: adminUserId, kind: "message", message: normalizedMessage });
  const db = await getDb();
  if (draft && db) await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: "create", entityType: "broadcast", entityId: String(draft.id), details: { recipientCount: draft.recipientCount, length: normalizedMessage.length } });
  return draft;
}

export async function listManagedTelegramBroadcasts(limit = 20): Promise<Array<Pick<TelegramBroadcast, "id" | "kind" | "message" | "status" | "recipientCount" | "successCount" | "failureCount" | "scheduledFor" | "createdAt" | "completedAt">>> {
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
    completedAt: telegramBroadcasts.completedAt,
  }).from(telegramBroadcasts).orderBy(desc(telegramBroadcasts.createdAt), desc(telegramBroadcasts.id)).limit(Math.min(50, Math.max(1, limit)));
}

export async function recordManagedTelegramBroadcastAudit(adminUserId: string, broadcastId: number, action: "confirm" | "cancel" | "complete" | "schedule", details: Record<string, unknown> = {}): Promise<void> {
  const db = await getDb();
  if (!db || !adminUserId || !Number.isInteger(broadcastId) || broadcastId < 1) return;
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action, entityType: "broadcast", entityId: String(broadcastId), details });
}

export async function recordManagedTelegramAdminAudit(adminUserId: string, action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}): Promise<void> {
  const db = await getDb();
  if (!db || !adminUserId || !action || !entityType || !entityId) return;
  await db.insert(telegramAdminAuditLogs).values({ adminUserId, action: action.slice(0, 64), entityType: entityType.slice(0, 64), entityId: entityId.slice(0, 128), details });
}

export async function getTelegramBroadcastDraft(id: number, ownerTelegramUserId: string): Promise<TelegramBroadcastDraft | undefined> {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1) return undefined;
  const rows = await db.select().from(telegramBroadcasts)
    .where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.ownerTelegramUserId, ownerTelegramUserId)))
    .limit(1);
  return rows[0];
}

export async function cancelTelegramBroadcastDraft(id: number, ownerTelegramUserId: string): Promise<boolean> {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1) return false;
  const result = await db.update(telegramBroadcasts)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.ownerTelegramUserId, ownerTelegramUserId), eq(telegramBroadcasts.status, "draft")));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
}

export async function beginTelegramBroadcast(id: number, ownerTelegramUserId: string): Promise<boolean> {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1) return false;
  const result = await db.update(telegramBroadcasts)
    .set({ status: "sending" })
    .where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.ownerTelegramUserId, ownerTelegramUserId), eq(telegramBroadcasts.status, "draft"), isNull(telegramBroadcasts.scheduleCronTaskUid)));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
}

export async function scheduleTelegramBroadcast(id: number, ownerTelegramUserId: string, scheduledFor: Date, taskUid: string): Promise<boolean> {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1 || !taskUid.trim() || scheduledFor.getTime() <= Date.now()) return false;
  const result = await db.update(telegramBroadcasts)
    .set({ scheduledFor, scheduleCronTaskUid: taskUid.trim().slice(0, 65) })
    .where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.ownerTelegramUserId, ownerTelegramUserId), eq(telegramBroadcasts.status, "draft"), isNull(telegramBroadcasts.scheduleCronTaskUid)));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
}

export async function getScheduledTelegramBroadcast(taskUid: string): Promise<TelegramBroadcast | undefined> {
  const db = await getDb();
  if (!db || !taskUid.trim()) return undefined;
  const rows = await db.select().from(telegramBroadcasts).where(eq(telegramBroadcasts.scheduleCronTaskUid, taskUid.trim())).limit(1);
  return rows[0];
}

export async function beginScheduledTelegramBroadcast(id: number, taskUid: string): Promise<boolean> {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1 || !taskUid.trim()) return false;
  const result = await db.update(telegramBroadcasts)
    .set({ status: "sending" })
    .where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.scheduleCronTaskUid, taskUid.trim()), eq(telegramBroadcasts.status, "draft")));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
}

export async function completeTelegramBroadcast(id: number, ownerTelegramUserId: string, successCount: number, failureCount: number): Promise<boolean> {
  const db = await getDb();
  if (!db || !Number.isInteger(id) || id < 1) return false;
  const result = await db.update(telegramBroadcasts)
    .set({ status: "sent", successCount, failureCount, completedAt: new Date() })
    .where(and(eq(telegramBroadcasts.id, id), eq(telegramBroadcasts.ownerTelegramUserId, ownerTelegramUserId), eq(telegramBroadcasts.status, "sending")));
  return Number((result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;
}

export async function getJudicialFolderContents(folderId: string, page = 1): Promise<{
  folder: LegalFolder | undefined;
  folders: LegalFolder[];
  sources: LegalSource[];
  totalSources: number;
}> {
  const db = await getDb();
  if (!db) return { folder: undefined, folders: [], sources: [], totalSources: 0 };

  const safePage = Math.max(1, page);
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, "judicial"))).limit(1),
    db
      .select()
      .from(legalFolders)
      .where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, "judicial")))
      .orderBy(asc(legalFolders.sortOrder))
      .limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, "judicial"))),
    db
      .select()
      .from(legalSources)
      .where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, "judicial")))
      .orderBy(asc(legalSources.folderSortOrder))
      .limit(JUDICIAL_SOURCE_PAGE_SIZE)
      .offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);

  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0),
  };
}

export async function getLegislationFolderContents(folderId: string, page = 1): Promise<{
  folder: LegalFolder | undefined;
  folders: LegalFolder[];
  sources: LegalSource[];
  totalSources: number;
}> {
  const db = await getDb();
  if (!db) return { folder: undefined, folders: [], sources: [], totalSources: 0 };

  const safePage = Math.max(1, page);
  const legislation = "legislation" as const;
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, legislation))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, legislation))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, legislation))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, legislation))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);

  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0),
  };
}

export async function getYemeniLawsFolderContents(folderId: string, page = 1): Promise<{
  folder: LegalFolder | undefined;
  folders: LegalFolder[];
  sources: LegalSource[];
  totalSources: number;
}> {
  const db = await getDb();
  if (!db) return { folder: undefined, folders: [], sources: [], totalSources: 0 };

  const safePage = Math.max(1, page);
  const yemeniLaws = "yemeni_laws" as const;
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, yemeniLaws))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, yemeniLaws))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, yemeniLaws))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, yemeniLaws))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);

  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0),
  };
}

export async function getLegalFormsFolderContents(folderId: string, page = 1): Promise<{
  folder: LegalFolder | undefined;
  folders: LegalFolder[];
  sources: LegalSource[];
  totalSources: number;
}> {
  const db = await getDb();
  if (!db) return { folder: undefined, folders: [], sources: [], totalSources: 0 };

  const safePage = Math.max(1, page);
  const legalForms = "legal_forms" as const;
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, legalForms))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, legalForms))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, legalForms))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, legalForms))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);

  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0),
  };
}

export async function getIllustratedLegalFormsFolderContents(folderId: string, page = 1): Promise<{
  folder: LegalFolder | undefined;
  folders: LegalFolder[];
  sources: LegalSource[];
  totalSources: number;
}> {
  const db = await getDb();
  if (!db) return { folder: undefined, folders: [], sources: [], totalSources: 0 };

  const safePage = Math.max(1, page);
  const illustratedLegalForms = "illustrated_legal_forms" as const;
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, illustratedLegalForms))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, illustratedLegalForms))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, illustratedLegalForms))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, illustratedLegalForms))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);

  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0),
  };
}

export async function getAllYemeniLawsFolderContents(folderId: string, page = 1): Promise<{
  folder: LegalFolder | undefined;
  folders: LegalFolder[];
  sources: LegalSource[];
  totalSources: number;
}> {
  const db = await getDb();
  if (!db) return { folder: undefined, folders: [], sources: [], totalSources: 0 };

  const safePage = Math.max(1, page);
  const allYemeniLaws = "all_yemeni_laws" as const;
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, allYemeniLaws))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, allYemeniLaws))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, allYemeniLaws))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, allYemeniLaws))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);

  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0),
  };
}

export async function getFeaturedReferencesFolderContents(folderId: string, page = 1): Promise<{
  folder: LegalFolder | undefined;
  folders: LegalFolder[];
  sources: LegalSource[];
  totalSources: number;
}> {
  const db = await getDb();
  if (!db) return { folder: undefined, folders: [], sources: [], totalSources: 0 };

  const safePage = Math.max(1, page);
  const featuredReferences = "featured_references" as const;
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, featuredReferences))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, featuredReferences))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, featuredReferences))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, featuredReferences))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);

  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0),
  };
}

export async function getImportantYemeniLawsFolderContents(folderId: string, page = 1): Promise<{
  folder: LegalFolder | undefined;
  folders: LegalFolder[];
  sources: LegalSource[];
  totalSources: number;
}> {
  const db = await getDb();
  if (!db) return { folder: undefined, folders: [], sources: [], totalSources: 0 };

  const safePage = Math.max(1, page);
  const importantYemeniLaws = "important_yemeni_laws" as const;
  const [folderResult, folders, totalResult, sources] = await Promise.all([
    db.select().from(legalFolders).where(and(eq(legalFolders.driveFolderId, folderId), eq(legalFolders.collection, importantYemeniLaws))).limit(1),
    db.select().from(legalFolders).where(and(eq(legalFolders.parentDriveFolderId, folderId), eq(legalFolders.collection, importantYemeniLaws))).orderBy(asc(legalFolders.sortOrder)).limit(60),
    db.select({ value: count() }).from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, importantYemeniLaws))),
    db.select().from(legalSources).where(and(eq(legalSources.driveFolderId, folderId), eq(legalSources.collection, importantYemeniLaws))).orderBy(asc(legalSources.folderSortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);

  return {
    folder: folderResult[0],
    folders,
    sources,
    totalSources: Number(totalResult[0]?.value ?? 0),
  };
}

function searchExpiry() {
  return new Date(Date.now() + JUDICIAL_SEARCH_SESSION_MINUTES * 60 * 1000);
}

export async function beginJudicialSearch(chatId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");

  await db.delete(legislationSearchSessions).where(eq(legislationSearchSessions.chatId, chatId));
  await db.delete(allYemeniLawsSearchSessions).where(eq(allYemeniLawsSearchSessions.chatId, chatId));
  await db.delete(librarySearchSessions).where(eq(librarySearchSessions.chatId, chatId));
  await db.delete(telegramContractTemplateSearchSessions).where(eq(telegramContractTemplateSearchSessions.chatId, chatId));
  await db.insert(judicialSearchSessions).values({
    chatId,
    query: null,
    status: "awaiting",
    expiresAt: searchExpiry(),
  }).onDuplicateKeyUpdate({
    set: { query: null, status: "awaiting", expiresAt: searchExpiry() },
  });
}

export async function beginLegislationSearch(chatId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");

  await db.delete(judicialSearchSessions).where(eq(judicialSearchSessions.chatId, chatId));
  await db.delete(allYemeniLawsSearchSessions).where(eq(allYemeniLawsSearchSessions.chatId, chatId));
  await db.delete(librarySearchSessions).where(eq(librarySearchSessions.chatId, chatId));
  await db.delete(telegramContractTemplateSearchSessions).where(eq(telegramContractTemplateSearchSessions.chatId, chatId));
  await db.insert(legislationSearchSessions).values({
    chatId,
    query: null,
    status: "awaiting",
    expiresAt: searchExpiry(),
  }).onDuplicateKeyUpdate({
    set: { query: null, status: "awaiting", expiresAt: searchExpiry() },
  });
}

export async function beginLibrarySearch(chatId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");

  await db.delete(judicialSearchSessions).where(eq(judicialSearchSessions.chatId, chatId));
  await db.delete(legislationSearchSessions).where(eq(legislationSearchSessions.chatId, chatId));
  await db.delete(allYemeniLawsSearchSessions).where(eq(allYemeniLawsSearchSessions.chatId, chatId));
  await db.delete(telegramContractTemplateSearchSessions).where(eq(telegramContractTemplateSearchSessions.chatId, chatId));
  await db.insert(librarySearchSessions).values({
    chatId,
    query: null,
    status: "awaiting",
    expiresAt: searchExpiry(),
  }).onDuplicateKeyUpdate({
    set: { query: null, status: "awaiting", expiresAt: searchExpiry() },
  });
}

export async function consumeJudicialSearchQuery(chatId: string, query: string): Promise<JudicialSearchSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const normalizedQuery = query.trim().slice(0, 255);
  if (!normalizedQuery) return undefined;
  const now = new Date();
  const awaitingResult = await db.select().from(judicialSearchSessions)
    .where(and(eq(judicialSearchSessions.chatId, chatId), eq(judicialSearchSessions.status, "awaiting"), gt(judicialSearchSessions.expiresAt, now)))
    .limit(1);
  const awaitingSession = awaitingResult[0];
  if (!awaitingSession) return undefined;

  const expiresAt = searchExpiry();
  await db.update(judicialSearchSessions)
    .set({ query: normalizedQuery, status: "ready", expiresAt })
    .where(eq(judicialSearchSessions.id, awaitingSession.id));

  return { ...awaitingSession, query: normalizedQuery, status: "ready", expiresAt };
}

export async function consumeLegislationSearchQuery(chatId: string, query: string): Promise<LegislationSearchSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const normalizedQuery = query.trim().slice(0, 255);
  if (!normalizedQuery) return undefined;
  const now = new Date();
  const awaitingResult = await db.select().from(legislationSearchSessions)
    .where(and(eq(legislationSearchSessions.chatId, chatId), eq(legislationSearchSessions.status, "awaiting"), gt(legislationSearchSessions.expiresAt, now)))
    .limit(1);
  const awaitingSession = awaitingResult[0];
  if (!awaitingSession) return undefined;

  const expiresAt = searchExpiry();
  await db.update(legislationSearchSessions)
    .set({ query: normalizedQuery, status: "ready", expiresAt })
    .where(eq(legislationSearchSessions.id, awaitingSession.id));

  return { ...awaitingSession, query: normalizedQuery, status: "ready", expiresAt };
}

export async function consumeLibrarySearchQuery(chatId: string, query: string): Promise<LibrarySearchSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const normalizedQuery = query.trim().slice(0, 255);
  if (!normalizedQuery) return undefined;
  const now = new Date();
  const awaitingResult = await db.select().from(librarySearchSessions)
    .where(and(eq(librarySearchSessions.chatId, chatId), eq(librarySearchSessions.status, "awaiting"), gt(librarySearchSessions.expiresAt, now)))
    .limit(1);
  const awaitingSession = awaitingResult[0];
  if (!awaitingSession) return undefined;

  const expiresAt = searchExpiry();
  await db.update(librarySearchSessions)
    .set({ query: normalizedQuery, status: "ready", expiresAt })
    .where(eq(librarySearchSessions.id, awaitingSession.id));

  return { ...awaitingSession, query: normalizedQuery, status: "ready", expiresAt };
}

export async function beginAllYemeniLawsSearch(chatId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");

  await db.delete(judicialSearchSessions).where(eq(judicialSearchSessions.chatId, chatId));
  await db.delete(legislationSearchSessions).where(eq(legislationSearchSessions.chatId, chatId));
  await db.delete(librarySearchSessions).where(eq(librarySearchSessions.chatId, chatId));
  await db.delete(telegramContractTemplateSearchSessions).where(eq(telegramContractTemplateSearchSessions.chatId, chatId));
  await db.insert(allYemeniLawsSearchSessions).values({
    chatId,
    query: null,
    status: "awaiting",
    expiresAt: searchExpiry(),
  }).onDuplicateKeyUpdate({
    set: { query: null, status: "awaiting", expiresAt: searchExpiry() },
  });
}

export async function consumeAllYemeniLawsSearchQuery(chatId: string, query: string): Promise<AllYemeniLawsSearchSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const normalizedQuery = query.trim().slice(0, 255);
  if (!normalizedQuery) return undefined;
  const now = new Date();
  const awaitingResult = await db.select().from(allYemeniLawsSearchSessions)
    .where(and(eq(allYemeniLawsSearchSessions.chatId, chatId), eq(allYemeniLawsSearchSessions.status, "awaiting"), gt(allYemeniLawsSearchSessions.expiresAt, now)))
    .limit(1);
  const awaitingSession = awaitingResult[0];
  if (!awaitingSession) return undefined;

  const expiresAt = searchExpiry();
  await db.update(allYemeniLawsSearchSessions)
    .set({ query: normalizedQuery, status: "ready", expiresAt })
    .where(eq(allYemeniLawsSearchSessions.id, awaitingSession.id));

  return { ...awaitingSession, query: normalizedQuery, status: "ready", expiresAt };
}

export async function beginTelegramContractTemplateSearch(chatId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");

  await db.delete(judicialSearchSessions).where(eq(judicialSearchSessions.chatId, chatId));
  await db.delete(legislationSearchSessions).where(eq(legislationSearchSessions.chatId, chatId));
  await db.delete(librarySearchSessions).where(eq(librarySearchSessions.chatId, chatId));
  await db.delete(allYemeniLawsSearchSessions).where(eq(allYemeniLawsSearchSessions.chatId, chatId));
  await db.insert(telegramContractTemplateSearchSessions).values({
    chatId,
    query: null,
    status: "awaiting",
    expiresAt: searchExpiry(),
  }).onDuplicateKeyUpdate({
    set: { query: null, status: "awaiting", expiresAt: searchExpiry() },
  });
}

export async function consumeTelegramContractTemplateSearchQuery(chatId: string, query: string): Promise<TelegramContractTemplateSearchSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const normalizedQuery = query.trim().slice(0, 255);
  if (!normalizedQuery) return undefined;
  const now = new Date();
  const awaitingResult = await db.select().from(telegramContractTemplateSearchSessions)
    .where(and(eq(telegramContractTemplateSearchSessions.chatId, chatId), eq(telegramContractTemplateSearchSessions.status, "awaiting"), gt(telegramContractTemplateSearchSessions.expiresAt, now)))
    .limit(1);
  const awaitingSession = awaitingResult[0];
  if (!awaitingSession) return undefined;

  const expiresAt = searchExpiry();
  await db.update(telegramContractTemplateSearchSessions)
    .set({ query: normalizedQuery, status: "ready", expiresAt })
    .where(eq(telegramContractTemplateSearchSessions.id, awaitingSession.id));

  return { ...awaitingSession, query: normalizedQuery, status: "ready", expiresAt };
}

export type JudicialSearchMatchType = "exact" | "approximate";

export function normalizeArabicSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0621-\u063A\u0641-\u064A0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedSearchWords(value: string) {
  return normalizeArabicSearch(value)
    .split(" ")
    .filter(word => word.length > 1)
    .map(word => word.startsWith("ال") && word.length > 4 ? word.slice(2) : word);
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? previous[rightIndex - 1]
        : Math.min(previous[rightIndex] + 1, current[rightIndex - 1] + 1, previous[rightIndex - 1] + 1);
    }
    for (let index = 0; index < current.length; index += 1) previous[index] = current[index];
  }
  return previous[right.length];
}

export function approximateArabicMatchScore(query: string, source: Pick<LegalSource, "title" | "description">) {
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

export function fallbackJudicialSearchResults(query: string, candidates: LegalSource[], page = 1) {
  const approximate = candidates
    .map(source => ({ source, score: approximateArabicMatchScore(query, source) }))
    .filter(result => result.score > 0)
    .sort((left, right) => right.score - left.score || left.source.sortOrder - right.source.sortOrder);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * JUDICIAL_SEARCH_PAGE_SIZE;
  return {
    sources: approximate.slice(start, start + JUDICIAL_SEARCH_PAGE_SIZE).map(result => result.source),
    total: approximate.length,
  };
}

function fallbackContractTemplateSearchResults(query: string, candidates: TelegramContractTemplate[], page = 1) {
  const approximate = candidates
    .map(template => ({ template, score: approximateArabicMatchScore(query, { title: template.fileName, description: "" }) }))
    .filter(result => result.score > 0)
    .sort((left, right) => right.score - left.score || left.template.sortOrder - right.template.sortOrder || left.template.id - right.template.id);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * CONTRACT_TEMPLATE_SEARCH_PAGE_SIZE;
  return {
    templates: approximate.slice(start, start + CONTRACT_TEMPLATE_SEARCH_PAGE_SIZE).map(result => result.template),
    total: approximate.length,
  };
}

export async function searchTelegramContractTemplates(sessionId: number, page = 1): Promise<{ query: string; templates: TelegramContractTemplate[]; total: number; matchType: JudicialSearchMatchType } | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const now = new Date();
  const sessionResult = await db.select().from(telegramContractTemplateSearchSessions)
    .where(and(eq(telegramContractTemplateSearchSessions.id, sessionId), eq(telegramContractTemplateSearchSessions.status, "ready"), gt(telegramContractTemplateSearchSessions.expiresAt, now)))
    .limit(1);
  const session = sessionResult[0];
  if (!session?.query) return undefined;

  const safePage = Math.max(1, page);
  const filter = and(eq(telegramContractTemplates.isActive, true), like(telegramContractTemplates.fileName, `%${session.query}%`));
  const [totalResult, templates] = await Promise.all([
    db.select({ value: count() }).from(telegramContractTemplates).where(filter),
    db.select().from(telegramContractTemplates).where(filter).orderBy(asc(telegramContractTemplates.sortOrder), asc(telegramContractTemplates.id)).limit(CONTRACT_TEMPLATE_SEARCH_PAGE_SIZE).offset((safePage - 1) * CONTRACT_TEMPLATE_SEARCH_PAGE_SIZE),
  ]);
  const total = Number(totalResult[0]?.value ?? 0);
  if (total > 0) return { query: session.query, templates, total, matchType: "exact" };

  const candidates = await db.select().from(telegramContractTemplates)
    .where(eq(telegramContractTemplates.isActive, true))
    .orderBy(asc(telegramContractTemplates.sortOrder), asc(telegramContractTemplates.id));
  const approximate = fallbackContractTemplateSearchResults(session.query, candidates, safePage);
  return { query: session.query, templates: approximate.templates, total: approximate.total, matchType: "approximate" };
}

export async function searchJudicialSources(sessionId: number, page = 1): Promise<{ query: string; sources: LegalSource[]; total: number; matchType: JudicialSearchMatchType } | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const now = new Date();
  const sessionResult = await db.select().from(judicialSearchSessions)
    .where(and(eq(judicialSearchSessions.id, sessionId), eq(judicialSearchSessions.status, "ready"), gt(judicialSearchSessions.expiresAt, now)))
    .limit(1);
  const session = sessionResult[0];
  if (!session?.query) return undefined;

  const pattern = `%${session.query}%`;
  const filter = and(
    eq(legalSources.collection, "judicial"),
    isNotNull(legalSources.driveFolderId),
    or(like(legalSources.title, pattern), like(legalSources.description, pattern))
  );
  const safePage = Math.max(1, page);
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SEARCH_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SEARCH_PAGE_SIZE),
  ]);

  const total = Number(totalResult[0]?.value ?? 0);
  if (total > 0) return { query: session.query, sources, total, matchType: "exact" };

  const candidates = await db.select().from(legalSources).where(and(eq(legalSources.collection, "judicial"), isNotNull(legalSources.driveFolderId))).orderBy(asc(legalSources.sortOrder)).limit(2000);
  const approximate = fallbackJudicialSearchResults(session.query, candidates, safePage);
  return {
    query: session.query,
    sources: approximate.sources,
    total: approximate.total,
    matchType: "approximate",
  };
}

export async function searchLegislationSources(sessionId: number, page = 1): Promise<{ query: string; sources: LegalSource[]; total: number; matchType: JudicialSearchMatchType } | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const now = new Date();
  const sessionResult = await db.select().from(legislationSearchSessions)
    .where(and(eq(legislationSearchSessions.id, sessionId), eq(legislationSearchSessions.status, "ready"), gt(legislationSearchSessions.expiresAt, now)))
    .limit(1);
  const session = sessionResult[0];
  if (!session?.query) return undefined;

  const pattern = `%${session.query}%`;
  const legislation = "legislation" as const;
  const filter = and(
    eq(legalSources.collection, legislation),
    or(like(legalSources.title, pattern), like(legalSources.description, pattern))
  );
  const safePage = Math.max(1, page);
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SEARCH_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SEARCH_PAGE_SIZE),
  ]);

  const total = Number(totalResult[0]?.value ?? 0);
  if (total > 0) return { query: session.query, sources, total, matchType: "exact" };

  const candidates = await db.select().from(legalSources).where(eq(legalSources.collection, legislation)).orderBy(asc(legalSources.sortOrder)).limit(2000);
  const approximate = fallbackJudicialSearchResults(session.query, candidates, safePage);
  return {
    query: session.query,
    sources: approximate.sources,
    total: approximate.total,
    matchType: "approximate",
  };
}

export async function searchAllYemeniLawsSources(sessionId: number, page = 1): Promise<{ query: string; sources: LegalSource[]; total: number; matchType: JudicialSearchMatchType } | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const now = new Date();
  const sessionResult = await db.select().from(allYemeniLawsSearchSessions)
    .where(and(eq(allYemeniLawsSearchSessions.id, sessionId), eq(allYemeniLawsSearchSessions.status, "ready"), gt(allYemeniLawsSearchSessions.expiresAt, now)))
    .limit(1);
  const session = sessionResult[0];
  if (!session?.query) return undefined;

  const pattern = `%${session.query}%`;
  const allYemeniLaws = "all_yemeni_laws" as const;
  const filter = and(
    eq(legalSources.collection, allYemeniLaws),
    or(like(legalSources.title, pattern), like(legalSources.description, pattern))
  );
  const safePage = Math.max(1, page);
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SOURCE_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SOURCE_PAGE_SIZE),
  ]);

  const total = Number(totalResult[0]?.value ?? 0);
  if (total > 0) return { query: session.query, sources, total, matchType: "exact" };

  const candidates = await db.select().from(legalSources).where(eq(legalSources.collection, allYemeniLaws)).orderBy(asc(legalSources.sortOrder)).limit(2000);
  const approximate = fallbackJudicialSearchResults(session.query, candidates, safePage);
  return {
    query: session.query,
    sources: approximate.sources,
    total: approximate.total,
    matchType: "approximate",
  };
}

export async function searchLibrarySources(sessionId: number, page = 1): Promise<{ query: string; sources: LegalSource[]; total: number; matchType: JudicialSearchMatchType } | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const now = new Date();
  const sessionResult = await db.select().from(librarySearchSessions)
    .where(and(eq(librarySearchSessions.id, sessionId), eq(librarySearchSessions.status, "ready"), gt(librarySearchSessions.expiresAt, now)))
    .limit(1);
  const session = sessionResult[0];
  if (!session?.query) return undefined;

  const pattern = `%${session.query}%`;
  const filter = and(
    eq(legalSources.collection, "judicial"),
    or(like(legalSources.title, pattern), like(legalSources.description, pattern))
  );
  const safePage = Math.max(1, page);
  const [totalResult, sources] = await Promise.all([
    db.select({ value: count() }).from(legalSources).where(filter),
    db.select().from(legalSources).where(filter).orderBy(asc(legalSources.sortOrder)).limit(JUDICIAL_SEARCH_PAGE_SIZE).offset((safePage - 1) * JUDICIAL_SEARCH_PAGE_SIZE),
  ]);

  const total = Number(totalResult[0]?.value ?? 0);
  if (total > 0) return { query: session.query, sources, total, matchType: "exact" };

  const candidates = await db.select().from(legalSources).where(eq(legalSources.collection, "judicial")).orderBy(asc(legalSources.sortOrder)).limit(2000);
  const approximate = fallbackJudicialSearchResults(session.query, candidates, safePage);
  return {
    query: session.query,
    sources: approximate.sources,
    total: approximate.total,
    matchType: "approximate",
  };
}
