import { forwardToN8n } from "./_webhookProxy.js";

export default async function handler(req, res) {
  await forwardToN8n(req, res, {
    webhookEnvName: "N8N_LESSON_WEBHOOK_URL",
    userIdFields: ["user_id"],
  });
}
