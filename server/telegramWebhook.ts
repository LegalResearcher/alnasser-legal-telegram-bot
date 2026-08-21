import { timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import { approveImportantYemeniLawsSubscriptionRequest, beginAllYemeniLawsSearch, beginJudicialSearch, beginLegislationSearch, beginLibrarySearch, beginTelegramContractTemplateSearch, beginTelegramBroadcast, cancelTelegramBroadcastDraft, completeTelegramBroadcast, confirmTelegramPlatformAccess, consumeAllYemeniLawsSearchQuery, consumeJudicialSearchQuery, consumeLegislationSearchQuery, consumeLibrarySearchQuery, consumeTelegramContractTemplateSearchQuery, createImportantYemeniLawsSubscriptionRequest, createManagedTelegramMenuItem, createManagedTelegramSource, createTelegramBroadcastDraft, createTelegramSupportRequest, deleteManagedTelegramFolder, deleteManagedTelegramMenuItem, deleteManagedTelegramSource, getAllYemeniLawsFolderContents, getFeaturedReferencesFolderContents, getImportantYemeniLawsFolderContents, getJudicialFolderContents, getLegalFormsFolderContents, getLegislationFolderContents, getLegalSourceById, getTelegramBroadcastDraft, getTelegramContractTemplate, getTelegramOwnerStatistics, getYemeniLawsFolderContents, hasConfirmedTelegramPlatformAccess, hasImportantYemeniLawsAccess, listFeaturedLegalSources, listLegislationSourcesByType, listLegislationSourcesByYear, listLegislationYears, listLegalSourcesByCategory, listManagedTelegramFolders, listManagedTelegramMenuItems, listManagedTelegramMessageConfigs, listManagedTelegramSectionConfigs, listManagedTelegramSources, listNewTelegramSupportRequests, listPendingImportantYemeniLawsSubscriptionRequests, listPopularLegalSources, listRecentLegalSources, listTelegramAdminAuditLogs, listTelegramContractTemplateTypes, listTelegramContractTemplates, listTelegramContractTemplatesByType, listTelegramSubscriberChatIds, recordTelegramUsageEvent, registerTelegramSubscriber, rejectImportantYemeniLawsSubscriptionRequest, searchAllYemeniLawsSources, searchJudicialSources, searchLegislationSources, searchLibrarySources, searchLegalSources, searchTelegramContractTemplates, updateManagedTelegramFolder, updateManagedTelegramMenuItem, updateManagedTelegramMessageTemplate, updateManagedTelegramSection, updateManagedTelegramSource } from "./db";
import { storagePut } from "./storage";
import { getIllustratedLegalFormsFolderContents } from "./db";
import { listTelegramDocumentFavorites, removeTelegramDocumentFavorite, saveTelegramDocumentFavorite } from "./db";
import { createManagedTelegramBroadcastDraft, listManagedTelegramBroadcasts, recordManagedTelegramBroadcastAudit } from "./db";
import { recordManagedTelegramAdminAudit } from "./db";
import { createTelegramReferral, getTelegramReferralProgress, listTelegramReferralHistory, qualifyTelegramReferral } from "./db";
import { confirmTelegramHasadAccess } from "./db";
import { hasConfirmedTelegramHasadAccess } from "./db";
import { listManagedTelegramReferralRewards, revokeManagedTelegramReferralReward } from "./db";
import { getTelegramUsageAnalytics } from "./db";
import { getTelegramVisitAnalytics, type TelegramVisitPeriod } from "./db";
import { hasTelegramPremiumAccess } from "./db";
import { hasManagedTelegramMenuItemPremiumAccess } from "./db";
import { beginScheduledTelegramBroadcast, getScheduledTelegramBroadcast, scheduleTelegramBroadcast } from "./db";
import { createHeartbeatJob, deleteHeartbeatJob } from "./_core/heartbeat";
import { sdk } from "./_core/sdk";
import { cancelTelegramExamSession, getTelegramExamSession, getTelegramExamSessionByPoll, listTelegramExamForms, listTelegramExamQuestions, resolveTelegramExamPoll, setTelegramExamActivePoll, startTelegramExamSession } from "./telegramExamDb";
import { activateTelegramGroupExamRound, cancelTelegramGroupExamRound, createTelegramGroupExamRound, getTelegramGroupExamLeaderboard, getTelegramGroupExamRound, getTelegramGroupExamRoundByPoll, getTelegramGroupExamWaitingRound, joinTelegramGroupExamRound, recordTelegramGroupExamAnswer, resolveTelegramGroupExamPoll, setTelegramGroupExamActivePoll } from "./telegramGroupExamDb";
import { getTelegramExamResultSummary } from "./telegramExamResults";
import { createTelegramChannelMembershipChecker, createTelegramSender, handleTelegramUpdate, type TelegramUpdate } from "./telegram";
import { validateTelegramWebAppInitData, verifyAndRecordTelegramPlatformVisit } from "./telegramPlatformVisit";

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const PLATFORM_ORIGIN = "https://alnaseer.org";
const HASAD_ORIGINS = new Set(["https://www.hasad-alyoum.com", "https://hasad-alyoum.com"]);
const TELEGRAM_VISIT_ORIGINS = new Set([PLATFORM_ORIGIN, "https://www.hasad-alyoum.com", "https://hasad-alyoum.com"]);
const PLATFORM_SUPABASE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co";

export function normalizeTelegramRegion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const region = value.trim();
  return /^[A-Za-z_+-]+\/[A-Za-z_+\-/]+$/.test(region) && region.length <= 64 ? region : null;
}

