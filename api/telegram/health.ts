export default function health(_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) {
  res.status(200).json({
    ok: true,
    storage: process.env.BOT_STORAGE_MODE === "supabase" ? "supabase" : "mysql",
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
  });
}
