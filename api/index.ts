import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerTelegramWebhook } from "../server/telegramWebhook";
import { registerTelegramSubscriptionReminder } from "../server/telegramSubscriptionReminder";
import { registerTelegramReferralQualifier } from "../server/telegramReferralQualifier";
import { registerSupabaseExamSyncJob } from "../server/supabaseExamSyncJob";

const app = express();

// Configure body parser with larger size limit for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerStorageProxy(app);
registerOAuthRoutes(app);
registerTelegramWebhook(app);
registerTelegramSubscriptionReminder(app);
registerTelegramReferralQualifier(app);
registerSupabaseExamSyncJob(app);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// تصدير التطبيق ليعمل كدالة Serverless على Vercel
export default app;
