import express from "express";
import { timingSafeEqual } from "node:crypto";

type TelegramHandlerApp = ReturnType<typeof express>;

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

let registeredHandler: TelegramHandlerApp | null = null;

function hasValidSecret(receivedSecret: string | undefined, expectedSecret: string | undefined) {
  if (!receivedSecret || !expectedSecret) return false;
  const received = Buffer.from(receivedSecret);
  const expected = Buffer.from(expectedSecret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

app.post("/api/telegram/webhook", async (req, res, next) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = req.get("x-telegram-bot-api-secret-token");

  if (!hasValidSecret(receivedSecret, expectedSecret)) {
    res.status(401).json({ ok: false });
    return;
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    res.status(503).json({ ok: false });
    return;
  }

  try {
    if (!registeredHandler) {
      const { registerTelegramWebhook } = await import("../../server/telegramWebhook");
      registeredHandler = express();
      registerTelegramWebhook(registeredHandler);
    }
    registeredHandler(req, res, next);
  } catch (error) {
    console.error("[Telegram] Webhook initialization failed:", error);
    res.status(500).json({ ok: false });
  }
});

export default app;
