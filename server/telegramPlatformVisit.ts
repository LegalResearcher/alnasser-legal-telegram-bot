import { createHmac, timingSafeEqual } from "node:crypto";

const SUPABASE_URL = "https://nhrlwemvkvgmtzoiwcym.supabase.co";
const MAX_INIT_DATA_AGE_SECONDS = 5 * 60;

export type TelegramWebAppVisit = {
  telegramUserId: string;
  authDate: number;
};

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && leftBuffer.length > 0 && timingSafeEqual(leftBuffer, rightBuffer);
}

export function validateTelegramWebAppInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramWebAppVisit | undefined {
  if (!initData || !botToken) return undefined;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userJson = params.get("user");
  if (!receivedHash || !Number.isSafeInteger(authDate) || !userJson) return undefined;
  if (authDate > nowSeconds + 30 || nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS) return undefined;

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(calculatedHash, receivedHash)) return undefined;

  try {
    const user = JSON.parse(userJson) as { id?: number };
    const userId = user.id;
    if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId <= 0) return undefined;
    return { telegramUserId: String(userId), authDate };
  } catch {
    return undefined;
  }
}

export async function recordTelegramPlatformVisit(visit: TelegramWebAppVisit): Promise<void> {
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!apiKey) throw new Error("مفتاح Supabase الخادمي غير متاح لتسجيل زيارة المنصة.");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/telegram_platform_visits`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({
      telegram_user_id: visit.telegramUserId,
      auth_date: visit.authDate,
      source: "telegram_web_app",
    }),
  });

  if (!response.ok) {
    throw new Error(`تعذر تسجيل زيارة منصة الناصر (${response.status}).`);
  }
}

export async function verifyAndRecordTelegramPlatformVisit(initData: string, botToken: string): Promise<TelegramWebAppVisit> {
  const visit = validateTelegramWebAppInitData(initData, botToken);
  if (!visit) throw new Error("بيانات Telegram Web App غير صالحة أو منتهية.");
  await recordTelegramPlatformVisit(visit);
  return visit;
}
