import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { synchronizeTelegramConfiguration } from "../telegram";
import { registerTelegramWebhook } from "../telegramWebhook";
import { registerTelegramSubscriptionReminder } from "../telegramSubscriptionReminder";
import { registerTelegramReferralQualifier } from "../telegramReferralQualifier";
import { registerSupabaseExamSyncJob } from "../supabaseExamSyncJob";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerTelegramWebhook(app);
  registerTelegramSubscriptionReminder(app);
  registerTelegramReferralQualifier(app);
  // مزامنة الاختبارات مهمة لمرة واحدة فقط؛ لا تُفعّل في الإنتاج إلا أثناء عملية Snapshot صريحة.
  if (process.env.ENABLE_SUPABASE_EXAM_SYNC_JOB === "true") {
    registerSupabaseExamSyncJob(app);
  }
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // منصة الاستضافة تمرر PORT صراحةً؛ يجب الاستماع إليه تحديدًا حتى يصل وكيل النطاق إلى الخدمة.
  const port = Number(process.env.PORT || 3000);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
    void synchronizeTelegramConfiguration({
      token: process.env.TELEGRAM_BOT_TOKEN,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    }).catch(error => {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("[Telegram] Configuration synchronization failed:", message);
    });
  });
}

startServer().catch(console.error);
