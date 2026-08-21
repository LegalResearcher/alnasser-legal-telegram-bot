import { beginTelegramBroadcast, completeTelegramBroadcast, getTelegramBroadcastDraft, listTelegramSubscriberChatIds } from "../server/db.ts";

const ownerTelegramUserId = String(process.env.TELEGRAM_OWNER_ID ?? "").trim();
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const broadcastId = 1;
if (!ownerTelegramUserId || !botToken) throw new Error("تعذر إرسال البث لغياب إعدادات المالك أو البوت.");

const draft = await getTelegramBroadcastDraft(broadcastId, ownerTelegramUserId);
if (!draft || draft.status !== "draft" || draft.kind !== "message" || !draft.message) {
  throw new Error("مسودة البث الافتتاحي غير متاحة للإرسال.");
}
if (!(await beginTelegramBroadcast(broadcastId, ownerTelegramUserId))) {
  throw new Error("تعذر بدء البث لأن المسودة أُرسلت أو أُلغيت سابقًا.");
}

const recipientChatIds = await listTelegramSubscriberChatIds();
let successCount = 0;
let failureCount = 0;
for (const chatId of recipientChatIds) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: draft.message, parse_mode: "HTML" }),
    });
    if (!response.ok) throw new Error(`Telegram ${response.status}`);
    successCount += 1;
  } catch {
    failureCount += 1;
  }
}

await completeTelegramBroadcast(broadcastId, ownerTelegramUserId, successCount, failureCount);
console.log(JSON.stringify({ broadcastId, recipientCount: recipientChatIds.length, successCount, failureCount }));
process.exit(0);