export function normalizeScheduledBroadcastTime(value: unknown, now = new Date()): Date | undefined {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return undefined;
  const scheduledFor = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), parsed.getUTCHours(), parsed.getUTCMinutes(), 0));
  if (scheduledFor.getTime() < now.getTime() + 60_000 || scheduledFor.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1000) return undefined;
  return scheduledFor;
}

export function scheduledBroadcastCron(scheduledFor: Date): string {
  return `0 ${scheduledFor.getUTCMinutes()} ${scheduledFor.getUTCHours()} ${scheduledFor.getUTCDate()} ${scheduledFor.getUTCMonth() + 1} *`;
}

const TELEGRAM_LIBRARY_UPLOAD_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const TELEGRAM_LIBRARY_UPLOAD_TYPES_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
};

/** يقبل نوع المتصفح إن كان موثوقًا، أو يستنتجه من الامتداد عندما يعيده المتصفح فارغًا. */
export function resolveTelegramLibraryUploadContentType(fileName: unknown, suppliedType: unknown): string | undefined {
  const normalizedType = typeof suppliedType === "string" ? suppliedType.split(";", 1)[0]?.trim().toLowerCase() : "";
  if (normalizedType && TELEGRAM_LIBRARY_UPLOAD_TYPES.has(normalizedType)) return normalizedType;
  const extension = typeof fileName === "string" ? fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] : undefined;
  return extension ? TELEGRAM_LIBRARY_UPLOAD_TYPES_BY_EXTENSION[extension] : undefined;
}

/** خدمة التخزين تقبل مفاتيح ASCII فقط، لذا يبقى الاسم العربي في الفهرس ويستخدم التخزين معرفًا آمنًا مستقلًا. */
export function createTelegramLibraryStorageKey(fileName: string, now = Date.now(), randomId = crypto.randomUUID()): string {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]{1,10})$/)?.[0] ?? "";
  return `telegram-library/${now}-${randomId.replace(/[^a-zA-Z0-9-]/g, "")}${extension}`;
}

export async function getPlatformAdministratorId(authorization: string | undefined): Promise<string | undefined> {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !serviceRoleKey) return undefined;

  const userResponse = await fetch(`${PLATFORM_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) return undefined;
  const user = await userResponse.json() as { id?: string };
  if (!user.id) return undefined;

  const roleResponse = await fetch(`${PLATFORM_SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!roleResponse.ok) return undefined;
  const roles = await roleResponse.json() as Array<{ role?: string }>;
  return roles.some((role) => role.role === "admin") ? user.id : undefined;
}

export async function isPlatformAdministrator(authorization: string | undefined): Promise<boolean> {
  return Boolean(await getPlatformAdministratorId(authorization));
}

