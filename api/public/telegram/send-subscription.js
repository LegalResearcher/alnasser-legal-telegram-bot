const PLATFORM_ORIGIN = "https://alnaseer.org";

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin === PLATFORM_ORIGIN) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Subscription-Bridge-Secret");
  res.setHeader("Vary", "Origin");
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const expectedSecret = process.env.SUBSCRIPTION_BRIDGE_SECRET || "alnaseer-subscription-bridge-2026-v1";
  if (req.headers["x-subscription-bridge-secret"] !== expectedSecret) {
    res.status(401).json({ ok: false });
    return;
  }

  const chatId = req.body?.chat_id;
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || (!Number.isSafeInteger(Number(chatId)) && typeof chatId !== "string") || !message || message.length > 4000) {
    res.status(400).json({ ok: false });
    return;
  }

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    const telegramData = await telegramResponse.json();
    if (!telegramResponse.ok || !telegramData.ok) {
      console.error("Telegram subscription delivery failed:", telegramData);
      res.status(502).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Subscription bridge error:", error);
    res.status(502).json({ ok: false });
  }
}
