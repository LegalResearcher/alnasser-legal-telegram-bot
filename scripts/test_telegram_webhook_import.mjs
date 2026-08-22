import express from "express";
import { registerTelegramWebhook } from "../server/telegramWebhook.ts";

const app = express();
app.use(express.json());
registerTelegramWebhook(app);
console.log("telegram webhook registration ok");