export function isValidTelegramWebhookSecret(receivedSecret: string | undefined, expectedSecret: string | undefined) {
  if (!receivedSecret || !expectedSecret) return false;
  const received = Buffer.from(receivedSecret);
  const expected = Buffer.from(expectedSecret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function registerTelegramWebhook(app: Express) {
  app.get("/api/telegram/health", (_req, res) => {
    res.json({
      ok: true,
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
    });
  });

  const setPlatformVisitCors = (req: { get: (name: string) => string | undefined }, res: { setHeader: (name: string, value: string) => void }) => {
    const origin = req.get("origin");
    if (origin && TELEGRAM_VISIT_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
  };

  const setPlatformAdminCors = (req: { get: (name: string) => string | undefined }, res: { setHeader: (name: string, value: string) => void }) => {
    const origin = req.get("origin");
    if (origin === PLATFORM_ORIGIN) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Vary", "Origin");
  };

  app.options("/api/telegram/admin/*", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.options("/api/telegram/admin-stats", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin-stats", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    try {
      const stats = await getTelegramOwnerStatistics();
      res.status(200).json({
        ok: true,
        totalSubscribers: stats.totalSubscribers,
        firstSubscribedAt: stats.firstSubscribedAt?.toISOString() ?? null,
        lastActiveAt: stats.lastActiveAt?.toISOString() ?? null,
        regions: stats.regions,
        platformVisits: {
          total: stats.platformVisits.total,
          latestAt: stats.platformVisits.latestAt?.toISOString() ?? null,
        },
        hasadVisits: {
          total: stats.hasadVisits.total,
          latestAt: stats.hasadVisits.latestAt?.toISOString() ?? null,
        },
      });
    } catch (error) {
      console.error("[Telegram] Platform admin statistics failed:", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ ok: false });
    }
  });

  app.options("/api/telegram/admin/menu-items", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin/menu-items", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, items: await listManagedTelegramMenuItems(true) });
  });

  app.post("/api/telegram/admin/menu-items", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const item = await createManagedTelegramMenuItem(req.body ?? {}, adminUserId);
    if (!item) {
      res.status(400).json({ ok: false, error: "invalid_menu_item" });
      return;
    }
    res.status(201).json({ ok: true, item });
  });

  app.post("/api/telegram/admin/menu-items/upload", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
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

  app.put("/api/telegram/admin/menu-items/:id/upload", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
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
      const item = await updateManagedTelegramMenuItem(itemId, { ...req.body, actionType: "file", actionValue: stored.url }, adminUserId);
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

  app.put("/api/telegram/admin/menu-items/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const item = await updateManagedTelegramMenuItem(Number(req.params.id), req.body ?? {}, adminUserId);
    if (!item) {
      res.status(400).json({ ok: false, error: "invalid_menu_item" });
      return;
    }
    res.status(200).json({ ok: true, item });
  });

  app.delete("/api/telegram/admin/menu-items/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    if (!adminUserId || !(await deleteManagedTelegramMenuItem(Number(req.params.id), adminUserId))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true });
  });

  app.options("/api/telegram/admin/sections", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin/sections", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, sections: await listManagedTelegramSectionConfigs() });
  });

  app.put("/api/telegram/admin/sections/:sectionKey", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const section = await updateManagedTelegramSection(req.params.sectionKey, req.body ?? {}, adminUserId);
    if (!section) {
      res.status(400).json({ ok: false, error: "invalid_section" });
      return;
    }
    res.status(200).json({ ok: true, section });
  });

  app.get("/api/telegram/admin/audit-logs", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, logs: await listTelegramAdminAuditLogs() });
  });

  app.options("/api/telegram/admin/audit-logs", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.options("/api/telegram/admin/message-templates", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin/message-templates", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, templates: await listManagedTelegramMessageConfigs() });
  });

  app.put("/api/telegram/admin/message-templates/:messageKey", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const template = await updateManagedTelegramMessageTemplate(req.params.messageKey, req.body?.content, adminUserId);
    if (!template) {
      res.status(400).json({ ok: false, error: "invalid_message_template" });
      return;
    }
    res.status(200).json({ ok: true, template });
  });

  app.options("/api/telegram/admin/sources", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin/sources", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const page = Number(req.query.page ?? 1);
    res.status(200).json({ ok: true, ...(await listManagedTelegramSources(query, page)) });
  });

  app.put("/api/telegram/admin/sources/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
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

  app.delete("/api/telegram/admin/sources/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    if (!adminUserId || !(await deleteManagedTelegramSource(Number(req.params.id), adminUserId))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true });
  });

  app.options("/api/telegram/admin/sources/upload", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.post("/api/telegram/admin/sources/upload", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
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

  app.options("/api/telegram/admin/folders", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin/folders", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    const query = typeof req.query.q === "string" ? req.query.q : "";
    res.status(200).json({ ok: true, folders: await listManagedTelegramFolders(query) });
  });

  app.put("/api/telegram/admin/folders/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
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

  app.delete("/api/telegram/admin/folders/:id", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
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

  app.options("/api/telegram/admin/broadcasts", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin/broadcasts", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, broadcasts: await listManagedTelegramBroadcasts() });
  });

  app.post("/api/telegram/admin/broadcasts", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    if (!adminUserId) {
      res.status(403).json({ ok: false });
      return;
    }
    const broadcast = await createManagedTelegramBroadcastDraft(adminUserId, req.body?.message);
    if (!broadcast) {
      res.status(400).json({ ok: false, error: "invalid_broadcast" });
      return;
    }
    res.status(201).json({ ok: true, broadcast });
  });

  app.post("/api/telegram/admin/broadcasts/:id/cancel", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    const id = Number(req.params.id);
    const draft = adminUserId ? await getTelegramBroadcastDraft(id, adminUserId) : undefined;
    if (!adminUserId || !draft || !(await cancelTelegramBroadcastDraft(id, adminUserId))) {
      res.status(400).json({ ok: false });
      return;
    }
    if (draft.scheduleCronTaskUid) await deleteHeartbeatJob(draft.scheduleCronTaskUid, "").catch(() => undefined);
    await recordManagedTelegramBroadcastAudit(adminUserId, id, "cancel");
    res.status(200).json({ ok: true });
  });

  app.post("/api/telegram/admin/broadcasts/:id/schedule", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
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
        description: `بث تيليغرام مجدول #${id} في ${scheduledFor.toISOString()}`,
      }, "");
      if (!(await scheduleTelegramBroadcast(id, adminUserId, scheduledFor, job.taskUid))) {
        await deleteHeartbeatJob(job.taskUid, "").catch(() => undefined);
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

  app.post("/api/scheduled/telegram-broadcast", async (req, res) => {
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
      if (!(await beginScheduledTelegramBroadcast(draft.id, user.taskUid))) {
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
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      await completeTelegramBroadcast(draft.id, draft.ownerTelegramUserId, successCount, failureCount);
      await recordManagedTelegramBroadcastAudit(draft.ownerTelegramUserId, draft.id, "complete", { successCount, failureCount, scheduled: true });
      res.json({ ok: true, id: draft.id, successCount, failureCount });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      console.error("[Telegram] Scheduled broadcast failed:", message);
      res.status(500).json({ error: message, timestamp: new Date().toISOString() });
    }
  });

  app.post("/api/telegram/admin/broadcasts/:id/confirm", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    const id = Number(req.params.id);
    if (!adminUserId || req.body?.confirmation !== "SEND") {
      res.status(400).json({ ok: false, error: "confirmation_required" });
      return;
    }
    const draft = await getTelegramBroadcastDraft(id, adminUserId);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!draft || draft.status !== "draft" || draft.kind !== "message" || !draft.message || !token || !(await beginTelegramBroadcast(id, adminUserId))) {
      res.status(400).json({ ok: false, error: "unavailable_broadcast" });
      return;
    }
    await recordManagedTelegramBroadcastAudit(adminUserId, id, "confirm", { recipientCount: draft.recipientCount });
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
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    await completeTelegramBroadcast(id, adminUserId, successCount, failureCount);
    await recordManagedTelegramBroadcastAudit(adminUserId, id, "complete", { successCount, failureCount });
    res.status(200).json({ ok: true, id, successCount, failureCount });
  });

  app.options("/api/telegram/admin/subscriptions", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin/subscriptions/pending", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, requests: await listPendingImportantYemeniLawsSubscriptionRequests(20) });
  });

  app.options("/api/telegram/admin/referrals", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin/referrals", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, ...(await listManagedTelegramReferralRewards()) });
  });

  app.options("/api/telegram/admin/referrals/:id/revoke", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.post("/api/telegram/admin/referrals/:id/revoke", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    const rewardId = Number(req.params.id);
    if (!adminUserId || !Number.isInteger(rewardId) || rewardId < 1) {
      res.status(400).json({ ok: false, error: "invalid_referral_reward" });
      return;
    }
    if (!(await revokeManagedTelegramReferralReward(rewardId, adminUserId, req.body?.reason))) {
      res.status(409).json({ ok: false, error: "referral_reward_unavailable" });
      return;
    }
    res.status(200).json({ ok: true, id: rewardId });
  });

  app.options("/api/telegram/admin/usage-analytics", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin/usage-analytics", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    const rawDays = Number(req.query.days);
    const days = Number.isInteger(rawDays) ? rawDays : 30;
    res.status(200).json({ ok: true, analytics: await getTelegramUsageAnalytics(days) });
  });

  app.options("/api/telegram/admin/visit-analytics", (req, res) => {
    setPlatformAdminCors(req, res);
    res.status(204).end();
  });

  app.get("/api/telegram/admin/visit-analytics", async (req, res) => {
    setPlatformAdminCors(req, res);
    if (req.get("origin") !== PLATFORM_ORIGIN || !(await isPlatformAdministrator(req.get("authorization")))) {
      res.status(403).json({ ok: false });
      return;
    }
    const period = req.query.period;
    if (period !== "day" && period !== "week" && period !== "month") {
      res.status(400).json({ ok: false, error: "invalid_visit_period" });
      return;
    }
    res.status(200).json({ ok: true, analytics: await getTelegramVisitAnalytics(period as TelegramVisitPeriod) });
  });

  app.post("/api/telegram/admin/subscriptions/:id/:decision", async (req, res) => {
    setPlatformAdminCors(req, res);
    const adminUserId = req.get("origin") === PLATFORM_ORIGIN ? await getPlatformAdministratorId(req.get("authorization")) : undefined;
    const requestId = Number(req.params.id);
    const decision = req.params.decision;
    if (!adminUserId || !Number.isInteger(requestId) || requestId < 1 || !["approve", "reject"].includes(decision)) {
      res.status(400).json({ ok: false });
      return;
    }
    const result = decision === "approve"
      ? await approveImportantYemeniLawsSubscriptionRequest(requestId, adminUserId)
      : await rejectImportantYemeniLawsSubscriptionRequest(requestId, adminUserId);
    if (!result) {
      res.status(409).json({ ok: false, error: "request_unavailable" });
      return;
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const managedItemLabel = result.managedMenuItemId
      ? (await listManagedTelegramMenuItems(true)).find(item => item.id === result.managedMenuItemId)?.label || "الزر المخصص"
      : "أهم القوانين اليمنية التفاعلي";
    let notified = false;
    const chatId = Number(result.chatId);
    if (token && Number.isSafeInteger(chatId)) {
      try {
        await createTelegramSender(token).sendMessage(chatId, decision === "approve"
          ? `تم اعتماد اشتراكك في قسم ${managedItemLabel}. يمكنك فتح القسم الآن من القائمة الرئيسة.`
          : `لم يُعتمد طلب الاشتراك في قسم ${managedItemLabel}. راجع بيانات التحويل ثم أرسل طلبًا جديدًا عند الحاجة.`);
        notified = true;
      } catch {
        notified = false;
      }
    }
    await recordManagedTelegramAdminAudit(adminUserId, decision, result.managedMenuItemId ? "managed_menu_subscription" : "important_laws_subscription", String(requestId), { notified, managedMenuItemId: result.managedMenuItemId });
    res.status(200).json({ ok: true, decision, notified, telegramUserId: result.telegramUserId });
  });

  app.options("/api/telegram/platform-visit", (req, res) => {
    setPlatformVisitCors(req, res);
    res.status(204).end();
  });

  app.options("/api/telegram/hasad-visit", (req, res) => {
    setPlatformVisitCors(req, res);
    res.status(204).end();
  });

  app.post("/api/telegram/platform-visit", async (req, res) => {
    setPlatformVisitCors(req, res);
    const origin = req.get("origin");
    if (origin && origin !== "https://alnaseer.org") {
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
      await confirmTelegramPlatformAccess(visit.telegramUserId, normalizeTelegramRegion(req.body?.region));
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[Telegram] Platform visit verification failed:", error instanceof Error ? error.message : "unknown error");
      res.status(400).json({ ok: false });
    }
  });

  app.post("/api/telegram/hasad-visit", async (req, res) => {
    setPlatformVisitCors(req, res);
    const origin = req.get("origin");
    if (origin && !HASAD_ORIGINS.has(origin)) {
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
      await confirmTelegramHasadAccess(visit.telegramUserId, normalizeTelegramRegion(req.body?.region));
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("[Telegram] Hasad visit verification failed:", error instanceof Error ? error.message : "unknown error");
      res.status(400).json({ ok: false });
    }
  });

  app.post("/api/telegram/webhook", async (req, res) => {
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
      await handleTelegramUpdate(
        req.body as TelegramUpdate,
        {
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
          getGroupExamLeaderboard: getTelegramGroupExamLeaderboard,
        },
        createTelegramSender(token),
        undefined,
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
