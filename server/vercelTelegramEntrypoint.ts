import express from "express";
import { registerTelegramWebhook } from "./telegramWebhook.ts";
import { synchronizeTelegramConfiguration } from "./telegram.ts";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
let telegramConfigurationPromise: Promise<void> | undefined;
function ensureTelegramConfiguration() {
  if (!telegramConfigurationPromise) {
    telegramConfigurationPromise = synchronizeTelegramConfiguration({
      token: process.env.TELEGRAM_BOT_TOKEN,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("[Telegram] Vercel configuration synchronization failed:", message);
    });
  }
  return telegramConfigurationPromise;
}

// انتظر المزامنة داخل دورة الطلب حتى لا تُلغى fetch عند انتهاء Lambda.
// تبقى memoized داخل كل Lambda ولا تعيد setWebhook لكل طلب.
app.use(async (_req, _res, next) => {
  await ensureTelegramConfiguration();
  next();
});

registerTelegramWebhook(app);

export default app;
