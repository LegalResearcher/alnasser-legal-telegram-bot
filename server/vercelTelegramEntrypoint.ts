import express from "express";
import { registerTelegramWebhook } from "./telegramWebhook.ts";
import { synchronizeTelegramConfiguration } from "./telegram.ts";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
registerTelegramWebhook(app);

// Vercel لا يشغّل خادمًا دائمًا؛ نفّذ مزامنة الإعدادات مرة عند تحميل Lambda.
// لا يحدث setWebhook إلا إذا كان token وURL وsecret موجودة وصالحة.
void synchronizeTelegramConfiguration({
  token: process.env.TELEGRAM_BOT_TOKEN,
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
}).catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error("[Telegram] Vercel configuration synchronization failed:", message);
});

export default app;
