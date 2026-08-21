import { createTelegramBroadcastDraft } from "../server/db.ts";

const ownerTelegramUserId = String(process.env.TELEGRAM_OWNER_ID ?? "").trim();
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!ownerTelegramUserId || !botToken) throw new Error("تعذر تجهيز معاينة البث لغياب إعدادات المالك أو البوت.");

const message = [
  "🏛 <b>افتتاح بوت الناصر القانوني</b>",
  "",
  "يسعدنا الإعلان عن افتتاح <b>بوت الناصر القانوني</b>؛ منصتكم الرقمية للوصول المنظم إلى المصادر والمراجع القانونية والفقهية.",
  "",
  "يوفّر البوت:",
  "• تصفح المكتبة القانونية والبحث داخل محتواها.",
  "• القواعد القضائية والتشريعات اليمنية والفهارس التفاعلية.",
  "• أكثر من <b>25,718 سؤالًا</b> ضمن المستويات الأربعة للشريعة والقانون.",
  "• <b>نظام اختبارات مؤتمت</b> يحاكي منهجية اختبارات الجامعات، وفق تسلسل المستويات والمواد والنماذج، مع اختيار زمن السؤال والنتائج والتصحيح والشرح.",
  "",
  "ابدأ الآن عبر: <b>@Moieen2025Bot</b>",
  "",
  "👨‍⚖️ إعداد وإشراف: <b>أ. معين الناصر</b>",
].join("\n");

const draft = await createTelegramBroadcastDraft({
  ownerTelegramUserId,
  kind: "message",
  message,
});
if (!draft) throw new Error("تعذر إنشاء مسودة رسالة الافتتاح.");

const preview = [
  "📣 <b>معاينة البث الجماعي</b>",
  "",
  "الرسالة:",
  message,
  "",
  `المستلمون المسجلون حاليًا: ${draft.recipientCount}`,
  "لن يُرسل شيء قبل الضغط على «تأكيد الإرسال».",
].join("\n");

const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    chat_id: ownerTelegramUserId,
    text: preview,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "تأكيد الإرسال", callback_data: `broadcast:confirm:${draft.id}` }],
        [{ text: "إلغاء", callback_data: `broadcast:cancel:${draft.id}` }],
      ],
    },
  }),
});
if (!response.ok) throw new Error(`تعذر إرسال معاينة المالك: ${response.status}`);

console.log(JSON.stringify({ draftId: draft.id, recipientCount: draft.recipientCount, status: draft.status }));
