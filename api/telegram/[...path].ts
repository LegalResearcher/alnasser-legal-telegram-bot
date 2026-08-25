import express from "express";
import { registerTelegramWebhook } from "../../server/telegramWebhook.ts";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
registerTelegramWebhook(app);

export default app;
